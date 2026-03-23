# Throughline

Transcend traditional citation networks and keyword searches as the main ways to navigate the academic literature. Given your research interests, an LLM agent explores the literature and organizes findings into coherent research tracks. 

Uses the Semantic Scholar API.

## What It Does

Traditional citation tools miss research lineages when there's no direct citation path — different terminology, different communities, same underlying ideas. Throughline uses an LLM agent to explore the literature and organize findings into coherent research tracks.

**Important: General-Purpose Design Philosophy**

Throughline is designed to work across ALL academic fields - biology, physics, mathematics, computer science, etc. The tool derives ALL exploration context from the seed paper(s) themselves. There is NO domain-specific hardcoding. If you see suggestions to add field-specific keywords, filters, or heuristics, they miss the point. The only domain knowledge comes from what the LLM can infer from the seed paper's abstract, title, and authors. Everything else is "cheating" that breaks generality.

**Why LLM-guided, not code-driven exploration?**

The tool is LLM-based instead of code-based because of the flexibility required. Author/lab lineage happens to be a good proxy for tracking SOTA in fields with weak benchmarks, but it's just one of many threads a researcher might want to follow. In another subfield, there might be strong benchmarks, and the obvious emphasis should be following the progression of the SOTA that way. In another case, the user might not care about SOTA at all — they might want the history of usage of a canonical dataset, or GPU models used in training, or where researchers procured C. Elegans from over time, or the list of physics papers over a citation count with more than 400 words in the abstract. There are countless threads one might want to follow. LLMs have the flexibility to guide the search however the user wants, making structural hardcoding of any single exploration strategy the wrong approach.

**Prompt-Space Constraints**

- Avoid programmatic hardcoding of exploration control flow, filtering logic, or paper/track inclusion logic.
- Prefer changing behavior in prompt space before introducing new code-path heuristics.
- Keep prompts general across research domains (not tuned only for AI/robotics).
- Keep prompts general across user preference styles (lab lineage, method lineage, benchmarks, datasets, timelines, etc.).

## Architecture

### Agent with Tools

A single LLM agent (Grok 4.1 Fast via OpenRouter) drives the entire exploration. It has access to Semantic Scholar API tools:

**Discovery**
- `search_papers` — keyword search
- `get_paper_citations` — forward citations (who cites this paper)
- `get_paper_references` — backward references (what this paper cites)
- `get_recommendations` — similar papers via SS recommendation engine
- `get_author_papers` — author lookup and their publications

**Track management**
- `create_track` — organize findings into research threads
- `add_paper_to_track` — add a discovered paper to a thread
- `view_tracks` — view current state of all tracks
- `rename_track` — rename a track as understanding improves
- `delete_track` — delete a track (papers returned to pool)
- `remove_papers_from_track` — remove papers from a track

**Housekeeping**
- `done` — signal exploration is complete

Every tool call includes a mandatory `rationale` field, logged to the console, making the agent's exploration strategy legible in real time.

The agent gets the seed paper(s) and the user's research criteria, then decides its own exploration strategy — what to search for, what citations to chase, which authors to look up, and how to organize findings into tracks.

### Context Management: Reader Model

Raw SS API results (50+ papers per call) would quickly bloat the main agent's context window, degrading coherence over many iterations. To solve this, each SS API tool call passes its raw results through a **reader model** before returning to the main agent.

The main agent provides a `focus` string with each tool call describing what it's looking for. The reader model gets:
- The raw paper list from the API
- The user's research criteria
- The main agent's specific focus for this call

The reader returns only the papers it judges relevant, with brief explanations. The main agent never sees the raw dumps — it gets curated, focused results that keep its context clean.

### Context Management Options Considered

Based on research into how ChatGPT, Claude Code, Codex, Perplexity, and agent frameworks handle context bloat:

**1. Reader model on tool results (implemented)** — Every SS API call goes through a reader LLM that filters raw results based on the main agent's focus instructions. Like Claude Code's WebFetch using Haiku to process raw HTML before the main agent sees it. Keeps main context clean without losing data.

**2. Subagent delegation** — Give the main agent an `explore` tool that spawns a subagent with its own context window and SS API tools. The subagent makes as many API calls as needed, then returns a distilled report. Main agent decides when to delegate vs use direct tools. Most flexible but adds complexity.

**3. Two-tier (scout + commander)** — Main agent only has `explore`, `create_track`, `add_paper_to_track`, and `done`. All discovery happens through scout subagents. Main agent is purely strategic. Cleanest context isolation but most structured.

**4. Tool result clearing** — Like Claude Code's approach: old tool results get stripped from history, agent can re-invoke if needed. Simple but risks the agent losing track of what it already explored.

**5. Constrained retrieval** — Like ChatGPT Search's sliding window: cap how much data any single tool call can return (~200 words per chunk). Simple but requires the agent to make many more calls.

**6. Track state injection** — Every 5 `add_paper_to_track` calls, the full current track state is injected as a structured message, keeping the agent oriented as context grows without relying on it to reconstruct state from history.

## Usage

### CLI

```bash
node main.js papers.json
```

Pipe to a log file to follow the run:
```bash
node main.js papers.json 2>&1 | tee run-agent.log
```

Criteria defaults are hardcoded in `main.js` for CLI runs.
To override criteria programmatically, call `analyzePapers` as a module:

```js
const { analyzePapers } = require('./main.js');
const results = await analyzePapers(papers, apiKey, {
  clusteringCriteria: "Your custom research criteria..."
});
```

### Configuration

Create a `.env` file:

```
OPENROUTER_API_KEY=your-key-here
SEMANTIC_SCHOLAR_API_KEY=your-key-here   # optional but strongly recommended
```

With a Semantic Scholar API key the tool uses a dedicated 1 RPS rate limit instead of the contested shared pool. Without it, expect heavy 429s on longer runs.

### Input Format

`papers.json`:

```json
[
  {
    "title": "Paper Title",
    "abstract": "Paper abstract...",
    "year": 2020,
    "authors": [{"name": "Author Name"}]
  }
]
```

### Output

Results are saved to `throughline-results.json` with research threads, papers, and selection reasoning. The run log (stdout) shows the agent's rationale for every tool call, reader filtering decisions, and track modifications in real time.


## Ideas:
Other ways to think about this: 'academia for engineers' (maybe a bit of a pigeonhole), 'meta-analysis on-demand'.
