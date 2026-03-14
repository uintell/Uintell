use tracing::info;

use crate::{
    domain::Document,
    error::AppResult,
    ingest::chunking::{ChunkingConfig, chunk_document},
    storage::{Database, RedisStore},
};

#[derive(Clone)]
pub struct IngestionService {
    database: Database,
    redis: RedisStore,
    chunking: ChunkingConfig,
}

impl IngestionService {
    pub fn new(database: Database, redis: RedisStore, chunking: ChunkingConfig) -> Self {
        Self {
            database,
            redis,
            chunking,
        }
    }

    pub async fn persist_document(&self, document: Document) -> AppResult<usize> {
        let chunks = chunk_document(&document, self.chunking)?;
        let chunk_ids = chunks.iter().map(|chunk| chunk.id).collect::<Vec<_>>();

        self.database
            .upsert_document_with_chunks(&document, &chunks)
            .await?;
        self.redis.enqueue_embedding_jobs(&chunk_ids).await?;

        info!(
            canonical_id = document.canonical_id,
            chunks = chunks.len(),
            "persisted normalized document"
        );

        Ok(chunks.len())
    }
}
