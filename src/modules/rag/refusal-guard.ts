import type { SearchResultItem } from './vector-search.js';

export const DEFAULT_REFUSAL_THRESHOLD = 0.25;

export interface RefusalDecision {
  refused: boolean;
  topScore: number;
  threshold: number;
  reason?: string;
}

export function evaluateRefusalGuard(
  rankedChunks: SearchResultItem[],
  minThreshold = DEFAULT_REFUSAL_THRESHOLD,
): RefusalDecision {
  if (rankedChunks.length === 0) {
    return {
      refused: true,
      topScore: 0,
      threshold: minThreshold,
      reason: 'Nenhum trecho foi encontrado nos documentos indexados.',
    };
  }

  const bestChunk = rankedChunks[0]!;
  const topScore = bestChunk.rerankScore ?? bestChunk.vectorScore ?? bestChunk.score ?? 0;

  if (topScore < minThreshold) {
    return {
      refused: true,
      topScore,
      threshold: minThreshold,
      reason: `Melhor trecho ficou abaixo do limiar de relevância (${topScore.toFixed(3)} < ${minThreshold.toFixed(3)}). Não encontrei base suficiente nos documentos indexados.`,
    };
  }

  return {
    refused: false,
    topScore,
    threshold: minThreshold,
  };
}
