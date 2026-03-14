use serde_json::json;

use crate::{
    domain::{Chunk, Document, Section},
    error::AppResult,
    util::normalize_whitespace,
};

#[derive(Debug, Clone, Copy)]
pub struct ChunkingConfig {
    pub max_chars: usize,
    pub overlap_chars: usize,
}

pub fn chunk_document(document: &Document, config: ChunkingConfig) -> AppResult<Vec<Chunk>> {
    let sections = if document.sections.is_empty() {
        vec![Section {
            title: Some(String::from("Overview")),
            heading_path: Vec::new(),
            content: document.body_text.clone(),
            metadata: json!({}),
        }]
    } else {
        document.sections.clone()
    };

    let mut chunk_index = 0usize;
    let mut chunks = Vec::new();

    for section in sections {
        let prefix = section
            .title
            .as_ref()
            .map(|title| format!("{title}\n\n"))
            .unwrap_or_default();
        let segments = split_with_overlap(&section.content, config.max_chars, config.overlap_chars);

        for segment in segments {
            let segment = normalize_whitespace(&segment);
            if segment.is_empty() {
                continue;
            }

            let content = format!("{prefix}{segment}");
            chunks.push(Chunk::from_document_section(
                document,
                &section,
                chunk_index,
                content,
            )?);
            chunk_index += 1;
        }
    }

    Ok(chunks)
}

fn split_with_overlap(text: &str, max_chars: usize, overlap_chars: usize) -> Vec<String> {
    let content = text.trim();
    if content.is_empty() {
        return Vec::new();
    }

    if content.len() <= max_chars {
        return vec![content.to_owned()];
    }

    let mut chunks = Vec::new();
    let mut start = 0usize;

    while start < content.len() {
        let mut end = (start + max_chars).min(content.len());
        end = floor_char_boundary(content, end);

        if end < content.len() {
            let candidate = &content[start..end];
            if let Some(last_break) = candidate.rfind(char::is_whitespace) {
                let preferred = start + last_break;
                if preferred > start + max_chars / 2 {
                    end = preferred;
                }
            }
        }

        let slice = content[start..end].trim();
        if !slice.is_empty() {
            chunks.push(slice.to_owned());
        }

        if end >= content.len() {
            break;
        }

        let next = end.saturating_sub(overlap_chars);
        let next = floor_char_boundary(content, next);
        if next <= start {
            break;
        }
        start = next;
    }

    chunks
}

fn floor_char_boundary(text: &str, mut index: usize) -> usize {
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

#[cfg(test)]
mod tests {
    use super::{ChunkingConfig, chunk_document};
    use crate::domain::{Document, Section, SourceType};
    use serde_json::json;

    #[test]
    fn chunks_with_overlap() {
        let document = Document::new(
            String::from("demo:test"),
            SourceType::Wikipedia,
            "Demo Source",
            "Demo Article",
            "en",
            "demo://article",
            "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
            vec![Section {
                title: Some(String::from("Overview")),
                heading_path: vec![String::from("Overview")],
                content: String::from(
                    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
                ),
                metadata: json!({}),
            }],
            Vec::new(),
            json!({}),
        );

        let chunks = chunk_document(
            &document,
            ChunkingConfig {
                max_chars: 24,
                overlap_chars: 8,
            },
        )
        .unwrap();

        assert!(chunks.len() >= 2);
        assert!(chunks[0].content.contains("Overview"));
    }
}
