SHELL := /bin/bash

.PHONY: up down logs migrate seed-admin run-api run-worker run-web test-api test-ai test-worker test-web format backend-bootstrap

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
