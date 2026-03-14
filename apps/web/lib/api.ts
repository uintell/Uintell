import type {
  DocumentDetail,
  DocumentRecord,
  ImportStats,
  IngestionJob,
  PageAnswer,
  SearchResponse,
  SourceDetail,
  SourceSummary,
  SourceProfile,
  User,
} from "@uintell/shared/contracts";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    if (!isLocalHostname(hostname)) {
      return `${origin}/api`;
    }
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.detail ?? payload?.message ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function safeJson(response: Response): Promise<Record<string, string> | null> {
  try {
    return (await response.json()) as Record<string, string>;
  } catch {
    return null;
  }
}

function buildQueryString(params: Record<string, string | number | Array<string> | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          searchParams.append(key, item);
        }
      }
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  me: () => request<User>("/v1/auth/me"),
  login: (payload: { email: string; password: string }) =>
    request<User>("/v1/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: { email: string; password: string; display_name: string }) =>
    request<User>("/v1/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>("/v1/auth/logout", { method: "POST", body: "{}" }),
  search: (payload: { query: string; mode?: string; source_types?: string[]; tags?: string[]; limit?: number }) =>
    request<SearchResponse>("/v1/retrieval/search", { method: "POST", body: JSON.stringify(payload) }),
  listDocuments: (filters?: {
    query?: string;
    source_type?: string;
    source_name?: string;
    source_types?: string[];
    document_kind?: string;
    tag?: string;
    limit?: number;
    sort?: string;
  }) =>
    request<{ documents: DocumentRecord[] }>(`/v1/documents${buildQueryString({
      query: filters?.query,
      source_type: filters?.source_type,
      source_name: filters?.source_name,
      source_types: filters?.source_types,
      document_kind: filters?.document_kind,
      tag: filters?.tag,
      limit: filters?.limit,
      sort: filters?.sort,
    })}`),
  getDocument: (documentId: string) => request<DocumentDetail>(`/v1/documents/${documentId}`),
  getDocumentBySlug: (slug: string) => request<DocumentDetail>(`/v1/documents/slug/${slug}`),
  answerDocument: (documentId: string, payload: { question: string; mode?: string }) =>
    request<PageAnswer>(`/v1/documents/${documentId}/answer`, { method: "POST", body: JSON.stringify(payload) }),
  listSources: (filters?: { query?: string; source_type?: string; limit?: number }) =>
    request<{ sources: SourceSummary[] }>(`/v1/documents/sources${buildQueryString({
      query: filters?.query,
      source_type: filters?.source_type,
      limit: filters?.limit,
    })}`),
  getSourceDetail: (sourceType: string, sourceName: string) =>
    request<SourceDetail>(`/v1/documents/sources/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceName)}`),
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${resolveApiBase()}/v1/documents/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      const payload = await safeJson(response);
      throw new Error(payload?.detail ?? "Upload failed");
    }
    return response.json();
  },
  getSettings: () => request<{ values: Record<string, unknown> }>("/v1/settings"),
  updateSettings: (values: Record<string, unknown>) =>
    request<{ values: Record<string, unknown> }>("/v1/settings", {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  listImportJobs: () => request<IngestionJob[]>("/v1/imports/jobs"),
  getImportStats: () => request<ImportStats>("/v1/imports/stats"),
  triggerImport: (payload: {
    profile_id?: string;
    source_type?: string;
    source_name?: string;
    target_path?: string | null;
    document_kind?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
    limit?: number;
  }) =>
    request<IngestionJob>("/v1/imports/ingest", { method: "POST", body: JSON.stringify(payload) }),
};

export function readSourceProfiles(values: Record<string, unknown>): SourceProfile[] {
  const sourceBlock = values.sources;
  if (!sourceBlock || typeof sourceBlock !== "object" || !("profiles" in sourceBlock)) {
    return [];
  }
  const profiles = (sourceBlock as { profiles?: unknown }).profiles;
  if (!Array.isArray(profiles)) {
    return [];
  }
  return profiles.filter((profile): profile is SourceProfile => {
    if (!profile || typeof profile !== "object") {
      return false;
    }
    const candidate = profile as Partial<SourceProfile>;
    return Boolean(candidate.id && candidate.label && candidate.source_type && candidate.source_name && candidate.target_path);
  });
}
