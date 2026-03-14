import bz2
from pathlib import Path
from textwrap import dedent

from knowledge_engine.wikipedia import iter_wikipedia_documents


def test_iter_wikipedia_documents_extracts_sections_links_and_categories(tmp_path: Path) -> None:
    dump_path = tmp_path / "sample.xml.bz2"
    dump_path.write_bytes(
        bz2.compress(
            dedent(
                """
                <mediawiki>
                  <page>
                    <title>Vector database</title>
                    <ns>0</ns>
                    <revision>
                      <text xml:space="preserve">Vector databases store embeddings for semantic retrieval.

== Usage ==
They are commonly paired with [[Knowledge graph]] systems.

[[Category:Databases]]</text>
                    </revision>
                  </page>
                </mediawiki>
                """
            ).encode("utf-8")
        )
    )

    documents = list(iter_wikipedia_documents(dump_path))

    assert len(documents) == 1
    document = documents[0]
    assert document.article_title == "Vector database"
    assert "Databases" in document.tags
    assert "Knowledge graph" in document.links_out
    assert any(section.title == "Usage" for section in document.sections)
