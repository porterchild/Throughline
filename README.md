# Throughline

A Chrome extension that uses LLMs to trace research lineages through time, finding spiritual successors, authors' latest work, and current SOTA papers that traditional citation networks miss.

## The Problem

ResearchRabbit shows "related" papers and citations, but this has fundamental limitations:

- **Citation graphs are naive**: A 2024 SOTA paper might not cite a 2018 paper because it's 4 iterations down the lineage
- **"Related" is fuzzy**: The obvious spiritual successor doesn't always appear
- **No temporal intelligence**: Can't trace "what are the authors working on now?"

## The Solution

Throughline adds three new ways to explore papers:

1. **Spiritual Successors** - Papers that continue the conceptual lineage even without direct citations
2. **Author's Latest in This Vein** - What the authors are working on now in this research direction
3. **Current SOTA** - What's considered state-of-the-art today for problems from older papers

### How It Works

1. **Select seed papers** from ResearchRabbit (1-3 papers typically)
2. **LLM extracts research threads** from each paper's abstract and content
3. **Recursive expansion**: For each thread:
   - Uses Semantic Scholar SPECTRE embeddings to find conceptually related papers
   - LLM ranks papers by relevance to the specific thread
   - Discovers new sub-threads that spawn from interesting papers
   - Continues until reaching current year (2024/2025)
4. **Timeline visualization** showing all threads in chronological order

## Installation

### 1. Get API Keys

**OpenRouter** (required):
- Sign up at [openrouter.ai](https://openrouter.ai)
- Get your API key from [openrouter.ai/keys](https://openrouter.ai/keys)
- Cost: ~$0.01-0.05 per seed paper analyzed

**Semantic Scholar** (optional):
- Unauthorized usage allowed at 1 request/second
- Optional: Get free API key at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api)

### 2. Install Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `throughline-extension` folder
6. Click the extension icon → "Options" → Enter your OpenRouter API key

## Usage

### Step 1: Collect Seed Papers

1. Go to [app.researchrabbit.ai](https://app.researchrabbit.ai)
2. Open any collection
3. Switch to **list view** (button with three horizontal lines)
4. Click "➕ Add to Throughline" on 1-3 papers you want to explore

### Step 2: Run Analysis

1. Click the Throughline extension icon in your browser
2. Review your seed papers
3. Click "🔍 Trace Throughlines"
4. Click "Run Analysis" (takes 1-5 minutes depending on number of seeds)

### Step 3: Explore Results

- **Threads** are sorted chronologically by when they first appeared
- Each thread shows:
  - Theme description
  - Spawning paper that started the thread
  - Papers in chronological order
  - Sub-threads that emerged from the main thread
- Papers include title, authors, year, and relevance to thread

## Technical Details

### Architecture

```
ResearchRabbit (content.js)
    ↓ scrape paper metadata
Chrome Storage
    ↓ seed papers
Trace Screen (trace.html/js)
    ↓ orchestrate analysis
Background Worker (background.js)
    ├→ OpenRouter API (LLM analysis)
    └→ Semantic Scholar API (paper discovery)
```

### Key Technologies

- **SPECTRE v2 embeddings** for semantic paper similarity
- **Grok 4.1 Fast** via OpenRouter for research thread extraction
- **Rate limiting**: 1 req/sec for Semantic Scholar, ~100ms for OpenRouter
- **Recursive expansion**: Each thread spawns sub-threads until current day

### Configuration

Edit these constants in `trace.js`:

```javascript
this.maxThreads = 10;          // Max total threads to explore
this.maxPapersPerThread = 20;  // Max papers per thread before stopping
```

In `background.js`:

```javascript
const SEMANTIC_SCHOLAR_DELAY = 1000;  // Rate limit (ms)
```

## Limitations

- **Rate limits**: Semantic Scholar unauthorized = 1 req/sec, so analysis takes time
- **API costs**: OpenRouter charges per token (~$0.01-0.05 per seed)
- **LLM accuracy**: Relevance rankings are heuristic, not perfect
- **Coverage**: Only finds papers in Semantic Scholar database

## Future Improvements

- [ ] Add caching to avoid re-analyzing same papers
- [ ] Support multiple LLM providers (Claude, GPT-4)
- [ ] Export results to CSV/JSON
- [ ] Interactive thread visualization with D3.js
- [ ] "Merge threads" when they converge
- [ ] Citation context analysis from full text

## Privacy

- All API calls go through background service worker
- No data sent to third parties except:
  - OpenRouter (for LLM inference)
  - Semantic Scholar (for paper discovery)
- Paper metadata stored locally in Chrome storage
- API keys stored locally, never transmitted except to respective services

## Contributing

Built with help from Claude 3.7 Sonnet. Contributions welcome!

## License

MIT - see LICENSE file

---

**Status**: MVP complete, actively being tested

**Author**: Built for researchers who need better tools to navigate the exponentially growing research landscape
