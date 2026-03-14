# Progress

- [x] Inspect current repo and choose adaptation strategy instead of destructive replacement
- [x] Scaffold new monorepo structure: `apps/web`, `services/api`, `services/worker`, `packages/ai`, `packages/shared`
- [x] Implement shared offline ingestion and RAG helpers
- [x] Implement FastAPI backend with auth, chat, retrieval, uploads, admin, settings, and health routes
- [x] Implement Alembic schema and seed bootstrap
- [x] Implement Temporal worker and ingestion workflows
- [x] Implement Next.js frontend with landing page, login, chat, search, library, settings, and admin
- [x] Add Dockerfiles, Docker Compose, env templates, and Make targets
- [x] Run the new stack end-to-end and capture verification notes
- [ ] Add deeper integration tests beyond current parser/security/workflow smoke coverage

## Verification Notes

- `docker compose up` stack verified with `postgres`, `redis`, `qdrant`, `temporal`, `temporal-ui`, `api`, `worker`, and `web`
- Alembic migrations applied successfully against PostgreSQL
- Seed bootstrap verified with default admin login at `admin@uintell.org`
- Filesystem ingestion verified end to end through the public admin API and Temporal worker
- Retrieval verified through `POST /v1/retrieval/search`
- Chat verified through both `POST /v1/chat` and `POST /v1/chat/stream`
- Frontend production build verified with `npm --workspace apps/web run build`
- Backend unit tests verified with `pytest -q`
- Relevance guardrail added to retrieval: unsupported semantic-only hits are filtered before prompting, so no-evidence answers no longer cite unrelated sources like `ASCII` for unrelated queries such as `GHB`
- Production cleanup verified for translated ArchWiki pages: Latvian pages were removed from the live index and new answers now follow the user's language
