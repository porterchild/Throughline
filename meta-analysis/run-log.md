# Throughline Run Narratives

*Per-run narrative summaries. Score tracking and agent path analysis.*

| Run | Score | Notes |
|-----|-------|-------|
| 1 (no SS key, no search) | 2/13 | Fast, clean, found Cao/Garg/VLA tracks |
| 2 (no SS key, with search) | 3/13 | 38 min, heavy 429s, found OmniVLA once |
| 3 (SS key, with search) | 2/13 | 527s, agent quit at 4 iter |
| 4 (SS key, deeper criteria) | 2/13 | 492s, 6 tracks, still no Levine/PRIOR |
| 5 (minIterations=20) | 1-2/13 | 875s, 9 iter, 7 tracks — Levine searched explicitly, still not found |
| 6 (rationale field) | 0/13 | 1020s, 20 iter forced — agent done at iter 5, coasted 10-20 with no tools |
| 7 (beefed up continuation prompt) | 3/13 | 860s — Active SLAM ✓, SemExp ✓, OmniVLA ✓; ag outdoor cluster discovered; still coasted iter 14-20 |
| 8 (primer + track management + state injection) | 2/13 | 1228s, 20 iter, 7 tracks — Active SLAM ✓, SemExp ✓; primer built; track proliferation; still no Levine/PRIOR |
| 9 (iteration count in continuation prompt) | 3/13 | 1392s, 20 iter, 9 tracks — Active SLAM ✓, SemExp ✓, ViNT ✓; GNM/NoMaD/LeLaN/OmniVLA FOUND by reader but NOT added; new failure mode: selective under-adding |
| 10 (citation count quality heuristic in criteria) | 3/13 | 1007s, ~20 iter, 4 tracks — Active SLAM ✓, SemExp ✓, Diff. Spatial Planning ✓; Edinburgh bio-robotics tangent; no Levine search; citation heuristic didn't help |
| 11 (done gate hard error + time histogram) | 2/13 | 1050s, 20 iter, 6 tracks — Active SLAM ✓, SemExp ✓; done blocked 8×; no passive resistance; Levine searched but not found; reader = 78% of time |
| 12 (Gemini Flash 3 swap) | 2/13 | 670s, 40 iter, 4 tracks — ViNT ✓, GNM ✓; **no done calls at all**; passive resistance fully gone; wrong exploration direction; Chaplot lineage abandoned; reader = 60% of time |
| 13 (batching + maxIter=100) | **5/13** | 790s, 22 iter, 5 tracks — ViNT ✓, NoMaD ✓, LeLaN ✓, OmniVLA ✓, MBRA ✓; **best run ever**; batching tripled SS calls (48 vs 15); still stopped at 22 iter; Chaplot track still absent |
| 14 (search_authors tool + minIter=40) | **5/13** | 2458s, 40 iter, 10 tracks — ViNT ✓, NoMaD ✓, LeLaN ✓, OmniVLA ✓, MBRA ✓; same score as run 13; search_authors adopted immediately; Chaplot SS data quality issue confirmed; diminishing returns after iter ~30 |
| 15–16 (bug fix iterations) | n/a | Interrupted early by Gemini thoughtSignature 400 error and 502 gateway errors; reader output token explosion discovered (reader was echoing full paper data per call instead of id+note) |
| **17** (reader fix + grok reader + thoughtSignature fix) | **6/13** | 2774.6s, 40 iter, 7 tracks — GNM ✓, ViNT ✓, NoMaD ✓, OmniVLA ✓, PoliFormer ✓, RING ✓; **new best**; PRIOR lab reached for first time; LeLaN+MBRA reader-surfaced but not track-added |

---

## Run 17 — 2026-04-01 (reader fix + grok reader + thoughtSignature fix)
**Duration**: 2774.6s | **Iterations**: ~40 | **Tracks**: 7 | **Papers**: 81
**Score**: 6/13 — GNM ✓, ViNT ✓, NoMaD ✓, OmniVLA ✓, PoliFormer ✓, RING ✓ — **new best**
**Model**: Agent: `google/gemini-3-flash-preview`, Reader: `x-ai/grok-4.1-fast`

### New Features Being Tested
- **Reader model**: switched from Gemini to `x-ai/grok-4.1-fast` with reasoning
- **Reader output schema**: reduced to `id` + `note` only (was echoing full paper data — ~17k tokens/call); expected ~90% reduction in reader output tokens
- **thoughtSignature fix**: Gemini 3 Flash Preview requires `thoughtSignature` field echoed back on every tool response message; missing it caused 400 "Corrupted thought signature" on tool calls; now preserved on both normal and error tool response paths
- **5xx retry delay**: increased from 3s to 15s for server errors
- **Token tracking**: agent and reader in/out/cached tokens now tracked in timing histogram
- **Post-run chat**: now runs via `callLLMWithTools` loop, giving agent full tool access for follow-up analysis

### Timing / Token Stats
```
Agent  LLM: 6,776,124 in (3,822,543 cached = 56%), 44,388 out
Reader LLM: 554,888 in (47,689 cached = 8.6%), 152,044 out
```
Reader output tokens (152k across ~40 iterations) are high but correct — post-fix, each call outputs only ids+notes. Pre-fix this would have been ~1.7M output tokens. Agent cache rate (56%) is solid; reader cache (8.6%) is low since reader prompt varies with each batch.

### Tracks Produced
| # | Theme | Papers |
|---|-------|--------|
| 0 | VLA Foundation Models (GNM→ViNT→NoMaD→OmniVLA lineage) | 22 |
| 1 | Outdoor context-aware VLM navigation | 9 |
| 2 | Agentic reasoning VLN (PoliFormer) | 14 |
| 3 | 3DGS scene representation + nav | 14 |
| 4 | Cross-embodiment generalization (RING) | 9 |
| 5 | Field robotics / high-performance outdoor | 4 |
| 6 | Navigation benchmarks | 5 |

### What It Found
- ✓ **GNM** — Track 0, via Dhruv Shah author lookup (id 145718344), surfaced early (~iter 4)
- ✓ **ViNT** — Track 0, same Shah author lookup
- ✓ **NoMaD** — Track 0, same Shah author lookup
- ✓ **OmniVLA** — Track 0, same Shah author lookup / VLA cluster
- ✓ **PoliFormer** — Track 2, via author papers lookup (id 1746610, Habitat-related author) → reader selected PoliFormer → agent added; then traced Kuo-Hao Zeng (PoliFormer lead author)
- ✓ **RING** — Track 4, surfaced alongside PoliFormer from Kuo-Hao Zeng's papers; added as cross-embodiment generalist

### PRIOR Lab First Contact
This is the first run to find PRIOR Lab papers. The path was indirect:
1. Agent queried author 1746610 (Habitat/ObjectNav related) → reader surfaced PoliFormer (63 cit.)
2. Agent added PoliFormer to "agentic reasoning" track and traced Kuo-Hao Zeng as lead author
3. Zeng's papers (or citations from PoliFormer) brought up RING alongside PoliFormer in the next reader batch
4. Reader included both PoliFormer and RING (the latter labeled "embodiment-agnostic visual object-goal navigation policy")
5. FLaRe appeared in the same batch as **borderline** (reader note: "mobile manipulation implies nav, adaptive policies") — not added

FLaRe missed because: reader classified it as borderline (mobile manipulation focus vs pure nav), agent didn't pick it up. The PRIOR lab connection was found via ObjectNav/Habitat authorship overlap, not a direct AllenAI search.

### What It Missed
- **LeLaN** — Reader selected it (line 265 of run log: "language-conditioned nav from in-the-wild videos, real-world trials") but agent did not add it to any track. Same selective under-adding failure mode as run 9.
- **MBRA** — Reader selected it (line 263: "Model-based reannotation for long-horizon visual nav indoor/outdoor") but agent did not add it to any track.
- **Active Neural SLAM, SemExp, GOAT** — Chaplot SS author API still returns only LLM papers; agent attempted author 2328602 again; same failure. Title search still not tried.
- **FLaRe** — Reader borderlined; not added.

### Regressions vs Run 14
Run 14 found LeLaN and MBRA (added to Track 6). This run found them via reader but failed to add them. Net: +GNM +PoliFormer +RING −LeLaN −MBRA. Overall score improved 5→6.

### New Discoveries (not in expected output)
- **3DGS cluster**: SplatSearch, IGL-Nav, HAMMER, DynaGSLAM, LagMemo, AnyLoc, YOPO-Nav — 14 papers tracing Gaussian Splatting as a nav representation
- **Cross-embodiment cluster**: GR00T N1 (NVIDIA, 596 cit.), CE-Nav, CeRLP, LAP, RDT2, ABot-M0 — cross-embodiment generalization as emerging theme
- **Outdoor nav cluster**: CoNVOI, Behav, VLM-GroNav, AnyTraverse, GeNIE, EZREAL, WildOS, Sem-NaVAE, CATNAV
- **Field robotics**: Perseverance Mars Rover autonomous nav (2026), Off-Road Nav via Implicit Neural Representation, DuLoc
- **Benchmarks**: HM3D-OVON, NaviTrace, TOPO-Bench, Can VFMs Navigate (real-world ViNT/NoMaD/GNM failure analysis)
- **AsyncVLA** (Berkeley/Shah lab, 2026) — naturally found as continuation of the Shah lineage

### Assessment
The reader schema fix was the right call. Grok-as-reader surfaced PoliFormer and RING with good rationales, enabling the first PRIOR lab contact. The 3DGS and cross-embodiment clusters are genuinely interesting new territory. Selective under-adding (LeLaN, MBRA found but not added) remains a persistent failure mode — the agent prefers to open new tracks over adding to existing ones.

---

## Run 14 — 2026-03-28 (search_authors tool + minIterations=40)
**Duration**: 2458.3s | **Iterations**: 40 | **Tracks**: 10 | **Papers**: 158
**Score**: 5/13 — ViNT ✓, NoMaD ✓, LeLaN ✓, OmniVLA ✓, MBRA ✓ (same as run 13)
**Model**: `google/gemini-3-flash-preview`

### New Features Being Tested
- `search_authors` tool added (dedicated `/author/search` endpoint)
- `get_author_papers` now requires `author_id` (no name fallback)
- `minIterations` raised from 20 to 40
- Improved tool descriptions with usage scenarios
- Tools encourage multi-angle querying for non-deterministic searches

### Timing Histogram
```
  Agent  LLM │████                │  459.8s 19% — 40 calls, avg 11.5s,  max 20.6s
  Reader LLM │███████████████     │ 1856.1s 76% — 100 calls, avg 18.6s, max 41.9s
  SS API     │█                   │  136.8s  6% — 144 calls, avg 0.95s, max 6.8s  (23 cache hits, 4 retries)
  Other/wait │░░░░░░░░░░░░░░░░░░░░│    5.6s  0%
```
Reader climbed from 68% (run 13) to 76% — 100 reader calls vs 22 in run 13, proportional to the 3× more SS calls per iteration from batching. Agent avg call time grew from 8.7s to 11.5s (longer context at 40 iterations). SS API calls: 144 vs 48 in run 13 (same iteration count but more calls per iteration due to batching + more iterations).

### Path Taken — Key Moments
**Iteration 1 (batched)**: Agent immediately used `search_authors("Devendra Singh Chaplot")` and `search_authors("Saurabh Gupta")` — the new tool was adopted in the first response. Got Chaplot ID 2328602 (papers:41, h-index:24).

**Iteration 2 (batched)**: `get_author_papers(2328602)` → only **4 papers returned** from the API: Plan-Seq-Learn (nav-relevant), AUTOSUMM, Mixtral, Mistral 7B. The reader correctly kept Plan-Seq-Learn and dropped the LLM papers. Active Neural SLAM and SemExp are missing. Also fetched Oier Mees (VLMaps) and Saurabh Gupta (name collision — returns plants/mycobacteria papers). Added OmniVLA, AsyncVLA, LeLaN early via Mees author lookup.

**Iteration 3**: OmniVLA already added. ViNT references fetched. NoMaD, LeLaN selected by reader.

**Iteration 7-8**: ViNT and NoMaD added to Track 2.

**Iterations 9-28**: Broad exploration. Agent used `search_authors` ~17 times across the run (Hang Yin, Wenxuan Guo, Karol Hausman, Pete Florence, Xuesu Xiao, Jeannette Bohg, Yulun Du, Dhruv Shah, Alex Kendall, Animesh Garg, Linxi Fan, Akshara Rai, Lerrel Pinto, Abhinav Gupta, and others). Created 10 thematic tracks covering world models, social navigation, zero-shot exploration, benchmarks, CoT reasoning, etc.

**Iterations 29-40**: Added LeLaN and MBRA to Track 6 (Internet-Scale Video). Diminishing returns — iterations 30-40 added no more target papers. Done blocked at 6, 17, 23, 34, 37, 39. Accepted at 40.

### What It Found
- ✓ **OmniVLA** — Iteration 3, Track 2, via Oier Mees author lookup / initial VLM references
- ✓ **ViNT** — Iteration 8, Track 2, via ViNT references
- ✓ **NoMaD** — Iteration 8, Track 2, via ViNT references
- ✓ **LeLaN** — Iteration 29, Track 6 (Learning from Observation / Internet Video)
- ✓ **MBRA** — Iteration 29, Track 6 (as "Learning to Drive Anywhere With Model-Based Reannotation")

### What It Missed
- **Active Neural SLAM, SemExp, GOAT** — Chaplot author lookup (ID 2328602) returned only 4 papers, all recent LLM/NLP work. His 2020 navigation papers (Active Neural SLAM, Neural Topo SLAM, SemExp) do not appear in the `/author/{id}/papers` endpoint. This is confirmed as an SS data quality issue: the metadata shows paperCount:41 but the papers API returns only 4. The agent also tried `search_papers("author:Devendra Singh Chaplot navigation 2024 2025")` but got an irrelevant LLM bias paper. Active Neural SLAM was mentioned in several reader summaries as a known-relevant paper but was never added to a track.
- **GNM** — Not found. Agent didn't follow ViNT's references deeply enough (ViNT references *were* fetched at iteration 8, which surfaced NoMaD, but GNM wasn't in that batch or wasn't selected).
- **PRIOR lab (PoliFormer, FLaRe, RING)** — No path found. No AllenAI searches.

### Chaplot SS Data Quality Issue (Confirmed)
Author ID 2328602 for Devendra Singh Chaplot shows `paperCount:41` in the info endpoint, but `/author/2328602/papers` returns only 4 papers. These 4 are all recent LLM/NLP papers from his Meta AI tenure (Plan-Seq-Learn, Mixtral, Mistral, AUTOSUMM). His 2020 navigation papers appear to be under a different author node or unlinked in SS's author disambiguation. This explains why every run that does a Chaplot author lookup gets only LLM papers.

**Workaround**: The agent should search by paper title: `search_papers("Active Neural SLAM Chaplot 2020")` or `search_papers("Learning to Explore using Active Neural SLAM")`. This would surface the paper directly and make it addable to a track. However, the user criteria emphasizes recent work and deprioritizes older papers, so the agent may not prioritize this search even if prompted.

### minIterations=40 Assessment — Neutral
The agent ran the full 40 iterations but found no new target papers after iteration 29. Iterations 30-40 produced redundant searches and wider exploration (social navigation, benchmarks, CoT reasoning) but no closer to the target papers. The bottleneck is not exploration depth — it's:
1. SS data quality (Chaplot papers unreachable via author lookup)
2. PRIOR lab structural disconnect (no citation path from seed or Shah lineage)
3. Agent prioritization (prefers high-citation recent VLM papers over 2020-era SLAM papers)

Going from minIterations=20 to 40 doubled exploration time (2458s vs 790s) but yielded the same score.

### Timing Notes
Reader LLM is 76% of total runtime. At 40 iterations with heavy batching (~2.5 reader calls per iteration), this is expected. Average reader call time dropped from 25.7s (run 13) to 18.6s — possibly shorter context in some calls.

Bug noticed: line 694 in `toolGetAuthorPapers` references `authorId` (undefined) instead of `author_id` (the parameter name). The bug is in the return object for the `author` field — the returned `author.authorId` would be `undefined`. This doesn't crash but produces a slightly incorrect API response to the agent (missing authorId in the author info). Low priority.

---

## Run 13 — 2026-03-26 (batching enabled + maxIterations=100)
**Duration**: 790s | **Iterations**: 22 | **Tracks**: 5 | **Papers**: 34
**Score**: 5/13 — ViNT ✓, NoMaD ✓, LeLaN ✓, OmniVLA ✓, MBRA ✓ — **best run ever**
**Model**: `google/gemini-3-flash-preview`

### New Features Being Tested
- System prompt updated to encourage batching independent tool calls per response
- `maxIterations` raised from 40 to 100

### Timing Histogram
```
  Agent  LLM │█████               │ 191.7s 24% — 22 calls, avg 8.7s,  max 16.2s
  Reader LLM │██████████████      │ 539.3s 68% — 21 calls, avg 25.7s, max 53.0s
  SS API     │██                  │  80.0s 10% — 48 calls, avg 1.7s,  max 7.2s  (6 cache hits, 5 retries)
  Other/wait │░░░░░░░░░░░░░░░░░░░░│ -21.0s -3% (timing bug: parallel SS calls overlap)
```
SS API calls tripled (48 vs 15 in run 12) from batching — same iteration count, 3x more exploration. Reader average dropped from 36.7s to 25.7s.

### Batching Assessment — EXCELLENT
The agent picked up batching immediately (iteration 1 had 4 parallel calls: search + get_citations + append_to_primer + create_track). By iteration 2 it was batching 5 tools simultaneously (get_author_papers for Shah AND Chaplot author lookup AND search AND create 2 tracks). This is a clear win — same iteration budget, far more coverage.

### Done Gate
Called `done` at iterations 6 and 18. Blocked both times (minIterations=20). Accepted at iteration 22. The maxIterations=100 change was irrelevant — the agent stopped at 22, only 2 past the minimum. Still wrapping up relatively quickly, but 5/13 beats all previous runs.

### Path Taken
**Iteration 1 (batched)**: Parallel search for "neural visual navigation VLM" + get_citations on seed + append_to_primer + create Track 0 (Neural Mapping). Reader on seed citations surfaced Hydra-Nav, POVNav, IGL-Nav, DynTopology. Reader on VLM search surfaced OmniVLA, CoNVOI, CATNAV, Lang2LTL.

**Iteration 2 (batched)**: Parallel: get_author_papers for Dhruv Shah (author found, 8 papers selected — ViNT, NoMaD, OmniVLA, AsyncVLA, LeLaN, MBRA, CAST, Mobility VLA) + Chaplot author lookup (404 on wrong ID) + RT-2 search + citations on VL-TGS. Created Tracks 1 (Generalist Foundation), 2 (VLM Reasoning), 3 (Outdoor).

**Iteration 3 (batched)**: Parallel: wrong Chaplot ID again + outdoor search + Hydra-Nav references (surfaced NavFoM, UniGoal, Nav-R1, OmniNav, BeliefMapNav). OmniVLA recommendations (surfaced AsyncVLA, OpenFrontier, SPAN-Nav, ImagiNav). Primer update.

**Iteration 4**: Added 12 papers to tracks in one shot: Dynamic Topology + UniGoal → Track 0; ViNT + NoMaD + OmniVLA + AsyncVLA → Track 1; Hydra-Nav + Mobility VLA + Nav-R1 → Track 2; VL-TGS + CoNVOI + POVNav + AnyTraverse → Track 3.

**Iterations 5-10**: Added more papers, created Track 4 (VPR/Seasonal). Explored VPR via "AnyLoc" search — found AnyLoc, SelaVPR, EffoVPR, DINO-Mix, UniLoc. ETH/Anymal searches returned 404s. Multiple outdoor terrain searches returned thin results (1-2 papers).

**Iterations 11-22**: VPR track populated (AnyLoc, SelaVPR, EffoVPR, DINO-Mix, UniLoc, VPR survey, RGB-Thermal VPR). Added LeLaN, CAST, LogoNav (MBRA), PolaRiS, NavFoM to Tracks 1-2. Done blocked at 6 and 18. Final done accepted at 22.

### What It Found
- ✓ **ViNT** (Track 1) — via Dhruv Shah author lookup at iteration 2
- ✓ **NoMaD** (Track 1) — via Dhruv Shah author lookup at iteration 2
- ✓ **LeLaN** (Track 1) — via Dhruv Shah author lookup at iteration 2
- ✓ **OmniVLA** (Track 1) — via Dhruv Shah + initial VLM search
- ✓ **MBRA** (Track 3, as "Learning to Drive Anywhere") — via Dhruv Shah author lookup

**Also found (not in expected, genuinely useful)**: AsyncVLA (2026), CAST (2025), Mobility VLA (2024), NavFoM (2025), PolaRiS (2025), AnyLoc (2023), CoNVOI (2024), POVNav (2025), UniGoal (2025)

### What It Missed
- **Entire Chaplot track** — no Active Neural SLAM, SemExp, GOAT. Agent tried 3 different Chaplot author IDs, all returned 404s or wrong people. Never fell back to searching by name.
- **GNM** — found in run 12 via ViNT references but not in this run. Agent didn't fetch ViNT's references this time.
- **PRIOR lab** — no search, no path.
- **Track proliferation avoided** — 5 tracks this time, all coherent.

### Key Insight: Author ID Problem
The agent looked up Chaplot by ID 3 times (IDs: 1450090332, 3267503, 2328602 in other runs) and got 404s or wrong people every time. This is structural — Chaplot's SS author ID is unreliable or changed. The agent's fallback should be to search by name when author lookup fails, which it sometimes does (e.g., `search_papers("Devendra Singh Chaplot semantic navigation")`), but didn't try here. Once it gets an error it moves on.

### Timing Bug
"Other/wait = -21s" is a timing artifact. SS calls that fire in parallel overlap in wall-clock time, so the sum of (agent + reader + SS) can exceed total time. Not a real issue but the histogram looks weird. Should probably just show SS as "wall time" rather than summed.

---

## Run 12 — 2026-03-26 (Gemini Flash 3 model swap)
**Duration**: 670.6s | **Iterations**: 40 | **Tracks**: 4 | **Papers**: 15
**Score**: 2/13 — ViNT ✓, GNM ✓
**Model**: `google/gemini-3-flash-preview` (both agent and reader, replaces grok-4.1-fast)

### New Features Being Tested
Model swap: `google/gemini-3-flash-preview` for both agent and reader. Hypothesis: Gemini is better at long-context coherence and less prone to passive resistance than grok-4.1-fast.

### Timing Histogram
```
  Agent  LLM │███████             │ 240.8s  36% — 40 calls, avg 6.0s,  max 34.3s
  Reader LLM │████████████        │ 403.9s  60% — 11 calls, avg 36.7s, max 84.2s
  SS API     │█                   │  25.4s   4% — 15 calls, avg 1.7s,  max 6.2s  (5 cache hits, 0 retries)
  Other/wait │░░░░░░░░░░░░░░░░░░░░│   0.5s   0%
```
Reader dropped from 78% to 60%, total time dropped from 1050s to 670s. Gemini made exactly one agent call per iteration (40 calls / 40 iterations). No SS 429 errors in this run.

### Passive Resistance Assessment — SOLVED
The agent called `done` exactly **zero times** across all 40 iterations. No coasting, no no-tool-call events. Every iteration produced a genuine tool call with a substantive rationale. This is a complete contrast to run 11 (done blocked 8×). The model swap to Gemini appears to have fully resolved the passive resistance problem.

### Path Taken
**Iterations 1-5**: Standard seed exploration. Iteration 1: seed citations → 6 papers surfaced including Hydra-Nav, POVNav, IGL-Nav. Iteration 5: seed references → Active Neural SLAM, Habitat, SPTM surfaced. **Critically, the agent never built a Chaplot/Neural SLAM track** — it treated the seed as context and immediately pivoted toward VLM/LLM navigation papers.

**Iterations 6-10**: Searched for LM-Nav, VLM-Nav, CLIP-Nav, VLN-CE. Most searches returned zero results (quoted title queries failing against SS index). Iteration 7: Chaplot author lookup → 404 error on wrong ID, then recovered with correct ID → returned mostly LLM papers, not nav. Iteration 10: "VLM for instruction following" search → 9 relevant papers surfaced including NavGPT (333 cit), NavCoT, A2Nav, AutoRT, NaVid.

**Iterations 11-17**: Agent identified NavGPT/NavCoT lineage and created Track 0 (VLM reasoning for nav). Added NavGPT (2023), NavGPT-2 (2024), NavCoT (2024), A2Nav (2023). Created Track 1 (VLA/Foundation Models), added AutoRT. Iteration 19: searched for ViNT/GNM/LM-Nav by name → found ViNT. Created Track 2 (Berkeley/Levine) at iteration 20.

**Iterations 21-32**: Built out Berkeley/Levine track. Got ViNT references → surfaced GNM, LM-Nav, ViKiNG, RECON, PaLM-E, RT-1. Added ViNT, LM-Nav, GNM, ViKiNG to Track 2. Added PaLM-E, RT-1 to Track 1. Searched for IGL-Nav citations → only 1 result (OpenFly). Searched for ConceptFusion/CLIP-Fields/VLM-Maps repeatedly (6+ attempts) — all failed or returned 0-2 results.

**Iterations 33-40**: Created Track 3 (VLMaps/semantic mapping) after finally finding VLMaps via "CLIP-based 3D maps" search. Added VLMaps, AVLMaps, VoxPoser. Added NaVid to Track 0. Searched for CoW/CLIP-on-Wheels/L3MVN ObjectNav lineage — found CoWs on Pasture (2022) and CLIP on Wheels (2022). Never added them to a track (run ended at iteration 40).

### Tracks Created
- **Track 0 — NavGPT/NavCoT** (5 papers): NavGPT (2023), NavGPT-2 (2024), NavCoT (2024), A2Nav (2023), NaVid (2024)
- **Track 1 — VLA/Foundation Models** (3 papers): AutoRT (2024), PaLM-E (2023), RT-1 (2022)
- **Track 2 — Berkeley/Levine** (4 papers): ViNT ✓ (2023), LM-Nav (2022), GNM ✓ (2022), ViKiNG (2022)
- **Track 3 — VLMaps/Semantic Mapping** (3 papers): VLMaps (2022), AVLMaps (2023), VoxPoser (2023)

### What It Found
- ✓ **ViNT** (Track 2) — found via explicit title search
- ✓ **GNM** (Track 2) — found via ViNT references
- Also found: LM-Nav, ViKiNG, RECON (not in expected but in landscape) via ViNT references

### What It Missed
- **Entire Chaplot track** — the agent saw Active Neural SLAM, SemExp, Chaplot's work in the seed references (iteration 5) but never built a track for them. It moved on immediately.
- **NoMaD, LeLaN, OmniVLA, MBRA** — never searched specifically for these.
- **RECON found, not added** — surfaced by reader when fetching ViNT references, not added to any track.
- **PRIOR lab** — no search.
- **GOAT** — no search.

### Root Cause Analysis
Gemini solved the passive resistance problem but introduced a new failure mode: **wrong exploration direction**. The agent latched onto high-citation VLM/LLM navigation papers (NavGPT: 333 cit, PaLM-E: 2463 cit, RT-1: ~2000 cit) which are impressive numbers but diverge from the lab-lineage-from-seed approach. The model seems to strongly weight citation count in deciding exploration relevance, leading it toward the "famous VLM papers" cluster rather than following the seed's lineage.

The Chaplot lineage was visible in iteration 5 (Active Neural SLAM, SemExp surfaced in references) but the agent treated these as historical context and didn't build a track. This suggests the agent's "importance heuristic" weights recent high-citation papers over older seed-lineage papers.

**Key pattern**: Gemini explores *breadth-first* toward high-impact recent work; grok explored *depth-first* from the seed but then got lazy. We need depth-first (follow the seed), not breadth-first (find the most famous papers in the area).

### What We Learned
- **Gemini**: No passive resistance. Runs all iterations. Explores proactively. But explores the wrong things (generic VLM-for-nav vs. seed-specific lineages).
- **Grok**: Gets lazy after ~5 iterations, needs constant prodding. When it does explore (run 9), it actually follows the seed lineage correctly and finds the right papers.
- **Net result**: Model swap solved passive resistance at the cost of exploration direction. Different failure mode, same score (2/13).

---

## Run 11 — 2026-03-26 (done gate hard error + timing histogram)
**Duration**: 1050s | **Iterations**: 20 | **Tracks**: 6 | **Papers**: 19
**Score**: 2/13 — Active Neural SLAM ✓, SemExp ✓

### New Features Being Tested
- `done` tool returns a hard error when called before `minIterations`: "Too early to stop. You are on iteration X but must complete at least 20 iterations (N more to go)."
- No-tool-calls path injects short error instead of verbose continuation prompt.
- Timing histogram at end of run (Agent LLM / Reader LLM / SS API breakdown).

### Timing Histogram (the big finding)
```
  Agent  LLM │████                │ 195.0s  19% — 21 calls, avg 9.3s,  max 27.8s
  Reader LLM │████████████████    │ 823.7s  78% — 23 calls, avg 35.8s, max 70.9s
  SS API     │█                   │  30.7s   3% — 26 calls, avg 1.2s,  max 6.2s  (18 cache, 2 retries)
  Other/wait │░░░░░░░░░░░░░░░░░░░░│   0.7s   0%
```
Reader is 78% of total runtime. Average reader call is 35.8s — because grok-4.1-fast with reasoning enabled on each call is slow. SS API is nearly free (3%). This is the primary optimization target.

### Done Gate Assessment
The hard error worked extremely well. The agent called `done` at iterations 6, 8, 11, 14, 16, 17, 18, 19 — blocked every time. Each time it received the error, it genuinely continued searching rather than going passive. Only 3 no-tool-calls (iterations 9, 12, 15), quickly redirected by the short error injection. **Passive resistance is solved.** The agent now actually explores through all 20 iterations.

### Path Taken
Standard seed citations/references/author lookups (Chaplot, Abhinav Gupta, Saurabh Gupta). Iterations 1-4 established CMU Track 0 and discovered 3DGS image-goal nav (Track 1), Hang Yin scene graph nav (Track 2), Cao feudal nav (Track 3).

Iterations 5-8: Deeper on scene graph citations (SG-Nav → massive 2026 cluster of scene graph zero-shot ObjectNav papers). Discovered Sivakumar ag robotics (Track 4) and Pushp mapless outdoor nav (Track 5).

Iterations 9-16: Done blocked at 8, 11, 14, 16. Agent searched "Berkeley lab neural visual embodied nav recent", "Stanford lab neural visual robotic nav", "NVIDIA/Isaac lab", "quadruped/legged SOTA real-world", "DeepMind/Google legged nav", "Boston Dynamics Spot". **All returned zero useful results.** The agent explicitly tried to find Berkeley/Levine but search queries were too generic — "Berkeley lab neural visual nav" doesn't surface Shah's papers.

Iterations 17-20: Backward references from seed (surfaced 2016-2019 precursor papers — DQN nav, Gibson, Habitat, SPTM). Confirmed circling. Agent accepted final done at iteration 20.

### What It Found
- ✓ **CMU Track 0** (6 papers): Active Neural SLAM ✓, SemExp ✓, Plan-Seq-Learn, SEAL, Semantic Visual Nav by Watching YouTube, Under-Canopy Ag
- ✓ **3DGS Track 1** (4 papers): IGL-Nav, YOPO-Nav, SplatSearch, Navigating the Wild
- ✓ **Hang Yin Scene Graph Track 2** (3 papers): SG-Nav, UniGoal, GC-VLN — new lab, LLM/scene-graph zero-shot nav
- ✓ **Cao Track 3** (1 paper): Feudal Networks (thin)
- ✓ **Sivakumar Ag Track 4** (3 papers): CropFollow++, WayFAST, WayFASTER
- ✓ **Pushp Mapless Track 5** (2 papers): POVNav, Visual-Geometry GP Nav

### What It Missed
- **Entire Levine track** — agent explicitly searched "Berkeley lab neural nav" multiple times but got no Shah papers back. The SS search index doesn't reliably surface lab-based keyword searches. Author-specific searches ("Dhruv Shah", "ViNT foundation model navigation") would work; lab-name searches don't.
- **GOAT** — still absent from Chaplot author results.
- **PRIOR lab** — no PRIOR/Allen Institute search attempted.

### Root Cause Analysis
The agent's done-blocking is no longer the bottleneck. The remaining miss is **search query specificity**: the agent knows Berkeley is relevant, tries to find it via "Berkeley lab neural nav" style queries, and fails. It has never encountered a Shah paper to anchor a more specific search. The primer could prime this if it contained the Berkeley B AIR entry from run 9 — but that entry was generated because run 9 happened to find a Shah paper first. It's still chicken-and-egg.

The structural fix: seed the primer (or system prompt) with "there is a well-known Berkeley/B AIR lab (Shah, Levine) working on foundation models for visual navigation — look for them" — but this is domain-specific priming, which conflicts with the general-purpose design constraint.

---

## Run 10 — 2026-03-25 (citation count quality heuristic)
**Duration**: 1007s | **Iterations**: ~20 | **Tracks**: 4 | **Papers**: 22
**Score**: 3/13 — Active Neural SLAM ✓, SemExp ✓, Differentiable Spatial Planning ✓ (bonus)

### New Features Being Tested
User criteria updated to direct the agent to use relative citation counts as a quality proxy ("consider papers older than a year with few citations as noise").

### Path Taken
Standard seed citation/reference/author lookups. Broader searches on visual navigation topics. Created 4 tracks: CMU Chaplot/Gupta (Track 0), Meta Habitat (Track 1), Edinburgh Webb/Mangan bio-robotics (Track 2), Weerakoon/Elnoor VLM outdoor (Track 3).

The Edinburgh bio-robotics track (insect mushroom body spiking networks for outdoor vegetation nav) is a genuinely novel discovery — real robots, outdoor vegetation, low-power neuromorphic approach. But it's an unusual tangent for this run and consumed exploration budget that run 9 spent on the Berkeley search.

Track 1 (Meta Habitat) is 10 papers deep including Habitat-Web, ZSON, THDA, PIRLNav, VLFM, ETPNav, Navigating to Objects, Mobility VLA — solid coverage of the Habitat ecosystem but heavy on non-target papers.

No search for Sergey Levine / Dhruv Shah at all. No ViNT, GNM, NoMaD, LeLaN, OmniVLA. The agent never directed exploration toward Berkeley.

The primer was actively built with useful content: benchmarks (Habitat/R2R-CE/AI2-THOR), CMU and Meta lab lineages, Edinburgh bio-robotics, sim2real insights, ETPNav VLN-CE topo planners. But again no Berkeley B AIR entry.

### What It Found
- ✓ **CMU Track 0**: Active Neural SLAM ✓, SemExp ✓, Differentiable Spatial Planning (bonus), Plan-Seq-Learn (bonus), Under-Canopy Ag, SEAL
- ✓ **Habitat Track 1**: Deep Habitat/Meta coverage — ZSON, Habitat-Web, HM3D-OVON, THDA, VLFM, FiLM-Nav, PIRLNav, ETPNav, Navigating to Objects, Mobility VLA
- ✓ **Edinburgh bio-robotics Track 2**: Spatio-temporal Mushroom Body Memory (2020), Neuromorphic sequence learning with event cam (2023), Investigating visual nav with insect MB models (2024) — **new, not in landscape**
- ✓ **Weerakoon/Elnoor Track 3**: VLM-Social-Nav, CoNVOI, VLM-GroNav (consistent)

### What It Missed
- **Entire Levine/Berkeley track** — no search directed there. Citation heuristic didn't serve as a forcing function toward high-impact Levine papers; the agent found plenty of other high-citation papers (Habitat ecosystem) and stopped there.
- **GOAT** — still absent.
- **PRIOR lab** — no search.

### Citation Heuristic Assessment
The instruction to use citations as a quality proxy had mixed effects. The agent correctly applied it when filtering noise, but it also added Edinburgh papers with very few citations (legitimately interesting niche work). The heuristic didn't steer the agent toward the Levine group — the agent would need to first discover those papers to notice their high citation counts.

### Key Insight
The run variance is high: run 9 found the Berkeley track; run 10 didn't, and instead found Edinburgh bio-robotics. The exploration path depends heavily on which searches fire early and what the reader surfaces. Without a structural mechanism forcing the agent toward specific lineages, performance is inconsistent. The agent's primer in run 9 contained a Berkeley B AIR entry; this run's primer doesn't — because the agent never found Berkeley papers to write about.

---

## Run 9 — 2026-03-25 (iteration count in continuation prompt)
**Duration**: 1392s | **Iterations**: 20 | **SS calls**: ~25 | **LLM calls**: ~49
**Score**: 3/13 — Active Neural SLAM ✓, SemExp ✓, ViNT ✓

### New Features Being Tested
Continuation prompt now tells the agent its current iteration and the minimum: "You're only on iteration X, you should at least go as deep as MIN_ITERATIONS iterations."

### Path Taken
Standard start: seed citations (cache hit), references. Author lookups on Chaplot, Saurabh Gupta. Broader searches. Tracks 0-4 created in iterations 1-3 (same pattern as run 8: Chaplot, Elnoor/Weerakoon, Tan/Wang, Garg, Cao).

**Iteration 4**: Agent called done. Got the new message: "You're only on iteration 4, you should at least go as deep as 20 iterations." Continued.

**Iteration 4 (continued)**: Searched "sergey levine robot visual navigation neural" — explicitly rationale'd as "Berkeley/Levine lab neural RL nav lineage for completeness." Reader selected OmniVLA, ViNT, Offline RL. Agent created **Track 5: Berkeley Shah/Levine**. Attempted to add OmniVLA (ID lookup may have failed). Then did a **Dhruv Shah author lookup** — reader returned **17 selected papers** including every Levine target: GNM ✓, ViNT ✓, NoMaD ✓, LeLaN ✓, OmniVLA ✓, plus ViKiNG, RECON, ViNG, LM-Nav, ExAug, Navigation with LLMs, Offline RL, AsyncVLA, SELFI.

**Iteration 5**: Primer updated with Berkeley B AIR lineage entry (Offline RL → ViNT → OmniVLA).

**Iteration 6**: No tool calls. Passive resistance.

**Iteration 7**: Added ViNT, LM-Nav, Offline RL to Track 5 — only 3 of the 17 selected papers.

**Iteration 8**: No tool calls.

**Iteration 9**: Agent called done again. "You're only on iteration 9, you should at least go as deep as 20 iterations." Continued.

**Iterations 10-20**: Various searches (Pieter Abbeel, Waymo outdoor, multi-robot). New tracks: Diffusion Policy nav, Aerial drone nav. Primer updated with gaps section.

### What It Found
- ✓ **CMU track**: Active Neural SLAM ✓, SemExp ✓, Plan-Seq-Learn (bonus)
- ✓ **Berkeley Track 5**: ViNT ✓ — first time a Levine paper made it into a final track
- ✓ **Cao, Garg, Elnoor/Weerakoon, NaVILA**: consistent with prior runs
- ✓ New tracks: Diffusion Policy nav, Aerial nav, Tan/Wang VLM social
- ✓ **Research primer** populated with Berkeley B AIR lineage entry

### What It Missed — And Why
**GNM, NoMaD, LeLaN, OmniVLA**: All four were **selected by the reader** from Shah author lookup. They were sitting in the agent's context window. The agent added 3 papers from that batch, then went passive (iteration 6 no-tool-calls, iteration 7 partial adds, iteration 8 no-tool-calls). It never came back to add the remaining 14 selected Shah papers. **This is not a discovery failure — it's a selective under-adding failure.** The papers were found; the agent just didn't process them all.

**MBRA**: Didn't appear in the Shah reader results (2025 paper, possibly not yet in SS or under a different query).

**GOAT**: Still absent from Chaplot author lookup results.

**PRIOR lab**: Never reached — no search toward Allen Institute.

### New Failure Mode: Selective Under-Adding
The iteration forcing is working: the agent now does the Berkeley search it was avoiding. But it only adds a handful of the papers the reader surfaces before passive resistance kicks in. The reader found the entire Levine lineage in one call; the agent picked 3 and stopped. The continuation prompt addresses the "won't search" problem but not the "won't add" problem.

The fix is probably to prompt the agent to process ALL papers from a reader response before moving on, or to inject the selected-but-not-added papers back into a subsequent continuation message.

### Comparison to Run 8
Run 8: 2/13, no Levine papers found at all.
Run 9: 3/13, Levine track created, ViNT added — but GNM/NoMaD/LeLaN/OmniVLA in hand and not added. The iteration count message successfully triggered the Berkeley search. It's doing the right work, just incompletely.

---

## Run 8 — 2026-03-23 (primer + track management + state injection)
**Duration**: 1228s | **Iterations**: 20 | **SS calls**: 25 (16 cache hits, 1 retry) | **LLM calls**: 49
**Score**: 2/13 — Active Neural SLAM ✓, SemExp ✓

### New Features Being Tested
- Research primer: agent maintains a living doc of concepts/terminology, injected into reader prompt
- Track management tools: rename_track, delete_track, remove_papers_from_track
- Track state injection: full track state injected as user message every 5 add_paper_to_track calls

### Path Taken
Standard Phase 1: seed citations (cached, 19 selected), seed references. Author lookups on Chaplot (cached) and Saurabh Gupta. Broader searches: "neural visual navigation robot real-world", "outdoor neural visual navigation traversability", "vision language model robot navigation outdoor real-world".

The agent actively built the primer in iterations 1-4, appending key concepts (image-goal nav, object-goal nav, topological SLAM, benchmarks) and then a section on distinct lab lineages (Chaplot-Gupta, Habitat/Meta). This is the first run where the primer was actually used.

Track creation in iterations 2-3: 6 tracks initially (Chaplot-Gupta, Habitat OVON-VLM, Cao-Johnson Feudal, Garg Topometric, Elnoor/Weerakoon VLM-Grounded, NaVILA Legged VLA). Track 1 was renamed mid-run. A 7th track (Legged Traversability-Aware Outdoor Navigation) was added in iteration 7 after exploration of ETH/Hutter-style legged outdoor papers.

Iterations 4-7: deep dives on Habitat benchmark (HM3D-OVON citations), Cao lab (YOPO-Nav citations), Elnoor/Weerakoon outdoor VLM papers, legged outdoor navigation. Searches for "ETH Zurich legged robot neural visual navigation outdoor" and "DPO vision language navigation robot" and "ANYmal ETH Zurich legged nav lab".

Iterations 8-14: Marco Hutter author lookup (ETH ANYmal), Stanford VLN search, Mapillary/Google search (no hits), Boston Dynamics Spot search. The agent confirmed it was "going in circles" repeatedly.

Iterations 15-20: more confirmation of circularity, no new discoveries. Called done at iteration 20 (minIterations threshold).

### What It Found
- ✓ **CMU track** (partial): Active Neural SLAM ✓, SemExp ✓, Plan-Seq-Learn ✓ (bonus, not a target), plus Under-Canopy Ag Nav and No-RL-No-Sim
- ✓ **Cao lab**: YOPO-Nav, FeudalNav (consistent across runs)
- ✓ **Garg lab**: TANGO, ObjectReact (consistent)
- ✓ **Elnoor/Weerakoon outdoor VLM**: VLM-GroNav, CoNVOI (new track, good real-world outdoor coverage)
- ✓ **Habitat OVON-VLM**: HM3D-OVON, FiLM-Nav, Hydra-Nav (new territory, benchmark-adjacent papers)
- ✓ **NaVILA**: one-paper track for legged VLA
- ✓ **Legged traversability**: Traversability-Aware Legged Nav, VERN (real-world outdoor, interesting but not targets)
- ✓ **Research primer built** — populated with key concepts and lab lineages; agent used append_to_primer twice

### What It Missed
- **GOAT** (Chaplot 2024) — Track 0 contains Active SLAM and SemExp but not GOAT. Chaplot moved to Meta AI post-2022; GOAT may not appear in Chaplot's SS author profile under the same ID as the seed-paper Chaplot.
- **Entire Levine/Berkeley track** (GNM, ViNT, NoMaD, LeLaN, OmniVLA, MBRA) — zero Levine papers found. The agent built a primer entry on Chaplot-Gupta lineage but never on Berkeley/Levine. Despite the primer, the agent never issued a search that would surface the Levine group.
- **PRIOR lab** (PoliFormer, FLaRe, RING) — no search ever reached PRIOR/Allen Institute territory.

### New Features Assessment
- **Primer**: Actively built, populated with real content. Reader injection promising in principle but didn't help this run because the agent's search strategy never targeted Levine — the reader never got a chance to apply the terminology bridge. The feature is working mechanically; the limiting factor is upstream (agent search choices).
- **Track management**: No rename/delete/remove calls were made beyond one rename. The agent created well-scoped tracks directly and didn't need to reorganize. The tools are available; the agent just didn't need them this run.
- **Track state injection**: Injection fired multiple times (at 5, 10, 15 adds). The passive resistance problem (no tool calls after deciding it's done) is somewhat reduced — the agent made tool calls through most iterations. However, final iterations (15-20) were still low-productivity.

### Root Cause of Score Regression vs. Run 7
Run 7 scored 3/13 (Active SLAM, SemExp, OmniVLA). Run 8 scored 2/13 (Active SLAM, SemExp). The regression is OmniVLA: run 7 found it via a broader author/search path that happened to surface Shah papers; run 8 never did a Shah author lookup or a "ViNT foundation model" style search. The 7-track structure caused the agent to distribute effort across legged outdoor, Habitat OVON, and VLM-outdoor tracks — all interesting but not targets — at the expense of depth on the Levine lineage.

### Key Structural Observation
The fundamental miss is consistent: **the agent never searches for Levine/Berkeley papers.** The primer describes Chaplot-Gupta lineage. If the primer also described the Berkeley foundation-model-for-nav lineage (GNM → ViNT → NoMaD → LeLaN → OmniVLA), and the system prompt told the agent to build out ALL lineages it knows about, there would be a forcing function to search for them. The primer is a vehicle for this — but the agent needs to write it first, which requires having encountered the lineage first, which requires a search. Chicken-and-egg.

---

## Run 7 — 2026-03-23 (beefed up continuation prompt)
**Duration**: 860s | **Iterations**: 20 | **SS calls**: 25 (16 cache hits, 2 retries) | **LLM calls**: 41
**Score**: 3/13 — Active Neural SLAM ✓, SemExp ✓, OmniVLA ✓

### Tool Calls Made
3x parallel (citations + 2 searches) → batch create_tracks + add_papers (iter 2) → Garg/Cao author lookups + Habitat search + NaVILA citations (iter 3) → Chaplot/Gupta author lookups + outdoor search + NaVILA refs (iter 4) → add CMU papers + done rejected (iter 5) → 4x searches (outdoor, 3DGS, CropFollow citations, Levine search) (iter 6) → 5x adds (outdoor ag cluster) + legged search + seed recs + Gasparino author (iter 7) → **no tool calls** (iter 8) → 4x searches (ANYmal, Spot, Levine author lookup, conf SOTA) + CropFollow recs (iter 9) → **no tool calls** (iter 10) → 3x (VTR, neural SLAM, 3DGS quad citations) (iter 11) → **no tool calls** (iter 12) → survey search (iter 13) → **no tool calls** (iter 14–20)

### Path Taken
Strong opening, good author coverage. In iter 3 the agent correctly looked up Chaplot and Cao. In iter 4 it found **Active Neural SLAM** and **SemExp** from the Chaplot author lookup — finally. **OmniVLA** had already appeared in iter 2 from the VLM search. Called done at iter 5 with 20 papers.

The new continuation prompt actually worked: the agent kept making meaningful tool calls through iter 13 instead of shutting down at iter 9 like last run. It found an entirely new outdoor cluster — UIUC/EarthSense agricultural navigation (Sivakumar, Gasparino) — and made targeted Levine author searches in iters 6 and 9. Levine lookup (author_id:145718344) returned 7 papers but none were added — likely ViNT/NoMaD/GNM returned but reader filtered them, or they appeared as manipulation not navigation. After iter 13 the agent went fully passive for 7 straight iterations.

### What It Found (3 tracks, 25 papers)
- ✓ **Track 0** (Neural topo/outdoor): seed, DGNav, YOPO, IGL, RoboHop, ObjectReact, TANGO, Memory Proxy Maps, FeudalNav, Active Neural SLAM ✓, NRNS, YouTube Semantic Nav, CropFollow, CropFollow++, WayFAST, CropNav, RowDetr, Navigating the Wild
- ✓ **Track 1** (VLM/VLA): NaVILA, OmniVLA ✓, ABot-N0
- ✓ **Track 2** (Habitat SOTA): ZSON, THDA, CLIP-Embodied, SemExp ✓, SEAL

### What It Missed
- **GOAT** — Chaplot author lookup ran and returned 5 papers, but GOAT wasn't among them. Either not in SS results for that author ID, or filtered by reader. Not in borderline either — genuinely absent from the Chaplot lookup results.
- **ViNT, NoMaD, GNM, MBRA** — The agent looked up Dhruv Shah (author_id:145718344) in iter 9 with focus "VLA OR VLM robot navigation real-world legged wheeled." The reader put **ViNT and NoMaD in borderline** with the assessments "vision-only not VLA/VLM" and "diffusion policies... neural nav evolution but not VLA/VLM." Correct assessment given the focus string — but the wrong focus string. GNM and MBRA didn't appear at all.
- **LeLaN** — Was **selected** (4th item) from the Dhruv Shah lookup. The agent received it in iter 9 results but made zero tool calls in iter 10. It had LeLaN in hand and didn't add it.
- **PRIOR lab** (PoliFormer, FLaRe, RING) — no directed search toward AllenAI/PRIOR at any point.

### Notable
- **ViNT/NoMaD filtering root cause confirmed**: the reader is working correctly — it correctly classified ViNT as "vision-only not VLA/VLM" given the agent's focus string. The problem is the focus string. When the agent frames an author lookup as "VLA OR VLM," it causes the reader to deprioritize papers that are "merely" foundation models for visual nav. The fix is either: (a) the agent uses a broader focus for author lookups ("any navigation papers"), or (b) the agent follows up by reading borderline sections (it currently can't see them).
- **LeLaN was in-hand and dropped**: the agent had LeLaN as a selected paper after iter 9 but went passive in iter 10. This is the passive-resistance problem manifesting again — even when the reader hands it relevant papers, the agent doesn't act if it's already decided it's done.
- **First run to find Active Neural SLAM and SemExp** — via Chaplot author lookup, consistently available. Earlier runs used name-based lookup and got different results; this run used the SS author ID pulled from paper results.
- **New outdoor ag cluster** (UIUC/EarthSense): CropFollow, CropFollow++, WayFAST, CropNav, RowDetr.
- **Track 0 overcollapsing**: Garg lab, Cao lab, CMU, and the outdoor ag cluster all ended up in one track — four distinct communities merged together.

---

## Run 6 — 2026-03-23 (rationale field added)
**Duration**: 1020s | **Iterations**: 20 | **SS calls**: 26 (8 cache hits, 4 retries) | **LLM calls**: 41
**Score**: 0/13 expected papers

### Tool Calls Made
4x parallel (citations+2 searches+recs) → batch create_tracks + add_papers (iter 2) → 5x author lookups (iter 3) → add_papers + 2x search(Levine/outdoor) (iter 4) → done rejected (iter 5) → 4x search/author (Pathak/legged/RT-X/Hutter) (iter 6) → add_papers + done rejected (iter 7) → 4x search (OpenX/Spot/RT-2/Hutter) (iter 8) → add_papers + done rejected (iter 9) → **no tool calls, iterations 10–14, 16–19** → done rejected (iter 15) → no tool calls (iter 20)

### Path Taken
Strong start: four parallel calls in iter 1, immediate track creation in iter 2. Good author coverage (Chaplot, Saurabh Gupta, Abhinav Gupta). By iter 5 — with 18 papers and 4 tracks — agent called `done`. Continued by minIterations. In iter 6 explicitly searched "Berkeley Levine Pathak Choset" and looked up Deepak Pathak — still no Levine papers surfaced. Added ETH Hutter legged papers and OpenVLA in iters 7-9, then called `done` twice more. From iteration 10 onward, agent went passive: no tool calls for 10 of the remaining 11 iterations, just generating advisory text summaries. The rationale field showed the agent's reasoning clearly — by iter 10 it had concluded exploration was complete and treated the continuation prompts as a human "chatting."

### What It Found (4 tracks, 25 papers)
- ✓ **Track 0** (Neural topo): seed + DGNav, YOPO, IGL-Nav, NRNS, HTSCN, TMFT (new Chinese labs)
- ✓ **Track 1** (Habitat/sim2real): ViNL, PIRLNav, OVRL-V2, ZSON, mapless nav, ViPlanner, IN-Sight, Traversability, ANYmal Parkour, Loco-Nav
- ✓ **Track 2** (VLM/VLA): NaVid, Behav, UrbanVLA, NavFoM, GroNav, PSL, SLIM, OpenVLA
- ✓ **Track 3** (3DGS): SplatSearch, YOPO, IGL

### What It Missed
- **All 13 expected papers** — zero overlap. No Active SLAM, no SemExp, no GOAT (despite Chaplot lookup), no Levine track, no PRIOR.
- GOAT absence is puzzling: Chaplot author lookup ran but didn't surface it.
- Levine track: searched "Berkeley Levine Pathak" and "end-to-end RL nav Levine" — nothing. Confirmed SS discoverability gap.

### Notable
- **Rationale field worked well**: agent's reasoning is now legible per tool call. Showed it considered itself done at iter 5 and genuinely stopped generating new hypotheses.
- **Passive resistance pattern**: agent found 11 ways to say "I'm done" without calling tools. minIterations forced 11 extra iterations of dead time and no new papers after iter 9.
- **New papers discovered**: NaVid, NavFoM (Embodied Navigation Foundation Model), SLIM, ANYmal Parkour, Fast Traversability (ETH Hutter), Loco-Nav, ViNL, PIRLNav, OVRL-V2, DGNav, HTSCN, TMFT, OpenVLA.

### Root Cause
The agent's exploration strategy converges too fast. It found papers from its initial 4 tool calls (citations, 2 searches, recs) and considered the territory mapped by iter 5. The continuation prompts read as "human chat" not "there is more to find." The fundamental problem: the agent has no way to know what it hasn't found, and once it has plausible tracks, it stops generating search hypotheses.

---

## Run 5 — 2026-03-23 (minIterations=20)
**Duration**: 875s | **Iterations**: 9 | **SS calls**: 24 (11 cache hits, 1 retry) | **LLM calls**: 32
**Score**: ~1-2/13 (Active SLAM confirmed; SemExp unclear)

### Tool Calls Made
3x search (iter 1) → 3x author lookup + 1x search (iter 2-3) → author(Cao) + author(Wang) + author(Liu) (iter 3-4) → search(outdoor VLM) (iter 4) → [done rejected at iter 5, continued] → 2x search(Levine/Berkeley) + 2x author lookup (iter 6-8) → no tool calls (iter 9, stopped)

### Path Taken
Started with 3 parallel searches in iteration 1 (more aggressive than previous runs). Found CMU/3DGS/Liu lab clusters by iteration 3. Cao, Wang, Liu author lookups in iteration 4. Agent signaled done at iteration 5 (16 papers) — rejected by minIterations. Continued with outdoor VLM searches, found Seneviratne lab (CoNVOI, Behav, VLM-GroNav) and Yi Du lab (VL-Nav). Then **explicitly searched for Levine/Berkeley** at iterations 6 and 8 — "embodied AI navigation Sergey Levine Chelsea Finn" and "Berkeley embodied navigation Levine Finn end-to-end visual robot". Did not find GNM/ViNT/NoMaD. Agent concluded "Berkeley/Levine/Finn not prominent in neural visual nav hits (RL embodied more manip)." Ended at iteration 9 by making no tool calls (bypassed minIterations).

### What It Found (7 tracks, 20 papers)
- ✓ CMU track (partial): Active SLAM, SEAL, Plan-Seq-Learn, Under-Canopy Ag
- ✓ Zhe Liu lab: Visuomotor RL, NeRF cognitive nav + 2 new 2025 papers
- ✓ 3DGS cluster: SplatSearch, YOPO-Nav, IGL-Nav, GaussNav (new)
- ✓ Cao lab: FeudalNav, Memory Proxy Maps
- ✓ Haitong Wang lab: NavFormer, X-Nav
- ✓ **Seneviratne outdoor VLM lab** (new): CoNVOI, Behav, VLM-GroNav
- ✓ **Yi Du neuro-symbolic lab** (new): VL-Nav

### What It Missed
- **Levine/Berkeley track** — explicitly searched, not found. SS search for these authors does not surface GNM/ViNT/NoMaD. Likely a genuine SS discoverability gap: these papers may not be indexed with those author names prominently, or SS ranking doesn't surface them for these queries.
- **GOAT** — still absent despite Chaplot author lookup.
- **SemExp** — unclear; may have been skipped as already-processed.
- **PRIOR lab** — not attempted.

### Notable
- minIterations worked to force 4 extra iterations and found 2 new labs (Seneviratne, Yi Du)
- Agent bypassed minIterations by making no tool calls at iteration 9 — needs fix
- Levine search failure is informative: the problem is likely SS indexing/ranking, not agent laziness

---

## Run 4 — 2026-03-23 (SS API key, deeper criteria)
**Duration**: 492s | **Iterations**: ~4 | **SS calls**: ~12 | **LLM calls**: ~16
**Score**: 2/13 expected papers (Active SLAM, SemExp)

### Tool Calls Made
Citations(seed) → References(seed) → search("robotic visual navigation end-to-end neural") → author(Saurabh Gupta) → author(Chaplot) → citations(Active SLAM) → citations(Habitat) → author(Cao) → search("vision language model navigation robot") → citations(SemExp)

### Path Taken
Started with seed citations/references (both cached). Did one generic search immediately — "robotic visual navigation end-to-end neural" — which surfaced VLA/3DGS papers but not Levine group. Then author lookups on Gupta and Chaplot (cached), Cao (cached). Second search "vision language model navigation robot" found more VLA papers. Went deeper into Habitat citations and SemExp citations for ObjectNav lineage.

### What It Found (6 tracks, 20 papers)
- ✓ **CMU track** (partial): Active SLAM, SemExp, SEAL, Exploration Policies, Plan-Seq-Learn, Under-Canopy Ag (still no GOAT)
- ✓ **Cao lab**: FeudalNav, YOPO-Nav, Memory Proxy Maps (consistent across all runs)
- ✓ **VLA cluster**: NaVILA, UrbanVLA, VAMOS
- ✓ **3DGS cluster**: SplatSearch, IGL-Nav, Forest end-to-end
- ✓ **Habitat/Meta platform**: surfaced as track anchor
- ✓ **Zhe Liu lab**: Visuomotor RL + NeRF cognitive nav

### What It Missed
- **Entire Levine/Berkeley track** — search queries were too generic. "robotic visual navigation end-to-end neural" and "vision language model navigation robot" don't hit GNM/ViNT/NoMaD. The right queries would be author-specific ("Dhruv Shah navigation", "Sergey Levine visual navigation") or paper-specific ("GNM goal conditioned", "ViNT foundation model navigation").
- **GOAT** — should appear in Chaplot author lookup. Possibly filtered out by reader, or not in SS results (Chaplot may have moved to other work at Meta AI after 2022).
- **PRIOR lab** — no search queries directed there at all.

### Root Cause
The agent's two search queries were broad and generic. With the deeper criteria, it explored more (6 tracks vs 4) but the search strategy didn't change. It gravitates toward the same Cao/CMU/VLA papers because those are what the seed's citation graph surfaces — then uses search to broaden into adjacent VLM/VLA territory rather than specifically hunting for Levine. The agent needs either: (a) a hint in the system prompt to look for the Berkeley/Levine foundation model navigation group, or (b) some mechanism to try author-specific searches when broad searches don't reveal new lineages.

---

## Run 3 — 2026-03-23 (SS API key, search enabled)
**Duration**: 527s | **Iterations**: 4 | **SS calls**: 12 (8 cache hits, 1 retry) | **LLM calls**: 16
**Score**: 2/13 expected papers

### Path Taken
The agent started at the seed (Chaplot 2020) and immediately pulled its citations (cache hit) and recommendations (cache miss, succeeded). From citations it found a solid batch of recent 2024-26 papers on topological/3DGS nav — correctly identifying the Cao lab cluster. From references it found the pre-2020 foundations (Active Neural SLAM, SPTM, etc.).

In iteration 2 it did author lookups: Chaplot (cache hit), Saurabh Gupta (fresh call), Sourav Garg (fresh), Bryan Bo Cao (cache hit), An-Chieh Cheng (fresh). This correctly mapped 4 distinct lab lineages.

By iteration 3 it was already creating tracks and populating them. Iteration 4: done.

### What It Found
- ✓ CMU Chaplot/Gupta lineage (partial): Active SLAM, SemExp, No-RL-No-Sim, Differentiable Planning, Plan-Seq-Learn
- ✓ Oh lab (SNU): full 5-paper NeRF/topological lineage — **new**, not in expected but legitimate
- ✓ Yang lab (ETH): 3-paper legged outdoor lineage — **new**, highly relevant to user
- ✓ Guan lab: 2-paper VLM zero-shot lineage — weaker, only 2 papers

### What It Missed
- **GOAT** (Chaplot 2024) — should have been found from Chaplot author lookup. Possibly wasn't in the filtered results or the reader deprioritized it.
- **Entire Levine/Berkeley track** (GNM, ViNT, NoMaD, LeLaN, OmniVLA, MBRA) — structurally unreachable. The agent used search on iteration 1 (cache miss on "robotic visual navigation end-to-end neural" → 429), then never searched again. Without a search that hits Berkeley group papers, there's no citation path from the 2020 seed.
- **PRIOR lab** (PoliFormer, FLaRe, RING) — same issue, different community.

### Root Cause of Misses
The agent quit at 4 iterations after finding 4 "good" tracks. It never exhausted its search budget. The user has now updated the criteria to push the agent to go much deeper ("go until you're going in circles"). This should force more iterations and more search queries, which should eventually bridge to the Levine group.

### What to Watch Next Run
- Does the agent use `search_papers` more aggressively with the new criteria?
- Does it find GNM/ViNT via search (queries like "visual navigation foundation model", "image goal navigation Berkeley")?
- Does it find GOAT from Chaplot author lookup (it should be in there)?
- Does iteration count increase substantially?
