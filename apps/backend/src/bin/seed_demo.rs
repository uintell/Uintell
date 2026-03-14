use std::{fs, path::PathBuf};

use serde::Deserialize;
use serde_json::Value;

use sourcepedia_backend::{
    config::AppConfig,
    domain::{Document, Section, SourceType},
    error::{AppError, AppResult},
    ingest::chunking::ChunkingConfig,
    init_tracing,
    services::IngestionService,
    storage::{Database, RedisStore},
};

#[derive(Debug, Deserialize)]
struct SeedDocument {
    canonical_id: String,
    source_type: String,
    source_name: String,
    article_title: String,
    language: String,
    path_or_url: String,
    source_revision: Option<String>,
    summary: Option<String>,
    body_text: String,
    sections: Vec<SeedSection>,
    categories: Vec<String>,
    metadata: Value,
}

#[derive(Debug, Deserialize)]
struct SeedSection {
    title: Option<String>,
    heading_path: Vec<String>,
    content: String,
    metadata: Value,
}

#[tokio::main]
async fn main() -> AppResult<()> {
    init_tracing();
    let config = AppConfig::from_env()?;
    let fixture_path = config.demo_fixture_path.clone();

    let database = Database::connect(&config.database_url).await?;
    database.migrate().await?;
    let redis = RedisStore::connect(
        &config.redis.url,
        config.redis.embed_queue_key.clone(),
        config.redis.cache_ttl_seconds,
    )
    .await?;
    let ingestion = IngestionService::new(
        database,
        redis,
        ChunkingConfig {
            max_chars: config.indexing.chunk_size_chars,
            overlap_chars: config.indexing.chunk_overlap_chars,
        },
    );

    let documents = load_fixture(&fixture_path)?;
    for seed in documents {
        ingestion.persist_document(seed.into_document()?).await?;
    }

    Ok(())
}

fn load_fixture(path: &PathBuf) -> AppResult<Vec<SeedDocument>> {
    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw).map_err(Into::into)
}

impl SeedDocument {
    fn into_document(self) -> AppResult<Document> {
        let source_type = match self.source_type.as_str() {
            "wikipedia" => SourceType::Wikipedia,
            "arch_wiki" => SourceType::ArchWiki,
            other => {
                return Err(AppError::InvalidInput(format!(
                    "unknown demo source type: {other}"
                )));
            }
        };

        let mut document = Document::new(
            self.canonical_id,
            source_type,
            self.source_name,
            self.article_title,
            self.language,
            self.path_or_url,
            self.body_text,
            self.sections
                .into_iter()
                .map(|section| Section {
                    title: section.title,
                    heading_path: section.heading_path,
                    content: section.content,
                    metadata: section.metadata,
                })
                .collect(),
            self.categories,
            self.metadata,
        );
        document.source_revision = self.source_revision;
        document.summary = self.summary;
        Ok(document)
    }
}
