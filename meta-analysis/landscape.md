# Research Landscape: Robotic Visual Navigation

*Cumulative map of the territory. Run-specific findings belong in run-log.md.*

---

## Labs & Lineages

### CMU Gupta/Chaplot Lab
**Key authors**: Devendra Singh Chaplot, Saurabh Gupta, Abhinav Gupta, Ruslan Salakhutdinov, Murtaza Dalal
**Methodology**: Modular neural methods, semantic maps, topological representations, Habitat sim, LLM-guided RL
**Papers**:
- Learning Exploration Policies for Navigation (2019) — Tao Chen, Saurabh Gupta
- Neural Topological SLAM for Visual Navigation (2020) — *seed paper*
- Learning to Explore using Active Neural SLAM (2020)
- Object Goal Navigation using Goal-Oriented Semantic Exploration / SemExp (2020)
- No RL, No Simulation: Learning to Navigate without Navigating (2021)
- Differentiable Spatial Planning using Transformers (2021)
- SEAL: Self-supervised Embodied Active Learning (2021)
- GOAT: Go To Any Thing (2024)
- Plan-Seq-Learn: Language Model Guided RL for Long Horizon Robotics (2024)

---

### Berkeley Levine / Shah Lab
**Key authors**: Sergey Levine, Dhruv Shah, Ajay Sridhar, Noriaki Hirose, Catherine Glossop
**Methodology**: Foundation models for navigation, image-goal conditioning, large-scale pretraining on robot/YouTube videos; diffusion policies; VLA omni-modal conditioning
**Papers**:
- LM-Nav: Robotic Navigation with Large Pre-Trained Models of Language, Vision, and Action (2022)
- GNM: Goal-conditioned Neural Navigation (2022)
- ViNT: A Foundation Model for Visual Navigation (2023)
- Navigation with Large Language Models: Semantic Guesswork as a Heuristic (2023)
- NoMaD: Goal Masked Diffusion Policies for Navigation and Exploration (2023)
- LeLaN: Learning A Language-Conditioned Navigation Policy from In-the-Wild Videos (2024)
- Mobility VLA: Multimodal Instruction Navigation with Long-Context VLMs and Topological Graphs (2024)
- OmniVLA: An Omni-Modal Vision-Language-Action Model for Robot Navigation (2025)
- MBRA: Learning to Drive Anywhere With Model-Based Reannotation (2025)
- CAST: Counterfactual Labels Improve Instruction Following in Vision-Language-Action Models (2025)
- AsyncVLA: An Asynchronous VLA for Fast and Robust Navigation on the Edge (2026)

---

### PRIOR Lab (Allen Institute)
**Key authors**: (Allen Institute)
**Methodology**: Massive-scale RL training, no explicit maps, pure policy learning ("Bitter Lesson" approach)
**Papers**:
- PoliFormer (2024)
- FLaRe (2024)
- RING: Robotic Indoor Navigation Generalist (2025)

---

### Bryan Bo Cao Lab
**Key authors**: Bryan Bo Cao, F. Johnson, Shubham Jain, Ashwin Ashok, Kristin J. Dana, Ryan Meegan
**Institution**: Rutgers (Dana lab)
**Methodology**: Feudal/hierarchical networks, latent memory proxies, 3DGS graphs, mapless image-goal nav; real Jackal outdoor robot
**Papers**:
- Feudal Networks for Visual Navigation (2024)
- Memory Proxy Maps for Visual Navigation (2024)
- A Landmark-Aware Visual Navigation Dataset (2024)
- YOPO-Nav: 3DGS Graphs from One-Pass Videos (2025)
- FeudalNav (2026)

---

### Sourav Garg Lab
**Key authors**: Sourav Garg
**Methodology**: Segment-based topological maps, object-relative control, RGB-only, open-world zero-shot
**Papers**:
- RoboHop: Segment-based Topological Map (2024)
- QueSTMaps: Queryable Semantic Topological Maps (2024)
- TANGO: Traversability-Aware Navigation (2025)
- ObjectReact: Object-Relative Control for Visual Navigation (2025)

---

### SNU Songhwai Oh Lab
**Key authors**: Songhwai Oh (Seoul National University)
**Methodology**: Topological graph memory → neural radiance maps; image-goal nav; Habitat sim + real robot
**Papers**:
- Image-Goal Navigation via Keypoint-Based RL (2021)
- Image-Goal Navigation via Metric Mapping and Keypoints (2021)
- Topological Semantic Graph Memory / TSGM (2022)
- Renderable Neural Radiance Map / RNR-Map (2023)
- RNR-Nav: Real-World Visual Navigation System (2024)

---

### ETH/ANYmal Fan Yang + Hutter Lab
**Key authors**: Fan Yang, Marco Hutter (ETH Zurich / ANYbotics)
**Methodology**: Semantic costmap planning → recurrent spatial memory → agile legged locomotion; ANYmal quadruped; sim-to-real outdoor wild terrain
**Papers**:
- ViPlanner: Visual Semantic Imperative Learning for Local Navigation (2023) — semantic costmaps, 38% traversability gain
- Fast Traversability Estimation for Wild Visual Navigation (2023) — in-field bootstrapping, outdoor neural trav
- ANYmal Parkour: Learning Agile Navigation for Quadrupedal Robots (2023) — hierarchical policy, 2m/s real
- Advanced Skills by Learning Locomotion and Local Navigation End-to-End / Loco-Nav (2022)
- IN-Sight: Interactive Navigation through Sight (2024)
- Spatially-enhanced Recurrent Memory for Long-Range Mapless Navigation (2025)

---

### Tianrui Guan Lab
**Key authors**: Tianrui Guan
**Methodology**: Object-centric VLM fine-tuning, zero-shot language-driven retrieval and navigation, real robots
**Papers**:
- LOC-ZSON: Language-driven Object-Centric Zero-Shot Object Retrieval and Navigation (2024)
- ZSORN (2025)

---

### Zhe Liu Lab
**Key authors**: Zhe Liu, Qiming Liu, Hesheng Wang
**Methodology**: End-to-end visuomotor RL → NeRF memory for cognitive navigation; real mobile robots
**Papers**:
- Visuomotor Reinforcement Learning for Multirobot Cooperative Navigation (2022)
- Integrating Neural Radiance Fields End-to-End for Cognitive Visuomotor Navigation (2024)

---

### Haitong Wang Lab (Toronto / Nejat Lab)
**Key authors**: Haitong Wang, Aaron Hao Tan, G. Nejat
**Methodology**: End-to-end transformer and 3DGS for target-driven visual navigation; cross-embodiment generalization; dynamic/cluttered real-world environments
**Papers**:
- NavFormer: Transformer for Robot Target-Driven Navigation in Dynamic Environments (2024)
- SplatSearch: Instance Image Goal Navigation with 3DGS and Diffusion (2025)
- X-Nav: End-to-End Cross-Embodiment Navigation for Mobile Robots (2025)

---

### Seneviratne Outdoor VLM Lab (UMD)
**Key authors**: Gershom Seneviratne, Kasun Weerakoon, Mohamed Bashir Elnoor, Tianrui Guan
**Methodology**: VLM-grounded traversability and behavioral rules for outdoor wheeled/quadruped robots; physically grounded language-guided navigation
**Papers**:
- CoNVOI: Context-aware Navigation using VLMs in Outdoor and Indoor Environments (2024)
- Behav: Behavioral Rule Guided Autonomy Using VLMs for Outdoor Navigation (2024)
- VLM-GroNav: Robot Navigation Using Physically Grounded VLMs in Outdoor Environments (2025)

---

### Yi Du Neuro-Symbolic Lab
**Key authors**: Yi Du, Taimeng Fu
**Methodology**: Neuro-symbolic VLM approach for reasoning-based VLN; DARPA real-world large-scale outdoor
**Papers**:
- VL-Nav: A Neuro-Symbolic Approach for Reasoning-based Vision-Language Navigation (2025)

---

### VLA Cluster (various labs)
**Methodology**: Vision-Language-Action models for language-instructed robot navigation, indoor/outdoor
**Papers**:
- NaVILA: Legged Robot Vision-Language-Action Model (2024) — An-Chieh Cheng, Jan Kautz (NVIDIA)
- UrbanVLA: VLA for Urban Micromobility (2025) — Anqi Li et al.
- VAMOS: Hierarchical VLA for Capability-Modulated Navigation (2025) — Mateo Guaman Castro et al.
- TIC-VLA: A Think-in-Control VLA for Robot Navigation in Dynamic Environments (2026)
- ABot-N0: VLA Foundation Model for Versatile Embodied Navigation (2026) — Zedong Chu et al.

---

### Habitat / Meta AI Platform
**Key authors**: Manolis Savva et al.
**Role**: Simulation platform and benchmark suite underpinning much of the field (ObjectNav, VLN-CE, etc.)
**Papers**:
- Habitat: A Platform for Embodied AI Research (2019)

---

### Habitat Scaling Lab (Batra / Meta AI)
**Key authors**: Dhruv Batra, Manolis Savva, Karmesh Yadav
**Methodology**: Large-scale IL+RL training on Habitat sim, task-agnostic neural architectures, scaling laws for visual nav
**Papers**:
- ViNL: Navigating to Objects in the Real World (2022) — legged nav+locomotion, real quadruped
- ZSON: Zero-Shot Object-Goal Navigation using Multimodal Goal Embeddings (2022)
- Is Mapping Necessary for Realistic PointGoal Navigation? (2022) — 94% success RGB-D, sim2real LoCoBot
- PIRLNav: Pretraining with Imitation and RL Finetuning for ObjectNav (2023)
- OVRL-V2: Simple State-of-Art Baseline for ImageNav and ObjectNav (2023) — scaling laws, task-agnostic

---

### UIUC / EarthSense Agricultural Navigation Lab
**Key authors**: Saurabh Gupta, A.N. Sivakumar, M.V. Gasparino, Vitor Higuti
**Methodology**: Mapless neural visual navigation for under-canopy and outdoor agricultural robots; keypoint-based control, traversability prediction, real field deployments (25km+)
**Papers**:
- Learned Visual Navigation for Under-Canopy Agricultural Robots / CropFollow (2021) — mapless monocular, 25km field
- WayFAST: Navigation With Predictive Traversability in the Field (2022) — RGB-D self-supervised traction
- CropNav: A Framework for Autonomous Navigation in Real Farms (2023)
- Demonstrating CropFollow++: Robust Under-Canopy Navigation with Keypoints (2024)
- RowDetr: End-to-End Crop Row Detection Using Polynomials (2024)

---

### Habitat Benchmark Cluster (Meta AI / AllenAI)
**Key authors**: Dhruv Batra, Manolis Savva, Arjun Majumdar, Aniruddha Kembhavi
**Methodology**: ObjectNav/ImageNav benchmark papers; zero-shot generalization via CLIP embeddings, data augmentation, large-scale training; Habitat/Gibson/MP3D sim
**Papers**:
- THDA: Treasure Hunt Data Augmentation for Semantic Navigation (2021) — Meta AI, addresses ObjectNav overfitting
- Simple but Effective: CLIP Embeddings for Embodied AI (2021) — AllenAI, zero-shot ObjectNav
- ZSON: Zero-Shot Object-Goal Navigation using Multimodal Goal Embeddings (2022) — Meta AI

---

### NaVid / VLM-VLN Cluster
**Key authors**: Various (NaVid, NavFoM teams)
**Methodology**: Video/VLM for vision-language navigation, sim-to-real transfer, embodiment generalization
**Papers**:
- NaVid: Video-based VLM for VLN sim-to-real (2024)
- Embodied Navigation Foundation Model / NavFoM (2025) — unified nav tasks/embodiments, zero-shot real-world
- SLIM: Sim-to-Real Legged Instructive Manipulation via Long-Horizon Visuomotor Learning (2025)
- OpenVLA: An Open-Source Vision-Language-Action Model (2024) — scalable VLA, fine-tunable real data

---

### Chinese Labs — Neural Topological Cognition
**Key authors**: Various (HTSCN, TMFT, DGNav teams)
**Methodology**: Dual-layer topological + semantic graph memory; cognitive nav; Chinese robotics labs
**Papers**:
- HTSCN: Visuomotor Navigation for Embodied Robots With Spatial Memory and Semantic Reasoning Cognition (2024)
- TMFT: Cognitive Navigation for Intelligent Mobile Robots: A Learning-Based Approach with Topological Memory Configuration (2024)
- DGNav: Dynamic Topology Awareness: Breaking the Granularity Rigidity in Vision-Language Navigation (2026)

---

### Miscellaneous / One-off Papers
- End-to-End Learning for Visual Navigation of Forest Environments (2023) — Chaoyue Niu, Klaus-Peter Zauner, Danesh Tarapore
- WildOS: Open-Vocabulary Object Search in the Wild (2026) — Hardik Shah et al.
- EMKG: Embodied Memory Knowledge Graphs for Object-Goal Navigation (2026) — Mingyi Li et al.
- IGL-Nav: Incremental 3DGS Localization for Image-goal Navigation (2025) — Wenxuan Guo, Hang Yin et al.
- GaussNav: Gaussian Splatting for Visual Navigation (2024) — Xiaohan Lei et al.
- Navigating the Wild: Pareto-Optimal Visual Decision-Making in Image Space (2025) — Durgakant Pushp et al.
- ABot-N0: VLA Foundation Model for Versatile Embodied Navigation (2026) — Zedong Chu et al.
- Semantic Visual Navigation by Watching YouTube Videos (2020) — Matthew Chang, Saurabh Gupta

---

## Cross-Cutting Themes

| Theme | Labs / Papers |
|-------|--------------|
| Topological maps (neural) | CMU, Garg, Cao, Oh |
| 3DGS representations | Cao (YOPO-Nav), SplatSearch, IGL-Nav |
| NeRF representations | Oh (RNR-Map), Zhe Liu |
| Legged robot / outdoor | Yang (ETH), NaVILA, WildOS |
| Image-goal navigation | CMU, Oh, Cao, Berkeley |
| Foundation models / VLM | Guan, VLA cluster, Berkeley |
| Real-world outdoor | Yang, Cao, Garg, Niu (forest) |
| Habitat benchmark | CMU, Oh, Habitat platform |

---

## Citation Graph Structure

```
Seed (Chaplot 2020)
  ├─ Citations (forward) → CMU papers, Oh lab, Cao lab, misc 2024-26
  ├─ References (backward) → Active Neural SLAM, SPTM, Behavioral Graph Nav (pre-2021 foundations)
  ├─ Recommendations → Garg lab, VLM-for-nav papers
  └─ Author lookups → Chaplot → CMU; Saurabh Gupta → CMU; Cao → Rutgers

Berkeley Levine group
  └─ Disconnected from seed citation graph (post-2020, different community)
     Bridge options:
       - Specific search: "GNM goal conditioned neural navigation", "ViNT visual navigation transformer"
       - Author search: Dhruv Shah, Sergey Levine
       - Via bridging paper: a 2024+ survey citing both traditions

PRIOR Lab
  └─ Disconnected from seed citation graph
     Bridge options:
       - Specific search: "PoliFormer navigation", "RING navigation generalist"
       - Author search: Allen Institute navigation team
```
