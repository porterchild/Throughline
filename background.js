// Background service worker for API calls

const SEMANTIC_SCHOLAR_DELAY = 1000; // 1 request per second for unauthorized
const OPENROUTER_DELAY = 100; // Faster for paid API

let lastSemanticScholarCall = 0;
let lastOpenRouterCall = 0;

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callSemanticScholar') {
    handleSemanticScholar(request.data, sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'callOpenRouter') {
    handleOpenRouter(request.data, sendResponse);
    return true;
  }
});

async function handleSemanticScholar(data, sendResponse) {
  try {
    // Rate limiting
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
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const result = await response.json();
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Semantic Scholar API error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleOpenRouter(data, sendResponse) {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['openRouterKey']);
    const apiKey = result.openRouterKey;

    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please set it in extension options.');
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - lastOpenRouterCall;
    if (timeSinceLastCall < OPENROUTER_DELAY) {
      await sleep(OPENROUTER_DELAY - timeSinceLastCall);
    }
    lastOpenRouterCall = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/yourproject/throughline',
        'X-Title': 'Throughline Research Extension'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: data.messages,
        temperature: data.temperature || 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('OpenRouter API error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
