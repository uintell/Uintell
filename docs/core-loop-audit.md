# Core Loop Audit

This audit describes the active product loop as it exists in the current repo:

`import source -> browse source -> search -> read page -> ask page -> cited answer`

## 1. Source Registration And Import

### What currently works

- The imports UI in `apps/web/components/imports-workspace.tsx` lets an admin register source profiles, save them into app settings, and trigger ingestion jobs.
- `services/api/app/api/routes/imports.py` accepts profile-backed or direct ingest requests.
- `services/api/app/services/ingestion.py` normalizes filesystem, Wikipedia, and ArchWiki-style sources into the same document and chunk path.

### What currently feels weak

- The imports screen is still more operational than product-polished.
- It exposes configuration fields clearly enough for engineering, but not yet with the same calm product quality as the reader.

### What blocks the 10x-more-useful goal

- Import status is understandable, but not yet reassuring.
- The system still depends on the operator knowing what a good source profile looks like.

## 2. Ingestion Visibility

### What currently works

- Jobs are stored in PostgreSQL through `SystemRepository`.
- The imports page shows recent jobs, progress counts, and source-level document stats.
- The default local path works without Temporal by running ingestion directly from the API container.

### What currently feels weak

- Progress is numerically correct, but still reads like a job console rather than a product surface.
- There is limited narrative about what stage the source is in beyond status fields and counters.

### What blocks the 10x-more-useful goal

- The user can see that indexing happened, but not yet feel guided through it.

## 3. Search

### What currently works

- Search runs through one active path: PostgreSQL keyword matching plus Qdrant semantic matching, merged by `RetrievalService`.
- Results now surface source labels, section entry points, match reasons, and direct jumps into the reader.
- Exact title and section matches are ranked more strongly than raw chunk matches.

### What currently feels weak

- Semantic quality is only as good as the current Qdrant index.
- Search still depends heavily on chunk-level matching; there is no separate source-aware search mode yet.

### What blocks the 10x-more-useful goal

- The live system currently degrades gracefully when Qdrant dimensions mismatch, but that also weakens semantic relevance until the collection is rebuilt and reindexed.

## 4. Source Browsing

### What currently works

- The library page exposes sources and reader-ready documents.
- Source detail pages show source metadata and document lists.
- Hidden or unwanted source types are filtered consistently across the UI and API.

### What currently feels weak

- Source browsing is useful, but still not as strong as the article page.
- Source detail is informative, but not yet as strategically helpful as search for deciding what to read next.

### What blocks the 10x-more-useful goal

- The browse surfaces still need stronger guidance around “where to start” inside large sources.

## 5. Article Page

### What currently works

- The reader page pulls one normalized document from `/v1/documents/slug/{slug}`.
- It renders markdown, text, and code through `DocumentBody`.
- The page includes source identity, TOC, anchors, related pages, backlinks, and an ask-page panel.

### What currently feels weak

- The reading environment is much better than before, but support surfaces still carry more framing than the prose column.
- Related-page ranking is still heuristic.

### What blocks the 10x-more-useful goal

- The page feels serious now, but exploration quality still depends on simple heuristics instead of stronger graph or concept signals.

## 6. Ask-Page AI

### What currently works

- Ask-page calls `/v1/documents/{document_id}/answer`.
- `AnswerService` retrieves from the current page first, then broadens to the surrounding source only when evidence is thin.
- The UI now shows scope, passage counts, citations, and supporting passages more clearly.

### What currently feels weak

- Answer quality still depends on provider quality and index quality.
- The system is trustworthy, but not yet maximally concise when evidence is broad or messy.

### What blocks the 10x-more-useful goal

- If semantic retrieval quality is degraded, ask-page can still work through exact matching and fallbacks, but the assistant becomes less sharp than it should be.

## 7. Citations And Supporting Passages

### What currently works

- Citations are generated from retrieved chunks at answer time.
- Supporting passages are visible directly in the page UI.
- Citations and passages link the user back into the reader when possible.

### What currently feels weak

- Evidence is visible, but still visually denser than the prose column.
- Citations are trustworthy, but not yet compressed into the cleanest possible claim-to-evidence presentation.

### What blocks the 10x-more-useful goal

- Evidence inspection works, but the relationship between related pages, passages, and answer claims can still become clearer.

## 8. Related Pages And Backlinks

### What currently works

- Backlinks are computed from resolved document links.
- Related pages are ranked heuristically from direct links, backlinks, shared tags, and same-source proximity.
- The UI now shows relation hints instead of dumping a plain list of titles.

### What currently feels weak

- Ranking is still heuristic and shallow.
- It helps exploration, but does not yet feel “smart”.

### What blocks the 10x-more-useful goal

- Exploration is cleaner than before, but still not strong enough to consistently beat the user’s instinct to run another search.

## Overall Assessment

The product is strongest in `search -> read -> ask`.
The biggest remaining blockers to the “10x more useful than Google” goal are:

- degraded semantic quality when the Qdrant index is out of sync
- source/import surfaces that are still more operational than product-grade
- related-page ranking that is still heuristic rather than deeply knowledge-aware
