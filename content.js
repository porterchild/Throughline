// ResearchRabbit LLM Helper - Content Script
console.log('ResearchRabbit LLM Helper loaded');

function findPaperElements() {
  // More robust: find draggable divs that contain paper structure
  // This looks for the semantic structure instead of generated class names
  const candidates = document.querySelectorAll('div[draggable="true"]');
  
  return Array.from(candidates).filter(div => {
    // Must have a title (h5 with reasonable length)
    const h5s = div.querySelectorAll('h5');
    const hasTitle = Array.from(h5s).some(h5 => h5.textContent.trim().length > 20);
    
    // Must have an abstract (paragraph with substantial text)
    const paragraphs = div.querySelectorAll('p');
    const hasAbstract = Array.from(paragraphs).some(p => p.textContent.trim().length > 100);
    
    return hasTitle && hasAbstract;
  });
}

function extractPaperData(paperElement) {
  // Find h5 elements - first short one is nickname, longer one is title
  const h5s = Array.from(paperElement.querySelectorAll('h5'));
  
  let nickname = '';
  let title = '';
  
  for (const h5 of h5s) {
    const text = h5.textContent.trim();
    if (text.length < 20 && !nickname) {
      nickname = text;
    } else if (text.length > 20 && !title) {
      title = text;
    }
  }
  
  // Find abstract - it's the longest paragraph
  const paragraphs = Array.from(paperElement.querySelectorAll('p'));
  let abstract = '';
  let maxLength = 0;
  
  for (const p of paragraphs) {
    const text = p.textContent.trim();
    if (text.length > maxLength) {
      maxLength = text.length;
      abstract = text;
    }
  }
  
  // Find journal - look for spans that are not the nickname
  const spans = Array.from(paperElement.querySelectorAll('span'));
  let journal = '';
  
  for (const span of spans) {
    const text = span.textContent.trim();
    // Skip if it matches nickname or is too short
    if (text && text !== nickname && text.length > 3 && text.length < 100) {
      journal = text;
      break;
    }
  }
  
  return { nickname, title, abstract, journal };
}

function addButtonsToPapers() {
  const papers = findPaperElements();
  
  papers.forEach(paper => {
    // Skip if we've already added a button
    if (paper.dataset.llmButtonAdded) return;
    paper.dataset.llmButtonAdded = 'true';
    
    const paperData = extractPaperData(paper);
    
    if (!paperData.title || !paperData.abstract) {
      console.log('Missing title or abstract, skipping');
      return;
    }
    
    // Create button
    const button = document.createElement('button');
    button.textContent = '➕ Add to Throughline';
    button.style.cssText = `
      margin: 8px 0;
      padding: 6px 12px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
    `;
    
    button.addEventListener('mouseover', () => {
      button.style.background = '#4f46e5';
    });
    
    button.addEventListener('mouseout', () => {
      button.style.background = '#6366f1';
    });
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Save to chrome storage
      chrome.storage.local.get(['throughline'], (result) => {
        const throughline = result.throughline || [];
        
        // Add paper if not already in throughline (check by title)
        const exists = throughline.some(p => p.title === paperData.title);
        if (!exists) {
          throughline.push({
            ...paperData,
            addedAt: new Date().toISOString()
          });
          
          chrome.storage.local.set({ throughline }, () => {
            console.log('Added to Throughline:', paperData.title);
            button.textContent = '✓ Added';
            button.style.background = '#10b981';
            
            setTimeout(() => {
              button.textContent = '➕ Add to Throughline';
              button.style.background = '#6366f1';
            }, 1500);
          });
        } else {
          button.textContent = '✓ Already added';
          setTimeout(() => {
            button.textContent = '➕ Add to Throughline';
          }, 1500);
        }
      });
    });
    
    // Find the best place to insert - look for a button element to insert before
    const buttons = paper.querySelectorAll('button');
    const mainDetailButton = Array.from(buttons).find(btn => {
      return btn.querySelector('h5'); // The main details button contains the h5s
    });
    
    if (mainDetailButton) {
      mainDetailButton.appendChild(button);
    }
  });
}

// Run on page load
addButtonsToPapers();

// Re-run when new papers are loaded (for scrolling/navigation)
const observer = new MutationObserver(() => {
  addButtonsToPapers();
});

// Observe the document body for changes (since we can't rely on stable class names)
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also re-run periodically as a fallback
setInterval(addButtonsToPapers, 2000);
