import type { SearchResultItem } from './vector-search.js';

export interface CitationValidationResult {
  isValid: boolean;
  validChunkIds: string[];
  invalidChunkIds: string[];
  citedChunks: SearchResultItem[];
  sanitizedAnswer: string;
}

const CITATION_BRACKET_REGEX = /\[([a-zA-Z0-9_\s-]{1,64})\]/g;

export function validateCitations(
  answerText: string,
  retrievedChunks: SearchResultItem[],
): CitationValidationResult {
  const chunkById = new Map<string, SearchResultItem>();
  const chunkByAlias = new Map<string, SearchResultItem>();

  retrievedChunks.forEach((chunk, idx) => {
    chunkById.set(chunk.chunkId, chunk);
    chunkByAlias.set(chunk.chunkId.toLowerCase(), chunk);
    chunkByAlias.set(String(idx + 1), chunk);
    chunkByAlias.set(`fonte ${idx + 1}`, chunk);
    chunkByAlias.set(`fonte${idx + 1}`, chunk);
  });

  const validSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const match of answerText.matchAll(CITATION_BRACKET_REGEX)) {
    const rawMatch = match[1]?.trim();
    if (!rawMatch) continue;
    const lowerKey = rawMatch.toLowerCase();
    const resolvedChunk = chunkByAlias.get(lowerKey);

    if (resolvedChunk) {
      validSet.add(resolvedChunk.chunkId);
    } else {
      if (
        lowerKey.startsWith('fonte') ||
        /^[0-9a-f-]{10,}$/i.test(lowerKey) ||
        lowerKey.startsWith('chunk-')
      ) {
        invalidSet.add(rawMatch);
      }
    }
  }

  let sanitizedAnswer = answerText;
  for (const invalidId of invalidSet) {
    const escaped = invalidId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitizedAnswer = sanitizedAnswer
      .replace(new RegExp(`\\s*\\[${escaped}\\]`, 'g'), '')
      .trim();
  }

  const validChunkIds = Array.from(validSet);
  const invalidChunkIds = Array.from(invalidSet);
  const citedChunks = validChunkIds
    .map((id) => chunkById.get(id))
    .filter((c): c is SearchResultItem => Boolean(c));

  return {
    isValid: invalidChunkIds.length === 0 && validChunkIds.length > 0,
    validChunkIds,
    invalidChunkIds,
    citedChunks,
    sanitizedAnswer,
  };
}
