"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export function SettingsWorkspace() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    void (async () => {
      const response = await api.getSettings();
      setSettings(response.values as Record<string, any>);
      setStatus("Loaded");
    })();
  }, []);

  async function handleSave() {
    setStatus("Saving...");
    const response = await api.updateSettings(settings);
    setSettings(response.values as Record<string, any>);
    setStatus("Saved");
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-muted">Provider settings</div>
        <h1 className="mt-3 text-3xl font-semibold">Model and retrieval controls</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-black/20 p-5">
          <div className="text-sm font-medium text-white">Generation</div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-muted">OpenAI model</span>
            <input
              value={settings.provider?.model ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  provider: { ...(current.provider ?? {}), model: event.target.value },
                }))
              }
              className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3 text-sm">
            <span>Enable OpenAI generation</span>
            <input
              type="checkbox"
              checked={Boolean(settings.provider?.enable_openai_generation)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  provider: { ...(current.provider ?? {}), enable_openai_generation: event.target.checked },
                }))
              }
            />
          </label>
          <label className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3 text-sm">
            <span>Enable tool calling</span>
            <input
              type="checkbox"
              checked={Boolean(settings.provider?.enable_tool_calling)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  provider: { ...(current.provider ?? {}), enable_tool_calling: event.target.checked },
                }))
              }
            />
          </label>
        </section>

        <section className="rounded-3xl border border-line bg-black/20 p-5">
          <div className="text-sm font-medium text-white">RAG</div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-muted">Top K</span>
            <input
              type="number"
              value={settings.rag?.top_k ?? 6}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  rag: { ...(current.rag ?? {}), top_k: Number(event.target.value) },
                }))
              }
              className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-muted">Context budget</span>
            <input
              type="number"
              value={settings.rag?.context_char_limit ?? 12000}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  rag: { ...(current.rag ?? {}), context_char_limit: Number(event.target.value) },
                }))
              }
              className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
        </section>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-line bg-panel p-4">
        <div className="text-sm text-muted">{status}</div>
        <button onClick={() => void handleSave()} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink">
          Save settings
        </button>
      </div>
    </div>
  );
}
