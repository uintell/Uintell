"use client";

import type { AdminStats, IngestionJob, SourceProfile } from "@uintell/shared/contracts";
import { useEffect, useState } from "react";

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

export function AdminWorkspace() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [stats, setStats] = useState<AdminStats>({ documents_by_source: [], documents_by_indexing_status: [] });
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [savingProfiles, setSavingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setStatus("Refreshing...");
    setError(null);
    try {
      const [jobsResponse, statsResponse, settingsResponse] = await Promise.all([api.listJobs(), api.stats(), api.getSettings()]);
      setJobs(jobsResponse);
      setStats(statsResponse);
      setProfiles(readSourceProfiles(settingsResponse.values));
      setStatus("Ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
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
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Imports</div>
          <h1 className="mt-3 text-3xl font-semibold">Ingest offline sources and watch status</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Register local paths, map them to normalized source kinds, and launch ingestion jobs without turning the
            app into a generic admin console.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
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
            className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent"
          >
            Add source
          </button>
          <button onClick={() => void saveProfiles()} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">
            {savingProfiles ? "Saving..." : "Save sources"}
          </button>
          <button onClick={() => void refresh()} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.documents_by_source.map((item) => (
          <div key={`source-${item.source_type}`} className="rounded-3xl border border-line bg-panel p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">{item.source_type}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{item.count}</div>
            <div className="mt-2 text-sm text-muted">Indexed documents</div>
          </div>
        ))}
        {stats.documents_by_indexing_status.map((item) => (
          <div key={`status-${item.status}`} className="rounded-3xl border border-line bg-panel p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">{item.status}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{item.count}</div>
            <div className="mt-2 text-sm text-muted">Indexing status</div>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-line bg-black/20 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Source registry</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Registered paths and normalization rules</h2>
          </div>
          <div className="text-sm text-muted">{status}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {profiles.map((profile) => (
            <article key={profile.id} className="rounded-3xl border border-line bg-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white">{profile.label || "Untitled source"}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void api.triggerIngest({ profile_id: profile.id }).then(refresh)}
                    className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent"
                  >
                    Ingest
                  </button>
                  <button
                    onClick={() => setProfiles((current) => current.filter((item) => item.id !== profile.id))}
                    className="rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-200 hover:border-rose-400"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Label</span>
                  <input
                    value={profile.label}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, label: event.target.value } : item)),
                      )
                    }
                    className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Source type</span>
                  <select
                    value={profile.source_type}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, source_type: event.target.value } : item)),
                      )
                    }
                    className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                  >
                    <option value="filesystem">filesystem</option>
                    <option value="wikipedia">wikipedia</option>
                    <option value="arch_wiki">arch_wiki</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-muted">Target path</span>
                <input
                  value={profile.target_path}
                  onChange={(event) =>
                    setProfiles((current) =>
                      current.map((item) => (item.id === profile.id ? { ...item, target_path: event.target.value } : item)),
                    )
                  }
                  className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                  placeholder="/workspace/data/imports/notes"
                />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Source name</span>
                  <input
                    value={profile.source_name}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, source_name: event.target.value } : item)),
                      )
                    }
                    className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Document kind</span>
                  <select
                    value={profile.document_kind ?? "document"}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, document_kind: event.target.value } : item)),
                      )
                    }
                    className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                  >
                    <option value="document">document</option>
                    <option value="article">article</option>
                    <option value="book">book</option>
                    <option value="note">note</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-muted">Description</span>
                <textarea
                  value={profile.description ?? ""}
                  onChange={(event) =>
                    setProfiles((current) =>
                      current.map((item) => (item.id === profile.id ? { ...item, description: event.target.value } : item)),
                    )
                  }
                  rows={3}
                  className="w-full resize-y rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm leading-7 outline-none focus:border-accent"
                />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Tags</span>
                  <input
                    value={profile.tags.join(", ")}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, tags: parseTags(event.target.value) } : item)),
                      )
                    }
                    className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </label>

                <label className="flex items-end gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={profile.enabled}
                    onChange={(event) =>
                      setProfiles((current) =>
                        current.map((item) => (item.id === profile.id ? { ...item, enabled: event.target.checked } : item)),
                      )
                    }
                    className="h-4 w-4 rounded border-line bg-panel"
                  />
                  Enabled
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="rounded-3xl border border-line bg-black/20 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted">{status}</div>
          <button onClick={() => void refresh()} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">
            Refresh
          </button>
        </div>
        <div className="space-y-3">
          {jobs.length === 0 ? <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No ingestion jobs yet.</div> : null}
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{job.source_name}</div>
                  <div className="mt-1 text-xs text-muted">{job.id}</div>
                </div>
                <div className="rounded-full border border-line px-3 py-1 text-xs text-accent">{job.status}</div>
              </div>
              <div className="mt-3 text-sm text-muted">
                processed: {job.progress.processed ?? 0} · indexed: {job.progress.indexed ?? 0} · skipped: {job.progress.skipped ?? 0}
              </div>
              {job.error_message ? <div className="mt-3 text-sm text-rose-300">{job.error_message}</div> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
