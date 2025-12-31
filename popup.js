// Load and display papers from Throughline
function loadPapers() {
  chrome.storage.local.get(['throughline'], (result) => {
    const papers = result.throughline || [];
    
    const emptyState = document.getElementById('empty-state');
    const papersList = document.getElementById('papers-list');
    const footer = document.getElementById('footer');
    
    if (papers.length === 0) {
      emptyState.style.display = 'block';
      papersList.style.display = 'none';
      footer.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      papersList.style.display = 'block';
      footer.style.display = 'block';
      
      // Sort by most recently added
      papers.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      
      papersList.innerHTML = papers.map((paper, index) => `
        <div class="paper-card">
          <div class="paper-nickname">${escapeHtml(paper.nickname || '')}</div>
          <div class="paper-title">${escapeHtml(paper.title)}</div>
          ${paper.journal ? `<div class="paper-journal">${escapeHtml(paper.journal)}</div>` : ''}
          <div class="paper-abstract">${escapeHtml(paper.abstract)}</div>
          <div class="paper-meta">
            <div class="paper-date">Added ${formatDate(paper.addedAt)}</div>
            <button class="remove-btn" data-index="${index}">Remove</button>
          </div>
        </div>
      `).join('');
      
      // Add remove button listeners
      document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          removePaper(index);
        });
      });
    }
  });
}

function removePaper(index) {
  chrome.storage.local.get(['throughline'], (result) => {
    const papers = result.throughline || [];
    papers.splice(index, 1);
    
    chrome.storage.local.set({ throughline: papers }, () => {
      loadPapers();
    });
  });
}

function clearAll() {
  if (confirm('Are you sure you want to remove all papers from Throughline?')) {
    chrome.storage.local.set({ throughline: [] }, () => {
      loadPapers();
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadPapers();
  
  document.getElementById('clear-all').addEventListener('click', clearAll);
  document.getElementById('trace-btn').addEventListener('click', showTraceScreen);
  document.getElementById('back-btn').addEventListener('click', showMainScreen);
});

// Screen switching
function showTraceScreen() {
  document.getElementById('main-screen').classList.remove('active');
  document.getElementById('trace-screen').classList.add('active');
  loadTraceScreen();
}

function showMainScreen() {
  document.getElementById('trace-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
}

// Load trace screen with papers
function loadTraceScreen() {
  chrome.storage.local.get(['throughline'], (result) => {
    const papers = result.throughline || [];
    const traceContent = document.getElementById('trace-content');
    
    if (papers.length === 0) {
      traceContent.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 40px 20px;">No papers in your Throughline yet.</p>';
      return;
    }
    
    // For now, just show the paper names
    traceContent.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 14px; color: #374151; margin-bottom: 8px; font-weight: 600;">
          Papers to trace (${papers.length})
        </h3>
      </div>
      ${papers.map(paper => `
        <div class="trace-paper">
          <div class="trace-paper-title">${escapeHtml(paper.title)}</div>
          <div class="trace-paper-author">${escapeHtml(paper.nickname || '')}</div>
        </div>
      `).join('')}
    `;
  });
}

