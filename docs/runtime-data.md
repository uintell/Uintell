# Runtime Data Layout

## Principle

Keep repo code separate from mutable runtime state and large corpora.

The repo should primarily contain:

- application code
- small demo documents
- documentation
- configuration templates

The repo should not be the default home for:

- large wiki dumps
- downloaded tarballs
- extracted datasets
- upload storage
- vector indexes
- caches
- generated build/runtime artifacts

## Default Paths

Current defaults are:

- runtime storage: `/data/uintell/storage`
- large imports: `/data/uintell/imports`
- small checked-in demo docs: `data/local-docs`

Examples:

- `/data/uintell/imports/wikipedia/enwiki-latest-pages-articles-multistream.xml.bz2`
- `/data/uintell/imports/archwiki/html/...`
- `/data/uintell/storage/uploads/...`

## Repo Hygiene

The repo ignore rules should keep these classes of files out of source control:

- `target/`
- `node_modules/`
- `.next/`
- `.tmp/`
- `.venv-*`
- extracted corpora
- root-level dump files
- tarballs
- caches
- logs
- generated Python metadata

## Operational Guidance

- Use checked-in demo data only for smoke testing and onboarding.
- Register real corpora as external paths through source profiles.
- Treat PostgreSQL as the source of truth for normalized knowledge objects.
- Treat Qdrant as a derived retrieval index, not the canonical data store.
- Treat uploads, imports, and runtime files as disposable operational state, not repo content.
