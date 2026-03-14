# RAG Pipeline

## Goals

- prefer offline indexed knowledge first
- preserve citations
- keep the model layer swappable
- support streaming answers

## Document ingestion

### Arch Wiki

- input: `/usr/share/doc/arch-wiki/html/en/`
- parser removes navigation and chrome where practical
- headings and code blocks are preserved
- canonical source links point back to Arch Wiki article URLs when derivable

### Wikipedia

- input: `enwiki-latest-pages-articles-multistream.xml.bz2`
- parser streams the dump using XML iterparse over a bz2 reader
- redirects and non-mainspace pages are skipped
- MediaWiki markup is stripped with `mwparserfromhell`
- categories are preserved in document metadata

### Local documents

- supported: markdown, HTML, PDF, TXT, and common code/text files
- parser walks directories recursively and skips binary files

## Chunking

- section-aware splitting
- overlap between chunks
- chunk metadata keeps source type, source name, title, section, path/url, and canonical id

## Retrieval

- embeddings:
  - OpenAI embeddings when configured
  - deterministic hash embeddings when offline
- vector search:
  - Qdrant collection keyed by chunk UUID
- keyword search:
  - PostgreSQL full-text search on chunk text
- fusion:
  - reciprocal rank fusion

## Prompt assembly

Prompt structure:

- system prompt
- compact conversation history
- retrieved citation bundle
- user question

The answer instructions require:

- use only provided context
- state insufficiency clearly
- cite important claims with `[S#]`

## Response generation

- with OpenAI configured:
  - synthesize with the Responses API
  - stream deltas to the frontend
  - optionally expose tools for document search and lookup
- without OpenAI:
  - use deterministic extractive synthesis
  - still stream tokens to the frontend

## Known limitations

- no reranker yet
- no offset checkpointing inside Wikipedia ingestion yet
- citation faithfulness relies on prompt discipline plus visible source bundle, not a formal verifier
