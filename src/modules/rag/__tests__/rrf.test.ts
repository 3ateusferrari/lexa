import { describe, expect, it } from 'vitest';
import { fuseRankingsRRF } from '../rrf.js';
import type { SearchResultItem } from '../vector-search.js';

function makeCandidate(
  chunkId: string,
  article: string,
  score: number,
): SearchResultItem {
  return {
    chunkId,
    documentId: 'doc-1',
    documentTitle: 'Lei 14.133',
    docType: 'lei',
    article,
    sectionPath: 'TÍTULO II',
    page: null,
    content: `${article} conteúdo`,
    score,
  };
}

describe('Reciprocal Rank Fusion (RRF)', () => {
  it('fuses vector and lexical rankings based on rank positions regardless of raw score scale differences', () => {
    // Vector scores in [0, 1], lexical ts_rank_cd scores in arbitrary scale (e.g. 0.02 .. 12.5)
    const vectorList: SearchResultItem[] = [
      makeCandidate('chunk-A', 'Art. 74', 0.95), // rank 1 in vector
      makeCandidate('chunk-B', 'Art. 75', 0.90), // rank 2 in vector
      makeCandidate('chunk-C', 'Art. 28', 0.85), // rank 3 in vector
    ];

    const lexicalList: SearchResultItem[] = [
      makeCandidate('chunk-B', 'Art. 75', 0.08), // rank 1 in lexical
      makeCandidate('chunk-D', 'Art. 33', 0.05), // rank 2 in lexical
      makeCandidate('chunk-A', 'Art. 74', 0.01), // rank 3 in lexical
    ];

    const fused = fuseRankingsRRF(vectorList, lexicalList, { rrfK: 60, topK: 4 });

    expect(fused).toHaveLength(4);
    // chunk-B is rank 2 in vector (1/62) + rank 1 in lexical (1/61) = 0.032522
    // chunk-A is rank 1 in vector (1/61) + rank 3 in lexical (1/63) = 0.032266
    expect(fused[0]?.chunkId).toBe('chunk-B');
    expect(fused[1]?.chunkId).toBe('chunk-A');
    expect(fused[0]?.score).toBeGreaterThan(fused[1]!.score);
    expect(fused[0]?.vectorScore).toBe(0.9);
    expect(fused[0]?.lexicalScore).toBe(0.08);
  });
});
