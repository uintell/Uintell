# United Intelligence local notes

United Intelligence is designed to retrieve from private local sources before it asks an external model to synthesize an answer.

## Operational defaults

- PostgreSQL stores metadata, conversations, jobs, and source-of-truth document records.
- Redis handles rate limiting and ephemeral control state.
- Qdrant stores chunk vectors.
- Temporal runs ingestion workflows.

## Development bootstrap

1. Start the local Docker stack.
2. Run migrations.
3. Seed the default admin.
4. Ingest local docs to verify the RAG loop.
