// Core ThroughlineAnalyzer - Single Agent with SS API Tools
const crypto = require('crypto');
const fs = require('fs');
const pathModule = require('path');

// ANSI color helpers
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  // standard
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  brown:   '\x1b[33m',  // dim yellow renders as brown in most terminals
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  // bright
  bred:     '\x1b[91m',
  bgreen:   '\x1b[92m',
  byellow:  '\x1b[93m',
  bblue:    '\x1b[94m',
  bmagenta: '\x1b[95m',
  bcyan:    '\x1b[96m',
  bwhite:   '\x1b[97m',
};
const fmt = (color, ...parts) => `${color}${parts.join('')}${C.reset}`;

const RATIONALE_DESC = 'Briefly explain your rationale for this tool call. Helps make your exploration legible to the user.';

class ThroughlineAnalyzer {
  constructor(apiConfig = {}) {
    this.logger = apiConfig.logger || {
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args),
      warn: (...args) => console.warn(...args)
    };

    this.threads = [];
    this.paperStore = new Map();
    this.processedPapers = new Set(); // paper IDs already added to any track
    this.paperIdCache = new Map();
    this.minIterations = apiConfig.minIterations || 40;
    this.progressCallback = null;
    this.debugTree = [];
    this.stopped = false;
    this.seedPapers = [];

    this.timeStats = { agentCalls: 0, agentTimeMs: 0, agentTimings: [], agentTokensIn: 0, agentTokensOut: 0, agentTokensCachedIn: 0, readerCalls: 0, readerTimeMs: 0, readerWallMs: 0, readerTimings: [], readerTokensIn: 0, readerTokensOut: 0, readerTokensCachedIn: 0, ssCalls: 0, ssTimeMs: 0, ssTimings: [], ssRetries: 0, ssCacheHits: 0 };
    this.addPaperCallCount = 0;
    this.primer = '';

    this.clusteringCriteria = apiConfig.clusteringCriteria || null;
    this.maxCompletionTokens = apiConfig.maxCompletionTokens || 15000;

    this.openRouterApiKey = apiConfig.openRouterApiKey || null;
    this.semanticScholarApiKey = apiConfig.semanticScholarApiKey || process.env.SEMANTIC_SCHOLAR_API_KEY || null;
    // Authenticated = dedicated 1 RPS; unauthenticated = contested shared pool (aggressive 429s)
    this.semanticScholarDelay = apiConfig.semanticScholarDelay || (this.semanticScholarApiKey ? 1100 : 5000);
    this.lastSemanticScholarCall = 0;

    this.ssCacheDir = apiConfig.ssCacheDir || pathModule.join(process.cwd(), '.ss-cache');
    this.ssCacheTTL = apiConfig.ssCacheTTL || 90 * 24 * 60 * 60 * 1000;
    this.ssCacheEnabled = apiConfig.ssCacheEnabled !== false;
    if (this.ssCacheEnabled) {
      fs.mkdirSync(this.ssCacheDir, { recursive: true });
      this.pruneStaleCache();
    }
  }

  async exploreUserInterest(seedPapers, onProgress) {
    this.progressCallback = onProgress;
    return this.analyze(seedPapers);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN: One agent, tools, user criteria, go.
  // ═══════════════════════════════════════════════════════════════════

  async analyze(seedPapers) {
    const analysisStartTime = Date.now();
    this.logger.log(fmt(C.bold + C.bcyan, '\n' + '═'.repeat(70)));
    this.logger.log(fmt(C.bold + C.bcyan, '  THROUGHLINE ANALYSIS — Agent Mode'));
    this.logger.log(fmt(C.bold + C.bcyan, '═'.repeat(70)));
    seedPapers.forEach((p, i) => this.logger.log(fmt(C.cyan, `  Seed ${i+1}: "${p.title}" (${p.year})`)));
    this.logger.log(fmt(C.dim, `  SS: ${this.semanticScholarApiKey ? 'authenticated (1 RPS dedicated)' : 'unauthenticated (shared pool — expect 429s)'}`));
    this.logger.log(fmt(C.bold + C.bcyan, '═'.repeat(70)) + '\n');

    this.stopped = false;
    this.debugTree = [];
    this.threads = [];
    this.processedPapers = new Set();
    this.paperStore = new Map();
    this.seedPapers = seedPapers;
    this.addPaperCallCount = 0;
    this.primer = '';

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
    const messages = await this.runAgent(seedPapers);

    const totalTime = ((Date.now() - analysisStartTime) / 1000).toFixed(1);
    this.logger.log(fmt(C.bold + C.bgreen, '\n' + '═'.repeat(70)));
    this.logger.log(fmt(C.bold + C.bgreen, '  ANALYSIS COMPLETE'));
    this.logger.log(fmt(C.bold + C.bgreen, '═'.repeat(70)));
    this.logger.log(fmt(C.bwhite, `  Threads: ${this.threads.length}  |  Papers: ${this.threads.reduce((sum, t) => sum + t.papers.length, 0)}  |  Time: ${totalTime}s`));
    const ts = this.timeStats;
    const pct = (ms) => totalTime > 0 ? ((ms / 1000) / totalTime * 100).toFixed(0) + '%' : '?';
    const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const max = (arr) => arr.length ? Math.round(Math.max(...arr)) : 0;
    const bar = (ms) => '█'.repeat(Math.min(20, Math.round((ms / 1000) / totalTime * 20)));
    const readerConcurrency = ts.readerWallMs > 0 ? (ts.readerTimeMs / ts.readerWallMs).toFixed(1) : null;
    const readerConcurrencyStr = readerConcurrency && parseFloat(readerConcurrency) > 1.1 ? ` [${readerConcurrency}× concurrency, ${(ts.readerTimeMs/1000).toFixed(0)}s cumulative]` : '';
    const unaccounted = totalTime - (ts.agentTimeMs + ts.readerWallMs + ts.ssTimeMs) / 1000;
    this.logger.log(fmt(C.bwhite, `\n  Time breakdown (wall-clock, total ${totalTime}s):`));
    const tokStr = (inn, out, cached) => `${inn.toLocaleString()} in${cached ? ` (${cached.toLocaleString()} cached)` : ''}, ${out.toLocaleString()} out`;
    this.logger.log(fmt(C.bcyan,  `  Agent  LLM │${bar(ts.agentTimeMs).padEnd(20)}│ ${(ts.agentTimeMs/1000).toFixed(1)}s ${pct(ts.agentTimeMs)} — ${ts.agentCalls} calls, avg ${avg(ts.agentTimings)}ms, max ${max(ts.agentTimings)}ms — ${tokStr(ts.agentTokensIn, ts.agentTokensOut, ts.agentTokensCachedIn)}`));
    this.logger.log(fmt(C.brown,  `  Reader LLM │${bar(ts.readerWallMs).padEnd(20)}│ ${(ts.readerWallMs/1000).toFixed(1)}s ${pct(ts.readerWallMs)}${readerConcurrencyStr} — ${ts.readerCalls} calls, avg ${avg(ts.readerTimings)}ms, max ${max(ts.readerTimings)}ms — ${tokStr(ts.readerTokensIn, ts.readerTokensOut, ts.readerTokensCachedIn)}`));
    this.logger.log(fmt(C.green,  `  SS API     │${bar(ts.ssTimeMs).padEnd(20)}│ ${(ts.ssTimeMs/1000).toFixed(1)}s ${pct(ts.ssTimeMs)} — ${ts.ssCalls} calls, avg ${avg(ts.ssTimings)}ms, max ${max(ts.ssTimings)}ms (${ts.ssCacheHits} cache hits, ${ts.ssRetries} retries)`));
    this.logger.log(fmt(C.dim,    `  Other/wait  │${'░'.repeat(20)}│ ${unaccounted.toFixed(1)}s ${((unaccounted/totalTime)*100).toFixed(0)}%`));
    this.logger.log(fmt(C.bold + C.bgreen, '═'.repeat(70)) + '\n');

    this.updateProgress('Analysis complete', `Found ${this.threads.length} research threads`, 100);
    return { threads: this.threads, primer: this.primer, messages };
  }

  async resolvePaperId(paper) {
    if (paper.paperId && paper.paperId.length >= 10) return;
    if (this.paperIdCache.has(paper.title)) {
      paper.paperId = this.paperIdCache.get(paper.title);
      return;
    }
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/paper/search/match?query=${encodeURIComponent(paper.title)}&fields=paperId,title,abstract,year,publicationDate,authors,citationCount`,
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

    const systemPrompt = `You are a research exploration agent. Your job is to explore the academic literature based on the User's interest and build research tracks that satisfy the user's research criteria. You have access to the Semantic Scholar API through tools.

SEED PAPER(S):
${seedInfo}

USER'S RESEARCH CRITERIA:
${criteria}

HOW TO WORK:
You maintain two artifacts in parallel — both are equally important:

1. RESEARCH TRACKS: Distinct threads of related work organized by the user's criteria.

2. RESEARCH PRIMER: A living document that captures your growing understanding of the field — its concepts, terminology, and how ideas relate. By the end of a run it should read like a primer on the field for someone coming in cold. This includes:
   - Key concepts and what they mean in this field
   - Terminology map: different words/labels for the same underlying idea across communities or time periods
   - The landscape of ideas as they relate to the user's criteria

Be curious, and develop an understanding of the research relevant to the User's criteria in these artifacts. They are the results that the User will get. Do not conflate the two artifacts (e.g. don't repeat the tracks in the primer).

Before each response, briefly decide:
- what remains uncertain under the user's criteria
- which tool calls will reduce that uncertainty the most

Even though you can edit and mutate the artifacts as you get more clarity, it's best not to start constructing them at all until you've gotten a 'feel' for the topology of the research wrt. what the user wants, in order to avoid prematurely commiting to a certain paradigm. Do some exploration before you decide your framing. Then, as you continue to explore, refactor and reframe your viewpoint and artifacts.

You can make multiple tool calls in a single response — use this when you have independent questions that don't depend on each other's results (e.g. fetching citations of paper A while simultaneously fetching author papers for author B). Batching independent calls is faster and encouraged.

Keep candidate directions provisional until you can explain why a candidate is distinct enough, under the user's criteria, to deserve its own track rather than remaining supporting evidence for another track.

Tool calls that return papers will show you paper IDs and author IDs. You need paper IDs to add papers to tracks or to look up their citations/references. Use author IDs (from paper results) with get_author_papers for precise lookups. Papers must appear in a tool result before you can add them.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Begin exploring and build tracks that satisfy the user\'s research criteria.' }
    ];

    let iterations = 0;
    const maxIterations = 100;
    const minIterations = await this.assessCriteriaComplexity(criteria);
    this.currentIteration = 0;
    this.minIterations = minIterations;

    while (iterations < maxIterations) {
      if (await this.checkStopped()) throw new Error('Analysis stopped by user');
      iterations++;
      this.currentIteration = iterations;

      const totalPapers = this.threads.reduce((sum, t) => sum + t.papers.length, 0);
      this.logger.log(fmt(C.bold + C.bcyan, `\n┌─ Iteration ${iterations} `) + fmt(C.dim, `(${this.threads.length} tracks, ${totalPapers} papers)`));
      this.updateProgress(`Agent exploring...`, `${this.threads.length} tracks, ${totalPapers} papers (iteration ${iterations})`, null);

      let response;
      try {
        response = await this.callLLMWithTools(messages);
      } catch (e) {
        this.logger.error(fmt(C.bred, `[AGENT] LLM call failed: ${e.message}`));
        break;
      }

      messages.push(response.message);

      if (response.message.content) {
        this.logger.log(fmt(C.bwhite, `│ `) + fmt(C.white, response.message.content));
      }

      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (iterations < minIterations) {
          this.logger.log(fmt(C.yellow, `│ (no tool calls at iteration ${iterations}/${minIterations}) — injecting error`));
          messages.push({ role: 'user', content: `You must call a tool. You are on iteration ${iterations} of a minimum ${minIterations}. Keep exploring.` });
          continue;
        }
        this.logger.log(fmt(C.dim, '│ (no tool calls — agent finished)'));
        break;
      }

      let agentDone = false;

      // Reader tools are slow (SS fetch + LLM filter) — launch them all concurrently.
      // Fast tools (track ops, done, search_authors) run sequentially in the result loop below.
      const READER_TOOLS = new Set(['search_papers', 'get_paper_citations', 'get_paper_references', 'get_recommendations', 'get_author_papers']);

      // Parse args and kick off reader tools immediately; defer logging until result loop
      // so each call's start line prints adjacent to its results (not all bunched at the top).
      const pendingCalls = response.toolCalls.map(call => {
        const toolName = call.function.name;
        let toolArgs;
        try {
          toolArgs = JSON.parse(call.function.arguments);
        } catch (e) {
          return { call, toolName, toolArgs: null, parseError: e, promise: null, logStart: null };
        }

        const argSummary = toolArgs.paper_id ? `paper:${toolArgs.paper_id}`
          : toolArgs.query ? `"${toolArgs.query}"`
          : toolArgs.author_id ? `author_id:${toolArgs.author_id}`
          : toolArgs.theme ? `"${toolArgs.theme}"`
          : toolArgs.track_index !== undefined ? `track:${toolArgs.track_index}`
          : '';
        const focusSummary = toolArgs.focus ? fmt(C.dim, `  focus: "${toolArgs.focus}"`) : '';
        const logStart = () => {
          if (toolArgs.rationale) this.logger.log(fmt(C.bold + C.bcyan, `│ [Agent tool call rationale] `) + fmt(C.bcyan, toolArgs.rationale));
          this.logger.log(fmt(C.bgreen, `│ ▶ ${toolName}`) + fmt(C.green, `(${argSummary})`) + focusSummary);
        };

        const promise = READER_TOOLS.has(toolName) ? this.executeTool(toolName, toolArgs) : null;
        return { call, toolName, toolArgs, parseError: null, promise, logStart };
      });

      // Wait for all reader tools to finish concurrently; measure wall-clock time for histogram
      const readerBatchStart = Date.now();
      await Promise.all(pendingCalls.filter(p => p.promise).map(p => p.promise));
      if (pendingCalls.some(p => p.promise)) this.timeStats.readerWallMs += Date.now() - readerBatchStart;

      for (const { call, toolName, toolArgs, parseError, promise, logStart } of pendingCalls) {

        if (parseError) {
          const errMsg = { role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: `Bad arguments: ${parseError.message}` }) };
          if (call.thoughtSignature) errMsg.thoughtSignature = call.thoughtSignature;
          messages.push(errMsg);
          this.logger.warn(fmt(C.yellow, `│ [bad args] ${toolName}: ${parseError.message}`));
          continue;
        }

        const result = promise ? await promise : await this.executeTool(toolName, toolArgs);
        logStart();
        const toolMsg = { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) };
        if (call.thoughtSignature) toolMsg.thoughtSignature = call.thoughtSignature;
        messages.push(toolMsg);

        if (toolName === 'done' && result.done) agentDone = true;

        // Log result
        if (result.error) {
          this.logger.log(fmt(C.bred, `│   ✗ ${result.error}`));
        } else if (result.papers !== undefined) {
          // papers returned by reader — count logged by reader itself
        } else if (result.added) {
          this.logger.log(fmt(C.magenta, `│   + [track ${toolArgs.track_index}] "${result.title}" (${result.year})`) + fmt(C.dim, ` [${result.authors}]${result.citationCount != null ? ' ' + result.citationCount + ' cit.' : ''}`));
        } else if (result.skipped) {
          this.logger.log(fmt(C.dim, `│   ~ skip: ${result.reason} — "${result.title}"`));
        } else if (result.track_created) {
          this.logger.log(fmt(C.bold + C.bmagenta, `│   ★ NEW TRACK [${result.track_index}]: "${result.theme}"`));
        } else if (result.renamed) {
          // logged inside toolRenameTrack
        } else if (result.deleted) {
          // logged inside toolDeleteTrack
        } else if (result.removed) {
          // logged inside toolRemovePapersFromTrack
        } else if (result.appended || result.updated) {
          // logged inside toolAppendToPrimer / toolUpdatePrimer
        } else if (result.done) {
          this.logger.log(fmt(C.bgreen, `│   ✔ Done: ${result.summary}`));
        }
      }

      // Every 5 add_paper_to_track calls, inject the full track state so the agent
      // has a clean structured view of what it's built — prevents it from narrating
      // additions instead of actually calling tools when context grows large.
      const TRACK_SUMMARY_EVERY = 5;
      if (this.addPaperCallCount > 0 && this.addPaperCallCount % TRACK_SUMMARY_EVERY === 0) {
        const summary = this.buildTrackSummary();
        this.logger.log(fmt(C.bold + C.bwhite, `│ [Track state injected at ${this.addPaperCallCount} adds]`));
        messages.push({ role: 'user', content: summary });
      }

      if (agentDone) {
        this.logger.log(fmt(C.bold + C.bgreen, '└─ Agent signaled done.'));
        break;
      }
    }

    this.logger.log(fmt(C.dim, `\n[Agent] Finished after ${iterations} iterations.`));
    return messages;
  }

  async chat(messages) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    console.log('\n' + '─'.repeat(70));
    console.log('  Chat with the agent — ask it about its decisions, gaps, reasoning, and do additional analysis.');
    console.log('  Type "exit" or Ctrl+C to quit.');
    console.log('─'.repeat(70) + '\n');

    rl.on('close', () => process.exit(0));

    while (true) {
      const input = await ask('You: ');
      if (input.trim().toLowerCase() === 'exit' || input.trim().toLowerCase() === 'quit') break;
      if (!input.trim()) continue;

      messages.push({ role: 'user', content: input.trim() });

      try {
        let response = await this.callLLMWithTools(messages);
        messages.push(response.message);

        if (response.message.content) {
          console.log(`\nAgent: ${response.message.content}\n`);
        }

        // Execute any tool calls the agent makes
        while (response.toolCalls && response.toolCalls.length > 0) {
          for (const call of response.toolCalls) {
            const toolName = call.function.name;
            let toolArgs;
            try { toolArgs = JSON.parse(call.function.arguments); } catch (e) {
              const errMsg = { role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: e.message }) };
              if (call.thoughtSignature) errMsg.thoughtSignature = call.thoughtSignature;
              messages.push(errMsg);
              continue;
            }
            if (toolArgs.rationale) console.log(fmt(C.dim, `  [${toolName}] ${toolArgs.rationale}`));
            const result = await this.executeTool(toolName, toolArgs);
            const toolMsg = { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) };
            if (call.thoughtSignature) toolMsg.thoughtSignature = call.thoughtSignature;
            messages.push(toolMsg);
          }
          response = await this.callLLMWithTools(messages);
          messages.push(response.message);
          if (response.message.content) {
            console.log(`\nAgent: ${response.message.content}\n`);
          }
        }
      } catch (e) {
        console.error(`\nError: ${e.message}\n`);
        messages.pop();
      }
    }

    rl.close();
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
          description: 'Search Semantic Scholar for papers matching a query. Results are filtered by a reader model based on your focus instructions. Short keyword phrases (2-4 words) work best. Good for jumping into a new subfield or finding papers with no citation path to anything you have already found. Less effective than get_author_papers for finding all work from a specific person or group. Results are sensitive to exact phrasing — if unsure, try multiple times from a few different angles (different terminology, synonyms, phrasings) rather than relying on a single query.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              query: { type: 'string', description: 'Search query' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              min_year: { type: 'integer', description: 'Minimum publication year' },
              limit: { type: 'integer', description: 'Max results (default 20, max 50)' }
            },
            required: ['rationale', 'query', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_paper_citations',
          description: 'Get papers that cite a given paper (forward citations). Results are filtered by a reader model based on your focus instructions. The forward-in-time probe: good for finding successors, groups that built on a specific idea, and methodological descendants. Use on high-influence papers to discover entire downstream lineages.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              limit: { type: 'integer', description: 'Max results (default 100, max 200)' }
            },
            required: ['rationale', 'paper_id', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_paper_references',
          description: 'Get papers referenced by a given paper (backward references). Results are filtered by a reader model based on your focus instructions. The backward-in-time probe: good for grounding a newly discovered paper in its ancestors, understanding which prior tradition it belongs to, and finding foundational work that the forward citation graph may not surface.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              limit: { type: 'integer', description: 'Max results (default 50, max 100)' }
            },
            required: ['rationale', 'paper_id', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_recommendations',
          description: 'Get papers similar to a given paper via Semantic Scholar recommendations. Results are filtered by a reader model based on your focus instructions. The lateral probe: good for discovering work that is thematically related but shares no citation path — parallel threads that never cited each other. Most useful when citations have gone dry and you want to find adjacent clusters. Results vary by seed paper — if one seed yields little, try recommendations from a different paper in the same area.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              limit: { type: 'integer', description: 'Max results (default 50, max 100)' }
            },
            required: ['rationale', 'paper_id', 'focus']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_authors',
          description: 'Search Semantic Scholar for authors by name. Returns a ranked list of matching authors with their IDs, h-indexes, and paper counts. Use this when you want to explore a researcher\'s work but don\'t yet have their author ID. Call this first, then use get_author_papers with the correct ID.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              query: { type: 'string', description: 'Author name only — do not include affiliation, institution, or any other context. E.g. "Yann LeCun", "Fei-Fei Li", "Geoffrey Hinton" — never "Yann LeCun Meta", "Fei-Fei Li Stanford", "Geoffrey Hinton Google".' }
            },
            required: ['rationale', 'query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_author_papers',
          description: 'Get an author\'s publications by their Semantic Scholar author ID. Results are filtered by a reader model based on your focus instructions. Best for rapidly pulling an entire group\'s output: when you find one strong paper, look up its authors to surface the rest of their work at once. More reliable than searching by lab or institution name. If you don\'t have an author ID, use search_authors first.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              author_id: { type: 'string', description: 'Semantic Scholar author ID' },
              focus: { type: 'string', description: 'What you are looking for in these results. The reader model uses this to filter and highlight relevant papers.' },
              min_year: { type: 'integer', description: 'Minimum publication year' }
            },
            required: ['rationale', 'author_id', 'focus']
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
              rationale: { type: 'string', description: RATIONALE_DESC },
              theme: { type: 'string', description: 'One-sentence description of this research track' }
            },
            required: ['rationale', 'theme']
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
              rationale: { type: 'string', description: RATIONALE_DESC },
              track_index: { type: 'integer', description: 'Track number (0-based index)' },
              paper_id: { type: 'string', description: 'Semantic Scholar paper ID' },
              reason: { type: 'string', description: 'Why this paper belongs in this track' }
            },
            required: ['rationale', 'track_index', 'paper_id', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'view_tracks',
          description: 'View the current state of all tracks and their papers. Use this to orient yourself before reorganizing.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC }
            },
            required: ['rationale']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'rename_track',
          description: 'Rename a track to better reflect its actual contents.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              track_index: { type: 'integer', description: 'Track number (0-based index)' },
              theme: { type: 'string', description: 'New one-sentence description of this research track' }
            },
            required: ['rationale', 'track_index', 'theme']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'delete_track',
          description: 'Delete a track entirely. Papers in it are returned to the pool and can be re-added to other tracks.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              track_index: { type: 'integer', description: 'Track number (0-based index)' }
            },
            required: ['rationale', 'track_index']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'remove_papers_from_track',
          description: 'Remove one or more papers from a track. Removed papers are returned to the pool and can be re-added to other tracks.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              track_index: { type: 'integer', description: 'Track number (0-based index)' },
              paper_ids: { type: 'array', items: { type: 'string' }, description: 'List of Semantic Scholar paper IDs to remove' }
            },
            required: ['rationale', 'track_index', 'paper_ids']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'view_primer',
          description: 'View the current research primer — your accumulated understanding of the field.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC }
            },
            required: ['rationale']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'append_to_primer',
          description: 'Append new content to the research primer. Use this to record new concepts, terminology mappings, methodological insights, or landscape observations as you discover them.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              content: { type: 'string', description: 'Content to append to the primer' }
            },
            required: ['rationale', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_primer',
          description: 'Replace a specific passage in the research primer with new text. Use this to correct or refine existing understanding.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              old_text: { type: 'string', description: 'The exact text to replace' },
              new_text: { type: 'string', description: 'The replacement text' }
            },
            required: ['rationale', 'old_text', 'new_text']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'audit_relevance_to_user_interest',
          description: 'Audit the current tracks and papers against the user\'s stated interest. Use this to take stock of where you are, identify gaps (directions implied by the user\'s criteria that you haven\'t covered yet, or not deeply enough yet), and flag bloat (tracks or papers that have drifted from the user\'s core interest). Call this when you\'re unsure what to explore next — it will help you find specific, high-value directions rather than searching blindly.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              audit: { type: 'string', description: 'Your honest assessment: what you have found, what is missing or under-explored relative to the user\'s criteria, any bloat, and what the highest-value next steps are' }
            },
            required: ['rationale', 'audit']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'done',
          description: 'Signal that exploration is complete only when major uncertainties under the user\'s criteria are resolved and additional tool calls are unlikely to materially change track structure.',
          parameters: {
            type: 'object',
            properties: {
              rationale: { type: 'string', description: RATIONALE_DESC },
              summary: { type: 'string', description: 'Summary of tracks found and exploration done' }
            },
            required: ['rationale', 'summary']
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
        case 'search_authors': return await this.toolSearchAuthors(args);
        case 'get_author_papers': return await this.toolGetAuthorPapers(args);
        case 'create_track': return this.toolCreateTrack(args);
        case 'add_paper_to_track': return this.toolAddPaperToTrack(args);
        case 'view_tracks': return this.toolViewTracks();
        case 'rename_track': return this.toolRenameTrack(args);
        case 'delete_track': return this.toolDeleteTrack(args);
        case 'remove_papers_from_track': return this.toolRemovePapersFromTrack(args);
        case 'view_primer': return this.toolViewPrimer();
        case 'append_to_primer': return this.toolAppendToPrimer(args);
        case 'update_primer': return this.toolUpdatePrimer(args);
        case 'audit_relevance_to_user_interest': return this.toolAuditRelevance(args);
        case 'done': return this.toolDone(args);
        default: return { error: `Unknown tool: ${name}` };
      }
    } catch (e) {
      return { error: e.message };
    }
  }

  async toolSearchPapers({ query, focus, min_year, limit }) {
    const SS_SEARCH_MAX = 50; // always fetch max so the URL is stable across runs → cache hits
    const requested = Math.min(limit || 20, SS_SEARCH_MAX);
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=paperId,title,abstract,year,publicationDate,authors,citationCount&limit=${SS_SEARCH_MAX}`;
    if (min_year) url += `&publicationDateOrYear=${min_year}:`;
    const resp = await this.throttledSemanticScholarCall({ url, method: 'GET' }, `search: ${query}`);
    const papers = (resp.data.data || []).filter(p => p && p.paperId).slice(0, requested);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    return await this.filterWithReader(papers, focus, `search results for "${query}"`);
  }

  async toolGetCitations({ paper_id, focus, limit }) {
    const SS_CITATIONS_MAX = 200; // always fetch max so the URL is stable across runs → cache hits
    const requested = Math.min(limit || 50, SS_CITATIONS_MAX);
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/paper/${paper_id}/citations?fields=paperId,title,abstract,year,publicationDate,authors,citationCount&limit=${SS_CITATIONS_MAX}`,
      method: 'GET'
    }, `citations: ${paper_id.substring(0, 12)}...`);
    const papers = (resp.data.data || []).map(c => c.citingPaper).filter(p => p && p.paperId).slice(0, requested);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    const sourcePaper = this.paperStore.get(paper_id);
    const sourceTitle = sourcePaper?.title || paper_id;
    return await this.filterWithReader(papers, focus, `citations of "${sourceTitle}"`);
  }

  async toolGetReferences({ paper_id, focus, limit }) {
    const SS_REFERENCES_MAX = 100; // always fetch max so the URL is stable across runs → cache hits
    const requested = Math.min(limit || 50, SS_REFERENCES_MAX);
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/paper/${paper_id}/references?fields=paperId,title,abstract,year,publicationDate,authors,citationCount&limit=${SS_REFERENCES_MAX}`,
      method: 'GET'
    }, `references: ${paper_id.substring(0, 12)}...`);
    const papers = (resp.data.data || []).map(r => r.citedPaper).filter(p => p && p.paperId).slice(0, requested);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    const sourcePaper = this.paperStore.get(paper_id);
    const sourceTitle = sourcePaper?.title || paper_id;
    return await this.filterWithReader(papers, focus, `references of "${sourceTitle}"`);
  }

  async toolGetRecommendations({ paper_id, focus, limit }) {
    const SS_RECOMMENDATIONS_MAX = 100; // always fetch max so the URL is stable across runs → cache hits
    const requested = Math.min(limit || 50, SS_RECOMMENDATIONS_MAX);
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/recommendations/v1/papers?fields=paperId,title,abstract,year,publicationDate,authors,citationCount&limit=${SS_RECOMMENDATIONS_MAX}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { positivePaperIds: [paper_id] }
    }, `recommendations: ${paper_id.substring(0, 12)}...`);
    const papers = (resp.data.recommendedPapers || []).filter(p => p && p.paperId).slice(0, requested);
    for (const p of papers) this.paperStore.set(p.paperId, p);
    const sourcePaper = this.paperStore.get(paper_id);
    const sourceTitle = sourcePaper?.title || paper_id;
    return await this.filterWithReader(papers, focus, `recommendations for "${sourceTitle}"`);
  }

  async toolSearchAuthors({ query }) {
    const resp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(query)}&fields=name,paperCount,hIndex&limit=10`,
      method: 'GET'
    }, `author search: ${query}`);
    const authors = (resp.data?.data || []).map(a => ({
      author_id: a.authorId,
      name: a.name,
      hIndex: a.hIndex,
      paperCount: a.paperCount
    }));
    if (authors.length === 0) return { error: `No authors found for "${query}"` };
    this.logger.log(fmt(C.cyan, `  [author search] "${query}" → ${authors.length} results`));
    return { authors };
  }

  async toolGetAuthorPapers({ author_id, focus, min_year }) {
    const infoResp = await this.throttledSemanticScholarCall({
      url: `https://api.semanticscholar.org/graph/v1/author/${author_id}?fields=name,paperCount,hIndex`,
      method: 'GET'
    }, `author info: ${author_id}`);
    if (!infoResp.data) return { error: `Author ID ${author_id} not found. Use search_authors to find the correct ID.` };
    const authorName = infoResp.data.name;
    const authorHIndex = infoResp.data.hIndex;
    const authorPaperCount = infoResp.data.paperCount;

    this.logger.log(fmt(C.cyan, `  [author] ${authorName}`) + fmt(C.dim, `  h-index:${authorHIndex}  papers:${authorPaperCount}  id:${author_id}`));

    let url = `https://api.semanticscholar.org/graph/v1/author/${author_id}/papers?fields=paperId,title,abstract,year,publicationDate,authors,citationCount&limit=50`;
    if (min_year) url += `&publicationDateOrYear=${min_year}:`;
    const papersResp = await this.throttledSemanticScholarCall({ url, method: 'GET' }, `author papers: ${authorName}`);
    const papers = (papersResp.data.data || []).filter(p => p && p.paperId);
    for (const p of papers) this.paperStore.set(p.paperId, p);

    const filtered = await this.filterWithReader(papers, focus, `papers by ${authorName}`);
    return {
      author: { name: authorName, authorId: author_id, hIndex: authorHIndex, paperCount: authorPaperCount },
      ...filtered
    };
  }

  toolCreateTrack({ theme }) {
    const track = {
      id: this.generateThreadId(),
      theme,
      spawnYear: null,
      spawnPaper: null,
      papers: [],
      subThreads: []
    };
    this.threads.push(track);
    this.logger.log(fmt(C.bold + C.bmagenta, `  [track ${this.threads.length - 1}] "${theme}"`));
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

    paper.selectionReason = reason;
    const paperDate = paper.publicationDate || (paper.year ? `${paper.year}-99` : '0000-99');
    const insertIdx = track.papers.findIndex(p => {
      const pDate = p.publicationDate || (p.year ? `${p.year}-99` : '0000-99');
      return pDate > paperDate;
    });
    if (insertIdx === -1) track.papers.push(paper);
    else track.papers.splice(insertIdx, 0, paper);
    this.processedPapers.add(paper_id);
    this.processedPapers.add(paper.title);

    if (!track.spawnPaper) {
      track.spawnPaper = paper;
      track.spawnYear = paper.year;
    }

    const authors = (paper.authors || []).slice(0, 5).map(a => a.name).join(', ');
    this.addPaperCallCount++;
    return {
      added: true,
      track: track.theme,
      title: paper.title,
      year: paper.year,
      authors,
      citationCount: paper.citationCount ?? null,
      trackSize: track.papers.length
    };
  }

  buildTrackSummary() {
    const totalPapers = this.threads.reduce((n, t) => n + t.papers.length, 0);
    const body = this.threads.map((t, i) => {
      const papers = t.papers.map(p => `    - [${p.year}] ${p.title} (id:${p.paperId})`).join('\n');
      return `Track ${i}: ${t.theme}\n${papers || '    (empty)'}`;
    }).join('\n\n');
    return `Current track state (${totalPapers} papers across ${this.threads.length} tracks):\n\n${body}`;
  }

  toolViewTracks() {
    const summary = this.buildTrackSummary();
    this.logger.log(fmt(C.bold + C.bwhite, `│ [view_tracks]\n`) + fmt(C.white, summary));
    return { summary };
  }

  toolRenameTrack({ track_index, theme }) {
    if (track_index < 0 || track_index >= this.threads.length) {
      return { error: `Invalid track index ${track_index}. You have ${this.threads.length} tracks (0-${this.threads.length - 1}).` };
    }
    const oldTheme = this.threads[track_index].theme;
    this.threads[track_index].theme = theme;
    this.logger.log(fmt(C.bold + C.bmagenta, `│   ✎ [track ${track_index}] renamed: "${theme}"`));
    return { renamed: true, track_index, old_theme: oldTheme, new_theme: theme };
  }

  toolDeleteTrack({ track_index }) {
    if (track_index < 0 || track_index >= this.threads.length) {
      return { error: `Invalid track index ${track_index}. You have ${this.threads.length} tracks (0-${this.threads.length - 1}).` };
    }
    const track = this.threads[track_index];
    // Return papers to pool so they can be re-added elsewhere
    for (const p of track.papers) {
      this.processedPapers.delete(p.paperId);
      this.processedPapers.delete(p.title);
    }
    this.threads.splice(track_index, 1);
    this.logger.log(fmt(C.bold + C.bred, `│   ✗ [track ${track_index}] deleted: "${track.theme}" (${track.papers.length} papers returned to pool)`));
    return { deleted: true, theme: track.theme, papers_returned: track.papers.length, remaining_tracks: this.threads.length };
  }

  toolRemovePapersFromTrack({ track_index, paper_ids }) {
    if (track_index < 0 || track_index >= this.threads.length) {
      return { error: `Invalid track index ${track_index}. You have ${this.threads.length} tracks (0-${this.threads.length - 1}).` };
    }
    const track = this.threads[track_index];
    const removed = [];
    const notFound = [];
    for (const pid of paper_ids) {
      const idx = track.papers.findIndex(p => p.paperId === pid);
      if (idx === -1) { notFound.push(pid); continue; }
      const [paper] = track.papers.splice(idx, 1);
      this.processedPapers.delete(paper.paperId);
      this.processedPapers.delete(paper.title);
      removed.push(paper.title);
      this.logger.log(fmt(C.dim, `│   - [track ${track_index}] removed: "${paper.title}"`));
    }
    return { removed, not_found: notFound, track_size: track.papers.length };
  }

  toolViewPrimer() {
    const content = this.primer || '(empty)';
    this.logger.log(fmt(C.bold + C.bwhite, `│ [view_primer]\n`) + fmt(C.white, content));
    return { primer: content };
  }

  toolAppendToPrimer({ content }) {
    this.primer = this.primer ? `${this.primer}\n\n${content}` : content;
    this.logger.log(fmt(C.bold + C.bwhite, `│ [primer +] `) + fmt(C.white, content.split('\n')[0].substring(0, 80)));
    return { appended: true, primer_length: this.primer.length };
  }

  toolUpdatePrimer({ old_text, new_text }) {
    if (!this.primer.includes(old_text)) {
      return { error: 'old_text not found in primer — call view_primer to read the current text before retrying' };
    }
    this.primer = this.primer.replace(old_text, new_text);
    this.logger.log(fmt(C.bold + C.bwhite, `│ [primer ~] `) + fmt(C.white, new_text.split('\n')[0].substring(0, 80)));
    return { updated: true, primer_length: this.primer.length };
  }

  toolAuditRelevance({ audit }) {
    this.logger.log(fmt(C.bold + C.cyan, `  [audit] `) + fmt(C.cyan, audit));
    return { acknowledged: true };
  }

  async assessCriteriaComplexity(criteria) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.openRouterApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'x-ai/grok-4.1-fast',
          messages: [
            { role: 'user', content: `Rate the exploration complexity of this research interest on a scale of 1–5:\n1 = narrow (one topic, one lineage, few papers expected)\n5 = broad (multiple distinct lab lineages, wide temporal scope, many interacting subfields)\n\nRespond with valid JSON only: { "rationale": "...", "number": <1-5> }\n\nResearch interest:\n${criteria}` }
          ],
          max_tokens: 1024,
          reasoning: { enabled: true }
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const raw = (data.choices?.[0]?.message?.content || '').trim();
      const parsed = JSON.parse(raw);
      const complexity = Math.min(5, Math.max(1, parseInt(parsed.number, 10) || 3));
      this.logger.log(fmt(C.dim, `  ${parsed.rationale}`));
      const minIter = { 1: 5, 2: 11, 3: 18, 4: 24, 5: 30 }[complexity];
      this.logger.log(fmt(C.bwhite, `  Complexity: ${complexity}/5 → minIterations: ${minIter}`));
      return minIter;
    } catch (e) {
      this.logger.warn(fmt(C.yellow, `  [complexity assessment failed: ${e.message}] defaulting to 20`));
      return 20;
    }
  }

  toolDone({ summary }) {
    if (this.currentIteration < this.minIterations) {
      const remaining = this.minIterations - this.currentIteration;
      this.logger.log(fmt(C.yellow, `  [done blocked] iteration ${this.currentIteration}/${this.minIterations}`));
      return { error: `Too early to stop. You are on iteration ${this.currentIteration} but must complete at least ${this.minIterations} iterations (${remaining} more to go). Call audit_relevance_to_user_interest first to take stock of what you have, what's missing, and where to go next — then continue exploring.` };
    }
    this.logger.log(fmt(C.bold + C.bgreen, `  [done] ${summary}`));
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

    const primerSection = this.primer ? `\nRESEARCH PRIMER (agent's accumulated understanding of the field — use this to help you judge relevance across terminology differences):\n${this.primer}\n` : '';

    const readerPrompt = `You are a research paper filter. You receive raw results from a Semantic Scholar API call and must select papers that best match the main agent's focus and the user's criteria.

USER'S RESEARCH CRITERIA:
${criteria}

RESEARCH PRIMER:
${primerSection}

CURRENT TRACKS:
${trackContext}

THE MAIN AGENT'S FOCUS FOR THIS CALL:
${focus}

SOURCE: ${source} (${rawPapers.length} papers)

RAW PAPERS:
${JSON.stringify(rawPapers)}

YOUR TASK:
1. Select papers that could match the main agent's focus and the user's criteria ("papers")
2. Select papers that might be relevant but are lower-confidence ("borderline")
3. Only exclude papers that are clearly irrelevant

Err on the side of including papers. The main agent will make the final judgment on what to add to tracks — your job is to remove noise (clearly unrelated fields, name collisions, older low-citation papers, etc.), not to aggressively filter based on the focus.

Respond with valid JSON only — output only the paper id and a brief note, nothing else:
{
  "papers": [
    { "id": "...", "note": "why this matches the focus" }
  ],
  "borderline": [
    { "id": "...", "note": "why this might be relevant but uncertain" }
  ],
  "summary": "What you found, including any coverage gaps"
}`;

    this.logger.log(fmt(C.bold + C.brown, `  [Reader: filtering]`) + fmt(C.dim, ` ${source} — ${rawPapers.length} papers`));

    try {
      const readerResult = await this.callReaderLLM(readerPrompt);
      const parsed = JSON.parse(readerResult);
      const rawById = Object.fromEntries(rawPapers.map(p => [p.id, p]));
      const hydrate = (r) => ({ ...rawById[r.id], ...r });
      const selected = (parsed.papers || []).map(hydrate).filter(p => p.title);
      const borderline = (parsed.borderline || []).map(hydrate).filter(p => p.title);

      if (selected.length > 0) {
        this.logger.log(fmt(C.bold + C.brown, `  [Reader: selected]`) + fmt(C.dim, ` ${selected.length} of ${rawPapers.length}`));
        selected.forEach(p => this.logger.log(fmt(C.brown, `    · "${p.title}" (${p.year})`) + fmt(C.dim, ` [${p.authors || ''}] ${p.citations != null ? p.citations + ' cit. — ' : '— '}${p.note || ''}`)));
      }
      if (borderline.length > 0) {
        this.logger.log(fmt(C.bold + C.brown, `  [Reader: borderline]`) + fmt(C.dim, ` ${borderline.length} of ${rawPapers.length}`));
        borderline.forEach(p => this.logger.log(fmt(C.dim, `    ~ "${p.title}" (${p.year}) [${p.authors || ''}] ${p.citations != null ? p.citations + ' cit. — ' : '— '}${p.note || ''}`)));
      }
      if (selected.length === 0 && borderline.length === 0) {
        this.logger.log(fmt(C.dim, `  [Reader: selected] 0 of ${rawPapers.length}`));
      }
      if (parsed.summary) {
        this.logger.log(fmt(C.bold + C.brown, `  [Reader: summary]`) + fmt(C.dim, ` ${parsed.summary}`));
      }

      return {
        papers: selected,
        borderline,
        summary: parsed.summary || '',
        source,
        total_raw: rawPapers.length
      };
    } catch (e) {
      // If reader fails, return empty rather than flooding the agent with unfiltered results
      this.logger.warn(fmt(C.yellow, `  [Reader: failed]`) + fmt(C.dim, ` ${e.message} — returning empty`));
      return { papers: [], borderline: [], source, total_raw: rawPapers.length };
    }
  }

  async callReaderLLM(prompt) {
    const messages = [{ role: 'user', content: prompt }];
    const start = Date.now();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages,
            max_tokens: this.maxCompletionTokens,
            reasoning: { enabled: true },
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(fmt(C.bred, `[reader] HTTP ${response.status}: ${errText.substring(0,200)}`));
          if (attempt < 2) { await this.sleep(2000); continue; }
          throw new Error(`Reader LLM error: ${response.status}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - start;
        this.timeStats.readerCalls++;
        this.timeStats.readerTimeMs += elapsed;
        this.timeStats.readerTimings.push(elapsed);
        if (data.usage) {
          this.timeStats.readerTokensIn += data.usage.prompt_tokens || 0;
          this.timeStats.readerTokensOut += data.usage.completion_tokens || 0;
          this.timeStats.readerTokensCachedIn += data.usage.prompt_tokens_details?.cached_tokens || 0;
        }

        const choice = data.choices[0];
        const readerSummaries = (choice.message.reasoning_details || [])
          .filter(r => r.type === 'reasoning.summary' && r.summary)
          .map(r => r.summary);
        if (readerSummaries.length > 0) {
          this.logger.log(fmt(C.bold + C.brown, `  [Reader thinking]`) + fmt(C.dim, ` ${readerSummaries.join('\n    │ ')}`));
        }

        const content = choice.message.content;
        try {
          JSON.parse(content); // validate
          return content;
        } catch (jsonErr) {
          const truncated = choice.finish_reason === 'length'
            || (data.usage?.completion_tokens >= this.maxCompletionTokens);
          const reason = truncated
            ? `Reader response truncated (hit token limit) — ${jsonErr.message}`
            : `Reader returned invalid JSON — ${jsonErr.message}`;
          if (attempt < 2) {
            this.logger.warn(fmt(C.yellow, `  [Reader: bad JSON, retrying] ${reason}`));
            messages.push({ role: 'assistant', content });
            messages.push({ role: 'user', content: 'Your response was not valid JSON. Please respond with valid JSON only, matching the schema requested.' });
            continue;
          }
          throw new Error(reason);
        }
      } catch (e) {
        if (attempt < 2) {
          this.logger.error(fmt(C.bred, `[reader] Attempt ${attempt + 1} failed: ${e.message}`));
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
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages,
            tools: this.getToolDefinitions(),
            max_tokens: this.maxCompletionTokens,
            reasoning: { enabled: true }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(fmt(C.bred, `[LLM] HTTP ${response.status}: ${errText.substring(0,200)}`));
          if (attempt < 2) {
            const delay = response.status >= 500 ? 15000 : 3000;
            await this.sleep(delay);
            continue;
          }
          throw new Error(`LLM API error: ${response.status}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - start;
        this.timeStats.agentCalls++;
        this.timeStats.agentTimeMs += elapsed;
        this.timeStats.agentTimings.push(elapsed);
        if (data.usage) {
          this.timeStats.agentTokensIn += data.usage.prompt_tokens || 0;
          this.timeStats.agentTokensOut += data.usage.completion_tokens || 0;
          this.timeStats.agentTokensCachedIn += data.usage.prompt_tokens_details?.cached_tokens || 0;
        }

        const choice = data.choices[0];
        // Log reasoning summaries (encrypted blocks are intentionally opaque)
        const reasoningSummaries = (choice.message.reasoning_details || [])
          .filter(r => r.type === 'reasoning.summary' && r.summary)
          .map(r => r.summary);
        if (reasoningSummaries.length > 0) {
          this.logger.log(fmt(C.bold + C.bcyan, `│ 💭 [Agent reasoning]`) + fmt(C.dim, ` ${reasoningSummaries.join('\n│   ')}`));
        }
        return {
          message: choice.message,
          toolCalls: choice.message.tool_calls || [],
          finishReason: choice.finish_reason
        };
      } catch (e) {
        if (attempt < 2) {
          this.logger.error(fmt(C.bred, `[LLM] Attempt ${attempt + 1} failed: ${e.message}`));
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
      if (pruned > 0) this.logger.log(fmt(C.dim, `[cache] Pruned ${pruned} stale entries`));
    } catch (e) {
      this.logger.warn(fmt(C.yellow, `Cache prune failed: ${e.message}`));
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
      this.logger.warn(fmt(C.yellow, `Cache write failed: ${e.message}`));
    }
  }

  async throttledSemanticScholarCall(data, context = '') {
    const cacheKey = this.ssCacheKey(data);
    const cached = this.ssCacheGet(cacheKey);
    if (cached) {
      this.timeStats.ssCacheHits++;
      this.logger.log(fmt(C.dim, `  [cache hit ] ${context}`));
      return { success: true, data: cached };
    }
    this.logger.log(fmt(C.dim, `  [cache miss] ${context}`));

    const callStart = Date.now();
    const wait = Math.max(0, this.semanticScholarDelay - (Date.now() - this.lastSemanticScholarCall));
    if (wait > 0) await this.sleep(wait);

    for (let attempt = 1; attempt <= 8; attempt++) {
      this.lastSemanticScholarCall = Date.now();
      const headers = { ...(data.headers || {}) };
      if (this.semanticScholarApiKey) headers['x-api-key'] = this.semanticScholarApiKey;
      const response = await fetch(data.url, {
        method: data.method || 'GET',
        headers,
        body: data.body ? JSON.stringify(data.body) : undefined
      });

      if (response.ok) {
        const ssElapsed = Date.now() - callStart;
        this.timeStats.ssCalls++;
        this.timeStats.ssTimeMs += ssElapsed;
        this.timeStats.ssTimings.push(ssElapsed);
        const responseData = await response.json();
        this.ssCacheSet(cacheKey, responseData);
        return { success: true, data: responseData };
      }

      if (response.status === 429) {
        this.timeStats.ssRetries++;
        const delay = 5000 * Math.pow(2, attempt - 1);
        this.logger.warn(fmt(C.yellow, `  [SS] 429 — retry ${attempt} in ${delay/1000}s`));
        await this.sleep(delay);
      } else if (response.status === 404) {
        this.logger.warn(fmt(C.yellow, `  [SS] 404 — resource not found, skipping`));
        return { success: false, data: null, status: 404 };
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
