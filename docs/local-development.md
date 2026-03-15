# Local Development

## Default Goal

The default local path should support the main product loop:

`import source -> browse source -> read page -> ask page -> cited answer`

That path should work without Redis, Meilisearch, Temporal, or Ollama.

## Default Services

Start the default stack with:

```bash
docker compose up --build
```

Default services:

- `postgres`
- `qdrant`
- `api`
- `web`

## Optional Profiles

Enable advanced services only when needed:

```bash
docker compose --profile local-llm up --build
docker compose --profile durable-ingest up --build
docker compose --profile advanced up --build
```

- `local-llm`: Ollama
- `durable-ingest`: Temporal, Temporal UI, worker
- `advanced`: Redis and Meilisearch

## Env Notes

Use the env examples as templates, then set local values explicitly:

```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
cp services/worker/.env.example services/worker/.env
cp apps/web/.env.example apps/web/.env.local
```

Important:

- set `SEED_ADMIN_PASSWORD` yourself
- enable `OPENAI_API_KEY` only if you want hosted generation/embeddings
- switch `GENERATION_PROVIDER` to `ollama` only when the `local-llm` profile is running
- switch `EMBEDDING_PROVIDER` away from `hash` only when the relevant provider is available

## Recommended Developer Flow

1. Start the default stack.
2. Sign in.
3. Open `Imports`.
4. Register a local source path.
5. Run ingestion.
6. Open `Library` or a source detail page.
7. Search for a page or browse to it from the source/library view.
8. Open a page in the reader.
9. Use `Ask this page`, inspect citations, and jump into supporting passages.

## Demo Data

Small demo docs live in `data/local-docs`.

Large mutable corpora should live outside the repo, typically under `/data/uintell/imports/...`, and be referenced through source profiles or env configuration.
