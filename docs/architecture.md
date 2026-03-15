# Architecture

Uintell has one primary architecture:

`apps/web -> services/api -> PostgreSQL + Qdrant`

That stack supports one product loop:

`import source -> browse source -> read page -> ask page -> cited answer`

## Runtime Shape

```text
web (Next.js)
  -> api (FastAPI)
      -> PostgreSQL for canonical knowledge objects
      -> Qdrant for semantic retrieval
      -> optional provider layer for answer generation
```

## Active Components

- `apps/web`
  Reader-first UI for imports, library browsing, search, article pages, and page-scoped answers.
- `services/api`
  Owns ingestion orchestration, document/source APIs, retrieval, and grounded answers.
- `packages/ai`
  Owns parsing, chunking, citation-bundle construction, and provider helpers.
- `packages/shared`
  Owns TypeScript contracts consumed by `apps/web`.

## Storage Rules

- PostgreSQL is the source of truth.
- Qdrant is a derived vector index.
- Uploads and corpora are runtime data, not source code.
- Sections are stored on the document row as normalized JSON.
- Citations are generated from retrieved chunks at answer time.

## Request Boundaries

- Importing starts at `/v1/imports/*`.
- Reading starts at `/v1/documents/slug/{slug}`.
- Search starts at `/v1/retrieval/search`.
- Ask-page starts at `/v1/documents/{document_id}/answer`.

## Optional Components

These stay optional and should not be required for the main local flow:

- `services/worker` with Temporal
- Ollama
- OpenAI
- Meilisearch
- Redis

## Frozen Components

These are not part of the current product direction:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`

## Read Next

- [system-map.md](system-map.md)
- [data-model.md](data-model.md)
- [code-map.md](code-map.md)
- [core-flow.md](core-flow.md)
