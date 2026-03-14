use std::sync::Arc;

use async_trait::async_trait;

use crate::{
    config::{EmbeddingProviderKind, ProviderConfig},
    error::AppResult,
    util::tokenize,
};

pub type DynEmbeddingProvider = Arc<dyn EmbeddingProvider>;

#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    fn dimensions(&self) -> usize;
    fn name(&self) -> &'static str;
    async fn embed_texts(&self, texts: &[String]) -> AppResult<Vec<Vec<f32>>>;
}

#[derive(Debug, Clone)]
pub struct HashEmbeddingProvider {
    dimensions: usize,
}

impl HashEmbeddingProvider {
    pub fn new(dimensions: usize) -> Self {
        Self { dimensions }
    }

    fn embed_one(&self, text: &str) -> Vec<f32> {
        let mut vector = vec![0.0_f32; self.dimensions];
        let tokens = tokenize(text);

        if tokens.is_empty() {
            return vector;
        }

        for token in tokens {
            let hash = blake3::hash(token.as_bytes());
            let bytes = hash.as_bytes();

            let primary = usize::from(u16::from_le_bytes([bytes[0], bytes[1]])) % self.dimensions;
            let secondary =
                usize::from(u16::from_le_bytes([bytes[2], bytes[3]])) % self.dimensions;
            let sign_a = if bytes[4] % 2 == 0 { 1.0 } else { -1.0 };
            let sign_b = if bytes[5] % 2 == 0 { 0.5 } else { -0.5 };

            vector[primary] += sign_a;
            vector[secondary] += sign_b;
        }

        let norm = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
        if norm > 0.0 {
            for value in &mut vector {
                *value /= norm;
            }
        }

        vector
    }
}

#[async_trait]
impl EmbeddingProvider for HashEmbeddingProvider {
    fn dimensions(&self) -> usize {
        self.dimensions
    }

    fn name(&self) -> &'static str {
        "hash"
    }

    async fn embed_texts(&self, texts: &[String]) -> AppResult<Vec<Vec<f32>>> {
        Ok(texts.iter().map(|text| self.embed_one(text)).collect())
    }
}

pub fn build_embedding_provider(config: &ProviderConfig) -> AppResult<DynEmbeddingProvider> {
    let provider: DynEmbeddingProvider = match config.embedding_provider {
        EmbeddingProviderKind::Hash => Arc::new(HashEmbeddingProvider::new(config.vector_size)),
    };

    Ok(provider)
}
