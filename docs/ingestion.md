# Ingestion

## Current ingestion model

The platform uses source profiles instead of hardcoded dump locations.

Each profile defines:

- source type
- source name
- target path
- document kind
- optional tags

The admin page persists these profiles in app settings and launches ingestion jobs against them.

## Supported sources

- markdown and text notes
- EPUB and PDF books
- local HTML, markdown, text, and code documents
- Wikipedia XML dumps
- Arch Wiki HTML mirrors
- uploaded files

## Normalization rules

All sources map into the same internal document model with:

- summary
- normalized content
- plain text
- sections
- outbound links
- media references
- metadata

Filesystem sources can be forced into `note` or `book` source types through the source profile overrides. That matters for source filtering and reader presentation.

## Demo content

The repo now includes demo content under `data/demo/notes` and `data/demo/library`.

Use the default `demo-notes` and `demo-library` source profiles from the Admin page to ingest them immediately after the stack is up.
