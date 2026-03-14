use std::{fs, path::Path};

use tantivy::{
    Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument, Term,
    collector::TopDocs,
    query::{BooleanQuery, Occur, QueryParser, TermQuery},
    schema::{Field, IndexRecordOption, STORED, STRING, Schema, TEXT, Value},
};
use uuid::Uuid;

use crate::{
    domain::{Chunk, SourceType},
    error::AppResult,
    retrieval::RankedChunk,
};

#[derive(Clone)]
pub struct TantivyIndexManager {
    index: Index,
    reader: IndexReader,
    fields: TantivyFields,
}

#[derive(Clone, Copy)]
struct TantivyFields {
    chunk_id: Field,
    source_type: Field,
    article_title: Field,
    section_title: Field,
    content: Field,
}

impl TantivyIndexManager {
    pub fn open_or_create(index_path: &Path) -> AppResult<Self> {
        fs::create_dir_all(index_path)?;
        let (schema, fields) = build_schema();
        let index = if index_path.join("meta.json").exists() {
            Index::open_in_dir(index_path)?
        } else {
            Index::create_in_dir(index_path, schema)?
        };

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        Ok(Self {
            index,
            reader,
            fields,
        })
    }

    pub fn create_writer(&self) -> AppResult<IndexWriter> {
        Ok(self.index.writer(50_000_000)?)
    }

    pub fn clear(&self, writer: &mut IndexWriter) -> AppResult<()> {
        writer.delete_all_documents()?;
        Ok(())
    }

    pub fn add_chunks(&self, writer: &mut IndexWriter, chunks: &[Chunk]) -> AppResult<()> {
        for chunk in chunks {
            let mut document = TantivyDocument::default();
            document.add_text(self.fields.chunk_id, chunk.id.to_string());
            document.add_text(self.fields.source_type, chunk.source_type.as_str());
            document.add_text(self.fields.article_title, &chunk.article_title);
            document.add_text(
                self.fields.section_title,
                chunk.section_title.as_deref().unwrap_or_default(),
            );
            document.add_text(self.fields.content, &chunk.content);
            writer.add_document(document)?;
        }

        Ok(())
    }

    pub fn commit(&self, mut writer: IndexWriter) -> AppResult<()> {
        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    pub fn search(
        &self,
        query_text: &str,
        filter: Option<SourceType>,
        limit: usize,
    ) -> AppResult<Vec<RankedChunk>> {
        self.reader.reload()?;
        let searcher = self.reader.searcher();
        let parser = QueryParser::for_index(
            &self.index,
            vec![
                self.fields.article_title,
                self.fields.section_title,
                self.fields.content,
            ],
        );
        let parsed = parser
            .parse_query(query_text)
            .map_err(tantivy::TantivyError::from)?;

        let query: Box<dyn tantivy::query::Query> = if let Some(source_type) = filter {
            let filter_query = Box::new(TermQuery::new(
                Term::from_field_text(self.fields.source_type, source_type.as_str()),
                IndexRecordOption::Basic,
            ));
            Box::new(BooleanQuery::new(vec![
                (Occur::Must, parsed),
                (Occur::Must, filter_query),
            ]))
        } else {
            parsed
        };

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;
        let mut hits = Vec::with_capacity(top_docs.len());

        for (score, address) in top_docs {
            let retrieved = searcher.doc::<TantivyDocument>(address)?;
            let Some(chunk_id) = retrieved
                .get_first(self.fields.chunk_id)
                .and_then(|value| value.as_str())
                .and_then(|value| Uuid::parse_str(value).ok()) else {
                continue;
            };

            hits.push(RankedChunk { chunk_id, score });
        }

        Ok(hits)
    }
}

fn build_schema() -> (Schema, TantivyFields) {
    let mut schema_builder = Schema::builder();
    let chunk_id = schema_builder.add_text_field("chunk_id", STRING | STORED);
    let source_type = schema_builder.add_text_field("source_type", STRING);
    let article_title = schema_builder.add_text_field("article_title", TEXT);
    let section_title = schema_builder.add_text_field("section_title", TEXT);
    let content = schema_builder.add_text_field("content", TEXT);
    let schema = schema_builder.build();

    (
        schema,
        TantivyFields {
            chunk_id,
            source_type,
            article_title,
            section_title,
            content,
        },
    )
}
