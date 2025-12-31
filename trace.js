// Thread analysis logic

class ThroughlineAnalyzer {
  constructor() {
    this.threads = [];
    this.processedPapers = new Set();
    this.maxThreads = 10;
    this.maxPapersPerThread = 20;
    this.progressCallback = null;
  }

  async analyze(seedPapers, progressCallback) {
    this.progressCallback = progressCallback;
    this.threads = [];
    this.processedPapers = new Set();

    this.updateProgress('Initializing analysis...');

    // Process each seed paper
    for (const seedPaper of seedPapers) {
      await this.processSeedPaper(seedPaper);
    }

    // Sort threads by spawn year
    this.threads.sort((a, b) => a.spawnYear - b.spawnYear);

    return this.threads;
  }

  async processSeedPaper(seedPaper) {
    this.updateProgress(`Analyzing: ${seedPaper.title}`);

    // Extract research threads from seed paper
    const themes = await this.extractThemes(seedPaper);

    // Create initial threads for each theme
    for (const theme of themes) {
      const thread = {
        id: this.generateThreadId(),
        theme: theme.description,
        spawnYear: seedPaper.year,
        spawnPaper: {
          title: seedPaper.title,
          authors: seedPaper.authors,
          year: seedPaper.year,
          paperId: seedPaper.paperId
        },
        papers: [seedPaper],
        subThreads: []
      };

      await this.expandThread(thread, seedPaper.year);
      
      if (thread.papers.length > 1 || thread.subThreads.length > 0) {
        this.threads.push(thread);
      }

      if (this.threads.length >= this.maxThreads) {
        break;
      }
    }
  }

  async expandThread(thread, startYear) {
    this.updateProgress(`Expanding thread: ${thread.theme.substring(0, 50)}...`);

    let currentYear = startYear;
    const currentYearActual = new Date().getFullYear();

    while (currentYear < currentYearActual && thread.papers.length < this.maxPapersPerThread) {
      // Find papers from current year onwards
      const relatedPapers = await this.findRelatedPapers(
        thread.papers[thread.papers.length - 1],
        thread.theme,
        currentYear + 1
      );

      if (relatedPapers.length === 0) {
        break; // No more papers found
      }

      // Rank papers by relevance to thread
      const rankedPapers = await this.rankPapers(relatedPapers, thread.theme);

      // Add top papers to thread
      for (const paper of rankedPapers.slice(0, 3)) {
        if (this.processedPapers.has(paper.paperId)) {
          continue;
        }

        thread.papers.push(paper);
        this.processedPapers.add(paper.paperId);
        currentYear = paper.year;

        // Check if this paper spawns new sub-threads
        if (this.threads.length < this.maxThreads) {
          await this.checkForSubThreads(thread, paper);
        }
      }
    }
  }

  async checkForSubThreads(parentThread, paper) {
    const themes = await this.extractThemes(paper);

    for (const theme of themes) {
      // Check if this theme is different from parent thread
      const isDifferent = await this.areThemesDifferent(
        parentThread.theme,
        theme.description
      );

      if (isDifferent && this.threads.length < this.maxThreads) {
        const subThread = {
          id: this.generateThreadId(),
          theme: theme.description,
          spawnYear: paper.year,
          spawnPaper: {
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            paperId: paper.paperId
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
    const prompt = `Analyze this research paper and identify 2-3 distinct research threads or directions it explores.

Paper: ${paper.title}
Year: ${paper.year}
Authors: ${paper.authors.map(a => a.name).join(', ')}
Abstract: ${paper.abstract}

For each research thread, provide:
1. A concise description (1-2 sentences)
2. Key technical terms or concepts

Format your response as JSON:
[
  {
    "description": "thread description",
    "keywords": ["keyword1", "keyword2"]
  }
]

Respond ONLY with the JSON array, no other text.`;

    const response = await this.callLLM(prompt);
    
    try {
      const themes = JSON.parse(response);
      return themes.slice(0, 3); // Max 3 themes per paper
    } catch (error) {
      console.error('Failed to parse themes:', error);
      return [];
    }
  }

  async findRelatedPapers(seedPaper, theme, minYear) {
    this.updateProgress(`Searching papers from ${minYear}+...`);

    // Use Semantic Scholar SPECTRE recommendations
    const response = await this.callSemanticScholar({
      url: 'https://api.semanticscholar.org/recommendations/v1/papers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        positivePaperIds: [seedPaper.paperId],
        fields: 'paperId,title,abstract,year,authors,citationCount',
        limit: 100
      }
    });

    if (!response.success) {
      return [];
    }

    // Filter by year
    const papers = (response.data.recommendedPapers || [])
      .filter(p => p.year >= minYear)
      .map(p => ({
        paperId: p.paperId,
        title: p.title,
        abstract: p.abstract || '',
        year: p.year,
        authors: p.authors || [],
        citationCount: p.citationCount || 0
      }));

    return papers;
  }

  async rankPapers(papers, threadTheme) {
    if (papers.length === 0) return [];

    const paperList = papers.map((p, i) => 
      `${i + 1}. ${p.title} (${p.year}) - ${p.abstract.substring(0, 200)}...`
    ).join('\n\n');

    const prompt = `Given this research thread: "${threadTheme}"

Rank these papers by relevance to continuing this specific research direction. Consider:
- Conceptual similarity to the thread
- Building on similar methods/approaches
- Addressing related problems

Papers:
${paperList}

Return ONLY a JSON array of paper indices in order of relevance (most relevant first):
[1, 5, 3, ...]`;

    const response = await this.callLLM(prompt);

    try {
      const indices = JSON.parse(response);
      return indices.map(i => papers[i - 1]).filter(p => p);
    } catch (error) {
      console.error('Failed to parse rankings:', error);
      // Fallback: sort by citation count
      return papers.sort((a, b) => b.citationCount - a.citationCount);
    }
  }

  async areThemesDifferent(theme1, theme2) {
    const prompt = `Are these two research themes substantially different?

Theme 1: ${theme1}
Theme 2: ${theme2}

Respond with ONLY "yes" or "no".`;

    const response = await this.callLLM(prompt);
    return response.toLowerCase().includes('yes');
  }

  async callLLM(prompt) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'callOpenRouter',
        data: {
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        }
      }, (response) => {
        if (response.success) {
          const content = response.data.choices[0].message.content;
          resolve(content);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  async callSemanticScholar(data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'callSemanticScholar',
        data: data
      }, (response) => {
        resolve(response);
      });
    });
  }

  generateThreadId() {
    return 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  updateProgress(message) {
    if (this.progressCallback) {
      this.progressCallback(message);
    }
  }
}

// Make it available globally
window.ThroughlineAnalyzer = ThroughlineAnalyzer;
