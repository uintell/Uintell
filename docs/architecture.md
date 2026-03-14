# Architecture

## Product-Centered Summary

Uintell is being simplified around one primary vertical slice:

`import source -> browse source -> read page -> ask page -> cited answer`

The active architecture is the Python/Next stack. Legacy Rust and legacy frontend code remain frozen for migration/reference only.

## Active Product Stack

### `apps/web`

Primary reader-first frontend built with:

- Next.js App Router
- TypeScript
- Tailwind

Primary pages:

- home
- library
- source detail
- article reader
- search
- imports
- settings

Frozen pages still present only as compatibility notices:

- chat
- collections
- notes

### `services/api`

Primary API built with:

- FastAPI
- SQLAlchemy async ORM
- Pydantic
- PostgreSQL-backed normalized knowledge model

The API owns:

- source import/job creation
- document and source metadata
- retrieval
- page-scoped grounded answers
- authentication/session handling

The current user-facing ingestion API is exposed under `/v1/imports/*`. Legacy chat, notes, and collections APIs remain in the repo as frozen compatibility surfaces, not as the primary product path.

### `packages/ai`

Shared parsing and retrieval helpers for:

- filesystem docs
- wiki imports
- chunking
- citation bundle construction
- provider prompt assembly

## Data Model

The product is centered on normalized knowledge objects, not on a wiki CMS abstraction:

- sources
- documents/pages
- sections
- chunks
- citations
- relationships
- ingestion jobs

PostgreSQL is the source of truth for these objects.

## Retrieval Model

Default retrieval path:

1. PostgreSQL exact search on chunk text
2. Qdrant semantic search
3. merge and filter results
4. return authoritative chunk/document payloads from PostgreSQL

Meilisearch is optional and should not be treated as a required default.

## Answering Model

Reader answers should be page-scoped first:

1. retrieve from the current page
2. widen to the current source only if needed
3. generate an answer from retrieved evidence
4. return citations and supporting passages explicitly

## Jobs

Default local ingestion can run directly from the API process.

Temporal worker flow remains available as an optional advanced path for more durable ingestion, but it is not required for the main local developer flow.

## Optional Components

Optional, not required by default:

- Redis
- Meilisearch
- Temporal
- worker
- Ollama
- OpenAI

The default local path should stay usable with the smallest set of services that still supports the main product flow.
