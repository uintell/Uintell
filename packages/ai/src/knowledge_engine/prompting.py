from __future__ import annotations

from collections.abc import Sequence

from knowledge_engine.models import RetrievedChunk


def build_citation_bundle(chunks: Sequence[RetrievedChunk]) -> tuple[str, list[dict[str, str]]]:
    rendered: list[str] = []
    citations: list[dict[str, str]] = []
    for index, chunk in enumerate(chunks, start=1):
        label = f"S{index}"
        heading = chunk.section_title or "Overview"
        rendered.append(
            f"[{label}] {chunk.article_title} :: {heading}\n"
            f"Source type: {chunk.source_type.value}\n"
            f"Locator: {chunk.path_or_url or chunk.article_title}\n"
            f"Excerpt: {chunk.content}"
        )
        citations.append(
            {
                "label": label,
                "title": chunk.article_title,
                "section_title": heading,
                "document_slug": chunk.document_slug or "",
                "path_or_url": chunk.path_or_url or "",
                "source_type": chunk.source_type.value,
            }
        )
    return "\n\n".join(rendered), citations


def build_rag_messages(
    *,
    user_question: str,
    chunks: Sequence[RetrievedChunk],
    system_prompt: str,
    conversation_history: Sequence[dict[str, str]] | None = None,
) -> list[dict[str, object]]:
    context_block, _ = build_citation_bundle(chunks)
    messages: list[dict[str, object]] = [{"role": "system", "content": system_prompt}]
    for message in conversation_history or []:
        messages.append({"role": message["role"], "content": message["content"]})
    messages.append(
        {
            "role": "user",
            "content": (
                "Use only the provided offline knowledge context. "
                "If the evidence is insufficient, say that clearly. "
                "Every important claim must cite one or more sources using [S#].\n\n"
                f"CONTEXT:\n{context_block}\n\nQUESTION:\n{user_question}"
            ),
        }
    )
    return messages
