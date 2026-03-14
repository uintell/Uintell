# Deployment Notes

## Local-first deployment model

The current deployment target is self-hosted local or single-host infrastructure.

Recommended baseline:

- reverse proxy in front of `apps/web`
- API reachable only from the reverse proxy or trusted network
- Postgres, Redis, Qdrant, and Temporal on a private network
- object storage on local disk or S3-compatible storage

## Environment handling

- use service-specific env files for local development
- move secrets to a secret manager before production
- rotate the seeded admin password immediately
- start the Next.js web service from a fresh build artifact; stale or partial `.next` output can surface as route `ChunkLoadError` failures in the browser

## Cookies and origins

- `SECURE_COOKIES=true` behind HTTPS
- set `WEB_ORIGIN` and `CORS_ORIGINS` to the exact deployed frontend origins

## Operational next steps before internet exposure

- add CSRF protection for state-changing cookie-authenticated requests
- place the API behind a reverse proxy and TLS
- pin Temporal image versions
- enable persistent backups for Postgres and Qdrant
- externalize OTLP exporter configuration to your telemetry stack
- add real access control for admin-only operations

## Scaling direction

- API can scale horizontally if session state remains in Postgres/Redis
- worker scale is governed by Temporal task queue concurrency
- Qdrant can be moved to managed or clustered deployment later
- storage abstraction already supports moving uploads off local disk
