# Uintell

Uintell is a reader-first knowledge engine for technical knowledge with cited AI explanations.

The core loop is:

`import -> search -> read -> ask -> cited answer`

## What The Product Does

- register or upload local knowledge sources
- normalize them into documents, sections, links, and chunks
- browse sources and open reader pages
- search across the knowledge base
- ask page-scoped questions and inspect the evidence behind the answer
- follow related pages, backlinks, and section jumps without leaving the reader

This repo is not being developed as a generic AI platform. The active product is the knowledge loop above.

## Active Product Path

- `apps/web`: Next.js reader/search/import UI
- `services/api`: FastAPI API and core orchestration
- `services/worker`: optional Temporal worker for durable ingestion
- `packages/ai`: parsing, chunking, prompting, embeddings
- `packages/shared`: frontend contracts

Frozen paths:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`

## Default Local Stack

The default local flow should stay small:

- `postgres`
- `qdrant`
- `api`
- `web`

Optional only:

- Ollama
- OpenAI
- Temporal + worker
- Meilisearch
- Redis

Start the default stack with:

```bash
docker compose up --build
```

## System In One Diagram

```text
Local sources / uploads
        |
        v
  Import registration
        |
        v
   Ingestion pipeline
        |
        v
PostgreSQL knowledge store
        |
        +--> Qdrant vector index
        |
        v
 Search / retrieval
        |
        v
 Page-scoped answering
        |
        v
   Reader-first web UI
```

## Read These First

- [docs/how-the-system-works.md](docs/how-the-system-works.md)
- [docs/system-map.md](docs/system-map.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/code-map.md](docs/code-map.md)
- [docs/core-flow.md](docs/core-flow.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/local-development.md](docs/local-development.md)

## Repo Layout

```text
apps/       web product surfaces, plus frozen legacy frontends
services/   API and optional worker
packages/   shared parsing/AI/contracts
infra/      Docker, nginx, systemd, deployment helpers
data/       small demo documents and import guidance
docs/       product, system, and developer docs
```

## Code Vs Data

Keep code in the repo. Keep large mutable corpora and runtime state outside it.

Default guidance:

- checked-in demo data: `data/demo`, `data/local-docs`
- runtime storage: `/data/uintell/storage`
- large imports: `/data/uintell/imports`

Do not treat the repo root as the default home for wiki dumps, tarballs, caches, or generated indexes.

## Current Focus

The strongest product surface should be the article page:

- open a page
- read it comfortably
- ask a narrow question
- inspect citations and supporting passages
- continue to related pages and backlinks

Everything else in the repo should support that flow or stay clearly optional/frozen.
