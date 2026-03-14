use std::str::FromStr;

use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{
    FromRow, PgPool, Postgres, QueryBuilder,
    postgres::PgPoolOptions,
    types::Json,
};
use uuid::Uuid;

use crate::{
    domain::{Chunk, Document, DocumentBundle, Section, SourceType},
    error::{AppError, AppResult},
};

#[derive(Debug, Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn connect(database_url: &str) -> AppResult<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;
        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn migrate(&self) -> AppResult<()> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        Ok(())
    }

    pub async fn healthcheck(&self) -> AppResult<()> {
        sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn upsert_document_with_chunks(
        &self,
        document: &Document,
        chunks: &[Chunk],
    ) -> AppResult<()> {
        let mut transaction = self.pool.begin().await?;

        sqlx::query(
            r#"
            INSERT INTO documents (
                id, canonical_id, source_type, source_name, article_title, language,
                path_or_url, source_revision, summary, body_text, categories, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                canonical_id = EXCLUDED.canonical_id,
                source_type = EXCLUDED.source_type,
                source_name = EXCLUDED.source_name,
                article_title = EXCLUDED.article_title,
                language = EXCLUDED.language,
                path_or_url = EXCLUDED.path_or_url,
                source_revision = EXCLUDED.source_revision,
                summary = EXCLUDED.summary,
                body_text = EXCLUDED.body_text,
                categories = EXCLUDED.categories,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            "#,
        )
        .bind(document.id)
        .bind(&document.canonical_id)
        .bind(document.source_type.as_str())
        .bind(&document.source_name)
        .bind(&document.article_title)
        .bind(&document.language)
        .bind(&document.path_or_url)
        .bind(&document.source_revision)
        .bind(&document.summary)
        .bind(&document.body_text)
        .bind(Json(&document.categories))
        .bind(&document.metadata)
        .execute(&mut *transaction)
        .await?;

        sqlx::query("DELETE FROM chunks WHERE document_id = $1")
            .bind(document.id)
            .execute(&mut *transaction)
            .await?;

        if !chunks.is_empty() {
            let mut builder = QueryBuilder::<Postgres>::new(
                r#"
                INSERT INTO chunks (
                    id, document_id, canonical_id, source_type, source_name, article_title,
                    section_title, heading_path, language, path_or_url, chunk_index, content,
                    token_count, metadata, embedding_status
                )
                "#,
            );

            builder.push_values(chunks, |mut row, chunk| {
                row.push_bind(chunk.id)
                    .push_bind(chunk.document_id)
                    .push_bind(&chunk.canonical_id)
                    .push_bind(chunk.source_type.as_str())
                    .push_bind(&chunk.source_name)
                    .push_bind(&chunk.article_title)
                    .push_bind(&chunk.section_title)
                    .push_bind(Json(&chunk.heading_path))
                    .push_bind(&chunk.language)
                    .push_bind(&chunk.path_or_url)
                    .push_bind(chunk.chunk_index)
                    .push_bind(&chunk.content)
                    .push_bind(chunk.token_count)
                    .push_bind(&chunk.metadata)
                    .push_bind("pending");
            });

            builder.build().execute(&mut *transaction).await?;
        }

        transaction.commit().await?;
        Ok(())
    }

    pub async fn list_chunks_page(&self, offset: i64, limit: i64) -> AppResult<Vec<Chunk>> {
        let rows = sqlx::query_as::<_, ChunkRow>(
            r#"
            SELECT
                id, document_id, canonical_id, source_type, source_name, article_title,
                section_title, heading_path, language, path_or_url, chunk_index, content,
                token_count, metadata, embedding_status, created_at, updated_at
            FROM chunks
            ORDER BY canonical_id, chunk_index
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(Chunk::try_from).collect()
    }

    pub async fn get_chunks_by_ids(&self, ids: &[Uuid]) -> AppResult<Vec<Chunk>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let rows = sqlx::query_as::<_, ChunkRow>(
            r#"
            SELECT
                id, document_id, canonical_id, source_type, source_name, article_title,
                section_title, heading_path, language, path_or_url, chunk_index, content,
                token_count, metadata, embedding_status, created_at, updated_at
            FROM chunks
            WHERE id = ANY($1)
            "#,
        )
        .bind(ids)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(Chunk::try_from).collect()
    }

    pub async fn mark_chunks_embedded(&self, ids: &[Uuid]) -> AppResult<()> {
        if ids.is_empty() {
            return Ok(());
        }

        sqlx::query(
            r#"
            UPDATE chunks
            SET embedding_status = 'indexed', embedding_updated_at = NOW(), updated_at = NOW()
            WHERE id = ANY($1)
            "#,
        )
        .bind(ids)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_document_bundle(&self, id: Uuid) -> AppResult<Option<DocumentBundle>> {
        let Some(document_row) = sqlx::query_as::<_, DocumentRow>(
            r#"
            SELECT
                id, canonical_id, source_type, source_name, article_title, language,
                path_or_url, source_revision, summary, body_text, categories, metadata
            FROM documents
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await? else {
            return Ok(None);
        };

        let chunk_rows = sqlx::query_as::<_, ChunkRow>(
            r#"
            SELECT
                id, document_id, canonical_id, source_type, source_name, article_title,
                section_title, heading_path, language, path_or_url, chunk_index, content,
                token_count, metadata, embedding_status, created_at, updated_at
            FROM chunks
            WHERE document_id = $1
            ORDER BY chunk_index
            "#,
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        let document = Document::try_from(document_row)?;
        let chunks = chunk_rows
            .into_iter()
            .map(Chunk::try_from)
            .collect::<AppResult<Vec<_>>>()?;

        Ok(Some(DocumentBundle { document, chunks }))
    }
}

#[derive(Debug, FromRow)]
struct DocumentRow {
    id: Uuid,
    canonical_id: String,
    source_type: String,
    source_name: String,
    article_title: String,
    language: String,
    path_or_url: String,
    source_revision: Option<String>,
    summary: Option<String>,
    body_text: String,
    categories: Json<Vec<String>>,
    metadata: Value,
}

#[derive(Debug, FromRow)]
struct ChunkRow {
    id: Uuid,
    document_id: Uuid,
    canonical_id: String,
    source_type: String,
    source_name: String,
    article_title: String,
    section_title: Option<String>,
    heading_path: Json<Vec<String>>,
    language: String,
    path_or_url: String,
    chunk_index: i32,
    content: String,
    token_count: i32,
    metadata: Value,
    embedding_status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl TryFrom<DocumentRow> for Document {
    type Error = AppError;

    fn try_from(row: DocumentRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            canonical_id: row.canonical_id,
            source_type: SourceType::from_str(&row.source_type)?,
            source_name: row.source_name,
            article_title: row.article_title,
            language: row.language,
            path_or_url: row.path_or_url,
            source_revision: row.source_revision,
            summary: row.summary,
            body_text: row.body_text,
            sections: Vec::<Section>::new(),
            categories: row.categories.0,
            metadata: row.metadata,
        })
    }
}

impl TryFrom<ChunkRow> for Chunk {
    type Error = AppError;

    fn try_from(row: ChunkRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.id,
            document_id: row.document_id,
            canonical_id: row.canonical_id,
            source_type: SourceType::from_str(&row.source_type)?,
            source_name: row.source_name,
            article_title: row.article_title,
            section_title: row.section_title,
            heading_path: row.heading_path.0,
            language: row.language,
            path_or_url: row.path_or_url,
            chunk_index: row.chunk_index,
            content: row.content,
            token_count: row.token_count,
            metadata: row.metadata,
            embedding_status: row.embedding_status,
            created_at: Some(row.created_at),
            updated_at: Some(row.updated_at),
        })
    }
}
