use std::{fs::File, path::Path};

use bzip2::read::MultiBzDecoder;
use quick_xml::{Reader, events::Event};
use serde_json::json;
use tokio::sync::mpsc::Sender;
use tracing::warn;

use crate::{
    domain::{Document, Section, SourceType},
    error::AppResult,
    util::{excerpt_from_start, normalize_whitespace, wikipedia_article_url},
};

#[derive(Debug, Default, Clone, Copy)]
pub struct IngestStats {
    pub documents_seen: usize,
    pub documents_emitted: usize,
}

pub fn stream_file(
    path: &Path,
    limit: Option<usize>,
    sender: Sender<AppResult<Document>>,
) -> AppResult<IngestStats> {
    let file = File::open(path)?;
    let decoder = MultiBzDecoder::new(file);
    let mut reader = Reader::from_reader(std::io::BufReader::new(decoder));
    reader.config_mut().trim_text(true);

    let mut stats = IngestStats::default();
    let mut buf = Vec::new();
    let mut in_revision = false;
    let mut capture_tag: Option<CaptureTag> = None;

    let mut title = String::new();
    let mut namespace = String::new();
    let mut page_id: Option<String> = None;
    let mut revision_id: Option<String> = None;
    let mut text = String::new();
    let mut redirect_target: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buf)? {
            Event::Start(ref event) if event.name().as_ref() == b"page" => {
                title.clear();
                namespace.clear();
                page_id = None;
                revision_id = None;
                text.clear();
                redirect_target = None;
                capture_tag = None;
            }
            Event::Start(ref event) if event.name().as_ref() == b"title" => {
                capture_tag = Some(CaptureTag::Title);
            }
            Event::Start(ref event) if event.name().as_ref() == b"ns" => {
                capture_tag = Some(CaptureTag::Namespace);
            }
            Event::Start(ref event) if event.name().as_ref() == b"revision" => {
                in_revision = true;
            }
            Event::End(ref event) if event.name().as_ref() == b"revision" => {
                in_revision = false;
            }
            Event::Start(ref event) if event.name().as_ref() == b"id" => {
                capture_tag = Some(if in_revision {
                    CaptureTag::RevisionId
                } else {
                    CaptureTag::PageId
                });
            }
            Event::Start(ref event) if event.name().as_ref() == b"text" => {
                capture_tag = Some(CaptureTag::Text);
            }
            Event::Empty(ref event) if event.name().as_ref() == b"redirect" => {
                redirect_target = event
                    .attributes()
                    .flatten()
                    .find(|attribute| attribute.key.as_ref() == b"title")
                    .map(|attribute| String::from_utf8_lossy(attribute.value.as_ref()).into_owned());
            }
            Event::End(ref event) if event.name().as_ref() == b"page" => {
                stats.documents_seen += 1;
                if namespace.trim() != "0" {
                    buf.clear();
                    continue;
                }

                let Some(page_id) = page_id.as_ref() else {
                    buf.clear();
                    continue;
                };

                match normalize_page(
                    &title,
                    page_id,
                    revision_id.as_deref(),
                    redirect_target.as_deref(),
                    &text,
                ) {
                    Some(document) => {
                        if sender.blocking_send(Ok(document)).is_err() {
                            return Ok(stats);
                        }
                        stats.documents_emitted += 1;
                        if limit.is_some_and(|max| stats.documents_emitted >= max) {
                            return Ok(stats);
                        }
                    }
                    None => {}
                }
            }
            Event::Text(text_event) => {
                let value = String::from_utf8_lossy(text_event.as_ref()).into_owned();
                assign_capture(
                    &mut capture_tag,
                    &mut title,
                    &mut namespace,
                    &mut page_id,
                    &mut revision_id,
                    &mut text,
                    value,
                );
            }
            Event::CData(text_event) => {
                let value = String::from_utf8_lossy(text_event.as_ref()).into_owned();
                assign_capture(
                    &mut capture_tag,
                    &mut title,
                    &mut namespace,
                    &mut page_id,
                    &mut revision_id,
                    &mut text,
                    value,
                );
            }
            Event::End(ref event)
                if matches!(
                    event.name().as_ref(),
                    b"title" | b"ns" | b"id" | b"text"
                ) =>
            {
                capture_tag = None;
            }
            Event::Eof => break,
            _ => {}
        }

        buf.clear();
    }

    Ok(stats)
}

#[derive(Debug, Clone, Copy)]
enum CaptureTag {
    Title,
    Namespace,
    PageId,
    RevisionId,
    Text,
}

fn assign_capture(
    capture_tag: &mut Option<CaptureTag>,
    title: &mut String,
    namespace: &mut String,
    page_id: &mut Option<String>,
    revision_id: &mut Option<String>,
    text: &mut String,
    value: String,
) {
    match capture_tag {
        Some(CaptureTag::Title) => title.push_str(&value),
        Some(CaptureTag::Namespace) => namespace.push_str(&value),
        Some(CaptureTag::PageId) => {
            if page_id.is_none() {
                *page_id = Some(value);
            }
        }
        Some(CaptureTag::RevisionId) => {
            if revision_id.is_none() {
                *revision_id = Some(value);
            }
        }
        Some(CaptureTag::Text) => text.push_str(&value),
        None => {}
    }
}

pub fn normalize_page(
    title: &str,
    page_id: &str,
    revision_id: Option<&str>,
    redirect_target: Option<&str>,
    raw_text: &str,
) -> Option<Document> {
    let title = title.trim();
    if title.is_empty() {
        return None;
    }

    let categories = extract_categories(raw_text);
    let sections = split_sections(raw_text);
    let body_text = if sections.is_empty() {
        clean_mediawiki_markup(raw_text)
    } else {
        sections
            .iter()
            .map(|section| section.content.clone())
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    let body_text = normalize_whitespace(&body_text);
    if body_text.is_empty() && redirect_target.is_none() {
        return None;
    }

    let canonical_id = format!("wikipedia:en:page:{page_id}");
    let mut document = Document::new(
        canonical_id,
        SourceType::Wikipedia,
        "English Wikipedia",
        title,
        "en",
        wikipedia_article_url(title),
        body_text.clone(),
        sections,
        categories.clone(),
        json!({
            "page_id": page_id,
            "redirect_target": redirect_target,
            "categories": categories,
        }),
    );
    document.source_revision = revision_id.map(ToOwned::to_owned);
    if !body_text.is_empty() {
        document.summary = Some(excerpt_from_start(&body_text, 240));
    }
    Some(document)
}

fn split_sections(raw_text: &str) -> Vec<Section> {
    let mut sections = Vec::new();
    let mut heading_stack: Vec<String> = Vec::new();
    let mut current_lines: Vec<String> = Vec::new();
    let mut current_title: Option<String> = Some(String::from("Introduction"));

    for line in raw_text.lines() {
        if let Some((level, title)) = parse_heading_line(line) {
            flush_section(
                &mut sections,
                &heading_stack,
                current_title.take(),
                &current_lines.join("\n"),
            );
            current_lines.clear();

            update_heading_stack(&mut heading_stack, level, &title);
            current_title = Some(title);
        } else {
            current_lines.push(line.to_owned());
        }
    }

    flush_section(
        &mut sections,
        &heading_stack,
        current_title,
        &current_lines.join("\n"),
    );

    sections
}

fn flush_section(
    target: &mut Vec<Section>,
    heading_stack: &[String],
    current_title: Option<String>,
    raw: &str,
) {
    let cleaned = clean_mediawiki_markup(raw);
    if cleaned.is_empty() {
        return;
    }

    let title = current_title
        .clone()
        .filter(|title| title != "Introduction")
        .or(current_title);
    let heading_path = if heading_stack.is_empty() {
        title.clone().into_iter().collect()
    } else {
        heading_stack.to_vec()
    };

    target.push(Section {
        title,
        heading_path,
        content: cleaned,
        metadata: json!({}),
    });
}

fn update_heading_stack(stack: &mut Vec<String>, level: usize, title: &str) {
    let desired_len = level.saturating_sub(2);
    stack.truncate(desired_len);
    stack.push(title.to_owned());
}

fn parse_heading_line(line: &str) -> Option<(usize, String)> {
    let trimmed = line.trim();
    if !trimmed.starts_with('=') || !trimmed.ends_with('=') {
        return None;
    }

    let prefix = trimmed.chars().take_while(|char| *char == '=').count();
    let suffix = trimmed.chars().rev().take_while(|char| *char == '=').count();
    if prefix < 2 || prefix != suffix {
        return None;
    }

    let title = trimmed[prefix..trimmed.len() - suffix].trim();
    if title.is_empty() {
        return None;
    }

    Some((prefix, title.to_owned()))
}

fn extract_categories(raw_text: &str) -> Vec<String> {
    raw_text
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let prefix = "[[Category:";
            if !line.starts_with(prefix) {
                return None;
            }

            let body = line.trim_start_matches(prefix);
            let category = body
                .split(['|', ']'])
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty())?;

            Some(category.to_owned())
        })
        .collect()
}

fn clean_mediawiki_markup(raw: &str) -> String {
    let mut text = raw.replace('\r', "");
    let patterns = [
        (r"(?s)<!--.*?-->", " "),
        (r"(?s)<ref[^>]*>.*?</ref>", " "),
        (r"<ref[^>]*/>", " "),
        (r"(?s)\{\|.*?\|\}", " "),
        (r"(?s)\{\{.*?\}\}", " "),
        (r"\[\[File:[^\]]+\]\]", " "),
        (r"\[\[Image:[^\]]+\]\]", " "),
    ];

    for (pattern, replacement) in patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            text = regex.replace_all(&text, replacement).to_string();
        } else {
            warn!(pattern, "failed to compile wikipedia cleanup regex");
        }
    }

    if let Ok(regex) = regex::Regex::new(r"\[\[([^|\]]+)\|([^\]]+)\]\]") {
        text = regex.replace_all(&text, "$2").to_string();
    }
    if let Ok(regex) = regex::Regex::new(r"\[\[([^\]]+)\]\]") {
        text = regex.replace_all(&text, "$1").to_string();
    }
    if let Ok(regex) = regex::Regex::new(r"\[(https?://[^\s]+)\s+([^\]]+)\]") {
        text = regex.replace_all(&text, "$2").to_string();
    }
    if let Ok(regex) = regex::Regex::new(r"\[https?://[^\]]+\]") {
        text = regex.replace_all(&text, " ").to_string();
    }
    if let Ok(regex) = regex::Regex::new(r"<[^>]+>") {
        text = regex.replace_all(&text, " ").to_string();
    }

    text = text
        .replace("'''", "")
        .replace("''", "")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");

    text.lines()
        .map(str::trim)
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with("[[Category:")
                && !line.starts_with("__")
                && !line.starts_with("#REDIRECT")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::normalize_page;

    #[test]
    fn normalizes_page_into_sections() {
        let document = normalize_page(
            "Anarchism",
            "12",
            Some("987"),
            None,
            "Intro line.\n== History ==\nAn ''important'' movement.\n[[Category:Politics]]",
        )
        .expect("document should be produced");

        assert_eq!(document.article_title, "Anarchism");
        assert_eq!(document.categories, vec![String::from("Politics")]);
        assert!(document.body_text.contains("Intro line"));
        assert!(document.sections.iter().any(|section| {
            section
                .title
                .as_deref()
                .is_some_and(|title| title == "History")
        }));
    }
}
