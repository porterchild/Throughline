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
