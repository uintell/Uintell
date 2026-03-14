use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    domain::{Chunk, SourceType},
    error::{AppError, AppResult},
    retrieval::RankedChunk,
};

#[derive(Clone)]
pub struct QdrantClient {
    http: reqwest::Client,
    base_url: String,
    collection: String,
    vector_size: usize,
}

impl QdrantClient {
    pub fn new(base_url: &str, collection: &str, vector_size: usize) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_owned(),
            collection: collection.to_owned(),
            vector_size,
        }
    }

    pub async fn ensure_collection(&self) -> AppResult<()> {
        let url = format!("{}/collections/{}", self.base_url, self.collection);
        let response = self
            .http
            .put(url)
            .json(&json!({
                "vectors": {
                    "size": self.vector_size,
                    "distance": "Cosine",
                }
            }))
            .send()
            .await?;

        if response.status().is_success() || response.status() == StatusCode::CONFLICT {
            return Ok(());
        }

        let body = response.text().await.unwrap_or_default();
        Err(AppError::Qdrant(format!(
            "failed to ensure collection: {body}"
        )))
    }

    pub async fn healthcheck(&self) -> AppResult<()> {
        let url = format!("{}/collections", self.base_url);
        let response = self.http.get(url).send().await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::Qdrant(format!(
                "qdrant healthcheck failed with status {}",
                response.status()
            )))
        }
    }

    pub async fn upsert_chunks(&self, chunks: &[Chunk], vectors: &[Vec<f32>]) -> AppResult<()> {
        if chunks.is_empty() {
            return Ok(());
        }
        if chunks.len() != vectors.len() {
            return Err(AppError::Qdrant(String::from(
                "chunk/vector count mismatch during qdrant upsert",
            )));
        }

        let points = chunks
            .iter()
            .zip(vectors)
            .map(|(chunk, vector)| {
                json!({
                    "id": chunk.id.to_string(),
                    "vector": vector,
                    "payload": {
                        "chunk_id": chunk.id.to_string(),
                        "document_id": chunk.document_id.to_string(),
                        "source_type": chunk.source_type.as_str(),
                        "source_name": chunk.source_name,
                        "article_title": chunk.article_title,
                        "section_title": chunk.section_title,
                        "canonical_id": chunk.canonical_id,
                        "language": chunk.language,
                        "path_or_url": chunk.path_or_url,
                    }
                })
            })
            .collect::<Vec<_>>();

        let url = format!(
            "{}/collections/{}/points?wait=true",
            self.base_url, self.collection
        );
        let response = self
            .http
            .put(url)
            .json(&json!({ "points": points }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let body = response.text().await.unwrap_or_default();
            Err(AppError::Qdrant(format!("qdrant upsert failed: {body}")))
        }
    }

    pub async fn search(
        &self,
        vector: &[f32],
        filter: Option<SourceType>,
        limit: usize,
    ) -> AppResult<Vec<RankedChunk>> {
        if vector.is_empty() || vector.iter().all(|value| value.abs() < f32::EPSILON) {
            return Ok(Vec::new());
        }

        let filter_json = filter.map(|source_type| {
            json!({
                "must": [
                    {
                        "key": "source_type",
                        "match": { "value": source_type.as_str() }
                    }
                ]
            })
        });

        let url = format!(
            "{}/collections/{}/points/search",
            self.base_url, self.collection
        );
        let mut body = json!({
            "vector": vector,
            "limit": limit,
            "with_payload": false,
        });
        if let Some(filter_json) = filter_json {
            body["filter"] = filter_json;
        }

        let response = self.http.post(url).json(&body).send().await?;
        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Qdrant(format!("qdrant search failed: {body}")));
        }

        let payload = response.json::<QdrantSearchResponse>().await?;
        let hits = payload
            .result
            .into_iter()
            .filter_map(|point| {
                parse_point_id(&point.id)
                    .and_then(|value| Uuid::parse_str(&value).ok())
                    .map(|chunk_id| RankedChunk {
                        chunk_id,
                        score: point.score,
                    })
            })
            .collect();

        Ok(hits)
    }
}

fn parse_point_id(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(ToOwned::to_owned)
        .or_else(|| value.get("uuid").and_then(Value::as_str).map(ToOwned::to_owned))
}

#[derive(Debug, Deserialize)]
struct QdrantSearchResponse {
    result: Vec<QdrantPoint>,
}

#[derive(Debug, Deserialize, Serialize)]
struct QdrantPoint {
    id: Value,
    score: f32,
}
