# Article Page Audit

Uintell’s article page currently lives at the document reader route:

- [apps/web/app/app/library/[slug]/page.tsx](/home/x1/projectx/apps/web/app/app/library/[slug]/page.tsx)

That route renders the main reader component:

- [apps/web/components/document-reader-workspace.tsx](/home/x1/projectx/apps/web/components/document-reader-workspace.tsx)

## Current Route And Data Flow

The article page is slug-based.

- The Next.js route receives a document slug.
- The reader loads the document through `api.getDocumentBySlug(slug)`.
- That calls `GET /v1/documents/slug/{slug}` from [services/api/app/api/routes/documents.py](/home/x1/projectx/services/api/app/api/routes/documents.py).
- The backend builds the page payload from PostgreSQL document metadata, normalized sections, raw content, backlinks, and related pages.

The page currently gets everything it needs in one detail payload:

- title
- summary
- source identity
- raw and normalized content
- sections
- tags
- backlinks
- related pages
- media references

That is good. The article page is not doing extra fetch choreography.

## Current Content Rendering

Article content is rendered through:

- [apps/web/components/document-body.tsx](/home/x1/projectx/apps/web/components/document-body.tsx)

Current rendering paths:

- markdown documents render from `raw_content`
- code-like documents render in a dedicated code block path
- everything else falls back to normalized sections or plain text

This is already the right product shape. The content renderer understands technical material instead of assuming a generic blog post.

## Current TOC Implementation

The reader builds TOC items from the derived `readerSections` array in [document-reader-workspace.tsx](/home/x1/projectx/apps/web/components/document-reader-workspace.tsx).

Current behavior:

- section anchors are used for TOC links
- an `IntersectionObserver` updates the active section
- the TOC is sticky on desktop
- mobile gets a collapsed `details` TOC

What is good:

- section jumping works
- active-section tracking exists
- the TOC stays out of the main reading column
- heading levels now flow into the TOC more clearly than before

What is weak:

- the TOC is better structured now, but the rail is still visually stricter than the content column
- very long pages could still use smarter grouping or collapse behavior later

## Current Related Pages And Backlinks

Backlinks and related pages are computed in:

- [services/api/app/repositories/documents.py](/home/x1/projectx/services/api/app/repositories/documents.py)

Backlinks:

- explicit incoming links resolved through `document_links`

Related pages:

- outgoing links from the current document
- backlink relationships
- shared tags
- same-source affinity

Frontend rendering now lives in a dedicated exploration surface below the article. That is a better product shape than the old sidebar treatment.

## Current Ask-Page AI Placement And Behavior

The ask-page UI lives in:

- [apps/web/components/page-answer-panel.tsx](/home/x1/projectx/apps/web/components/page-answer-panel.tsx)

Current behavior:

- composer sits after the article body so reading stays first
- answers call `POST /v1/documents/{document_id}/answer`
- retrieval is page-first, then same-source if needed
- the answer includes citations and supporting passages

What is good:

- the AI is already page-scoped by default
- citations are visible in the answer text
- supporting evidence is visible

What is weak:

- the panel is more integrated now, but the answer surface is still visually denser than the article prose
- evidence is clearer than before, but could still be compressed further on long answers

## Current Citation And Evidence Rendering

Citations and passages are rendered inside [page-answer-panel.tsx](/home/x1/projectx/apps/web/components/page-answer-panel.tsx).

Current behavior:

- inline citation chips link into the cited section
- citations render as separate cards
- supporting passages render as separate cards

This is directionally right. The biggest remaining issue is now visual density, not missing functionality.

## Biggest UX Weaknesses

- The page is much calmer than before, but some support surfaces still rely on bordered panels more heavily than ideal.
- TOC usefulness is now solid, but not yet “expert tool” level on extremely long pages.
- The AI panel is trustworthy, but it is still denser than the surrounding reading surface.
- Related-page ranking is still heuristic even though the exploration UI is cleaner.

## Biggest Code Clarity Weaknesses

- [document-reader-workspace.tsx](/home/x1/projectx/apps/web/components/document-reader-workspace.tsx) is cleaner than before, but it still owns page loading, TOC derivation, media handling, and top-level composition.
- The reader section model now carries heading hierarchy, but source-derived sections still use a fairly coarse default level.
- The assistant, rail, and exploration surfaces are now separated, which is good. The remaining clarity work is mostly within the main reader shell.

## Quick Wins

- soften the remaining support-surface density
- refine TOC behavior for very long technical pages
- keep improving answer/evidence compression without hiding evidence

## Deeper Fixes Worth Doing Now

- keep reducing “UI frame” feeling around the support surfaces
- improve the article column rhythm even further on dense technical pages
- make long evidence trails easier to scan without turning them into a chat transcript
