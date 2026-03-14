"use client";

import type { DocumentDetail, PageAnswer } from "@uintell/shared/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function isLikelyImageReference(reference: string): boolean {
  return /^https?:\/\//.test(reference) || /\.(png|jpe?g|gif|webp|svg)$/i.test(reference);
}

export function DocumentReaderWorkspace({ slug }: { slug: string }) {
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxSource, setLightboxSource] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<PageAnswer | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getDocumentBySlug(slug);
        if (active) {
          setDocument(response);
          setAnswer(null);
          setAnswerError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load document");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      active = false;
    };
  }, [slug]);

  const tocSections = useMemo(
    () => (document?.sections ?? []).filter((section) => section.anchor || section.title),
    [document],
  );
  const imageReferences = useMemo(
    () => (document?.media_references ?? []).filter((reference) => isLikelyImageReference(reference)),
    [document],
  );

  async function askPage() {
    if (!document || question.trim().length < 2) {
      return;
    }
    setAnswerLoading(true);
    setAnswerError(null);
    try {
      const response = await api.answerDocument(document.id, { question: question.trim(), mode: "hybrid" });
      setAnswer(response);
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : "Failed to generate answer");
    } finally {
      setAnswerLoading(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-line bg-panel p-8 text-sm text-muted">Loading document reader...</div>;
  }

  if (error || !document) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">
        {error ?? "Document not found"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-[2rem] border border-line bg-black/20 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/app/library" className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent">
            Back to library
          </Link>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{document.source_type}</span>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-accent">{document.document_kind}</span>
          <Link
            href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
          >
            {document.source_name}
          </Link>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white">{document.title}</h1>
        {document.summary ? <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">{document.summary}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-muted">
          <span>Updated {formatTimestamp(document.updated_at)}</span>
          <span>{document.language}</span>
          <span>{document.sections.length} sections</span>
          <span>{document.backlinks.length} backlinks</span>
        </div>
        {document.tags.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {document.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="space-y-6 rounded-[2rem] border border-line bg-panel p-6">
          <section className="rounded-[1.5rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Ask this page</div>
            <div className="mt-4 flex flex-col gap-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-7 text-slate-100 outline-none focus:border-accent"
                placeholder="Ask a grounded question about this page. Uintell will retrieve from this page first, then widen to the current source if needed."
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void askPage()}
                  disabled={answerLoading || question.trim().length < 2}
                  className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {answerLoading ? "Answering..." : "Ask this page"}
                </button>
                <div className="text-xs uppercase tracking-[0.18em] text-muted">Citation-first reader mode</div>
              </div>
            </div>

            {answerError ? <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{answerError}</div> : null}

            {answer ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-line bg-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted">Answer</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-accent">{answer.scope_used.replaceAll("_", " ")}</div>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-100">{answer.answer}</div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-line bg-panel p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted">Citations</div>
                    <div className="mt-4 space-y-3">
                      {answer.citations.length === 0 ? <div className="text-sm text-muted">No supporting citations were returned.</div> : null}
                      {answer.citations.map((citation) => (
                        <div key={citation.label} className="rounded-2xl border border-line bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-accent">{citation.label}</div>
                          <div className="mt-2 text-sm font-medium text-white">{citation.title}</div>
                          <div className="mt-1 text-xs text-muted">{citation.section_title}</div>
                          {citation.document_slug ? (
                            <Link href={`/app/library/${citation.document_slug}`} className="mt-3 inline-block text-sm text-accent hover:text-accentStrong">
                              Open cited page
                            </Link>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-line bg-panel p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted">Supporting passages</div>
                    <div className="mt-4 space-y-3">
                      {answer.supporting_passages.length === 0 ? <div className="text-sm text-muted">No passages were returned.</div> : null}
                      {answer.supporting_passages.map((passage) => (
                        <div key={`${passage.label}-${passage.document_id}`} className="rounded-2xl border border-line bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-accent">{passage.label}</div>
                            <div className="text-xs text-muted">{passage.section_title ?? "Overview"}</div>
                          </div>
                          <div className="mt-2 text-sm font-medium text-white">{passage.title}</div>
                          <div className="mt-3 text-sm leading-7 text-slate-200">{passage.excerpt}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
          </section>

          {document.sections.length === 0 && document.plain_text ? (
            <div className="whitespace-pre-wrap text-sm leading-8 text-slate-100">{document.plain_text}</div>
          ) : null}

          {document.sections.map((section, index) => (
            <section
              key={`${section.anchor ?? section.title ?? "section"}-${index}`}
              id={section.anchor ?? undefined}
              className="scroll-mt-24 border-b border-line/70 pb-6 last:border-b-0 last:pb-0"
            >
              <h2 className="text-2xl font-semibold text-white">{section.title ?? `Section ${index + 1}`}</h2>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-100">{section.content}</div>
            </section>
          ))}

          {imageReferences.length ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">Media</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {imageReferences.slice(0, 6).map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    onClick={() => setLightboxSource(reference)}
                    className="overflow-hidden rounded-3xl border border-line bg-black/20 text-left"
                  >
                    <img src={reference} alt={document.title} className="h-56 w-full object-cover" />
                    <div className="border-t border-line px-4 py-3 text-xs text-muted">{reference}</div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Reader map</div>
            <div className="mt-4 space-y-2">
              {tocSections.length === 0 ? <div className="text-sm text-muted">No table of contents available.</div> : null}
              {tocSections.map((section, index) => (
                <a
                  key={`${section.anchor ?? section.title ?? "toc"}-${index}`}
                  href={section.anchor ? `#${section.anchor}` : undefined}
                  className="block rounded-2xl border border-transparent px-3 py-2 text-sm text-slate-200 transition hover:border-line hover:bg-panel"
                >
                  {section.title ?? `Section ${index + 1}`}
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Backlinks</div>
            <div className="mt-4 space-y-3">
              {document.backlinks.length === 0 ? <div className="text-sm text-muted">No backlinks resolved yet.</div> : null}
              {document.backlinks.map((item) => (
                <Link key={item.id} href={item.slug ? `/app/library/${item.slug}` : "/app/library"} className="block rounded-2xl border border-line bg-panel p-4">
                  <div className="text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{item.source_type}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Related reading</div>
            <div className="mt-4 space-y-3">
              {document.related_documents.length === 0 ? <div className="text-sm text-muted">No related documents yet.</div> : null}
              {document.related_documents.map((item) => (
                <Link key={item.id} href={item.slug ? `/app/library/${item.slug}` : "/app/library"} className="block rounded-2xl border border-line bg-panel p-4">
                  <div className="text-sm font-medium text-white">{item.title}</div>
                  {item.summary ? <div className="mt-2 text-sm leading-6 text-slate-200">{item.summary}</div> : null}
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Source metadata</div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div>Identifier: {document.source_identifier ?? document.canonical_id}</div>
              <div>Status: {document.indexing_status}</div>
              <div>Embeddings: {document.embedding_status}</div>
              {document.path_or_url ? (
                <a href={document.path_or_url} target="_blank" rel="noreferrer" className="inline-block text-accent hover:text-accentStrong">
                  Open original source
                </a>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {lightboxSource ? (
        <button
          type="button"
          onClick={() => setLightboxSource(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
        >
          <img src={lightboxSource} alt={document.title} className="max-h-full max-w-full rounded-3xl border border-line" />
        </button>
      ) : null}
    </div>
  );
}
