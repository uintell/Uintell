"use client";

import type { Citation, DocumentDetail, PageAnswer } from "@uintell/shared/contracts";
import Link from "next/link";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { buildDocumentHref } from "@/lib/reader-links";

export function PageAnswerPanel({ document }: { document: DocumentDetail }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<PageAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const citationMap = useMemo(() => new Map(answer?.citations.map((item) => [item.label, item]) ?? []), [answer]);
  const suggestedQuestions = useMemo(() => buildQuestionSuggestions(document), [document]);

  async function askPage(nextQuestion?: string) {
    const trimmed = (nextQuestion ?? question).trim();
    if (trimmed.length < 2) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.answerDocument(document.id, { question: trimmed, mode: "hybrid" });
      setQuestion(trimmed);
      setAnswer(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-[#12311d] bg-[#050b08] p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Ask this page</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Reading assistant</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#66c485]">Page first</span>
          <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#66c485]">Evidence visible</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void askPage();
              }
            }}
            rows={3}
            className="w-full resize-y rounded-2xl border border-[#12311d] bg-[#08110d] px-4 py-3 text-sm leading-7 text-[#7df2a6] outline-none transition placeholder:text-[#4e7960] focus:border-[#4d8dff]"
            placeholder="Ask a narrow question about the current page."
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void askPage()}
              disabled={loading || question.trim().length < 2}
              className="rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Answering..." : "Ask this page"}
            </button>
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Cmd/Ctrl + Enter</div>
          </div>
        </div>

        <div className="border border-[#12311d] bg-[#08110d] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">How it answers</div>
          <div className="mt-3 text-sm leading-7 text-[#66c485]">
            Uintell retrieves from this page first. It only broadens to the rest of the current source when page evidence
            is too thin to support a grounded answer.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestedQuestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setQuestion(prompt)}
            className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1.5 text-xs text-[#66c485] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error ? <div className="mt-4 border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {answer ? (
        <div className="mt-8 space-y-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)]">
            <section className="border border-[#12311d] bg-[#08110d] p-4 lg:p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Answer</div>
              <div className="mt-4 rounded-2xl border border-[#12311d] bg-[#050b08] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#5faa73]">Question</div>
                <div className="mt-2 text-sm leading-7 text-[#7df2a6]">{question.trim()}</div>
              </div>
              <div className="mt-4 border-l border-[#12311d] pl-4">
                <AnswerBody answer={answer.answer} citations={citationMap} />
              </div>
              {answer.citations.length === 0 ? (
                <div className="mt-4 border border-dashed border-[#12311d] p-3 text-sm text-[#5faa73]">
                  Evidence was weak. Try a narrower question or import more relevant material.
                </div>
              ) : null}
            </section>

            <section className="border border-[#12311d] bg-[#08110d] p-4 lg:p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Answer context</div>
              <div className="mt-4 space-y-3 text-sm text-[#66c485]">
                <div className="rounded-2xl border border-[#12311d] bg-[#050b08] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#5faa73]">Scope</div>
                  <div className="mt-2 text-sm text-[#7df2a6]">{formatScope(answer.scope_used)}</div>
                  <div className="mt-2 leading-6 text-[#66c485]">{describeScope(answer.scope_used)}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <Metric label="Citations" value={String(answer.citations.length)} />
                  <Metric label="Evidence passages" value={String(answer.supporting_passages.length)} />
                  <Metric label="Provider" value={answer.provider_name} />
                  <Metric label="Model" value={answer.model_name} />
                </div>
              </div>
            </section>
          </div>

          <section className="border border-[#12311d] bg-[#08110d] p-4 lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Evidence trail</div>
                <h3 className="mt-2 text-xl font-semibold text-[#7df2a6]">Passages and citations behind the answer</h3>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Jump back into the article</div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
              <section className="space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Supporting passages</div>
                {answer.supporting_passages.length === 0 ? <div className="text-sm text-[#5faa73]">No passages returned.</div> : null}
                {answer.supporting_passages.map((passage) => {
                  const href = buildDocumentHref(passage.document_slug, passage.section_title);
                  const isCurrentPage = passage.document_id === document.id;
                  return (
                    <div key={`${passage.label}-${passage.document_id}`} className="border border-[#12311d] bg-[#050b08] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="rounded-full border border-[#12311d] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#4d8dff]">
                            {passage.label}
                          </span>
                          <span className="text-xs uppercase tracking-[0.16em] text-[#66c485]">
                            {passage.section_title ?? "Overview"}
                          </span>
                        </div>
                        <span className="rounded-full border border-[#12311d] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#66c485]">
                          {isCurrentPage ? "This page" : "Same source"}
                        </span>
                      </div>
                      <div className="mt-3 text-sm font-medium text-[#7df2a6]">{passage.title}</div>
                      <div className="mt-1 text-xs text-[#66c485]">{passage.source_name}</div>
                      <div className="mt-3 border-l border-[#12311d] pl-4 text-sm leading-7 text-[#66c485]">{passage.excerpt}</div>
                      {href ? (
                        <Link href={href} className="mt-4 inline-block text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                          Jump to evidence
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </section>

              <section className="space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Citations</div>
                {answer.citations.length === 0 ? <div className="text-sm text-[#5faa73]">No citations returned.</div> : null}
                {answer.citations.map((citation) => {
                  const href = buildDocumentHref(citation.document_slug, citation.section_title);
                  const isCurrentPage = citation.document_slug === document.slug;
                  return (
                    <div key={citation.label} id={`citation-${citation.label}`} className="border border-[#12311d] bg-[#050b08] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{citation.label}</div>
                        <span className="rounded-full border border-[#12311d] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#66c485]">
                          {isCurrentPage ? "This page" : "Same source"}
                        </span>
                      </div>
                      <div className="mt-3 text-sm font-medium text-[#7df2a6]">{citation.title}</div>
                      <div className="mt-1 text-xs text-[#66c485]">
                        {citation.source_name} · {citation.section_title}
                      </div>
                      {href ? (
                        <Link href={href} className="mt-4 inline-block text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                          Open cited section
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function AnswerBody({
  answer,
  citations,
}: {
  answer: string;
  citations: Map<string, Citation>;
}) {
  const lines = answer
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 text-sm leading-8 text-[#7df2a6]">
      {lines.map((line, index) =>
        line.startsWith("- ") ? (
          <div key={`${index}-${line.slice(0, 16)}`} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#4d8dff]" />
            <span>
              <InlineAnswerText answer={line.slice(2)} citations={citations} />
            </span>
          </div>
        ) : (
          <p key={`${index}-${line.slice(0, 16)}`}>
            <InlineAnswerText answer={line} citations={citations} />
          </p>
        ),
      )}
    </div>
  );
}

function InlineAnswerText({
  answer,
  citations,
}: {
  answer: string;
  citations: Map<string, Citation>;
}) {
  const parts = answer.split(/(\[S\d+\])/g);

  return (
    <>
      {parts.map((part, index) => {
        const label = /^\[S\d+\]$/.test(part) ? part.slice(1, -1) : null;
        if (!label) {
          return <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>;
        }

        const citation = citations.get(label);
        const href = citation ? buildDocumentHref(citation.document_slug, citation.section_title) : null;

        return href ? (
          <Link
            key={`${index}-${label}`}
            href={href}
            className="mx-1 inline-flex items-center rounded-full border border-[#12311d] bg-[#030806] px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-[#4d8dff] hover:text-[#7aaaff]"
          >
            {label}
          </Link>
        ) : (
          <a
            key={`${index}-${label}`}
            href={`#citation-${label}`}
            className="mx-1 inline-flex items-center rounded-full border border-[#12311d] bg-[#030806] px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-[#4d8dff] hover:text-[#7aaaff]"
          >
            {label}
          </a>
        );
      })}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#12311d] bg-[#050b08] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#5faa73]">{label}</div>
      <div className="mt-2 text-sm text-[#7df2a6]">{value}</div>
    </div>
  );
}

function formatScope(scope: string): string {
  if (scope === "page") {
    return "Current page only";
  }
  if (scope === "page_then_source") {
    return "Broadened to same source";
  }
  if (scope === "no_evidence") {
    return "Evidence too weak";
  }
  return scope.replaceAll("_", " ");
}

function describeScope(scope: string): string {
  if (scope === "page") {
    return "The answer stayed inside the current page because it already contained enough supporting evidence.";
  }
  if (scope === "page_then_source") {
    return "The page did not contain enough evidence on its own, so Uintell widened retrieval to the rest of the current source.";
  }
  if (scope === "no_evidence") {
    return "Uintell could not find enough indexed evidence to support a reliable answer yet.";
  }
  return "The answer was generated from the retrieved evidence bundle shown below.";
}

function buildQuestionSuggestions(document: DocumentDetail): string[] {
  const prompts = [
    `Summarize the main idea of ${document.title}.`,
    "What are the key technical points on this page?",
    "Which parts of this page matter most in practice?",
  ];

  if (document.document_kind === "book" || document.document_kind === "article") {
    prompts.push("What argument or explanation is this page making?");
  }

  if (document.document_kind === "note" || document.source_type === "filesystem") {
    prompts.push("Turn this page into a concise study note.");
  }

  return prompts.slice(0, 4);
}
