use std::{collections::HashMap, sync::Arc};

use tracing::warn;
use uuid::Uuid;

use crate::{
    answering::DynAnswerComposer,
    config::RetrievalConfig,
    domain::{
        AnswerQuery, AnswerResponseData, HealthCheck, HealthReport, SearchQuery, SearchResponseData,
        SearchResultItem,
    },
    embedding::DynEmbeddingProvider,
    error::AppResult,
    retrieval::reciprocal_rank_fusion,
    storage::{Database, QdrantClient, RedisStore, TantivyIndexManager},
    util::{cache_key, excerpt_for_query},
};

#[derive(Clone)]
pub struct SearchService {
    database: Database,
    redis: RedisStore,
    qdrant: QdrantClient,
    tantivy: TantivyIndexManager,
    embeddings: DynEmbeddingProvider,
    retrieval: RetrievalConfig,
}

#[derive(Clone)]
pub struct AnswerService {
    search: SearchService,
    composer: DynAnswerComposer,
}

impl SearchService {
    pub fn new(
        database: Database,
        redis: RedisStore,
        qdrant: QdrantClient,
        tantivy: TantivyIndexManager,
        embeddings: DynEmbeddingProvider,
        retrieval: RetrievalConfig,
    ) -> Self {
        Self {
            database,
            redis,
            qdrant,
            tantivy,
            embeddings,
            retrieval,
        }
    }

    pub fn default_limit(&self) -> usize {
        self.retrieval.search_result_limit
    }

    pub async fn search(&self, query: SearchQuery) -> AppResult<SearchResponseData> {
        query.validate()?;
        let cache_payload = format!(
            "{}:{}:{}",
            query.filter as u8, query.limit, query.query
        );
        let cache_key = cache_key("search", &cache_payload);
        if let Ok(Some(mut cached)) = self.redis.cache_get::<SearchResponseData>(&cache_key).await {
            cached.cached = true;
            return Ok(cached);
        }

        let keyword_hits = self.tantivy.search(
            &query.query,
            query.filter.source_type(),
            self.retrieval.tantivy_search_limit.max(query.limit),
        )?;

        let semantic_hits = self.semantic_hits(&query).await;
        let fused = reciprocal_rank_fusion(
            &keyword_hits,
            &semantic_hits,
            self.retrieval
                .search_result_limit
                .max(query.limit)
                .max(1),
        );

        let ids = fused.iter().map(|hit| hit.chunk_id).collect::<Vec<_>>();
        let chunks = self.database.get_chunks_by_ids(&ids).await?;
        let chunk_map = chunks
            .into_iter()
            .map(|chunk| (chunk.id, chunk))
            .collect::<HashMap<Uuid, _>>();

        let results = fused
            .into_iter()
            .filter_map(|hit| {
                let chunk = chunk_map.get(&hit.chunk_id)?;
                Some(SearchResultItem {
                    chunk_id: chunk.id,
                    document_id: chunk.document_id,
                    source_type: chunk.source_type,
                    source_name: chunk.source_name.clone(),
                    article_title: chunk.article_title.clone(),
                    section_title: chunk.section_title.clone(),
                    canonical_id: chunk.canonical_id.clone(),
                    language: chunk.language.clone(),
                    path_or_url: chunk.path_or_url.clone(),
                    excerpt: excerpt_for_query(&chunk.content, &query.query, 260),
                    content: chunk.content.clone(),
                    keyword_score: hit.keyword_score,
                    semantic_score: hit.semantic_score,
                    combined_score: hit.combined_score,
                })
            })
            .take(query.limit)
            .collect::<Vec<_>>();

        let response = SearchResponseData {
            query: query.query,
            filter: query.filter,
            cached: false,
            results,
        };

        if let Err(error) = self.redis.cache_set(&cache_key, &response).await {
            warn!(?error, "failed to cache search response");
        }

        Ok(response)
    }

    pub async fn get_document_bundle(
        &self,
        document_id: Uuid,
    ) -> AppResult<Option<crate::domain::DocumentBundle>> {
        self.database.get_document_bundle(document_id).await
    }

    pub async fn health(&self) -> HealthReport {
        let db_check = self.database.healthcheck().await;
        let redis_check = self.redis.healthcheck().await;
        let qdrant_check = self.qdrant.healthcheck().await;

        let checks = vec![
            HealthCheck {
                component: String::from("postgres"),
                healthy: db_check.is_ok(),
                detail: db_check
                    .map(|_| String::from("ok"))
                    .unwrap_or_else(|error| error.to_string()),
            },
            HealthCheck {
                component: String::from("redis"),
                healthy: redis_check.is_ok(),
                detail: redis_check
                    .map(|_| String::from("ok"))
                    .unwrap_or_else(|error| error.to_string()),
            },
            HealthCheck {
                component: String::from("qdrant"),
                healthy: qdrant_check.is_ok(),
                detail: qdrant_check
                    .map(|_| String::from("ok"))
                    .unwrap_or_else(|error| error.to_string()),
            },
            HealthCheck {
                component: String::from("tantivy"),
                healthy: true,
                detail: String::from("loaded"),
            },
        ];
        let status = if checks.iter().all(|check| check.healthy) {
            "ok"
        } else {
            "degraded"
        };

        HealthReport {
            status: status.to_owned(),
            checks,
        }
    }

    async fn semantic_hits(&self, query: &SearchQuery) -> Vec<crate::retrieval::RankedChunk> {
        let Ok(mut embeddings) = self
            .embeddings
            .embed_texts(&[query.query.clone()])
            .await else {
            warn!("embedding generation failed; serving keyword-only results");
            return Vec::new();
        };

        let Some(vector) = embeddings.pop() else {
            return Vec::new();
        };

        match self
            .qdrant
            .search(
                &vector,
                query.filter.source_type(),
                self.retrieval.qdrant_search_limit.max(query.limit),
            )
            .await
        {
            Ok(results) => results,
            Err(error) => {
                warn!(?error, "semantic search failed; serving keyword-only results");
                Vec::new()
            }
        }
    }
}

impl AnswerService {
    pub fn new(search: SearchService, composer: DynAnswerComposer) -> Self {
        Self { search, composer }
    }

    pub async fn answer(&self, query: AnswerQuery) -> AppResult<AnswerResponseData> {
        query.validate()?;
        let cache_payload = format!(
            "{}:{}:{}:{}",
            query.filter as u8, query.mode as u8, query.limit, query.question
        );
        let cache_key = cache_key("answer", &cache_payload);
        if let Ok(Some(mut cached)) = self.redis().cache_get::<AnswerResponseData>(&cache_key).await {
            cached.cached = true;
            return Ok(cached);
        }

        let search_response = self
            .search
            .search(SearchQuery {
                query: query.question.clone(),
                filter: query.filter,
                limit: query.limit,
            })
            .await?;

        let mut answer = self
            .composer
            .compose(&query.question, query.mode, &search_response.results)
            .await?;
        answer.cached = false;

        if let Err(error) = self.redis().cache_set(&cache_key, &answer).await {
            warn!(?error, "failed to cache answer response");
        }

        Ok(answer)
    }

    pub fn redis(&self) -> &RedisStore {
        &self.search.redis
    }
}

impl From<&SearchService> for Arc<SearchService> {
    fn from(value: &SearchService) -> Self {
        Arc::new(value.clone())
    }
}
