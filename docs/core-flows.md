# Core Flows

This document traces the four core runtime flows in the active Uintell system.

## 1. Import A Source

### Entrypoint

`apps/web/components/imports-workspace.tsx`

### Flow

`triggerImport()`  
-> `apps/web/lib/api.ts`  
-> `POST /v1/imports/ingest`  
-> `services/api/app/api/routes/imports.py::ingest_source()`  
-> `SettingsService.get_source_profile()`  
-> `SystemRepository.create_job()`  
-> `IngestionService.process_job()` or Temporal workflow start

### Modules involved

- `apps/web/components/imports-workspace.tsx`
- `apps/web/lib/api.ts`
- `services/api/app/api/routes/imports.py`
- `services/api/app/services/settings.py`
- `services/api/app/repositories/system.py`
- `services/api/app/services/ingestion.py`

### Output

A persisted ingestion job and a running import process for the selected source path.

## 2. Index Knowledge

### Entrypoint

`services/api/app/services/ingestion.py::process_job()`

### Flow

`process_job()`  
-> choose source iterator  
-> parse source files into `ParsedDocument`  
-> `_upsert_parsed_document()`  
-> `DocumentRepository.upsert_document()`  
-> `chunk_document()`  
-> `DocumentRepository.replace_links()`  
-> `DocumentRepository.replace_chunks()`  
-> `RetrievalService.index_chunks()`  
-> `RetrievalService.index_document()`  
-> `SystemRepository.update_job()`

### Modules involved

- `services/api/app/services/ingestion.py`
- `services/api/app/repositories/documents.py`
- `services/api/app/repositories/system.py`
- `services/api/app/services/retrieval.py`
- `packages/ai/src/knowledge_engine/filesystem_docs.py`
- `packages/ai/src/knowledge_engine/chunking.py`

### Output

Normalized documents, sections, links, and chunks in Postgres plus semantic chunk vectors in Qdrant.

## 3. Search Knowledge

### Entrypoint

`apps/web/components/search-workspace.tsx`

### Flow

`executeSearch()`  
-> `apps/web/lib/api.ts`  
-> `POST /v1/retrieval/search`  
-> `services/api/app/api/routes/retrieval.py::search()`  
-> `RetrievalService.search()`  
-> Qdrant semantic search  
-> Postgres full-text search  
-> rerank and hydrate chunks from Postgres  
-> return search results to the UI

### Modules involved

- `apps/web/components/search-workspace.tsx`
- `apps/web/lib/api.ts`
- `services/api/app/api/routes/retrieval.py`
- `services/api/app/services/retrieval.py`
- `services/api/app/repositories/documents.py`

### Output

A list of search results with title, source, section, snippet, and page jump targets.

## 4. Ask A Question About A Page

### Entrypoint

`apps/web/components/page-answer-panel.tsx`

### Flow

`askPage()`  
-> `apps/web/lib/api.ts`  
-> `POST /v1/documents/{document_id}/answer`  
-> `services/api/app/api/routes/documents.py::answer_about_document()`  
-> `AnswerService.answer_document_question()`  
-> page-scoped `RetrievalService.search()`  
-> optional source-scoped `RetrievalService.search()`  
-> `build_citation_bundle()`  
-> provider `generate()`  
-> return answer text, citations, and supporting passages

### Modules involved

- `apps/web/components/page-answer-panel.tsx`
- `apps/web/lib/api.ts`
- `services/api/app/api/routes/documents.py`
- `services/api/app/services/answers.py`
- `services/api/app/services/retrieval.py`
- `packages/ai/src/knowledge_engine/prompting.py`
- `services/api/app/services/providers.py`

### Output

A grounded answer with explicit citations, visible evidence, and links back into the reader.
