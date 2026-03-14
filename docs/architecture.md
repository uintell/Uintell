# Architecture

## Decision summary

The repo is being adapted rather than replaced. The live Rust stack stays in place while a clean Python/Next monorepo is added beside it. That avoids destructive migration pressure and makes it possible to validate the new product surface locally before any deployment cutover.

## Major components

### `apps/web`

- Next.js App Router
- strict TypeScript
- Tailwind styling
- authenticated shell
- streaming chat UI
- retrieval/search UI
- library/settings/admin views

The frontend talks directly to the FastAPI backend and relies on secure, `HttpOnly` session cookies with `credentials: include`.

### `services/api`

- FastAPI
- SQLAlchemy async ORM
- Alembic migrations
- Redis-backed rate limiting
- Qdrant-backed semantic retrieval
- OpenTelemetry hooks
- structured JSON logs

The API owns:

- auth/session validation
- conversation storage
- chat orchestration
- retrieval/search
- upload intake
- ingestion job creation
- admin/stat endpoints
- settings persistence

### `services/worker`

- Temporal worker
- thin workflows
- activity-driven ingestion execution

The worker deliberately reuses the API package’s data model and ingestion services instead of duplicating indexing logic.

### `packages/ai`

Shared Python package containing:

- Arch Wiki parsing
- Wikipedia dump parsing
- filesystem document parsing
- chunking
- embeddings abstraction
- RAG prompt assembly

### `packages/shared`

TypeScript contracts shared by the frontend so the API payload shapes remain explicit and centralized.

## Retrieval architecture

Retrieval is hybrid by construction:

1. Embed the query.
2. Search Qdrant semantically.
3. Search PostgreSQL full-text on chunk text.
4. Merge ranks with reciprocal rank fusion.
5. Load authoritative chunk payloads from PostgreSQL.
6. Build citations and context blocks for answer synthesis.

This avoids overfitting the platform to a single retrieval primitive and keeps the source of truth in PostgreSQL.

## Ingestion architecture

All sources normalize into the same document and chunk model.

Flow:

1. Create ingestion job.
2. Temporal workflow executes `run_ingestion_job`.
3. Source parser yields normalized documents.
4. Documents are deduplicated by `(source_name, canonical_id)` and `sha256`.
5. Chunks replace prior chunk rows for changed documents.
6. Chunk vectors are upserted into Qdrant.
7. Job progress is stored in PostgreSQL.

## AI provider boundary

The LLM provider is isolated behind `LLMProvider`.

Current providers:

- `OpenAIResponsesProvider`
- `DeterministicRagProvider`

This is the main extensibility seam for later vLLM/Ollama/local-model support.

## Production hardening still needed

- stronger CSRF protection for cookie auth
- pinned Temporal image tags
- more granular authz and admin RBAC
- secret management beyond env files
- retry/failure DLQ visibility in a dedicated admin view
- frontend telemetry export wiring
