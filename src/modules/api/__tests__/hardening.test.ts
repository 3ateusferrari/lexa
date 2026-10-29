import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { SearchResultItem } from '../../rag/vector-search.js';

describe('API Hardening: Rate Limiting, Daily LLM Budget, Example Cache & Helmet (ISSUE-16)', () => {
  const sampleChunks: SearchResultItem[] = [
    {
      chunkId: 'chunk-art-75',
      documentId: 'doc-14133',
      documentTitle: 'Lei nº 14.133/2021',
      docType: 'lei',
      article: 'Art. 75',
      sectionPath: 'TÍTULO II > CAPÍTULO VIII > Seção III',
      page: null,
      content: 'Art. 75. É dispensável a licitação: I - valores inferiores a R$ 100.000,00...',
      score: 0.9,
      rerankScore: 0.9,
    },
  ];

  it('sets security headers via Helmet and enforces IP rate limiting on POST /chat', async () => {
    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(sampleChunks),
      rateLimitMaxPerMinute: 2,
      maxDailyLlmCalls: 50,
    });

    const healthRes = await request(app).get('/health');
    expect(healthRes.headers['x-content-type-options']).toBe('nosniff');

    const r1 = await request(app).post('/chat').send({ question: 'Pergunta número um sobre dispensa' });
    expect(r1.status).toBe(200);

    const r2 = await request(app).post('/chat').send({ question: 'Pergunta número dois sobre dispensa' });
    expect(r2.status).toBe(200);

    const r3 = await request(app).post('/chat').send({ question: 'Pergunta número três bloqueada' });
    expect(r3.status).toBe(429);
    expect(r3.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('enforces daily LLM call budget limit while serving cached example questions without consuming budget', async () => {
    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(sampleChunks),
      rateLimitMaxPerMinute: 100,
      maxDailyLlmCalls: 1,
    });

    // Cached example question should NOT consume the 1 daily LLM call
    const exampleQuestion =
      'Qual o limite de valor para dispensa de licitação em obras e serviços de engenharia?';
    const exRes = await request(app).post('/chat').send({ question: exampleQuestion });
    expect(exRes.status).toBe(200);
    expect(exRes.text).toContain('"cached":true');

    // First non-cached call consumes the 1 allowed call
    const liveRes1 = await request(app)
      .post('/chat')
      .send({ question: 'Pergunta inédita número um sobre contratos administrativos' });
    expect(liveRes1.status).toBe(200);

    // Second non-cached call exceeds maxDailyLlmCalls = 1 -> HTTP 429
    const liveRes2 = await request(app)
      .post('/chat')
      .send({ question: 'Pergunta inédita número dois sobre contratos administrativos' });
    expect(liveRes2.status).toBe(429);
    expect(liveRes2.body.error).toBe('DAILY_LLM_BUDGET_EXCEEDED');
  });
});
