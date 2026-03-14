from __future__ import annotations

import bz2
import re
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from pathlib import Path

import mwparserfromhell

from knowledge_engine.models import ParsedDocument, Section, SourceType
from knowledge_engine.utils import normalize_whitespace, slugify


PAGE_TAG = "{*}page"
TITLE_TAG = "{*}title"
NS_TAG = "{*}ns"
REDIRECT_TAG = "{*}redirect"
TEXT_TAG = "{*}text"
SECTION_RE = re.compile(r"^={2,6}\s*(.+?)\s*={2,6}$", re.MULTILINE)
CATEGORY_RE = re.compile(r"\[\[Category:(.+?)(?:\|.*)?\]\]")


def iter_wikipedia_documents(path: Path, *, limit: int | None = None) -> Iterator[ParsedDocument]:
    count = 0
    with bz2.open(path, "rb") as stream:
        context = ET.iterparse(stream, events=("end",))
        for _, element in context:
            if not element.tag.endswith("page"):
                continue
            parsed = _parse_page(element)
            element.clear()
            if parsed is None:
                continue
            yield parsed
            count += 1
            if limit and count >= limit:
                break


def _parse_page(element: ET.Element) -> ParsedDocument | None:
    title = _find_text(element, "title")
    namespace = _find_text(element, "ns")
    redirect = element.find(REDIRECT_TAG)
    text = _find_text(element, "revision/{*}text") or _find_text(element, "text")
    if not title or namespace != "0" or redirect is not None or not text:
        return None

    categories = CATEGORY_RE.findall(text)
    code = mwparserfromhell.parse(text)
    links_out = _extract_links(code)
    stripped = code.strip_code(normalize=True, collapse=True)
    cleaned = normalize_whitespace(stripped)
    if len(cleaned) < 80:
        return None
    sections = _split_wikicode_sections(text)
    summary = sections[0].content[:400].strip() if sections else cleaned[:400].strip()
    slug = slugify(title)

    return ParsedDocument(
        source_type=SourceType.WIKIPEDIA,
        source_name="english_wikipedia",
        canonical_id=slugify(title),
        article_title=title,
        slug=slug,
        source_identifier=title,
        summary=summary,
        raw_content=text,
        normalized_content=cleaned,
        path_or_url=f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
        document_kind="article",
        tags=categories[:20],
        links_out=links_out[:200],
        metadata={"categories": categories[:20]},
        sections=sections,
    )


def _find_text(element: ET.Element, path: str) -> str | None:
    node = element.find(path)
    if node is not None and node.text:
        return node.text
    for child in element.iter():
        if child.tag.endswith(path.split("/")[-1]) and child.text:
            return child.text
    return None


def _split_wikicode_sections(raw_text: str) -> list[Section]:
    matches = list(SECTION_RE.finditer(raw_text))
    if not matches:
        stripped = normalize_whitespace(mwparserfromhell.parse(raw_text).strip_code(normalize=True, collapse=True))
        return [Section(title=None, content=stripped)] if stripped else []

    sections: list[Section] = []
    preamble = raw_text[: matches[0].start()].strip()
    if preamble:
        normalized_preamble = _normalize_wikicode_fragment(preamble)
        if normalized_preamble:
            sections.append(Section(title="Overview", content=normalized_preamble))

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(raw_text)
        content = raw_text[start:end].strip()
        normalized_content = _normalize_wikicode_fragment(content)
        if normalized_content:
            sections.append(Section(title=match.group(1), content=normalized_content))

    return sections


def _normalize_wikicode_fragment(fragment: str) -> str:
    return normalize_whitespace(mwparserfromhell.parse(fragment).strip_code(normalize=True, collapse=True))


def _extract_links(code: mwparserfromhell.wikicode.Wikicode) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for wikilink in code.filter_wikilinks():
        title = str(wikilink.title).strip()
        if not title or title.startswith(("Category:", "File:", "Image:", "Help:", "Template:")):
            continue
        title = title.split("#", 1)[0].strip()
        normalized = normalize_whitespace(title)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        links.append(normalized)
    return links
