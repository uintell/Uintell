SHELL := /bin/bash

.PHONY: up down logs migrate seed-admin run-api run-worker run-web test-api test-ai test-worker test-web format backend-bootstrap dev-summary

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

migrate:
	docker compose run --rm api bash -lc "cd /workspace/services/api && alembic upgrade head"

seed-admin:
	docker compose run --rm api bash -lc "cd /workspace/services/api && python -m app.seed"

run-api:
	docker compose up api

run-worker:
	docker compose up worker

run-web:
	docker compose up web

test-api:
	docker compose run --rm api bash -lc "cd /workspace/services/api && pytest"

test-ai:
	docker compose run --rm api bash -lc "cd /workspace/packages/ai && pytest"

test-worker:
	docker compose run --rm worker bash -lc "cd /workspace/services/worker && pytest"

test-web:
	docker compose run --rm web sh -lc "cd /workspace/apps/web && npm run build"

backend-bootstrap:
	$(MAKE) migrate
	$(MAKE) seed-admin

dev-summary:
	@printf '%s\n' 'Project status'
	@printf '%s\n' '  Product: reader-first knowledge engine'
	@printf '%s\n' '  Core loop: import -> index -> search -> read -> ask -> cited answer'
	@printf '%s\n' '  Active path: apps/web, services/api, services/worker, packages/ai, packages/shared'
	@printf '%s\n' '  Frozen path: apps/backend, apps/frontend, legacy/, .tmp/'
	@printf '\n%s\n' 'Core modules'
	@printf '%s\n' '  - services/api/app/main.py'
	@printf '%s\n' '  - services/api/app/services/ingestion.py'
	@printf '%s\n' '  - services/api/app/repositories/system.py'
	@printf '%s\n' '  - services/api/app/repositories/documents.py'
	@printf '%s\n' '  - services/api/app/services/retrieval.py'
	@printf '%s\n' '  - services/api/app/services/answers.py'
	@printf '%s\n' '  - packages/ai/src/knowledge_engine/filesystem_docs.py'
	@printf '%s\n' '  - packages/ai/src/knowledge_engine/chunking.py'
	@printf '%s\n' '  - apps/web/lib/api.ts'
	@printf '%s\n' '  - apps/web/components/document-reader-workspace.tsx'
	@printf '\n%s\n' 'System architecture'
	@printf '%s\n' '  Sources -> Ingestion Service / Worker -> Knowledge Engine -> Search / Retrieval -> AI Answer -> Frontend UI'
	@printf '\n%s\n' 'Core flows'
	@printf '%s\n' '  1. Import source: imports UI -> /v1/imports/ingest -> SystemRepository job -> IngestionService'
	@printf '%s\n' '  2. Index knowledge: parser -> document upsert -> chunking -> Postgres + Qdrant index'
	@printf '%s\n' '  3. Search: search UI -> /v1/retrieval/search -> hybrid retrieval -> reader-ready results'
	@printf '%s\n' '  4. Ask page: reader UI -> /v1/documents/{id}/answer -> page-first retrieval -> cited answer'
