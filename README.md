# United Intelligence

United Intelligence is a local-first knowledge platform for reader-focused documents, notes, books, and wiki imports. The new platform lives alongside the existing Rust/Axum prototype so the legacy deployment path stays intact while the Python/Next stack is evolved into the primary product surface.

## Repo layout

```text
.
├── apps
│   ├── web                # Next.js frontend (TypeScript + Tailwind)
│   ├── backend            # legacy Rust backend kept in place
│   └── frontend           # legacy Next frontend kept in place
├── services
│   ├── api                # FastAPI application
│   └── worker             # Temporal worker for ingestion/indexing
├── packages
│   ├── ai                 # shared parsing/chunking/embedding/RAG helpers
│   └── shared             # shared TypeScript contracts
├── infra
│   └── docker             # Dockerfiles and bootstrap scripts
├── docs
│   ├── architecture.md
│   ├── deployment.md
│   ├── progress.md
│   └── rag_pipeline.md
├── data
│   └── local-docs         # optional extra local documents
├── docker-compose.yml
└── Makefile
```

## What is implemented

- FastAPI backend with:
  - auth endpoints and secure session cookies
  - streaming chat endpoint
  - retrieval/search endpoint with exact, semantic, and hybrid modes
  - upload endpoint
  - document library endpoints
  - admin ingestion and stats endpoints
  - settings endpoint
  - health/readiness endpoints
- Temporal worker with ingestion workflows for:
  - Markdown/TXT notes
  - EPUB/PDF/books and long-form local documents
  - Wikipedia dumps
  - Arch Wiki HTML mirrors
  - uploaded files
- Offline-first knowledge package with:
  - Arch Wiki HTML parsing
  - Wikipedia multistream XML parsing
  - local document parsing for markdown, HTML, PDF, TXT, and code
  - chunking and embedding abstractions
  - deterministic fallback generation
  - OpenAI-ready provider abstraction
- Next.js web app with:
  - landing page
  - login page
  - authenticated dashboard
  - streaming chat UI
  - hybrid search page
  - document library and reader pages
  - notes and collections pages
  - settings page
  - admin import dashboard
- Infra:
  - Docker Compose for Postgres, Redis, Qdrant, Meilisearch, Ollama, Temporal, Temporal UI, API, worker, and web
  - Alembic migrations
  - seed script for default admin bootstrap
  - env templates and Make targets

## Quick start

1. Copy env examples if you want local overrides.

```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
cp services/worker/.env.example services/worker/.env
cp apps/web/.env.example apps/web/.env.local
```

2. Start the stack.

```bash
make up
```

3. Run migrations and seed the default admin.

```bash
make migrate
make seed-admin
```

4. Open the apps.

- Web: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- Temporal UI: `http://localhost:8233`
- Wiki.js can be deployed separately on `wiki.uintell.org`; see `docs/wiki-js.md`

Default bootstrap credentials:

- Email: `admin@uintell.org`
- Password: `ChangeMeNow123!`

Change them before exposing the stack anywhere outside local development.

## Ingestion flows

Trigger ingestion from the admin page or the API directly. The recommended flow is to register source profiles in the Admin page and ingest from there, but the raw endpoint still works:

```bash
curl -X POST http://localhost:8000/v1/admin/ingest \
  -H 'content-type: application/json' \
  -d '{"source_type":"filesystem","target_path":"/workspace/data/demo/notes","document_kind":"note","source_name":"demo_notes"}'
```

```bash
curl -X POST http://localhost:8000/v1/admin/ingest \
  -H 'content-type: application/json' \
  -d '{"source_type":"filesystem","target_path":"/workspace/data/demo/library","document_kind":"book","source_name":"demo_library"}'
```

```bash
curl -X POST http://localhost:8000/v1/admin/ingest \
  -H 'content-type: application/json' \
  -d '{"profile_id":"wikipedia-dump","limit":1000}'
```

## Development commands

- `make up`
- `make down`
- `make logs`
- `make migrate`
- `make seed-admin`
- `make test-ai`
- `make test-api`
- `make test-worker`
- `make test-web`

## OpenAI integration

The default local path is Ollama plus local embeddings. OpenAI remains optional.

Behavior:

- with Ollama available: local generation and embeddings are used
- with an OpenAI API key and opt-in settings: OpenAI can be used as an alternate provider
- without either: the system still runs using retrieval and the deterministic fallback provider

This keeps the product usable in offline/local mode while preserving a clean upgrade path to alternative model backends.

## Current caveats

- The new Python/Next platform is a serious scaffold, not a fully hardened internet-facing product yet.
- Temporal image tags are currently `latest` in Compose for local reliability; pin them before production.
- The worker ingests incrementally and idempotently, but Wikipedia resume semantics are currently skip-based rather than offset-checkpoint based.
- Frontend E2E coverage is not implemented yet; the current smoke bar is a production build.

## Legacy system

The previous Rust/Axum stack remains under `apps/backend`, `apps/frontend`, and `legacy/uintell-site`. It is intentionally not removed during this transition.
