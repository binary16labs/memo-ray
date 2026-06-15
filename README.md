# Memo-Ray

> An X-ray for agent memory. You should never have to be the institutional memory for your own AI agents.

Memo-Ray reads the session logs your AI agents already write (Claude desktop / Claude Code / Cowork, and Antigravity), distils them into a portable atomic entity database, and renders them as an organic, explorable lineage graph: every prompt, thought, tool call, and touched file — visible, searchable, and clickable.

Built ADHD/dyslexia-first: spatial maps over log spelunking, progressive discovery over walls of JSON, muted earthy palettes over neon noise. See [`requirements/PRD.md`](requirements/PRD.md).

## The principle

Operators end up acting as the *glue* between their agents — remembering which session touched which file, why a decision was made, what an agent was doing in parallel. That is institutional memory work, and humans (especially neurodivergent ones) are the wrong substrate for it.

Memo-Ray inverts it: the **memory graph** becomes a first-class, queryable surface — the same move [Prime-Silo](https://github.com/binary16labs/prime-silo) makes for documents (knowledge graph) and code (code graph). Memo-Ray is the third graph of the cognitive mesh:

| Graph | Source | Surface |
|---|---|---|
| Knowledge graph | Ingested documents | Prime-Silo / Benny RAG |
| Code graph | Tree-Sitter AST | Prime-Silo / Benny code analysis |
| **Memory graph** | **Agent session logs** | **Memo-Ray** |

The file-interaction timeline is the natural enrichment seam: Memo-Ray already maps *which sessions touched which files* — the same files the code graph models as nodes. A future `CORRELATES_WITH` overlay can link them, exactly like Prime-Silo's knowledge↔code enrichment.

## Quickstart

You can start the full stack (backend and client) with a single command from the project root.

### The Easy Way

```bash
# Installs dependencies if missing, checks ports, and boots both server + client
npm run dev
```

Alternatively, you can run the native launchers directly:
- **Windows (PowerShell)**: `.\scripts\dev.ps1`
- **macOS/Linux (Bash)**: `./scripts/dev.sh`

*Note: If port 3030 is already occupied (e.g., because you started the Memo-Ray server through `prime-silo`'s dev launcher), the scripts will automatically detect it, skip booting a duplicate server, and only run the client.*

### The Manual Way

If you prefer to run them in separate terminals:
```bash
# Server (Express, :3030) — syncs agent logs on boot, then on demand
cd agent-os-dashboard/server
npm install
node index.js

# Client (Vite + React, :5175)
cd ../client
npm install
npm run dev
```

Open http://localhost:5175. The left sidebar lists sessions (and a Files explorer); clicking one sprouts its lineage graph; the right sidebar inspects any node.

## Configuration

Everything is derived from your home directory by default. Override only when needed:

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3030` | Server port |
| `MEMORAY_CLAUDE_DIRS` | `%USERPROFILE%\AppData\Roaming\Claude\{local-agent-mode-sessions,claude-code-sessions}` | Semicolon-separated Claude log roots |
| `MEMORAY_ANTIGRAVITY_DIR` | `~/.gemini/antigravity/brain` | Antigravity brain root |
| `VITE_MEMORAY_API` | `http://localhost:3030` | API base for the client |

## Data architecture

Atomic file-system database — every session, thought, tool call, and artifact is one JSON file under `server/data/entities/`, indexed by `server/data/index.json`, kept fresh by a delta-sync engine that only re-parses logs modified since the last sync. The full ontology lives in [`agent-os-dashboard/server/data_model_abstract.md`](agent-os-dashboard/server/data_model_abstract.md) — an agent can read that one file and navigate the whole dataset.

`server/data/` is **git-ignored**: your conversation lineage never leaves your machine.

## Security posture

- CORS is restricted to **localhost origins** — this server exposes your agent memory and an OS file-open endpoint; remote origins get nothing.
- `POST /api/files/open` only opens paths that appear in the indexed lineage (arbitrary request paths are refused with 403) and uses argument-vector spawning (no shell interpolation).

## Prime-Silo integration

Prime-Silo's demo site dashboard includes a Memo-Ray card that health-checks `:3030` and shows live node counts. Boot both stacks and the operator gets one pane of glass: runs lineage (Prime-Silo) beside conversation lineage (Memo-Ray).

---

*Memo-Ray — engineered by Binary 16.*
