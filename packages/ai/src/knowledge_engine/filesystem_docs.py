from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

import yaml
from bs4 import BeautifulSoup
from ebooklib import ITEM_DOCUMENT, epub
from markdown import markdown
from pypdf import PdfReader

from knowledge_engine.models import ParsedDocument, Section, SourceType
from knowledge_engine.utils import is_binary_file, normalize_whitespace, slugify


TEXT_EXTENSIONS = {
    ".md",
    ".markdown",
    ".txt",
    ".rst",
    ".py",
    ".rs",
    ".js",
    ".ts",
    ".tsx",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".sh",
    ".go",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".sql",
}
MARKDOWN_EXTENSIONS = {".md", ".markdown", ".rst"}
NOTE_EXTENSIONS = {".md", ".markdown", ".rst", ".txt"}
BOOK_EXTENSIONS = {".epub", ".pdf"}
MARKDOWN_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def iter_filesystem_documents(root: Path, *, limit: int | None = None) -> Iterator[ParsedDocument]:
    count = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name.startswith(".") or is_binary_file(path):
            continue
        parsed = parse_filesystem_document(root, path)
        if parsed is None:
            continue
        yield parsed
        count += 1
        if limit and count >= limit:
            break


def parse_filesystem_document(root: Path, path: Path) -> ParsedDocument | None:
    relative = path.relative_to(root)
    suffix = path.suffix.lower()
    if suffix == ".html":
        title, raw_content, normalized_content, sections, links_out, media_references = _parse_html_document(path)
    elif suffix == ".pdf":
        title, raw_content, normalized_content, sections, links_out, media_references = _parse_pdf_document(path)
    elif suffix == ".epub":
        title, raw_content, normalized_content, sections, links_out, media_references = _parse_epub_document(path)
    elif suffix in MARKDOWN_EXTENSIONS:
        title, raw_content, normalized_content, sections, links_out, media_references = _parse_markdown_document(path)
    elif suffix in TEXT_EXTENSIONS:
        raw_text = path.read_text(encoding="utf-8", errors="ignore")
        title = relative.stem
        raw_content = raw_text
        normalized_content = normalize_whitespace(raw_text)
        sections = [Section(title=None, content=normalized_content)]
        links_out = []
        media_references = []
    else:
        return None

    normalized_content = normalized_content.strip()
    if len(normalized_content) < 40:
        return None

    source_type, source_name, document_kind = _classify_source(relative, suffix)
    summary = _summarize(sections, normalized_content)
    tags = _derive_tags(relative)

    return ParsedDocument(
        source_type=source_type,
        source_name=source_name,
        canonical_id=slugify(str(relative)),
        source_identifier=str(relative),
        article_title=title,
        slug=slugify(str(relative.with_suffix(""))),
        summary=summary,
        raw_content=raw_content,
        normalized_content=normalized_content,
        path_or_url=str(path),
        document_kind=document_kind,
        tags=tags,
        links_out=links_out[:200],
        media_references=media_references[:100],
        metadata={
            "relative_path": str(relative),
            "extension": suffix,
        },
        sections=sections,
    )


def _classify_source(relative: Path, suffix: str) -> tuple[SourceType, str, str]:
    first_part = relative.parts[0].lower() if relative.parts else ""
    if suffix in BOOK_EXTENSIONS or first_part in {"books", "library"}:
        return SourceType.BOOK, "local_books", "book"
    if suffix in NOTE_EXTENSIONS or first_part in {"notes", "journal"}:
        return SourceType.NOTE, "local_notes", "note"
    return SourceType.FILESYSTEM, "local_filesystem", "document"


def _parse_markdown_document(path: Path) -> tuple[str, str, str, list[Section], list[str], list[str]]:
    raw_text = path.read_text(encoding="utf-8", errors="ignore")
    frontmatter, body = _split_frontmatter(raw_text)
    title = str(frontmatter.get("title") or path.stem)
    html = markdown(body)
    normalized_content = _html_fragment_to_text(html)
    sections = _split_markdown_sections(body)
    links_out = [normalize_whitespace(target) for _, target in MARKDOWN_LINK_RE.findall(body)]
    return title, raw_text, normalized_content, sections or [Section(title=None, content=normalized_content)], links_out, []


def _parse_html_document(path: Path) -> tuple[str, str, str, list[Section], list[str], list[str]]:
    raw_html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw_html, "html.parser")
    for element in soup.select("script, style, nav, header, footer, aside"):
        element.decompose()
    title = normalize_whitespace((soup.title.get_text(" ", strip=True) if soup.title else "") or path.stem)
    normalized_content = normalize_whitespace(soup.get_text("\n", strip=True))
    sections = _html_sections(soup)
    links_out = _html_links(soup)
    media_references = [img.get("src", "").strip() for img in soup.select("img[src]") if img.get("src", "").strip()]
    return title, raw_html, normalized_content, sections or [Section(title=None, content=normalized_content)], links_out, media_references


def _parse_pdf_document(path: Path) -> tuple[str, str, str, list[Section], list[str], list[str]]:
    reader = PdfReader(str(path))
    pages: list[str] = []
    sections: list[Section] = []
    for index, page in enumerate(reader.pages, start=1):
        text = normalize_whitespace(page.extract_text() or "")
        if not text:
            continue
        pages.append(text)
        sections.append(Section(title=f"Page {index}", content=text, anchor=f"page-{index}"))
    normalized_content = "\n\n".join(pages)
    return path.stem, normalized_content, normalized_content, sections or [Section(title=None, content=normalized_content)], [], []


def _parse_epub_document(path: Path) -> tuple[str, str, str, list[Section], list[str], list[str]]:
    book = epub.read_epub(str(path))
    title = normalize_whitespace(next(iter(book.get_metadata("DC", "title")), ("", {}))[0] or path.stem)
    parts: list[str] = []
    sections: list[Section] = []
    links_out: list[str] = []
    media_references: list[str] = []

    for item in book.get_items_of_type(ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_body_content(), "html.parser")
        section_title = _first_heading(soup) or normalize_whitespace(item.get_name().rsplit("/", 1)[-1].replace(".xhtml", ""))
        section_text = normalize_whitespace(soup.get_text("\n", strip=True))
        if not section_text:
            continue
        parts.append(section_text)
        sections.append(Section(title=section_title, content=section_text, anchor=slugify(section_title)))
        links_out.extend(_html_links(soup))
        media_references.extend([img.get("src", "").strip() for img in soup.select("img[src]") if img.get("src", "").strip()])

    normalized_content = "\n\n".join(parts)
    raw_content = normalized_content
    return title, raw_content, normalized_content, sections or [Section(title=None, content=normalized_content)], links_out, media_references


def _split_frontmatter(raw_text: str) -> tuple[dict, str]:
    trimmed = raw_text.lstrip()
    if not trimmed.startswith("---\n"):
        return {}, raw_text
    _, remainder = trimmed.split("---\n", 1)
    if "\n---\n" not in remainder:
        return {}, raw_text
    raw_frontmatter, body = remainder.split("\n---\n", 1)
    try:
        data = yaml.safe_load(raw_frontmatter) or {}
    except yaml.YAMLError:
        data = {}
    return data if isinstance(data, dict) else {}, body


def _split_markdown_sections(markdown_text: str) -> list[Section]:
    matches = list(MARKDOWN_HEADING_RE.finditer(markdown_text))
    if not matches:
        return [Section(title=None, content=_html_fragment_to_text(markdown(markdown_text)))]

    sections: list[Section] = []
    preamble = markdown_text[: matches[0].start()].strip()
    if preamble:
        sections.append(Section(title="Overview", content=_html_fragment_to_text(markdown(preamble)), anchor="overview"))

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown_text)
        title = normalize_whitespace(match.group(2))
        content = markdown_text[start:end].strip()
        normalized = _html_fragment_to_text(markdown(content)) if content else ""
        if normalized:
            sections.append(Section(title=title, content=normalized, anchor=slugify(title)))
    return sections


def _html_sections(soup: BeautifulSoup) -> list[Section]:
    sections: list[Section] = []
    current_title: str | None = None
    current_parts: list[str] = []
    for element in soup.find_all(["h1", "h2", "h3", "h4", "p", "pre", "code", "li"], recursive=True):
        name = element.name or ""
        if name in {"h1", "h2", "h3", "h4"}:
            _flush_sections(sections, current_title, current_parts)
            current_title = normalize_whitespace(element.get_text(" ", strip=True))
            current_parts = []
            continue
        text = normalize_whitespace(element.get_text(" ", strip=True))
        if text:
            current_parts.append(text)
    _flush_sections(sections, current_title, current_parts)
    return sections


def _flush_sections(sections: list[Section], title: str | None, parts: list[str]) -> None:
    content = "\n\n".join(part for part in parts if part.strip())
    if content:
        sections.append(Section(title=title, content=content, anchor=slugify(title) if title else None))


def _html_fragment_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup.select("script, style, nav, header, footer, aside"):
        element.decompose()
    return normalize_whitespace(soup.get_text("\n", strip=True))


def _html_links(soup: BeautifulSoup) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for anchor in soup.select("a[href]"):
        href = normalize_whitespace(anchor.get("href", "").strip())
        if not href or href.startswith("#") or href in seen:
            continue
        seen.add(href)
        links.append(href)
    return links


def _derive_tags(relative: Path) -> list[str]:
    tags = [slugify(part) for part in relative.parts[:-1] if part and part not in {".", ".."}]
    return [tag for tag in tags if tag]


def _summarize(sections: list[Section], normalized_content: str) -> str:
    for section in sections:
        if section.content.strip():
            return section.content[:400].strip()
    return normalized_content[:400].strip()


def _first_heading(soup: BeautifulSoup) -> str | None:
    heading = soup.find(["h1", "h2", "h3"])
    if heading:
        text = normalize_whitespace(heading.get_text(" ", strip=True))
        if text:
            return text
    return None
