export interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

export interface Citation {
  label: string;
  title: string;
  section_title: string;
  source_type: string;
  document_slug: string;
  path_or_url: string;
}

export interface SupportingPassage {
  label: string;
  document_id: string;
  document_slug?: string | null;
  title: string;
  section_title?: string | null;
  excerpt: string;
  source_type: string;
  path_or_url?: string | null;
  score: number;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  title: string;
  document_slug?: string | null;
  section_title?: string | null;
  source_type: string;
  document_kind?: string | null;
  summary?: string | null;
  tags: string[];
  path_or_url?: string | null;
  excerpt: string;
  score: number;
}

export interface SearchResponse {
  mode: string;
  results: SearchResult[];
}

export interface SourceSummary {
  source_type: string;
  source_name: string;
  document_count: number;
  indexed_count: number;
  latest_updated_at?: string | null;
  document_kinds: string[];
}

export interface SourceDetail {
  source_type: string;
  source_name: string;
  document_count: number;
  indexed_count: number;
  latest_updated_at?: string | null;
  document_kinds: string[];
  documents: DocumentRecord[];
}

export interface DocumentRecord {
  id: string;
  source_type: string;
  source_name: string;
  source_identifier?: string | null;
  canonical_id: string;
  title: string;
  slug?: string | null;
  summary?: string | null;
  tags: string[];
  path_or_url?: string | null;
  language: string;
  status: string;
  indexing_status?: string | null;
  embedding_status?: string | null;
  document_kind?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_indexed_at?: string | null;
}

export interface DocumentSection {
  title?: string | null;
  content: string;
  anchor?: string | null;
}

export interface RelatedDocument {
  id: string;
  title: string;
  slug?: string | null;
  source_type: string;
  summary?: string | null;
}

export interface DocumentDetail extends DocumentRecord {
  raw_content?: string | null;
  normalized_content?: string | null;
  plain_text?: string | null;
  sections: DocumentSection[];
  tags: string[];
  links_out: string[];
  media_references: string[];
  backlinks: RelatedDocument[];
  related_documents: RelatedDocument[];
}

export interface PageAnswer {
  answer: string;
  scope_used: string;
  citations: Citation[];
  supporting_passages: SupportingPassage[];
  provider_name: string;
  model_name: string;
}

export interface IngestionJob {
  id: string;
  workflow_id?: string | null;
  source_type: string;
  source_name: string;
  target_path?: string | null;
  status: string;
  progress: Record<string, number>;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface SourceProfile {
  id: string;
  label: string;
  description?: string | null;
  source_type: string;
  source_name: string;
  target_path: string;
  document_kind?: string | null;
  tags: string[];
  enabled: boolean;
  limit?: number;
}

export interface ImportStats {
  documents_by_source: Array<{ source_type: string; count: number }>;
  documents_by_indexing_status: Array<{ status: string; count: number }>;
}
