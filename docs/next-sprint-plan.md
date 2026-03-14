# Next Sprint Plan

## Product Flow

Uintell stays focused on one loop:

`import source -> browse source -> read page -> ask page -> cited answer`

## Active Architecture

- frontend: `apps/web`
- backend: `services/api`
- source of truth: PostgreSQL
- vector retrieval: Qdrant
- optional only: `services/worker`, Temporal, Ollama, OpenAI, Meilisearch, Redis

## Minimum Local Stack

- `postgres`
- `qdrant`
- `api`
- `web`

## Frozen Areas

Do not extend:

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`
- chat, notes, and collections as separate product lines

## Improve Now

- imports clarity and ingestion trust
- library and source browsing clarity
- article reader typography, anchors, backlinks, and related pages
- search result usefulness and section jumps
- ask-page answers, citations, and evidence readability

## Avoid

- provider expansion
- optional infra work unless required for the main loop
- new product surfaces outside the reader flow
- broad platform abstractions that make the code harder to follow
