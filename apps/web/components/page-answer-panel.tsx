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
    <section className="border border-[#12311d] bg-[#08110d] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Ask this page</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Grounded page answers</h2>
        </div>
        <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#66c485]">Page first, source second</div>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#66c485]">
        Uintell retrieves from this page first and broadens to the rest of the current source only when page evidence is thin.
      </p>

      <div className="mt-4 flex flex-col gap-3">
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
          className="w-full resize-y rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm leading-7 text-[#7df2a6] outline-none transition placeholder:text-[#4e7960] focus:border-[#4d8dff]"
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
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setQuestion(prompt)}
              className="rounded-full border border-[#12311d] bg-[#050b08] px-3 py-1.5 text-xs text-[#66c485] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="mt-4 border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {answer ? (
        <div className="mt-6 space-y-5">
          <div className="border border-[#12311d] bg-[#050b08] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Answer</div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{formatScope(answer.scope_used)}</div>
                <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#66c485]">
                  {answer.supporting_passages.length} evidence passages
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
              <span>{answer.provider_name}</span>
              <span>{answer.model_name}</span>
              <span>{answer.citations.length} citations</span>
            </div>
            <div className="mt-4 border-l border-[#12311d] pl-4">
              <AnswerBody answer={answer.answer} citations={citationMap} />
            </div>
            {answer.citations.length === 0 ? (
              <div className="mt-4 border border-dashed border-[#12311d] p-3 text-sm text-[#5faa73]">
                Evidence was weak. Try a narrower question or import more relevant material.
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="border border-[#12311d] bg-[#050b08] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Citations</div>
              <div className="mt-4 space-y-3">
                {answer.citations.length === 0 ? <div className="text-sm text-[#5faa73]">No citations returned.</div> : null}
                {answer.citations.map((citation) => {
                  const href = buildDocumentHref(citation.document_slug, citation.section_title);
                  const isCurrentPage = citation.document_slug === document.slug;
                  return (
                    <div key={citation.label} id={`citation-${citation.label}`} className="border border-[#12311d] bg-[#08110d] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{citation.label}</div>
                        <span className="rounded-full border border-[#12311d] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#66c485]">
                          {isCurrentPage ? "This page" : "Same source"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-[#7df2a6]">{citation.title}</div>
                      <div className="mt-1 text-xs text-[#66c485]">
                        {citation.source_name} · {citation.section_title}
                      </div>
                      {href ? (
                        <Link href={href} className="mt-3 inline-block text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                          Open cited section
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="border border-[#12311d] bg-[#050b08] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Supporting passages</div>
              <div className="mt-4 space-y-3">
                {answer.supporting_passages.length === 0 ? <div className="text-sm text-[#5faa73]">No passages returned.</div> : null}
                {answer.supporting_passages.map((passage) => {
                  const href = buildDocumentHref(passage.document_slug, passage.section_title);
                  const isCurrentPage = passage.document_id === document.id;
                  return (
                    <div key={`${passage.label}-${passage.document_id}`} className="border border-[#12311d] bg-[#08110d] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{passage.label}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-xs text-[#66c485]">{passage.section_title ?? "Overview"}</div>
                          <span className="rounded-full border border-[#12311d] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#66c485]">
                            {isCurrentPage ? "This page" : "Same source"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm font-medium text-[#7df2a6]">{passage.title}</div>
                      <div className="mt-1 text-xs text-[#66c485]">{passage.source_name}</div>
                      <div className="mt-3 text-sm leading-7 text-[#66c485]">{passage.excerpt}</div>
                      {href ? (
                        <Link href={href} className="mt-3 inline-block text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                          Jump to evidence
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
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

function formatScope(scope: string): string {
  if (scope === "page") {
    return "Current page only";
  }
  if (scope === "page_then_source") {
    return "Broadened to source";
  }
  if (scope === "no_evidence") {
    return "Evidence too weak";
  }
  return scope.replaceAll("_", " ");
}

function buildQuestionSuggestions(document: DocumentDetail): string[] {
  const prompts = [
    `Summarize the main idea of ${document.title}.`,
    `What are the key technical points on this page?`,
    `Which parts of this page matter most in practice?`,
  ];

  if (document.document_kind === "book" || document.document_kind === "article") {
    prompts.push("What argument or explanation is this page making?");
  }

  if (document.document_kind === "note" || document.source_type === "filesystem") {
    prompts.push("Turn this page into a concise study note.");
  }

  return prompts.slice(0, 4);
}
