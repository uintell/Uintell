# Progress

## Product Focus

Uintell is being narrowed to one primary product:

`import source -> browse source -> read page -> ask page -> cited answer`

The product is not being positioned as a generic AI platform. The core value is a serious reader-first knowledge system for offline corpora such as wiki imports, books, notes, and technical docs.

## Chosen Default Stack

- Frontend: Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Backend: FastAPI + Pydantic + PostgreSQL
- Retrieval: PostgreSQL exact search + Qdrant vectors
- Jobs by default: API-managed background ingestion
- Optional jobs for advanced/local durability: Temporal worker
- Models by default: deterministic grounded answers
- Optional model paths: Ollama or OpenAI

## Frozen Or Deprecated Areas

These paths are frozen except for migration support, compatibility, or critical fixes:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`

These surfaces are no longer treated as the primary product:

- generic chat-first workspace flows
- collections as a first-class product surface
- notes/pages as a competing product line
- multi-architecture README positioning
- the old `/app/chat`, `/app/collections`, and `/app/notes` workspaces

## Minimal Required Local Services

The default local path should require only:

- PostgreSQL
- Qdrant
- API
- Web

These should be optional for advanced setups, not required for the main product loop:

- Redis
- Meilisearch
- Temporal
- Temporal UI
- Worker
- Ollama

## Cleanup Goals

- [x] Freeze legacy stack in docs and navigation
- [x] Separate repo code from datasets, indexes, caches, and mutable runtime state
- [x] Move default runtime/data locations outside the repo root by default
- [x] Reduce default local startup to the main vertical slice only
- [x] Rewrite top-level docs around one product story
- [x] Remove default-secret guidance from primary docs

## Primary Vertical Slice

### A. Import Source

- user registers or points to a local source path
- ingestion starts
- status is visible

### B. Browse Source

- source list
- source detail
- document list per source

### C. Read Page

- article layout
- metadata
- table of contents
- related pages

### D. Ask This Page

- page-scoped question box
- retrieve from current page first
- widen to current source only if needed
- answer with explicit citations and supporting passages

### E. Continue Reading

- related pages
- backlinks where available
- source navigation

## UX Milestones

- [x] Home page tells one focused story
- [x] Library page emphasizes sources and documents, not generic workspace cards
- [x] Source detail page exists and is useful
- [x] Reader page includes ask-page AI and evidence
- [x] Search is fast, readable, and citation-oriented
- [x] Ingestion status is visible without turning the app into an admin dashboard
- [x] Frozen routes point users back to the active reader flow instead of acting like live product areas

## Implementation Milestones

- [x] Inspect repo structure and identify active stack, legacy stack, and runtime clutter
- [x] Rewrite README around the focused product identity
- [x] Write a plain-English audit of the active system
- [x] Add a short next-sprint plan for the focused vertical slice
- [x] Add documentation for runtime/data separation and local development defaults
- [x] Simplify compose/config defaults for the primary local path
- [x] Add source-summary APIs
- [x] Add page-scoped answer API with citations and supporting passages
- [x] Refine frontend pages around library, source detail, reader, and ingestion status
- [x] Improve reader rendering for markdown, code, anchors, and evidence
- [x] Improve search result presentation and section jumps
- [x] Verify the reduced default stack and focused UI flow at build/config level

## Verification Notes

- `docker compose config --services` now resolves to `postgres`, `qdrant`, `api`, and `web` by default
- `npm --workspace apps/web run build` passes, including the focused search/imports surfaces and frozen-route notices
- `find services/api/app services/worker/worker_app packages/ai/src/knowledge_engine -name '*.py' -print0 | xargs -0 python3 -m py_compile` passes
