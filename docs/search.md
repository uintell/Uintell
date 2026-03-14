# Search

## Retrieval stack

The product now uses a split search stack:

- Meilisearch for full-text document indexing
- Qdrant for semantic chunk retrieval
- PostgreSQL as the system of record for document and chunk payloads

## Search modes

- `exact`: keyword-first retrieval
- `semantic`: embedding-first retrieval
- `hybrid`: reciprocal-rank fusion across semantic and keyword results

The search page exposes this mode switch directly.

## Filters

The current product slice supports:

- source filtering
- tag filtering
- library sorting

Document browsing uses lightweight document-level filters. The reader flow uses the full document detail endpoint with backlinks and related documents resolved on the API side.
