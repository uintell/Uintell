# Simplification Plan

## Plain-English Repo Audit

Uintell currently has one strong product path inside a wider codebase that still carries older ambitions and parallel surfaces.

The strong path is:

`import source -> browse source -> open page -> ask page -> cited answer`

The confusing parts are:

- multiple user-facing surfaces that compete with the main reader flow
- legacy stacks still visible in the repo tree
- optional infrastructure that used to look mandatory
- search exposing more tuning than the average reader needs
- imports still carrying some admin-console framing

## Current Classification

### Active

- `apps/web`
- `services/api`
- `packages/ai`
- `packages/shared`
- the source/library reader flow
- page-scoped grounded answers
- imports and ingestion status
- search

### Frozen

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`
- generic chat-first workspace flows
- notes/pages as a separate product line
- collections as a separate product line
- `/app/chat`, `/app/collections`, and `/app/notes` now render shared frozen notices instead of full product workspaces

### Optional

- `services/worker`
- Temporal
- Redis
- Meilisearch
- Ollama
- OpenAI

### Removable Later

- old workspace routes that are no longer part of the main journey
- leftover generic chat abstractions if they stop serving the page-answer flow
- duplicate docs that tell the older “platform” story

## New Mental Model

Think of Uintell as four layers:

1. `Import`
   Register a source path and run ingestion.

2. `Knowledge graph of records`
   Normalize sources into documents, sections, chunks, relationships, and jobs.

3. `Reader`
   Browse sources, open pages, read clearly, navigate related material.

4. `Grounded answer`
   Ask about the current page, widen to the current source only if needed, return citations and evidence.

## Minimum Components Needed

For the core flow, keep only:

- Next.js frontend
- FastAPI backend
- PostgreSQL
- Qdrant

Everything else is optional.

## Exact Core Flow

### A. Import Source

- user opens `Imports`
- registers a source path
- starts ingestion
- sees job status

### B. Browse Source

- user opens `Library`
- sees source summaries
- opens a specific source

### C. Read Page

- user opens a document
- sees title, source, toc, readable body, related pages

### D. Ask Page

- user asks a question about the current page
- system retrieves page chunks first
- system broadens to the source only if page evidence is weak

### E. Cite Answer

- answer text is shown separately
- citations are listed explicitly
- supporting passages are visible

## Immediate Code Simplification Moves

- hide or freeze non-core routes in the primary navigation
- simplify search UI to the default useful path
- keep imports as a product surface, not an admin surface
- keep source detail and reader routes central
- reduce docs to one product story

## Success Check

A new developer should be able to answer:

- what Uintell is
- which stack is active
- which code is frozen
- how ingestion runs
- how pages are rendered
- how page answers are generated
- which services are actually required by default
