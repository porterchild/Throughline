// Background service worker for API calls
console.log('=== BACKGROUND SERVICE WORKER LOADED ===');

// Debug logging system for background
const DEBUG_BG = {
  log: function(...args) {
    console.log(...args);
    this.sendToStorage('LOG', args);
  },
  error: function(...args) {
    console.error(...args);
    this.sendToStorage('ERROR', args);
  },
  warn: function(...args) {
    console.warn(...args);
    this.sendToStorage('WARN', args);
  },
  sendToStorage: async function(level, args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    const timestamp = new Date().toLocaleTimeString();
    
    const result = await chrome.storage.local.get(['debugLogs']);
    const logs = result.debugLogs || [];
    logs.push({ level, message, time: timestamp });
    
    // Keep only last 100 logs
    if (logs.length > 100) logs.shift();
    
    await chrome.storage.local.set({ debugLogs: logs });
  }
};

DEBUG_BG.log('Background service worker initialized');

const SEMANTIC_SCHOLAR_DELAY = 1000; // 1 req/sec for unauthorized
let lastSemanticScholarCall = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callSemanticScholar') {
    handleSemanticScholar(request.data, sendResponse);
    return true;
  } else if (request.action === 'callOpenRouter') {
    handleOpenRouter(request.data, sendResponse);
    return true;
  } else if (request.action === 'startAnalysis') {
    handleStartAnalysis(request.papers);
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getAnalysisStatus') {
    chrome.storage.local.get(['analysisProgress', 'analysisResults', 'analysisError'], (result) => {
      sendResponse({
        progress: result.analysisProgress,
        results: result.analysisResults,
        error: result.analysisError
      });
    });
    return true;
  } else if (request.action === 'stopAnalysis') {
    DEBUG_BG.log('Stop analysis requested');
    chrome.storage.local.set({ analysisShouldStop: true });
    sendResponse({ success: true });
    return true;
  }
});

async function handleSemanticScholar(data, sendResponse) {
  try {
    const now = Date.now();
    const timeSinceLastCall = now - lastSemanticScholarCall;
    if (timeSinceLastCall < SEMANTIC_SCHOLAR_DELAY) {
      await sleep(SEMANTIC_SCHOLAR_DELAY - timeSinceLastCall);
    }
    lastSemanticScholarCall = Date.now();
    
    const response = await fetch(data.url, {
      method: data.method || 'GET',
      headers: data.headers || {},
      body: data.body ? JSON.stringify(data.body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      DEBUG_BG.error('Semantic Scholar error response:', errorText);
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const result = await response.json();
    
    const responseObj = { success: true, data: result };
    if (sendResponse) sendResponse(responseObj);
    return responseObj;
  } catch (error) {
    DEBUG_BG.error('handleSemanticScholar error:', error.message);
    const errorObj = { success: false, error: error.message };
    if (sendResponse) sendResponse(errorObj);
    return errorObj;
  }
}

async function handleOpenRouter(data, sendResponse) {
  try {
    // HARDCODED FOR DEVELOPMENT
    const apiKey = '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';

    if (!apiKey) {
      throw new Error('OpenRouter API key not set. Right-click extension icon → Options to configure.');
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
      DEBUG_BG.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    const responseObj = { success: true, data: result };
    if (sendResponse) sendResponse(responseObj);
    return responseObj;
  } catch (error) {
    DEBUG_BG.error('handleOpenRouter error:', error.message);
    DEBUG_BG.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 200)
    });
    const errorObj = { success: false, error: error.message };
    if (sendResponse) sendResponse(errorObj);
    return errorObj;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleStartAnalysis(papers) {
  DEBUG_BG.log('=== Starting analysis ===');
  DEBUG_BG.log('Papers to analyze:', papers.length);
  
  // Keep service worker alive during analysis
  const keepAliveInterval = setInterval(() => {
    DEBUG_BG.log('Keepalive ping');
  }, 20000); // Every 20 seconds
  
  // Clear previous results
  await chrome.storage.local.set({ 
    analysisProgress: { message: 'Starting...', detail: 'Initializing analyzer', percent: 0 },
    analysisResults: null,
    analysisError: null,
    analysisShouldStop: false  // Clear any previous stop request
  });

  let analyzer; // Declare outside try so it's accessible in catch
  try {
    DEBUG_BG.log('Creating ThroughlineAnalyzer...');
    analyzer = new ThroughlineAnalyzer();
    DEBUG_BG.log('Analyzer created successfully');
    
    // Custom progress callback that saves to storage
    const progressCallback = (msg, detail, percent, threads) => {
      DEBUG_BG.log('Progress:', msg, '|', detail, '|', percent + '%');
      chrome.storage.local.set({
        analysisProgress: { 
          message: msg, 
          detail: detail || '', 
          percent: percent || 0,
          threads: threads || []
        }
      });
    };

    DEBUG_BG.log('Starting analyzer.traceResearchLineages()...');
    const threads = await analyzer.traceResearchLineages(papers, progressCallback);
    DEBUG_BG.log('Analysis complete! Threads:', threads.length);
    DEBUG_BG.log('Debug tree nodes:', analyzer.debugTree.length);

    // Save results
    await chrome.storage.local.set({
      analysisResults: threads,
      analysisDebugTree: analyzer.debugTree, // Save debug tree
      analysisProgress: { message: 'Complete!', detail: `Found ${threads.length} threads`, percent: 100 }
    });
  } catch (error) {
    DEBUG_BG.error('=== Analysis failed ===', error.message);
    DEBUG_BG.error('Stack:', error.stack);
    
    // Save debug tree even on failure so user can debug
    await chrome.storage.local.set({
      analysisError: error.message,
      analysisDebugTree: analyzer?.debugTree || [], // Save whatever we have
      analysisProgress: { message: 'Failed', detail: error.message, percent: 0 }
    });
  } finally {
    clearInterval(keepAliveInterval);
    DEBUG_BG.log('Analysis handler completed');
  }
}

// Recursive thread analysis logic

class ThroughlineAnalyzer {
  constructor() {
    this.threads = [];
    this.processedPapers = new Set();
    this.paperIdCache = new Map(); // Cache title -> paperId lookups
    this.maxThreads = 10;
    this.maxPapersPerThread = 20;
    this.progressCallback = null;
    this.debugTree = []; // Track exploration decisions
    this.expansionStack = []; // Track nested thread expansion for debugging
    this.stopped = false; // Local stop flag for faster checking
    this.seedPapers = []; // Original seeds - our north star for relevance
    this.rateLimitDelay = 0; // Adaptive delay between Semantic Scholar calls
  }
  
  async checkStopped() {
    // Check local flag first (fast)
    if (this.stopped) return true;
    
    // Check storage (slower, but catches user clicks)
    const stopCheck = await chrome.storage.local.get(['analysisShouldStop']);
    if (stopCheck.analysisShouldStop) {
      this.stopped = true;
      DEBUG_BG.log('Analysis stopped by user');
      return true;
    }
    return false;
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
    this.stopped = false;  // Reset stop flag
    this.seedPapers = seedPapers; // Store as our north star for relevance checks
    
    const totalSteps = seedPapers.length * 3; // Rough estimate
    let currentStep = 0;

    this.updateProgress('Starting analysis...', 'Extracting research themes from seed papers', 0);

    for (const seedPaper of seedPapers) {
      // Check stop at start of each seed paper
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

    // Sort threads by spawn year (earliest first)
    this.threads.sort((a, b) => a.spawnYear - b.spawnYear);

    this.updateProgress('Complete!', `Discovered ${this.threads.length} research threads`, 100);

    return this.threads;
  }

  async extractThreadsFromSeed(seedPaper) {
    // Check stop before processing
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.updateProgress(
      `Analyzing: ${seedPaper.title.substring(0, 60)}...`,
      'Extracting research themes with LLM',
      null
    );

    const themes = await this.identifyResearchThemes(seedPaper);
    
    // Check stop after LLM call
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
        papers: [seedPaper],
        subThreads: []
      };

      await this.expandThreadToPresent(thread, thread.spawnYear);
      
      DEBUG_BG.log('Thread after expansion:', thread.theme, '- papers:', thread.papers.length, 'subthreads:', thread.subThreads.length);
      
      if (thread.papers.length > 1 || thread.subThreads.length > 0) {
        DEBUG_BG.log('Adding thread to results');
        this.threads.push(thread);
      } else {
        DEBUG_BG.log('Skipping thread (only 1 paper, no subthreads)');
      }

      if (this.threads.length >= this.maxThreads) break;
    }
  }

  async expandThreadToPresent(thread, startYear) {
    // Check if user requested stop
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    // Track this thread in expansion stack for debugging
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
      
      DEBUG_BG.log('expandThreadToPresent - starting from year:', currentYear, 'to', currentYearActual);
      DEBUG_BG.log('Expansion stack depth:', stackDepth);
      
      this.addDebugNode('expand_begin', `BEGIN EXPAND THREAD (depth ${stackDepth}): ${thread.theme.substring(0, 80)}...`, {
        stackDepth,
        spawnYear: thread.spawnYear,
        spawnPaper: thread.spawnPaper.title,
        startingPapers: thread.papers.map(p => p.title)
      });

      let iterationCount = 0;
      let lastSearchedPaperId = null; // Track to avoid redundant searches
      
      while (currentYear < currentYearActual && thread.papers.length < this.maxPapersPerThread) {
        iterationCount++;
        
        // Check stop at start of each iteration
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        const lastPaper = thread.papers[thread.papers.length - 1];
        const lastPaperId = lastPaper.paperId || lastPaper.title;
        
        // If we're about to search from the same paper again, we've exhausted this thread
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
        
        // Search for papers from current year onwards (not strictly future)
        const relatedPapers = await this.fetchCitationsAndRecommendations(lastPaper, currentYear);
        
        // Check stop after API calls
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        DEBUG_BG.log('expandThreadToPresent - got', relatedPapers.length, 'related papers');

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
        
        // Check stop after LLM ranking
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        DEBUG_BG.log('expandThreadToPresent - ranked papers:', rankedPapers.length);

        this.updateProgress(
          `Ranking ${relatedPapers.length} papers...`,
          'Using LLM to rank relevance to thread',
          null
        );

        // Ask LLM which papers are truly relevant (not just top 3)
        const selectedPapers = await this.selectRelevantPapers(rankedPapers, thread, 5);
        
        // Check stop after LLM selection
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
            DEBUG_BG.log('Skipping already processed paper:', paper.title);
            this.addDebugNode('skip', `SKIP: "${paper.title}" (already in another thread)`, {
              year: paper.year,
              reason: 'duplicate',
              stackDepth
            });
            continue;
          }

          DEBUG_BG.log('Adding paper to thread:', paper.title, paper.year);
          
          thread.papers.push(paper);
          this.processedPapers.add(paperId);
          currentYear = paper.year;
          papersAddedThisIteration++;
          
          // Build comprehensive thread state
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
          
          DEBUG_BG.log('=== THREAD STATE ===');
          DEBUG_BG.log('Expansion stack (depth ' + stackDepth + '):');
          this.expansionStack.forEach((t, idx) => {
            const ind = '  '.repeat(idx);
            DEBUG_BG.log(ind + `[${idx}] ${t.theme.substring(0, 60)}... (${t.papers.length} papers)`);
          });
          DEBUG_BG.log('Completed threads:', this.threads.length);
          
          this.addDebugNode('select', `ADD: "${paper.title}"`, {
            year: paper.year,
            authors: (paper.authors || []).slice(0, 2).map(a => a.name).join(', '),
            citations: paper.citationCount,
            whySelected: paper.selectionReason || 'Selected by LLM',
            threadTheme: thread.theme.substring(0, 80),
            threadNowHas: thread.papers.map(p => p.title),
            stackDepth,
            allThreads: allThreadsInfo
          });

          if (this.threads.length < this.maxThreads) {
            await this.detectResearchDivergences(thread, paper);
            
            // Check stop after sub-thread processing
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
          // LLM found no relevant papers, or all were already processed - move to next year
          currentYear++;
        }
      }
      
      DEBUG_BG.log('expandThreadToPresent complete - thread now has', thread.papers.length, 'papers');
      
      this.addDebugNode('expand_end', `END EXPAND THREAD (depth ${stackDepth}): ${thread.papers.length} papers total`, {
        stackDepth,
        finalPapers: thread.papers.map(p => p.title),
        theme: thread.theme.substring(0, 80)
      });
    } finally {
      // Always pop from stack, even on error
      this.expansionStack.pop();
    }
  }

  async detectResearchDivergences(parentThread, paper) {
    // Check stop before processing
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
    
    // Check stop after LLM call
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.addDebugNode('themes_found', `Found ${themes.length} themes in paper, checking each for relevance to seeds`, {
      stackDepth,
      themes: themes.map(t => t.description.substring(0, 60) + '...')
    });

    for (const theme of themes) {
      // Check both: is it different from parent AND still relevant to original seeds?
      const shouldSpawn = await this.isRelevantNewDirection(parentThread.theme, theme.description);
      
      // Check stop after each comparison
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }

      if (shouldSpawn && this.threads.length < this.maxThreads) {
        DEBUG_BG.log('Creating sub-thread:', theme.description.substring(0, 60));
        
        const subThread = {
          id: this.generateThreadId(),
          theme: theme.description,
          spawnYear: paper.year,
          spawnPaper: {
            title: paper.title,
            authors: paper.authors,
            year: paper.year
          },
          papers: [paper],
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
    // Build seed papers context with full abstracts for better relevance checking
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
    
    // Extract reasoning
    const reasonMatch = response.match(/REASON:\s*(.+)/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';
    
    this.addDebugNode('subthread_check', `Check sub-thread: "${candidateTheme.substring(0, 60)}..."`, {
      parentTheme: parentTheme.substring(0, 100),
      candidateTheme: candidateTheme.substring(0, 100),
      seedPapers: this.seedPapers.map(s => s.title),
      decision: shouldCreate ? 'CREATE' : 'SKIP',
      reason: reason
    });
    
    DEBUG_BG.log('Sub-thread check:', shouldCreate ? 'CREATE' : 'SKIP', '-', candidateTheme.substring(0, 50), '-', reason);
    
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

    // Get the paper ID - search by title if we don't have a valid one
    let paperId = seedPaper.paperId;
    
    DEBUG_BG.log('fetchCitationsAndRecommendations - original paperId:', paperId);
    DEBUG_BG.log('fetchCitationsAndRecommendations - paper title:', seedPaper.title);

    // If no paperId or it's a hash, search by title to get real Semantic Scholar ID
    if (!paperId || paperId.length < 10) {
      // Check cache first
      if (this.paperIdCache.has(seedPaper.title)) {
        paperId = this.paperIdCache.get(seedPaper.title);
        DEBUG_BG.log('Using cached paperId:', paperId);
      } else {
        DEBUG_BG.log('paperId looks invalid, searching by title...');
        
        // Use robust retry for paper ID lookup
        const searchResponse = await this.throttledSemanticScholarCall({
          url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(seedPaper.title)}&fields=paperId&limit=1`,
          method: 'GET'
        }, `paper search: ${seedPaper.title.substring(0, 30)}...`);
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          paperId = searchResponse.data.data[0].paperId;
          this.paperIdCache.set(seedPaper.title, paperId); // Cache it
          DEBUG_BG.log('Found real paperId via search:', paperId);
        } else {
          throw new Error(`Could not find paper in Semantic Scholar: "${seedPaper.title}"`);
        }
      }
    }

    // STRATEGY: Get both citations AND recommendations, then merge
    // Citations = direct descendants (same lab, follow-up work)
    // Recommendations = semantically related (broader field)
    
    // 1. Get papers that cite this paper (direct lineage)
    // Fetch MULTIPLE batches to get papers from different years
    // Most recent 100 are likely all from current year, so we need papers from previous years too
    DEBUG_BG.log('Fetching papers that cite this work (multiple batches)...');
    
    const allCitingPapers = [];
    let batchIndex = 0;
    
    // Keep fetching until we get < 100 papers (indicates end of citations)
    while (true) {
      // Check stop during batch fetching
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }
      
      const offset = batchIndex * 100;
      DEBUG_BG.log(`Fetching citation batch ${batchIndex + 1} (offset ${offset})...`);
      
      try {
        const citationsResponse = await this.throttledSemanticScholarCall({
          url: `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?fields=paperId,title,abstract,year,authors,citationCount&limit=100&offset=${offset}`,
          method: 'GET'
        }, `citations batch ${batchIndex + 1}`);
        
        const batch = (citationsResponse.data.data || []).map(c => c.citingPaper).filter(p => p);
        allCitingPapers.push(...batch);
        DEBUG_BG.log(`Got ${batch.length} citing papers in batch ${batchIndex + 1}`);
        
        // If we got fewer than 100, we've reached the end
        if (batch.length < 100) {
          DEBUG_BG.log('Reached end of citations, stopping pagination');
          break;
        }
        
        batchIndex++;
      } catch (error) {
        // If we already have some papers, log warning and continue with what we have
        if (allCitingPapers.length > 0) {
          DEBUG_BG.warn(`Failed to fetch citation batch ${batchIndex + 1}, continuing with ${allCitingPapers.length} papers: ${error.message}`);
          break;
        }
        // If no papers yet, this is a hard failure
        throw error;
      }
    }
    
    DEBUG_BG.log('Total citing papers across all batches:', allCitingPapers.length);
    
    // Log year distribution of citing papers to see if we got older papers
    const citingYears = {};
    allCitingPapers.forEach(p => {
      const year = p.year || 'unknown';
      citingYears[year] = (citingYears[year] || 0) + 1;
    });
    DEBUG_BG.log('Citing papers year distribution:', JSON.stringify(citingYears));

    // 2. Get semantic recommendations
    DEBUG_BG.log('Fetching semantic recommendations...');
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
      // Recommendations are optional - if they fail but we have citations, continue
      if (allCitingPapers.length > 0) {
        DEBUG_BG.warn(`Failed to fetch recommendations, continuing with citations only: ${error.message}`);
      } else {
        throw error;
      }
    }
    
    DEBUG_BG.log('Got', recommendedPapers.length, 'recommendations');
    
    // 3. Merge and deduplicate (prioritize citations)
    const paperMap = new Map();
    
    // Add citing papers first (higher priority)
    allCitingPapers.forEach(p => {
      if (p.paperId) paperMap.set(p.paperId, p);
    });
    
    // Add recommendations
    recommendedPapers.forEach(p => {
      if (p.paperId && !paperMap.has(p.paperId)) {
        paperMap.set(p.paperId, p);
      }
    });
    
    const allPapers = Array.from(paperMap.values());
    DEBUG_BG.log('After merging: ', allPapers.length, 'unique papers');
    
    // Log year distribution
    const yearCounts = {};
    allPapers.forEach(p => {
      const year = p.year || 'unknown';
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    DEBUG_BG.log('Year distribution:', JSON.stringify(yearCounts));
    
    // OPTIMIZATION: Filter out old papers with low citations
    // Recent papers (<= 2 years old) haven't had time to accumulate citations, so keep all
    // But papers 3+ years old with < 5 citations are unlikely to be important lineage
    const currentYear = new Date().getFullYear();
    const papersBeforeQualityFilter = allPapers.length;
    
    const qualityFiltered = allPapers.filter(p => {
      const age = currentYear - (p.year || currentYear);
      
      // Keep recent papers regardless of citations (current year, last year, year before)
      // Use <= to handle Jan 1 boundary (2024 papers on Jan 1 2026 are still recent)
      if (age <= 2) return true;
      
      // For older papers (3+ years), require at least 5 citations
      return (p.citationCount || 0) >= 5;
    });
    
    DEBUG_BG.log(`Quality filter: ${papersBeforeQualityFilter} → ${qualityFiltered.length} papers (removed ${papersBeforeQualityFilter - qualityFiltered.length} old low-citation papers)`);
    
    // Log quality filter year breakdown for debugging
    const qualityFilterYears = {};
    qualityFiltered.forEach(p => {
      const year = p.year || 'unknown';
      qualityFilterYears[year] = (qualityFilterYears[year] || 0) + 1;
    });
    DEBUG_BG.log('After quality filter, year distribution:', JSON.stringify(qualityFilterYears));
    
    // For recent papers (<= 2 years old), we may not find many future papers
    // So be lenient - go back a couple years if needed
    const seedYear = seedPaper.year || new Date().getFullYear();
    const actualMinYear = Math.max(minYear - 2, seedYear - 1);
    
    const papers = qualityFiltered
      .filter(p => p.year >= actualMinYear && p.year <= new Date().getFullYear())
      .sort((a, b) => a.year - b.year) // Sort by year ascending
      .map(p => ({
        paperId: p.paperId,
        title: p.title,
        abstract: p.abstract || '',
        year: p.year,
        authors: p.authors || [],
        citationCount: p.citationCount || 0
      }));

    DEBUG_BG.log('After year filtering (>=', actualMinYear, '):', papers.length, 'papers');
    
    // Track this search in debug tree
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

    DEBUG_BG.log('rankByThreadRelevance - input:', papers.length, 'papers for theme:', threadTheme.substring(0, 50));

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

    DEBUG_BG.log('Prompt length:', prompt.length, 'characters');

    const response = await this.callLLM(prompt);

    try {
      // Clean the response - remove markdown and trim
      let cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      
      // Try to extract just the array if LLM added commentary
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        cleaned = arrayMatch[0];
      }
      
      // Remove trailing commas before ] or }
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      // If array is incomplete (starts with [ but doesn't end with ]), try to close it
      if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
        DEBUG_BG.warn('LLM returned incomplete array, auto-closing...');
        cleaned = cleaned.replace(/,\s*$/, '');
        cleaned += ']';
      }
      
      DEBUG_BG.log('Cleaned response (first 200 chars):', cleaned.substring(0, 200));
      
      const indices = JSON.parse(cleaned);
      
      if (!Array.isArray(indices)) {
        throw new Error('LLM response is not an array');
      }
      
      const ranked = indices.map(i => papers[i - 1]).filter(p => p);
      DEBUG_BG.log('rankByThreadRelevance - output:', ranked.length, 'ranked papers');
      
      // Track top 10 ranked papers
      const top10 = ranked.slice(0, 10).map(p => ({
        title: p.title,
        year: p.year,
        authors: (p.authors || []).slice(0, 2).map(a => a.name).join(', '),
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
      DEBUG_BG.error('rankByThreadRelevance - LLM response parse failed');
      DEBUG_BG.error('Raw LLM response (first 500 chars):', response.substring(0, 500));
      DEBUG_BG.error('Parse error:', error.message);
      
      // Try asking LLM to fix the malformed JSON
      DEBUG_BG.log('Asking LLM to clean up malformed response...');
      
      const fixPrompt = `The following array is malformed JSON. Please return ONLY a valid JSON array of integers, with no extra text or commentary:

${response}

Return ONLY the fixed JSON array: [1, 2, 3, ...]`;

      let fixedResponse; // Declare outside so it's accessible in catch
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
        DEBUG_BG.log('rankByThreadRelevance - successfully recovered with LLM fix:', ranked.length, 'papers');
        
        this.addDebugNode('rank', `Ranked ${papers.length} papers for theme: ${threadTheme} (after LLM fix)`, {
          top10: ranked.slice(0, 10).map(p => ({
            title: p.title,
            year: p.year,
            authors: (p.authors || []).slice(0, 2).map(a => a.name).join(', '),
            citations: p.citationCount
          }))
        });
        
        return ranked;
      } catch (fixError) {
        // LLM couldn't fix it either - save both responses and fail
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

  // Ask LLM which of the top-ranked papers are truly relevant to add to thread
  async selectRelevantPapers(rankedPapers, thread, maxPapers = 5) {
    if (rankedPapers.length === 0) return [];
    
    // Build seed context
    const seedContext = this.seedPapers.map(s => 
      `- "${s.title}" by ${(s.authors || []).slice(0, 3).map(a => a.name).join(', ')}`
    ).join('\n');
    
    // Show current thread papers
    const threadContext = thread.papers.map(p => `- "${p.title}" (${p.year})`).join('\n');
    
    // List top candidates (up to 10)
    const candidatesForLLM = rankedPapers.slice(0, 10);
    const candidatesList = candidatesForLLM.map((p, i) => 
      `${i + 1}. "${p.title}" (${p.year})\n   Authors: ${(p.authors || []).slice(0, 3).map(a => a.name).join(', ')}${p.abstract ? '\n   Abstract: ' + p.abstract : ''}`
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
            title: paper.title.substring(0, 50),
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
      DEBUG_BG.error('Failed to parse selection response:', error.message);
      DEBUG_BG.error('Response was:', response.substring(0, 500));
      
      // Fallback: return top 3 with generic reason
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
    DEBUG_BG.log('callLLM called with prompt length:', prompt.length);
    
    // Check if stopped before starting
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    // Retry up to 3 times on network errors
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const data = {
          messages: [{ role: 'user', content: prompt }]
        };
        
        // Call handler directly and await result
        const response = await handleOpenRouter(data);
        
        if (response && response.success) {
          return response.data.choices[0].message.content;
        } else {
          lastError = response?.error || 'LLM call failed';
          
          // If it's a clear error (not network), don't retry
          if (response && response.error && !response.error.includes('fetch')) {
            throw new Error(lastError);
          }
          
          // Otherwise retry
          if (attempt < 3) {
            DEBUG_BG.warn(`LLM call attempt ${attempt} failed, retrying in 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (await this.checkStopped()) throw new Error('Analysis stopped by user');
          }
        }
      } catch (error) {
        lastError = error.message;
        if (attempt < 3) {
          DEBUG_BG.warn(`LLM call attempt ${attempt} failed with error, retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (await this.checkStopped()) throw new Error('Analysis stopped by user');
        }
      }
    }
    
    throw new Error(lastError);
  }

  async callSemanticScholar(data) {
    // Call handler directly and await result
    const response = await handleSemanticScholar(data);
    return response;
  }
  
  // Robust Semantic Scholar call with exponential backoff
  // Will retry for up to ~20 seconds before throwing a hard error
  async callSemanticScholarWithRetry(data, context = 'API call') {
    const maxTotalTime = 20000; // 20 seconds total
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 5s (capped)
    const getDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000);
    
    while (Date.now() - startTime < maxTotalTime) {
      attempt++;
      
      // Check if user stopped
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }
      
      // Add delay between requests to avoid hammering the API
      // First request has no delay, subsequent requests wait based on backoff
      if (attempt > 1) {
        const delay = getDelay(attempt - 2);
        DEBUG_BG.warn(`Semantic Scholar rate limited. Retry ${attempt}, waiting ${delay/1000}s... (${context})`);
        this.updateProgress(
          `Rate limited by Semantic Scholar...`,
          `Waiting ${delay/1000}s before retry ${attempt} (${context})`,
          null
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        // Check stop after delay
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
      }
      
      const response = await this.callSemanticScholar(data);
      
      if (response.success) {
        // If we had to retry, slow down future requests
        if (attempt > 1) {
          this.rateLimitDelay = Math.min((this.rateLimitDelay || 500) + 500, 3000);
          DEBUG_BG.log(`Rate limit recovered. Increasing delay between requests to ${this.rateLimitDelay}ms`);
        }
        return response;
      }
      
      lastError = response.error || 'Unknown Semantic Scholar error';
      
      // Check if it's a rate limit error
      const isRateLimit = lastError.includes('429') || lastError.includes('Too Many Requests');
      
      if (!isRateLimit) {
        // Non-rate-limit error, throw immediately
        throw new Error(`Semantic Scholar API error (${context}): ${lastError}`);
      }
      
      // Rate limit - continue retrying
    }
    
    // Exhausted all retries
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    throw new Error(`Semantic Scholar API failed after ${elapsed}s of retries (${context}): ${lastError}`);
  }
  
  // Add delay between Semantic Scholar calls to avoid rate limiting
  async throttledSemanticScholarCall(data, context = 'API call') {
    // Apply rate limit delay if we've been rate limited before
    if (this.rateLimitDelay && this.rateLimitDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      if (await this.checkStopped()) throw new Error('Analysis stopped by user');
    }
    
    return this.callSemanticScholarWithRetry(data, context);
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
      // Build current thread state for UI
      const threadSummary = this.expansionStack.map(t => ({
        theme: t.theme.substring(0, 60) + (t.theme.length > 60 ? '...' : ''),
        papers: t.papers.map(p => ({
          title: p.title,
          year: p.year
        }))
      }));
      
      // Also include completed threads
      const completedSummary = this.threads.map(t => ({
        theme: t.theme.substring(0, 60) + (t.theme.length > 60 ? '...' : ''),
        papers: t.papers.map(p => ({
          title: p.title,
          year: p.year
        })),
        completed: true
      }));
      
      this.progressCallback(message, detail, percent, [...threadSummary, ...completedSummary]);
    }
  }
}

// ThroughlineAnalyzer is now available in this service worker context
DEBUG_BG.log('ThroughlineAnalyzer class loaded');

// Global error handler to catch issues
self.addEventListener('error', (event) => {
  DEBUG_BG.error('=== SERVICE WORKER ERROR ===', event.error);
});