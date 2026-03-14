"use client";

import type { DocumentRecord, NoteRecord } from "@uintell/shared/contracts";
import { BookOpenText, FilePenLine, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

type NoteFormState = {
  id: string | null;
  title: string;
  content_markdown: string;
  tags: string;
  linked_document_id: string;
};

const EMPTY_FORM: NoteFormState = {
  id: null,
  title: "",
  content_markdown: "",
  tags: "",
  linked_document_id: "",
};

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function buildStarterMarkdown(title: string): string {
  return `# ${title}

Add the opening summary for this page.

## Overview

Write the core context, definitions, and current understanding here.

## Related pages

- Link existing knowledge with [[Another Page]]

## References

- Add relevant source material here
`;
}

function summarizeNote(note: NoteRecord): string {
  const source = note.plain_text?.trim() || note.content_markdown.trim();
  if (!source) {
    return "This page is empty. Open it to start writing.";
  }
  return source.length > 220 ? `${source.slice(0, 217)}...` : source;
}

function filterNotes(notes: NoteRecord[], query: string): NoteRecord[] {
  if (!query) {
    return notes;
  }

  return notes.filter((note) => {
    const haystack = [note.title, note.slug, note.plain_text ?? note.content_markdown, note.tags.join(" ")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function NotesWorkspace() {
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [form, setForm] = useState<NoteFormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [notesResponse, documentsResponse] = await Promise.all([api.listNotes(), api.listDocuments({ limit: 200 })]);
      setNotes(notesResponse);
      setDocuments(documentsResponse.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const requestedTitle = searchParams.get("new")?.trim();
    const linkedDocumentId = searchParams.get("document")?.trim() ?? "";

    if (!requestedTitle && !linkedDocumentId) {
      return;
    }

    const title = requestedTitle || "Untitled page";
    setForm({
      id: null,
      title,
      content_markdown: buildStarterMarkdown(title),
      tags: "",
      linked_document_id: linkedDocumentId,
    });
    setError(null);
  }, [searchParams]);

  const filteredNotes = useMemo(() => filterNotes(notes, deferredQuery), [deferredQuery, notes]);
  const linkedPagesCount = useMemo(() => notes.filter((note) => note.linked_document_id).length, [notes]);
  const updatedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return notes.filter((note) => new Date(note.updated_at).getTime() >= weekAgo).length;
  }, [notes]);

  function editNote(note: NoteRecord) {
    setForm({
      id: note.id,
      title: note.title,
      content_markdown: note.content_markdown,
      tags: note.tags.join(", "),
      linked_document_id: note.linked_document_id ?? "",
    });
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: form.title.trim(),
        content_markdown: form.content_markdown,
        tags: parseTags(form.tags),
        linked_document_id: form.linked_document_id || null,
        metadata: {},
      };

      if (!payload.title || !payload.content_markdown.trim()) {
        throw new Error("Title and page content are required");
      }

      if (form.id) {
        await api.updateNote(form.id, payload);
      } else {
        await api.createNote(payload);
      }

      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save page");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!window.confirm("Delete this page?")) {
      return;
    }

    setError(null);
    try {
      await api.deleteNote(noteId);
      if (form.id === noteId) {
        setForm(EMPTY_FORM);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete page");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#5faa73]">Knowledge pages</div>
          <h1 className="mt-3 text-3xl font-semibold text-[#7df2a6]">Wiki-style pages that you can actually create and edit</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#66c485]">
            Build internal knowledge pages with markdown, connect them with `[[Page Title]]`, and link each page to an
            indexed source document when needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM, content_markdown: buildStarterMarkdown("Untitled page"), title: "Untitled page" })}
            className="inline-flex items-center gap-2 rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff]"
          >
            <Plus className="h-4 w-4" />
            New page
          </button>
          <Link href="/app/library" className="rounded-full border border-[#12311d] px-5 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
            Browse library
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Pages", value: notes.length, detail: "Knowledge pages available in your workspace" },
          { label: "Linked sources", value: linkedPagesCount, detail: "Pages attached to indexed documents" },
          { label: "Updated this week", value: updatedThisWeek, detail: "Pages changed in the last seven days" },
        ].map((item) => (
          <div key={item.label} className="border border-[#12311d] bg-[#08110d] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">{item.label}</div>
            <div className="mt-4 text-3xl font-semibold text-[#7df2a6]">{loading ? "..." : item.value}</div>
            <div className="mt-2 text-sm text-[#66c485]">{item.detail}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="border border-[#12311d] bg-[#050b08] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[#7df2a6]">{form.id ? "Edit page" : "Create page"}</div>
              <div className="mt-1 text-xs text-[#5faa73]">Use markdown headings for structure and `[[Page Title]]` for internal page links.</div>
            </div>
            {form.id ? (
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
              >
                Clear
              </button>
            ) : null}
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm text-[#5faa73]">Page title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-[#12311d] bg-[#08110d] px-4 py-3 text-sm text-[#7df2a6] outline-none placeholder:text-[#4e7960] focus:border-[#4d8dff]"
              placeholder="Threat intelligence workflow"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-[#5faa73]">Linked document</span>
            <select
              value={form.linked_document_id}
              onChange={(event) => setForm((current) => ({ ...current, linked_document_id: event.target.value }))}
              className="w-full rounded-2xl border border-[#12311d] bg-[#08110d] px-4 py-3 text-sm text-[#7df2a6] outline-none focus:border-[#4d8dff]"
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
              className="w-full rounded-2xl border border-[#12311d] bg-[#08110d] px-4 py-3 text-sm text-[#7df2a6] outline-none placeholder:text-[#4e7960] focus:border-[#4d8dff]"
              placeholder="workflow, incident-response, retrieval"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-[#5faa73]">Page markdown</span>
            <textarea
              value={form.content_markdown}
              onChange={(event) => setForm((current) => ({ ...current, content_markdown: event.target.value }))}
              rows={18}
              className="w-full resize-y rounded-2xl border border-[#12311d] bg-[#08110d] px-4 py-3 text-sm leading-7 text-[#7df2a6] outline-none placeholder:text-[#4e7960] focus:border-[#4d8dff]"
              placeholder={buildStarterMarkdown("Threat intelligence workflow")}
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button disabled={saving} className="rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff] disabled:opacity-60">
              {saving ? "Saving..." : form.id ? "Update page" : "Create page"}
            </button>
            <div className="rounded-full border border-[#12311d] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
              Internal links: `[[Page Title]]`
            </div>
          </div>
        </form>

        <section className="space-y-4">
          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Page directory</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Browse and open knowledge pages</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-[220px] rounded-2xl border border-[#12311d] bg-[#08110d] px-4 py-3 text-sm text-[#7df2a6] outline-none placeholder:text-[#4e7960] focus:border-[#4d8dff]"
                  placeholder="Filter by title, content, slug, or tag"
                />
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex items-center gap-2 rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 text-sm text-[#5faa73]">
              {loading ? "Loading pages..." : `${filteredNotes.length} pages${query ? ` matching "${query}"` : ""}`}
            </div>
          </div>

          {!loading && filteredNotes.length === 0 ? (
            <div className="border border-dashed border-[#12311d] p-6 text-sm text-[#5faa73]">
              No pages matched this view. Create one from the editor or open a missing `[[Page Title]]` link from an existing page.
            </div>
          ) : null}

          <div className="grid gap-4">
            {filteredNotes.map((note) => {
              const linkedDocument = documents.find((document) => document.id === note.linked_document_id);
              return (
                <article key={note.id} className="border border-[#12311d] bg-[#08110d] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
                        <span>Updated {formatTimestamp(note.updated_at)}</span>
                        <span>{note.slug}</span>
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-[#7df2a6]">
                        <Link href={`/app/notes/${note.slug}`} className="transition hover:text-[#7aaaff]">
                          {note.title}
                        </Link>
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#66c485]">{summarizeNote(note)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/app/notes/${note.slug}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
                      >
                        <BookOpenText className="h-4 w-4" />
                        Open page
                      </Link>
                      <button
                        type="button"
                        onClick={() => editNote(note)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
                      >
                        <FilePenLine className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(note.id)}
                        className="rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {note.tags.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs text-[#5faa73]">
                    {linkedDocument ? `Linked source: ${linkedDocument.title}` : "No linked source document"}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
