use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use serde::Deserialize;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use uuid::Uuid;

use crate::{
    api::{ApiError, ApiState},
    domain::{AnswerMode, AnswerQuery, SearchQuery, SourceFilter},
};

pub fn build_router(state: ApiState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/document/{id}", get(document))
        .route("/search", post(search))
        .route("/answer", post(answer))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health(State(state): State<ApiState>) -> Json<crate::domain::HealthReport> {
    Json(state.search_service.health().await)
}

async fn document(
    Path(id): Path<Uuid>,
    State(state): State<ApiState>,
) -> Result<Json<crate::domain::DocumentBundle>, ApiError> {
    let bundle = state
        .search_service
        .get_document_bundle(id)
        .await?
        .ok_or_else(|| ApiError(crate::error::AppError::NotFound(format!("document {id}"))))?;

    Ok(Json(bundle))
}

async fn search(
    State(state): State<ApiState>,
    Json(body): Json<SearchRequestBody>,
) -> Result<Json<crate::domain::SearchResponseData>, ApiError> {
    let response = state
        .search_service
        .search(SearchQuery {
            query: body.query,
            filter: body.filter.unwrap_or_default(),
            limit: body.limit.unwrap_or_else(|| state.search_service.default_limit()),
        })
        .await?;

    Ok(Json(response))
}

async fn answer(
    State(state): State<ApiState>,
    Json(body): Json<AnswerRequestBody>,
) -> Result<Json<crate::domain::AnswerResponseData>, ApiError> {
    let response = state
        .answer_service
        .answer(AnswerQuery {
            question: body.question,
            filter: body.filter.unwrap_or_default(),
            mode: body.mode.unwrap_or_default(),
            limit: body.limit.unwrap_or_else(|| state.search_service.default_limit()),
        })
        .await?;

    Ok(Json(response))
}

#[derive(Debug, Deserialize)]
struct SearchRequestBody {
    query: String,
    filter: Option<SourceFilter>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct AnswerRequestBody {
    question: String,
    filter: Option<SourceFilter>,
    mode: Option<AnswerMode>,
    limit: Option<usize>,
}
