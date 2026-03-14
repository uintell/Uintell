"use client";

import type { SourceDetail } from "@uintell/shared/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }
  return new Date(value).toLocaleString();
}

export function SourceDetailWorkspace({
  sourceType,
  sourceName,
}: {
  sourceType: string;
  sourceName: string;
}) {
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSource() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getSourceDetail(sourceType, sourceName);
        if (active) {
          setSource(response);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load source");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSource();
    return () => {
      active = false;
    };
  }, [sourceName, sourceType]);

  if (loading) {
    return <div className="rounded-3xl border border-line bg-panel p-8 text-sm text-muted">Loading source…</div>;
  }

  if (error || !source) {
    return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">{error ?? "Source not found"}</div>;
  }

  return (
    <div className="space-y-8">
      <header className="rounded-[2rem] border border-line bg-black/20 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/app/library" className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent">
            Back to library
          </Link>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{source.source_type}</span>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-accent">{source.document_count} documents</span>
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">{source.source_name}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-200">
          Browse normalized pages from this source, open any page into the reader, and ask questions grounded in the
          current page before the system broadens to the rest of the source.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-4">
          {source.documents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-8 text-sm text-muted">No indexed documents are available for this source yet.</div>
          ) : null}
          {source.documents.map((document) => (
            <article key={document.id} className="rounded-3xl border border-line bg-panel p-5">
              <div className="flex flex-wrap gap-2">
                {document.document_kind ? (
                  <span className="rounded-full border border-line px-3 py-1 text-xs text-accent">{document.document_kind}</span>
                ) : null}
                <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{document.indexing_status ?? document.status}</span>
              </div>
              <h2 className="mt-4 text-2xl font-medium text-white">
                {document.slug ? (
                  <Link href={`/app/library/${document.slug}`} className="transition hover:text-accent">
                    {document.title}
                  </Link>
                ) : (
                  document.title
                )}
              </h2>
              {document.summary ? <p className="mt-3 text-sm leading-7 text-slate-200">{document.summary}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {document.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Source summary</div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div>Type: {source.source_type}</div>
              <div>Documents: {source.document_count}</div>
              <div>Indexed: {source.indexed_count}</div>
              <div>Last updated: {formatTimestamp(source.latest_updated_at)}</div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Content kinds</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {source.document_kinds.length === 0 ? <div className="text-sm text-muted">No kind metadata yet.</div> : null}
              {source.document_kinds.map((kind) => (
                <span key={kind} className="rounded-full border border-line px-3 py-1 text-xs text-accent">
                  {kind}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Next actions</div>
            <div className="mt-4 space-y-3 text-sm">
              <Link href="/app/search" className="block text-accent hover:text-accentStrong">
                Search across the library
              </Link>
              <Link href="/app/imports" className="block text-accent hover:text-accentStrong">
                Import another source
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
