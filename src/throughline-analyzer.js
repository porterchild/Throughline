// Core ThroughlineAnalyzer - Single Agent with SS API Tools
const crypto = require('crypto');
const fs = require('fs');
const pathModule = require('path');

class ThroughlineAnalyzer {
  constructor(apiConfig = {}) {
    this.threads = [];
    this.paperStore = new Map();
    this.processedPapers = new Set(); // paper IDs already added to any track
    this.paperIdCache = new Map();
    this.maxThreads = apiConfig.maxThreads || 10;
    this.maxPapersPerThread = apiConfig.maxPapersPerThread || 20;
    this.progressCallback = null;
    this.debugTree = [];
    this.stopped = false;
    this.seedPapers = [];

    this.timeStats = { llmCalls: 0, llmTimeMs: 0, ssCalls: 0, ssTimeMs: 0, ssRetries: 0, ssCacheHits: 0 };

    this.clusteringCriteria = apiConfig.clusteringCriteria || null;
    this.maxCompletionTokens = apiConfig.maxCompletionTokens || 15000;

    this.openRouterApiKey = apiConfig.openRouterApiKey || null;
    this.semanticScholarDelay = apiConfig.semanticScholarDelay || 5000;
    this.lastSemanticScholarCall = 0;

    this.ssCacheDir = apiConfig.ssCacheDir || pathModule.join(process.cwd(), '.ss-cache');
    this.ssCacheTTL = apiConfig.ssCacheTTL || 7 * 24 * 60 * 60 * 1000;
    this.ssCacheEnabled = apiConfig.ssCacheEnabled !== false;
    if (this.ssCacheEnabled) {
      fs.mkdirSync(this.ssCacheDir, { recursive: true });
      this.pruneStaleCache();
    }

    this.logger = apiConfig.logger || {
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args),
      warn: (...args) => console.warn(...args)
    };
  }

  async traceResearchLineages(seedPapers, onProgress) {
    this.progressCallback = onProgress;
    return this.analyze(seedPapers);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN: One agent, tools, user criteria, go.
  // ═══════════════════════════════════════════════════════════════════

  async analyze(seedPapers) {
    const analysisStartTime = Date.now();
    this.logger.log('\n' + '='.repeat(70));
    this.logger.log('STARTING THROUGHLINE ANALYSIS (Agent Mode)');
    this.logger.log('='.repeat(70));
    this.logger.log(`Seed papers: ${seedPapers.length}`);
    seedPapers.forEach((p, i) => this.logger.log(`  ${i+1}. "${p.title}" (${p.year})`));
    this.logger.log('='.repeat(70) + '\n');

    this.stopped = false;
    this.debugTree = [];
    this.threads = [];
    this.processedPapers = new Set();
    this.paperStore = new Map();
    this.seedPapers = seedPapers;

    this.updateProgress('Starting analysis...', 'Agent exploring research landscape', 0);

    // Resolve seed paper IDs upfront so the agent has them
    for (const seed of seedPapers) {
      await this.resolvePaperId(seed);
      if (seed.paperId) {
        this.paperStore.set(seed.paperId, seed);
        this.processedPapers.add(seed.paperId);
        this.processedPapers.add(seed.title);
      }
    }

    // Run the agent
    await this.runAgent(seedPapers);

    const totalTime = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
    this.logger.log('\n' + '='.repeat(70));
    this.logger.log('ANALYSIS COMPLETE');
    this.logger.log('='.repeat(70));
    this.logger.log(`Total time: ${totalTime}s`);
    this.logger.log(`Threads found: ${this.threads.length}`);
    this.logger.log(`Total papers: ${this.threads.reduce((sum, t) => sum + t.papers.length, 0)}`);
    this.logger.log(`\nTIME BREAKDOWN:`);
    this.logger.log(`  LLM calls: ${this.timeStats.llmCalls} calls, ${(this.timeStats.llmTimeMs/1000).toFixed(1)}s total`);
    this.logger.log(`  SS API calls: ${this.timeStats.ssCalls} calls, ${(this.timeStats.ssTimeMs/1000).toFixed(1)}s total`);
    this.logger.log(`  SS cache hits: ${this.timeStats.ssCacheHits}`);
    this.logger.log(`  SS retries (429s): ${this.timeStats.ssRetries}`);
    this.logger.log(`  Other/overhead: ${(totalTime - this.timeStats.llmTimeMs/1000 - this.timeStats.ssTimeMs/1000).toFixed(1)}s`);
    this.logger.log('='.repeat(70) + '\n');

    this.updateProgress('Analysis complete', `Found ${this.threads.length} research threads`, 100);
    return this.threads;
  }

  async resolvePaperId(paper) {
    if (paper.paperId && paper.paperId.length >= 10) return;
    if (this.paperIdCache.has(paper.title)) {
      paper.paperId = this.paperIdCache.get(paper.title);
      return;
    }
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/paper/search/match?query=${encodeURIComponent(paper.title)}&fields=paperId,title,abstract,year,authors,citationCount`,
      method: 'GET'
    }, `paper match: ${paper.title.substring(0, 30)}...`);
    if (resp.data.data && resp.data.data.length > 0) {
      paper.paperId = resp.data.data[0].paperId;
      this.paperIdCache.set(paper.title, paper.paperId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // THE AGENT
  // ═══════════════════════════════════════════════════════════════════

  async runAgent(seedPapers) {
    const criteria = (this.clusteringCriteria && this.clusteringCriteria.trim())
      || 'No additional criteria provided by the user.';

    const seedInfo = seedPapers.map(p =>
      `- "${p.title}" (${p.year}) by ${(p.authors || []).map(a => a.name).join(', ')} [ID: ${p.paperId}]\n  Abstract: ${p.abstract || 'N/A'}`
    ).join('\n');

    const systemPrompt = `You are a research exploration agent. Your job is to explore the academic literature starting from seed paper(s) and build research tracks that satisfy the user's research criteria. You have access to the Semantic Scholar API through tools.

SEED PAPER(S):
${seedInfo}

USER'S RESEARCH CRITERIA:
${criteria}

HOW TO WORK:
Use create_track to organize what you find into distinct threads, and add_paper_to_track to populate them.
Choose your own exploration strategy based on the user's criteria and the evidence you uncover.

Tool calls that return papers will show you paper IDs and author IDs. You need paper IDs to add papers to tracks or to look up their citations/references. Use author IDs (from paper results) with get_author_papers for precise lookups. Papers must appear in a tool result before you can add them.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Begin exploring and build tracks that satisfy the user\'s research criteria.' }
    ];

    let iterations = 0;
    const maxIterations = 40;

    while (iterations < maxIterations) {
      if (await this.checkStopped()) throw new Error('Analysis stopped by user');
      iterations++;

      const totalPapers = this.threads.reduce((sum, t) => sum + t.papers.length, 0);
      this.logger.log(`\n--- Agent iteration ${iterations} (${this.threads.length} tracks, ${totalPapers} total papers) ---`);
      this.updateProgress(`Agent exploring...`, `${this.threads.length} tracks, ${totalPapers} papers (iteration ${iterations})`, null);

      let response;
      try {
        response = await this.callLLMWithTools(messages);
      } catch (e) {
        this.logger.error(`[AGENT] LLM call failed: ${e.message}`);
        break;
      }

      messages.push(response.message);

      if (response.message.content) {
        this.logger.log(`[AGENT] ${response.message.content}`);
      }

      if (!response.toolCalls || response.toolCalls.length === 0) {
        this.logger.log('[AGENT] No tool calls, agent finished.');
        break;
      }

      let agentDone = false;
      for (const call of response.toolCalls) {
        const toolName = call.function.name;
        let toolArgs;
        try {
          toolArgs = JSON.parse(call.function.arguments);
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: `Bad arguments: ${e.message}` }) });
          this.logger.warn(`[AGENT] Bad tool args for ${toolName}: ${e.message}`);
          continue;
        }

        this.logger.log(`[AGENT] Tool: ${toolName}(${JSON.stringify(toolArgs)})`);

        const result = await this.executeTool(toolName, toolArgs);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });

        if (toolName === 'done') agentDone = true;

        // Log summary
        if (result.error) {
          this.logger.log(`[AGENT]   -> Error: ${result.error}`);
        } else if (result.papers) {
          this.logger.log(`[AGENT]   -> ${result.papers.length} papers returned`);
        } else if (result.added) {
          this.logger.log(`[AGENT]   -> Added to "${result.track}": "${result.title}" (${result.year})`);
        } else if (result.skipped) {
          this.logger.log(`[AGENT]   -> Skipped: ${result.reason}`);
        } else if (result.track_created) {
          this.logger.log(`[AGENT]   -> Created track: "${result.theme}"`);
        } else if (result.done) {
          this.logger.log(`[AGENT]   -> Done: ${result.summary}`);
        }
      }

      if (agentDone) {
        this.logger.log('[AGENT] Agent called done().');
        break;
      }
    }

    this.logger.log(`\n[AGENT] Finished after ${iterations} iterations.`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Tool Definitions
  // ═══════════════════════════════════════════════════════════════════

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'search_papers',
          description: 'Search Semantic Scholar for papers matching a query. Results are filtered by a reader model based on your focus instructions. Short keyword phrases (2-4 words) work best.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              min_year: { type: 'integer', description: 'Minimum publication year' },
              limit: { type: 'integer', description: 'Max results (default 20, max 50)' }
            },
            required: ['query', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_paper_citations',
          description: 'Get papers that cite a given paper (forward citations). Results are filtered by a reader model based on your focus instructions.',
          parameters: {
            type: 'object',
            properties: {
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              limit: { type: 'integer', description: 'Max results (default 100, max 200)' }
            },
            required: ['paper_id', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_paper_references',
          description: 'Get papers referenced by a given paper (backward references). Results are filtered by a reader model based on your focus instructions.',
          parameters: {
            type: 'object',
            properties: {
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              limit: { type: 'integer', description: 'Max results (default 50, max 100)' }
            },
            required: ['paper_id', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_recommendations',
          description: 'Get papers similar to a given paper via Semantic Scholar recommendations. Results are filtered by a reader model based on your focus instructions.',
          parameters: {
            type: 'object',
            properties: {
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              limit: { type: 'integer', description: 'Max results (default 50, max 100)' }
            },
            required: ['paper_id', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_author_papers',
          description: 'Get an author\'s publications. Prefer using author_id (from paper results) over author_name to avoid disambiguation issues with common names. Results are filtered by a reader model based on your focus instructions.',
          parameters: {
            type: 'object',
            properties: {
              author_id: { type: 'string', description: 'Semantic Scholar author ID from paper results (preferred — avoids wrong-person issues)' },
              author_name: { type: 'string', description: 'Author name to search for (fallback if no ID available)' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              min_year: { type: 'integer', description: 'Minimum publication year' }
            },
            required: ['focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_track',
          description: 'Create a new research track when you identify a distinct group of papers relevant to the user\'s criteria.',
          parameters: {
            type: 'object',
            properties: {
              theme: { type: 'string', description: 'One-sentence description of this research track' }
            },
            required: ['theme']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_paper_to_track',
          description: 'Add a paper to a specific track. The paper must have appeared in a previous tool result.',
          parameters: {
            type: 'object',
            properties: {
              track_index: { type: 'integer', description: 'Track number (0-based index)' },
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              reason: { type: 'string', description: 'Why this paper belongs in this track' }
            },
            required: ['track_index', 'paper_id', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'done',
          description: 'Signal that exploration is complete when you have enough evidence to satisfy the user\'s research criteria.',
          parameters: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'Summary of tracks found and exploration done' }
            },
            required: ['summary']
          }
        }
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // Tool Execution
  // ═══════════════════════════════════════════════════════════════════

  async executeTool(name, args) {
    try {
      switch (name) {
        case 'search_papers': return await this.toolSearchPapers(args);
        case 'get_paper_citations': return await this.toolGetCitations(args);
        case 'get_paper_references': return await this.toolGetReferences(args);
        case 'get_recommendations': return await this.toolGetRecommendations(args);
        case 'get_author_papers': return await this.toolGetAuthorPapers(args);
        case 'create_track': return this.toolCreateTrack(args);
        case 'add_paper_to_track': return this.toolAddPaperToTrack(args);
        case 'done': return this.toolDone(args);
        default: return { error: `Unknown tool: ${name}` };
      }
    } catch (e) {
      return { error: e.message };
    }
  }

  async toolSearchPapers({ query, focus, min_year, limit }) {
    limit = Math.min(limit || 20, 50);
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=paperId,title,abstract,year,authors,citationCount&limit=${limit}`;
    if (min_year) url += `&publicationDateOrYear=${min_year}:`;
    const resp = await this.throttledSemanticScholarCall({ url, method: 'GET' }, `search: ${query}`);
    const papers = (resp.data.data || []).filter(p => p && p.paperId);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    return await this.filterWithReader(papers, focus, `search results for "${query}"`);
  }

  async toolGetCitations({ paper_id, focus, limit }) {
    limit = Math.min(limit || 50, 200);
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/paper/${paper_id}/citations?fields=paperId,title,abstract,year,authors,citationCount&limit=${limit}`,
      method: 'GET'
    }, `citations: ${paper_id.substring(0, 12)}...`);
    const papers = (resp.data.data || []).map(c => c.citingPaper).filter(p => p && p.paperId);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    const sourcePaper = this.paperStore.get(paper_id);
    const sourceTitle = sourcePaper?.title || paper_id;
    return await this.filterWithReader(papers, focus, `citations of "${sourceTitle}"`);
  }

  async toolGetReferences({ paper_id, focus, limit }) {
    limit = Math.min(limit || 50, 100);
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/paper/${paper_id}/references?fields=paperId,title,abstract,year,authors,citationCount&limit=${limit}`,
      method: 'GET'
    }, `references: ${paper_id.substring(0, 12)}...`);
    const papers = (resp.data.data || []).map(r => r.citedPaper).filter(p => p && p.paperId);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    const sourcePaper = this.paperStore.get(paper_id);
    const sourceTitle = sourcePaper?.title || paper_id;
    return await this.filterWithReader(papers, focus, `references of "${sourceTitle}"`);
  }

  async toolGetRecommendations({ paper_id, focus, limit }) {
    limit = Math.min(limit || 50, 100);
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/recommendations/v1/papers?fields=paperId,title,abstract,year,authors,citationCount&limit=${limit}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { positivePaperIds: [paper_id] }
    }, `recommendations: ${paper_id.substring(0, 12)}...`);
    const papers = (resp.data.recommendedPapers || []).filter(p => p && p.paperId);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    const sourcePaper = this.paperStore.get(paper_id);
    const sourceTitle = sourcePaper?.title || paper_id;
    return await this.filterWithReader(papers, focus, `recommendations for "${sourceTitle}"`);
  }

  async toolGetAuthorPapers({ author_id, author_name, focus, min_year }) {
    let authorId, authorName, authorHIndex, authorPaperCount;

    if (author_id) {
      // Direct lookup by ID — no disambiguation needed
      const infoResp = await this.throttledSemanticScholarCall({
        url: `https://api.semanticscholar.org/graph/v1/author/${author_id}?fields=name,paperCount,hIndex`,
        method: 'GET'
      }, `author info: ${author_id}`);
      authorId = author_id;
      authorName = infoResp.data.name;
      authorHIndex = infoResp.data.hIndex;
      authorPaperCount = infoResp.data.paperCount;
    } else if (author_name) {
      // Search by name — may be ambiguous for common names
      const searchResp = await this.throttledSemanticScholarCall({
        url: `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(author_name)}&fields=name,paperCount,hIndex&limit=5`,
        method: 'GET'
      }, `author search: ${author_name}`);
      const authors = searchResp.data.data || [];
      if (authors.length === 0) return { error: `No author found for "${author_name}"` };
      const author = authors.reduce((best, a) => (a.hIndex || 0) > (best.hIndex || 0) ? a : best, authors[0]);
      authorId = author.authorId;
      authorName = author.name;
      authorHIndex = author.hIndex;
      authorPaperCount = author.paperCount;
    } else {
      return { error: 'Provide either author_id or author_name' };
    }

    this.logger.log(`  [Author] Found: ${authorName} (id: ${authorId}, h-index: ${authorHIndex}, papers: ${authorPaperCount})`);

    let url = `https://api.semanticscholar.org/graph/v1/author/${authorId}/papers?fields=paperId,title,abstract,year,authors,citationCount&limit=50`;
    if (min_year) url += `&publicationDateOrYear=${min_year}:`;
    const papersResp = await this.throttledSemanticScholarCall({ url, method: 'GET' }, `author papers: ${authorName}`);
    const papers = (papersResp.data.data || []).filter(p => p && p.paperId);
    for (const p of papers) this.paperStore.set(p.paperId, p);

    const filtered = await this.filterWithReader(papers, focus, `papers by ${authorName}`);
    return {
      author: { name: authorName, authorId, hIndex: authorHIndex, paperCount: authorPaperCount },
      ...filtered
    };
  }

  toolCreateTrack({ theme }) {
    if (this.threads.length >= this.maxThreads) {
      return { error: `Maximum ${this.maxThreads} tracks reached.` };
    }
    const track = {
      id: this.generateThreadId(),
      theme,
      spawnYear: null,
      spawnPaper: null,
      papers: [],
      subThreads: []
    };
    this.threads.push(track);
    this.logger.log(`  [TRACK] Created track ${this.threads.length - 1}: "${theme}"`);
    return {
      track_created: true,
      track_index: this.threads.length - 1,
      theme,
      total_tracks: this.threads.length
    };
  }

  toolAddPaperToTrack({ track_index, paper_id, reason }) {
    if (track_index < 0 || track_index >= this.threads.length) {
      return { error: `Invalid track index ${track_index}. You have ${this.threads.length} tracks (0-${this.threads.length - 1}).` };
    }
    const track = this.threads[track_index];

    const paper = this.paperStore.get(paper_id);
    if (!paper) return { error: `Paper ${paper_id} not found. It must appear in a previous tool result first.` };

    if (this.processedPapers.has(paper_id) || this.processedPapers.has(paper.title)) {
      return { skipped: true, reason: 'Already added to a track', title: paper.title };
    }

    if (track.papers.length >= this.maxPapersPerThread) {
      return { skipped: true, reason: `Track is full (${this.maxPapersPerThread} papers)`, title: paper.title };
    }

    paper.selectionReason = reason;
    track.papers.push(paper);
    this.processedPapers.add(paper_id);
    this.processedPapers.add(paper.title);

    if (!track.spawnPaper) {
      track.spawnPaper = paper;
      track.spawnYear = paper.year;
    }

    const authors = (paper.authors || []).slice(0, 5).map(a => a.name).join(', ');
    return {
      added: true,
      track: track.theme,
      title: paper.title,
      year: paper.year,
      authors,
      trackSize: track.papers.length
    };
  }

  toolDone({ summary }) {
    this.logger.log(`  [DONE] ${summary}`);
    return { done: true, summary };
  }

  formatPapersForLLM(papers) {
    return papers.map(p => ({
      id: p.paperId,
      title: p.title,
      year: p.year,
      authors: (p.authors || []).slice(0, 3).map(a => a.name).join(', '),
      author_ids: Object.fromEntries(
        (p.authors || []).slice(0, 3)
          .filter(a => a.authorId)
          .map(a => [a.name, a.authorId])
      ),
      citations: p.citationCount || 0,
      abstract: p.abstract || ''
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  // Reader Model — filters raw SS API results before main agent sees them
  // ═══════════════════════════════════════════════════════════════════

  async filterWithReader(papers, focus, source) {
    if (papers.length === 0) return { papers: [], source, total_raw: 0 };

    const criteria = (this.clusteringCriteria && this.clusteringCriteria.trim())
      || 'No additional criteria provided by the user.';

    // Build current tracks context so reader knows what's already been found
    const trackContext = this.threads.length > 0
      ? this.threads.map((t, i) => `  Track ${i}: "${t.theme}" (${t.papers.length} papers)`).join('\n')
      : '  (no tracks created yet)';

    const rawPapers = this.formatPapersForLLM(papers);

    const readerPrompt = `You are a research paper filter. You receive raw results from a Semantic Scholar API call and must select papers that best match the main agent's focus and the user's criteria.

USER'S RESEARCH CRITERIA:
${criteria}

CURRENT TRACKS:
${trackContext}

THE MAIN AGENT'S FOCUS FOR THIS CALL:
${focus}

SOURCE: ${source} (${rawPapers.length} papers)

RAW PAPERS:
${JSON.stringify(rawPapers)}

YOUR TASK:
Select papers matching the main agent's focus and the user's criteria.
Exclude papers that are not relevant to that focus.

For each paper, include full data plus a brief "note".

Respond with valid JSON only:
{
  "papers": [
    { "id": "...", "title": "...", "year": ..., "authors": "...", "author_ids": {...}, "citations": ..., "abstract": "...", "note": "why this matches the focus" }
  ],
  "summary": "What you found"
}`;

    this.logger.log(`  [Reader] Filtering ${rawPapers.length} papers (focus: ${focus})`);

    try {
      const readerResult = await this.callReaderLLM(readerPrompt);
      const parsed = JSON.parse(readerResult);
      const selected = parsed.papers || [];
      this.logger.log(`  [Reader] Selected ${selected.length} papers of ${rawPapers.length} papers`);
      return {
        papers: selected,
        summary: parsed.summary || '',
        source,
        total_raw: rawPapers.length
      };
    } catch (e) {
      // If reader fails, fall back to raw results
      this.logger.warn(`  [Reader] Failed (${e.message}), returning raw results`);
      return { papers: rawPapers, source, total_raw: rawPapers.length };
    }
  }

  async callReaderLLM(prompt) {
    const start = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        this.logger.log(`[Reader LLM] Prompt:\n${prompt}`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: this.maxCompletionTokens,
            reasoning: { enabled: true },
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(`[Reader LLM] HTTP ${response.status}: ${errText}`);
          if (attempt < 2) { await this.sleep(2000); continue; }
          throw new Error(`Reader LLM error: ${response.status}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - start;
        this.timeStats.llmCalls++;
        this.timeStats.llmTimeMs += elapsed;

        this.logger.log(`[Reader LLM] Response:\n${data.choices[0].message.content}`);
        return data.choices[0].message.content;
      } catch (e) {
        if (attempt < 2) {
          this.logger.error(`[Reader LLM] Attempt ${attempt + 1} failed: ${e.message}`);
          await this.sleep(2000);
        } else {
          throw e;
        }
      }
    }
    throw new Error('Reader LLM failed after 3 retries');
  }

  // ═══════════════════════════════════════════════════════════════════
  // LLM Calling
  // ═══════════════════════════════════════════════════════════════════

  async callLLMWithTools(messages) {
    if (await this.checkStopped()) throw new Error('Stopped');
    const start = Date.now();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        this.logger.log(`[LLM] Request messages:\n${JSON.stringify(messages, null, 2)}`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages,
            tools: this.getToolDefinitions(),
            max_tokens: this.maxCompletionTokens,
            reasoning: { enabled: true }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(`[LLM] HTTP ${response.status}: ${errText}`);
          if (attempt < 2) { await this.sleep(3000); continue; }
          throw new Error(`LLM API error: ${response.status}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - start;
        this.timeStats.llmCalls++;
        this.timeStats.llmTimeMs += elapsed;

        const choice = data.choices[0];
        this.logger.log(`[LLM] Response message:\n${JSON.stringify(choice.message, null, 2)}`);
        return {
          message: choice.message,
          toolCalls: choice.message.tool_calls || [],
          finishReason: choice.finish_reason
        };
      } catch (e) {
        if (attempt < 2) {
          this.logger.error(`[LLM] Attempt ${attempt + 1} failed: ${e.message}`);
          await this.sleep(3000);
        } else {
          throw e;
        }
      }
    }
    throw new Error('LLM failed after 3 retries');
  }

  // ═══════════════════════════════════════════════════════════════════
  // SS API Cache & Throttling
  // ═══════════════════════════════════════════════════════════════════

  pruneStaleCache() {
    try {
      const now = Date.now();
      let pruned = 0;
      for (const file of fs.readdirSync(this.ssCacheDir)) {
        const filePath = pathModule.join(this.ssCacheDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > this.ssCacheTTL) {
          fs.unlinkSync(filePath);
          pruned++;
        }
      }
      if (pruned > 0) this.logger.log(`[Cache] Pruned ${pruned} stale entries`);
    } catch (e) {
      this.logger.warn(`Cache prune failed: ${e.message}`);
    }
  }

  ssCacheKey(data) {
    const raw = JSON.stringify({ url: data.url, method: data.method || 'GET', body: data.body || null });
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  ssCacheGet(key) {
    if (!this.ssCacheEnabled) return null;
    const filePath = pathModule.join(this.ssCacheDir, `${key}.json`);
    try {
      const stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs > this.ssCacheTTL) {
        fs.unlinkSync(filePath);
        return null;
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  ssCacheSet(key, data) {
    if (!this.ssCacheEnabled) return;
    const filePath = pathModule.join(this.ssCacheDir, `${key}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data));
    } catch (e) {
      this.logger.warn(`Cache write failed: ${e.message}`);
    }
  }

  async throttledSemanticScholarCall(data, context = '') {
    const cacheKey = this.ssCacheKey(data);
    const cached = this.ssCacheGet(cacheKey);
    if (cached) {
      this.timeStats.ssCacheHits++;
      this.logger.log(`  [Cache HIT] ${context}`);
      return { success: true, data: cached };
    }

    const callStart = Date.now();
    const wait = Math.max(0, this.semanticScholarDelay - (Date.now() - this.lastSemanticScholarCall));
    if (wait > 0) await this.sleep(wait);

    for (let attempt = 1; attempt <= 8; attempt++) {
      this.lastSemanticScholarCall = Date.now();
      const response = await fetch(data.url, {
        method: data.method || 'GET',
        headers: data.headers || {},
        body: data.body ? JSON.stringify(data.body) : undefined
      });

      if (response.ok) {
        this.timeStats.ssCalls++;
        this.timeStats.ssTimeMs += Date.now() - callStart;
        const responseData = await response.json();
        this.ssCacheSet(cacheKey, responseData);
        return { success: true, data: responseData };
      }

      if (response.status === 429) {
        this.timeStats.ssRetries++;
        const delay = 5000 * Math.pow(2, attempt - 1);
        this.logger.warn(`429 Rate Limit. Retry ${attempt} in ${delay/1000}s...`);
        await this.sleep(delay);
      } else {
        throw new Error(`SS API Error: ${response.status}`);
      }
    }
    throw new Error('SS API Rate Limit Exhausted');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Utilities
  // ═══════════════════════════════════════════════════════════════════

  updateProgress(message, detail, percent, threads) {
    if (this.progressCallback) this.progressCallback(message, detail, percent, threads || this.threads);
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  generateThreadId() { return 't_' + Math.random().toString(36).substr(2, 9); }
  getDebugTree() { return this.debugTree; }
  async checkStopped() { return this.stopped; }
}

if (typeof module !== 'undefined') module.exports = { ThroughlineAnalyzer };
if (typeof window !== 'undefined') window.ThroughlineAnalyzer = ThroughlineAnalyzer;
