"use client";

import type { DocumentDetail } from "@uintell/shared/contracts";
import Link from "next/link";

export function DocumentExploration({ document }: { document: DocumentDetail }) {
  if (document.backlinks.length === 0 && document.related_documents.length === 0) {
    return null;
  }

  return (
    <section className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Continue exploring</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Follow links, context, and nearby pages</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#66c485]">
            Keep reading from the source itself. Backlinks show where this page is referenced. Related pages suggest
            nearby ideas and adjacent topics worth opening next.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/app/library/source/${encodeURIComponent(document.source_type)}/${encodeURIComponent(document.source_name)}`}
            className="text-[#4d8dff] hover:text-[#7aaaff]"
          >
            Browse source
          </Link>
          <Link href="/app/search" className="text-[#4d8dff] hover:text-[#7aaaff]">
            Search library
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <ExplorationColumn
          eyebrow="Backlinks"
          title="Pages that point here"
          emptyMessage="No backlinks resolved for this page yet."
          items={document.backlinks}
        />
        <ExplorationColumn
          eyebrow="Related pages"
          title="Nearby reading"
          emptyMessage="No related pages have been ranked for this page yet."
          items={document.related_documents}
        />
      </div>
    </section>
  );
}

function ExplorationColumn({
  eyebrow,
  title,
  emptyMessage,
  items,
}: {
  eyebrow: string;
  title: string;
  emptyMessage: string;
  items: DocumentDetail["backlinks"];
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">{eyebrow}</div>
        <h3 className="mt-2 text-xl font-semibold text-[#7df2a6]">{title}</h3>
      </div>

      {items.length === 0 ? <div className="border border-dashed border-[#12311d] p-5 text-sm text-[#5faa73]">{emptyMessage}</div> : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.slug ? `/app/library/${item.slug}` : "/app/library"}
            className="border border-[#12311d] bg-[#08110d] p-4 transition hover:border-[#4d8dff]"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[#12311d] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#5faa73]">
                {item.source_type}
              </div>
            </div>
            <div className="mt-3 text-base font-medium text-[#7df2a6]">{item.title}</div>
            {item.summary ? <div className="mt-2 text-sm leading-6 text-[#66c485]">{item.summary}</div> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
