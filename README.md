# Uintell

Uintell is an offline-first AI knowledge system for wiki imports, books, notes, and technical documentation.

The product is being focused around one primary flow:

`import source -> browse source -> read page -> ask page -> cited answer`

This repo is not being developed as a generic AI platform. The goal is a serious, reader-first knowledge tool with grounded answers and visible evidence.

## Product Scope

The primary user experience is:

1. register or import a local source
2. wait for ingestion and indexing
3. browse the source like a library
4. open a page/article
5. ask AI about that page
6. receive a grounded answer with citations
7. navigate to related pages and supporting passages

## Default Architecture

Default product stack:

- `apps/web`: Next.js App Router frontend
- `services/api`: FastAPI backend
- `PostgreSQL`: source of truth for normalized knowledge objects
- `Qdrant`: vector retrieval

Optional, not required by default:

- Ollama for local generation/embeddings
- OpenAI for hosted generation/embeddings
- Temporal worker for durable ingestion workflows
- Meilisearch for extra document-level search acceleration
- Redis for distributed rate limiting

The default local path is intentionally smaller than the repo’s historical scaffolding.

## What Is Frozen

These paths are frozen except for migration support, compatibility work, or critical fixes:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`

The active product path is the Python/Next stack under:

- `apps/web`
- `services/api`
- `services/worker`
- `packages/ai`
- `packages/shared`

## Repo Layout

```text
.
├── apps
│   ├── web                # primary Next.js reader/search frontend
│   ├── backend            # frozen legacy Rust backend
│   └── frontend           # frozen legacy Next frontend
├── services
│   ├── api                # primary FastAPI API
│   └── worker             # optional Temporal worker
├── packages
│   ├── ai                 # parsing, chunking, retrieval prompt helpers
│   └── shared             # shared frontend contracts
├── docs
├── infra
├── data
│   └── local-docs         # small checked-in demo docs only
└── legacy
```

## Code Vs Data

Code should stay in the repo. Large mutable data should not.

By default:

- runtime storage goes under `/data/uintell/storage`
- large imports go under `/data/uintell/imports/...`
- checked-in repo data is limited to small demo material under `data/local-docs`

This repo should not be the default home for:

- Wikipedia dumps
- extracted tarballs
- runtime uploads
- generated indexes
- caches
- local virtualenvs
- large mutable corpora

See:

- [docs/local-development.md](docs/local-development.md)
- [docs/runtime-data.md](docs/runtime-data.md)
- [docs/progress.md](docs/progress.md)

## Local Development

### 1. Configure env

Use the service env templates and set your own local values:

```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
cp services/worker/.env.example services/worker/.env
cp apps/web/.env.example apps/web/.env.local
```

Do not leave seeded credentials unchanged. Set `SEED_ADMIN_PASSWORD` in your local env before running the seed flow.

### 2. Start the focused default stack

```bash
docker compose up --build
```

Default services:

- `postgres`
- `qdrant`
- `api`
- `web`

### 3. Optional profiles

Enable only what you actually need:

```bash
docker compose --profile local-llm up --build
docker compose --profile durable-ingest up --build
docker compose --profile advanced up --build
```

Profiles:

- `local-llm`: Ollama
- `durable-ingest`: Temporal, Temporal UI, worker
- `advanced`: Redis and Meilisearch

### 4. Open the product

- Web: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

## Current Vertical Slice

Implemented and being refined:

- source registration/import
- ingestion status visibility
- source/library browsing
- article reader with table of contents, backlinks, and related pages
- page-scoped AI answers with citations and supporting passages
- hybrid retrieval over normalized document/chunk data

## Documentation Map

- [docs/progress.md](docs/progress.md): current execution plan and milestones
- [docs/local-development.md](docs/local-development.md): recommended local setup
- [docs/runtime-data.md](docs/runtime-data.md): code/data/runtime separation
- [docs/architecture.md](docs/architecture.md): focused architecture notes
- [docs/deployment.md](docs/deployment.md): deployment and advanced runtime notes

## Guiding Principles

- reader-first over dashboard-first
- citation-first over AI theater
- offline-first over cloud dependency
- one strong vertical slice over broad unfinished surfaces
- simpler defaults over infrastructure sprawl
