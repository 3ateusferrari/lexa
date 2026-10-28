import type { SearchResultItem } from './vector-search.js';

export interface RrfFusionOptions {
  rrfK?: number;
  topK?: number;
}

export function fuseRankingsRRF(
  vectorResults: SearchResultItem[],
  lexicalResults: SearchResultItem[],
  options: RrfFusionOptions = {},
): SearchResultItem[] {
  const rrfK = options.rrfK ?? 60;
  const topK = options.topK ?? 20;

  const merged = new Map<
    string,
    {
      item: SearchResultItem;
      rrfScore: number;
      vectorScore?: number;
      lexicalScore?: number;
    }
  >();

  for (let i = 0; i < vectorResults.length; i++) {
    const candidate = vectorResults[i]!;
    const rank = i + 1;
    const contribution = 1 / (rrfK + rank);

    merged.set(candidate.chunkId, {
      item: candidate,
      rrfScore: contribution,
      vectorScore: candidate.vectorScore ?? candidate.score,
    });
  }

  for (let i = 0; i < lexicalResults.length; i++) {
    const candidate = lexicalResults[i]!;
    const rank = i + 1;
    const contribution = 1 / (rrfK + rank);

    const existing = merged.get(candidate.chunkId);
    if (existing) {
      existing.rrfScore += contribution;
      existing.lexicalScore = candidate.lexicalScore ?? candidate.score;
    } else {
      merged.set(candidate.chunkId, {
        item: candidate,
        rrfScore: contribution,
        lexicalScore: candidate.lexicalScore ?? candidate.score,
      });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map(({ item, rrfScore, vectorScore, lexicalScore }) => ({
      ...item,
      score: Number(rrfScore.toFixed(6)),
      vectorScore,
      lexicalScore,
    }));
}
