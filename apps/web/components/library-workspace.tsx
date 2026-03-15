"use client";

import type { DocumentRecord, SourceSummary } from "@uintell/shared/contracts";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { isHiddenDocumentLike, isHiddenSourceType } from "@/lib/content-visibility";

const SOURCE_VIEWS = [
  { label: "All", value: null as string | null, href: "/app/library" },
  { label: "Wikipedia", value: "wikipedia", href: "/app/library/source/wikipedia" },
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

  async function loadLibraryState() {
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
      setDocuments(documentsResponse.documents.filter((document) => !isHiddenDocumentLike(document)));
      setSources(sourcesResponse.sources.filter((source) => !isHiddenSourceType(source.source_type)));
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
    void loadLibraryState();
  }, [deferredQuery, sourceType, sort]);

  return (
    <div className="space-y-6">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#5faa73]">Library</div>
            <h1 className="mt-3 text-3xl font-semibold text-[#7df2a6]">Browse sources, then open the page you need</h1>
            <p className="mt-3 max-w-3xl text-sm leading-8 text-[#66c485]">
              Explore normalized sources and documents through one reader-first library. Start at the source level when
              you are orienting yourself, then open a page and ask page-scoped questions with visible evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/imports"
              className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
            >
              Import sources
            </Link>
            <label className="cursor-pointer rounded-full bg-[#4d8dff] px-4 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff]">
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
                    await loadLibraryState();
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
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="border border-[#12311d] bg-[#050b08] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none focus:border-[#4d8dff]"
            placeholder="Filter by title, summary, or content"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none focus:border-[#4d8dff]"
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
                  active
                    ? "border-[#4d8dff] bg-[#4d8dff] text-[#020704]"
                    : "border-[#12311d] text-[#66c485] hover:border-[#4d8dff] hover:text-[#7aaaff]"
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
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Sources</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Collections of knowledge</h2>
          </div>
          <div className="text-sm text-[#66c485]">{sources.length} visible</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? <div className="border border-[#12311d] bg-[#050b08] p-6 text-sm text-[#5faa73]">Loading sources...</div> : null}
          {!loading && sources.length === 0 ? <div className="border border-dashed border-[#12311d] p-6 text-sm text-[#5faa73]">No sources matched this view.</div> : null}
          {sources.map((source) => (
            <Link
              key={`${source.source_type}:${source.source_name}`}
              href={`/app/library/source/${encodeURIComponent(source.source_type)}/${encodeURIComponent(source.source_name)}`}
              className="border border-[#12311d] bg-[#050b08] p-5 transition hover:border-[#4d8dff]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-medium text-[#7df2a6]">{source.source_name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5faa73]">{source.source_type}</div>
                </div>
                <div className="text-right text-xs text-[#4d8dff]">
                  <div>{source.document_count} docs</div>
                  <div>{source.indexed_count} indexed</div>
                </div>
              </div>
              {source.document_kinds.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {source.document_kinds.slice(0, 3).map((kind) => (
                    <span key={kind} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
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
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Documents</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Reader-ready pages</h2>
        </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? <div className="border border-[#12311d] bg-[#050b08] p-6 text-sm text-[#5faa73]">Loading documents...</div> : null}
        {!loading && documents.length === 0 ? <div className="border border-dashed border-[#12311d] p-6 text-sm text-[#5faa73]">No documents matched this view.</div> : null}
        {documents.map((document) => (
          <article key={document.id} className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">{document.source_type}</div>
                <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{document.document_kind ?? "document"}</div>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{document.indexing_status ?? document.status}</div>
            </div>
            <h2 className="mt-4 text-xl font-medium text-[#7df2a6]">
              {document.slug ? <Link href={`/app/library/${document.slug}`}>{document.title}</Link> : document.title}
            </h2>
            <div className="mt-2 text-sm text-[#5faa73]">{document.source_name}</div>
            {document.summary ? <p className="mt-4 text-sm leading-7 text-[#66c485]">{document.summary}</p> : null}
            {document.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {document.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              {document.slug ? (
                <Link href={`/app/library/${document.slug}`} className="text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                  Open reader
                </Link>
              ) : null}
              <Link
                href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
                className="text-sm text-[#66c485] hover:text-[#7aaaff]"
              >
                View source
              </Link>
              {document.path_or_url ? (
                <a href={document.path_or_url} target="_blank" rel="noreferrer" className="text-sm text-[#66c485] hover:text-[#7aaaff]">
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
