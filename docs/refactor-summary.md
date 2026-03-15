# Refactor Summary

## What Was Simplified

- the main architecture is now documented around one path: `apps/web -> services/api -> PostgreSQL + Qdrant`
- the active import/settings/audit repository is now named `SystemRepository` instead of `AdminRepository`
- the ingestion, retrieval, and answering code paths now have targeted comments explaining their actual role
- the repo now has one clear documentation set for system map, data model, code map, and core flow
- the README is now centered on the real product loop instead of repo sprawl

## What Is Still Messy

- compatibility APIs for chat, collections, and notes still exist in the backend
- some deployment and infrastructure files still reflect older experiments or product directions
- source is still a derived concept from documents/settings rather than a first-class table
- related-page ranking is heuristic
- the repo still contains operational clutter outside the active code paths

## What Should Improve Next

- make the imports/status experience as clear as the reader page
- continue isolating or deleting frozen compatibility code
- decide whether sources and sections should become first-class stored objects
- move large runtime artifacts and old deployment remnants farther away from the active development path

## The True Core Architecture

The real system is:

1. the web app registers sources and renders the reader
2. the API normalizes raw inputs into Postgres documents, chunks, and links
3. Qdrant provides semantic recall over chunk ids
4. retrieval merges exact and semantic evidence
5. the answer service turns retrieved chunks into grounded answers with citations

Everything that does not directly support that loop is optional, frozen, or a candidate for later removal.
