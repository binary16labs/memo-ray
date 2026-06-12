# Product Requirements Document (PRD): Agent OS Dashboard

## 1. Product Overview
The Agent OS Dashboard is a local web application designed to act as a mission control for all autonomous agent activity (currently Claude and Antigravity). It provides unparalleled transparency into agent memory, active parallel processes, decisions, and system mapping.

## 2. Target Audience & Accessibility Needs
**Primary User**: The primary user has ADHD and Dyslexia. They require:
- **Reduced Cognitive Load**: Easy discovery of information without digging through logs or raw JSON.
- **Visual Mapping**: Use of spatial relations (nodes/edges) to map out "tribal knowledge and memory".
- **Transparent Decisions**: Immediate clarity on why an agent made a decision, visually representing weights, ranks, and execution paths.

## 3. Core Principles & Aesthetics
- **Organic & Biological**: The UI will mirror biological systems. Data nodes will resemble "organic cells" that group to form "organs" and complex systems.
- **Visual richness without the noise**: Elegant, muted earthy tones (sage green, soft slate, deep moss, taupe) rather than stark neon or "beige rage".
- **Timeless Luxury**: A peaceful, high-end feel that is dynamic and reactive. 

## 4. Key Features & Data Architecture

### 4.1 Portable Entity Object Architecture & Delta Sync
- **Atomic File-System Database**: Discarding traditional databases for an ultra-portable, highly scalable file system architecture (`server/data/entities/`). Every session, thought, tool call, and artifact is a distinct JSON file.
- **Modeling Abstract**: A central `data_model_abstract.md` defines the strict ontology and schema. Future AI agents can read this to instantly understand how to navigate the data ecosystem without tribal knowledge or context overload.
- **Delta Sync Engine**: The backend securely reads `C:\Users\nsdha\AppData\Roaming\Claude\...` and `C:\Users\nsdha\.gemini\antigravity\brain\...`. It checks "Last Modified" timestamps and only parses new/updated files, writing them to atomic JSON files to ensure lightning-fast UI loads.

### 4.2 Comprehensive Lineage Governance View
- **Full Spectrum Mapping**: Maps Claude web chats, Claude Code sessions, Co-work caches, and Antigravity transcripts.
- **Artifact Integration**: Links project artifacts (PRDs, implementation plans, logs) as distinct structural nodes (Luminous Slate squares) directly to the conversation trees.

### 4.3 Biological Graph Visualization (Memory Map)
- **Cellular Nodes & Organs**: Steps/messages are cells. D3 Convex Hulls visually group threads and projects into translucent "organs".
- **Progressive Discovery**: Clicking a high-level session node dynamically "sprouts" its deep lineage, preventing graph clutter.
- **Visual Weighting**: Ranks/importance visualized via cell size and color intensity using strict earthy palettes.

### 4.4 Unified Claude-Base UI & Filters
- **Unified Base Interface**: Both Claude and Antigravity data use the same clean layout (Left sidebar for history/sessions, center fluid graph).
- **Collapsible Right Sidebar**: Houses powerful filters to dynamically toggle visibility of `User Inputs`, `Tool Calls`, `Thoughts`, `Artifacts`, and `Co-work`.

## 5. Technology Stack
- **Backend Data**: Portable JSON-LD / Atomic Entity Files, Express API.
- **Frontend**: React, Vite
- **Visualization**: D3.js / React Force Graph 2D
- **Styling**: Vanilla CSS (organic SVGs, fluid animations, muted earthy palettes).

## 6. Cognitive Mesh Positioning (Prime-Silo)

Memo-Ray is the **memory graph** of the Binary 16 cognitive mesh — the third first-class graph beside Prime-Silo's knowledge graph (documents) and code graph (Tree-Sitter AST). The shared principle across all three: **the operator must never be the glue or the institutional memory**. Where Prime-Silo makes *runs* auditable (lineage timeline, reasoning trace, frame inspector), Memo-Ray makes *agent conversations* auditable with the same lineage discipline.

### 6.1 Ontology alignment
The entity schema (`Session → Thought → Tool Call → Artifact`) deliberately mirrors Prime-Silo's run-lineage events so a future unification needs mapping, not re-modelling.

### 6.2 Enrichment seam
Memo-Ray's file-interaction timeline records which sessions read/wrote which files — the same files Prime-Silo's code graph models as `File` nodes. A `CORRELATES_WITH` enrichment overlay (the same mechanism Prime-Silo uses to link knowledge↔code) can link memory↔code: *"show me every conversation that shaped this module."*

### 6.3 Operational integration (shipped)
- Localhost-only CORS so Prime-Silo's site dashboard (also localhost) can read the manifest endpoint while remote origins cannot.
- Prime-Silo's demo-site dashboard carries a Memo-Ray health card (`/api/ecosystem/manifest` on `:3001`).
- All source-log paths derive from the user's home directory with env overrides — no machine-specific paths in code (Prime-Silo SR-1 discipline).

## 7. Document Status
**FINAL** - Approved for V2 Implementation. §6 added for Prime-Silo integration.
