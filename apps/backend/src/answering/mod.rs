use std::{collections::HashMap, sync::Arc};

use async_trait::async_trait;

use crate::{
    config::{AnswerProviderKind, ProviderConfig},
    domain::{AnswerMode, AnswerResponseData, Citation, SearchResultItem},
    error::AppResult,
    util::{excerpt_from_start, normalize_whitespace, unique_terms},
};

pub type DynAnswerComposer = Arc<dyn AnswerComposer>;

#[async_trait]
pub trait AnswerComposer: Send + Sync {
    fn name(&self) -> &'static str;
    async fn compose(
        &self,
        question: &str,
        mode: AnswerMode,
        retrieved: &[SearchResultItem],
    ) -> AppResult<AnswerResponseData>;
}

#[derive(Debug, Default)]
pub struct ExtractiveAnswerComposer;

#[async_trait]
impl AnswerComposer for ExtractiveAnswerComposer {
    fn name(&self) -> &'static str {
        "extractive"
    }

    async fn compose(
        &self,
        question: &str,
        mode: AnswerMode,
        retrieved: &[SearchResultItem],
    ) -> AppResult<AnswerResponseData> {
        let cited_sources = retrieved
            .iter()
            .take(mode.max_sources())
            .cloned()
            .collect::<Vec<_>>();

        let mut citation_map = HashMap::new();
        let citations = cited_sources
            .iter()
            .enumerate()
            .map(|(index, result)| {
                let citation_index = index + 1;
                citation_map.insert(result.chunk_id, citation_index);
                Citation {
                    index: citation_index,
                    chunk_id: result.chunk_id,
                    document_id: result.document_id,
                    source_type: result.source_type,
                    article_title: result.article_title.clone(),
                    section_title: result.section_title.clone(),
                    path_or_url: result.path_or_url.clone(),
                    excerpt: excerpt_from_start(&result.content, 220),
                }
            })
            .collect::<Vec<_>>();

        let mut answer_lines = Vec::new();
        let mut seen_claims = std::collections::HashSet::new();
        let query_terms = unique_terms(question);

        for result in &cited_sources {
            let Some(citation_index) = citation_map.get(&result.chunk_id).copied() else {
                continue;
            };

            let sentences = split_sentences(&result.content);
            let candidate = sentences
                .iter()
                .find(|sentence| sentence_matches_question(sentence, &query_terms))
                .or_else(|| sentences.first());

            let Some(sentence) = candidate else {
                continue;
            };

            let cleaned = normalize_whitespace(sentence);
            if cleaned.len() < 32 {
                continue;
            }

            let fingerprint = cleaned.to_lowercase();
            if !seen_claims.insert(fingerprint) {
                continue;
            }

            answer_lines.push(format!("- {} [{}]", cleaned, citation_index));
            if answer_lines.len() >= mode.max_claims() {
                break;
            }
        }

        let insufficient_evidence = answer_lines.len() < 2;
        if answer_lines.is_empty() {
            answer_lines.push(String::from(
                "Insufficient evidence in the indexed sources to answer this confidently. Review the cited excerpts below.",
            ));
        } else if insufficient_evidence {
            answer_lines.insert(
                0,
                String::from(
                    "Evidence is limited. The points below are grounded in the retrieved sources, but coverage is incomplete.",
                ),
            );
        }

        Ok(AnswerResponseData {
            question: question.to_owned(),
            mode,
            insufficient_evidence,
            answer_markdown: answer_lines.join("\n"),
            citations,
            sources: cited_sources,
            cached: false,
        })
    }
}

pub fn build_answer_composer(config: &ProviderConfig) -> AppResult<DynAnswerComposer> {
    let composer: DynAnswerComposer = match config.answer_provider {
        AnswerProviderKind::Extractive => Arc::new(ExtractiveAnswerComposer),
    };

    Ok(composer)
}

fn split_sentences(text: &str) -> Vec<String> {
    text.split_terminator(['.', '!', '?', '\n'])
        .map(str::trim)
        .filter(|sentence| !sentence.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn sentence_matches_question(sentence: &str, query_terms: &[String]) -> bool {
    if query_terms.is_empty() {
        return true;
    }

    let lowercase = sentence.to_lowercase();
    query_terms
        .iter()
        .any(|term| lowercase.contains(term.as_str()))
}
