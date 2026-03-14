"use client";

import type { SearchResult } from "@uintell/shared/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { buildDocumentHref } from "@/lib/reader-links";

const SOURCE_FILTERS = [
  { label: "All", value: null as string | null },
  { label: "Wikipedia", value: "wikipedia" },
  { label: "Arch Wiki", value: "arch_wiki" },
  { label: "Books", value: "book" },
  { label: "Notes", value: "note" },
  { label: "Files", value: "filesystem" },
];

export function SearchWorkspace() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState("hybrid");
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    const nextQuery = searchParams.get("q")?.trim() ?? "";
    setQuery((current) => (current === nextQuery ? current : nextQuery));
  }, [searchParams]);

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
        mode: "hybrid",
        source_types: sourceType ? [sourceType] : undefined,
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
  }, [deferredQuery, sourceType]);

  return (
    <div className="space-y-6">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#5faa73]">Knowledge search</div>
        <h1 className="mt-3 text-3xl font-semibold text-[#7df2a6]">Search pages, sections, and code across your library.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-8 text-[#66c485]">
          Search is tuned for the reader flow: find a page quickly, open it, and ask page-scoped questions with visible
          evidence. The default search path blends exact and semantic matching without exposing extra tuning.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query.trim());
        }}
        className="border border-[#12311d] bg-[#050b08] p-5"
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition placeholder:text-[#4e7960] focus:border-[#4d8dff]"
            placeholder="Search titles, sections, code blocks, and technical notes"
          />
          <button
            disabled={loading}
            className="rounded-2xl bg-[#4d8dff] px-5 py-3 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff] disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>
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
                  active
                    ? "border-[#4d8dff] bg-[#4d8dff] text-[#020704]"
                    : "border-[#12311d] text-[#66c485] hover:border-[#4d8dff] hover:text-[#7aaaff]"
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
        <div className="text-sm text-[#66c485]">
          {loading
            ? "Searching..."
            : deferredQuery.length < 2
              ? "Type at least two characters to search."
              : `${results.length} results via ${responseMode}`}
        </div>
        {results.length === 0 && deferredQuery.length >= 2 && !loading ? (
          <div className="border border-dashed border-[#12311d] p-8 text-sm text-[#5faa73]">No results matched this query.</div>
        ) : null}
        {results.map((result) => {
          const sectionHref = buildDocumentHref(result.document_slug, result.section_title);

          return (
            <article key={result.chunk_id} className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">{result.source_type}</div>
              {result.document_kind ? (
                <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{result.document_kind}</div>
              ) : null}
              <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{result.section_title ?? "Overview"}</div>
            </div>
            <h2 className="mt-3 text-xl font-medium text-[#7df2a6]">
              {result.document_slug ? (
                <Link href={`/app/library/${result.document_slug}`} className="transition hover:text-[#7aaaff]">
                  <HighlightedText text={result.title} query={deferredQuery} />
                </Link>
              ) : (
                <HighlightedText text={result.title} query={deferredQuery} />
              )}
            </h2>
            <div className="mt-2 text-sm text-[#5faa73]">{result.source_name}</div>
            {result.summary ? <div className="mt-3 text-sm text-[#66c485]">{result.summary}</div> : null}
            <p className="mt-3 text-sm leading-7 text-[#66c485]">
              <HighlightedText text={result.excerpt} query={deferredQuery} />
            </p>
            {result.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {result.document_slug ? <Link href={`/app/library/${result.document_slug}`} className="text-sm text-[#4d8dff] hover:text-[#7aaaff]">Open page</Link> : null}
              {sectionHref ? (
                <Link href={sectionHref} className="text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                  Jump to section
                </Link>
              ) : null}
              {result.path_or_url ? (
                <a href={result.path_or_url} target="_blank" rel="noreferrer" className="text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                  Open source
                </a>
              ) : null}
            </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return <>{text}</>;
  }

  const terms = [...new Set(trimmedQuery.split(/\s+/).filter((term) => term.length >= 2))];
  if (terms.length === 0) {
    return <>{text}</>;
  }

  const matcher = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(matcher);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
        return isMatch ? (
          <mark key={`${index}-${part}`} className="bg-[#113521] px-1 text-[#7df2a6]">
            {part}
          </mark>
        ) : (
          <span key={`${index}-${part}`}>{part}</span>
        );
      })}
    </>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
