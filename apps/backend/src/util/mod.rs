use std::{cmp::min, collections::HashSet};

use blake3::Hasher;
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use uuid::{Uuid, uuid};

pub const DOCUMENT_NAMESPACE: Uuid = uuid!("5b0b23d5-2ad6-4890-9db8-5485fcb5a503");
pub const CHUNK_NAMESPACE: Uuid = uuid!("c99d6632-721d-49b0-9376-d270c7646df6");

pub fn stable_document_id(canonical_id: &str) -> Uuid {
    Uuid::new_v5(&DOCUMENT_NAMESPACE, canonical_id.as_bytes())
}

pub fn stable_chunk_id(canonical_id: &str, chunk_index: usize) -> Uuid {
    let key = format!("{canonical_id}:{chunk_index}");
    Uuid::new_v5(&CHUNK_NAMESPACE, key.as_bytes())
}

pub fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn excerpt_from_start(content: &str, max_chars: usize) -> String {
    let collapsed = normalize_whitespace(content);
    if collapsed.len() <= max_chars {
        return collapsed;
    }

    let mut cutoff = max_chars;
    while cutoff > 0 && !collapsed.is_char_boundary(cutoff) {
        cutoff -= 1;
    }
    let prefix = collapsed[..cutoff].trim_end();
    format!("{prefix}…")
}

pub fn excerpt_for_query(content: &str, query: &str, max_chars: usize) -> String {
    let collapsed = normalize_whitespace(content);
    if collapsed.is_empty() {
        return String::new();
    }

    let query_terms = unique_terms(query);
    if query_terms.is_empty() {
        return excerpt_from_start(&collapsed, max_chars);
    }

    let lowercase = collapsed.to_lowercase();
    let first_match = query_terms
        .iter()
        .filter_map(|term| lowercase.find(term))
        .min();

    let Some(found_at) = first_match else {
        return excerpt_from_start(&collapsed, max_chars);
    };

    let window = max_chars / 2;
    let start = found_at.saturating_sub(window);
    let end = min(lowercase.len(), found_at + window);

    let mut bounded_start = start;
    while bounded_start > 0 && !collapsed.is_char_boundary(bounded_start) {
        bounded_start -= 1;
    }

    let mut bounded_end = end;
    while bounded_end < collapsed.len() && !collapsed.is_char_boundary(bounded_end) {
        bounded_end += 1;
    }

    let prefix = if bounded_start > 0 { "…" } else { "" };
    let suffix = if bounded_end < collapsed.len() { "…" } else { "" };
    format!(
        "{prefix}{}{suffix}",
        collapsed[bounded_start..bounded_end].trim()
    )
}

pub fn token_count(value: &str) -> i32 {
    value.split_whitespace().count() as i32
}

pub fn tokenize(value: &str) -> Vec<String> {
    unique_terms(value)
}

pub fn wikipedia_article_url(title: &str) -> String {
    let article = title.replace(' ', "_");
    format!(
        "https://en.wikipedia.org/wiki/{}",
        utf8_percent_encode(&article, NON_ALPHANUMERIC)
    )
}

pub fn cache_key(prefix: &str, payload: &str) -> String {
    let mut hasher = Hasher::new();
    hasher.update(payload.as_bytes());
    format!("{prefix}:{}", hasher.finalize().to_hex())
}

pub fn unique_terms(value: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    value
        .split(|c: char| !c.is_alphanumeric())
        .map(|term| term.trim().to_lowercase())
        .filter(|term| term.len() > 1)
        .filter(|term| seen.insert(term.clone()))
        .collect()
}

pub fn truncate(value: &str, max_chars: usize) -> String {
    if value.len() <= max_chars {
        return value.to_owned();
    }

    let mut cutoff = max_chars;
    while cutoff > 0 && !value.is_char_boundary(cutoff) {
        cutoff -= 1;
    }

    format!("{}…", value[..cutoff].trim_end())
}
