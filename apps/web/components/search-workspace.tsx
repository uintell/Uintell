"use client";

import type { SearchResult } from "@uintell/shared/contracts";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { isHiddenDocumentLike } from "@/lib/content-visibility";
import { buildDocumentHref } from "@/lib/reader-links";

const SOURCE_FILTERS = [
  { label: "All", value: null as string | null },
  { label: "Wikipedia", value: "wikipedia" },
  { label: "Books", value: "book" },
  { label: "Notes", value: "note" },
  { label: "Files", value: "filesystem" },
];

export function SearchWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
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
    const nextSourceType = searchParams.get("source")?.trim() || null;
    setQuery((current) => (current === nextQuery ? current : nextQuery));
    setSourceType((current) => (current === nextSourceType ? current : nextSourceType));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const currentQuery = searchParams.get("q")?.trim() ?? "";
    const currentSource = searchParams.get("source")?.trim() || null;

    if (deferredQuery) {
      nextParams.set("q", deferredQuery);
    } else {
      nextParams.delete("q");
    }

    if (sourceType) {
      nextParams.set("source", sourceType);
    } else {
      nextParams.delete("source");
    }

    if (currentQuery === deferredQuery && currentSource === sourceType) {
      return;
    }

    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }, [deferredQuery, pathname, router, searchParams, sourceType]);

  async function executeSearch(searchTerm: string) {
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
      setResults(response.results.filter((result) => !isHiddenDocumentLike(result)));
      setResponseMode(response.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void executeSearch(deferredQuery);
    }, 180);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [deferredQuery, sourceType]);

  return (
    <div className="space-y-6">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[#5faa73]">Knowledge search</div>
        <h1 className="mt-3 text-3xl font-semibold text-[#7df2a6]">Find the exact page, section, or code example faster.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-8 text-[#66c485]">
          Uintell search is tuned for imported technical knowledge, not the open web. Results explain why they matched,
          show which source they came from, and point you to the best page or section to open next.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#66c485]">
          <span className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1">Exact title matches first</span>
          <span className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1">Section-aware results</span>
          <span className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1">Source labels and evidence snippets</span>
        </div>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void executeSearch(query.trim());
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
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[#12311d] bg-[#050b08] px-4 py-3 text-sm text-[#66c485]">
          <div>
            {loading
              ? "Searching..."
              : deferredQuery.length < 2
                ? "Type at least two characters to search."
                : `${results.length} result${results.length === 1 ? "" : "s"} via ${responseMode}`}
          </div>
          {deferredQuery.length >= 2 ? (
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">
              {sourceType ? `Filtered to ${sourceType}` : "Across all sources"}
            </div>
          ) : null}
        </div>
        {deferredQuery.length < 2 && !loading ? (
          <SearchGuidance />
        ) : null}
        {results.length === 0 && deferredQuery.length >= 2 && !loading ? (
          <SearchEmptyState query={deferredQuery} />
        ) : null}
        {loading
          ? Array.from({ length: Math.max(2, Math.min(4, results.length || 3)) }).map((_, index) => (
              <article key={`loading-${index}`} className="border border-[#12311d] bg-[#050b08] p-5">
                <div className="h-5 w-32 animate-pulse bg-[#08110d]" />
                <div className="mt-4 h-8 w-2/3 animate-pulse bg-[#08110d]" />
                <div className="mt-3 h-4 w-40 animate-pulse bg-[#08110d]" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-full animate-pulse bg-[#08110d]" />
                  <div className="h-4 w-5/6 animate-pulse bg-[#08110d]" />
                </div>
              </article>
            ))
          : null}
        {results.map((result, index) => (
          <SearchResultCard key={result.chunk_id} result={result} query={deferredQuery} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

function SearchResultCard({
  result,
  query,
  rank,
}: {
  result: SearchResult;
  query: string;
  rank: number;
}) {
  const pageHref = result.document_slug ? `/app/library/${result.document_slug}` : null;
  const sectionHref = buildDocumentHref(result.document_slug, result.section_title, result.section_anchor);
  const titleMatch = queryMatchesTitle(result.title, query);
  const sectionMatch = queryMatchesTitle(result.section_title ?? "", query);

  return (
    <article className="border border-[#12311d] bg-[#050b08] p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
            <span className="rounded-full border border-[#12311d] px-3 py-1 text-[#5faa73]">#{rank}</span>
            <span className="rounded-full border border-[#12311d] px-3 py-1 text-[#5faa73]">{result.source_type}</span>
            {result.document_kind ? (
              <span className="rounded-full border border-[#12311d] px-3 py-1 text-[#4d8dff]">{result.document_kind}</span>
            ) : null}
            <span className="rounded-full border border-[#12311d] px-3 py-1 text-[#66c485]">{result.source_name}</span>
            {titleMatch ? <span className="rounded-full border border-[#12311d] px-3 py-1 text-[#4d8dff]">Exact page title</span> : null}
            {!titleMatch && sectionMatch ? (
              <span className="rounded-full border border-[#12311d] px-3 py-1 text-[#4d8dff]">Exact section heading</span>
            ) : null}
          </div>

          <h2 className="mt-4 max-w-4xl text-2xl font-medium text-[#7df2a6] lg:text-[1.9rem]">
            {pageHref ? (
              <Link href={pageHref} className="transition hover:text-[#7aaaff]">
                <HighlightedText text={result.title} query={query} />
              </Link>
            ) : (
              <HighlightedText text={result.title} query={query} />
            )}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
            <span>{result.section_title ?? "Overview"}</span>
            {result.score > 0 ? <span>semantic {result.score.toFixed(2)}</span> : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {result.match_reasons.map((reason) => (
              <span key={`${result.chunk_id}-${reason}`} className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1 text-xs text-[#66c485]">
                {reason}
              </span>
            ))}
          </div>

          {result.summary ? <div className="mt-4 max-w-4xl text-sm leading-7 text-[#66c485]">{result.summary}</div> : null}

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Why this matched</div>
              <p className="mt-3 border-l border-[#12311d] pl-4 text-sm leading-7 text-[#66c485]">
                <HighlightedText text={result.excerpt} query={query} />
              </p>
            </div>

            <div className="border border-[#12311d] bg-[#08110d] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Best entry point</div>
              <div className="mt-3 text-sm font-medium text-[#7df2a6]">{result.section_title ?? "Overview"}</div>
              <div className="mt-2 text-sm leading-6 text-[#66c485]">
                Open the page or jump straight to the section where this match becomes useful.
              </div>
            </div>
          </div>

          {result.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            {pageHref ? (
              <Link href={pageHref} className="text-[#4d8dff] hover:text-[#7aaaff]">
                Open page
              </Link>
            ) : null}
            {sectionHref ? (
              <Link href={sectionHref} className="text-[#4d8dff] hover:text-[#7aaaff]">
                Jump to section
              </Link>
            ) : null}
            {result.path_or_url ? (
              <a href={result.path_or_url} target="_blank" rel="noreferrer" className="text-[#66c485] hover:text-[#7aaaff]">
                Open original source
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SearchGuidance() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="border border-dashed border-[#12311d] bg-[#050b08] p-6 text-sm text-[#66c485]">
        Search page titles when you know the concept or document name.
      </div>
      <div className="border border-dashed border-[#12311d] bg-[#050b08] p-6 text-sm text-[#66c485]">
        Search section headings for implementation steps, commands, and formulas.
      </div>
      <div className="border border-dashed border-[#12311d] bg-[#050b08] p-6 text-sm text-[#66c485]">
        Search exact phrases when you want a specific passage, API detail, or code pattern.
      </div>
    </div>
  );
}

function SearchEmptyState({ query }: { query: string }) {
  return (
    <div className="border border-dashed border-[#12311d] bg-[#050b08] p-8">
      <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">No result found</div>
      <h2 className="mt-3 text-2xl font-semibold text-[#7df2a6]">Nothing matched “{query}” yet.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#66c485]">
        Try a page title, a section heading, or a narrower technical phrase. Uintell search is strongest when the query
        names the concept, command, file, or implementation detail you expect to read next.
      </p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <Link href="/app/library" className="text-[#4d8dff] hover:text-[#7aaaff]">
          Browse library
        </Link>
        <Link href="/app/imports" className="text-[#4d8dff] hover:text-[#7aaaff]">
          Import another source
        </Link>
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

function queryMatchesTitle(text: string, query: string): boolean {
  const normalizedText = text.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedText || !normalizedQuery) {
    return false;
  }
  return normalizedText === normalizedQuery || normalizedText.startsWith(normalizedQuery) || normalizedText.includes(normalizedQuery);
}
