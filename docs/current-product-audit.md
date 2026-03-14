# Current Product Audit

Uintell currently has one active product loop:

`import source -> browse source -> read page -> ask page -> cited answer`

## Active Vs Frozen Code

Active product path:

- `apps/web`
- `services/api`
- `services/worker`
- `packages/ai`
- `packages/shared`

Frozen paths:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`
- the old chat, notes, and collections product surfaces

## How Source Registration And Import Work

Source registration is profile-based.

- The web import screen in [imports-workspace.tsx](/home/x1/projectx/apps/web/components/imports-workspace.tsx) reads source profiles from `GET /v1/settings` and saves them with `PUT /v1/settings`.
- Profiles define the local path, source type, source name, document kind, and tags that should be applied during normalization.
- Running an import calls `POST /v1/imports/ingest` in [imports.py](/home/x1/projectx/services/api/app/api/routes/imports.py).
- That route resolves the chosen profile, creates an ingestion job through [admin.py](/home/x1/projectx/services/api/app/repositories/admin.py), and then starts ingestion:
- directly in the API process with `asyncio.create_task(...)` by default
- or through Temporal when the optional durable-ingest path is enabled

## How Ingestion Status Is Surfaced

Ingestion jobs are stored in PostgreSQL and surfaced directly in the product.

- [ingestion.py](/home/x1/projectx/services/api/app/services/ingestion.py) updates job state and progress counters such as `processed`, `indexed`, `skipped`, and `failed`.
- `GET /v1/imports/jobs` returns recent jobs.
- `GET /v1/imports/stats` returns source-level and indexing-level counts.
- [imports-workspace.tsx](/home/x1/projectx/apps/web/components/imports-workspace.tsx) shows both the source registry and recent job activity in one place.

## How Library And Source Browsing Work

Browsing is built on normalized documents and sources, not on a wiki-CMS model.

- [library-workspace.tsx](/home/x1/projectx/apps/web/components/library-workspace.tsx) loads:
- `GET /v1/documents`
- `GET /v1/documents/sources`
- [source-detail-workspace.tsx](/home/x1/projectx/apps/web/components/source-detail-workspace.tsx) loads `GET /v1/documents/sources/{source_type}/{source_name}`.
- Those endpoints are implemented in [documents.py](/home/x1/projectx/services/api/app/api/routes/documents.py) and backed by [documents.py](/home/x1/projectx/services/api/app/repositories/documents.py).
- PostgreSQL stays authoritative for source summaries, document metadata, links, backlinks, and related-page heuristics.

## How Article Pages Are Rendered

The reader route is document-detail first.

- The page loads `GET /v1/documents/slug/{slug}`.
- [documents.py](/home/x1/projectx/services/api/app/api/routes/documents.py) builds the payload from the `documents` table plus normalized section data and connection data.
- [document-reader-workspace.tsx](/home/x1/projectx/apps/web/components/document-reader-workspace.tsx) turns that payload into the reader screen.
- [document-body.tsx](/home/x1/projectx/apps/web/components/document-body.tsx) renders the body using three paths:
- markdown from `raw_content`
- code-style rendering for code-like files
- normalized sections or plain text for everything else

## How Backlinks And Related Pages Work

Backlinks are explicit. Related pages are heuristic.

- Backlinks come from [DocumentLink](/home/x1/projectx/services/api/app/models/entities.py) rows resolved during ingestion.
- [list_backlinks](/home/x1/projectx/services/api/app/repositories/documents.py) returns documents that link to the current document.
- [list_related](/home/x1/projectx/services/api/app/repositories/documents.py) combines:
- direct outgoing links from the current page
- backlink relationships
- shared tags
- same-source affinity
- The reader shows both backlinks and related pages in the right rail.

## How Page-Scoped AI Answers Work

Ask-page is page-first by design.

- [page-answer-panel.tsx](/home/x1/projectx/apps/web/components/page-answer-panel.tsx) calls `POST /v1/documents/{document_id}/answer`.
- [answers.py](/home/x1/projectx/services/api/app/services/answers.py) loads the current document, retrieves from the current page first, and broadens to the current source only when page evidence is thin.
- The provider path then generates an answer from the retrieved chunk bundle.
- The default generation path remains the deterministic extractive provider, with OpenAI and Ollama kept optional.

## How Citations And Supporting Passages Are Attached

Citations are generated from retrieved chunks, not written by hand.

- [prompting.py](/home/x1/projectx/packages/ai/src/knowledge_engine/prompting.py) assigns labels like `S1`, `S2`, and carries document, section, and source metadata into the citation bundle.
- [answers.py](/home/x1/projectx/services/api/app/services/answers.py) pairs that bundle with clipped supporting passages from the same retrieved chunks.
- The reader UI renders:
- inline citation chips in the answer
- a citation list
- supporting passage cards with jump links back into the reader

## Where Hybrid Retrieval Lives

Hybrid retrieval is implemented in [retrieval.py](/home/x1/projectx/services/api/app/services/retrieval.py).

Current path:

1. PostgreSQL full-text keyword search over chunk text
2. Qdrant semantic vector search
3. reciprocal-rank fusion of result IDs
4. PostgreSQL hydration of authoritative chunk and document payloads
5. lightweight filtering and ranking before results are returned

Optional behavior:

- Meilisearch can help prefilter at the document layer when enabled
- it is not required for the default stack

## Biggest Current UX Weaknesses

- The reader is strong, but source browsing still feels more utilitarian than polished.
- Search results have been useful but not always sharply ranked or excerpted around the user’s actual query.
- The ask-page experience has been grounded, but the evidence relationship has not always been obvious enough at a glance.
- The import screen exposes the right capabilities, but the progress view still feels closer to a raw operations list than a calm product surface.

## Biggest Current Code Clarity Weaknesses

- Some ingestion naming still comes from the older admin-oriented architecture, especially `AdminRepository`.
- Active frontend screens still mix explicit palette classes with older token-based classes, which makes theme behavior harder to reason about.
- The repo still contains frozen compatibility APIs and surfaces that are no longer part of the main product story.
- There are now multiple audit/plan docs from adjacent sprints, which should be treated carefully so the current product story stays singular.
