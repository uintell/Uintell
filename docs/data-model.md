# Data Model

## Overview

Uintell normalizes very different source types into one internal shape so the reader, search, and ask-page flow can work the same way for wiki pages, books, notes, and technical docs.

The canonical model is:

`source -> document -> section -> chunk -> citation`

Not every part is stored as its own table today, so the important distinction is:

- what is a product concept
- what is a physical storage object

## Source

A source is a named corpus such as:

- `english_wikipedia`
- `arch_linux_wiki`
- `demo_library`
- `local_notes`

In practice, source configuration lives in source profiles under app settings. A source profile tells the system:

- source type
- source name
- target path
- document kind
- tags
- optional import limits

Source is a product-level grouping, not a dedicated database table right now. Source views are derived from `documents`.

## Document

The `documents` table is the main canonical object.

A document represents one reader-openable page or chapter. Important fields include:

- `source_type`
- `source_name`
- `canonical_id`
- `source_identifier`
- `title`
- `slug`
- `summary`
- `raw_content`
- `normalized_content`
- `plain_text`
- `sections_json`
- `tags_json`
- `links_out_json`
- `path_or_url`
- `document_kind`
- `status`, `indexing_status`, `embedding_status`

The uniqueness rule is:

- one document per `source_name + canonical_id`

## Section

Sections are part of the logical document model, but they are stored inline on the document row in `sections_json`.

Each section has:

- `title`
- `content`
- `anchor`

The reader uses sections for:

- article rendering
- table of contents
- section anchors
- evidence linking

There is no separate `sections` table yet.

## Chunk

Chunks are stored in `document_chunks`.

Each chunk belongs to one document and represents a retrieval unit. Important fields include:

- `document_id`
- `chunk_index`
- `section_title`
- `content`
- `content_hash`
- `token_count`
- `metadata_json`
- `embedding_provider`
- `embedding_model`

Chunks are created by `chunk_document()` in `packages/ai/src/knowledge_engine/chunking.py`.

The chunker walks the normalized sections and slices them into overlapping windows suitable for search and retrieval.

## Embedding

Embedding is a retrieval concept, not a first-class Postgres table.

Current split:

- Postgres chunk rows store embedding metadata
- Qdrant stores the actual vectors keyed by chunk id

This is important:

- Postgres remains the source of truth
- Qdrant is a derived index that can be rebuilt from chunks

## Citation

Citations are returned to the UI, but they are not stored as a dedicated database table.

They are generated at answer time from retrieved chunks. Each citation contains:

- label like `S1`
- document title
- section title
- source type
- source name
- document slug
- original path or URL

Supporting passages use the same retrieved chunk set and include the excerpt shown in the UI.

## Link And Relationship Data

`document_links` stores outgoing references discovered during ingestion.

Each row contains:

- source document id
- target slug
- optional resolved target document id
- link text

This table powers:

- resolved backlinks
- one input into related-page ranking

## Ingestion Job

`ingestion_jobs` tracks the operational state of source imports.

Each job stores:

- source type
- source name
- target path
- status
- progress counters
- error message
- metadata
- workflow id when Temporal is used

This is how the imports page shows status.

## How Knowledge Moves Through The System

```text
raw source files
  -> parser returns ParsedDocument
  -> document row is created or updated
  -> section JSON is stored on the document
  -> chunk rows are created from sections
  -> chunk vectors are written to Qdrant
  -> retrieval returns chunks
  -> answer pipeline turns chunks into citations and supporting passages
```

## Normalization Path

The important normalization type is `ParsedDocument` from `packages/ai/src/knowledge_engine/models.py`.

It is the bridge between raw source formats and the stored document model. It carries:

- source identity
- canonical id
- article title
- summary
- normalized content
- tags
- links out
- media references
- sections

Once everything is converted into `ParsedDocument`, the rest of the system can stay source-agnostic.

## What Is Missing Or Intentionally Simple

- there is no first-class `sources` table yet
- there is no first-class `sections` table yet
- citations are generated, not persisted
- related-page ranking is heuristic, not a dedicated graph model

That simplicity is acceptable for the current product loop as long as the boundaries stay clear.
