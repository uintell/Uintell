from knowledge_engine.chunking import chunk_document
from knowledge_engine.models import ParsedDocument, Section, SourceType


def test_chunk_document_preserves_section_title() -> None:
    document = ParsedDocument(
        source_type=SourceType.FILESYSTEM,
        source_name="local_filesystem",
        canonical_id="example",
        article_title="Example",
        sections=[Section(title="Install", content="word " * 600)],
    )

    chunks = chunk_document(document, chunk_size=300, overlap=50)

    assert len(chunks) > 1
    assert all(chunk.section_title == "Install" for chunk in chunks)
