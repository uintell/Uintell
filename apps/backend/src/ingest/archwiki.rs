use std::{fs, path::Path};

use scraper::{Html, Selector};
use serde_json::json;
use tokio::sync::mpsc::Sender;
use walkdir::WalkDir;

use crate::{
    domain::{Document, Section, SourceType},
    error::{AppError, AppResult},
    util::{excerpt_from_start, normalize_whitespace},
};

#[derive(Debug, Default, Clone, Copy)]
pub struct IngestStats {
    pub documents_seen: usize,
    pub documents_emitted: usize,
}

pub fn stream_directory(
    directory: &Path,
    limit: Option<usize>,
    sender: Sender<AppResult<Document>>,
) -> AppResult<IngestStats> {
    let mut stats = IngestStats::default();
    let mut file_paths = WalkDir::new(directory)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension == "html"))
        .map(|entry| entry.into_path())
        .collect::<Vec<_>>();

    file_paths.sort();

    for path in file_paths {
        stats.documents_seen += 1;
        let html = fs::read_to_string(&path)?;
        let document = parse_html_document(&path, &html)?;
        if sender.blocking_send(Ok(document)).is_err() {
            return Ok(stats);
        }
        stats.documents_emitted += 1;

        if limit.is_some_and(|max| stats.documents_emitted >= max) {
            break;
        }
    }

    Ok(stats)
}

pub fn parse_html_document(path: &Path, html: &str) -> AppResult<Document> {
    let parsed = Html::parse_document(html);
    let title_selector = parse_selector("#firstHeading .mw-page-title-main, #firstHeading, title")?;
    let body_selector = parse_selector("div.mw-parser-output > *")?;
    let category_selector = parse_selector("#mw-normal-catlinks li a")?;
    let footer_url_selector = parse_selector("#footer-info li[data-nosnippet] a")?;

    let title = parsed
        .select(&title_selector)
        .next()
        .map(|element| normalize_whitespace(&element.text().collect::<String>()))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::InvalidInput(format!("failed to find title for {}", path.display())))?;
    let title = title.trim_end_matches(" - ArchWiki").to_owned();

    let mut heading_stack = Vec::new();
    let mut current_title = Some(String::from("Overview"));
    let mut current_lines = Vec::new();
    let mut sections = Vec::new();

    for element in parsed.select(&body_selector) {
        let tag_name = element.value().name();
        match tag_name {
            "h2" | "h3" | "h4" | "h5" | "h6" => {
                flush_section(
                    &mut sections,
                    &heading_stack,
                    current_title.take(),
                    &current_lines.join("\n"),
                );
                current_lines.clear();

                let heading = normalize_whitespace(&element.text().collect::<String>());
                let level = heading_level(tag_name);
                update_heading_stack(&mut heading_stack, level, &heading);
                current_title = Some(heading);
            }
            "p" => {
                let text = normalize_whitespace(&element.text().collect::<String>());
                if !text.is_empty() {
                    current_lines.push(text);
                }
            }
            "pre" => {
                let text = element.text().collect::<String>();
                if !text.trim().is_empty() {
                    current_lines.push(format!("```text\n{}\n```", text.trim()));
                }
            }
            "ul" | "ol" => {
                let items = element
                    .select(&parse_selector("li")?)
                    .map(|item| normalize_whitespace(&item.text().collect::<String>()))
                    .filter(|item| !item.is_empty())
                    .map(|item| format!("- {item}"))
                    .collect::<Vec<_>>();
                if !items.is_empty() {
                    current_lines.push(items.join("\n"));
                }
            }
            "div" => {
                let text = normalize_whitespace(&element.text().collect::<String>());
                if !text.is_empty() {
                    current_lines.push(text);
                }
            }
            _ => {}
        }
    }

    flush_section(
        &mut sections,
        &heading_stack,
        current_title,
        &current_lines.join("\n"),
    );

    let categories = parsed
        .select(&category_selector)
        .map(|category| normalize_whitespace(&category.text().collect::<String>()))
        .filter(|category| !category.is_empty())
        .collect::<Vec<_>>();

    let source_url = parsed
        .select(&footer_url_selector)
        .next()
        .and_then(|element| element.value().attr("href"))
        .map(ToOwned::to_owned);

    let body_text = sections
        .iter()
        .map(|section| section.content.clone())
        .collect::<Vec<_>>()
        .join("\n\n");

    let slug = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| AppError::InvalidInput(format!("invalid file name {}", path.display())))?;
    let canonical_id = format!("archwiki:en:{slug}");

    let mut document = Document::new(
        canonical_id,
        SourceType::ArchWiki,
        "ArchWiki Offline",
        title,
        "en",
        path.display().to_string(),
        body_text.clone(),
        sections,
        categories.clone(),
        json!({
            "retrieved_url": source_url,
            "categories": categories,
            "file_name": path.file_name().and_then(|value| value.to_str()),
        }),
    );

    if !body_text.is_empty() {
        document.summary = Some(excerpt_from_start(&body_text, 240));
    }

    Ok(document)
}

fn flush_section(
    target: &mut Vec<Section>,
    heading_stack: &[String],
    current_title: Option<String>,
    raw: &str,
) {
    let cleaned = raw.trim();
    if cleaned.is_empty() {
        return;
    }

    let title = current_title.clone();
    let heading_path = if heading_stack.is_empty() {
        title.clone().into_iter().collect()
    } else {
        heading_stack.to_vec()
    };

    target.push(Section {
        title,
        heading_path,
        content: cleaned.to_owned(),
        metadata: json!({}),
    });
}

fn heading_level(tag_name: &str) -> usize {
    tag_name
        .strip_prefix('h')
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(2)
}

fn update_heading_stack(stack: &mut Vec<String>, level: usize, title: &str) {
    let desired_len = level.saturating_sub(2);
    stack.truncate(desired_len);
    stack.push(title.to_owned());
}

fn parse_selector(value: &str) -> AppResult<Selector> {
    Selector::parse(value)
        .map_err(|_| AppError::Config(format!("failed to parse selector: {value}")))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::parse_html_document;

    #[test]
    fn parses_archwiki_html() {
        let html = r#"
            <html>
              <body>
                <h1 id="firstHeading"><span class="mw-page-title-main">Demo Page</span></h1>
                <div class="mw-parser-output">
                  <p>Intro paragraph.</p>
                  <h2>Install</h2>
                  <p>Install with pacman.</p>
                  <pre>pacman -S demo</pre>
                </div>
              </body>
            </html>
        "#;

        let document = parse_html_document(Path::new("/tmp/Demo_Page.html"), html).unwrap();
        assert_eq!(document.article_title, "Demo Page");
        assert!(document.body_text.contains("pacman -S demo"));
        assert!(document.sections.iter().any(|section| {
            section
                .title
                .as_deref()
                .is_some_and(|title| title == "Install")
        }));
    }
}
