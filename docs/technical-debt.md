# Technical Debt

This document marks the code areas that are active, optional, or legacy so the active product path stays clear.

| Area | Status | Why it matters |
| --- | --- | --- |
| `apps/web` | ACTIVE | Primary product UI. This is where reader, search, library, and imports live. |
| `services/api` | ACTIVE | Primary backend for ingestion, retrieval, and answering. |
| `packages/ai` | ACTIVE | Parsing, chunking, prompting, and embeddings for the knowledge engine. |
| `packages/shared` | ACTIVE | Shared frontend contracts. |
| `services/worker` | OPTIONAL | Needed only for durable Temporal-based ingestion. Not part of the default local path. |
| `services/api/app/services/meilisearch.py` | OPTIONAL | Secondary search accelerator. The default system works without it. |
| `services/api/app/services/chat.py` | OPTIONAL | Still wired for compatibility, but not part of the main product loop. |
| `services/api/app/services/tools.py` | OPTIONAL | Supports the chat/tooling path, not the core reader loop. |
| `services/api/app/api/routes/chat.py` | LEGACY | Still present, but not part of the focused product story. |
| `services/api/app/api/routes/collections.py` | LEGACY | Compatibility surface from a broader earlier product shape. |
| `services/api/app/api/routes/notes.py` | LEGACY | Compatibility surface from an earlier notes-oriented path. |
| `services/api/app/repositories/collections.py` | LEGACY | Supports non-core product areas. |
| `services/api/app/repositories/conversations.py` | LEGACY | Supports the chat path rather than the page-first reader flow. |
| `services/api/app/repositories/notes.py` | LEGACY | Supports the older notes path. |
| `apps/backend` | LEGACY | Frozen Rust backend. Do not extend it. |
| `apps/frontend` | LEGACY | Frozen frontend. Do not extend it. |
| `legacy/` | LEGACY | Historical site and deployment remnants. |
| `.tmp/` | LEGACY | Runtime clutter, not active product code. |
| `apps/web/app/app/admin/page.tsx` | LEGACY | Compatibility redirect only. The real surface is `/app/imports`. |
| `docs/current-system-audit.md`, `docs/current-product-audit.md`, `docs/next-level-plan.md`, `docs/next-sprint-plan.md`, `docs/simplification-plan.md` | LEGACY | Useful historical context, but too many overlapping audit docs now exist. |

## Practical Rule

When working on Uintell, default to these paths first:

- `apps/web`
- `services/api`
- `packages/ai`
- `packages/shared`

Only touch optional or legacy paths when they block the core loop or need explicit cleanup.
