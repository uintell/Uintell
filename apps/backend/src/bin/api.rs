use axum::Router;
use tokio::{net::TcpListener, signal};
use tracing::info;

use sourcepedia_backend::{
    answering::build_answer_composer,
    api::{ApiState, build_router},
    config::AppConfig,
    embedding::build_embedding_provider,
    error::AppResult,
    init_tracing,
    services::{AnswerService, SearchService},
    storage::{Database, QdrantClient, RedisStore, TantivyIndexManager},
};

#[tokio::main]
async fn main() -> AppResult<()> {
    init_tracing();
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
    let tantivy = TantivyIndexManager::open_or_create(&config.indexing.tantivy_index_dir)?;
    let embeddings = build_embedding_provider(&config.providers)?;
    let composer = build_answer_composer(&config.providers)?;

    let search_service = SearchService::new(
        database,
        redis,
        qdrant,
        tantivy,
        embeddings,
        config.retrieval.clone(),
    );
    let answer_service = AnswerService::new(search_service.clone(), composer);
    let state = ApiState {
        search_service,
        answer_service,
    };

    let app: Router = build_router(state);
    let listener = TcpListener::bind(config.server.bind_addr).await?;
    info!(address = %config.server.bind_addr, "api server listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(Into::into)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("installing ctrl-c handler should succeed");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("installing SIGTERM handler should succeed")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}
