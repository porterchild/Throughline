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
**Key authors**: Sergey Levine, Dhruv Shah, Ajay Sridhar, Noriaki Hirose, Catherine Glossop, Arjun Bhorkar, Kyle Stachowicz, Kevin Black
**Methodology**: Foundation models for navigation, image-goal conditioning, large-scale pretraining on robot/YouTube videos; diffusion policies; VLA omni-modal conditioning; offline RL for real-world outdoor nav
**Papers**:
- ViNG: Learning Open-World Navigation with Visual Goals (2020) — foundational visual goal nav with topo graphs, open-world
- RECON: Rapid Exploration for Open-World Navigation with Latent Goal Models (2021) — latent goal models for open-world exploration
- Hybrid Imitative Planning with Geometric and Predictive Costs in Off-Road Environments (2021) — neural traversability for off-road
- Offline Reinforcement Learning for Visual Navigation (2022) — offline RL for real-world visual nav (off-road), no online trials
- LM-Nav: Robotic Navigation with Large Pre-Trained Models of Language, Vision, and Action (2022)
- GNM: A General Navigation Model to Drive Any Robot (2022) — cross-embodiment generalization via image-goal conditioning
- ViKiNG: Vision-Based Kilometer-Scale Navigation with Geographic Hints (2022) — km-scale outdoor visual nav
- ExAug: Robot-Conditioned Navigation Policies via Geometric Experience Augmentation (2022) — cross-robot generalization via augmentation
- ViNT: A Foundation Model for Visual Navigation (2023)
- Navigation with Large Language Models: Semantic Guesswork as a Heuristic (2023)
- NoMaD: Goal Masked Diffusion Policies for Navigation and Exploration (2023)
- SELFI: Autonomous Self-Improvement with Reinforcement Learning for Social Navigation (2024)
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
- Habitat-Web: Learning Embodied Object-Search Strategies from Human Demonstrations at Scale (2022) — large-scale human demo IL for ObjectNav
- VLFM: Vision-Language Frontier Maps for Zero-Shot Semantic Navigation (2023) — CLIP frontier maps for zero-shot ObjectNav
- ETPNav: Evolving Topological Planning for Vision-Language Navigation in Continuous Environments (2023) — online topo maps + transformer planner; SOTA R2R-CE

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
- AdaCropFollow: Self-Supervised Online Adaptation for Visual Under-Canopy Navigation (2024)
- MetaCropFollow: Few-Shot Adaptation with Meta-Learning for Under-Canopy Navigation (2024)
- WayFASTER: Self-Supervised Traversability Prediction for Increased Navigation Awareness (2024)

---

### Habitat Benchmark Cluster (Meta AI / AllenAI)
**Key authors**: Dhruv Batra, Manolis Savva, Arjun Majumdar, Aniruddha Kembhavi, Ram Ramrakhya
**Methodology**: ObjectNav/ImageNav benchmark papers; zero-shot generalization via CLIP embeddings, data augmentation, large-scale training; Habitat/Gibson/MP3D/HM3D sim; open-vocabulary object-goal nav
**Papers**:
- THDA: Treasure Hunt Data Augmentation for Semantic Navigation (2021) — Meta AI, addresses ObjectNav overfitting
- Simple but Effective: CLIP Embeddings for Embodied AI (2021) — AllenAI, zero-shot ObjectNav
- ZSON: Zero-Shot Object-Goal Navigation using Multimodal Goal Embeddings (2022) — Meta AI
- HM3D-OVON: A Dataset and Benchmark for Open-Vocabulary Object Goal Navigation (2024) — Meta AI, OVON benchmark on HM3D; cited by FiLM-Nav, Hydra-Nav
- FiLM-Nav: Efficient and Generalizable Navigation via VLM Fine-tuning (2025) — VLM fine-tuned on OVON benchmark
- Hydra-Nav: Object Navigation via Adaptive Dual-Process Reasoning (2026) — dual-process (fast/slow) reasoning for ObjectNav

---

### NavGPT / VLN Reasoning Cluster (UQ / Qi Wu Lab)
**Key authors**: Gengze Zhou, Yicong Hong, Qi Wu (University of Queensland)
**Methodology**: LLM and LVLM as high-level reasoners for Vision-Language Navigation (VLN) sim benchmarks (R2R, RxR, REVERIE); chain-of-thought navigation planning; zero-shot and fine-tuned variants
**Papers**:
- NavGPT: Explicit Reasoning in Vision-and-Language Navigation with Large Language Models (2023) — 333 cit; LLM-driven zero-shot VLN via sequential reasoning
- NavGPT-2: Unleashing Navigational Reasoning Capability for Large Vision-Language Models (2024) — LVLM vision-aligned successor
- NavCoT: Boosting LLM-Based VLN via Learning Disentangled Reasoning (2024) — Chain-of-Thought reasoning, SOTA on R2R/RxR
- A2Nav: Action-Aware Zero-Shot Robot Navigation via Foundation Models (2023) — LLM instruction decomposition to sub-tasks; R2R-Habitat + RxR-Habitat
- NaVid: Video-based VLM Plans the Next Step for VLN (2024) — 204 cit; mapless monocular video VLM; sim-to-real transfer

---

### Daeun Song / Jing Liang / Xuesu Xiao Lab (UT Austin / UMD)
**Key authors**: Daeun Song, Jing Liang, Xuesu Xiao, Dinesh Manocha, Amirreza Payandeh
**Methodology**: Mapless outdoor navigation via VLM trajectory generation/selection; multi-modal scene understanding for long-range outdoor; socially-aware real-time VLM navigation
**Papers**:
- VL-TGS: Trajectory Generation and Selection Using VLMs in Mapless Outdoor Environments (2024) — 26 cit; VLM selects human-like trajectories on crosswalks/curbs
- MOSU: Autonomous Long-range Robot Navigation with Multi-modal Scene Understanding (2025) — VLM outdoor long-range
- Narrate2Nav: Real-Time Visual Navigation with Implicit Language Reasoning (2025) — real-time implicit language reasoning for human-centric environments
- AutoSpatial: Visual-Language Reasoning for Social Robot Navigation (2025) — spatial reasoning limits of VLMs in navigation

---

### AnyLoc / Visual Place Recognition Cluster
**Key authors**: Nikhil Varma Keetha, Sebastian Scherer (CMU); Avneesh Mishra, Krishna Murthy Jatavallabhula; Feng Lu, Gaoshuang Huang (various)
**Methodology**: Foundation-model-based universal visual place recognition; DINOv2 backbones for zero-shot outdoor robustness (seasonal, day/night, weather); cross-modal VPR
**Papers**:
- AnyLoc: Towards Universal Visual Place Recognition (2023) — 242 cit; DINO features for zero-shot outdoor VPR
- Towards Seamless Adaptation of Pre-trained Models for VPR / SelaVPR (2024) — 78 cit; lightweight adapters, MSLS benchmark leader
- EffoVPR: Effective Foundation Model Utilization for VPR (2024) — 25 cit; seasonal + day/night zero-shot robustness
- DINO-Mix: Enhancing VPR with Foundation Model and Feature Mixing (2024) — Nordland seasonal benchmark
- UniLoc: Towards Universal Place Recognition Using Any Single Modality (2024) — natural language + point clouds + vision
- RGB-Thermal VPR via Vision Foundation Model (2025) — night/smoke/fog robustness via multi-modal fusion
- General Place Recognition Survey: Toward Real-World Autonomy (2024) — 31 cit survey; lineage from classical PR to foundation models

---

### Oier Mees / VLMaps Lab (Freiburg → Berkeley)
**Key authors**: Oier Mees, Chen Huang, Andy Zeng, Wolfram Burgard
**Methodology**: CLIP-grounded open-vocabulary 3D semantic maps for language-driven robot navigation; implicit neural field extensions; real robots (Spot, wheeled)
**Papers**:
- Visual Language Maps for Robot Navigation / VLMaps (2022) — 500+ cit; CLIP features fused into 3D voxel grid for open-vocab nav
- Audio Visual Language Maps for Robot Navigation / AVLMaps (2023) — extends VLMaps with audio for multi-sensory goal disambiguation
- LAMP: Implicit Language Map for Robot Navigation (2025) — implicit neural field replaces explicit voxel grid for scalable outdoor maps

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

### Edinburgh Webb/Mangan Bio-Robotics Lab
**Key authors**: Barbara Webb, Antoine Wystrach, Stanley Heinze, Paul Graham (Edinburgh; also Mangan)
**Methodology**: Insect mushroom body (MB) spiking neural network models for visual route navigation; event cameras; real outdoor robots (Q-car) navigating through dense vegetation; neuromorphic/low-power approach
**Papers**:
- Spatio-temporal Memory for Navigation in a Mushroom Body Model (2020) — foundational MB model for spatial memory in nav
- Neuromorphic Sequence Learning with an Event Camera on Routes Through Vegetation (2023) — outdoor real-robot event-cam + MB for vegetation nav
- Investigating Visual Navigation Using Spiking Neural Network Models of the Insect Mushroom Bodies (2024) — embodied real-robot validation, complex outdoor; low error

---

### Hang Yin Lab (Scene Graph / LLM Zero-Shot Nav)
**Key authors**: Hang Yin, Wenxuan Guo (and collaborators)
**Methodology**: Online 3D scene graph construction prompted to LLMs for zero-shot ObjectNav; universal goal-oriented nav across task types; graph constraint-based VLN; 3DGS localization
**Papers**:
- SG-Nav: Online 3D Scene Graph Prompting for LLM-based Zero-shot Object Navigation (2024) — 105 citations; scene graph → LLM for zero-shot ObjectNav
- IGL-Nav: Incremental 3DGS Localization for Image-goal Navigation (2025) — incremental 3D Gaussian localization
- UniGoal: Towards Universal Zero-shot Goal-oriented Navigation (2025) — unified framework across ObjectNav/ImageNav/VLN
- GC-VLN: Instruction as Graph Constraints for Training-free Vision-and-Language Navigation (2025) — graph constraints for training-free VLN

---

### Pushp Lab (Mapless Outdoor Visual Navigation)
**Key authors**: Durgakant Pushp (and collaborators)
**Methodology**: Pareto-optimal mapless monocular semantic image-space planning; lightweight real-world deployment in unstructured outdoor (forests, snow); no explicit map or SLAM
**Papers**:
- POVNav: A Pareto-Optimal Mapless Visual Navigator (2023)
- Navigating the Wild: Pareto-Optimal Visual Decision-Making in Image Space (2025)
- Visual-Geometry GP-based Navigable Space for Autonomous Navigation (2024)

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
- VERN: Vegetation-Aware Robot Navigation in Dense Unstructured Outdoor Environments (2023) — legged/wheeled outdoor; dense vegetation/forest terrain
- Traversability-Aware Legged Navigation by Learning From Real-World Visual Data (2024) — real-world visual training for legged robot traversability; no simulation
- Does Matter: Visual Navigation via Denoising Diffusion Bridge Models (2025) — diffusion models for multi-modal trajectory generation in nav
- UAV-Flow Colosseo: A Real-World Benchmark for Flying-on-a-Word UAV Imitation Learning (2025) — aerial drone imitation learning, VLM/GS policies, real-world benchmark
- Mobile Robot Navigation Using Hand-Drawn Maps: A Vision Language Model Approach (2025) — VLM interpretation of hand-drawn maps for indoor robot nav; Tan/Wang lab

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
| Semantic CLIP maps | Oier Mees (VLMaps), Guan (LOC-ZSON) |
| VLN simulation benchmarks | NavGPT/NavCoT (UQ), NaVid, A2Nav |
| Visual place recognition | AnyLoc, SelaVPR, EffoVPR, DINO-Mix |
| Outdoor mapless VLM nav | Daeun Song/Xiao (VL-TGS, MOSU), Pushp (POVNav) |
| VLA foundation models | Berkeley (ViNT→OmniVLA→AsyncVLA), Google (RT-1→AutoRT→PaLM-E) |

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
