# Next Level Plan

## Core Journey

`register source -> run ingestion -> browse source -> open page -> ask page -> inspect citations -> continue reading`

## Highest-Impact Improvements Now

- Make the article reader feel like a serious technical reading environment.
- Make search results faster to trust through better ranking, better snippets, and better section jumps.
- Make ask-page answers feel obviously grounded by separating answer, citations, and evidence more clearly.

## Minimum Local Stack

- `postgres`
- `qdrant`
- `api`
- `web`

## Do Not Touch In This Sprint

- frozen legacy paths
- optional infra unless it directly improves the core loop
- broad platform features outside import, browse, read, ask, and cited answer

## Frozen

- `apps/backend`
- `apps/frontend`
- `legacy/uintell-site`
- chat, notes, and collections as separate product lines

## Simplify On Contact

- old naming that makes active paths feel admin-first instead of reader-first
- token-heavy UI code that hides the real product styling
- duplicate search or retrieval presentation logic
- anything that makes the default local path heavier than `postgres + qdrant + api + web`
