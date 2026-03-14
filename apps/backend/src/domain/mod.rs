use std::{fmt, str::FromStr};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    util::{stable_chunk_id, stable_document_id, token_count},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    Wikipedia,
    ArchWiki,
}

impl SourceType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Wikipedia => "wikipedia",
            Self::ArchWiki => "arch_wiki",
        }
    }
}

impl fmt::Display for SourceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for SourceType {
    type Err = AppError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "wikipedia" => Ok(Self::Wikipedia),
            "arch_wiki" => Ok(Self::ArchWiki),
            other => Err(AppError::InvalidInput(format!(
                "unknown source type: {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceFilter {
    All,
    Wikipedia,
    ArchWiki,
}

impl Default for SourceFilter {
    fn default() -> Self {
        Self::All
    }
}

impl SourceFilter {
    pub fn source_type(self) -> Option<SourceType> {
        match self {
            Self::All => None,
            Self::Wikipedia => Some(SourceType::Wikipedia),
            Self::ArchWiki => Some(SourceType::ArchWiki),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnswerMode {
    Concise,
    Normal,
    Deep,
}

impl Default for AnswerMode {
    fn default() -> Self {
        Self::Normal
    }
}

impl AnswerMode {
    pub fn max_claims(self) -> usize {
        match self {
            Self::Concise => 2,
            Self::Normal => 4,
            Self::Deep => 6,
        }
    }

    pub fn max_sources(self) -> usize {
        match self {
            Self::Concise => 3,
            Self::Normal => 5,
            Self::Deep => 8,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub title: Option<String>,
    pub heading_path: Vec<String>,
    pub content: String,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub canonical_id: String,
    pub source_type: SourceType,
    pub source_name: String,
    pub article_title: String,
    pub language: String,
    pub path_or_url: String,
    pub source_revision: Option<String>,
    pub summary: Option<String>,
    pub body_text: String,
    pub sections: Vec<Section>,
    pub categories: Vec<String>,
    pub metadata: Value,
}

impl Document {
    pub fn new(
        canonical_id: String,
        source_type: SourceType,
        source_name: impl Into<String>,
        article_title: impl Into<String>,
        language: impl Into<String>,
        path_or_url: impl Into<String>,
        body_text: impl Into<String>,
        sections: Vec<Section>,
        categories: Vec<String>,
        metadata: Value,
    ) -> Self {
        let canonical_id = canonical_id;
        Self {
            id: stable_document_id(&canonical_id),
            canonical_id,
            source_type,
            source_name: source_name.into(),
            article_title: article_title.into(),
            language: language.into(),
            path_or_url: path_or_url.into(),
            source_revision: None,
            summary: None,
            body_text: body_text.into(),
            sections,
            categories,
            metadata,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    pub id: Uuid,
    pub document_id: Uuid,
    pub canonical_id: String,
    pub source_type: SourceType,
    pub source_name: String,
    pub article_title: String,
    pub section_title: Option<String>,
    pub heading_path: Vec<String>,
    pub language: String,
    pub path_or_url: String,
    pub chunk_index: i32,
    pub content: String,
    pub token_count: i32,
    pub metadata: Value,
    pub embedding_status: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

impl Chunk {
    pub fn from_document_section(document: &Document, section: &Section, chunk_index: usize, content: String) -> AppResult<Self> {
        Ok(Self {
            id: stable_chunk_id(&document.canonical_id, chunk_index),
            document_id: document.id,
            canonical_id: document.canonical_id.clone(),
            source_type: document.source_type,
            source_name: document.source_name.clone(),
            article_title: document.article_title.clone(),
            section_title: section.title.clone(),
            heading_path: section.heading_path.clone(),
            language: document.language.clone(),
            path_or_url: document.path_or_url.clone(),
            chunk_index: i32::try_from(chunk_index)?,
            token_count: token_count(&content),
            content,
            metadata: section.metadata.clone(),
            embedding_status: String::from("pending"),
            created_at: None,
            updated_at: None,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentBundle {
    pub document: Document,
    pub chunks: Vec<Chunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub filter: SourceFilter,
    pub limit: usize,
}

impl SearchQuery {
    pub fn validate(&self) -> AppResult<()> {
        if self.query.trim().is_empty() {
            return Err(AppError::InvalidInput(String::from(
                "query must not be empty",
            )));
        }

        if self.limit == 0 {
            return Err(AppError::InvalidInput(String::from(
                "limit must be greater than zero",
            )));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerQuery {
    pub question: String,
    pub filter: SourceFilter,
    pub mode: AnswerMode,
    pub limit: usize,
}

impl AnswerQuery {
    pub fn validate(&self) -> AppResult<()> {
        if self.question.trim().is_empty() {
            return Err(AppError::InvalidInput(String::from(
                "question must not be empty",
            )));
        }

        if self.limit == 0 {
            return Err(AppError::InvalidInput(String::from(
                "limit must be greater than zero",
            )));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub chunk_id: Uuid,
    pub document_id: Uuid,
    pub source_type: SourceType,
    pub source_name: String,
    pub article_title: String,
    pub section_title: Option<String>,
    pub canonical_id: String,
    pub language: String,
    pub path_or_url: String,
    pub excerpt: String,
    pub content: String,
    pub keyword_score: Option<f32>,
    pub semantic_score: Option<f32>,
    pub combined_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponseData {
    pub query: String,
    pub filter: SourceFilter,
    pub cached: bool,
    pub results: Vec<SearchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    pub index: usize,
    pub chunk_id: Uuid,
    pub document_id: Uuid,
    pub source_type: SourceType,
    pub article_title: String,
    pub section_title: Option<String>,
    pub path_or_url: String,
    pub excerpt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerResponseData {
    pub question: String,
    pub mode: AnswerMode,
    pub insufficient_evidence: bool,
    pub answer_markdown: String,
    pub citations: Vec<Citation>,
    pub sources: Vec<SearchResultItem>,
    pub cached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub component: String,
    pub healthy: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthReport {
    pub status: String,
    pub checks: Vec<HealthCheck>,
}
