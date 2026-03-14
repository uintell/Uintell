# Deployment Notes

## Default Product Deployment

The primary deployment target is a self-hosted, reader-first knowledge product with a small default stack:

- web
- api
- PostgreSQL
- Qdrant

That is the baseline deployment for the main vertical slice.

## Optional Components

Add these only when the product need is clear:

- Ollama for local generation/embeddings
- OpenAI for hosted generation/embeddings
- Temporal + worker for more durable ingestion execution
- Meilisearch for additional search acceleration
- Redis for distributed rate limiting

## Security Basics

- set `SECURE_COOKIES=true` behind HTTPS
- set `WEB_ORIGIN` and `CORS_ORIGINS` exactly
- keep secrets in env or a secret manager, not in source
- set your own seeded admin password before first run

## Operational Direction

- treat PostgreSQL as canonical knowledge state
- treat Qdrant as a derived retrieval index
- keep imports and uploads outside the repo root
- keep the default runtime simple enough for one developer machine

## Before Public Exposure

- add stronger CSRF protection
- harden authz around admin/import operations
- enable backups for PostgreSQL and Qdrant
- pin container versions for advanced profiles
- move secrets to a dedicated secret manager
