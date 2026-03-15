# Core Modules

These are the ten most important modules in the active Uintell architecture.

## 1. `services/api/app/main.py`

What it does: wires the live FastAPI application and builds the service container.  
Why it exists: this is the real runtime composition root.  
What it depends on: config, repositories, services, database session setup, Qdrant, optional Temporal/Redis.  
What depends on it: the API process.

## 2. `services/api/app/services/ingestion.py`

What it does: runs the import pipeline from job to normalized documents and indexed chunks.  
Why it exists: it is the bridge between raw source files and the knowledge store.  
What it depends on: `DocumentRepository`, `SystemRepository`, `RetrievalService`, `packages/ai`.  
What depends on it: imports API, optional worker.

## 3. `services/api/app/repositories/system.py`

What it does: stores ingestion jobs, settings, audit events, and tool executions.  
Why it exists: the active code needs one place for system state that is not part of the document graph.  
What it depends on: SQLAlchemy entities.  
What depends on it: imports route, settings service, ingestion service, tool registry.

## 4. `services/api/app/repositories/documents.py`

What it does: owns document, chunk, link, source, backlink, and related-page queries.  
Why it exists: it is the canonical data access layer for the knowledge model.  
What it depends on: SQLAlchemy entities and sessions.  
What depends on it: documents API, ingestion, retrieval, answers.

## 5. `services/api/app/services/retrieval.py`

What it does: runs hybrid retrieval across Postgres and Qdrant.  
Why it exists: search and answer generation both need the same retrieval path.  
What it depends on: `DocumentRepository`, Qdrant, embedding provider, optional Meilisearch.  
What depends on it: retrieval API, answer service, chat tools.

## 6. `services/api/app/services/answers.py`

What it does: builds page-scoped grounded answers with citations and supporting passages.  
Why it exists: it keeps ask-page logic separate from raw retrieval and raw provider calls.  
What it depends on: `DocumentRepository`, `RetrievalService`, provider layer.  
What depends on it: documents API.

## 7. `packages/ai/src/knowledge_engine/filesystem_docs.py`

What it does: parses filesystem docs, markdown, HTML, PDF, EPUB, and related source inputs into normalized documents.  
Why it exists: ingestion needs source-specific parsing before the rest of the pipeline can stay generic.  
What it depends on: parsing libraries and `ParsedDocument`.  
What depends on it: ingestion service.

## 8. `packages/ai/src/knowledge_engine/chunking.py`

What it does: turns normalized sections into chunk payloads for retrieval.  
Why it exists: chunking is the unit boundary between stored documents and searchable evidence.  
What it depends on: `ParsedDocument`, `ChunkPayload`.  
What depends on it: ingestion service.

## 9. `apps/web/lib/api.ts`

What it does: provides the single frontend fetch layer for the active web app.  
Why it exists: frontend pages should not hand-build API calls everywhere.  
What it depends on: browser fetch and shared contracts.  
What depends on it: imports, library, source detail, search, reader, settings.

## 10. `apps/web/components/document-reader-workspace.tsx`

What it does: orchestrates the reader page, including document loading, TOC state, answer panel placement, and exploration surfaces.  
Why it exists: the article page is the main product surface.  
What it depends on: `api.ts`, document body, reader sidebar, answer panel, exploration components.  
What depends on it: `/app/library/[slug]`.
