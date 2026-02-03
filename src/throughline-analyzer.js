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
    this.semanticScholarDelay = apiConfig.semanticScholarDelay || 1000;
    this.lastSemanticScholarCall = 0;
    
    // Logger - can be overridden
    this.logger = apiConfig.logger || {
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args),
      warn: (...args) => console.warn(...args)
    };
  }
  
  async checkStopped() {
    return this.stopped;
  }
  
  getClusteringCriteriaPrompt() {
    if (this.clusteringCriteria && this.clusteringCriteria.trim()) {
      return `USER-SPECIFIED CLUSTERING CRITERIA:\n${this.clusteringCriteria}\n\nUse the user's criteria as the PRIMARY way to define and separate research tracks.`;
    }
    return `DEFAULT CLUSTERING CRITERIA:\nGroup by lab/author lineage and shared architectural philosophy. Prefer direct technical descendants over topical neighbors.`;
  }
  
  stop() {
    this.stopped = true;
    this.logger.log('Analysis stopped by user');
  }
  
  addDebugNode(type, message, data = {}) {
    this.debugTree.push({
      type,
      message,
      data
    });
  }

  async traceResearchLineages(seedPapers, progressCallback) {
    this.progressCallback = progressCallback;
    this.threads = [];
    this.processedPapers = new Set();
    this.expansionStack = [];
    this.stopped = false;
    this.seedPapers = seedPapers;
    
    const totalSteps = seedPapers.length * 3;
    let currentStep = 0;

    this.updateProgress('Starting analysis...', 'Extracting research themes from seed papers', 0);

    for (const seedPaper of seedPapers) {
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }
      
      currentStep++;
      await this.extractThreadsFromSeed(seedPaper);
      this.updateProgress(
        `Processing seed ${currentStep}/${seedPapers.length}`,
        `Found ${this.threads.length} threads so far`,
        (currentStep / totalSteps) * 100
      );
    }

    this.threads.sort((a, b) => a.spawnYear - b.spawnYear);
    
    // Post-processing: cluster remaining papers into new threads
    if (this.candidatePool.size > 0) {
      this.updateProgress('Post-processing...', `Clustering ${this.candidatePool.size} papers into additional threads`, null);
      await this.clusterRemainingPapers();
    }

    this.updateProgress('Complete!', `Discovered ${this.threads.length} research threads`, 100);

    return this.threads;
  }

  async extractThreadsFromSeed(seedPaper) {
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.updateProgress(
      `Analyzing: ${seedPaper.title.substring(0, 60)}...`,
      'Extracting research themes with LLM',
      null
    );

    const themes = await this.identifyResearchThemes(seedPaper);
    
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }

    for (const theme of themes) {
      const thread = {
        id: this.generateThreadId(),
        theme: theme.description,
        spawnYear: seedPaper.year || new Date().getFullYear(),
        spawnPaper: {
          title: seedPaper.title,
          authors: seedPaper.authors || [{ name: seedPaper.nickname }],
          year: seedPaper.year || new Date().getFullYear()
        },
        papers: [{
          ...seedPaper,
          selectionReason: 'Seed paper - starting point for this research thread'
        }],
        subThreads: []
      };

      await this.expandThreadToPresent(thread, thread.spawnYear);
      
      this.logger.log('Thread after expansion:', thread.theme, '- papers:', thread.papers.length, 'subthreads:', thread.subThreads.length);
      
      if (thread.papers.length > 1 || thread.subThreads.length > 0) {
        this.logger.log('Adding thread to results');
        this.threads.push(thread);
      } else {
        this.logger.log('Skipping thread (only 1 paper, no subthreads)');
      }

      if (this.threads.length >= this.maxThreads) break;
    }
  }

  async expandThreadToPresent(thread, startYear) {
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.expansionStack.push(thread);
    const stackDepth = this.expansionStack.length;
    const indent = '  '.repeat(stackDepth - 1);
    
    try {
      this.updateProgress(
        `Expanding: ${thread.theme.substring(0, 50)}...`,
        `Searching papers from ${startYear} → present`,
        null
      );

      let currentYear = startYear;
      const currentYearActual = new Date().getFullYear();
      
      this.logger.log('expandThreadToPresent - starting from year:', currentYear, 'to', currentYearActual);
      this.logger.log('Expansion stack depth:', stackDepth);
      
      this.addDebugNode('expand_begin', `BEGIN EXPAND THREAD (depth ${stackDepth}): ${thread.theme.substring(0, 80)}...`, {
        stackDepth,
        spawnYear: thread.spawnYear,
        spawnPaper: thread.spawnPaper.title,
        startingPapers: thread.papers.map(p => p.title)
      });

      let iterationCount = 0;
      let lastSearchedPaperId = null;
      
      while (currentYear < currentYearActual && thread.papers.length < this.maxPapersPerThread) {
        iterationCount++;
        
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        const lastPaper = thread.papers[thread.papers.length - 1];
        const lastPaperId = lastPaper.paperId || lastPaper.title;
        
        if (lastPaperId === lastSearchedPaperId) {
          this.addDebugNode('loop_end', `── THREAD EXHAUSTED: Already searched from "${lastPaper.title.substring(0, 40)}..." with no results ──`, {
            stackDepth,
            reason: 'No new papers were added, and we would be searching from the same paper again'
          });
          break;
        }
        lastSearchedPaperId = lastPaperId;
        
        this.addDebugNode('loop_begin', `── ITERATION ${iterationCount}: Expand thread from year ${currentYear} ──`, {
          stackDepth,
          currentYear,
          threadPaperCount: thread.papers.length,
          lastPaperInThread: lastPaper.title,
          explanation: `Search for successors to "${lastPaper.title.substring(0, 40)}..." (${currentYear}+), rank by lineage relevance, add true successors.`
        });
        
        const relatedPapers = await this.fetchCitationsAndRecommendations(lastPaper, currentYear);
        
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        this.logger.log('expandThreadToPresent - got', relatedPapers.length, 'related papers');

        if (relatedPapers.length === 0) {
          this.addDebugNode('loop_end', `── END ITERATION ${iterationCount} (no papers found, trying next year) ──`, {
            stackDepth,
            nextYear: currentYear + 1
          });
          currentYear++;
          if (currentYear >= currentYearActual) break;
          continue;
        }

        const rankedPapers = await this.rankByThreadRelevance(relatedPapers, thread.theme, lastPaper);
        
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        this.logger.log('expandThreadToPresent - ranked papers:', rankedPapers.length);

        this.updateProgress(
          `Ranking ${relatedPapers.length} papers...`,
          'Using LLM to rank relevance to thread',
          null
        );

        const selectedPapers = await this.selectRelevantPapers(rankedPapers, thread, 5);
        
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }

        let papersAddedThisIteration = 0;
        
        if (selectedPapers.length === 0) {
          this.addDebugNode('select_begin', `LLM selected 0 papers from ${rankedPapers.length} candidates - none deemed relevant`, {
            stackDepth,
            topCandidates: rankedPapers.slice(0, 5).map((p, i) => `#${i+1}: ${p.title.substring(0, 50)}...`)
          });
        } else {
          this.addDebugNode('select_begin', `Will add ${selectedPapers.length} papers (LLM-selected from ${rankedPapers.length} candidates)`, {
            stackDepth,
            selectedPapers: selectedPapers.map((p, i) => `${p.title.substring(0, 50)}...`)
          });
        }
        
        for (let i = 0; i < selectedPapers.length; i++) {
          const paper = selectedPapers[i];
          const paperId = paper.paperId || paper.title;
          if (this.processedPapers.has(paperId)) {
            this.logger.log('Skipping already processed paper:', paper.title);
            this.addDebugNode('skip', `SKIP: "${paper.title}" (already in another thread)`, {
              year: paper.year,
              reason: 'duplicate',
              stackDepth
            });
            continue;
          }

          this.logger.log('Adding paper to thread:', paper.title, paper.year);
          
          thread.papers.push(paper);
          this.processedPapers.add(paperId);
          currentYear = paper.year;
          papersAddedThisIteration++;
          
          const allThreadsInfo = {
            expansionStack: this.expansionStack.map(t => ({
              theme: t.theme,
              papers: t.papers.map(p => p.title),
              subThreads: t.subThreads.length
            })),
            completedThreads: this.threads.map(t => ({
              theme: t.theme,
              papers: t.papers.map(p => p.title),
              subThreads: t.subThreads.length
            }))
          };
          
          this.logger.log('=== THREAD STATE ===');
          this.logger.log('Expansion stack (depth ' + stackDepth + '):');
          this.expansionStack.forEach((t, idx) => {
            const ind = '  '.repeat(idx);
            this.logger.log(ind + `[${idx}] ${t.theme.substring(0, 60)}... (${t.papers.length} papers)`);
          });
          this.logger.log('Completed threads:', this.threads.length);
          
          this.addDebugNode('select', `ADD: "${paper.title}"`, {
            year: paper.year,
            authors: (paper.authors || []).slice(0, 5).map(a => a.name).join(', '),
            citations: paper.citationCount,
            whySelected: paper.selectionReason || 'Selected by LLM',
            threadTheme: thread.theme.substring(0, 80),
            threadNowHas: thread.papers.map(p => p.title),
            stackDepth,
            allThreads: allThreadsInfo
          });

          if (this.threads.length < this.maxThreads) {
            await this.detectResearchDivergences(thread, paper);
            
            if (await this.checkStopped()) {
              throw new Error('Analysis stopped by user');
            }
          }
        }
        
        const newLastPaper = thread.papers[thread.papers.length - 1];
        this.addDebugNode('loop_end', `── END ITERATION ${iterationCount} ──`, {
          stackDepth,
          papersAdded: papersAddedThisIteration,
          threadNowHas: thread.papers.length,
          nextSearchWillUse: newLastPaper.title,
          explanation: papersAddedThisIteration > 0 
            ? `Added ${papersAddedThisIteration} papers. Next iteration will search from "${newLastPaper.title}"`
            : `No new papers added. Moving to year ${currentYear + 1}`
        });
        
        if (papersAddedThisIteration === 0) {
          currentYear++;
        }
      }
      
      this.logger.log('expandThreadToPresent complete - thread now has', thread.papers.length, 'papers');
      
      this.addDebugNode('expand_end', `END EXPAND THREAD (depth ${stackDepth}): ${thread.papers.length} papers total`, {
        stackDepth,
        finalPapers: thread.papers.map(p => p.title),
        theme: thread.theme.substring(0, 80)
      });
    } finally {
      this.expansionStack.pop();
    }
  }

  async detectResearchDivergences(parentThread, paper) {
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    const stackDepth = this.expansionStack.length;
    
    this.addDebugNode('themes_extract', `Extracting themes from "${paper.title.substring(0, 50)}..." to check for sub-threads`, {
      stackDepth,
      paper: paper.title,
      parentTheme: parentThread.theme.substring(0, 80)
    });
    
    this.updateProgress(
      `Checking for new themes...`,
      `Analyzing: ${paper.title.substring(0, 50)}...`,
      null
    );
    
    const themes = await this.identifyResearchThemes(paper);
    
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.addDebugNode('themes_found', `Found ${themes.length} themes in paper, checking each for relevance to seeds`, {
      stackDepth,
      themes: themes.map(t => t.description.substring(0, 60) + '...')
    });

    for (const theme of themes) {
      const shouldSpawn = await this.isRelevantNewDirection(parentThread.theme, theme.description);
      
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }

      if (shouldSpawn && this.threads.length < this.maxThreads) {
        this.logger.log('Creating sub-thread:', theme.description.substring(0, 60));
        
        const subThread = {
          id: this.generateThreadId(),
          theme: theme.description,
          spawnYear: paper.year,
          spawnPaper: {
            title: paper.title,
            authors: paper.authors,
            year: paper.year
          },
          papers: [{
            ...paper,
            selectionReason: 'Divergent research direction - spawned new sub-thread'
          }],
          subThreads: []
        };

        await this.expandThreadToPresent(subThread, paper.year);

        if (subThread.papers.length > 1) {
          parentThread.subThreads.push(subThread);
        }
      }
    }
  }
  
  async isRelevantNewDirection(parentTheme, candidateTheme) {
    const seedContext = this.seedPapers.map(s => 
      `- "${s.title}"${s.abstract ? '\n  Abstract: ' + s.abstract : ''}`
    ).join('\n\n');
    
    const prompt = `You are helping trace research lineages. Your job is to be HIGHLY SELECTIVE.

THE USER'S ORIGINAL SEED PAPERS (this is what they care about):
${seedContext}

CURRENT THREAD: ${parentTheme}

CANDIDATE NEW DIRECTION: ${candidateTheme}

Should we create a new research thread for the candidate?

Answer "yes" ONLY if ALL of these are true:
1. The candidate DIRECTLY BUILDS ON specific ideas, methods, or architectures from the seed papers - not just the broad problem domain
2. The candidate would not exist without the seed papers' specific technical contributions
3. The candidate is meaningfully different from the current thread (not redundant)

Answer "no" if:
- The candidate addresses a general research challenge that applies to many systems beyond the seeds
- The candidate shares the seed's application domain but uses unrelated techniques
- The candidate is a generic method that COULD be applied to the seed's domain but wasn't specifically developed for it
- The connection is "both work on X" rather than "this extends that specific idea"

The test: Would the candidate paper's authors cite the seed papers as direct technical ancestors, or merely as related work in the same field?

When in doubt, answer "no". We want direct intellectual lineage, not topical neighbors.

Answer in this format:
DECISION: yes/no
REASON: <one sentence explanation>`;

    const response = await this.callLLM(prompt);
    const shouldCreate = response.toLowerCase().includes('decision: yes');
    
    const reasonMatch = response.match(/REASON:\s*(.+)/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';
    
    this.addDebugNode('subthread_check', `Check sub-thread: "${candidateTheme}"`, {
      parentTheme: parentTheme,
      candidateTheme: candidateTheme,
      seedPapers: this.seedPapers.map(s => s.title),
      decision: shouldCreate ? 'CREATE' : 'SKIP',
      reason: reason
    });
    
    this.logger.log('Sub-thread check:', shouldCreate ? 'CREATE' : 'SKIP', '-', candidateTheme.substring(0, 50), '-', reason);
    
    return shouldCreate;
  }

  async identifyResearchThemes(paper) {
    const prompt = `Analyze this paper and identify 2-3 distinct research threads.

Paper: ${paper.title}
Year: ${paper.year || 'Unknown'}
Abstract: ${paper.abstract || 'No abstract available'}

Return ONLY a JSON array:
[{"description": "thread description", "keywords": ["term1", "term2"]}]`;

    const response = await this.callLLM(prompt);
    
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const themes = JSON.parse(cleaned);
      return themes.slice(0, 3);
    } catch (error) {
      console.error('Failed to parse themes:', error);
      return [];
    }
  }

  async fetchCitationsAndRecommendations(seedPaper, minYear) {
    this.updateProgress(
      `Searching Semantic Scholar...`,
      `Finding papers from ${minYear}+ using citations + embeddings`,
      null
    );

    let paperId = seedPaper.paperId;
    
    this.logger.log('fetchCitationsAndRecommendations - original paperId:', paperId);
    this.logger.log('fetchCitationsAndRecommendations - paper title:', seedPaper.title);

    if (!paperId || paperId.length < 10) {
      if (this.paperIdCache.has(seedPaper.title)) {
        paperId = this.paperIdCache.get(seedPaper.title);
        this.logger.log('Using cached paperId:', paperId);
      } else {
        this.logger.log('paperId looks invalid, searching by title...');
        
        const searchResponse = await this.throttledSemanticScholarCall({
          url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(seedPaper.title)}&fields=paperId&limit=1`,
          method: 'GET'
        }, `paper search: ${seedPaper.title.substring(0, 30)}...`);
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          paperId = searchResponse.data.data[0].paperId;
          this.paperIdCache.set(seedPaper.title, paperId);
          this.logger.log('Found real paperId via search:', paperId);
        } else {
          throw new Error(`Could not find paper in Semantic Scholar: "${seedPaper.title}"`);
        }
      }
    }

    const allCitingPapers = [];
    let batchIndex = 0;
    
    while (true) {
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }
      
      const offset = batchIndex * 100;
      this.logger.log(`Fetching citation batch ${batchIndex + 1} (offset ${offset})...`);
      
      try {
        const citationsResponse = await this.throttledSemanticScholarCall({
          url: `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?fields=paperId,title,abstract,year,authors,citationCount&limit=100&offset=${offset}`,
          method: 'GET'
        }, `citations batch ${batchIndex + 1}`);
        
        const batch = (citationsResponse.data.data || []).map(c => c.citingPaper).filter(p => p);
        allCitingPapers.push(...batch);
        this.logger.log(`Got ${batch.length} citing papers in batch ${batchIndex + 1}`);
        
        if (batch.length < 100) {
          this.logger.log('Reached end of citations, stopping pagination');
          break;
        }
        
        batchIndex++;
      } catch (error) {
        if (allCitingPapers.length > 0) {
          this.logger.warn(`Failed to fetch citation batch ${batchIndex + 1}, continuing with ${allCitingPapers.length} papers: ${error.message}`);
          break;
        }
        throw error;
      }
    }
    
    this.logger.log('Total citing papers across all batches:', allCitingPapers.length);
    
    const citingYears = {};
    allCitingPapers.forEach(p => {
      const year = p.year || 'unknown';
      citingYears[year] = (citingYears[year] || 0) + 1;
    });
    this.logger.log('Citing papers year distribution:', JSON.stringify(citingYears));

    this.logger.log('Fetching semantic recommendations...');
    let recommendedPapers = [];
    try {
      const recsResponse = await this.throttledSemanticScholarCall({
        url: 'https://api.semanticscholar.org/recommendations/v1/papers?fields=paperId,title,abstract,year,authors,citationCount&limit=100',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          positivePaperIds: [paperId]
        }
      }, 'recommendations');
      
      recommendedPapers = recsResponse.data.recommendedPapers || [];
    } catch (error) {
      if (allCitingPapers.length > 0) {
        this.logger.warn(`Failed to fetch recommendations, continuing with citations only: ${error.message}`);
      } else {
        throw error;
      }
    }
    
    this.logger.log('Got', recommendedPapers.length, 'recommendations');
    
    // BROADER DOMAIN SEARCH: Find papers in same research area with different approaches
    this.logger.log('Performing broader domain search for diverse approaches...');
    let broaderPapers = [];
    try {
      const searchQueries = [
        'visual navigation transformer foundation model',
        'vision language navigation VLN end-to-end learning',
        'reinforcement learning navigation large scale simulation',
        'robot navigation RL policy learning'
      ];
      
      for (const query of searchQueries) {
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        this.logger.log(`Searching for: "${query}"`);
        try {
          const searchResponse = await this.throttledSemanticScholarCall({
            url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=paperId,title,abstract,year,authors,citationCount&limit=25&publicationDateOrYear=2020:`,
            method: 'GET'
          }, `broader search: ${query.substring(0, 20)}...`);
          
          const papers = searchResponse.data.data || [];
          broaderPapers.push(...papers);
          this.logger.log(`Found ${papers.length} papers for "${query}"`);
        } catch (searchError) {
          this.logger.warn(`Search failed for "${query}": ${searchError.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Broader search encountered error: ${error.message}`);
    }
    
    this.logger.log(`Broader search found ${broaderPapers.length} additional papers`);
    
    // Add all discovered papers to candidate pool
    for (const paper of allCitingPapers) {
      this.addToCandidatePool(paper, 'citations');
    }
    for (const paper of recommendedPapers) {
      this.addToCandidatePool(paper, 'recommendations');
    }
    for (const paper of broaderPapers) {
      this.addToCandidatePool(paper, 'broader_search');
    }
    
    const paperMap = new Map();
    
    allCitingPapers.forEach(p => {
      if (p.paperId) paperMap.set(p.paperId, p);
    });
    
    recommendedPapers.forEach(p => {
      if (p.paperId && !paperMap.has(p.paperId)) {
        paperMap.set(p.paperId, p);
      }
    });
    
    // Add broader search results
    broaderPapers.forEach(p => {
      if (p.paperId && !paperMap.has(p.paperId)) {
        paperMap.set(p.paperId, p);
      }
    });
    
    const allPapers = Array.from(paperMap.values());
    this.logger.log('After merging: ', allPapers.length, 'unique papers');
    
    const yearCounts = {};
    allPapers.forEach(p => {
      const year = p.year || 'unknown';
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    this.logger.log('Year distribution:', JSON.stringify(yearCounts));
    
    const currentYear = new Date().getFullYear();
    const papersBeforeQualityFilter = allPapers.length;
    
    const qualityFiltered = allPapers.filter(p => {
      const age = currentYear - (p.year || currentYear);
      
      if (age <= 2) return true;
      
      return (p.citationCount || 0) >= 5;
    });
    
    this.logger.log(`Quality filter: ${papersBeforeQualityFilter} → ${qualityFiltered.length} papers (removed ${papersBeforeQualityFilter - qualityFiltered.length} old low-citation papers)`);
    
    const qualityFilterYears = {};
    qualityFiltered.forEach(p => {
      const year = p.year || 'unknown';
      qualityFilterYears[year] = (qualityFilterYears[year] || 0) + 1;
    });
    this.logger.log('After quality filter, year distribution:', JSON.stringify(qualityFilterYears));
    
    const seedYear = seedPaper.year || new Date().getFullYear();
    const actualMinYear = Math.max(minYear - 2, seedYear - 1);
    
    const papers = qualityFiltered
      .filter(p => p.year >= actualMinYear && p.year <= new Date().getFullYear())
      .sort((a, b) => a.year - b.year)
      .map(p => ({
        paperId: p.paperId,
        title: p.title,
        abstract: p.abstract || '',
        year: p.year,
        authors: p.authors || [],
        citationCount: p.citationCount || 0
      }));

    this.logger.log('After year filtering (>=', actualMinYear, '):', papers.length, 'papers');
    
    this.addDebugNode('search', `SEARCH from "${seedPaper.title.substring(0, 50)}..."`, {
      stackDepth: this.expansionStack.length,
      searchPaper: seedPaper.title,
      reason: `This is the last paper in the thread, so we search for papers that cite it or are semantically similar`,
      found: `${papers.length} papers (${allCitingPapers.length} citing + ${recommendedPapers.length} recommended)`,
      seedYear: seedPaper.year,
      minYear: actualMinYear,
      afterMerge: allPapers.length,
      afterQualityFilter: qualityFiltered.length,
      afterYearFilter: papers.length,
      yearDistribution: qualityFilterYears
    });

    return papers;
  }

  async rankByThreadRelevance(papers, threadTheme, seedPaper) {
    if (papers.length === 0) return [];

    this.logger.log('rankByThreadRelevance - input:', papers.length, 'papers for theme:', threadTheme.substring(0, 50));

    const seedAuthors = (seedPaper.authors || []).map(a => a.name).join(', ');

    const paperList = papers.map((p, i) => {
      const authorNames = (p.authors || []).map(a => a.name).join(', ');
      const abstract = p.abstract || 'No abstract available';
      return `${i + 1}. ${p.title} (${p.year})
   Authors: ${authorNames || 'Unknown'}
   Abstract: ${abstract}
   Citations: ${p.citationCount || 0}`;
    }).join('\n\n');

    const prompt = `Rank these papers by relevance to thread: "${threadTheme}"

Seed paper authors: ${seedAuthors || 'Unknown'}

PRIORITIZE (in order):
1. Papers by the same authors/lab (especially if authors overlap with seed paper)
2. Direct follow-up work that cites the seed paper
3. Papers with high citation counts (>50) that build on this thread
4. Topically relevant recent work

Papers:
${paperList}

Return ONLY a JSON array of indices: [1, 5, 3, ...]`;

    this.logger.log('Prompt length:', prompt.length, 'characters');

    const response = await this.callLLM(prompt);

    try {
      let cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        cleaned = arrayMatch[0];
      }
      
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
        this.logger.warn('LLM returned incomplete array, auto-closing...');
        cleaned = cleaned.replace(/,\s*$/, '');
        cleaned += ']';
      }
      
      this.logger.log('Cleaned response (first 200 chars):', cleaned.substring(0, 200));
      
      const indices = JSON.parse(cleaned);
      
      if (!Array.isArray(indices)) {
        throw new Error('LLM response is not an array');
      }
      
      const ranked = indices.map(i => papers[i - 1]).filter(p => p);
      this.logger.log('rankByThreadRelevance - output:', ranked.length, 'ranked papers');
      
      const top10 = ranked.slice(0, 10).map(p => ({
        title: p.title,
        year: p.year,
        authors: (p.authors || []).slice(0, 5).map(a => a.name).join(', '),
        citations: p.citationCount
      }));
      
      this.addDebugNode('rank', `RANK: LLM ranked ${papers.length} papers by relevance to thread theme`, {
        stackDepth: this.expansionStack.length,
        theme: threadTheme.substring(0, 100),
        criteria: 'Same authors/lab → Direct citations → High-impact builds → Recent relevant',
        inputCount: papers.length,
        outputCount: ranked.length,
        top10
      });
      
      return ranked;
    } catch (error) {
      this.logger.error('rankByThreadRelevance - LLM response parse failed');
      this.logger.error('Raw LLM response (first 500 chars):', response.substring(0, 500));
      this.logger.error('Parse error:', error.message);
      
      this.logger.log('Asking LLM to clean up malformed response...');
      
      const fixPrompt = `The following array is malformed JSON. Please return ONLY a valid JSON array of integers, with no extra text or commentary:

${response}

Return ONLY the fixed JSON array: [1, 2, 3, ...]`;

      let fixedResponse;
      try {
        fixedResponse = await this.callLLM(fixPrompt);
        const fixedCleaned = fixedResponse.replace(/```json\n?|\n?```/g, '').trim();
        const fixedArrayMatch = fixedCleaned.match(/\[[\s\S]*\]/);
        const fixedArray = fixedArrayMatch ? fixedArrayMatch[0] : fixedCleaned;
        
        const indices = JSON.parse(fixedArray);
        if (!Array.isArray(indices)) {
          throw new Error('Fixed response is still not an array');
        }
        
        const ranked = indices.map(i => papers[i - 1]).filter(p => p);
        this.logger.log('rankByThreadRelevance - successfully recovered with LLM fix:', ranked.length, 'papers');
        
        this.addDebugNode('rank', `Ranked ${papers.length} papers for theme: ${threadTheme} (after LLM fix)`, {
          top10: ranked.slice(0, 10).map(p => ({
            title: p.title,
            year: p.year,
            authors: (p.authors || []).slice(0, 5).map(a => a.name).join(', '),
            citations: p.citationCount
          }))
        });
        
        return ranked;
      } catch (fixError) {
        this.addDebugNode('rank', `Ranking FAILED for theme: ${threadTheme}`, {
          parseError: error.message,
          fixError: fixError.message,
          originalResponse: response,
          fixedAttempt: fixedResponse || 'LLM fix call failed'
        });
        
        throw new Error(`Failed to parse LLM ranking response even after retry: ${error.message}. Check debug tree for full LLM response.`);
      }
    }
  }

  async selectRelevantPapers(rankedPapers, thread, maxPapers = 5) {
    if (rankedPapers.length === 0) return [];
    
    const seedContext = this.seedPapers.map(s => 
      `- "${s.title}" by ${(s.authors || []).slice(0, 5).map(a => a.name).join(', ')}`
    ).join('\n');
    
    const threadContext = thread.papers.map(p => `- "${p.title}" (${p.year})`).join('\n');
    
    const candidatesForLLM = rankedPapers.slice(0, 10);
    const candidatesList = candidatesForLLM.map((p, i) => 
      `${i + 1}. "${p.title}" (${p.year})\n   Authors: ${(p.authors || []).slice(0, 5).map(a => a.name).join(', ')}${p.abstract ? '\n   Abstract: ' + p.abstract : ''}`
    ).join('\n\n');
    
    const prompt = `You are selecting papers to add to a research lineage thread.

ORIGINAL SEED PAPERS:
${seedContext}

THREAD THEME: ${thread.theme}

PAPERS ALREADY IN THREAD:
${threadContext}

CANDIDATE PAPERS:
${candidatesList}

Select which papers should be added to continue this research lineage.

STRONG signals to ADD a paper:
- Same authors or research lab as seed papers (this is the STRONGEST signal - same lab = direct lineage)
- Direct follow-up work that cites the seeds as a foundation
- Advances the same research GOAL even if the method/architecture evolves
- Applies the seed's core ideas to new domains or extends them

It's EXPECTED that successors may:
- Change methods or techniques while pursuing the same research goals
- Add new capabilities or combine with other approaches
- Apply the ideas to new contexts

SKIP papers that are:
- Unrelated work that happens to cite the seeds
- Surveys or meta-analyses (not original research advancing the ideas)
- Work on completely different problems

For each paper, decide: ADD (with reason) or SKIP (with reason).

Return JSON array:
[
  {"index": 1, "decision": "ADD", "reason": "Same authors, direct follow-up extending the core method"},
  {"index": 2, "decision": "SKIP", "reason": "Survey paper, not original research"},
  ...
]`;

    const response = await this.callLLM(prompt);
    
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      const decisions = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
      
      const selected = [];
      const selectionLog = [];
      
      for (const decision of decisions) {
        const paperIndex = decision.index - 1;
        if (paperIndex >= 0 && paperIndex < candidatesForLLM.length) {
          const paper = candidatesForLLM[paperIndex];
          selectionLog.push({
            title: paper.title,
            decision: decision.decision,
            reason: decision.reason
          });
          
          if (decision.decision === 'ADD' && selected.length < maxPapers) {
            selected.push({
              ...paper,
              selectionReason: decision.reason
            });
          }
        }
      }
      
      this.addDebugNode('select_decisions', `LLM selected ${selected.length} of ${candidatesForLLM.length} candidates`, {
        stackDepth: this.expansionStack.length,
        decisions: selectionLog
      });
      
      return selected;
    } catch (error) {
      this.logger.error('Failed to parse selection response:', error.message);
      this.logger.error('Response was:', response.substring(0, 500));
      
      this.addDebugNode('select_decisions', `Selection parse failed, falling back to top 3`, {
        stackDepth: this.expansionStack.length,
        error: error.message
      });
      
      return rankedPapers.slice(0, 3).map(p => ({
        ...p,
        selectionReason: 'Fallback: highly ranked by relevance'
      }));
    }
  }

  async areThemesDifferent(theme1, theme2) {
    const prompt = `Are these research themes substantially different?

Theme 1: ${theme1}
Theme 2: ${theme2}

Answer only "yes" or "no".`;

    const response = await this.callLLM(prompt);
    return response.toLowerCase().includes('yes');
  }

  async callLLM(prompt) {
    this.logger.log('callLLM called with prompt length:', prompt.length);
    
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.callOpenRouter({
          messages: [{ role: 'user', content: prompt }]
        });
        
        if (response && response.success) {
          return response.data.choices[0].message.content;
        } else {
          lastError = response?.error || 'LLM call failed';
          
          if (response && response.error && !response.error.includes('fetch')) {
            throw new Error(lastError);
          }
          
          if (attempt < 3) {
            this.logger.warn(`LLM call attempt ${attempt} failed, retrying in 2s...`);
            await this.sleep(2000);
            if (await this.checkStopped()) throw new Error('Analysis stopped by user');
          }
        }
      } catch (error) {
        lastError = error.message;
        if (attempt < 3) {
          this.logger.warn(`LLM call attempt ${attempt} failed with error, retrying in 2s...`);
          await this.sleep(2000);
          if (await this.checkStopped()) throw new Error('Analysis stopped by user');
        }
      }
    }
    
    throw new Error(lastError);
  }

  async callOpenRouter(data) {
    try {
      const apiKey = this.openRouterApiKey;

      if (!apiKey) {
        throw new Error('OpenRouter API key not set. Provide it in apiConfig.openRouterApiKey');
      }

      const requestBody = {
        model: 'x-ai/grok-4.1-fast',
        messages: data.messages,
        temperature: 0.3
      };
      
      const requestHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('OpenRouter API error:', response.status, errorText);
        throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('callOpenRouter error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async callSemanticScholar(data) {
    try {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastSemanticScholarCall;
      if (timeSinceLastCall < this.semanticScholarDelay) {
        await this.sleep(this.semanticScholarDelay - timeSinceLastCall);
      }
      this.lastSemanticScholarCall = Date.now();
      
      const response = await fetch(data.url, {
        method: data.method || 'GET',
        headers: data.headers || {},
        body: data.body ? JSON.stringify(data.body) : undefined
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('Semantic Scholar error response:', errorText);
        throw new Error(`Semantic Scholar API error: ${response.status}`);
      }

      const result = await response.json();
      
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('callSemanticScholar error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  async callSemanticScholarWithRetry(data, context = 'API call') {
    const maxTotalTime = 20000;
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;
    
    const getDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000);
    
    while (Date.now() - startTime < maxTotalTime) {
      attempt++;
      
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }
      
      if (attempt > 1) {
        const delay = getDelay(attempt - 2);
        this.logger.warn(`Semantic Scholar rate limited. Retry ${attempt}, waiting ${delay/1000}s... (${context})`);
        this.updateProgress(
          `Rate limited by Semantic Scholar...`,
          `Waiting ${delay/1000}s before retry ${attempt} (${context})`,
          null
        );
        await this.sleep(delay);
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
      }
      
      const response = await this.callSemanticScholar(data);
      
      if (response.success) {
        if (attempt > 1) {
          this.rateLimitDelay = Math.min((this.rateLimitDelay || 500) + 500, 3000);
          this.logger.log(`Rate limit recovered. Increasing delay between requests to ${this.rateLimitDelay}ms`);
        }
        return response;
      }
      
      lastError = response.error || 'Unknown Semantic Scholar error';
      
      const isRateLimit = lastError.includes('429') || lastError.includes('Too Many Requests');
      
      if (!isRateLimit) {
        throw new Error(`Semantic Scholar API error (${context}): ${lastError}`);
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    throw new Error(`Semantic Scholar API failed after ${elapsed}s of retries (${context}): ${lastError}`);
  }
  
  async throttledSemanticScholarCall(data, context = 'API call') {
    if (this.rateLimitDelay && this.rateLimitDelay > 0) {
      await this.sleep(this.rateLimitDelay);
      if (await this.checkStopped()) throw new Error('Analysis stopped by user');
    }
    
    return this.callSemanticScholarWithRetry(data, context);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generatePaperId(title) {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash) + title.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  generateThreadId() {
    return 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  updateProgress(message, detail, percent) {
    if (this.progressCallback) {
      const threadSummary = this.expansionStack.map(t => ({
        theme: t.theme,
        spawnPaper: t.spawnPaper,
        spawnYear: t.spawnYear,
        papers: t.papers.map(p => ({
          title: p.title,
          year: p.year,
          selectionReason: p.selectionReason
        })),
        subThreads: []
      }));
      
      const completedSummary = this.threads.map(t => ({
        theme: t.theme,
        spawnPaper: t.spawnPaper,
        spawnYear: t.spawnYear,
        papers: t.papers.map(p => ({
          title: p.title,
          year: p.year,
          selectionReason: p.selectionReason
        })),
        subThreads: t.subThreads || [],
        completed: true
      }));
      
      this.progressCallback(message, detail, percent, [...threadSummary, ...completedSummary]);
    }
  }
  
  getDebugTree() {
    return this.debugTree;
  }
  
  // Add paper to global candidate pool for cross-thread discovery
  addToCandidatePool(paper, source) {
    const paperId = paper.paperId || paper.title;
    if (!this.candidatePool.has(paperId)) {
      this.candidatePool.set(paperId, {
        paper,
        source,
        discoveredAt: new Date().toISOString()
      });
    }
  }
  
  // Post-processing: cluster remaining papers into new threads
  async clusterRemainingPapers() {
    if (this.candidatePool.size === 0) return;
    
    this.logger.log(`Post-processing: ${this.candidatePool.size} papers in candidate pool`);
    
    // Get papers not yet in any thread
    const unassignedPapers = [];
    for (const [paperId, data] of this.candidatePool) {
      if (!this.processedPapers.has(paperId)) {
        unassignedPapers.push(data.paper);
      }
    }
    
    if (unassignedPapers.length === 0) {
      this.logger.log('No unassigned papers to cluster');
      return;
    }
    
    this.logger.log(`${unassignedPapers.length} unprocessed candidates in pool`);
    
    // Use LLM to identify if there are coherent groupings
    const prompt = `Analyze these papers and identify if there are 1-2 coherent research threads distinct from existing threads.

${this.getClusteringCriteriaPrompt()}

EXISTING THREADS:
${this.threads.map(t => `- ${t.theme} (${t.papers.length} papers)`).join('\n')}

CANDIDATE PAPERS (sample):
${unassignedPapers.slice(0, 20).map((p, i) => `${i + 1}. "${p.title}" (${p.year}) - ${(p.authors || []).slice(0, 3).map(a => a.name).join(', ')}`).join('\n')}

Return JSON with 0-2 thread suggestions:
[{"theme": "brief name", "description": "what unifies these papers", "reasoning": "why this is distinct from existing threads"}]`;

    try {
      const response = await this.callLLM(prompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      const suggestions = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
      
      if (suggestions && suggestions.length > 0) {
        for (const suggestion of suggestions) {
          this.logger.log(`Identified potential thread from pool: ${suggestion.theme}`);
          // For now, just log it - we'd need to select representative papers
        }
      }
    } catch (error) {
      this.logger.warn('Failed to cluster candidate pool:', error.message);
    }
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThroughlineAnalyzer };
}

if (typeof window !== 'undefined') {
  window.ThroughlineAnalyzer = ThroughlineAnalyzer;
}
