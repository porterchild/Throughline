// Core ThroughlineAnalyzer - works in both browser extension and standalone environments

class ThroughlineAnalyzer {
  constructor(apiConfig = {}) {
    this.threads = [];
    this.processedPapers = new Set();
    this.paperIdCache = new Map();
    this.maxThreads = apiConfig.maxThreads || 10;
    this.maxPapersPerThread = apiConfig.maxPapersPerThread || 20;
    this.progressCallback = null;
    this.debugTree = [];
    this.expansionStack = [];
    this.stopped = false;
    this.seedPapers = [];
    this.rateLimitDelay = 0;
    
    // Clustering criteria from user (optional)
    this.clusteringCriteria = apiConfig.clusteringCriteria || null;
    
    // Global candidate pool for cross-thread discovery
    this.candidatePool = new Map();
    
    // API configuration
    this.openRouterApiKey = apiConfig.openRouterApiKey || null;
    this.semanticScholarDelay = apiConfig.semanticScholarDelay || 5000;
    this.lastSemanticScholarCall = 0;
    
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

  async analyze(seedPapers) {
    this.stopped = false;
    this.debugTree = [];
    this.threads = [];
    this.processedPapers = new Set();
    this.expansionStack = [];
    this.candidatePool = new Map();
    this.seedPapers = seedPapers;
    
    this.updateProgress('Starting analysis...', 'Extracting research themes from seed papers', 0);

    // Add seed papers to processed set to avoid duplicates
    for (const seed of seedPapers) {
      if (seed.paperId) this.processedPapers.add(seed.paperId);
      if (seed.title) this.processedPapers.add(seed.title);
      if (seed.paperId) this.paperIdCache.set(seed.title, seed.paperId);
    }

    for (const seedPaper of seedPapers) {
      this.updateProgress(`Analyzing: ${seedPaper.title.substring(0, 40)}...`, 'Extracting research themes with LLM', null);
      
      // Extract main research threads from seed
      const themesPrompt = `Identify 2-4 primary research directions or architectural lineages that originated from or were significantly influenced by this paper.
 
 SEED PAPER: ${seedPaper.title}
 ABSTRACT: ${seedPaper.abstract || 'N/A'}
 
 ${this.getClusteringCriteriaPrompt()}
 
 Focus on:
 1. Lab/Author lineage (continuations by the same research group)
 2. Major methodological shifts (e.g. from classical to neural, or modular to end-to-end)
 3. High-impact parallel paradigms
 
 Return ONLY a JSON array of 2-4 strings, each a concise description of a research thread (1 sentence).`;

      const themesResponse = await this.callLLM(themesPrompt);
      const cleanedThemesResponse = themesResponse.replace(/```json\n?|\n?```/g, '').trim();
      const arrayMatch = cleanedThemesResponse.match(/\[[\s\S]*\]/);
      const themes = JSON.parse(arrayMatch ? arrayMatch[0] : cleanedThemesResponse);

      for (const theme of themes) {
        const thread = {
          id: this.generateThreadId(),
          theme: theme,
          spawnYear: seedPaper.year,
          spawnPaper: {
            title: seedPaper.title,
            authors: seedPaper.authors,
            year: seedPaper.year
          },
          papers: [seedPaper],
          subThreads: []
        };
        
        this.threads.push(thread);
        await this.expandThreadToPresent(thread, seedPaper.year);
      }
    }
    
    // Final analysis of candidate pool to find papers that didn't fit into initial seeds
    await this.discoverNewThreadsFromPool();
    
    this.updateProgress('Analysis complete', `Found ${this.threads.length} research threads`, 100);
    return this.threads;
  }

  async getDiverseSearchQueries(seedPaper) {
    const queryPrompt = `Based on this seed paper and the user's research interests, generate 10-12 diverse search queries to find alternate research approaches, parallel lineages, and spiritual successors in the same domain.
 
 SEED PAPER: ${seedPaper.title}
 ABSTRACT: ${seedPaper.abstract || 'N/A'}
 
 ${this.getClusteringCriteriaPrompt()}
 
 IMPORTANT: Generate queries that are DOMAIN-AGNOSTIC but focus on the research evolution. 
 Use simple 2-3 word keyword phrases. Semantic Scholar search works best with few terms. Avoid all boolean operators.
 
 Generate queries that target:
 1. Successor architectures or methodologies (e.g. "transformer", "diffusion", "latent")
 2. Large-scale or "foundation" versions of the approach
 3. Specific high-impact system names or benchmarks likely used by successors
 4. Different paradigms for the same problem (e.g. "end-to-end", "self-supervised")
 5. Leading labs or authors known for work in this specific niche
 
 Return ONLY a JSON array of 12 simple strings: ["query 1", "query 2", ...]`;

    const queryResponse = await this.callLLM(queryPrompt);
    const cleanedQueryResponse = queryResponse.replace(/```json\n?|\n?```/g, '').trim();
    const arrayMatch = cleanedQueryResponse.match(/\[[\s\S]*\]/);
    return JSON.parse(arrayMatch ? arrayMatch[0] : cleanedQueryResponse);
  }

  async fetchCitationsAndRecommendations(seedPaper, minYear, isInitialSearch = false) {
    this.updateProgress(
      `Searching Semantic Scholar...`,
      `Finding papers from ${minYear}+ using citations + embeddings`,
      null
    );

    let paperId = seedPaper.paperId;
    
    if (!paperId || paperId.length < 10) {
      if (this.paperIdCache.has(seedPaper.title)) {
        paperId = this.paperIdCache.get(seedPaper.title);
      } else {
        const searchResponse = await this.throttledSemanticScholarCall({
          url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(seedPaper.title)}&fields=paperId&limit=1`,
          method: 'GET'
        }, `paper search: ${seedPaper.title.substring(0, 30)}...`);
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          paperId = searchResponse.data.data[0].paperId;
          this.paperIdCache.set(seedPaper.title, paperId);
        } else {
          throw new Error(`Could not find paper in Semantic Scholar: "${seedPaper.title}"`);
        }
      }
    }

    const allCitingPapers = [];
    let batchIndex = 0;
    
    while (true) {
      if (await this.checkStopped()) throw new Error('Analysis stopped by user');
      
      const offset = batchIndex * 100;
      try {
        const citationsResponse = await this.throttledSemanticScholarCall({
          url: `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?fields=paperId,title,abstract,year,authors,citationCount&limit=100&offset=${offset}`,
          method: 'GET'
        }, `citations batch ${batchIndex + 1}`);
        
        const batch = (citationsResponse.data.data || []).map(c => c.citingPaper).filter(p => p);
        allCitingPapers.push(...batch);
        if (batch.length < 100) break;
        batchIndex++;
      } catch (error) {
        if (allCitingPapers.length > 0) break;
        throw error;
      }
    }

    let recommendedPapers = [];
    try {
      const recsResponse = await this.throttledSemanticScholarCall({
        url: 'https://api.semanticscholar.org/recommendations/v1/papers?fields=paperId,title,abstract,year,authors,citationCount&limit=100',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { positivePaperIds: [paperId] }
      }, 'recommendations');
      recommendedPapers = recsResponse.data.recommendedPapers || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch recommendations: ${error.message}`);
    }
    
    let broaderPapers = [];
    if (isInitialSearch) {
      try {
        const searchQueries = await this.getDiverseSearchQueries(seedPaper);
        for (const query of searchQueries) {
          if (await this.checkStopped()) throw new Error('Analysis stopped by user');
          try {
            const searchResponse = await this.throttledSemanticScholarCall({
              url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=paperId,title,abstract,year,authors,citationCount&limit=50&publicationDateOrYear=2020:`,
              method: 'GET'
            }, `broader search: ${query.substring(0, 20)}...`);
            broaderPapers.push(...(searchResponse.data.data || []));
          } catch (searchError) {
            this.logger.warn(`Search failed for "${query}": ${searchError.message}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Broader search error: ${error.message}`);
      }
    }
    
    // Candidate pool management
    [...allCitingPapers, ...recommendedPapers, ...broaderPapers].forEach(p => {
      this.addToCandidatePool(p, 'search');
    });
    
    const paperMap = new Map();
    [...allCitingPapers, ...recommendedPapers, ...broaderPapers].forEach(p => {
      if (p.paperId) paperMap.set(p.paperId, p);
    });
    
    const allPapers = Array.from(paperMap.values());
    const currentYear = new Date().getFullYear();
    
    const qualityFiltered = allPapers.filter(p => {
      const age = currentYear - (p.year || currentYear);
      if (age <= 2) return true;
      return (p.citationCount || 0) >= 5;
    });
    
    const actualMinYear = Math.max(minYear - 2, (seedPaper.year || currentYear) - 1);
    
    return qualityFiltered
      .filter(p => p.year >= actualMinYear && p.year <= currentYear)
      .sort((a, b) => {
        const aAge = currentYear - (a.year || currentYear);
        const bAge = currentYear - (b.year || currentYear);
        const aRecencyBonus = aAge <= 1 ? 200 : (aAge <= 2 ? 100 : 0);
        const bRecencyBonus = bAge <= 1 ? 200 : (bAge <= 2 ? 100 : 0);
        return ((b.citationCount || 0) + bRecencyBonus) - ((a.citationCount || 0) + aRecencyBonus);
      })
      .slice(0, 50);
  }

  async rankByThreadRelevance(papers, threadTheme, lastPaper) {
    if (papers.length === 0) return [];
    
    const paperList = papers.map((p, i) => `${i + 1}. "${p.title}" (${p.year}) - ${(p.authors || []).slice(0, 3).map(a => a.name).join(', ')} (Citations: ${p.citationCount})`).join('\n');
    
    const clusteringCriteria = this.getClusteringCriteriaPrompt();
    const prompt = `Rank these papers by how strongly they continue the research LINEAGE (approach, philosophy, and lab heritage): "${threadTheme}"
 
 This is about finding the "next steps" in the research story—papers that build on the same fundamental ideas or come from the same research groups.
 
 ${clusteringCriteria}
 
 Seed paper authors: ${this.seedPapers.map(s => (s.authors || []).map(a => a.name).join(', ')).join(' | ')}
 
 CRITERIA:
 1. **SAME AUTHORS/LAB** - Strongest signal of lineage.
 2. **METHODOLOGICAL DESCENDANTS** - Papers that evolve or scale the approach.
 3. **SHARED PHILOSOPHY** - Papers using the same core paradigm (e.g. modular vs end-to-end).
 4. **DOMAIN RELEVANCE** - Priority given to papers in the SAME research domain as the seeds.
 
 Papers:
 ${paperList}
 
 Return ONLY a JSON array of indices ranked by lineage strength: [1, 5, 3, ...]`;

    const response = await this.callLLM(prompt);
    try {
      let cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      const indices = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
      return indices.map(i => papers[i - 1]).filter(p => p);
    } catch (e) {
      return papers.slice(0, 20);
    }
  }

  async expandThreadToPresent(thread, startYear) {
    if (await this.checkStopped()) throw new Error('Analysis stopped by user');
    this.expansionStack.push(thread);
    
    try {
      let currentYear = startYear;
      const currentYearActual = new Date().getFullYear();
      let iterationCount = 0;
      
      while (currentYear <= currentYearActual && thread.papers.length < this.maxPapersPerThread) {
        iterationCount++;
        const lastPaper = thread.papers[thread.papers.length - 1];
        const related = await this.fetchCitationsAndRecommendations(lastPaper, currentYear, iterationCount === 1);
        
        if (related.length === 0) {
          currentYear++;
          continue;
        }

        const ranked = await this.rankByThreadRelevance(related, thread.theme, lastPaper);
        const selected = await this.selectSuccessors(ranked, thread);
        
        let addedCount = 0;
        const yearCounts = {};
        thread.papers.forEach(p => yearCounts[p.year] = (yearCounts[p.year] || 0) + 1);

        for (const paper of selected) {
          const pid = paper.paperId || paper.title;
          if (this.processedPapers.has(pid)) continue;
          if ((yearCounts[paper.year] || 0) >= 3) continue;

          thread.papers.push(paper);
          this.processedPapers.add(pid);
          this.processedPapers.add(paper.title);
          addedCount++;
          currentYear = paper.year;
          
          await this.detectResearchDivergences(thread, paper);
        }

        if (addedCount === 0) currentYear++;
      }
    } finally {
      this.expansionStack.pop();
    }
  }

  async selectSuccessors(rankedPapers, thread) {
    const candidates = rankedPapers.slice(0, 15);
    const candidatesList = candidates.map((p, i) => `${i + 1}. "${p.title}" (${p.year}) - ${(p.authors || []).slice(0, 3).map(a => a.name).join(', ')}: ${p.abstract.substring(0, 300)}...`).join('\n\n');
    
    const prompt = `You are curating papers for a research LINEAGE: "${thread.theme}"
 
 ${this.getClusteringCriteriaPrompt()}
 
 PAPERS ALREADY IN THIS LINEAGE:
 ${thread.papers.slice(-3).map(p => `- ${p.title} (${p.year})`).join('\n')}
 
 CANDIDATE PAPERS:
 ${candidatesList}
 
 ADD a paper if it's a CLEAR INTELLECTUAL DESCENDANT (same authors, refined method, or same philosophy).
 
 Return JSON array with decisions:
 [ {"index": 1, "decision": "ADD", "reason": "..."}, ... ]`;

    const response = await this.callLLM(prompt);
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      const decisions = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
      return decisions.filter(d => d.decision === 'ADD').map(d => ({
        ...candidates[d.index - 1],
        selectionReason: d.reason
      })).filter(p => p.title);
    } catch (e) {
      return rankedPapers.slice(0, 2);
    }
  }

  async detectResearchDivergences(parentThread, paper) {
    if (this.threads.length >= this.maxThreads) return;
    if ((paper.citationCount || 0) < 10 && paper.year < new Date().getFullYear()) return;

    const prompt = `Does the following paper represent a significant research DIVERGENCE or a new parallel paradigm in this domain?
 
 PAPER: ${paper.title}
 ABSTRACT: ${paper.abstract}
 
 CURRENT THREAD: ${parentThread.theme}
 
 If this paper starts a NEW research story (e.g. from mapping to foundation models), describe the new thread.
 
 Return JSON: { "isDivergence": true/false, "newTheme": "description" }`;

    const response = await this.callLLM(prompt);
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const result = JSON.parse(match ? match[0] : cleaned);
      
      if (result.isDivergence && result.newTheme) {
        const thread = {
          id: this.generateThreadId(),
          theme: result.newTheme,
          spawnYear: paper.year,
          spawnPaper: paper,
          papers: [paper],
          subThreads: []
        };
        this.threads.push(thread);
        await this.expandThreadToPresent(thread, paper.year);
      }
    } catch (e) {}
  }

  async discoverNewThreadsFromPool() {
    if (this.candidatePool.size < 10) return;
    const candidates = Array.from(this.candidatePool.values())
      .map(d => d.paper)
      .filter(p => !this.processedPapers.has(p.paperId) && !this.processedPapers.has(p.title))
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
      .slice(0, 50);

    const prompt = `Analyze these highly-cited papers and identify 1-2 research threads that represent major parallel paradigms NOT covered by existing threads.
 
 EXISTING THREADS:
 ${this.threads.map(t => `- ${t.theme}`).join('\n')}
 
 CANDIDATES:
 ${candidates.map((p, i) => `${i+1}. ${p.title} (${p.year})`).join('\n')}
 
 Return JSON array of 0-2 thread objects: [{ "theme": "...", "paperIndices": [1, 5] }]`;

    try {
      const response = await this.callLLM(prompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      const suggestions = JSON.parse(match ? match[0] : cleaned);
      
      for (const s of suggestions) {
        const papers = s.paperIndices.map(i => candidates[i-1]).filter(p => p);
        if (papers.length < 2) continue;
        const thread = {
          id: this.generateThreadId(),
          theme: s.theme,
          spawnYear: papers[0].year,
          spawnPaper: papers[0],
          papers: papers,
          subThreads: []
        };
        this.threads.push(thread);
        papers.forEach(p => {
          this.processedPapers.add(p.paperId);
          this.processedPapers.add(p.title);
        });
        await this.expandThreadToPresent(thread, thread.spawnYear);
      }
    } catch (e) {}
  }

  async callLLM(prompt) {
    if (await this.checkStopped()) throw new Error('Stopped');
    for (let i = 0; i < 3; i++) {
      const response = await this.callOpenRouter({ messages: [{ role: 'user', content: prompt }] });
      if (response && response.success) return response.data.choices[0].message.content;
      await this.sleep(3000);
    }
    throw new Error('LLM failed');
  }

  async callOpenRouter(data) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.openRouterApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'x-ai/grok-4.1-fast', messages: data.messages, temperature: 0.3 })
      });
      if (!response.ok) return { success: false, error: await response.text() };
      return { success: true, data: await response.json() };
    } catch (e) { return { success: false, error: e.message }; }
  }

  async throttledSemanticScholarCall(data, context = '') {
    const now = Date.now();
    const wait = Math.max(0, this.semanticScholarDelay - (now - this.lastSemanticScholarCall));
    if (wait > 0) await this.sleep(wait);
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      this.lastSemanticScholarCall = Date.now();
      const response = await fetch(data.url, { 
        method: data.method || 'GET', 
        headers: data.headers || {}, 
        body: data.body ? JSON.stringify(data.body) : undefined 
      });
      
      if (response.ok) return { success: true, data: await response.json() };
      
      if (response.status === 429) {
        const delay = 5000 * Math.pow(2, attempt - 1);
        this.logger.warn(`429 Rate Limit. Retry ${attempt} in ${delay/1000}s...`);
        await this.sleep(delay);
      } else {
        throw new Error(`SS API Error: ${response.status}`);
      }
    }
    throw new Error('SS API Rate Limit Exhausted');
  }

  addToCandidatePool(paper, source) {
    const pid = paper.paperId || paper.title;
    if (!this.candidatePool.has(pid)) this.candidatePool.set(pid, { paper, source });
  }

  updateProgress(message, detail, percent, threads) {
    if (this.progressCallback) this.progressCallback(message, detail, percent, threads || this.threads);
  }

  sleep(ms) { return new Promise(r => setTimeout(resolve => r(), ms)); }
  generateThreadId() { return 't_' + Math.random().toString(36).substr(2, 9); }
  getDebugTree() { return this.debugTree; }
  async checkStopped() { return this.stopped; }
  getClusteringCriteriaPrompt() {
    if (this.clusteringCriteria) return `CLUSTERING CRITERIA: ${this.clusteringCriteria}`;
    return `CLUSTERING CRITERIA: Group by lab/author lineage and philosophical approach.`;
  }
}

if (typeof module !== 'undefined') module.exports = { ThroughlineAnalyzer };
if (typeof window !== 'undefined') window.ThroughlineAnalyzer = ThroughlineAnalyzer;
