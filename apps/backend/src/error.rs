use std::{io, num::TryFromIntError};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("configuration error: {0}")]
    Config(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("http client error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("xml parsing error: {0}")]
    Xml(#[from] quick_xml::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("tantivy error: {0}")]
    Tantivy(#[from] tantivy::TantivyError),
    #[error("task join error: {0}")]
    Join(#[from] tokio::task::JoinError),
    #[error("int conversion error: {0}")]
    Int(#[from] TryFromIntError),
    #[error("qdrant error: {0}")]
    Qdrant(String),
}

pub type AppResult<T> = Result<T, AppError>;
