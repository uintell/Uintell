# System Map

## What The System Is

Uintell is a reader-first knowledge engine. It imports offline sources, normalizes them into one internal document model, makes them searchable, and lets the reader ask grounded questions about a page with visible citations.

The core product loop is:

`import source -> browse source -> read page -> ask page -> cited answer`

## Simple Architecture Diagram

```text
Sources
  |
  v
Ingestion Service / Worker
  |
  v
Knowledge Engine
  |
  v
Search / Retrieval
  |
  v
AI Answer
  |
  v
Frontend UI
```

## Core Components

### `apps/web`

The active frontend. It renders:

- source import and ingestion status
- library and source detail pages
- search
- article reader
- ask-this-page UI

It fetches all active data through `apps/web/lib/api.ts`.

### `services/api`

The active backend. It owns:

- source registration and ingestion job creation
- document and source APIs
- retrieval
- grounded page answers
- settings and source profiles

### `packages/ai`

Shared knowledge-engine helpers:

- parse raw sources into `ParsedDocument`
- chunk normalized documents
- build citation bundles
- build generation prompts
- provide embedding helpers

### `PostgreSQL`

The canonical store for:

- documents
- document chunks
- document links
- ingestion jobs
- app settings

### `Qdrant`

The semantic retrieval index. It stores vectors keyed by chunk id. It is derived from Postgres data and can be rebuilt.

## How Data Flows Through The System

### 1. Ingestion Pipeline

Source registration starts in the web UI on the imports page. The UI saves source profiles through the settings API, then starts ingestion with `POST /v1/imports/ingest`.

The API creates an `IngestionJob` row through `SystemRepository`. After that:

- default path: the API starts `IngestionService.process_job()` in the background
- optional path: the API starts a Temporal workflow and `services/worker` runs the job

`IngestionService` then:

1. chooses a source iterator based on `source_type`
2. parses raw source files into `ParsedDocument`
3. applies profile overrides such as tags or document kind
4. upserts the canonical document row in Postgres
5. replaces link rows and chunk rows
6. indexes chunk embeddings into Qdrant
7. marks the job and document statuses

The parsing and chunking logic lives in `packages/ai/src/knowledge_engine`.

### 2. Storage Model

Postgres is the source of truth.

The important stored objects are:

- `documents`
- `document_chunks`
- `document_links`
- `ingestion_jobs`
- `app_settings`

Sections are stored on the document row as normalized JSON. There is no separate `sections` table right now.

Embeddings are not stored in Postgres. The chunk rows carry embedding metadata, while the vectors themselves live in Qdrant.

### 3. Search And Retrieval

The active search entry point is `POST /v1/retrieval/search`.

`RetrievalService` does the following:

1. runs semantic retrieval in Qdrant when mode allows it
2. runs exact retrieval in Postgres full-text search when mode allows it
3. optionally uses Meilisearch only if it is configured
4. merges exact and semantic hits with reciprocal rank fusion
5. loads authoritative chunk and document metadata back from Postgres
6. reranks the chunks toward page titles, section titles, and query-supporting content

That means Qdrant helps find candidates, but Postgres remains the truth for what is rendered.

### 4. AI Reasoning

The active ask-page entry point is `POST /v1/documents/{document_id}/answer`.

`AnswerService` is intentionally page-first:

1. retrieve evidence from the current page
2. if evidence is too thin, widen to the rest of the same source
3. build citations from the retrieved chunks
4. send question plus evidence to the configured provider
5. return answer text, citations, and supporting passages

Provider behavior:

- default: deterministic extractive answer path
- optional: Ollama
- optional: OpenAI

The citation bundle comes from `packages/ai/src/knowledge_engine/prompting.py`.

### 5. Page Rendering

The active reader route is `/app/library/[slug]` in the web app. It loads data from `GET /v1/documents/slug/{slug}`.

The API returns:

- document metadata
- normalized sections
- backlinks
- related pages

The frontend then:

- builds reader sections and a table of contents
- renders the article body
- renders the ask-this-page panel below the article
- renders backlinks and related pages as exploration surfaces

Evidence links use the page slug plus section title to jump back into the article.

### 6. API Endpoints That Matter For The Core Flow

- `GET /health`
- `GET /v1/settings`
- `PUT /v1/settings`
- `GET /v1/imports/jobs`
- `GET /v1/imports/stats`
- `POST /v1/imports/ingest`
- `GET /v1/documents`
- `GET /v1/documents/sources`
- `GET /v1/documents/sources/{source_type}/{source_name}`
- `GET /v1/documents/slug/{slug}`
- `POST /v1/documents/{document_id}/answer`
- `POST /v1/retrieval/search`
- `POST /v1/documents/upload`

### 7. Frontend Data Flow

The active frontend data path is straightforward:

1. page component mounts
2. component calls `api.*` from `apps/web/lib/api.ts`
3. API returns typed payloads from `packages/shared/contracts`
4. component renders the product surface

Examples:

- imports page -> `getSettings`, `listImportJobs`, `getImportStats`, `triggerImport`
- library page -> `listSources`, `listDocuments`
- source page -> `getSourceDetail`
- reader page -> `getDocumentBySlug`, `answerDocument`
- search page -> `search`

## Active Vs Frozen

Active:

- `apps/web`
- `services/api`
- `services/worker` as optional ingest runtime
- `packages/ai`
- `packages/shared`

Frozen:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`

Compatibility routes still present in the API, but not part of the main product story:

- chat
- collections
- notes
