// Background service worker for API calls
// This file provides Chrome extension integration, importing core logic from src/throughline-analyzer.js

console.log('=== BACKGROUND SERVICE WORKER LOADED ===');

import { ThroughlineAnalyzer } from './src/throughline-analyzer.js';

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
    // Use rate limiting
    const now = Date.now();
    const result = await chrome.storage.local.get(['lastSemanticScholarCall']);
    const lastCall = result.lastSemanticScholarCall || 0;
    const delay = 1000; // 1 req/sec for unauthorized
    
    if (now - lastCall < delay) {
      await new Promise(resolve => setTimeout(resolve, delay - (now - lastCall)));
    }
    
    await chrome.storage.local.set({ lastSemanticScholarCall: Date.now() });
    
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
    // Get API key from storage
    const result = await chrome.storage.local.get(['openRouterApiKey']);
    const apiKey = result.openRouterApiKey;

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
    const errorObj = { success: false, error: error.message };
    if (sendResponse) sendResponse(errorObj);
    return errorObj;
  }
}

async function handleStartAnalysis(papers) {
  DEBUG_BG.log('=== Starting analysis ===');
  DEBUG_BG.log('Papers to analyze:', papers.length);
  
  // Keep service worker alive during analysis
  const keepAliveInterval = setInterval(() => {
    DEBUG_BG.log('Keepalive ping');
  }, 20000);
  
  // Clear previous results
  await chrome.storage.local.set({ 
    analysisProgress: { message: 'Starting...', detail: 'Initializing analyzer', percent: 0 },
    analysisResults: null,
    analysisError: null,
    analysisShouldStop: false
  });

  let analyzer;
  
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['openRouterApiKey']);
    const apiKey = result.openRouterApiKey;
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }
    
    DEBUG_BG.log('Creating ThroughlineAnalyzer...');
    
    // Create analyzer with Chrome-specific configuration
    analyzer = new ThroughlineAnalyzer({
      openRouterApiKey: apiKey,
      maxThreads: 10,
      maxPapersPerThread: 20,
      logger: DEBUG_BG
    });
    
    // Override checkStopped to check Chrome storage
    analyzer.checkStopped = async function() {
      if (this.stopped) return true;
      const stopCheck = await chrome.storage.local.get(['analysisShouldStop']);
      if (stopCheck.analysisShouldStop) {
        this.stopped = true;
        DEBUG_BG.log('Analysis stopped by user');
        return true;
      }
      return false;
    };
    
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
      analysisDebugTree: analyzer.debugTree,
      analysisProgress: { message: 'Complete!', detail: `Found ${threads.length} threads`, percent: 100 }
    });
  } catch (error) {
    DEBUG_BG.error('=== Analysis failed ===', error.message);
    DEBUG_BG.error('Stack:', error.stack);
    
    // Save debug tree even on failure
    await chrome.storage.local.set({
      analysisError: error.message,
      analysisDebugTree: analyzer?.debugTree || [],
      analysisProgress: { message: 'Failed', detail: error.message, percent: 0 }
    });
  } finally {
    clearInterval(keepAliveInterval);
    DEBUG_BG.log('Analysis handler completed');
  }
}

DEBUG_BG.log('ThroughlineAnalyzer module loaded');

// Global error handler to catch issues
self.addEventListener('error', (event) => {
  DEBUG_BG.error('=== SERVICE WORKER ERROR ===', event.error);
});
