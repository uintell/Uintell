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

  async function askPage() {
    const trimmed = question.trim();
    if (trimmed.length < 2) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.answerDocument(document.id, { question: trimmed, mode: "hybrid" });
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
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Citations stay visible with the answer</div>
        </div>
      </div>

      {error ? <div className="mt-4 border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {answer ? (
        <div className="mt-6 space-y-5">
          <div className="border border-[#12311d] bg-[#050b08] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Answer</div>
              <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">
                {answer.scope_used === "page" ? "Current page only" : answer.scope_used.replaceAll("_", " ")}
              </div>
            </div>
            <div className="mt-4 text-sm leading-8 text-[#7df2a6]">
              <AnswerText answer={answer.answer} citations={citationMap} />
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
                  return (
                    <div key={citation.label} id={`citation-${citation.label}`} className="border border-[#12311d] bg-[#08110d] p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{citation.label}</div>
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
                  return (
                    <div key={`${passage.label}-${passage.document_id}`} className="border border-[#12311d] bg-[#08110d] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-[#4d8dff]">{passage.label}</div>
                        <div className="text-xs text-[#66c485]">{passage.section_title ?? "Overview"}</div>
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

function AnswerText({
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
