"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { DocumentBody, buildReaderSections } from "@/components/document-body";
import { DocumentExploration } from "@/components/document-exploration";
import { DocumentReaderSidebar } from "@/components/document-reader-sidebar";
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
        .filter((section) => (section.anchor || section.title) && section.level <= 3)
        .map((section, index) => ({
          anchor: section.anchor,
          label:
            index === 0 && section.title && document && section.title.toLowerCase() === document.title.toLowerCase()
              ? "Overview"
              : section.title ?? `Section ${index + 1}`,
          level: section.level,
        })),
    [document, readerSections],
  );
  const imageReferences = useMemo(
    () => (document?.media_references ?? []).filter((reference) => isLikelyImageReference(reference)),
    [document],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (hash) {
      setActiveAnchor(hash);
    }
  }, [document?.id]);

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
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.6, 1] },
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
    <div className="space-y-10">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="max-w-5xl">
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">{document.source_type}</span>
            {document.document_kind ? (
              <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{document.document_kind}</span>
            ) : null}
            <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#66c485]">{document.source_name}</span>
          </div>

          <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[#7df2a6] lg:text-5xl">{document.title}</h1>
              {document.summary ? <p className="mt-5 max-w-3xl text-base leading-8 text-[#66c485]">{document.summary}</p> : null}
            </div>

            <div className="grid gap-3 text-xs uppercase tracking-[0.18em] text-[#5faa73]">
              <div className="border-l border-[#12311d] pl-4">Updated {formatTimestamp(document.updated_at)}</div>
              <div className="border-l border-[#12311d] pl-4">{document.language}</div>
              <div className="border-l border-[#12311d] pl-4">{tocSections.length} TOC entries</div>
              <div className="border-l border-[#12311d] pl-4">{document.related_documents.length} related pages</div>
            </div>
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

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href="/app/library" className="text-[#4d8dff] hover:text-[#7aaaff]">
              Back to library
            </Link>
            <a href="#ask-this-page" className="text-[#4d8dff] hover:text-[#7aaaff]">
              Ask this page
            </a>
            <Link
              href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
              className="text-[#4d8dff] hover:text-[#7aaaff]"
            >
              Browse this source
            </Link>
            {document.path_or_url ? (
              <a href={document.path_or_url} target="_blank" rel="noreferrer" className="text-[#4d8dff] hover:text-[#7aaaff]">
                Open original source
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <article className="border border-[#12311d] bg-[#050b08] p-6 lg:p-10">
            <div className="mx-auto w-full max-w-[74ch] space-y-10">
              {readerSections.length === 0 && document.plain_text ? (
                <div className="reader-prose">
                  <p>{document.plain_text}</p>
                </div>
              ) : null}

              <DocumentBody document={document} sections={readerSections} />
            </div>
          </article>

          <div id="ask-this-page" className="scroll-mt-24">
            <PageAnswerPanel document={document} />
          </div>

          {imageReferences.length ? (
            <section className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Media</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Referenced images</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {imageReferences.slice(0, 6).map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    onClick={() => setLightboxSource(reference)}
                    className="overflow-hidden border border-[#12311d] bg-[#08110d] text-left transition hover:border-[#4d8dff]"
                  >
                    <img src={reference} alt={document.title} className="h-56 w-full object-cover" />
                    <div className="border-t border-[#12311d] px-4 py-3 text-xs text-[#5faa73]">{reference}</div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <DocumentExploration document={document} />
        </div>

        <DocumentReaderSidebar document={document} tocItems={tocSections} activeAnchor={activeAnchor} />
      </div>

      {lightboxSource ? (
        <button
          type="button"
          onClick={() => setLightboxSource(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-8"
        >
          <img src={lightboxSource} alt={document.title} className="max-h-full max-w-full border border-[#12311d]" />
        </button>
      ) : null}
    </div>
  );
}
