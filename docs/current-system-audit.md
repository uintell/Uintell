# Current System Audit

Superseded by [docs/current-product-audit.md](/home/x1/projectx/docs/current-product-audit.md). Keep this file only as prior sprint context.

Uintell currently has one active product loop:

`import source -> browse source -> read page -> ask page -> cited answer`

## Active And Frozen Code

Active path:

- `apps/web`
- `services/api`
- `services/worker`
- `packages/ai`
- `packages/shared`

Frozen path:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`
- the old chat, notes, and collections product surfaces

## How Sources Are Registered And Imported

Source registration is profile-based.

- The web imports screen in [imports-workspace.tsx](/home/x1/projectx/apps/web/components/imports-workspace.tsx) reads and writes source profiles through `GET/PUT /v1/settings`.
- Source profiles are assembled in [settings.py](/home/x1/projectx/services/api/app/services/settings.py), with default demo and local-path profiles stored as app settings in PostgreSQL.
- Running an import calls `POST /v1/imports/ingest` in [imports.py](/home/x1/projectx/services/api/app/api/routes/imports.py).
- That route resolves the selected profile, builds document overrides, creates an ingestion job through [admin.py](/home/x1/projectx/services/api/app/repositories/admin.py), and then starts ingestion either:
- directly in the API process with `asyncio.create_task(...)`, or
- through Temporal when that optional worker path is configured.

## How Ingestion Status Is Stored And Shown

Ingestion status is stored in PostgreSQL as ingestion jobs.

- Jobs are created and updated by [admin.py](/home/x1/projectx/services/api/app/repositories/admin.py).
- The import pipeline in [ingestion.py](/home/x1/projectx/services/api/app/services/ingestion.py) updates job state from `pending` to `running` to `succeeded` or `failed`, with progress counters for `processed`, `indexed`, `skipped`, and `failed`.
- The web imports screen shows those jobs through `GET /v1/imports/jobs` and summary counts through `GET /v1/imports/stats`.
- The home dashboard also surfaces recent import activity via `api.listImportJobs()`.

## How Source Browsing Works

Source and document browsing is document-first, not wiki-CMS-first.

- The library screen in [library-workspace.tsx](/home/x1/projectx/apps/web/components/library-workspace.tsx) calls:
- `GET /v1/documents`
- `GET /v1/documents/sources`
- The source detail page in [source-detail-workspace.tsx](/home/x1/projectx/apps/web/components/source-detail-workspace.tsx) calls `GET /v1/documents/sources/{source_type}/{source_name}`.
- Those endpoints are implemented in [documents.py](/home/x1/projectx/services/api/app/api/routes/documents.py) and backed by [documents.py](/home/x1/projectx/services/api/app/repositories/documents.py).
- PostgreSQL remains the source of truth for documents, sections, tags, links, backlinks, and related-document heuristics.

## How The Article Page Is Built

The article reader is a document detail page.

- The reader route loads `GET /v1/documents/slug/{slug}`.
- The API assembles document detail in [documents.py](/home/x1/projectx/services/api/app/api/routes/documents.py) by combining:
- document fields from the `documents` table
- `sections_json`
- backlinks from `document_links`
- related pages from source, backlink, and shared-tag heuristics
- The frontend reader in [document-reader-workspace.tsx](/home/x1/projectx/apps/web/components/document-reader-workspace.tsx) builds page sections from the returned document.
- Rendering is handled by [document-body.tsx](/home/x1/projectx/apps/web/components/document-body.tsx):
- markdown documents render from `raw_content`
- code-like documents render as code blocks
- everything else falls back to section/plain-text rendering

## How Ask-Page AI Works

Ask-page is page-scoped first.

- The UI lives in [page-answer-panel.tsx](/home/x1/projectx/apps/web/components/page-answer-panel.tsx).
- It posts to `POST /v1/documents/{document_id}/answer`.
- The answer path is implemented in [answers.py](/home/x1/projectx/services/api/app/services/answers.py).
- The flow is:
1. load the current document
2. retrieve from the current page only
3. if page evidence is too thin, broaden to the current source
4. build citations from the retrieved chunks
5. generate an answer through the configured provider

The default generation path is still small-stack friendly:

- default provider: deterministic extractive synthesis
- optional providers: OpenAI or Ollama

## How Citations And Supporting Passages Are Generated

Citations are chunk-based, not hand-written footnotes.

- [prompting.py](/home/x1/projectx/packages/ai/src/knowledge_engine/prompting.py) assigns source labels like `S1`, `S2`, and includes title, section title, source type, and source name.
- [answers.py](/home/x1/projectx/services/api/app/services/answers.py) pairs those citations with supporting passages clipped from the retrieved chunks.
- The reader UI shows:
- inline citation references inside the answer text
- a citation list
- supporting passage cards with direct links back to the cited page or section

## Where Hybrid Retrieval Is Implemented

Hybrid retrieval is implemented in [retrieval.py](/home/x1/projectx/services/api/app/services/retrieval.py).

The current path is:

1. PostgreSQL full-text keyword search over chunk text
2. Qdrant semantic vector search
3. reciprocal-rank fusion of the result IDs
4. authoritative chunk hydration from PostgreSQL
5. light query-support filtering to remove weak semantic false positives

Optional behavior:

- Meilisearch can prefilter document IDs when configured
- it is not required for the default stack

## Minimum Runtime For The Core Flow

The main vertical slice only needs:

- `postgres`
- `qdrant`
- `api`
- `web`

Everything else is optional and should stay optional unless it directly improves the same import/browse/read/ask loop.
