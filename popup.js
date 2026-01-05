// Load and display papers from Throughline

// Debug logging system
const DEBUG = {
  log: function(...args) {
    console.log(...args);
    this.addToDebugPanel('LOG', args);
  },
  error: function(...args) {
    console.error(...args);
    this.addToDebugPanel('ERROR', args);
  },
  warn: function(...args) {
    console.warn(...args);
    this.addToDebugPanel('WARN', args);
  },
  addToDebugPanel: function(level, args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    const timestamp = new Date().toLocaleTimeString();
    const color = level === 'ERROR' ? '#f48771' : level === 'WARN' ? '#dcdcaa' : '#d4d4d4';
    
    const logEntry = `<div style="margin-bottom: 4px;"><span style="color: #808080;">[${timestamp}]</span> <span style="color: ${color};">[${level}]</span> ${this.escapeHtml(message)}</div>`;
    
    const logsDiv = document.getElementById('debug-logs');
    if (logsDiv) {
      logsDiv.innerHTML += logEntry;
      logsDiv.scrollTop = logsDiv.scrollHeight;
    }
  },
  escapeHtml: function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

function loadPapers() {
  chrome.storage.local.get(['throughline', 'analysisResults'], (result) => {
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
      
      // Update trace button text
      const traceBtn = document.getElementById('trace-btn');
      if (result.analysisResults) {
        traceBtn.innerHTML = '<span>📊</span><span>View Results</span>';
        
        // Add restart button if it doesn't exist
        if (!document.getElementById('restart-analysis-btn')) {
          const restartBtn = document.createElement('button');
          restartBtn.id = 'restart-analysis-btn';
          restartBtn.className = 'trace-btn';
          restartBtn.style.marginTop = '8px';
          restartBtn.style.background = '#ef4444';
          restartBtn.innerHTML = '<span>🔄</span><span>Re-run Analysis</span>';
          restartBtn.addEventListener('click', restartAnalysis);
          footer.appendChild(restartBtn);
        }
      } else {
        traceBtn.innerHTML = '<span>🔍</span><span>Trace throughlines</span>';
        
        // Remove restart button if it exists
        const restartBtn = document.getElementById('restart-analysis-btn');
        if (restartBtn) {
          restartBtn.remove();
        }
      }
      
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
  
  // Restore previous screen if it was trace
  chrome.storage.local.get(['currentScreen', 'analysisResults', 'analysisProgress'], (result) => {
    if (result.currentScreen === 'trace') {
      document.getElementById('main-screen').classList.remove('active');
      document.getElementById('trace-screen').classList.add('active');
      
      // Show previous results if they exist
      if (result.analysisResults) {
        document.getElementById('progress').style.display = 'none';
        displayResults(result.analysisResults);
      } else if (result.analysisProgress && result.analysisProgress.percent < 100) {
        // Analysis in progress - start polling
        document.getElementById('progress').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        startProgressPolling();
      } else {
        // No results and no progress - show restart
        document.getElementById('progress-text').textContent = 'Start analysis to trace throughlines';
        document.getElementById('progress-detail').innerHTML = '<button id="restart-btn" style="margin-top: 12px; background: #6366f1; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Start Analysis</button>';
        
        setTimeout(() => {
          const restartBtn = document.getElementById('restart-btn');
          if (restartBtn) {
            restartBtn.addEventListener('click', () => runAnalysis());
          }
        }, 0);
      }
    }
  });
  
  document.getElementById('clear-all').addEventListener('click', clearAll);
  document.getElementById('trace-btn').addEventListener('click', showTraceScreen);
  document.getElementById('back-btn').addEventListener('click', showMainScreen);
  
  // Debug panel controls
  document.getElementById('debug-toggle').addEventListener('click', () => {
    const panel = document.getElementById('debug-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
  });
  
  document.getElementById('clear-debug').addEventListener('click', () => {
    document.getElementById('debug-logs').innerHTML = '';
    DEBUG.log('Debug logs cleared');
  });
  
  // Poll for background logs
  startDebugLogPolling();
});

// Screen switching
function downloadDebugTree(tree) {
  if (!tree || tree.length === 0) {
    DEBUG.warn('No debug tree data to download');
    alert('No debug tree data available. Analysis may have failed before any operations were logged.');
    return;
  }
  
  // Format as readable text
  let text = '=== THROUGHLINE ANALYSIS DEBUG TREE ===\n\n';
  
  tree.forEach((node, i) => {
    text += `\n[${i + 1}] ${node.type.toUpperCase()}: ${node.message}\n`;
    if (node.data) {
      if (node.data.stackDepth !== undefined) {
        text += `    Stack depth: ${node.data.stackDepth}\n`;
      }
      if (node.data.yearDistribution) {
        text += `    Year distribution: ${JSON.stringify(node.data.yearDistribution)}\n`;
      }
      if (node.data.afterMerge !== undefined) {
        text += `    After merge (dedup citing + recommended): ${node.data.afterMerge}\n`;
      }
      if (node.data.afterQualityFilter !== undefined) {
        text += `    After quality filter: ${node.data.afterQualityFilter}\n`;
      }
      if (node.data.afterYearFilter !== undefined) {
        text += `    Final count (after year filter): ${node.data.afterYearFilter}\n`;
      }
      // Handle new expansion stack format
      if (node.data.allThreads && node.data.allThreads.expansionStack) {
        text += `    === EXPANSION STACK (threads being built) ===\n`;
        node.data.allThreads.expansionStack.forEach((t, idx) => {
          const indent = '    ' + '  '.repeat(idx);
          text += `${indent}[${idx}] ${t.theme}\n`;
          if (t.papers && t.papers.length > 0) {
            t.papers.forEach((p, pidx) => {
              text += `${indent}  ${pidx + 1}. ${p}\n`;
            });
          }
          if (t.subThreads > 0) {
            text += `${indent}  (${t.subThreads} sub-threads)\n`;
          }
        });
        if (node.data.allThreads.completedThreads && node.data.allThreads.completedThreads.length > 0) {
          text += `    === COMPLETED THREADS ===\n`;
          node.data.allThreads.completedThreads.forEach((t, idx) => {
            text += `    Thread ${idx + 1}: ${t.theme}\n`;
            if (t.papers && t.papers.length > 0) {
              t.papers.forEach((p, pidx) => {
                text += `      ${pidx + 1}. ${p}\n`;
              });
            }
          });
        }
        text += `    === END THREADS ===\n`;
      }
      // Handle legacy format (array of threads)
      else if (node.data.allThreads && Array.isArray(node.data.allThreads) && node.data.allThreads.length > 0) {
        text += `    === ALL CURRENT THREADS ===\n`;
        node.data.allThreads.forEach((t, idx) => {
          text += `    Thread ${idx + 1}: ${t.theme}\n`;
          if (t.papers && t.papers.length > 0) {
            t.papers.forEach((p, pidx) => {
              text += `      ${pidx + 1}. ${p}\n`;
            });
          } else {
            text += `      (no papers yet)\n`;
          }
        });
        text += `    === END THREADS ===\n`;
      }
      if (node.data.top10) {
        text += `    Top 10 ranked:\n`;
        node.data.top10.forEach((p, j) => {
          text += `      ${j + 1}. [${p.year}] ${p.title} (${p.citations} cites)\n`;
          text += `         Authors: ${p.authors}\n`;
        });
      }
      // Sub-thread decision info
      if (node.data.decision) {
        text += `    Decision: ${node.data.decision}\n`;
        if (node.data.parentTheme) {
          text += `    Parent theme: ${node.data.parentTheme}\n`;
        }
        if (node.data.candidateTheme) {
          text += `    Candidate theme: ${node.data.candidateTheme}\n`;
        }
        if (node.data.seedPapers) {
          text += `    Seed papers: ${node.data.seedPapers.join(', ')}\n`;
        }
      }
      if (node.data.originalResponse) {
        text += `    === ORIGINAL LLM RESPONSE (PARSE FAILED) ===\n`;
        text += node.data.originalResponse + '\n';
        text += `    === END ORIGINAL ===\n`;
      }
      if (node.data.cleanedAttempt) {
        text += `    === CLEANED ATTEMPT ===\n`;
        text += node.data.cleanedAttempt + '\n';
        text += `    === END CLEANED ===\n`;
      }
      if (node.data.fullResponse) {
        text += `    === FULL LLM RESPONSE (PARSE FAILED) ===\n`;
        text += node.data.fullResponse + '\n';
        text += `    === END LLM RESPONSE ===\n`;
      }
      if (node.data.error) {
        text += `    Error: ${node.data.error}\n`;
      }
    }
  });
  
  DEBUG.log('Generated debug tree text, length:', text.length);
  
  // Download as text file
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'throughline-debug-tree.txt';
  a.click();
  URL.revokeObjectURL(url);
  
  DEBUG.log('Download triggered');
}

function showTraceScreen() {
  chrome.storage.local.get(['analysisResults'], async (result) => {
    // Switch to trace screen
    chrome.storage.local.set({ currentScreen: 'trace' });
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('trace-screen').classList.add('active');
    
    // If results exist, show them
    if (result.analysisResults) {
      document.getElementById('progress').style.display = 'none';
      displayResults(result.analysisResults);
      return;
    }

    // Otherwise start new analysis
    document.getElementById('progress').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('progress-bar').style.width = '0%';
    
    runAnalysis();
  });
}

function restartAnalysis() {
  DEBUG.log('Restarting analysis - clearing old results');
  
  // Clear results
  chrome.storage.local.set({ 
    analysisResults: null,
    analysisProgress: null,
    analysisError: null 
  }, () => {
    // Reload papers list to update buttons
    loadPapers();
    
    // Switch to trace screen and start
    showTraceScreen();
  });
}

function showMainScreen() {
  // Stop polling if active
  if (window.pollInterval) {
    clearInterval(window.pollInterval);
    window.pollInterval = null;
  }
  
  chrome.storage.local.set({ currentScreen: 'main' });
  document.getElementById('trace-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
}

// Run the analysis in background worker
async function runAnalysis() {
  DEBUG.log('=== POPUP: runAnalysis called ===');
  const progress = document.getElementById('progress');
  const results = document.getElementById('results');
  const notice = document.getElementById('analysis-notice');
  
  progress.style.display = 'block';
  results.style.display = 'none';
  if (notice) notice.style.display = 'none';

  try {
    const result = await chrome.storage.local.get(['throughline']);
    const papers = result.throughline || [];

    DEBUG.log('Papers to analyze:', papers.length);

    if (papers.length === 0) {
      document.getElementById('progress-text').textContent = 'No papers to analyze';
      return;
    }

    // Start analysis in background
    DEBUG.log('Sending startAnalysis message to background...');
    chrome.runtime.sendMessage({ action: 'startAnalysis', papers: papers }, (response) => {
      DEBUG.log('startAnalysis response:', response);
    });

    // Poll for progress updates
    DEBUG.log('Starting progress polling...');
    startProgressPolling();
    
    // Add stop button handler
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.onclick = () => {
        DEBUG.log('Stop button clicked');
        chrome.runtime.sendMessage({ action: 'stopAnalysis' }, (response) => {
          DEBUG.log('Stop response:', response);
        });
        stopBtn.disabled = true;
        stopBtn.textContent = '⏹ Stopping...';
        stopBtn.style.background = '#9ca3af';
      };
    }
  } catch (error) {
    progress.style.display = 'none';
    if (notice) notice.style.display = 'none';
    alert('Failed to start analysis: ' + error.message);
    DEBUG.error(error);
  }
}

// Poll for analysis status
function startProgressPolling() {
  DEBUG.log('Starting polling...');
  const pollInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getAnalysisStatus' }, (response) => {
      if (!response) {
        DEBUG.warn('No response from background');
        return;
      }

      // Update UI with progress
      if (response.progress) {
        document.getElementById('progress-text').textContent = response.progress.message;
        document.getElementById('progress-detail').textContent = response.progress.detail;
        document.getElementById('progress-bar').style.width = response.progress.percent + '%';
      }

      // Check if complete
      if (response.results) {
        DEBUG.log('Analysis complete! Results:', response.results.length, 'threads');
        clearInterval(pollInterval);
        document.getElementById('progress').style.display = 'none';
        displayResults(response.results);
      }

      // Check if error
      if (response.error) {
        DEBUG.error('Analysis error:', response.error);
        clearInterval(pollInterval);
        document.getElementById('progress').style.display = 'none';
        
        // Show error message with debug tree download option
        const results = document.getElementById('results');
        results.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div>
                <h3 style="font-size: 14px; color: #991b1b; margin: 0 0 8px 0;">⚠️ Analysis Failed</h3>
                <p style="font-size: 12px; color: #7f1d1d; margin: 0;">${response.error}</p>
              </div>
              <button id="debug-tree-btn" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap;">📊 Download Debug Tree</button>
            </div>
          </div>
        `;
        results.style.display = 'block';
        
        // Add debug tree download handler
        const debugTreeBtn = document.getElementById('debug-tree-btn');
        if (debugTreeBtn) {
          debugTreeBtn.addEventListener('click', () => {
            DEBUG.log('Debug tree button clicked (error state)');
            chrome.storage.local.get(['analysisDebugTree'], (result) => {
              DEBUG.log('Got analysisDebugTree from storage:', result.analysisDebugTree ? result.analysisDebugTree.length + ' nodes' : 'null/undefined');
              
              if (result.analysisDebugTree && result.analysisDebugTree.length > 0) {
                downloadDebugTree(result.analysisDebugTree);
              } else {
                alert('No debug tree data available. Analysis may have failed before any operations were logged.');
              }
            });
          });
        }
      }
    });
  }, 500); // Poll every 500ms

  // Store interval ID so we can clear it when navigating away
  window.pollInterval = pollInterval;
}

// Poll for background logs
function startDebugLogPolling() {
  setInterval(() => {
    chrome.storage.local.get(['debugLogs'], (result) => {
      if (result.debugLogs && result.debugLogs.length > 0) {
        result.debugLogs.forEach(log => {
          const color = log.level === 'ERROR' ? '#f48771' : log.level === 'WARN' ? '#dcdcaa' : '#4ec9b0';
          const logEntry = `<div style="margin-bottom: 4px;"><span style="color: #808080;">[${log.time}]</span> <span style="color: ${color};">[BG-${log.level}]</span> ${DEBUG.escapeHtml(log.message)}</div>`;
          const logsDiv = document.getElementById('debug-logs');
          if (logsDiv) {
            logsDiv.innerHTML += logEntry;
            logsDiv.scrollTop = logsDiv.scrollHeight;
          }
        });
        // Clear processed logs
        chrome.storage.local.set({ debugLogs: [] });
      }
    });
  }, 500);
}

// Load trace screen with papers
function loadTraceScreen() {
  // This function is no longer needed - analysis starts automatically
}

function displayResults(threads) {
  const results = document.getElementById('results');
  
  if (threads.length === 0) {
    results.innerHTML = '<p style="text-align: center; color: #666;">No threads found</p>';
    results.style.display = 'block';
    return;
  }

  results.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h3 style="font-size: 14px; color: #374151; margin: 0;">Found ${threads.length} thread${threads.length > 1 ? 's' : ''}</h3>
      <div style="display: flex; gap: 8px;">
        <button id="debug-tree-btn" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">📊 Download Debug Tree</button>
        <button id="rerun-btn" style="background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">🔄 Re-run Analysis</button>
      </div>
    </div>
  ` + threads.map(thread => `
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 12px;">
      <div style="font-weight: 600; margin-bottom: 8px;">${escapeHtml(thread.theme)}</div>
      <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
        From: ${escapeHtml(thread.spawnPaper.title)} (${thread.spawnYear})
      </div>
      ${thread.papers.map(p => `
        <div style="font-size: 12px; padding: 8px; background: #f9fafb; margin: 4px 0; border-radius: 4px;">
          <span style="background: #6366f1; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 6px;">${p.year}</span>
          ${escapeHtml(p.title)}
        </div>
      `).join('')}
      ${thread.subThreads.length > 0 ? `
        <div style="margin-top: 12px; padding-left: 12px; border-left: 2px solid #e5e7eb;">
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">SUB-THREADS</div>
          ${thread.subThreads.map(st => `
            <div style="font-size: 12px; margin-bottom: 8px;">
              <strong>${escapeHtml(st.theme)}</strong>
              ${st.papers.map(p => `
                <div style="padding: 4px 0; font-size: 11px;">
                  <span style="color: #6366f1;">${p.year}</span> ${escapeHtml(p.title)}
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
  
  results.style.display = 'block';
  
  // Add debug tree download handler
  const debugTreeBtn = document.getElementById('debug-tree-btn');
  if (debugTreeBtn) {
    debugTreeBtn.addEventListener('click', () => {
      DEBUG.log('Debug tree button clicked');
      chrome.storage.local.get(['analysisDebugTree'], (result) => {
        DEBUG.log('Got analysisDebugTree from storage:', result.analysisDebugTree ? result.analysisDebugTree.length + ' nodes' : 'null/undefined');
        downloadDebugTree(result.analysisDebugTree);
      });
    });
  } else {
    DEBUG.error('Could not find debug-tree-btn element');
  }
  
  // Add re-run button handler
  const rerunBtn = document.getElementById('rerun-btn');
  if (rerunBtn) {
    rerunBtn.addEventListener('click', restartAnalysis);
  }
}