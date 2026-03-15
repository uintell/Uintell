const HIDDEN_SOURCE_TYPES = new Set(["arch_wiki"]);
const HIDDEN_FILE_NAMES = new Set(["enwiki-latest-pages-articles-multistream-index.txt.bz2"]);

function basename(value?: string | null): string {
  if (!value) {
    return "";
  }
  return value.replaceAll("\\", "/").replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? "";
}

export function isHiddenSourceType(sourceType?: string | null): boolean {
  return Boolean(sourceType && HIDDEN_SOURCE_TYPES.has(sourceType));
}

export function isHiddenPath(value?: string | null): boolean {
  return HIDDEN_FILE_NAMES.has(basename(value));
}

export function isHiddenDocumentLike(item: {
  source_type?: string | null;
  title?: string | null;
  path_or_url?: string | null;
}): boolean {
  return isHiddenSourceType(item.source_type) || isHiddenPath(item.path_or_url) || HIDDEN_FILE_NAMES.has(basename(item.title));
}

export function isHiddenProfileLike(item: {
  source_type?: string | null;
  target_path?: string | null;
}): boolean {
  return isHiddenSourceType(item.source_type) || isHiddenPath(item.target_path);
}
