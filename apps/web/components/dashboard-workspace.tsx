"use client";

import type { AdminStats, CollectionRecord, DocumentRecord, IngestionJob, NoteRecord, SourceProfile } from "@uintell/shared/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, readSourceProfiles } from "@/lib/api";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Pending";
  }
  return new Date(value).toLocaleString();
}

export function DashboardWorkspace() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [stats, setStats] = useState<AdminStats>({ documents_by_source: [], documents_by_indexing_status: [] });
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [documentsResponse, notesResponse, collectionsResponse, jobsResponse, statsResponse, settingsResponse] = await Promise.all([
          api.listDocuments({ limit: 6 }),
          api.listNotes(),
          api.listCollections(),
          api.listJobs(),
          api.stats(),
          api.getSettings(),
        ]);

        if (!active) {
          return;
        }

        setDocuments(documentsResponse.documents);
        setNotes(notesResponse);
        setCollections(collectionsResponse);
        setJobs(jobsResponse.slice(0, 6));
        setStats(statsResponse);
        setProfiles(readSourceProfiles(settingsResponse.values));
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-[#5faa73]">Knowledge workspace</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#7df2a6]">Private knowledge engine, locally controlled.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#66c485]">
            Browse ingested documents, curate knowledge pages and collections, run hybrid search, and control source imports from one
            place.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/search" className="rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff]">
            Search knowledge
          </Link>
          <Link href="/app/admin" className="rounded-full border border-[#12311d] px-5 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
            Manage imports
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Documents", value: documents.length, detail: `${stats.documents_by_source.length} source groups` },
          { label: "Pages", value: notes.length, detail: "Knowledge pages linked to your corpus" },
          { label: "Collections", value: collections.length, detail: "Curated reading sets and research bundles" },
          { label: "Import profiles", value: profiles.length, detail: `${profiles.filter((profile) => profile.enabled).length} enabled by default` },
        ].map((item) => (
          <div key={item.label} className="border border-[#12311d] bg-[#08110d] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">{item.label}</div>
            <div className="mt-4 text-3xl font-semibold text-[#7df2a6]">{loading ? "..." : item.value}</div>
            <div className="mt-2 text-sm text-[#66c485]">{item.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Recent documents</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Reader-ready documents</h2>
              </div>
              <Link href="/app/library" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
                Open library
              </Link>
            </div>

            <div className="mt-5 grid gap-4">
              {!loading && documents.length === 0 ? (
                <div className="border border-dashed border-[#12311d] p-5 text-sm text-[#5faa73]">No documents indexed yet.</div>
              ) : null}

              {documents.map((document) => (
                <article key={document.id} className="border border-[#12311d] bg-[#08110d] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">{document.source_type}</span>
                    <span className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{document.document_kind ?? "document"}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-medium text-[#7df2a6]">
                    {document.slug ? <Link href={`/app/library/${document.slug}`} className="transition hover:text-[#7aaaff]">{document.title}</Link> : document.title}
                  </h3>
                  {document.summary ? <p className="mt-3 text-sm leading-7 text-[#66c485]">{document.summary}</p> : null}
                  {document.tags.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {document.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#5faa73]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Source coverage</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {stats.documents_by_source.map((item) => (
                <div key={item.source_type} className="border border-[#12311d] bg-[#08110d] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">{item.source_type}</div>
                  <div className="mt-3 text-2xl font-semibold text-[#7df2a6]">{item.count}</div>
                </div>
              ))}
              {stats.documents_by_source.length === 0 && !loading ? (
                <div className="border border-dashed border-[#12311d] p-4 text-sm text-[#5faa73]">Import a source profile to populate the corpus.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Import profiles</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Configured sources</h2>
            <div className="mt-5 space-y-3">
              {profiles.slice(0, 5).map((profile) => (
                <article key={profile.id} className="border border-[#12311d] bg-[#08110d] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#7df2a6]">{profile.label}</div>
                      <div className="mt-1 text-xs text-[#5faa73]">{profile.target_path}</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs ${profile.enabled ? "border-[#4d8dff]/40 text-[#4d8dff]" : "border-[#12311d] text-[#5faa73]"}`}>
                      {profile.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="border border-[#12311d] bg-[#050b08] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Recent jobs</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Ingestion activity</h2>
              </div>
              <Link href="/app/admin" className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]">
                View admin
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {!loading && jobs.length === 0 ? (
                <div className="border border-dashed border-[#12311d] p-4 text-sm text-[#5faa73]">No jobs yet.</div>
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
