"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { buildReaderSections, DocumentBody } from "@/components/document-body";
import { PageAnswerPanel } from "@/components/page-answer-panel";
import type { DocumentDetail } from "@uintell/shared/contracts";

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
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDocument() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getDocumentBySlug(slug);
        if (active) {
          setDocument(response);
          setActiveAnchor(null);
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

  const readerSections = useMemo(() => (document ? buildReaderSections(document) : []), [document]);
  const tocSections = useMemo(
    () =>
      readerSections
        .filter((section) => section.anchor || section.title)
        .map((section, index) => ({
          anchor: section.anchor,
          label:
            index === 0 && section.title && document && section.title.toLowerCase() === document.title.toLowerCase()
              ? "Overview"
              : section.title ?? `Section ${index + 1}`,
        })),
    [document, readerSections],
  );
  const imageReferences = useMemo(
    () => (document?.media_references ?? []).filter((reference) => isLikelyImageReference(reference)),
    [document],
  );

  useEffect(() => {
    if (typeof window === "undefined" || tocSections.length === 0) {
      return;
    }

    const sections = tocSections
      .map((section) => section.anchor)
      .filter((anchor): anchor is string => Boolean(anchor))
      .map((anchor) => window.document.getElementById(anchor))
      .filter((element): element is HTMLElement => Boolean(element));

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible?.target instanceof HTMLElement) {
          setActiveAnchor(visible.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.2, 1] },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [tocSections]);

  if (loading) {
    return <div className="border border-[#12311d] bg-[#050b08] p-8 text-sm text-[#5faa73]">Loading document reader...</div>;
  }

  if (error || !document) {
    return (
      <div className="border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">
        {error ?? "Document not found"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">
          <Link href="/app/library" className="text-[#4d8dff] hover:text-[#7aaaff]">
            Library
          </Link>{" "}
          /{" "}
          <Link
            href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
            className="text-[#4d8dff] hover:text-[#7aaaff]"
          >
            {document.source_name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/library"
            className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
          >
            Back to library
          </Link>
          <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">{document.source_type}</span>
          <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{document.document_kind}</span>
          <Link
            href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
            className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
          >
            {document.source_name}
          </Link>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-[#7df2a6]">{document.title}</h1>
        {document.summary ? <p className="mt-4 max-w-3xl text-base leading-8 text-[#66c485]">{document.summary}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
          <span>Updated {formatTimestamp(document.updated_at)}</span>
          <span>{document.language}</span>
          <span>{readerSections.length} sections</span>
          <span>{document.backlinks.length} backlinks</span>
        </div>
        {document.tags.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {document.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          {document.path_or_url ? (
            <a href={document.path_or_url} target="_blank" rel="noreferrer" className="text-[#4d8dff] hover:text-[#7aaaff]">
              Open original source
            </a>
          ) : null}
          <Link
            href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
            className="text-[#4d8dff] hover:text-[#7aaaff]"
          >
            Browse this source
          </Link>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="space-y-6 border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
          <PageAnswerPanel document={document} />

          {readerSections.length === 0 && document.plain_text ? (
            <div className="reader-prose">
              <p>{document.plain_text}</p>
            </div>
          ) : null}

          <DocumentBody document={document} sections={readerSections} />

          {imageReferences.length ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#7df2a6]">Media</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {imageReferences.slice(0, 6).map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    onClick={() => setLightboxSource(reference)}
                    className="overflow-hidden border border-[#12311d] bg-[#08110d] text-left"
                  >
                    <img src={reference} alt={document.title} className="h-56 w-full object-cover" />
                    <div className="border-t border-[#12311d] px-4 py-3 text-xs text-[#5faa73]">{reference}</div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">On this page</div>
            <div className="mt-4 space-y-2">
              {tocSections.length === 0 ? <div className="text-sm text-[#5faa73]">No table of contents available.</div> : null}
              {tocSections.map((section, index) => (
                <a
                  key={`${section.anchor ?? section.label ?? "toc"}-${index}`}
                  href={section.anchor ? `#${section.anchor}` : undefined}
                  className={[
                    "block border px-3 py-2 text-sm transition",
                    activeAnchor === section.anchor
                      ? "border-[#4d8dff] bg-[#08110d] text-[#7df2a6]"
                      : "border-transparent text-[#66c485] hover:border-[#12311d] hover:bg-[#08110d]",
                  ].join(" ")}
                >
                  {section.label}
                </a>
              ))}
            </div>
          </section>

          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Source</div>
            <div className="mt-4 space-y-3 text-sm text-[#66c485]">
              <div>Type: {document.source_type}</div>
              <div>Name: {document.source_name}</div>
              <div>Identifier: {document.source_identifier ?? document.canonical_id}</div>
              <div>Status: {document.indexing_status ?? document.status}</div>
              <div>Embeddings: {document.embedding_status}</div>
            </div>
            {document.path_or_url ? (
              <a href={document.path_or_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-[#4d8dff] hover:text-[#7aaaff]">
                Open original source
              </a>
            ) : null}
          </section>

          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Backlinks</div>
            <div className="mt-4 space-y-3">
              {document.backlinks.length === 0 ? <div className="text-sm text-[#5faa73]">No backlinks resolved yet.</div> : null}
              {document.backlinks.map((item) => (
                <Link
                  key={item.id}
                  href={item.slug ? `/app/library/${item.slug}` : "/app/library"}
                  className="block border border-[#12311d] bg-[#08110d] p-4 transition hover:border-[#4d8dff]"
                >
                  <div className="text-sm font-medium text-[#7df2a6]">{item.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5faa73]">{item.source_type}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Related reading</div>
            <div className="mt-4 space-y-3">
              {document.related_documents.length === 0 ? <div className="text-sm text-[#5faa73]">No related documents yet.</div> : null}
              {document.related_documents.map((item) => (
                <Link
                  key={item.id}
                  href={item.slug ? `/app/library/${item.slug}` : "/app/library"}
                  className="block border border-[#12311d] bg-[#08110d] p-4 transition hover:border-[#4d8dff]"
                >
                  <div className="text-sm font-medium text-[#7df2a6]">{item.title}</div>
                  {item.summary ? <div className="mt-2 text-sm leading-6 text-[#66c485]">{item.summary}</div> : null}
                </Link>
              ))}
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
          <img src={lightboxSource} alt={document.title} className="max-h-full max-w-full border border-[#12311d]" />
        </button>
      ) : null}
    </div>
  );
}
