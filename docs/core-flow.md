# Core Flow

This document traces the exact component sequence for the main product loop.

## 1. User Imports A Source

### User action

The user opens `/app/imports`, registers a source profile, and clicks `Run import`.

### Component sequence

1. `apps/web/components/imports-workspace.tsx`
2. `apps/web/lib/api.ts -> POST /v1/imports/ingest`
3. `services/api/app/api/routes/imports.py`
4. `SettingsService` resolves the selected source profile
5. `SystemRepository.create_job()` inserts an `ingestion_jobs` row
6. API starts ingestion directly or via Temporal

### Result

The system now has a durable job record and a source configuration for the import.

## 2. System Indexes Knowledge

### Default local path

The API runs `IngestionService.process_job()` in the background.

### Optional durable path

Temporal starts a workflow and `services/worker` runs the same ingestion service.

### Component sequence

1. `services/api/app/services/ingestion.py`
2. choose iterator:
   - `iter_filesystem_documents`
   - `iter_wikipedia_documents`
   - `iter_archwiki_documents`
3. parser returns `ParsedDocument`
4. `_apply_document_overrides()` merges profile metadata
5. `DocumentRepository.upsert_document()` writes the canonical document row
6. `chunk_document()` creates chunk payloads
7. `DocumentRepository.replace_links()` writes outgoing links
8. `DocumentRepository.replace_chunks()` writes `document_chunks`
9. `RetrievalService.index_chunks()` writes vectors to Qdrant
10. `RetrievalService.index_document()` updates Meilisearch only if configured
11. `SystemRepository.update_job()` updates progress and final status

### Result

The imported source is now normalized into documents, sections, links, and chunks. Postgres is canonical. Qdrant is ready for semantic retrieval.

## 3. User Searches Knowledge

### User action

The user opens `/app/search` and submits a query.

### Component sequence

1. `apps/web/components/search-workspace.tsx`
2. `apps/web/lib/api.ts -> POST /v1/retrieval/search`
3. `services/api/app/api/routes/retrieval.py`
4. `RetrievalService.search()`
5. `_semantic_search()` queries Qdrant when enabled by mode
6. `DocumentRepository.keyword_search()` queries Postgres full-text search when enabled by mode
7. result ids are merged and reranked
8. `DocumentRepository.fetch_retrieved_chunks()` loads final chunk metadata from Postgres
9. API returns title, source, section, snippet, and score

### Result

The search page shows reader-friendly results that can jump to a page or directly to a section.

## 4. User Opens A Page

### User action

The user opens `/app/library/{slug}`.

### Component sequence

1. `apps/web/components/document-reader-workspace.tsx`
2. `apps/web/lib/api.ts -> GET /v1/documents/slug/{slug}`
3. `services/api/app/api/routes/documents.py`
4. `DocumentRepository.get_document_by_slug()`
5. `DocumentRepository.list_backlinks()`
6. `DocumentRepository.list_related()`
7. API returns `DocumentDetailResponse`
8. frontend builds reader sections and TOC
9. frontend renders:
   - article body
   - source metadata
   - TOC
   - ask-this-page panel
   - backlinks and related pages

### Result

The reader page becomes the main product surface.

## 5. User Asks A Question About The Page

### User action

The user enters a question into `Ask this page`.

### Component sequence

1. `apps/web/components/page-answer-panel.tsx`
2. `apps/web/lib/api.ts -> POST /v1/documents/{document_id}/answer`
3. `services/api/app/api/routes/documents.py`
4. `AnswerService.answer_document_question()`
5. `DocumentRepository.get_document()` resolves page context
6. `RetrievalService.search()` runs page-scoped retrieval
7. if evidence is thin, `RetrievalService.search()` runs again at source scope
8. `build_citation_bundle()` turns retrieved chunks into citations
9. provider layer generates answer text
10. API returns:
    - answer text
    - scope used
    - citations
    - supporting passages
    - provider metadata
11. UI renders answer and evidence separately

### Result

The user gets a grounded answer with citations and supporting passages that link back into the source material.

## Summary Diagram

```text
imports page
  -> /v1/imports/ingest
  -> ingestion job
  -> parsing + normalization
  -> Postgres documents/chunks/links
  -> Qdrant vectors

search page
  -> /v1/retrieval/search
  -> Postgres exact + Qdrant semantic
  -> reranked chunks

reader page
  -> /v1/documents/slug/{slug}
  -> document + backlinks + related

ask this page
  -> /v1/documents/{id}/answer
  -> page-first retrieval
  -> citations + supporting passages
```
