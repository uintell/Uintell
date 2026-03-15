# How The System Works

This is the 10-minute entry point for a new developer.

## What Uintell Does

Uintell imports offline knowledge sources, normalizes them into one document model, lets the user browse and read them, and answers page-scoped questions with citations.

The core loop is:

`import -> search -> read -> ask -> cited answer`

## The Small Mental Model

Think about the system in five parts:

1. source registration
2. ingestion and normalization
3. canonical knowledge storage
4. retrieval and answering
5. reader UI

If you understand those five parts, the repo becomes manageable.

## Where To Start Reading

Read these files in order:

1. `services/api/app/main.py`
2. `services/api/app/services/ingestion.py`
3. `services/api/app/repositories/documents.py`
4. `services/api/app/services/retrieval.py`
5. `services/api/app/services/answers.py`
6. `apps/web/lib/api.ts`
7. `apps/web/components/document-reader-workspace.tsx`

## How The Knowledge Engine Works

### Import

The imports page stores source profiles in settings and starts an ingestion job.

### Normalize

The ingestion service converts raw inputs into `ParsedDocument`, then into:

- a document row
- section JSON
- document links
- document chunks

### Store

Postgres holds the canonical knowledge objects.

### Index

Qdrant stores chunk embeddings for semantic retrieval.

### Search

Retrieval merges Postgres full-text matches with Qdrant semantic matches.

### Read

The reader loads one document plus backlinks and related pages.

### Ask

The answer service retrieves from the current page first, broadens to the source only when needed, then returns answer text, citations, and supporting passages.

## Where To Modify Ingestion

- source iterators and file parsing:
  `packages/ai/src/knowledge_engine/filesystem_docs.py`
- chunking:
  `packages/ai/src/knowledge_engine/chunking.py`
- ingestion orchestration:
  `services/api/app/services/ingestion.py`
- job/status persistence:
  `services/api/app/repositories/system.py`

## Where To Modify Search

- retrieval logic:
  `services/api/app/services/retrieval.py`
- chunk/document queries:
  `services/api/app/repositories/documents.py`
- search endpoint:
  `services/api/app/api/routes/retrieval.py`
- search UI:
  `apps/web/components/search-workspace.tsx`

## Where To Modify AI

- answer orchestration:
  `services/api/app/services/answers.py`
- provider behavior:
  `services/api/app/services/providers.py`
- citation bundle and prompts:
  `packages/ai/src/knowledge_engine/prompting.py`
- ask-page UI:
  `apps/web/components/page-answer-panel.tsx`

## Where To Modify The Reader UI

- reader shell:
  `apps/web/components/document-reader-workspace.tsx`
- article body rendering:
  `apps/web/components/document-body.tsx`
- table of contents and source rail:
  `apps/web/components/document-reader-sidebar.tsx`
- related pages and backlinks:
  `apps/web/components/document-exploration.tsx`

## Where The Frontend Calls The Backend

All active frontend network calls go through:

- `apps/web/lib/api.ts`

The main UI surfaces that use it are:

- `apps/web/components/imports-workspace.tsx`
- `apps/web/components/library-workspace.tsx`
- `apps/web/components/source-detail-workspace.tsx`
- `apps/web/components/search-workspace.tsx`
- `apps/web/components/document-reader-workspace.tsx`
- `apps/web/components/page-answer-panel.tsx`

## Active Vs Frozen

Active:

- `apps/web`
- `services/api`
- `services/worker` when durable ingest is needed
- `packages/ai`
- `packages/shared`

Frozen:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`

Do not build new product behavior into the frozen paths.

## Default Local Stack

Use the smallest stack that supports the core loop:

- `postgres`
- `qdrant`
- `api`
- `web`

Everything else is optional.

## The Most Important Truth

Postgres is the truth.

Qdrant, Meilisearch, uploads, and provider outputs are all derived or operational layers around the canonical document model.
