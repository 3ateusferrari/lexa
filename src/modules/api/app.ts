import express, { type Express } from 'express';
import type { DbClient } from '../db/client.js';
import {
  CachedEmbedder,
  createLocalEmbeddingProvider,
  type EmbeddingProvider,
} from '../ingestion/embedder.js';
import { vectorSearch, type SearchResultItem } from '../rag/vector-search.js';
import { createSearchRouter, type SearchExecutor, type SearchRequestInput } from './routes/search.route.js';

export interface AppDependencies {
  db?: DbClient;
  embedder?: EmbeddingProvider;
  searchFn?: SearchExecutor;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  const embedder =
    deps.embedder ?? new CachedEmbedder(createLocalEmbeddingProvider());

  const defaultSearchFn: SearchExecutor = async (
    input: SearchRequestInput,
  ): Promise<SearchResultItem[]> => {
    if (!deps.db) {
      throw new Error('Database client is not configured');
    }
    const [queryEmbedding] = await embedder.embedBatch([input.query]);
    return vectorSearch(deps.db, queryEmbedding!, {
      topK: input.k,
      documentId: input.documentId,
      docType: input.docType,
    });
  };

  app.use('/search', createSearchRouter(deps.searchFn ?? defaultSearchFn));

  return app;
}
