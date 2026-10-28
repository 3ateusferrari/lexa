import express, { type Express } from 'express';
import type { DbClient } from '../db/client.js';
import {
  CachedEmbedder,
  createLocalEmbeddingProvider,
  type EmbeddingProvider,
} from '../ingestion/embedder.js';
import { hybridSearchRRF } from '../rag/hybrid-search.js';
import { lexicalSearch } from '../rag/lexical-search.js';
import { rerankChunks } from '../rag/reranker.js';
import { vectorSearch, type SearchResultItem } from '../rag/vector-search.js';
import {
  createSearchRouter,
  type SearchExecutor,
  type SearchRequestInput,
} from './routes/search.route.js';

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

    if (input.mode === 'lexical') {
      const lexResults = await lexicalSearch(deps.db, input.query, {
        topK: input.rerank ? 20 : input.k,
        documentId: input.documentId,
        docType: input.docType,
      });
      return input.rerank
        ? rerankChunks(input.query, lexResults, { topK: input.k })
        : lexResults.slice(0, input.k);
    }

    const [queryEmbedding] = await embedder.embedBatch([input.query]);

    if (input.mode === 'hybrid') {
      const fused = await hybridSearchRRF(deps.db, input.query, queryEmbedding!, {
        candidatePoolSize: 20,
        topK: input.rerank ? 20 : input.k,
        documentId: input.documentId,
        docType: input.docType,
      });
      return input.rerank
        ? rerankChunks(input.query, fused, { topK: input.k })
        : fused.slice(0, input.k);
    }

    const vecResults = await vectorSearch(deps.db, queryEmbedding!, {
      topK: input.rerank ? 20 : input.k,
      documentId: input.documentId,
      docType: input.docType,
    });
    return input.rerank
      ? rerankChunks(input.query, vecResults, { topK: input.k })
      : vecResults.slice(0, input.k);
  };

  app.use('/search', createSearchRouter(deps.searchFn ?? defaultSearchFn));

  return app;
}
