use clap::Parser;
use tokio::{sync::mpsc, task};
use tracing::info;

use sourcepedia_backend::{
    config::AppConfig,
    error::AppResult,
    ingest::{archwiki, chunking::ChunkingConfig},
    init_tracing,
    services::IngestionService,
    storage::{Database, RedisStore},
};

#[derive(Debug, Parser)]
struct Args {
    #[arg(long, default_value_t = 0)]
    limit: usize,
}

#[tokio::main]
async fn main() -> AppResult<()> {
    init_tracing();
    let args = Args::parse();
    let config = AppConfig::from_env()?;

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

    let limit = if args.limit == 0 { None } else { Some(args.limit) };
    let path = config.sources.archwiki_html_dir.clone();
    let (sender, mut receiver) = mpsc::channel(8);
    let producer = task::spawn_blocking(move || archwiki::stream_directory(&path, limit, sender));

    let mut persisted = 0usize;
    while let Some(item) = receiver.recv().await {
        let document = item?;
        ingestion.persist_document(document).await?;
        persisted += 1;
        if persisted.is_multiple_of(100) {
            info!(persisted, "ingested archwiki documents");
        }
    }

    let stats = producer.await??;
    info!(
        seen = stats.documents_seen,
        emitted = stats.documents_emitted,
        persisted,
        "completed archwiki ingestion"
    );

    Ok(())
}
