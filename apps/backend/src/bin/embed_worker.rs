use std::collections::HashSet;

use clap::Parser;
use tracing::info;

use sourcepedia_backend::{
    config::AppConfig,
    embedding::build_embedding_provider,
    error::AppResult,
    init_tracing,
    storage::{Database, QdrantClient, RedisStore},
};

#[derive(Debug, Parser)]
struct Args {
    #[arg(long, default_value_t = false, action = clap::ArgAction::Set)]
    once: bool,
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
    let qdrant = QdrantClient::new(
        &config.qdrant.url,
        &config.qdrant.collection,
        config.qdrant.vector_size,
    );
    qdrant.ensure_collection().await?;
    let embeddings = build_embedding_provider(&config.providers)?;

    loop {
        let ids = redis.pop_embedding_jobs(32, 5).await?;
        if ids.is_empty() {
            if args.once {
                break;
            }
            continue;
        }

        let mut seen = HashSet::new();
        let ids = ids
            .into_iter()
            .filter(|id| seen.insert(*id))
            .collect::<Vec<_>>();

        let chunks = database.get_chunks_by_ids(&ids).await?;
        if chunks.is_empty() {
            if args.once {
                break;
            }
            continue;
        }

        let texts = chunks
            .iter()
            .map(|chunk| chunk.content.clone())
            .collect::<Vec<_>>();
        let vectors = embeddings.embed_texts(&texts).await?;
        let chunk_ids = chunks.iter().map(|chunk| chunk.id).collect::<Vec<_>>();

        qdrant.upsert_chunks(&chunks, &vectors).await?;
        database.mark_chunks_embedded(&chunk_ids).await?;

        info!(count = chunk_ids.len(), provider = embeddings.name(), "indexed embeddings batch");

        if args.once {
            break;
        }
    }

    Ok(())
}
