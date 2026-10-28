import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  executeGroundedChatStream,
  type LlmStreamAdapter,
} from '../../rag/chat-service.js';
import type { SearchResultItem } from '../../rag/vector-search.js';

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
}

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createChatRouter(deps: ChatRouterDependencies): Router {
  const router = Router();

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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

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
            writeSseEvent(res, 'citations', {
              citations,
              isValid: validation.isValid,
              validChunkIds: validation.validChunkIds,
              invalidChunkIds: validation.invalidChunkIds,
            });
          },
          onDone: (meta) => {
            writeSseEvent(res, 'done', meta);
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
