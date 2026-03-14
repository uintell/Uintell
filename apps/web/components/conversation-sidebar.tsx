"use client";

import type { ConversationSummary } from "@uintell/shared/contracts";
import clsx from "clsx";

type Props = {
  items: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function ConversationSidebar({ items, activeId, onSelect, onNew }: Props) {
  return (
    <aside className="flex h-full flex-col rounded-3xl border border-line bg-black/20 p-4">
      <button onClick={onNew} className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-ink">
        New conversation
      </button>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">History</div>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No conversations yet.</div> : null}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={clsx(
              "w-full rounded-2xl border px-4 py-3 text-left transition",
              activeId === item.id ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-accent/40",
            )}
          >
            <div className="line-clamp-2 text-sm font-medium text-slate-100">{item.title}</div>
            <div className="mt-2 text-xs text-muted">{item.message_count} messages</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
