export function slugifyText(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "section";
}

export function normalizeReaderAnchor(sectionTitle?: string | null, explicitAnchor?: string | null): string | null {
  if (explicitAnchor && explicitAnchor.trim()) {
    return slugifyText(explicitAnchor.trim());
  }
  if (sectionTitle && sectionTitle.trim()) {
    return slugifyText(sectionTitle.trim());
  }
  return null;
}

export function buildDocumentHref(
  documentSlug?: string | null,
  sectionTitle?: string | null,
  explicitAnchor?: string | null,
): string | null {
  if (!documentSlug) {
    return null;
  }
  const anchor = normalizeReaderAnchor(sectionTitle, explicitAnchor);
  return anchor ? `/app/library/${documentSlug}#${anchor}` : `/app/library/${documentSlug}`;
}
