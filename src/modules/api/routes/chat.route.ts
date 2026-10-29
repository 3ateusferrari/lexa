import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  executeGroundedChatStream,
  type LlmStreamAdapter,
} from '../../rag/chat-service.js';
import {
  findCachedExampleQuestion,
  INITIAL_EXAMPLE_QUESTIONS,
} from '../../rag/example-cache.js';
import type { SearchResultItem } from '../../rag/vector-search.js';
import type { DailyBudgetController } from '../middlewares/daily-budget.js';

export const chatRequestSchema = z.object({
  question: z.string().trim().min(3, 'Question must have at least 3 characters').max(600),
  k: z.number().int().min(1).max(10).default(5),
  documentId: z.string().uuid().optional(),
  docType: z.string().trim().min(1).max(50).optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

export interface ChatRouterDependencies {
  retrieveCandidates: (
    question: string,
    k: number,
    filters: { documentId?: string; docType?: string },
  ) => Promise<SearchResultItem[]>;
  llmAdapter?: LlmStreamAdapter;
  dailyBudget?: DailyBudgetController;
  onQueryLog?: (logEntry: {
    requestId?: string;
    question: string;
    cached: boolean;
    refused: boolean;
    searchLatencyMs: number;
    llmLatencyMs: number;
    promptTokens: number;
    completionTokens: number;
    citedArticlesCount: number;
  }) => void;
}

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createChatRouter(deps: ChatRouterDependencies): Router {
  const router = Router();

  router.get('/examples', (_req: Request, res: Response) => {
    res.status(200).json({
      examples: INITIAL_EXAMPLE_QUESTIONS.map((e) => ({
        question: e.question,
      })),
    });
  });

  router.post('/', async (req: Request, res: Response) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid chat payload',
        details: parsed.error.issues,
      });
      return;
    }

    const requestId = req.headers['x-request-id'] as string | undefined;

    // 1. Check pre-cached example questions (0 LLM cost)
    const cachedExample = findCachedExampleQuestion(parsed.data.question);
    if (cachedExample) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const words = cachedExample.answer.split(/(\s+)/);
      for (const word of words) {
        writeSseEvent(res, 'token', { text: word });
      }
      writeSseEvent(res, 'citations', {
        citations: cachedExample.citations,
        isValid: true,
        validChunkIds: cachedExample.citations.map((c) => c.chunkId),
        invalidChunkIds: [],
      });
      writeSseEvent(res, 'done', {
        refused: false,
        cached: true,
        searchLatencyMs: 0,
        llmLatencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
      });
      deps.onQueryLog?.({
        requestId,
        question: parsed.data.question,
        cached: true,
        refused: false,
        searchLatencyMs: 0,
        llmLatencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        citedArticlesCount: cachedExample.citations.length,
      });
      res.end();
      return;
    }

    // 2. Check Daily LLM Budget before opening SSE stream
    if (deps.dailyBudget && !deps.dailyBudget.canConsume()) {
      res.status(429).json({
        error: 'DAILY_LLM_BUDGET_EXCEEDED',
        message:
          'O limite diário de chamadas ao modelo de linguagem desta demonstração pública foi atingido. Você ainda pode testar gratuitamente as perguntas de exemplo na tela inicial ou voltar amanhã.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let citedCount = 0;

    try {
      await executeGroundedChatStream(
        {
          question: parsed.data.question,
          k: parsed.data.k,
          documentId: parsed.data.documentId,
          docType: parsed.data.docType,
          retrieveCandidates: (q, k) =>
            deps.retrieveCandidates(q, k, {
              documentId: parsed.data.documentId,
              docType: parsed.data.docType,
            }),
          llmAdapter: deps.llmAdapter,
        },
        {
          onToken: (token) => {
            writeSseEvent(res, 'token', { text: token });
          },
          onCitations: (citations, validation) => {
            citedCount = citations.length;
            writeSseEvent(res, 'citations', {
              citations,
              isValid: validation.isValid,
              validChunkIds: validation.validChunkIds,
              invalidChunkIds: validation.invalidChunkIds,
            });
          },
          onDone: (meta) => {
            if (!meta.refused && deps.dailyBudget) {
              deps.dailyBudget.consume();
            }
            writeSseEvent(res, 'done', { ...meta, cached: false });
            deps.onQueryLog?.({
              requestId,
              question: parsed.data.question,
              cached: false,
              refused: meta.refused,
              searchLatencyMs: meta.searchLatencyMs,
              llmLatencyMs: meta.llmLatencyMs,
              promptTokens: meta.promptTokens,
              completionTokens: meta.completionTokens,
              citedArticlesCount: citedCount,
            });
            res.end();
          },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal chat stream error';
      writeSseEvent(res, 'error', { error: 'CHAT_ERROR', message });
      res.end();
    }
  });

  return router;
}
