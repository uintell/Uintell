"use client";

import Link from "next/link";

export function FrozenWorkspaceNotice({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div className="space-y-6 border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-[#5faa73]">Frozen surface</div>
        <h1 className="mt-3 text-3xl font-semibold text-[#7df2a6]">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-8 text-[#66c485]">{summary}</p>
      </div>

      <div className="border border-[#12311d] bg-[#08110d] p-5 text-sm leading-7 text-[#66c485]">
        Uintell is being reduced to one reader-first flow: import a source, browse the library, open a page, ask about
        that page, and inspect the citations and evidence.
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/app/library" className="rounded-full bg-[#4d8dff] px-5 py-2 font-medium text-[#020704] transition hover:bg-[#7aaaff]">
          Open library
        </Link>
        <Link
          href="/app/search"
          className="rounded-full border border-[#12311d] px-5 py-2 text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
        >
          Search sources
        </Link>
        <Link
          href="/app/imports"
          className="rounded-full border border-[#12311d] px-5 py-2 text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
        >
          Import source
        </Link>
      </div>
    </div>
  );
}
