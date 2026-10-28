import type { SearchResultItem } from './vector-search.js';

export interface CitationValidationResult {
  isValid: boolean;
  validChunkIds: string[];
  invalidChunkIds: string[];
  citedChunks: SearchResultItem[];
  sanitizedAnswer: string;
}

const CITATION_BRACKET_REGEX = /\[([a-zA-Z0-9_-]{4,64})\]/g;

export function validateCitations(
  answerText: string,
  retrievedChunks: SearchResultItem[],
): CitationValidationResult {
  const chunkById = new Map<string, SearchResultItem>();
  for (const chunk of retrievedChunks) {
    chunkById.set(chunk.chunkId, chunk);
  }

  const validSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const match of answerText.matchAll(CITATION_BRACKET_REGEX)) {
    const id = match[1];
    if (!id) continue;
    if (chunkById.has(id)) {
      validSet.add(id);
    } else {
      invalidSet.add(id);
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
