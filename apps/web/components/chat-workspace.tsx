"use client";

import type { ChatMessage, Citation, ConversationDetail, ConversationSummary } from "@uintell/shared/contracts";
import { useEffect, useState } from "react";

import { ConversationSidebar } from "@/components/conversation-sidebar";
import { api, streamChat } from "@/lib/api";

export function ChatWorkspace() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Ready");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadConversations() {
    const data = await api.listConversations();
    setConversations(data);
  }

  async function loadConversation(conversationId: string) {
    setStatus("Loading conversation...");
    const detail = await api.getConversation(conversationId);
    setActiveConversationId(detail.id);
    setMessages(detail.messages);
    setStatus("Ready");
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || streaming) {
      return;
    }
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: draft,
      citations: {},
      created_at: new Date().toISOString(),
    };
    const assistantMessage: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      citations: {},
      created_at: new Date().toISOString(),
    };
    const currentDraft = draft;
    setDraft("");
    setError(null);
    setStreaming(true);
    setMessages((items) => [...items, userMessage, assistantMessage]);
    setStatus("Streaming answer...");

    try {
      await streamChat(
        {
          conversation_id: activeConversationId,
          message: currentDraft,
          use_tools: false,
        },
        (eventName, data) => {
          if (eventName === "metadata" && typeof data.conversation_id === "string") {
            setActiveConversationId(data.conversation_id);
          }
          if (eventName === "delta" && typeof data.text === "string") {
            setMessages((items) =>
              items.map((item) =>
                item.id === assistantMessage.id ? { ...item, content: `${item.content}${data.text as string}` } : item,
              ),
            );
          }
          if (eventName === "citations" && Array.isArray(data.items)) {
            setMessages((items) =>
              items.map((item) =>
                item.id === assistantMessage.id ? { ...item, citations: { items: data.items as Citation[] } } : item,
              ),
            );
          }
        },
      );
      setStatus("Syncing conversation...");
      await loadConversations();
      if (activeConversationId) {
        await loadConversation(activeConversationId);
      } else {
        const summaries = await api.listConversations();
        setConversations(summaries);
        if (summaries[0]) {
          await loadConversation(summaries[0].id);
        }
      }
      setStatus("Ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      setStatus("Failed");
    } finally {
      setStreaming(false);
    }
  }

  const activeCitations = [...messages].reverse().find((message) => message.role === "assistant")?.citations.items ?? [];

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[280px_1fr_320px]">
      <ConversationSidebar
        items={conversations}
        activeId={activeConversationId}
        onSelect={(conversationId) => void loadConversation(conversationId)}
        onNew={() => {
          setActiveConversationId(null);
          setMessages([]);
        }}
      />

      <section className="flex h-full flex-col rounded-3xl border border-line bg-black/20 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Chat</div>
            <div className="text-sm text-slate-200">{status}</div>
          </div>
          <div className="rounded-full border border-line px-3 py-1 text-xs text-muted">Streaming</div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">
              Ask a grounded question. Responses are expected to cite indexed offline sources.
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-3xl border p-4 ${message.role === "user" ? "border-accent/40 bg-accent/10" : "border-line bg-panel"}`}
            >
              <div className="text-xs uppercase tracking-[0.2em] text-muted">{message.role}</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">{message.content}</div>
              {message.citations.items?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.citations.items.map((citation) => (
                    <span key={citation.label} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                      [{citation.label}] {citation.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 rounded-3xl border border-line bg-panelStrong p-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            className="w-full resize-none bg-transparent text-sm leading-7 text-white outline-none"
            placeholder="How do I update Arch Linux safely using only the indexed documentation?"
          />
          <div className="mt-4 flex items-center justify-between">
            {error ? <div className="text-sm text-rose-300">{error}</div> : <div className="text-xs text-muted">OpenAI can be layered in, but retrieval stays local-first.</div>}
            <button disabled={streaming} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink disabled:opacity-60">
              {streaming ? "Streaming..." : "Send"}
            </button>
          </div>
        </form>
      </section>

      <aside className="rounded-3xl border border-line bg-black/20 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">Sources</div>
        <div className="mt-4 space-y-3">
          {activeCitations.length === 0 ? <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No citations yet.</div> : null}
          {activeCitations.map((citation) => (
            <div key={citation.label} className="rounded-2xl border border-line bg-panel p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-accent">[{citation.label}]</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{citation.title}</div>
              <div className="mt-1 text-xs text-muted">{citation.section_title}</div>
              {citation.path_or_url ? (
                <a href={citation.path_or_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent hover:text-accentStrong">
                  Open source
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
