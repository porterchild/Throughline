# Throughline Extension - Quick Start

## ✅ What's Built

Complete Chrome extension with:
- ✅ Paper collection from ResearchRabbit
- ✅ LLM-powered thread analysis
- ✅ Recursive expansion (2018+ pattern you requested)
- ✅ SPECTRE v2 embeddings for semantic search
- ✅ Grok 4.1 Fast for theme extraction
- ✅ Timeline visualization with sub-threads
- ✅ Rate limiting (1 req/sec Semantic Scholar)
- ✅ API key configuration page

## 📁 File Structure

```
throughline-extension/
├── manifest.json          # Extension config
├── background.js          # Service worker (API calls)
├── content.js            # Inject buttons on ResearchRabbit
├── content.css           # Button styles
├── popup.html/js         # Collection view
├── trace.html            # Thread analysis UI
├── trace.js              # Core analysis logic
├── config.html           # API key settings
├── icon*.png             # Extension icons
├── README.md             # Full documentation
└── LICENSE               # MIT license
```

## 🚀 Install Now

1. **Get OpenRouter key**: https://openrouter.ai/keys
2. **Load extension**:
   - Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `throughline-extension` folder
3. **Configure**:
   - Right-click extension icon → "Options"
   - Paste your OpenRouter API key
   - Save

## 🧪 Test It

1. Go to https://app.researchrabbit.ai
2. Open a collection, switch to list view
3. Click "➕ Add to Throughline" on 2-3 papers
4. Click extension icon → "🔍 Trace Throughlines"
5. Click "Run Analysis"
6. Watch the threads unfold!

## 🔧 Key Features Implemented

### Thread Extraction (trace.js)
```javascript
// Analyzes each seed paper
async processSeedPaper(seedPaper) {
  const themes = await this.extractThemes(seedPaper);
  // Creates threads for each research direction
  // Expands recursively from spawn year → current year
}
```

### Semantic Search (SPECTRE)
```javascript
// Uses embeddings, not keywords
await this.callSemanticScholar({
  url: 'https://api.semanticscholar.org/recommendations/v1/papers',
  body: {
    positivePaperIds: [seedPaper.paperId],
    fields: 'paperId,title,abstract,year,authors,citationCount',
    limit: 100
  }
});
```

### Recursive Expansion (Your Request!)
```javascript
// Each thread expands from spawn year forward
async expandThread(thread, startYear) {
  let currentYear = startYear;
  while (currentYear < 2025) {
    // Find papers from currentYear + 1
    const papers = await this.findRelatedPapers(thread, currentYear + 1);
    // Check for sub-threads
    await this.checkForSubThreads(thread, paper);
  }
}
```

### Sub-Thread Spawning
```javascript
// New themes spawn their own threads
async checkForSubThreads(parentThread, paper) {
  const themes = await this.extractThemes(paper);
  // Each unique theme becomes a sub-thread
  // Starts from paper.year → current year
}
```

## 📊 Expected Output

```
Thread 1: "Transformer-based 3D scene understanding"
  Spawned from: Attention is All You Need (2017)
  Papers:
    [2018] Point Cloud Transformers...
    [2020] PointBERT: Pre-training...
    [2022] Masked Autoencoders for 3D...
    [2024] Scalable 3D Scene Graphs...
  
  Sub-thread 1.1: "Self-supervised 3D learning"
    Spawned from: PointBERT (2020)
    Papers:
      [2021] Contrastive Learning for 3D...
      [2023] Foundation Models for 3D...
```

## ⚙️ Tuning Parameters

In `trace.js`:
```javascript
this.maxThreads = 10;          // Total threads before stopping
this.maxPapersPerThread = 20;  // Papers per thread
```

In `background.js`:
```javascript
const SEMANTIC_SCHOLAR_DELAY = 1000;  // Rate limit (ms)
const OPENROUTER_DELAY = 100;         // Can be faster
```

## 💡 Tips

- **Start with 2-3 seed papers** for fastest results
- **More seeds = more threads** = longer analysis
- **Watch the progress bar** - shows current step
- **Cost estimate**: ~$0.02-0.05 per seed paper
- **Time estimate**: ~2-5 minutes for 3 seeds

## 🐛 Common Issues

**"OpenRouter API key not configured"**
→ Right-click extension icon → Options → Add key

**"No papers appearing in trace"**
→ Make sure you're in list view on ResearchRabbit
→ Look for "➕ Add to Throughline" buttons

**"Analysis taking forever"**
→ Normal! 1 req/sec limit means it's methodical
→ Progress updates show it's working

**"Papers not relevant to thread"**
→ LLM is heuristic, not perfect
→ Try different seed papers
→ Adjust temperature in background.js if needed

## 🎯 Next Steps

Test it with your favorite papers and let me know:
- Are the threads making sense?
- Are sub-threads spawning appropriately?
- Is the UI clear?
- Any bugs or edge cases?

Ready to trace some throughlines! 🚀
