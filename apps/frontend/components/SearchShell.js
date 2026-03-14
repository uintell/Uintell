"use client";

import { useEffect, useState, useTransition } from "react";

import { answerQuestion, searchSources } from "../lib/api";
import LogoMark from "./LogoMark";

const FILTERS = [
  { value: "all", label: "All sources" },
  { value: "wikipedia", label: "Reference" },
  { value: "arch_wiki", label: "Technical docs" }
];

const MODES = [
  { value: "concise", label: "Concise" },
  { value: "normal", label: "Normal" },
  { value: "deep", label: "Deep" }
];

export default function SearchShell() {
  const [query, setQuery] = useState("How do I update Arch Linux safely?");
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState("normal");
  const [searchResult, setSearchResult] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [selectedChunkId, setSelectedChunkId] = useState(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleSources = answerResult?.sources || searchResult?.results || [];
  const selectedSource =
    visibleSources.find((source) => source.chunk_id === selectedChunkId) ||
    visibleSources[0] ||
    null;

  useEffect(() => {
    if (!visibleSources.length) {
      setSelectedChunkId(null);
      return;
    }

    if (!visibleSources.some((source) => source.chunk_id === selectedChunkId)) {
      setSelectedChunkId(visibleSources[0].chunk_id);
    }
  }, [selectedChunkId, visibleSources]);

  function blockLogoInteraction(event) {
    event.preventDefault();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        const [searchPayload, answerPayload] = await Promise.all([
          searchSources({
            query: trimmed,
            filter,
            limit: 8
          }),
          answerQuestion({
            question: trimmed,
            filter,
            mode,
            limit: 8
          })
        ]);

        setSearchResult(searchPayload);
        setAnswerResult(answerPayload);
      } catch (requestError) {
        setError(requestError.message || "Request failed");
      }
    });
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero__copy">
          <div className="brandLockup" aria-label="United Intelligence">
            <div
              className="brandLockup__logoShell"
              onContextMenu={blockLogoInteraction}
              onDragStart={blockLogoInteraction}
            >
              <LogoMark />
            </div>
            <div className="brandLockup__text">
              <p className="brandLockup__name">United Intelligence</p>
              <p className="eyebrow">Source-grounded encyclopedia</p>
            </div>
          </div>
          <h1>Hybrid search and grounded answers over offline knowledge bases.</h1>
          <p className="hero__lead">
            Sourcepedia indexes offline reference material and technical
            documentation, merges BM25 with vector search, and refuses to
            answer without showing evidence.
          </p>
        </div>

        <form className="searchCard" onSubmit={handleSubmit}>
          <label className="fieldLabel" htmlFor="query">
            Search or ask a question
          </label>
          <textarea
            id="query"
            className="queryInput"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            placeholder="Explain pacman -Syu and cite the sources."
          />

          <div className="toolbar">
            <div className="buttonGroup">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={
                    item.value === filter ? "chip chip--active" : "chip"
                  }
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="modeSelect">
              <span>Answer style</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                {MODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="searchActions">
            <button className="primaryButton" disabled={isPending} type="submit">
              {isPending ? "Searching..." : "Search and answer"}
            </button>
            <p className="quietNote">
              Every answer is backed by cited chunks. If evidence is thin, the
              answer says so.
            </p>
          </div>
        </form>
      </section>

      {error ? <p className="errorBanner">{error}</p> : null}

      <section className="workspace">
        <article className="panel panel--answer">
          <div className="panelHeader">
            <p className="panelKicker">Answer</p>
            {answerResult?.cached ? <span className="statusPill">cached</span> : null}
          </div>
          {answerResult ? (
            <>
              <pre className="answerCopy">{answerResult.answer_markdown}</pre>
              <div className="citationList">
                {answerResult.citations.map((citation) => (
                  <button
                    key={citation.chunk_id}
                    type="button"
                    className={
                      citation.chunk_id === selectedChunkId
                        ? "citationCard citationCard--active"
                        : "citationCard"
                    }
                    onClick={() => setSelectedChunkId(citation.chunk_id)}
                  >
                    <span className="citationIndex">[{citation.index}]</span>
                    <span>{citation.article_title}</span>
                    <span className="citationMeta">
                      {citation.section_title || "Overview"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="placeholder">
              Ask a question to populate the grounded answer panel.
            </p>
          )}
        </article>

        <article className="panel panel--sources">
          <div className="panelHeader">
            <p className="panelKicker">Source excerpts</p>
            {searchResult?.cached ? <span className="statusPill">cached</span> : null}
          </div>
          {selectedSource ? (
            <div className="sourceDetail">
              <h2>{selectedSource.article_title}</h2>
              <p className="sourceMeta">
                {selectedSource.source_name} ·{" "}
                {selectedSource.section_title || "Overview"}
              </p>
              <p className="sourceExcerpt">{selectedSource.excerpt}</p>
              <pre className="sourceBody">{selectedSource.content}</pre>
            </div>
          ) : (
            <p className="placeholder">
              Search results will appear here with document excerpts and source
              identifiers.
            </p>
          )}
        </article>

        <article className="panel panel--results">
          <div className="panelHeader">
            <p className="panelKicker">Retrieved chunks</p>
            <span className="statusPill">{visibleSources.length} hits</span>
          </div>
          {visibleSources.length ? (
            <div className="resultList">
              {visibleSources.map((result) => (
                <button
                  key={result.chunk_id}
                  type="button"
                  className={
                    result.chunk_id === selectedChunkId
                      ? "resultCard resultCard--active"
                      : "resultCard"
                  }
                  onClick={() => setSelectedChunkId(result.chunk_id)}
                >
                  <div className="resultCard__head">
                    <h3>{result.article_title}</h3>
                    <span className="resultScore">
                      {result.combined_score.toFixed(3)}
                    </span>
                  </div>
                  <p className="resultMeta">
                    {result.source_type} · {result.section_title || "Overview"}
                  </p>
                  <p className="resultText">{result.excerpt}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="placeholder">
              Submit a query to inspect the hybrid retrieval results.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}
