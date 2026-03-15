# Progress

## Product Focus

Uintell is being narrowed to one primary product:

`import source -> browse source -> read page -> ask page -> cited answer`

The goal is not platform breadth. The goal is a clear, trustworthy knowledge engine with a strong reader experience.

## Active Stack

- frontend: Next.js App Router in `apps/web`
- backend: FastAPI in `services/api`
- canonical store: PostgreSQL
- vector retrieval: Qdrant
- optional durable ingest: `services/worker` with Temporal
- optional model providers: Ollama and OpenAI

## Frozen Areas

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`
- chat/collections/notes as primary product surfaces

## Clarity Milestones

- [x] tighten the product story around one loop
- [x] reduce the default local stack to `postgres`, `qdrant`, `api`, `web`
- [x] improve the article page so it is the strongest product surface
- [x] improve search result readability and section jumps
- [x] make ask-page evidence and citations clearer
- [x] document the live system in plain English
- [x] rename the active system-state repository from `admin` to `system`
- [x] add a developer entry-point doc for the core flow

## Current Documentation Set

- [system-map.md](system-map.md)
- [data-model.md](data-model.md)
- [code-map.md](code-map.md)
- [core-flow.md](core-flow.md)
- [how-the-system-works.md](how-the-system-works.md)
- [refactor-summary.md](refactor-summary.md)

## What Still Needs Work

- import status is functional but still more operational than product-polished
- related-page ranking is heuristic
- backend compatibility routes still carry some older shape and naming
- runtime clutter outside the active code paths still exists in the repo
