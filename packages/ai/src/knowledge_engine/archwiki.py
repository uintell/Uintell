from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

from bs4 import BeautifulSoup

from knowledge_engine.models import ParsedDocument, Section, SourceType
from knowledge_engine.utils import normalize_whitespace, slugify


NOISE_SELECTORS = [
    "nav",
    "header",
    "footer",
    "aside",
    ".mw-jump-link",
    ".vector-header-container",
    ".vector-page-toolbar",
    ".toc",
    ".catlinks",
    ".printfooter",
    ".mw-editsection",
]

TRANSLATED_TITLE_RE = re.compile(r"^(?P<base>.+?) \((?P<label>[^()]+)\) - ArchWiki$")
ARCHWIKI_TRANSLATION_LABELS = {
    "Afrikaans",
    "Azərbaycanca",
    "Bahasa Indonesia",
    "Bosanski",
    "Català",
    "Čeština",
    "Dansk",
    "Deutsch",
    "Ελληνικά",
    "English",
    "Esperanto",
    "Español",
    "Eesti",
    "فارسی",
    "Suomi",
    "Français",
    "עברית",
    "Hrvatski",
    "Magyar",
    "Italiano",
    "日本語",
    "한국어",
    "Lietuviškai",
    "Latviešu",
    "Nederlands",
    "Norsk Bokmål",
    "Polski",
    "Português",
    "Română",
    "Русский",
    "Slovenčina",
    "Српски",
    "Svenska",
    "ไทย",
    "Türkçe",
    "Українська",
    "Tiếng Việt",
    "简体中文",
    "繁體中文",
}


def iter_archwiki_documents(root: Path, *, limit: int | None = None) -> Iterator[ParsedDocument]:
    count = 0
    for path in sorted(root.rglob("*.html")):
        parsed = parse_archwiki_html(path)
        if parsed is None:
            continue
        yield parsed
        count += 1
        if limit and count >= limit:
            break


def parse_archwiki_html(path: Path) -> ParsedDocument | None:
    raw_html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw_html, "html.parser")
    for selector in NOISE_SELECTORS:
        for element in soup.select(selector):
            element.decompose()

    content_root = (
        soup.select_one("#content")
        or soup.select_one("main")
        or soup.select_one("article")
        or soup.body
        or soup
    )
    title = _extract_title(content_root, soup, path)
    if _is_translated_archwiki_title(title):
        return None
    sections = _extract_sections(content_root)
    links_out = _extract_links(content_root)
    media_references = _extract_media_references(content_root)
    summary = sections[0].content[:400].strip() if sections else title

    return ParsedDocument(
        source_type=SourceType.ARCH_WIKI,
        source_name="arch_linux_wiki",
        canonical_id=slugify(path.stem),
        article_title=title,
        slug=slugify(path.stem.replace("_", " ")),
        source_identifier=path.stem,
        summary=summary,
        raw_content=raw_html,
        normalized_content="\n\n".join(section.content for section in sections) if sections else title,
        path_or_url=f"https://wiki.archlinux.org/title/{path.stem.replace(' ', '_')}",
        document_kind="article",
        links_out=links_out[:200],
        media_references=media_references[:100],
        metadata={"file_path": str(path)},
        sections=sections or [Section(title=None, content=title)],
    )


def _extract_title(content_root: BeautifulSoup, soup: BeautifulSoup, path: Path) -> str:
    for selector in ("h1", "title"):
        node = content_root.select_one(selector) or soup.select_one(selector)
        if node and node.get_text(strip=True):
            return normalize_whitespace(node.get_text(" ", strip=True))
    return path.stem.replace("_", " ")


def _extract_sections(content_root: BeautifulSoup) -> list[Section]:
    sections: list[Section] = []
    current_title: str | None = None
    current_parts: list[str] = []

    for element in content_root.find_all(
        ["h1", "h2", "h3", "h4", "p", "ul", "ol", "pre", "code", "table"],
        recursive=True,
    ):
        name = element.name or ""
        text = ""
        if name in {"h1", "h2", "h3", "h4"}:
            _flush_section(sections, current_title, current_parts)
            current_title = normalize_whitespace(element.get_text(" ", strip=True))
            current_parts = []
            continue
        if name == "pre":
            text = f"```\n{element.get_text('\n', strip=True)}\n```"
        elif name == "code" and element.parent and element.parent.name != "pre":
            text = f"`{element.get_text(' ', strip=True)}`"
        elif name in {"ul", "ol"}:
            items = [normalize_whitespace(item.get_text(" ", strip=True)) for item in element.find_all("li", recursive=False)]
            text = "\n".join(f"- {item}" for item in items if item)
        elif name == "table":
            text = normalize_whitespace(element.get_text(" ", strip=True))
        else:
            text = normalize_whitespace(element.get_text(" ", strip=True))
        if text:
            current_parts.append(text)

    _flush_section(sections, current_title, current_parts)
    return [section for section in sections if section.content.strip()]


def _flush_section(sections: list[Section], title: str | None, parts: list[str]) -> None:
    content = "\n\n".join(part for part in parts if part.strip())
    if content:
        sections.append(Section(title=title, content=content))


def _is_translated_archwiki_title(title: str) -> bool:
    match = TRANSLATED_TITLE_RE.match(title)
    if match is None:
        return False
    return normalize_whitespace(match.group("label")) in ARCHWIKI_TRANSLATION_LABELS


def _extract_links(content_root: BeautifulSoup) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for anchor in content_root.select("a[href]"):
        href = anchor.get("href", "").strip()
        if not href:
            continue
        title = None
        if "/title/" in href:
            title = href.rsplit("/title/", 1)[-1]
        elif href.startswith("./") and href.endswith(".html"):
            title = Path(href).stem
        if title is None:
            continue
        title = normalize_whitespace(title.replace("_", " "))
        if not title or title in seen:
            continue
        seen.add(title)
        links.append(title)
    return links


def _extract_media_references(content_root: BeautifulSoup) -> list[str]:
    media: list[str] = []
    seen: set[str] = set()
    for image in content_root.select("img[src]"):
        src = image.get("src", "").strip()
        if not src or src in seen:
            continue
        seen.add(src)
        media.append(src)
    return media
