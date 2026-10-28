import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { SearchResultItem } from '../../rag/vector-search.js';

export const searchRequestSchema = z.object({
  query: z.string().trim().min(3, 'Query must have at least 3 characters').max(500),
  k: z.number().int().min(1).max(20).default(5),
  documentId: z.string().uuid().optional(),
  docType: z.string().trim().min(1).max(50).optional(),
  mode: z.enum(['vector', 'lexical', 'hybrid']).default('vector'),
  rerank: z.boolean().default(true),
});

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;

export type SearchExecutor = (input: SearchRequestInput) => Promise<SearchResultItem[]>;

export function createSearchRouter(searchFn: SearchExecutor): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const parsed = searchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid search payload',
        details: parsed.error.issues,
      });
      return;
    }

    const startedAt = performance.now();
    try {
      const results = await searchFn(parsed.data);
      const latencyMs = Math.round(performance.now() - startedAt);
      res.status(200).json({
        query: parsed.data.query,
        mode: parsed.data.mode,
        k: parsed.data.k,
        latencyMs,
        results,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal search error';
      res.status(500).json({
        error: 'SEARCH_ERROR',
        message,
      });
    }
  });

  return router;
}
