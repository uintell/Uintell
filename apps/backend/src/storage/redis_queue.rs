use redis::{AsyncCommands, aio::ConnectionManager};
use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Clone)]
pub struct RedisStore {
    connection: ConnectionManager,
    queue_key: String,
    cache_ttl_seconds: u64,
}

impl RedisStore {
    pub async fn connect(url: &str, queue_key: String, cache_ttl_seconds: u64) -> AppResult<Self> {
        let client = redis::Client::open(url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(Self {
            connection,
            queue_key,
            cache_ttl_seconds,
        })
    }

    pub async fn healthcheck(&self) -> AppResult<()> {
        let mut connection = self.connection.clone();
        let _: String = redis::cmd("PING").query_async(&mut connection).await?;
        Ok(())
    }

    pub async fn cache_get<T: DeserializeOwned>(&self, key: &str) -> AppResult<Option<T>> {
        let mut connection = self.connection.clone();
        let payload: Option<String> = connection.get(key).await?;
        payload
            .map(|value| serde_json::from_str::<T>(&value))
            .transpose()
            .map_err(Into::into)
    }

    pub async fn cache_set<T: Serialize>(&self, key: &str, value: &T) -> AppResult<()> {
        let mut connection = self.connection.clone();
        let payload = serde_json::to_string(value)?;
        let _: () = connection
            .set_ex(key, payload, self.cache_ttl_seconds)
            .await?;
        Ok(())
    }

    pub async fn enqueue_embedding_jobs(&self, ids: &[Uuid]) -> AppResult<()> {
        if ids.is_empty() {
            return Ok(());
        }

        let mut connection = self.connection.clone();
        let values = ids.iter().map(Uuid::to_string).collect::<Vec<_>>();
        let _: usize = connection.rpush(&self.queue_key, values).await?;
        Ok(())
    }

    pub async fn pop_embedding_jobs(
        &self,
        max_items: usize,
        timeout_seconds: usize,
    ) -> AppResult<Vec<Uuid>> {
        let mut connection = self.connection.clone();
        let first: Option<(String, String)> = redis::cmd("BRPOP")
            .arg(&self.queue_key)
            .arg(timeout_seconds)
            .query_async(&mut connection)
            .await?;

        let Some((_, item)) = first else {
            return Ok(Vec::new());
        };

        let mut ids = vec![Uuid::parse_str(&item).map_err(|err| {
            redis::RedisError::from((redis::ErrorKind::TypeError, "invalid uuid", err.to_string()))
        })?];

        while ids.len() < max_items {
            let next: Option<String> = redis::cmd("LPOP")
                .arg(&self.queue_key)
                .query_async(&mut connection)
                .await?;

            let Some(item) = next else {
                break;
            };

            ids.push(Uuid::parse_str(&item).map_err(|err| {
                redis::RedisError::from((redis::ErrorKind::TypeError, "invalid uuid", err.to_string()))
            })?);
        }

        Ok(ids)
    }
}
