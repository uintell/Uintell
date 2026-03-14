from textwrap import dedent

from knowledge_engine.filesystem_docs import parse_filesystem_document
from knowledge_engine.models import SourceType


def test_parse_filesystem_document_marks_markdown_notes(tmp_path) -> None:
    root = tmp_path
    path = root / "notes" / "daily-log.md"

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        dedent(
            """
            ---
            title: Daily Log
            ---

            # Daily Log

            Review the retrieval pipeline and update the search playbook.

            ## References

            See [Search Playbook](../notes/search-playbook.md)
            """
        ).lstrip(),
        encoding="utf-8",
    )

    document = parse_filesystem_document(root, path)

    assert document is not None
    assert document.source_type == SourceType.NOTE
    assert document.article_title == "Daily Log"
    assert "notes" in document.tags
    assert "../notes/search-playbook.md" in document.links_out


def test_parse_filesystem_document_can_mark_library_markdown_as_book(tmp_path) -> None:
    root = tmp_path
    path = root / "library" / "systems-thinking.md"

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        dedent(
            """
            # Systems Thinking

            Long-form reading material should still normalize cleanly into sections and plain text.
            """
        ).lstrip(),
        encoding="utf-8",
    )

    document = parse_filesystem_document(root, path)

    assert document is not None
    assert document.source_type == SourceType.BOOK
    assert document.document_kind == "book"
