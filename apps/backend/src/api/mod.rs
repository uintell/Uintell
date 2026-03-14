mod routes;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

use crate::{
    error::AppError,
    services::{AnswerService, SearchService},
};

pub use routes::build_router;

#[derive(Clone)]
pub struct ApiState {
    pub search_service: SearchService,
    pub answer_service: AnswerService,
}

pub struct ApiError(pub AppError);

impl From<AppError> for ApiError {
    fn from(value: AppError) -> Self {
        Self(value)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self.0 {
            AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let payload = Json(ApiErrorBody {
            error: self.0.to_string(),
        });
        (status, payload).into_response()
    }
}

#[derive(Serialize)]
struct ApiErrorBody {
    error: String,
}
