# Code Map

## Top-Level Directories

## `apps/`

- `apps/web` — ACTIVE
  The primary Next.js product UI.
  Depends on: `packages/shared`, `services/api`.
  Depended on by: end users and the product flow.

- `apps/backend` — LEGACY
  Frozen Rust backend from an older architecture.
  Depends on: its own legacy stack.
  Depended on by: nothing in the active product path.

- `apps/frontend` — LEGACY
  Frozen frontend from an older architecture.
  Depends on: its own legacy stack.
  Depended on by: nothing in the active product path.

## `services/`

- `services/api` — ACTIVE
  Main FastAPI application.
  Depends on: Postgres, Qdrant, `packages/ai`.
  Depended on by: `apps/web`, optional `services/worker`.

- `services/worker` — OPTIONAL
  Temporal worker for durable ingestion workflows.
  Depends on: `services/api` modules, Temporal, Qdrant, Postgres, `packages/ai`.
  Depended on by: optional durable-ingest deployments only.

## `packages/`

- `packages/ai` — ACTIVE
  Parsing, chunking, prompting, embeddings, and source iterators.
  Depends on: Python libraries only.
  Depended on by: `services/api`, `services/worker`.

- `packages/shared` — ACTIVE
  Shared TypeScript contracts used by the web app.
  Depends on: none.
  Depended on by: `apps/web`.

## `infra/`

- `infra/docker` — ACTIVE
  Container build definitions for the active and frozen services.

- `infra/nginx` — OPTIONAL
  Deployment routing examples and host configuration.

- `infra/systemd` — OPTIONAL
  Deployment units. Some entries still reflect older naming and should be treated carefully.

- `infra/scripts/install-wikijs.sh` — REMOVE LATER
  Not part of the current product direction.

## `data/`

- `data/demo` — ACTIVE
  Small demo sources for smoke testing and onboarding.

- `data/local-docs` — ACTIVE
  Small local example documents.

- `data/imports/README.md` — ACTIVE
  Guidance for external import locations.

## Major Active Modules

| Module | Status | What it does | Depends on | Depended on by |
| --- | --- | --- | --- | --- |
| `services/api/app/main.py` | ACTIVE | Wires the active API container and runtime services | config, db, repositories, services | FastAPI runtime |
| `services/api/app/services/ingestion.py` | ACTIVE | Runs the normalization and indexing pipeline for one job | `DocumentRepository`, `SystemRepository`, `RetrievalService`, `packages/ai` | imports API, optional worker |
| `services/api/app/services/retrieval.py` | ACTIVE | Executes hybrid retrieval over Postgres and Qdrant | `DocumentRepository`, Qdrant, embedding provider | search API, answering, chat tools |
| `services/api/app/services/answers.py` | ACTIVE | Builds page-scoped grounded answers with citations | `DocumentRepository`, `RetrievalService`, provider layer | documents API |
| `services/api/app/repositories/documents.py` | ACTIVE | Owns document, chunk, link, source, and relationship queries | SQLAlchemy models | ingestion, retrieval, documents API |
| `services/api/app/repositories/system.py` | ACTIVE | Owns ingestion jobs, settings, audits, tool executions | SQLAlchemy models | imports API, settings service, ingestion, tools |
| `services/api/app/api/routes/imports.py` | ACTIVE | Import registration and status endpoints | settings service, ingestion service, `SystemRepository` | `apps/web` imports page |
| `services/api/app/api/routes/documents.py` | ACTIVE | Source list, source detail, document detail, ask-page, upload | `DocumentRepository`, answer service, ingestion | library, source detail, reader |
| `services/api/app/api/routes/retrieval.py` | ACTIVE | Search endpoint | retrieval service | search UI |
| `apps/web/lib/api.ts` | ACTIVE | Single fetch client for the active web UI | browser fetch, shared contracts | all active web components |
| `apps/web/components/imports-workspace.tsx` | ACTIVE | Source registry and ingestion status UI | `api.ts` | `/app/imports` |
| `apps/web/components/library-workspace.tsx` | ACTIVE | Source list and document list UI | `api.ts` | `/app/library` |
| `apps/web/components/source-detail-workspace.tsx` | ACTIVE | Source-level browsing | `api.ts` | `/app/library/source/...` |
| `apps/web/components/document-reader-workspace.tsx` | ACTIVE | Reader shell, TOC state, ask-page placement | `api.ts`, reader components | `/app/library/[slug]` |
| `apps/web/components/page-answer-panel.tsx` | ACTIVE | Page-scoped answer UI and evidence display | `api.ts`, reader link helpers | reader page |
| `apps/web/components/search-workspace.tsx` | ACTIVE | Search UI and result presentation | `api.ts` | `/app/search` |
| `packages/ai/src/knowledge_engine/filesystem_docs.py` | ACTIVE | Parses files and local docs into normalized documents | filesystem libraries | ingestion service |
| `packages/ai/src/knowledge_engine/chunking.py` | ACTIVE | Splits normalized sections into retrieval chunks | `ParsedDocument` | ingestion service |
| `packages/ai/src/knowledge_engine/prompting.py` | ACTIVE | Builds citation bundles and provider messages | retrieved chunks | answering and provider layer |

## Compatibility And Legacy Modules

| Module or area | Status | Note |
| --- | --- | --- |
| `services/api/app/api/routes/chat.py` | LEGACY | Still present, not part of the main product loop |
| `services/api/app/api/routes/collections.py` | LEGACY | Compatibility surface only |
| `services/api/app/api/routes/notes.py` | LEGACY | Compatibility surface only |
| `services/api/app/repositories/conversations.py` | LEGACY | Supports chat path, not core loop |
| `services/api/app/repositories/collections.py` | LEGACY | Supports frozen product ideas |
| `services/api/app/repositories/notes.py` | LEGACY | Supports frozen product ideas |
| `apps/web/app/app/chat` | LEGACY | Frozen route notice |
| `apps/web/app/app/collections` | LEGACY | Frozen route notice |
| `apps/web/app/app/notes` | LEGACY | Frozen route notice |
| `apps/web/app/app/admin/page.tsx` | REMOVE LATER | Compatibility redirect to `/app/imports` |

## Mental Model For Active Development

If you are working on the core product, start here:

1. `apps/web`
2. `services/api/app/api/routes/documents.py`
3. `services/api/app/services/ingestion.py`
4. `services/api/app/services/retrieval.py`
5. `services/api/app/services/answers.py`
6. `services/api/app/repositories/documents.py`
7. `packages/ai/src/knowledge_engine`

Everything else is optional, frozen, or downstream of those files.
