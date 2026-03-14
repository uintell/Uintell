use std::{env, net::SocketAddr, path::PathBuf, str::FromStr};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database_url: String,
    pub redis: RedisConfig,
    pub qdrant: QdrantConfig,
    pub sources: SourceConfig,
    pub indexing: IndexingConfig,
    pub retrieval: RetrievalConfig,
    pub providers: ProviderConfig,
    pub demo_fixture_path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub bind_addr: SocketAddr,
}

#[derive(Debug, Clone)]
pub struct RedisConfig {
    pub url: String,
    pub embed_queue_key: String,
    pub cache_ttl_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct QdrantConfig {
    pub url: String,
    pub collection: String,
    pub vector_size: usize,
}

#[derive(Debug, Clone)]
pub struct SourceConfig {
    pub wikipedia_dump_path: PathBuf,
    pub archwiki_html_dir: PathBuf,
}

#[derive(Debug, Clone)]
pub struct IndexingConfig {
    pub tantivy_index_dir: PathBuf,
    pub chunk_size_chars: usize,
    pub chunk_overlap_chars: usize,
}

#[derive(Debug, Clone)]
pub struct RetrievalConfig {
    pub search_result_limit: usize,
    pub tantivy_search_limit: usize,
    pub qdrant_search_limit: usize,
}

#[derive(Debug, Clone)]
pub struct ProviderConfig {
    pub embedding_provider: EmbeddingProviderKind,
    pub answer_provider: AnswerProviderKind,
    pub vector_size: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmbeddingProviderKind {
    Hash,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnswerProviderKind {
    Extractive,
}

impl AppConfig {
    pub fn from_env() -> AppResult<Self> {
        let bind_addr = parse_socket_addr("API_BIND_ADDR", "0.0.0.0:8080")?;
        let database_url = env_string("DATABASE_URL", "postgres://encyclopedia:encyclopedia@localhost:5432/encyclopedia");
        let redis_url = env_string("REDIS_URL", "redis://127.0.0.1:6379");
        let redis_embed_queue_key =
            env_string("REDIS_EMBED_QUEUE_KEY", "sourcepedia:embedding_jobs");
        let redis_cache_ttl_seconds = env_usize("REDIS_CACHE_TTL_SECONDS", 120)? as u64;
        let qdrant_url = env_string("QDRANT_URL", "http://127.0.0.1:6333");
        let qdrant_collection = env_string("QDRANT_COLLECTION", "sourcepedia_chunks");
        let qdrant_vector_size = env_usize("QDRANT_VECTOR_SIZE", 256)?;
        let embedding_provider =
            EmbeddingProviderKind::from_str(&env_string("EMBEDDING_PROVIDER", "hash"))?;
        let answer_provider =
            AnswerProviderKind::from_str(&env_string("LLM_PROVIDER", "extractive"))?;

        Ok(Self {
            server: ServerConfig { bind_addr },
            database_url,
            redis: RedisConfig {
                url: redis_url,
                embed_queue_key: redis_embed_queue_key,
                cache_ttl_seconds: redis_cache_ttl_seconds,
            },
            qdrant: QdrantConfig {
                url: qdrant_url,
                collection: qdrant_collection,
                vector_size: qdrant_vector_size,
            },
            sources: SourceConfig {
                wikipedia_dump_path: PathBuf::from(env_string(
                    "WIKIPEDIA_DUMP_PATH",
                    "enwiki-latest-pages-articles-multistream.xml.bz2",
                )),
                archwiki_html_dir: PathBuf::from(env_string(
                    "ARCHWIKI_HTML_DIR",
                    "/usr/share/doc/arch-wiki/html/en",
                )),
            },
            indexing: IndexingConfig {
                tantivy_index_dir: PathBuf::from(env_string("TANTIVY_INDEX_DIR", "var/tantivy")),
                chunk_size_chars: env_usize("CHUNK_SIZE_CHARS", 1_400)?,
                chunk_overlap_chars: env_usize("CHUNK_OVERLAP_CHARS", 180)?,
            },
            retrieval: RetrievalConfig {
                search_result_limit: env_usize("SEARCH_RESULT_LIMIT", 8)?,
                tantivy_search_limit: env_usize("TANTIVY_SEARCH_LIMIT", 16)?,
                qdrant_search_limit: env_usize("QDRANT_SEARCH_LIMIT", 16)?,
            },
            providers: ProviderConfig {
                embedding_provider,
                answer_provider,
                vector_size: qdrant_vector_size,
            },
            demo_fixture_path: PathBuf::from(env_string(
                "DEMO_FIXTURE_PATH",
                "data/demo/documents.json",
            )),
        })
    }
}

impl FromStr for EmbeddingProviderKind {
    type Err = AppError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_lowercase().as_str() {
            "hash" => Ok(Self::Hash),
            other => Err(AppError::Config(format!(
                "unsupported embedding provider: {other}"
            ))),
        }
    }
}

impl FromStr for AnswerProviderKind {
    type Err = AppError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_lowercase().as_str() {
            "extractive" => Ok(Self::Extractive),
            other => Err(AppError::Config(format!(
                "unsupported answer provider: {other}"
            ))),
        }
    }
}

fn env_string(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_owned())
}

fn env_usize(key: &str, default: usize) -> AppResult<usize> {
    env::var(key)
        .ok()
        .map(|value| {
            value
                .parse::<usize>()
                .map_err(|_| AppError::Config(format!("invalid usize value for {key}: {value}")))
        })
        .transpose()?
        .map(Ok)
        .unwrap_or(Ok(default))
}

fn parse_socket_addr(key: &str, default: &str) -> AppResult<SocketAddr> {
    env::var(key)
        .unwrap_or_else(|_| default.to_owned())
        .parse::<SocketAddr>()
        .map_err(|_| AppError::Config(format!("invalid socket address for {key}")))
}
