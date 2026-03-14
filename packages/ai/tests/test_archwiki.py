from pathlib import Path

from knowledge_engine.archwiki import parse_archwiki_html


def test_parse_archwiki_html_extracts_title_and_code(tmp_path: Path) -> None:
    path = tmp_path / "Pacman.html"
    path.write_text(
        """
        <html><body>
          <nav>ignore me</nav>
          <main id="content">
            <h1>Pacman</h1>
            <p>The package manager for Arch Linux.</p>
            <h2>Usage</h2>
            <pre>sudo pacman -Syu</pre>
          </main>
        </body></html>
        """,
        encoding="utf-8",
    )

    document = parse_archwiki_html(path)

    assert document is not None
    assert document.article_title == "Pacman"
    assert any("sudo pacman -Syu" in section.content for section in document.sections)


def test_parse_archwiki_html_skips_translated_pages(tmp_path: Path) -> None:
    path = tmp_path / "Installation_guide_(Latviešu).html"
    path.write_text(
        """
        <html><body>
          <main id="content">
            <h1>Installation guide (Latviešu) - ArchWiki</h1>
            <p>Latvian translation.</p>
          </main>
        </body></html>
        """,
        encoding="utf-8",
    )

    assert parse_archwiki_html(path) is None
