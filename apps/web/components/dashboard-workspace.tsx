"use client";

import type { DocumentRecord, IngestionJob, SourceSummary } from "@uintell/shared/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Pending";
  }
  return new Date(value).toLocaleString();
}

export function DashboardWorkspace() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      const [sourcesResult, documentsResult, jobsResult] = await Promise.allSettled([
        api.listSources({ limit: 8 }),
        api.listDocuments({ limit: 6 }),
        api.listJobs(),
      ]);

      if (!active) {
        return;
      }

      if (sourcesResult.status === "fulfilled") {
        setSources(sourcesResult.value.sources);
      }

      if (documentsResult.status === "fulfilled") {
        setDocuments(documentsResult.value.documents);
      } else {
        setError(documentsResult.reason instanceof Error ? documentsResult.reason.message : "Failed to load dashboard");
      }

      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value.slice(0, 5));
      } else {
        setJobs([]);
      }

      setLoading(false);
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="max-w-4xl">
          <div className="text-xs uppercase tracking-[0.22em] text-[#5faa73]">Reader-first knowledge system</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#7df2a6]">
            Import sources, read comfortably, ask grounded questions, follow the evidence.
          </h1>
          <p className="mt-4 text-sm leading-8 text-[#66c485]">
            Uintell is focused on one workflow: bring in offline knowledge sources, browse them like a serious technical
            library, open a page, and ask page-scoped AI questions with visible citations.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/library" className="rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff]">
            Open library
          </Link>
          <Link href="/app/search" className="rounded-full border border-[#12311d] px-5 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
            Search sources
          </Link>
          <Link href="/app/imports" className="rounded-full border border-[#12311d] px-5 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
            Import source
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Sources", value: sources.length, detail: "Named corpora you can browse and ingest" },
          { label: "Recent documents", value: documents.length, detail: "Reader-ready pages available right now" },
          { label: "Recent jobs", value: jobs.length, detail: "Import activity visible without a heavy admin shell" },
        ].map((item) => (
          <div key={item.label} className="border border-[#12311d] bg-[#08110d] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">{item.label}</div>
            <div className="mt-3 text-3xl font-semibold text-[#7df2a6]">{loading ? "..." : item.value}</div>
            <div className="mt-2 text-sm text-[#66c485]">{item.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr]">
        <div className="border border-[#12311d] bg-[#050b08] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Sources</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Knowledge collections</h2>
            </div>
            <Link href="/app/library" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
              View library
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {!loading && sources.length === 0 ? (
              <div className="border border-dashed border-[#12311d] p-5 text-sm text-[#5faa73]">No sources indexed yet. Start with a local docs folder or wiki import.</div>
            ) : null}

            {sources.map((source) => (
              <Link
                key={`${source.source_type}:${source.source_name}`}
                href={`/app/library/source/${encodeURIComponent(source.source_type)}/${encodeURIComponent(source.source_name)}`}
                className="block border border-[#12311d] bg-[#08110d] p-4 transition hover:border-[#4d8dff]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#7df2a6]">{source.source_name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5faa73]">{source.source_type}</div>
                  </div>
                  <div className="text-right text-xs text-[#66c485]">
                    <div>{source.document_count} documents</div>
                    <div>{source.indexed_count} indexed</div>
                  </div>
                </div>
                {source.document_kinds.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {source.document_kinds.slice(0, 3).map((kind) => (
                      <span key={kind} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                        {kind}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Recent reading</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Open a page and ask about it</h2>
              </div>
              <Link href="/app/library" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
                Browse pages
              </Link>
            </div>

            <div className="mt-5 grid gap-4">
              {!loading && documents.length === 0 ? (
                <div className="border border-dashed border-[#12311d] p-5 text-sm text-[#5faa73]">No reader pages are available yet.</div>
              ) : null}

              {documents.map((document) => (
                <article key={document.id} className="border border-[#12311d] bg-[#08110d] p-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">{document.source_type}</span>
                    {document.document_kind ? (
                      <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{document.document_kind}</span>
                    ) : null}
                    <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#66c485]">{document.source_name}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-medium text-[#7df2a6]">
                    {document.slug ? (
                      <Link href={`/app/library/${document.slug}`} className="transition hover:text-[#7aaaff]">
                        {document.title}
                      </Link>
                    ) : (
                      document.title
                    )}
                  </h3>
                  {document.summary ? <p className="mt-3 text-sm leading-7 text-[#66c485]">{document.summary}</p> : null}
                </article>
              ))}
            </div>
          </div>

          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Import status</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Recent ingestion activity</h2>
              </div>
              <Link href="/app/imports" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
                Open imports
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {jobs.length === 0 ? (
                <div className="border border-dashed border-[#12311d] p-4 text-sm text-[#5faa73]">
                  {loading ? "Loading activity..." : "Import activity will appear here once jobs run."}
                </div>
              ) : null}
              {jobs.map((job) => (
                <article key={job.id} className="border border-[#12311d] bg-[#08110d] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#7df2a6]">{job.source_name}</div>
                      <div className="mt-1 text-xs text-[#5faa73]">{formatTimestamp(job.started_at ?? job.created_at)}</div>
                    </div>
                    <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{job.status}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
