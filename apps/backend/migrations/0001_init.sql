CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    canonical_id TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    article_title TEXT NOT NULL,
    language TEXT NOT NULL,
    path_or_url TEXT NOT NULL,
    source_revision TEXT,
    summary TEXT,
    body_text TEXT NOT NULL,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    canonical_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    article_title TEXT NOT NULL,
    section_title TEXT,
    heading_path JSONB NOT NULL DEFAULT '[]'::jsonb,
    language TEXT NOT NULL,
    path_or_url TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding_status TEXT NOT NULL DEFAULT 'pending',
    embedding_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (canonical_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents (source_type);
CREATE INDEX IF NOT EXISTS idx_documents_article_title ON documents (article_title);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_source_type ON chunks (source_type);
CREATE INDEX IF NOT EXISTS idx_chunks_article_title ON chunks (article_title);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_status ON chunks (embedding_status);
