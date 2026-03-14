"use client";

import type { ImportStats, IngestionJob, SourceProfile } from "@uintell/shared/contracts";
import { useEffect, useMemo, useState } from "react";

import { api, readSourceProfiles } from "@/lib/api";

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeProfile(profile: SourceProfile): SourceProfile {
  return {
    ...profile,
    id: profile.id.trim(),
    label: profile.label.trim(),
    description: profile.description?.trim() ?? "",
    source_name: profile.source_name.trim(),
    target_path: profile.target_path.trim(),
    document_kind: profile.document_kind?.trim() ?? "",
    tags: profile.tags.map((tag) => tag.trim()).filter(Boolean),
  };
}

function nextProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `source-${Date.now()}`;
}

function summarizeStats(stats: ImportStats): string[] {
  const totalDocuments = stats.documents_by_source.reduce((sum, item) => sum + item.count, 0);
  const totalIndexed = stats.documents_by_indexing_status
    .filter((item) => item.status === "indexed")
    .reduce((sum, item) => sum + item.count, 0);

  return [
    `${stats.documents_by_source.length} source types tracked`,
    `${totalDocuments} documents recorded`,
    `${totalIndexed} indexed and reader-ready`,
  ];
}

export function ImportsWorkspace() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [stats, setStats] = useState<ImportStats>({ documents_by_source: [], documents_by_indexing_status: [] });
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [savingProfiles, setSavingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => summarizeStats(stats), [stats]);

  async function refresh() {
    setStatus("Refreshing...");
    setError(null);
    try {
      const [jobsResponse, statsResponse, settingsResponse] = await Promise.all([
        api.listImportJobs(),
        api.getImportStats(),
        api.getSettings(),
      ]);
      setJobs(jobsResponse);
      setStats(statsResponse);
      setProfiles(readSourceProfiles(settingsResponse.values));
      setStatus("Ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load import data");
      setStatus("Failed");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveProfiles() {
    setSavingProfiles(true);
    setError(null);
    try {
      const normalized = profiles.map(serializeProfile).filter((profile) => profile.id && profile.label && profile.target_path);
      await api.updateSettings({ sources: { profiles: normalized } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save source profiles");
    } finally {
      setSavingProfiles(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="border border-[#12311d] bg-[#050b08] p-6 lg:p-8">
        <div className="max-w-4xl">
          <div className="text-xs uppercase tracking-[0.22em] text-[#5faa73]">Imports</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#7df2a6]">Bring local sources into the reader.</h1>
          <p className="mt-4 text-sm leading-8 text-[#66c485]">
            Register a filesystem path, describe what kind of source it is, then run ingestion. This page is only for
            getting source material into the library and tracking progress.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() =>
              setProfiles((current) => [
                ...current,
                {
                  id: nextProfileId(),
                  label: "New source",
                  description: "",
                  source_type: "filesystem",
                  source_name: "local_source",
                  target_path: "",
                  document_kind: "document",
                  tags: [],
                  enabled: true,
                },
              ])
            }
            className="rounded-full bg-[#4d8dff] px-5 py-2 text-sm font-medium text-[#020704] transition hover:bg-[#7aaaff]"
          >
            Add source
          </button>
          <button
            onClick={() => void saveProfiles()}
            className="rounded-full border border-[#12311d] px-5 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
          >
            {savingProfiles ? "Saving..." : "Save sources"}
          </button>
          <button
            onClick={() => void refresh()}
            className="rounded-full border border-[#12311d] px-5 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
          >
            Refresh status
          </button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="border border-[#12311d] bg-[#050b08] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Source registry</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Registered paths and normalization rules</h2>
          <p className="mt-3 text-sm leading-7 text-[#66c485]">
            Keep one profile per source root. The importer normalizes each source into documents, sections, chunks, and
            citations so the reader and ask-page flow behave consistently.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#66c485]">
            {summary.map((item) => (
              <span key={item} className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1">
                {item}
              </span>
            ))}
            <span className="rounded-full border border-[#12311d] bg-[#08110d] px-3 py-1">Status: {status}</span>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {profiles.length === 0 ? (
              <div className="border border-dashed border-[#12311d] p-5 text-sm text-[#5faa73]">
                No source profiles yet. Add a local docs folder, wiki export, or book directory to begin ingestion.
              </div>
            ) : null}

            {profiles.map((profile) => (
              <article key={profile.id} className="border border-[#12311d] bg-[#08110d] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#7df2a6]">{profile.label || "Untitled source"}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5faa73]">{profile.source_type}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void api.triggerImport({ profile_id: profile.id }).then(refresh)}
                      className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
                    >
                      Run import
                    </button>
                    <button
                      onClick={() => setProfiles((current) => current.filter((item) => item.id !== profile.id))}
                      className="rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-[#5faa73]">Label</span>
                    <input
                      value={profile.label}
                      onChange={(event) =>
                        setProfiles((current) =>
                          current.map((item) => (item.id === profile.id ? { ...item, label: event.target.value } : item)),
                        )
                      }
                      className="w-full rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-[#5faa73]">Source type</span>
                    <select
                      value={profile.source_type}
                      onChange={(event) =>
                        setProfiles((current) =>
                          current.map((item) => (item.id === profile.id ? { ...item, source_type: event.target.value } : item)),
                        )
                      }
                      className="w-full rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                    >
                      <option value="filesystem">filesystem</option>
                      <option value="wikipedia">wikipedia</option>
                      <option value="arch_wiki">arch_wiki</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-[#5faa73]">Target path</span>
                  <input
                    value={profile.target_path}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, target_path: event.target.value } : item)),
                      )
                    }
                    className="w-full rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                    placeholder="/data/uintell/imports/docs"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-[#5faa73]">Source name</span>
                    <input
                      value={profile.source_name}
                      onChange={(event) =>
                        setProfiles((current) =>
                          current.map((item) => (item.id === profile.id ? { ...item, source_name: event.target.value } : item)),
                        )
                      }
                      className="w-full rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-[#5faa73]">Document kind</span>
                    <select
                      value={profile.document_kind ?? "document"}
                      onChange={(event) =>
                        setProfiles((current) =>
                          current.map((item) => (item.id === profile.id ? { ...item, document_kind: event.target.value } : item)),
                        )
                      }
                      className="w-full rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                    >
                      <option value="document">document</option>
                      <option value="article">article</option>
                      <option value="book">book</option>
                      <option value="note">note</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-[#5faa73]">Description</span>
                  <textarea
                    value={profile.description ?? ""}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, description: event.target.value } : item)),
                      )
                    }
                    rows={3}
                    className="w-full resize-y rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm leading-7 text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                  <label className="block">
                    <span className="mb-2 block text-sm text-[#5faa73]">Tags</span>
                    <input
                      value={profile.tags.join(", ")}
                      onChange={(event) =>
                        setProfiles((current) =>
                          current.map((item) => (item.id === profile.id ? { ...item, tags: parseTags(event.target.value) } : item)),
                        )
                      }
                      className="w-full rounded-2xl border border-[#12311d] bg-[#030806] px-4 py-3 text-sm text-[#7df2a6] outline-none transition focus:border-[#4d8dff]"
                    />
                  </label>

                  <label className="flex items-end gap-3 text-sm text-[#66c485]">
                    <input
                      type="checkbox"
                      checked={profile.enabled}
                      onChange={(event) =>
                        setProfiles((current) =>
                          current.map((item) => (item.id === profile.id ? { ...item, enabled: event.target.checked } : item)),
                        )
                      }
                      className="h-4 w-4 rounded border-[#12311d] bg-[#030806]"
                    />
                    Enabled
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="border border-[#12311d] bg-[#050b08] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#5faa73]">Ingestion status</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#7df2a6]">Recent jobs</h2>
            </div>
            <button
              onClick={() => void refresh()}
              className="rounded-full border border-[#12311d] px-4 py-2 text-sm text-[#4d8dff] transition hover:border-[#4d8dff] hover:text-[#7aaaff]"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {jobs.length === 0 ? (
              <div className="border border-dashed border-[#12311d] p-4 text-sm text-[#5faa73]">No ingestion jobs yet.</div>
            ) : null}

            {jobs.map((job) => (
              <article key={job.id} className="border border-[#12311d] bg-[#08110d] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#7df2a6]">{job.source_name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5faa73]">{job.source_type}</div>
                  </div>
                  <div className="rounded-full border border-[#12311d] px-3 py-1 text-xs text-[#4d8dff]">{job.status}</div>
                </div>
                <div className="mt-3 text-sm text-[#66c485]">
                  processed: {job.progress.processed ?? 0} · indexed: {job.progress.indexed ?? 0} · skipped: {job.progress.skipped ?? 0}
                </div>
                {job.error_message ? <div className="mt-3 text-sm text-rose-300">{job.error_message}</div> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
