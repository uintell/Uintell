use sourcepedia_backend::{config::AppConfig, error::AppResult, init_tracing, storage::Database};

#[tokio::main]
async fn main() -> AppResult<()> {
    init_tracing();
    let config = AppConfig::from_env()?;
    let database = Database::connect(&config.database_url).await?;
    database.migrate().await?;
    Ok(())
}
