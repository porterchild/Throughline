// Popup script for managing paper collection

function loadPapers() {
  chrome.storage.local.get(['throughline'], (result) => {
    const papers = result.throughline || [];
    const container = document.getElementById('papers-container');
    const footer = document.getElementById('footer');

    if (papers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h2>No papers yet</h2>
          <p>
            Visit <strong>app.researchrabbit.ai</strong><br>
            Switch to list view and click<br>
            "➕ Add to Throughline" on papers
          </p>
        </div>
      `;
      footer.style.display = 'none';
      return;
    }

    container.innerHTML = papers.map((paper, index) => `
      <div class="paper-card">
        <div class="paper-title">${escapeHtml(paper.title)}</div>
        <div class="paper-authors">${paper.authors.map(a => a.name).join(', ')}</div>
        <div class="paper-year">${paper.year}</div>
        ${paper.abstract ? `<div class="paper-abstract">${escapeHtml(paper.abstract)}</div>` : ''}
        <div class="paper-footer">
          <span>Added ${formatDate(paper.addedAt)}</span>
          <button class="remove-btn" data-index="${index}">Remove</button>
        </div>
      </div>
    `).join('');

    footer.style.display = 'flex';

    // Add remove button listeners
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        removePaper(index);
      });
    });
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
  if (confirm('Remove all papers from Throughline?')) {
    chrome.storage.local.set({ throughline: [] }, () => {
      loadPapers();
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadPapers();
  document.getElementById('clear-all').addEventListener('click', clearAll);
  document.getElementById('trace-btn').addEventListener('click', () => {
    window.location.href = 'trace.html';
  });
});
