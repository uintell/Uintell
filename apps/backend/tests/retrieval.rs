use serde_json::json;
use tempfile::TempDir;

use sourcepedia_backend::{
    domain::{Chunk, Document, Section, SourceType},
    retrieval::{RankedChunk, reciprocal_rank_fusion},
    storage::TantivyIndexManager,
};

fn sample_chunk(article_title: &str, content: &str, chunk_index: usize) -> Chunk {
    let document = Document::new(
        format!("demo:{article_title}"),
        SourceType::Wikipedia,
        "Demo",
        article_title,
        "en",
        format!("https://example.test/{article_title}"),
        content,
        vec![Section {
            title: Some(String::from("Overview")),
            heading_path: vec![String::from("Overview")],
            content: content.to_owned(),
            metadata: json!({}),
        }],
        Vec::new(),
        json!({}),
    );

    Chunk::from_document_section(&document, &document.sections[0], chunk_index, content.to_owned())
        .unwrap()
}

#[test]
fn reciprocal_rank_fusion_merges_sources() {
    let a = uuid::Uuid::new_v4();
    let b = uuid::Uuid::new_v4();
    let c = uuid::Uuid::new_v4();

    let fused = reciprocal_rank_fusion(
        &[RankedChunk { chunk_id: a, score: 1.0 }, RankedChunk { chunk_id: b, score: 0.8 }],
        &[RankedChunk { chunk_id: b, score: 0.9 }, RankedChunk { chunk_id: c, score: 0.7 }],
        3,
    );

    assert_eq!(fused.len(), 3);
    assert_eq!(fused[0].chunk_id, b);
}

#[test]
fn tantivy_search_returns_indexed_chunk() {
    let directory = TempDir::new().unwrap();
    let index = TantivyIndexManager::open_or_create(directory.path()).unwrap();
    let mut writer = index.create_writer().unwrap();
    index.clear(&mut writer).unwrap();

    let chunks = vec![
        sample_chunk("Linux", "Linux is a Unix-like operating system kernel.", 0),
        sample_chunk("Pacman", "Pacman installs packages on Arch Linux.", 1),
    ];

    index.add_chunks(&mut writer, &chunks).unwrap();
    index.commit(writer).unwrap();

    let hits = index
        .search("Arch Linux packages", Some(SourceType::Wikipedia), 5)
        .unwrap();

    assert!(!hits.is_empty());
    assert_eq!(hits[0].chunk_id, chunks[1].id);
}
