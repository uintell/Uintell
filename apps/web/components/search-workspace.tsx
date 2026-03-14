"use client";

import type { SearchResult } from "@uintell/shared/contracts";
import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { api } from "@/lib/api";

const SOURCE_FILTERS = [
  { label: "All", value: null as string | null },
  { label: "Wikipedia", value: "wikipedia" },
  { label: "Arch Wiki", value: "arch_wiki" },
  { label: "Books", value: "book" },
  { label: "Notes", value: "note" },
  { label: "Files", value: "filesystem" },
];

export function SearchWorkspace() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState("hybrid");
  const deferredQuery = useDeferredValue(query.trim());

  async function runSearch(searchTerm: string) {
    if (searchTerm.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.search({
        query: searchTerm,
        mode,
        source_types: sourceType ? [sourceType] : undefined,
        tags: tagFilter
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        limit: 12,
      });
      setResults(response.results);
      setResponseMode(response.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void runSearch(deferredQuery);
    }, 180);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [deferredQuery, mode, sourceType, tagFilter]);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-muted">Knowledge search</div>
        <h1 className="mt-3 text-3xl font-semibold">Hybrid search across your private knowledge base</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
          Switch between exact, semantic, and hybrid retrieval while filtering by source or tag. Every result opens into
          the reader with backlinks and related pages.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query.trim());
        }}
        className="rounded-3xl border border-line bg-black/20 p-4"
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
            placeholder="Search your library, notes, and imported sources"
          />
          <button disabled={loading} className="rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-ink disabled:opacity-60">
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
            placeholder="Optional tag filter, e.g. linux, packaging"
          />
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Hybrid", value: "hybrid" },
              { label: "Exact", value: "exact" },
              { label: "Semantic", value: "semantic" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  mode === item.value ? "border-accent bg-accent text-ink" : "border-line text-slate-200 hover:border-accent"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((item) => {
            const active = sourceType === item.value;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setSourceType(item.value)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active ? "border-accent bg-accent text-ink" : "border-line text-slate-200 hover:border-accent"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </form>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4">
        <div className="text-sm text-muted">
          {loading ? "Searching..." : deferredQuery.length < 2 ? "Type at least two characters to search." : `${results.length} results via ${responseMode}`}
        </div>
        {results.length === 0 && deferredQuery.length >= 2 && !loading ? (
          <div className="rounded-3xl border border-dashed border-line p-8 text-sm text-muted">No results matched this query.</div>
        ) : null}
        {results.map((result) => (
          <article key={result.chunk_id} className="rounded-3xl border border-line bg-panel p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-line px-3 py-1 text-xs text-muted">{result.source_type}</div>
              {result.document_kind ? <div className="rounded-full border border-line px-3 py-1 text-xs text-accent">{result.document_kind}</div> : null}
              <div className="text-xs uppercase tracking-[0.18em] text-accent">{result.section_title ?? "Overview"}</div>
            </div>
            <h2 className="mt-3 text-xl font-medium text-white">
              {result.document_slug ? <Link href={`/app/library/${result.document_slug}`}>{result.title}</Link> : result.title}
            </h2>
            {result.summary ? <div className="mt-3 text-sm text-muted">{result.summary}</div> : null}
            <p className="mt-3 text-sm leading-7 text-slate-200">{result.excerpt}</p>
            {result.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {result.document_slug ? (
                <Link href={`/app/library/${result.document_slug}`} className="text-sm text-accent hover:text-accentStrong">
                  Open reader
                </Link>
              ) : null}
              {result.path_or_url ? (
                <a href={result.path_or_url} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-accent">
                  Open source
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
