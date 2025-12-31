// Content script for ResearchRabbit integration

console.log('Throughline: Content script loaded');

// Track papers we've already added buttons to
const processedPapers = new Set();

// Observer to watch for new papers appearing in the DOM
const observer = new MutationObserver((mutations) => {
  addButtonsToPapers();
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Throughline: Initializing...');
  
  // Start observing for dynamic content
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial scan
  addButtonsToPapers();
}

function addButtonsToPapers() {
  // Look for paper items in list view
  // ResearchRabbit uses different selectors, this is a generic approach
  const paperElements = document.querySelectorAll('[class*="paper"], [class*="Paper"], [data-testid*="paper"]');
  
  paperElements.forEach(element => {
    // Skip if we've already processed this element
    if (processedPapers.has(element)) return;
    
    // Try to extract paper data
    const paperData = extractPaperData(element);
    if (!paperData) return;
    
    // Add button
    addThroughlineButton(element, paperData);
    processedPapers.add(element);
  });
}

function extractPaperData(element) {
  try {
    // Try to find title
    const titleEl = element.querySelector('[class*="title"], h3, h4, [class*="Title"]');
    if (!titleEl) return null;
    
    const title = titleEl.textContent.trim();
    if (!title) return null;

    // Try to find authors
    const authorEl = element.querySelector('[class*="author"], [class*="Author"]');
    const authorsText = authorEl ? authorEl.textContent.trim() : '';
    const authors = authorsText.split(/[,;]/).map(name => ({
      name: name.trim()
    })).filter(a => a.name);

    // Try to find year
    const yearEl = element.querySelector('[class*="year"], [class*="Year"], [class*="date"]');
    const yearText = yearEl ? yearEl.textContent.trim() : '';
    const yearMatch = yearText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

    // Try to find abstract
    const abstractEl = element.querySelector('[class*="abstract"], [class*="Abstract"], [class*="summary"]');
    const abstract = abstractEl ? abstractEl.textContent.trim() : '';

    // Try to find paper ID (could be in data attributes or URLs)
    let paperId = null;
    const linkEl = element.querySelector('a[href*="/paper/"]');
    if (linkEl) {
      const urlMatch = linkEl.href.match(/\/paper\/([a-f0-9]+)/);
      if (urlMatch) paperId = urlMatch[1];
    }

    return {
      title,
      authors: authors.length > 0 ? authors : [{ name: 'Unknown Author' }],
      year,
      abstract,
      paperId: paperId || generateFallbackId(title),
      addedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Throughline: Error extracting paper data:', error);
    return null;
  }
}

function generateFallbackId(title) {
  // Simple hash for papers without IDs
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

function addThroughlineButton(element, paperData) {
  // Create button
  const button = document.createElement('button');
  button.className = 'throughline-add-btn';
  button.innerHTML = '➕ Add to Throughline';
  button.title = 'Add this paper to Throughline for analysis';

  // Check if already added
  chrome.storage.local.get(['throughline'], (result) => {
    const papers = result.throughline || [];
    const isAdded = papers.some(p => p.paperId === paperData.paperId);
    
    if (isAdded) {
      button.innerHTML = '✓ In Throughline';
      button.classList.add('added');
      button.disabled = true;
    }
  });

  // Click handler
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addPaperToThroughline(paperData, button);
  });

  // Try to find a good place to insert the button
  const insertTarget = element.querySelector('[class*="actions"], [class*="buttons"]') || element;
  
  if (insertTarget === element) {
    insertTarget.appendChild(button);
  } else {
    insertTarget.insertBefore(button, insertTarget.firstChild);
  }
}

function addPaperToThroughline(paperData, button) {
  chrome.storage.local.get(['throughline'], (result) => {
    const papers = result.throughline || [];
    
    // Check if already exists
    if (papers.some(p => p.paperId === paperData.paperId)) {
      button.innerHTML = '✓ In Throughline';
      button.classList.add('added');
      button.disabled = true;
      return;
    }

    // Add to collection
    papers.push(paperData);
    chrome.storage.local.set({ throughline: papers }, () => {
      button.innerHTML = '✓ Added!';
      button.classList.add('added');
      
      setTimeout(() => {
        button.innerHTML = '✓ In Throughline';
        button.disabled = true;
      }, 1500);
      
      console.log('Throughline: Added paper:', paperData.title);
    });
  });
}
