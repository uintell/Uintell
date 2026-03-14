pub mod answering;
pub mod api;
pub mod config;
pub mod domain;
pub mod embedding;
pub mod error;
pub mod ingest;
pub mod retrieval;
pub mod services;
pub mod storage;
pub mod util;

use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

pub fn init_tracing() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=info".into()))
        .with(fmt::layer())
        .init();
}
