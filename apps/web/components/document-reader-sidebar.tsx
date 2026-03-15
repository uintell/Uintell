"use client";

import type { DocumentDetail } from "@uintell/shared/contracts";
import Link from "next/link";

export type DocumentTocItem = {
  anchor: string | null;
  label: string;
  level: number;
};

export function DocumentReaderSidebar({
  document,
  tocItems,
  activeAnchor,
}: {
  document: DocumentDetail;
  tocItems: DocumentTocItem[];
  activeAnchor: string | null;
}) {
  return (
    <>
      <div className="grid gap-3 xl:hidden">
        <details className="border border-[#12311d] bg-[#050b08] p-4">
          <summary className="cursor-pointer text-sm font-medium text-[#7df2a6]">On this page</summary>
          <div className="mt-4">
            <ReaderToc items={tocItems} activeAnchor={activeAnchor} />
          </div>
        </details>
      </div>

      <aside className="hidden space-y-6 xl:sticky xl:top-6 xl:block xl:self-start">
        <section className="border border-[#12311d] bg-[#050b08] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">On this page</div>
            <div className="text-xs text-[#66c485]">{tocItems.length} sections</div>
          </div>
          <div className="mt-4">
            <ReaderToc items={tocItems} activeAnchor={activeAnchor} />
          </div>
        </section>

        <section className="border border-[#12311d] bg-[#050b08] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Source</div>
          <div className="mt-4 space-y-4">
            <div className="border border-[#12311d] bg-[#08110d] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">{document.source_type}</div>
              <div className="mt-2 text-base font-medium text-[#7df2a6]">{document.source_name}</div>
              <div className="mt-2 text-sm leading-6 text-[#66c485]">
                {document.source_identifier ?? document.canonical_id}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <ReaderMetric label="Updated" value={new Date(document.updated_at).toLocaleDateString()} />
              <ReaderMetric label="Language" value={document.language} />
              <ReaderMetric label="Status" value={document.indexing_status ?? document.status} />
              <ReaderMetric label="Embeddings" value={document.embedding_status ?? "unknown"} />
            </div>

            <div className="space-y-2 text-sm">
              <a href="#ask-this-page" className="block text-[#4d8dff] hover:text-[#7aaaff]">
                Ask this page
              </a>
              <a href="#continue-exploring" className="block text-[#4d8dff] hover:text-[#7aaaff]">
                Continue exploring
              </a>
              <Link
                href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
                className="block text-[#4d8dff] hover:text-[#7aaaff]"
              >
                Browse this source
              </Link>
              <Link href="/app/library" className="block text-[#4d8dff] hover:text-[#7aaaff]">
                Back to library
              </Link>
              {document.path_or_url ? (
                <a href={document.path_or_url} target="_blank" rel="noreferrer" className="block text-[#4d8dff] hover:text-[#7aaaff]">
                  Open original source
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </aside>
    </>
  );
}

function ReaderToc({
  items,
  activeAnchor,
}: {
  items: DocumentTocItem[];
  activeAnchor: string | null;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-[#5faa73]">No table of contents available.</div>;
  }

  return (
    <nav className="max-h-[calc(100vh-13rem)] overflow-y-auto border-l border-[#12311d] pl-3 pr-2">
      {items.map((item, index) => {
        const active = activeAnchor === item.anchor;
        return (
          <a
            key={`${item.anchor ?? item.label}-${index}`}
            href={item.anchor ? `#${item.anchor}` : undefined}
            className={[
              "block py-1.5 text-sm transition",
              active ? "text-[#7df2a6]" : "text-[#66c485] hover:text-[#7aaaff]",
            ].join(" ")}
            style={{ paddingLeft: `${Math.max(0, Math.min(item.level, 4) - 1) * 10}px` }}
          >
            <span className="inline-flex items-center gap-2">
              <span className={active ? "h-1.5 w-1.5 rounded-full bg-[#4d8dff]" : "h-1.5 w-1.5 rounded-full bg-[#12311d]"} />
              <span>{item.label}</span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

function ReaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#12311d] bg-[#08110d] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#5faa73]">{label}</div>
      <div className="mt-2 text-sm text-[#7df2a6]">{value}</div>
    </div>
  );
}
