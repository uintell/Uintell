use tracing::info;

use sourcepedia_backend::{
    config::AppConfig,
    error::AppResult,
    init_tracing,
    storage::{Database, TantivyIndexManager},
};

#[tokio::main]
async fn main() -> AppResult<()> {
    init_tracing();
    let config = AppConfig::from_env()?;

    let database = Database::connect(&config.database_url).await?;
    database.migrate().await?;
    let index = TantivyIndexManager::open_or_create(&config.indexing.tantivy_index_dir)?;
    let mut writer = index.create_writer()?;
    index.clear(&mut writer)?;

    let batch_size = 500_i64;
    let mut offset = 0_i64;
    let mut indexed = 0usize;

    loop {
        let chunks = database.list_chunks_page(offset, batch_size).await?;
        if chunks.is_empty() {
            break;
        }

        indexed += chunks.len();
        index.add_chunks(&mut writer, &chunks)?;
        offset += i64::try_from(chunks.len())?;
        info!(indexed, "indexed chunk batch into tantivy");
    }

    index.commit(writer)?;
    info!(indexed, "finished rebuilding tantivy index");
    Ok(())
}
