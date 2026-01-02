// Recursive thread analysis logic

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
    
    const totalSteps = seedPapers.length * 3; // Rough estimate
    let currentStep = 0;

    this.updateProgress('Starting analysis...', 'Extracting research themes from seed papers', 0);

    for (const seedPaper of seedPapers) {
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
    this.updateProgress(
      `Analyzing: ${seedPaper.title.substring(0, 60)}...`,
      'Extracting research themes with LLM',
      null
    );

    const themes = await this.extractThemes(seedPaper);

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
      
      if (thread.papers.length > 1 || thread.subThreads.length > 0) {
        this.threads.push(thread);
      }

      if (this.threads.length >= this.maxThreads) break;
    }
  }

  async expandThread(thread, startYear) {
    this.updateProgress(
      `Expanding: ${thread.theme.substring(0, 50)}...`,
      `Searching papers from ${startYear} → present`,
      null
    );

    let currentYear = startYear;
    const currentYearActual = new Date().getFullYear();

    while (currentYear < currentYearActual && thread.papers.length < this.maxPapersPerThread) {
      const lastPaper = thread.papers[thread.papers.length - 1];
      
      const relatedPapers = await this.findRelatedPapers(lastPaper, currentYear + 1);

      if (relatedPapers.length === 0) break;

      const rankedPapers = await this.rankPapers(relatedPapers, thread.theme);

      this.updateProgress(
        `Ranking ${relatedPapers.length} papers...`,
        'Using LLM to rank relevance to thread',
        null
      );

      for (const paper of rankedPapers.slice(0, 3)) {
        const paperId = paper.paperId || paper.title;
        if (this.processedPapers.has(paperId)) continue;

        thread.papers.push(paper);
        this.processedPapers.add(paperId);
        currentYear = paper.year;

        if (this.threads.length < this.maxThreads) {
          await this.checkForSubThreads(thread, paper);
        }
      }
    }
  }

  async checkForSubThreads(parentThread, paper) {
    this.updateProgress(
      `Checking for new themes...`,
      `Analyzing: ${paper.title.substring(0, 50)}...`,
      null
    );
    
    const themes = await this.extractThemes(paper);

    for (const theme of themes) {
      const isDifferent = await this.areThemesDifferent(parentThread.theme, theme.description);

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
      `Finding papers from ${minYear}+ using SPECTRE embeddings`,
      null
    );

    // Generate a paper ID if missing
    const paperId = seedPaper.paperId || this.generatePaperId(seedPaper.title);

    const response = await this.callSemanticScholar({
      url: 'https://api.semanticscholar.org/recommendations/v1/papers',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        positivePaperIds: [paperId],
        fields: 'paperId,title,abstract,year,authors,citationCount',
        limit: 100
      }
    });

    if (!response.success) return [];

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
      `${i + 1}. ${p.title} (${p.year})`
    ).join('\n');

    const prompt = `Rank these papers by relevance to: "${threadTheme}"

Papers:
${paperList}

Return ONLY a JSON array of indices: [1, 5, 3, ...]`;

    const response = await this.callLLM(prompt);

    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const indices = JSON.parse(cleaned);
      return indices.map(i => papers[i - 1]).filter(p => p);
    } catch (error) {
      return papers.sort((a, b) => b.citationCount - a.citationCount);
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
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'callOpenRouter',
        data: { messages: [{ role: 'user', content: prompt }] }
      }, (response) => {
        if (response.success) {
          resolve(response.data.choices[0].message.content);
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

window.ThroughlineAnalyzer = ThroughlineAnalyzer;
