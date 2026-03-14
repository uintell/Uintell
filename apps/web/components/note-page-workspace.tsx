"use client";

import type { DocumentRecord, NoteRecord } from "@uintell/shared/contracts";
import { BookOpenText, FilePenLine, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

type NoteFormState = {
  title: string;
  content_markdown: string;
  tags: string;
  linked_document_id: string;
};

type Heading = {
  anchor: string;
  level: number;
  title: string;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePageKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHeadingAnchor(title: string, index: number, seen: Map<string, number>): string {
  const base = normalizePageKey(title) || `section-${index + 1}`;
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function extractHeadings(markdown: string): Heading[] {
  const seen = new Map<string, number>();
  return markdown
    .split("\n")
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line.trim());
      if (!match) {
        return null;
      }
      const title = match[2].trim();
      return {
        anchor: buildHeadingAnchor(title, index, seen),
        level: match[1].length,
        title,
      };
    })
    .filter((heading): heading is Heading => Boolean(heading));
}

function extractWikiTargets(markdown: string): string[] {
  const targets = new Set<string>();
  for (const match of markdown.matchAll(/\[\[([^[\]]+?)\]\]/g)) {
    const [targetPart] = match[1].split("|");
    const target = targetPart?.trim();
    if (target) {
      targets.add(target);
    }
  }
  return [...targets];
}

function findPageByTarget(pages: NoteRecord[], target: string): NoteRecord | undefined {
  const normalizedTarget = normalizePageKey(target);
  return pages.find((page) => page.slug === target || normalizePageKey(page.slug) === normalizedTarget || normalizePageKey(page.title) === normalizedTarget);
}

function buildDecoratedHtml(note: NoteRecord, pages: NoteRecord[]): string {
  const headings = extractHeadings(note.content_markdown);
  let headingIndex = 0;
  let html = note.content_html?.trim();

  if (!html) {
    html = `<p>${escapeHtml(note.content_markdown).replaceAll("\n", "<br/>")}</p>`;
  }

  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    const heading = headings[headingIndex];
    headingIndex += 1;
    if (!heading) {
      return match;
    }
    return `<h${level} id="${heading.anchor}">${inner}</h${level}>`;
  });

  html = html.replace(/\[\[([^[\]]+?)\]\]/g, (_match, rawValue) => {
    const [targetPart, labelPart] = String(rawValue).split("|");
    const target = targetPart?.trim() ?? "";
    const label = (labelPart?.trim() || target).trim();
    const page = findPageByTarget(pages, target);
    const href = page ? `/app/notes/${page.slug}` : `/app/notes?new=${encodeURIComponent(target)}`;
    return `<a href="${href}">${escapeHtml(label)}</a>`;
  });

  return html;
}

function upsertPage(pages: NoteRecord[], updated: NoteRecord): NoteRecord[] {
  const next = [...pages.filter((page) => page.id !== updated.id), updated];
  return next.sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
}

export function NotePageWorkspace({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [pages, setPages] = useState<NoteRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [form, setForm] = useState<NoteFormState>({
    title: "",
    content_markdown: "",
    tags: "",
    linked_document_id: "",
  });
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(searchParams.get("edit") === "1" ? "edit" : "read");
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const [noteResponse, pagesResponse, documentsResponse] = await Promise.all([
          api.getNoteBySlug(slug),
          api.listNotes(),
          api.listDocuments({ limit: 200 }),
        ]);
        if (!active) {
          return;
        }
        setNote(noteResponse);
        setPages(pagesResponse);
        setDocuments(documentsResponse.documents);
        setForm({
          title: noteResponse.title,
          content_markdown: noteResponse.content_markdown,
          tags: noteResponse.tags.join(", "),
          linked_document_id: noteResponse.linked_document_id ?? "",
        });
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load page");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
  }, [slug]);

  const headings = useMemo(() => (note ? extractHeadings(note.content_markdown) : []), [note]);
  const linkedDocument = useMemo(
    () => documents.find((document) => document.id === note?.linked_document_id) ?? null,
    [documents, note?.linked_document_id],
  );
  const wikiTargets = useMemo(() => (note ? extractWikiTargets(note.content_markdown) : []), [note]);
  const linkedPages = useMemo(() => {
    const currentId = note?.id;
    return wikiTargets
      .map((target) => findPageByTarget(pages, target))
      .filter((page): page is NoteRecord => Boolean(page && page.id !== currentId));
  }, [note?.id, pages, wikiTargets]);
  const missingPages = useMemo(() => {
    const existing = new Set(linkedPages.map((page) => page.slug));
    return wikiTargets.filter((target) => {
      const page = findPageByTarget(pages, target);
      return !page || !existing.has(page.slug);
    });
  }, [linkedPages, pages, wikiTargets]);
  const relatedPages = useMemo(() => {
    if (!note || note.tags.length === 0) {
      return [];
    }
    const tagSet = new Set(note.tags);
    return pages
      .filter((page) => page.id !== note.id)
      .map((page) => ({
        page,
        score: page.tags.reduce((count, tag) => (tagSet.has(tag) ? count + 1 : count), 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
      .slice(0, 5)
      .map((entry) => entry.page);
  }, [note, pages]);
  const renderedHtml = useMemo(() => (note ? buildDecoratedHtml(note, pages) : ""), [note, pages]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!note) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateNote(note.id, {
        title: form.title.trim(),
        content_markdown: form.content_markdown,
        tags: parseTags(form.tags),
        linked_document_id: form.linked_document_id || null,
        metadata: note.metadata ?? {},
      });

      setNote(updated);
      setPages((current) => upsertPage(current, updated));
      setMode("read");

      if (updated.slug !== slug) {
        router.replace(`/app/notes/${updated.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save page");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!note || !window.confirm("Delete this page?")) {
      return;
    }

    setError(null);
    try {
      await api.deleteNote(note.id);
      router.push("/app/notes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete page");
    }
  }

  if (loading) {
    return <div className="border border-[#12311d] bg-[#08110d] p-8 text-sm text-[#5faa73]">Loading knowledge page...</div>;
  }

  if (error || !note) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">
        {error ?? "Page not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border border-[#12311d] bg-[#050b08] p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/app/notes" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
            Back to pages
          </Link>
          {linkedDocument ? (
            <Link
              href={linkedDocument.slug ? `/app/library/${linkedDocument.slug}` : "/app/library"}
              className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
            >
              Linked source
            </Link>
          ) : null}
          <Link href="/app/notes?new=Untitled%20page" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
            Create page
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Knowledge page</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#7df2a6]">{note.title}</h1>
            {note.plain_text ? <p className="mt-4 max-w-4xl text-base leading-8 text-[#66c485]">{note.plain_text.slice(0, 260)}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
              <span>Updated {formatTimestamp(note.updated_at)}</span>
              <span>{note.slug}</span>
              <span>{headings.length} sections</span>
              <span>{wikiTargets.length} page links</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("read")}
              className={`rounded-full border px-4 py-2 text-sm transition ${mode === "read" ? "border-[#4d8dff] bg-[#4d8dff] text-[#020704]" : "border-[#12311d] text-[#4d8dff] hover:border-[#4d8dff] hover:text-[#7aaaff]"}`}
            >
              Read
            </button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`rounded-full border px-4 py-2 text-sm transition ${mode === "edit" ? "border-[#4d8dff] bg-[#4d8dff] text-[#020704]" : "border-[#12311d] text-[#4d8dff] hover:border-[#4d8dff] hover:text-[#7aaaff]"}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 px-4 py-2 text-sm text-rose-200 transition hover:border-rose-400"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          {mode === "edit" ? (
            <form onSubmit={handleSave} className="border border-[#12311d] bg-[#08110d] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#7df2a6]">Edit page</div>
                  <div className="mt-1 text-xs text-[#5faa73]">Use markdown headings for contents and `[[Page Title]]` for internal links.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("read");
                    setForm({
                      title: note.title,
                      content_markdown: note.content_markdown,
                      tags: note.tags.join(", "),
                      linked_document_id: note.linked_document_id ?? "",
                    });
                  }}
                  className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
                >
                  Cancel
                </button>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm text-[#5faa73]">Page title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-[#12311d] bg-[#050b08] px-4 py-3 text-sm text-[#7df2a6] outline-none focus:border-[#4d8dff]"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-[#5faa73]">Linked document</span>
                <select
                  value={form.linked_document_id}
                  onChange={(event) => setForm((current) => ({ ...current, linked_document_id: event.target.value }))}
                  className="w-full rounded-2xl border border-[#12311d] bg-[#050b08] px-4 py-3 text-sm text-[#7df2a6] outline-none focus:border-[#4d8dff]"
                >
                  <option value="">No linked document</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-[#5faa73]">Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  className="w-full rounded-2xl border border-[#12311d] bg-[#050b08] px-4 py-3 text-sm text-[#7df2a6] outline-none focus:border-[#4d8dff]"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-[#5faa73]">Markdown</span>
                <textarea
                  value={form.content_markdown}
                  onChange={(event) => setForm((current) => ({ ...current, content_markdown: event.target.value }))}
                  rows={22}
                  className="w-full resize-y rounded-2xl border border-[#12311d] bg-[#050b08] px-4 py-3 text-sm leading-7 text-[#7df2a6] outline-none focus:border-[#4d8dff]"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save page"}
                </button>
                <Link href={`/app/notes/${note.slug}`} className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
                  Open page view
                </Link>
              </div>
            </form>
          ) : (
            <article className="border border-[#12311d] bg-[#08110d] p-6">
              <div
                className="text-[#66c485] [&_a]:text-[#4d8dff] [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-[#7aaaff] [&_blockquote]:border-l-2 [&_blockquote]:border-[#12311d] [&_blockquote]:pl-4 [&_blockquote]:text-[#5faa73] [&_code]:rounded [&_code]:bg-[#050b08] [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mt-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:text-[#7df2a6] [&_h1:first-child]:mt-0 [&_h2]:mt-8 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-[#12311d] [&_h2]:pb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-[#7df2a6] [&_h3]:mt-6 [&_h3]:scroll-mt-24 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[#7df2a6] [&_li]:leading-8 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:my-4 [&_p]:leading-8 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-[#12311d] [&_pre]:bg-[#050b08] [&_pre]:p-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </article>
          )}
        </section>

        <aside className="space-y-4">
          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Contents</div>
            <div className="mt-4 space-y-2">
              {headings.length === 0 ? <div className="text-sm text-[#5faa73]">No headings yet. Add markdown headings to build contents.</div> : null}
              {headings.map((heading) => (
                <a
                  key={heading.anchor}
                  href={`#${heading.anchor}`}
                  className="block border border-transparent px-3 py-2 text-sm text-[#4d8dff] transition hover:border-[#12311d] hover:bg-[#08110d] hover:text-[#7aaaff]"
                  style={{ paddingLeft: `${0.75 + (heading.level - 1) * 0.6}rem` }}
                >
                  {heading.title}
                </a>
              ))}
            </div>
          </section>

          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Page links</div>
            <div className="mt-4 space-y-3">
              {linkedPages.length === 0 && missingPages.length === 0 ? <div className="text-sm text-[#5faa73]">No internal page links yet.</div> : null}
              {linkedPages.map((page) => (
                <Link key={page.id} href={`/app/notes/${page.slug}`} className="flex items-center gap-2 border border-[#12311d] bg-[#08110d] p-4 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
                  <BookOpenText className="h-4 w-4" />
                  {page.title}
                </Link>
              ))}
              {missingPages.map((target) => (
                <Link
                  key={target}
                  href={`/app/notes?new=${encodeURIComponent(target)}`}
                  className="flex items-center gap-2 border border-dashed border-[#12311d] p-4 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
                >
                  <Plus className="h-4 w-4" />
                  Create {target}
                </Link>
              ))}
            </div>
          </section>

          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Related pages</div>
            <div className="mt-4 space-y-3">
              {relatedPages.length === 0 ? <div className="text-sm text-[#5faa73]">No related pages detected from shared tags.</div> : null}
              {relatedPages.map((page) => (
                <Link key={page.id} href={`/app/notes/${page.slug}`} className="block border border-[#12311d] bg-[#08110d] p-4">
                  <div className="text-sm font-medium text-[#7df2a6]">{page.title}</div>
                  {page.tags.length ? <div className="mt-2 text-xs text-[#5faa73]">{page.tags.join(", ")}</div> : null}
                </Link>
              ))}
            </div>
          </section>

          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Page details</div>
            <div className="mt-4 space-y-3 text-sm text-[#66c485]">
              <div>Slug: {note.slug}</div>
              <div>Created: {formatTimestamp(note.created_at)}</div>
              <div>Updated: {formatTimestamp(note.updated_at)}</div>
              {note.tags.length ? <div>Tags: {note.tags.join(", ")}</div> : <div>Tags: none</div>}
              {linkedDocument ? (
                <Link href={linkedDocument.slug ? `/app/library/${linkedDocument.slug}` : "/app/library"} className="inline-flex items-center gap-2 text-[#4d8dff] transition hover:text-[#7aaaff]">
                  <FilePenLine className="h-4 w-4" />
                  {linkedDocument.title}
                </Link>
              ) : (
                <div>No linked source document</div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
