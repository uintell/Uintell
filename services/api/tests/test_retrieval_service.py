from uuid import uuid4

from app.services.retrieval import _filter_supported_chunks
from knowledge_engine.models import RetrievedChunk, SourceType


def _chunk(*, title: str, section_title: str | None, content: str) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=str(uuid4()),
        document_id=str(uuid4()),
        source_type=SourceType.FILESYSTEM,
        source_name="local_filesystem",
        article_title=title,
        section_title=section_title,
        path_or_url="/tmp/doc.txt",
        content=content,
        score=0.0,
        metadata={},
    )


def test_filter_supported_chunks_removes_irrelevant_semantic_hits() -> None:
    ascii_chunk = _chunk(
        title="ASCII",
        section_title="Overview",
        content="ASCII is a character encoding standard for electronic communication.",
    )

    filtered = _filter_supported_chunks(
        [ascii_chunk],
        query="What is GHB?",
        keyword_ids=set(),
        semantic_scores={ascii_chunk.chunk_id: 0.41},
    )

    assert filtered == []


def test_filter_supported_chunks_keeps_real_keyword_matches() -> None:
    arch_chunk = _chunk(
        title="Pacman",
        section_title="Upgrading packages",
        content="Use pacman -Syu to perform a full system upgrade after refreshing package databases.",
    )

    filtered = _filter_supported_chunks(
        [arch_chunk],
        query="How do I upgrade Arch Linux safely?",
        keyword_ids={arch_chunk.chunk_id},
        semantic_scores={arch_chunk.chunk_id: 0.76},
    )

    assert [chunk.chunk_id for chunk in filtered] == [arch_chunk.chunk_id]
