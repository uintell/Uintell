from __future__ import annotations

HIDDEN_SOURCE_TYPES = {"arch_wiki"}
HIDDEN_FILE_NAMES = {"enwiki-latest-pages-articles-multistream-index.txt.bz2"}


def _basename(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.replace("\\", "/").rstrip("/")
    return normalized.rsplit("/", 1)[-1].lower()


def is_hidden_source_type(source_type: str | None) -> bool:
    return bool(source_type and source_type in HIDDEN_SOURCE_TYPES)


def is_hidden_path(path_or_url: str | None) -> bool:
    return _basename(path_or_url) in HIDDEN_FILE_NAMES


def is_hidden_document(*, source_type: str | None, title: str | None, path_or_url: str | None) -> bool:
    return is_hidden_source_type(source_type) or is_hidden_path(path_or_url) or _basename(title) in HIDDEN_FILE_NAMES


def is_hidden_job(*, source_type: str | None, source_name: str | None, target_path: str | None) -> bool:
    return is_hidden_source_type(source_type) or is_hidden_path(target_path) or _basename(source_name) in HIDDEN_FILE_NAMES
