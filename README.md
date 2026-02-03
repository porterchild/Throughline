# Throughline

Trace research lineages through time using LLMs and semantic embeddings. Discover "spiritual successors" and same-lab work that traditional citation networks miss.

## What It Does

ResearchRabbit's "related papers" feature misses obvious research lineages when there's no direct citation path. For example, searching from ViNT (2023) might miss NoMaD, LeLaN, and OmniVLA - all obvious successors from the same lab.

Throughline solves this by combining:

- **Dual-strategy search**: Both citations API (direct descendants) + recommendations API (semantic similarity)
- **SPECTRE v2 embeddings** (Semantic Scholar) for semantic paper discovery
- **LLM-based ranking** (Grok 4.1 Fast via OpenRouter) with full abstracts, authors, and citation counts
- **Recursive expansion** from seed papers → current year
- **Sub-thread spawning** when papers diverge into new research directions

**Analysis runs in background** - close the popup anytime and check back later.

## Installation

1. Clone/download this repo
2. Chrome → `chrome://extensions/` → Enable "Developer mode"
3. Click "Load unpacked" → Select the extension folder
4. Right-click extension icon → Options → Add your OpenRouter API key

Get OpenRouter key: https://openrouter.ai/keys (free tier available)

## Usage

### Basic Workflow

1. Go to ResearchRabbit → **Switch to list view** (not canvas)
2. Click "➕ Add to Throughline" on 1-3 seed papers
3. Click extension icon → "🔍 Trace throughlines"
4. Click "Run Analysis" (takes 2-5 minutes)
5. View threads sorted chronologically

### Optional: Clustering Criteria (Why You Want This Analysis)

Throughline can cluster papers in different ways depending on **why** you're doing the analysis. Some users want lab/author lineages; others care about training scale, datasets, or architectural families. You can provide a short criteria statement that the LLM will use to define and separate research tracks.

- **If you provide criteria**: the LLM uses it as the primary clustering rule.
- **If you don't**: it defaults to lab/author lineage and shared architectural philosophy.

Examples of criteria statements:
- "Group by lab/author lineage, and separate each main architectural thread"
- "Group by training scale and data regime (small curated vs. web-scale)"
- "Group by methodological paradigm (symbolic, statistical, neural)"

For the standalone CLI:

```
THROUGHLINE_CLUSTERING_CRITERIA="Group by lab/author lineage, and separate each main architectural thread" node main.js papers.json
```

### During Analysis

- **Progress bar** shows current operation
- **Live thread display** shows threads being built in real-time
- **Stop button** (⏹) stops analysis gracefully and saves debug tree
- Analysis continues in background - safe to close popup

### After Analysis

- Click paper titles to open in Semantic Scholar
- **Download Debug Tree** to see decision-making process
- View all discovered threads and papers

## How It Works

### For Each Seed Paper:

1. **Theme Extraction**: LLM identifies 2-3 core research themes
2. **Thread Creation**: Each theme becomes a separate research thread
3. **Paper Discovery** (dual strategy):
   - Fetch papers that cite the seed (direct descendants)
   - Fetch semantically similar papers via SPECTRE embeddings
   - Merge and deduplicate (330+ candidates typical)
4. **Quality Filtering**:
   - Remove papers 3+ years old with <5 citations
   - Keep recent papers (≤2 years) regardless of citations
5. **LLM Ranking**:
   - Provide full abstracts, authors, citation counts
   - LLM ranks papers by relevance to thread theme
   - Helps identify same-lab work and conceptual connections
6. **Thread Expansion**:
   - LLM selects papers to add (same authors/lab = strongest signal)
   - Check if paper spawns new sub-threads
   - Recurse until reaching current year or thread exhausted
7. **Sub-thread Detection**:
   - LLM analyzes each paper for new research directions
   - Spawns sub-threads for significant divergences

### Example Thread Evolution:

```
Thread: Development of ViNT as a Transformer-based foundation...
  ├─ ViNT: A Foundation Model for Visual Navigation (2023)
  ├─ NoMaD: Goal Masked Diffusion Policies... (2023)
  │  └─ Sub-thread: Unified diffusion policy for goal-directed navigation...
  │     ├─ LeLaN: Learning A Language-Conditioned Navigation... (2024)
  │     └─ OmniVLA: An Omni-Modal Vision-Language-Action... (2025)
  └─ ...continues to 2026
```

## Understanding Results

### Thread Display

- **Theme**: LLM-generated description of research direction
- **Papers**: Chronological list with year, title, authors, citations
- **Sub-threads**: Indented threads showing research divergence
- **Links**: Click titles to open in Semantic Scholar

### Quality Indicators

- **Citation count**: Shows paper impact
- **Author overlap**: Helps identify same-lab work
- **Year progression**: Shows research evolution over time

### Debug Tree

Download the debug tree to see:
- Which papers were considered at each step
- How the LLM ranked candidates
- Why specific papers were selected
- All current threads at any point in time
- Search statistics (citing vs recommended papers)

Example debug tree entry:
```
[5] SELECT_DECISIONS: LLM selected 2 of 10 candidates
    LLM decisions:
      ✓ ADD: NoMaD: Goal Masked Diffusion Policies...
          Reason: Same authors (Shah), direct follow-up extending ViNT
      ✗ SKIP: Navigation with Large Language Models...
          Reason: Uses LLMs for planning, unrelated architecture
```

## Technical Details

### Search Strategy

1. **Citations API**: Papers that cite the seed (direct descendants)
2. **Recommendations API**: Semantically similar via SPECTRE v2
3. **Merge**: Deduplicate papers appearing in both
4. **Filter**: Quality filter removes old low-impact papers
5. **Rank**: LLM with full context selects most relevant

### Rate Limits

- Semantic Scholar: 1 req/sec (unauthorized API)
- OpenRouter: Depends on your tier
- Built-in retry logic for 429 errors

### Limits (Configurable)

- Max 10 threads per analysis
- Max 20 papers per thread
- Prompts ~150-500KB for ranking (large context windows)

### Error Handling

- **LLM parse errors**: Automatic self-correction retry
- **Rate limiting**: Exponential backoff up to 20s, then hard failure
- **Malformed responses**: Debug tree captures for analysis
- **Stop button**: Graceful termination with debug tree save

### Storage

- Uses Chrome local storage
- Papers stored with: title, authors, abstract, year, citations, paperId
- Debug tree saved for every analysis
- All data stored locally (no external sync)


## Development

### File Structure

```
throughline-extension/
├── manifest.json          # Extension config
├── background.js          # Core analysis logic (ThroughlineAnalyzer)
├── content.js            # ResearchRabbit page injection
├── popup.html/js         # Extension popup UI
├── config.html           # Options page for API key
└── README.md            # This file
```

### Key Classes

- `ThroughlineAnalyzer`: Main analysis engine
  - `analyze()`: Entry point
  - `processSeedPaper()`: Extract themes and start threads
  - `expandThread()`: Recursive thread expansion
  - `findRelatedPapers()`: Dual-strategy search
  - `rankPapers()`: LLM ranking with full context
  - `checkForSubThreads()`: Detect research divergence

### Debug Logging

Set `DEBUG_ENABLED = true` in background.js for verbose console logs.
