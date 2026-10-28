import type { DbClient } from '../db/client.js';
import { lexicalSearch } from './lexical-search.js';
import { fuseRankingsRRF } from './rrf.js';
import { vectorSearch, type SearchResultItem } from './vector-search.js';

export interface HybridSearchOptions {
  candidatePoolSize?: number;
  topK?: number;
  rrfK?: number;
  documentId?: string;
  docType?: string;
}

export async function hybridSearchRRF(
  db: DbClient,
  query: string,
  queryEmbedding: number[],
  options: HybridSearchOptions = {},
): Promise<SearchResultItem[]> {
  const candidatePoolSize = options.candidatePoolSize ?? 20;
  const topK = options.topK ?? 20;

  const [vectorCandidates, lexicalCandidates] = await Promise.all([
    vectorSearch(db, queryEmbedding, {
      topK: candidatePoolSize,
      documentId: options.documentId,
      docType: options.docType,
    }),
    lexicalSearch(db, query, {
      topK: candidatePoolSize,
      documentId: options.documentId,
      docType: options.docType,
    }),
  ]);

  return fuseRankingsRRF(vectorCandidates, lexicalCandidates, {
    rrfK: options.rrfK ?? 60,
    topK,
  });
}
