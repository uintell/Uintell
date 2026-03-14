"use client";

import type { CollectionItemRecord, CollectionRecord, DocumentRecord, NoteRecord } from "@uintell/shared/contracts";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type CollectionFormState = {
  id: string | null;
  title: string;
  description: string;
};

type ItemFormState = {
  document_id: string;
  note_id: string;
};

const EMPTY_COLLECTION_FORM: CollectionFormState = {
  id: null,
  title: "",
  description: "",
};

const EMPTY_ITEM_FORM: ItemFormState = {
  document_id: "",
  note_id: "",
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function CollectionsWorkspace() {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>(EMPTY_COLLECTION_FORM);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingItems, setMutatingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(preferredSelectionId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const [collectionsResponse, notesResponse, documentsResponse] = await Promise.all([
        api.listCollections(),
        api.listNotes(),
        api.listDocuments(),
      ]);
      setCollections(collectionsResponse);
      setNotes(notesResponse);
      setDocuments(documentsResponse.documents);

      const nextSelectionId =
        preferredSelectionId && collectionsResponse.some((collection) => collection.id === preferredSelectionId)
          ? preferredSelectionId
          : collectionsResponse[0]?.id ?? null;
      setSelectedCollectionId(nextSelectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function editCollection(collection: CollectionRecord) {
    setCollectionForm({
      id: collection.id,
      title: collection.title,
      description: collection.description ?? "",
    });
    setSelectedCollectionId(collection.id);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: collectionForm.title.trim(),
        description: collectionForm.description.trim() || null,
        metadata: {},
      };
      if (!payload.title) {
        throw new Error("Collection title is required");
      }
      if (collectionForm.id) {
        await api.updateCollection(collectionForm.id, payload);
        await loadData(collectionForm.id);
      } else {
        const created = await api.createCollection(payload);
        await loadData(created.id);
      }
      setCollectionForm(EMPTY_COLLECTION_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save collection");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(collectionId: string) {
    if (!window.confirm("Delete this collection?")) {
      return;
    }
    setError(null);
    try {
      await api.deleteCollection(collectionId);
      if (collectionForm.id === collectionId) {
        setCollectionForm(EMPTY_COLLECTION_FORM);
      }
      await loadData(selectedCollectionId === collectionId ? null : selectedCollectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
    }
  }

  async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCollectionId) {
      setError("Select a collection first");
      return;
    }
    if (!itemForm.document_id && !itemForm.note_id) {
      setError("Choose a document or a note to add");
      return;
    }
    setMutatingItems(true);
    setError(null);
    try {
      const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
      await api.addCollectionItem(selectedCollectionId, {
        document_id: itemForm.document_id || null,
        note_id: itemForm.note_id || null,
        sort_order: selectedCollection?.items.length ?? 0,
      });
      setItemForm(EMPTY_ITEM_FORM);
      await loadData(selectedCollectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setMutatingItems(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!selectedCollectionId) {
      return;
    }
    setMutatingItems(true);
    setError(null);
    try {
      await api.removeCollectionItem(selectedCollectionId, itemId);
      await loadData(selectedCollectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setMutatingItems(false);
    }
  }

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? null;

  function renderItemLabel(item: CollectionItemRecord): string {
    if (item.document_id) {
      return documents.find((document) => document.id === item.document_id)?.title ?? item.document_id;
    }
    if (item.note_id) {
      return notes.find((note) => note.id === item.note_id)?.title ?? item.note_id;
    }
    return "Unknown item";
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Collections</div>
          <h1 className="mt-3 text-3xl font-semibold">Curated groups of documents and notes</h1>
        </div>
        <button
          onClick={() => setCollectionForm(EMPTY_COLLECTION_FORM)}
          className="rounded-full border border-line px-4 py-2 text-sm text-slate-100 transition hover:border-accent"
        >
          New collection
        </button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-line bg-black/20 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">{collectionForm.id ? "Edit collection" : "Create collection"}</div>
                <div className="mt-1 text-xs text-muted">Collections can contain note and document references.</div>
              </div>
              {collectionForm.id ? (
                <button
                  type="button"
                  onClick={() => setCollectionForm(EMPTY_COLLECTION_FORM)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-accent"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-muted">Title</span>
              <input
                value={collectionForm.title}
                onChange={(event) => setCollectionForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
                placeholder="Incident response pack"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-muted">Description</span>
              <textarea
                value={collectionForm.description}
                onChange={(event) => setCollectionForm((current) => ({ ...current, description: event.target.value }))}
                rows={5}
                className="w-full resize-y rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-7 outline-none focus:border-accent"
                placeholder="Bundle the core documents and notes for a recurring workflow."
              />
            </label>

            <button disabled={saving} className="mt-5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink disabled:opacity-60">
              {saving ? "Saving..." : collectionForm.id ? "Update collection" : "Create collection"}
            </button>
          </form>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">{loading ? "Loading collections..." : `${collections.length} collections`}</div>
              <button onClick={() => void loadData(selectedCollectionId)} className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent">
                Refresh
              </button>
            </div>

            {!loading && collections.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">No collections yet. Create one to organize notes and documents.</div>
            ) : null}

            {collections.map((collection) => (
              <article
                key={collection.id}
                className={`rounded-3xl border p-5 ${collection.id === selectedCollectionId ? "border-accent/50 bg-accent/10" : "border-line bg-panel"}`}
              >
                <button onClick={() => setSelectedCollectionId(collection.id)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium text-white">{collection.title}</h2>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">{collection.items.length} items</div>
                    </div>
                    <div className="text-xs text-muted">{formatTimestamp(collection.updated_at)}</div>
                  </div>
                  {collection.description ? <p className="mt-3 text-sm leading-7 text-slate-200">{collection.description}</p> : null}
                </button>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => editCollection(collection)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent">
                    Edit
                  </button>
                  <button
                    onClick={() => void handleDelete(collection.id)}
                    className="rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-200 hover:border-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>

        <section className="space-y-6 rounded-3xl border border-line bg-black/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Active collection</div>
              <h2 className="mt-3 text-2xl font-semibold text-white">{selectedCollection?.title ?? "Select a collection"}</h2>
              <div className="mt-2 text-sm text-muted">{selectedCollection?.description ?? "Choose a collection to manage its items."}</div>
            </div>
            {selectedCollection ? <div className="rounded-full border border-line px-3 py-1 text-xs text-accent">{selectedCollection.items.length} items</div> : null}
          </div>

          <form onSubmit={handleAddItem} className="rounded-3xl border border-line bg-panel p-4">
            <div className="text-sm font-medium text-white">Add item</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-muted">Document</span>
                <select
                  value={itemForm.document_id}
                  onChange={(event) =>
                    setItemForm({
                      document_id: event.target.value,
                      note_id: event.target.value ? "" : itemForm.note_id,
                    })
                  }
                  className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">Choose a document</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-muted">Note</span>
                <select
                  value={itemForm.note_id}
                  onChange={(event) =>
                    setItemForm({
                      document_id: event.target.value ? "" : itemForm.document_id,
                      note_id: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-line bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  <option value="">Choose a note</option>
                  {notes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              disabled={!selectedCollection || mutatingItems}
              className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink disabled:opacity-60"
            >
              {mutatingItems ? "Updating..." : "Add to collection"}
            </button>
          </form>

          <div className="space-y-3">
            {!selectedCollection ? <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No collection selected.</div> : null}
            {selectedCollection?.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">This collection is empty.</div>
            ) : null}
            {selectedCollection?.items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{renderItemLabel(item)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                      {item.document_id ? "Document" : item.note_id ? "Note" : "Unknown"}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleRemoveItem(item.id)}
                    className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
