# Search

## Product Intent

Search is a first-class reader feature, not a demo for retrieval infrastructure.

The search experience should help users:

- find the right source
- find the right page
- jump into the reader quickly
- trust why a result appeared

## Default Retrieval Stack

Default search uses:

- PostgreSQL exact/full-text search
- Qdrant semantic retrieval

Meilisearch is optional and should be treated as an accelerator, not a required default dependency.

## Search Modes

- `exact`: keyword-heavy retrieval
- `semantic`: vector-heavy retrieval
- `hybrid`: merged exact + semantic results

## Search Result Requirements

Results should show:

- page title
- source label
- section label where available
- readable snippet
- path into the reader

The UI should prefer readability and confident navigation over excessive controls.

## Reader Connection

Search is not the end state.

The product path continues:

`search -> open page -> ask this page -> inspect citations`
