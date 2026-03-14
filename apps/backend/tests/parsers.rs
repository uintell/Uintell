use std::path::Path;

use sourcepedia_backend::ingest::{archwiki::parse_html_document, wikipedia::normalize_page};

#[test]
fn wikipedia_normalization_extracts_summary_and_categories() {
    let document = normalize_page(
        "Pacman",
        "7",
        Some("11"),
        None,
        "Pacman is a package manager.\n== Usage ==\nRun ''pacman -Syu''.\n[[Category:Package management]]",
    )
    .expect("document should exist");

    assert_eq!(document.article_title, "Pacman");
    assert_eq!(document.categories[0], "Package management");
    assert!(document.summary.as_deref().is_some_and(|summary| summary.contains("package manager")));
}

#[test]
fn archwiki_parser_keeps_code_blocks() {
    let html = r#"
        <html>
          <body>
            <h1 id="firstHeading"><span class="mw-page-title-main">PipeWire</span></h1>
            <div class="mw-parser-output">
              <p>PipeWire is a multimedia server.</p>
              <h2>Installation</h2>
              <pre>pacman -S pipewire wireplumber</pre>
            </div>
          </body>
        </html>
    "#;

    let document = parse_html_document(Path::new("/tmp/PipeWire.html"), html).unwrap();
    assert!(document.body_text.contains("pipewire wireplumber"));
    assert!(document.sections.iter().any(|section| {
        section
            .title
            .as_deref()
            .is_some_and(|title| title == "Installation")
    }));
}
