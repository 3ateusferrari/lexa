import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { DbClient } from '../db/client.js';
import {
  CachedEmbedder,
  createLocalEmbeddingProvider,
  type EmbeddingProvider,
} from '../ingestion/embedder.js';
import type { LlmStreamAdapter } from '../rag/chat-service.js';
import { hybridSearchRRF } from '../rag/hybrid-search.js';
import { lexicalSearch } from '../rag/lexical-search.js';
import { rerankChunks } from '../rag/reranker.js';
import { vectorSearch, type SearchResultItem } from '../rag/vector-search.js';
import { createDailyBudgetController } from './middlewares/daily-budget.js';
import { errorHandlerMiddleware } from './middlewares/error-handler.js';
import { createIpRateLimiter } from './middlewares/rate-limit.js';
import { createChatRouter } from './routes/chat.route.js';
import {
  createDocumentsRouter,
  type DocumentUploadService,
} from './routes/documents.route.js';
import {
  createSearchRouter,
  type SearchExecutor,
  type SearchRequestInput,
} from './routes/search.route.js';

export interface AppDependencies {
  db?: DbClient;
  embedder?: EmbeddingProvider;
  searchFn?: SearchExecutor;
  llmAdapter?: LlmStreamAdapter;
  documentUploadService?: DocumentUploadService;
  rateLimitMaxPerMinute?: number;
  maxDailyLlmCalls?: number;
  corsOrigin?: string;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: deps.corsOrigin ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  const dailyBudget = createDailyBudgetController(
    deps.maxDailyLlmCalls ?? Number(process.env.MAX_DAILY_LLM_CALLS ?? 200),
  );
  const chatRateLimiter = createIpRateLimiter({
    maxRequests: deps.rateLimitMaxPerMinute ?? 20,
    windowMs: 60_000,
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dailyBudgetRemaining: dailyBudget.getRemaining(),
      dailyBudgetLimit: dailyBudget.getLimit(),
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

  const activeSearchFn = deps.searchFn ?? defaultSearchFn;
  app.use('/search', createSearchRouter(activeSearchFn));

  app.use(
    '/chat',
    chatRateLimiter,
    createChatRouter({
      retrieveCandidates: (question, k, filters) =>
        activeSearchFn({
          query: question,
          k,
          mode: 'hybrid',
          rerank: true,
          documentId: filters.documentId,
          docType: filters.docType,
        }),
      llmAdapter: deps.llmAdapter,
      dailyBudget,
    }),
  );

  app.use(
    '/documents',
    createDocumentsRouter({
      db: deps.db,
      uploadService: deps.documentUploadService,
    }),
  );

  app.use(errorHandlerMiddleware);

  return app;
}
