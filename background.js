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
    chrome.storage.local.set({ analysisShouldStop: true }, () => {
      sendResponse({ success: true });
    });
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
    const progressCallback = (msg, detail, percent) => {
      DEBUG_BG.log('Progress:', msg, '|', detail, '|', percent + '%');
      chrome.storage.local.set({
        analysisProgress: { message: msg, detail: detail || '', percent: percent || 0 }
      });
    };

    DEBUG_BG.log('Starting analyzer.analyze()...');
    const threads = await analyzer.analyze(papers, progressCallback);
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

  async analyze(seedPapers, progressCallback) {
    this.progressCallback = progressCallback;
    this.threads = [];
    this.processedPapers = new Set();
    this.expansionStack = [];
    this.stopped = false;  // Reset stop flag
    
    const totalSteps = seedPapers.length * 3; // Rough estimate
    let currentStep = 0;

    this.updateProgress('Starting analysis...', 'Extracting research themes from seed papers', 0);

    for (const seedPaper of seedPapers) {
      // Check stop at start of each seed paper
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }
      
      currentStep++;
      await this.processSeedPaper(seedPaper);
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

  async processSeedPaper(seedPaper) {
    // Check stop before processing
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.updateProgress(
      `Analyzing: ${seedPaper.title.substring(0, 60)}...`,
      'Extracting research themes with LLM',
      null
    );

    const themes = await this.extractThemes(seedPaper);
    
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

      await this.expandThread(thread, thread.spawnYear);
      
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

  async expandThread(thread, startYear) {
    // Check if user requested stop
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    // Track this thread in expansion stack for debugging
    this.expansionStack.push(thread);
    
    try {
      this.updateProgress(
        `Expanding: ${thread.theme.substring(0, 50)}...`,
        `Searching papers from ${startYear} → present`,
        null
      );

      let currentYear = startYear;
      const currentYearActual = new Date().getFullYear();
      
      DEBUG_BG.log('expandThread - starting from year:', currentYear, 'to', currentYearActual);
      DEBUG_BG.log('Expansion stack depth:', this.expansionStack.length);
      
      this.addDebugNode('expand', `Expanding thread from ${startYear}: ${thread.theme}`, {
        spawnYear: thread.spawnYear,
        spawnPaper: thread.spawnPaper.title,
        stackDepth: this.expansionStack.length
      });

      while (currentYear < currentYearActual && thread.papers.length < this.maxPapersPerThread) {
        // Check stop at start of each iteration
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        const lastPaper = thread.papers[thread.papers.length - 1];
        
        // Search for papers from current year onwards (not strictly future)
        const relatedPapers = await this.findRelatedPapers(lastPaper, currentYear);
        
        // Check stop after API calls
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        DEBUG_BG.log('expandThread - got', relatedPapers.length, 'related papers');

        if (relatedPapers.length === 0) {
          // Try next year
          currentYear++;
          if (currentYear >= currentYearActual) break;
          continue;
        }

        const rankedPapers = await this.rankPapers(relatedPapers, thread.theme, lastPaper);
        
        // Check stop after LLM ranking
        if (await this.checkStopped()) {
          throw new Error('Analysis stopped by user');
        }
        
        DEBUG_BG.log('expandThread - ranked papers:', rankedPapers.length);

        this.updateProgress(
          `Ranking ${relatedPapers.length} papers...`,
          'Using LLM to rank relevance to thread',
          null
        );

        for (const paper of rankedPapers.slice(0, 3)) {
          const paperId = paper.paperId || paper.title;
          if (this.processedPapers.has(paperId)) {
            DEBUG_BG.log('Skipping already processed paper:', paper.title);
            this.addDebugNode('skip', `Already processed: ${paper.title}`, {
              year: paper.year,
              reason: 'duplicate'
            });
            continue;
          }

          DEBUG_BG.log('Adding paper to thread:', paper.title, paper.year);
          
          thread.papers.push(paper);
          this.processedPapers.add(paperId);
          currentYear = paper.year;
          
          // Build comprehensive thread state showing:
          // 1. The full expansion stack (threads currently being expanded, including parents)
          // 2. Completed threads in this.threads
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
          DEBUG_BG.log('Expansion stack (depth ' + this.expansionStack.length + '):');
          this.expansionStack.forEach((t, i) => {
            const indent = '  '.repeat(i);
            DEBUG_BG.log(indent + `[${i}] ${t.theme.substring(0, 60)}... (${t.papers.length} papers)`);
          });
          DEBUG_BG.log('Completed threads:', this.threads.length);
          
          this.addDebugNode('select', `Added "${paper.title}" to thread: ${thread.theme}`, {
            year: paper.year,
            authors: (paper.authors || []).slice(0, 3).map(a => a.name).join(', '),
            citations: paper.citationCount,
            threadSize: thread.papers.length,
            stackDepth: this.expansionStack.length,
            allThreads: allThreadsInfo
          });

          if (this.threads.length < this.maxThreads) {
            await this.checkForSubThreads(thread, paper);
            
            // Check stop after sub-thread processing
            if (await this.checkStopped()) {
              throw new Error('Analysis stopped by user');
            }
          }
        }
        
        // Move to next year
        currentYear++;
      }
      
      DEBUG_BG.log('expandThread complete - thread now has', thread.papers.length, 'papers');
    } finally {
      // Always pop from stack, even on error
      this.expansionStack.pop();
    }
  }

  async checkForSubThreads(parentThread, paper) {
    // Check stop before processing
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }
    
    this.updateProgress(
      `Checking for new themes...`,
      `Analyzing: ${paper.title.substring(0, 50)}...`,
      null
    );
    
    const themes = await this.extractThemes(paper);
    
    // Check stop after LLM call
    if (await this.checkStopped()) {
      throw new Error('Analysis stopped by user');
    }

    for (const theme of themes) {
      const isDifferent = await this.areThemesDifferent(parentThread.theme, theme.description);
      
      // Check stop after each comparison
      if (await this.checkStopped()) {
        throw new Error('Analysis stopped by user');
      }

      if (isDifferent && this.threads.length < this.maxThreads) {
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

        await this.expandThread(subThread, paper.year);

        if (subThread.papers.length > 1) {
          parentThread.subThreads.push(subThread);
        }
      }
    }
  }

  async extractThemes(paper) {
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

  async findRelatedPapers(seedPaper, minYear) {
    this.updateProgress(
      `Searching Semantic Scholar...`,
      `Finding papers from ${minYear}+ using citations + embeddings`,
      null
    );

    // Get the paper ID - search by title if we don't have a valid one
    let paperId = seedPaper.paperId;
    
    DEBUG_BG.log('findRelatedPapers - original paperId:', paperId);
    DEBUG_BG.log('findRelatedPapers - paper title:', seedPaper.title);

    // If no paperId or it's a hash, search by title to get real Semantic Scholar ID
    if (!paperId || paperId.length < 10) {
      // Check cache first
      if (this.paperIdCache.has(seedPaper.title)) {
        paperId = this.paperIdCache.get(seedPaper.title);
        DEBUG_BG.log('Using cached paperId:', paperId);
      } else {
        DEBUG_BG.log('paperId looks invalid, searching by title...');
        
        // Retry on rate limit
        let retries = 0;
        let searchResponse;
        while (retries < 3) {
          searchResponse = await this.callSemanticScholar({
            url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(seedPaper.title)}&fields=paperId&limit=1`,
            method: 'GET'
          });
          
          if (searchResponse.success) {
            break;
          }
          
          // If rate limited, wait longer
          retries++;
          if (retries < 3) {
            DEBUG_BG.warn(`Rate limited, waiting 2s before retry ${retries}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (searchResponse.success && searchResponse.data.data && searchResponse.data.data.length > 0) {
          paperId = searchResponse.data.data[0].paperId;
          this.paperIdCache.set(seedPaper.title, paperId); // Cache it
          DEBUG_BG.log('Found real paperId via search:', paperId);
        } else {
          DEBUG_BG.error('Could not find paper by title after retries');
          return [];
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
      
      const citationsResponse = await this.callSemanticScholar({
        url: `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations?fields=paperId,title,abstract,year,authors,citationCount&limit=100&offset=${offset}`,
        method: 'GET'
      });
      
      if (citationsResponse.success) {
        const batch = (citationsResponse.data.data || []).map(c => c.citingPaper).filter(p => p);
        allCitingPapers.push(...batch);
        DEBUG_BG.log(`Got ${batch.length} citing papers in batch ${batchIndex + 1}`);
        
        // If we got fewer than 100, we've reached the end
        if (batch.length < 100) {
          DEBUG_BG.log('Reached end of citations, stopping pagination');
          break;
        }
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        batchIndex++;
      } else {
        DEBUG_BG.warn(`Failed to fetch citation batch ${batchIndex + 1}, stopping...`);
        break;
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
    const recsResponse = await this.callSemanticScholar({
      url: 'https://api.semanticscholar.org/recommendations/v1/papers?fields=paperId,title,abstract,year,authors,citationCount&limit=100',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        positivePaperIds: [paperId]
      }
    });

    const recommendedPapers = recsResponse.success
      ? (recsResponse.data.recommendedPapers || [])
      : [];
    
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
    this.addDebugNode('search', `Found ${papers.length} papers (${allCitingPapers.length} citing + ${recommendedPapers.length} recommended) for "${seedPaper.title}"`, {
      seedYear: seedPaper.year,
      minYear: actualMinYear,
      afterMerge: allPapers.length,
      afterQualityFilter: qualityFiltered.length,
      afterYearFilter: papers.length,
      yearDistribution: qualityFilterYears
    });

    return papers;
  }

  async rankPapers(papers, threadTheme, seedPaper) {
    if (papers.length === 0) return [];

    DEBUG_BG.log('rankPapers - input:', papers.length, 'papers for theme:', threadTheme.substring(0, 50));

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
      DEBUG_BG.log('rankPapers - output:', ranked.length, 'ranked papers');
      
      // Track top 10 ranked papers
      const top10 = ranked.slice(0, 10).map(p => ({
        title: p.title,
        year: p.year,
        authors: (p.authors || []).slice(0, 2).map(a => a.name).join(', '),
        citations: p.citationCount
      }));
      
      this.addDebugNode('rank', `Ranked ${papers.length} papers for theme: ${threadTheme}`, {
        top10
      });
      
      return ranked;
    } catch (error) {
      DEBUG_BG.error('rankPapers - LLM response parse failed');
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
        DEBUG_BG.log('rankPapers - successfully recovered with LLM fix:', ranked.length, 'papers');
        
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
          }
        }
      } catch (error) {
        lastError = error.message;
        if (attempt < 3) {
          DEBUG_BG.warn(`LLM call attempt ${attempt} failed with error, retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
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
      this.progressCallback(message, detail, percent);
    }
  }
}

// ThroughlineAnalyzer is now available in this service worker context
DEBUG_BG.log('ThroughlineAnalyzer class loaded');

// Global error handler to catch issues
self.addEventListener('error', (event) => {
  DEBUG_BG.error('=== SERVICE WORKER ERROR ===', event.error);
});