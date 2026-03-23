# Throughline Meta-Analysis

## Section 1: The Task

After each Throughline debug run, I (Claude) read the run log and maintain an organized knowledge base of the research landscape being explored. The goal is **not** to replicate what the agent does — it's to build a stable, cumulative map of the territory so I can give the user a well-contextualized narrative after every run:

- What path did the agent take through the landscape?
- What did it find? What did it miss?
- Were the misses structurally inevitable (no citation path), or were they bad choices?
- Did it get distracted into irrelevant sub-regions?
- How does this run compare to previous runs?

This lets us iterate faster on the agent's behavior with better signal — instead of reading thousands of lines of log, the user gets a paragraph summary grounded in a stable map.

The user's target: find ~75% overlap with a manually-compiled research survey on robotic visual navigation (see `expected_output.txt`). The 3 expected tracks are:
1. **Neural SLAM track** — Chaplot/Gupta lab (CMU): Active Neural SLAM → SemExp → GOAT
2. **Levine track** — Berkeley: GNM → ViNT → NoMaD → LeLaN → OmniVLA → MBRA
3. **PRIOR lab track** — PoliFormer → FLaRe → RING

---

## Section 2: My Approach

### Files
- `SKILL.md` — this file (task description + approach, keep updated)
- `landscape.md` — the cumulative knowledge base: labs, papers, themes, connections. Independent of any given run; an iteratively improved meta-analysis of the research
- `run-log.md` — per-run narrative summaries (append after each run)

### Landscape Structure
Organized by **research lab/group** since the user's criteria is explicitly about lab lineages. Each lab entry has:
- Key authors
- Papers (year, title, brief role in lineage)
- Themes / methodology
- Connections to other labs

Cross-cutting sections for themes that span labs and a connection map.

**landscape.md is strictly run-agnostic.** It is the territory, not a record of exploration. Never write anything in it about what the agent found or missed, which runs surfaced which papers, SS discoverability, cache hits, or any other run-specific observation. Those belong exclusively in run-log.md.

### After Each Run
1. **Read the whole log** — not just the adds. Read every `[Reader: selected]` and `[Reader: borderline]` section to understand what was surfaced and what was filtered. Read the rationales to understand the agent's strategy. The user cannot read thousands of lines; that is your job.
2. Extract newly surfaced papers + their authors/labs from both selected and borderline sections
3. Update `landscape.md` with any new labs, papers, or connections (run-agnostic facts only)
4. Write a narrative entry in `run-log.md`: path taken, finds, misses, root cause of misses, notable reader filtering decisions

### Logging Requirements
The log needs **authors** on every paper surfaced by the reader (to assign lab membership) and on `add_paper_to_track` lines. Currently only title+year+note are printed. See logging improvements in `src/throughline-analyzer.js`.
