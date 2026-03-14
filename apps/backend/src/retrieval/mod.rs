use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedChunk {
    pub chunk_id: Uuid,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FusedChunkScore {
    pub chunk_id: Uuid,
    pub keyword_score: Option<f32>,
    pub semantic_score: Option<f32>,
    pub combined_score: f32,
}

pub fn reciprocal_rank_fusion(
    keyword_hits: &[RankedChunk],
    semantic_hits: &[RankedChunk],
    limit: usize,
) -> Vec<FusedChunkScore> {
    let mut scores: HashMap<Uuid, FusedChunkScore> = HashMap::new();
    let k = 60.0_f32;

    for (rank, hit) in keyword_hits.iter().enumerate() {
        let entry = scores.entry(hit.chunk_id).or_insert(FusedChunkScore {
            chunk_id: hit.chunk_id,
            keyword_score: None,
            semantic_score: None,
            combined_score: 0.0,
        });
        entry.keyword_score = Some(hit.score);
        entry.combined_score += 1.0 / (k + rank as f32 + 1.0);
    }

    for (rank, hit) in semantic_hits.iter().enumerate() {
        let entry = scores.entry(hit.chunk_id).or_insert(FusedChunkScore {
            chunk_id: hit.chunk_id,
            keyword_score: None,
            semantic_score: None,
            combined_score: 0.0,
        });
        entry.semantic_score = Some(hit.score);
        entry.combined_score += 1.0 / (k + rank as f32 + 1.0);
    }

    let mut fused = scores.into_values().collect::<Vec<_>>();
    fused.sort_by(|left, right| {
        right
            .combined_score
            .partial_cmp(&left.combined_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    fused.truncate(limit);
    fused
}
