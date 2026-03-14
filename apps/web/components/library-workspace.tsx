"use client";

import type { DocumentRecord, SourceSummary } from "@uintell/shared/contracts";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { api } from "@/lib/api";

const SOURCE_VIEWS = [
  { label: "All", value: null as string | null, href: "/app/library" },
  { label: "Wikipedia", value: "wikipedia", href: "/app/library/source/wikipedia" },
  { label: "Arch Wiki", value: "arch_wiki", href: "/app/library/source/arch_wiki" },
  { label: "Books", value: "book", href: "/app/library/source/book" },
  { label: "Notes", value: "note", href: "/app/library/source/note" },
  { label: "Files", value: "filesystem", href: "/app/library/source/filesystem" },
];

type LibraryWorkspaceProps = {
  initialSourceType?: string | null;
};

export function LibraryWorkspace({ initialSourceType = null }: LibraryWorkspaceProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState<string | null>(initialSourceType);
  const [sort, setSort] = useState("updated_desc");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const [documentsResponse, sourcesResponse] = await Promise.all([
        api.listDocuments({
          query: deferredQuery || undefined,
          source_type: sourceType ?? undefined,
          sort,
          limit: 40,
        }),
        api.listSources({
          query: deferredQuery || undefined,
          source_type: sourceType ?? undefined,
          limit: 18,
        }),
      ]);
      setDocuments(documentsResponse.documents);
      setSources(sourcesResponse.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSourceType(initialSourceType ?? null);
  }, [initialSourceType]);

  useEffect(() => {
    void loadDocuments();
  }, [deferredQuery, sourceType, sort]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Library</div>
          <h1 className="mt-3 text-3xl font-semibold">Browse sources, then open the page you need</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Explore normalized sources and documents through one calm library. Start at the source level when you are
            orienting yourself, then drop into the reader for page-level questions and citations.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/imports" className="rounded-full border border-line px-4 py-2 text-sm text-slate-100 transition hover:border-accent">
            Import sources
          </Link>
          <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-slate-100 transition hover:border-accent">
            <input
              type="file"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError(null);
                try {
                  await api.uploadDocument(file);
                  await loadDocuments();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
            />
            {uploading ? "Uploading..." : "Upload file"}
          </label>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-3xl border border-line bg-black/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
            placeholder="Filter by title, summary, or content"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
          >
            <option value="updated_desc">Newest</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_VIEWS.map((item) => {
            const active = (sourceType ?? null) === item.value;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active ? "border-accent bg-accent text-ink" : "border-line text-slate-200 hover:border-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Sources</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Collections of knowledge</h2>
          </div>
          <div className="text-sm text-muted">{sources.length} visible</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? <div className="rounded-3xl border border-line bg-panel p-6 text-sm text-muted">Loading sources...</div> : null}
          {!loading && sources.length === 0 ? <div className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">No sources matched this view.</div> : null}
          {sources.map((source) => (
            <Link
              key={`${source.source_type}:${source.source_name}`}
              href={`/app/library/source/${encodeURIComponent(source.source_type)}/${encodeURIComponent(source.source_name)}`}
              className="rounded-3xl border border-line bg-panel p-5 transition hover:border-accent"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-medium text-white">{source.source_name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{source.source_type}</div>
                </div>
                <div className="text-right text-xs text-accent">
                  <div>{source.document_count} docs</div>
                  <div>{source.indexed_count} indexed</div>
                </div>
              </div>
              {source.document_kinds.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {source.document_kinds.slice(0, 3).map((kind) => (
                    <span key={kind} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                      {kind}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Documents</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Reader-ready pages</h2>
        </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? <div className="rounded-3xl border border-line bg-panel p-6 text-sm text-muted">Loading documents...</div> : null}
        {!loading && documents.length === 0 ? <div className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">No documents matched this view.</div> : null}
        {documents.map((document) => (
          <article key={document.id} className="rounded-3xl border border-line bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-line px-3 py-1 text-xs text-muted">{document.source_type}</div>
                <div className="rounded-full border border-line px-3 py-1 text-xs text-accent">{document.document_kind ?? "document"}</div>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-accent">{document.indexing_status ?? document.status}</div>
            </div>
            <h2 className="mt-4 text-xl font-medium text-white">
              {document.slug ? <Link href={`/app/library/${document.slug}`}>{document.title}</Link> : document.title}
            </h2>
            <div className="mt-2 text-sm text-muted">{document.source_name}</div>
            {document.summary ? <p className="mt-4 text-sm leading-7 text-slate-200">{document.summary}</p> : null}
            {document.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {document.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              {document.slug ? (
                <Link href={`/app/library/${document.slug}`} className="text-sm text-accent hover:text-accentStrong">
                  Open reader
                </Link>
              ) : null}
              <Link
                href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
                className="text-sm text-muted hover:text-accent"
              >
                View source
              </Link>
              {document.path_or_url ? (
                <a href={document.path_or_url} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-accent">
                  Open source
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      </section>
    </div>
  );
}
