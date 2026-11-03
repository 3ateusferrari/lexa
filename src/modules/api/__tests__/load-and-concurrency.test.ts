import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runLoadTestScenario } from '../../../scripts/load-test.js';
import type { LlmStreamAdapter } from '../../rag/chat-service.js';
import type { SearchResultItem } from '../../rag/vector-search.js';
import { createApp } from '../app.js';

describe('Concurrent Load & Stress Scenarios (API, Hybrid Search, SSE & Rate Limiting)', () => {
  let server: Server;
  let baseUrl: string;

  const mockChunks: SearchResultItem[] = [
    {
      chunkId: 'chunk-load-75',
      documentId: '11111111-1111-1111-1111-111111111111',
      documentTitle: 'Lei nº 14.133/2021',
      docType: 'lei',
      article: 'Art. 75',
      sectionPath: 'TÍTULO II > CAPÍTULO VIII > Seção III',
      page: null,
      content:
        'Art. 75. É dispensável a licitação para valores inferiores a R$ 100.000,00 em obras e serviços de engenharia.',
      score: 0.92,
      rerankScore: 0.92,
    },
  ];

  const fastLlm: LlmStreamAdapter = {
    async *streamAnswer() {
      yield 'A dispensa aplica-se até R$ 100.000,00 ';
      yield '[Fonte 1].';
      return { promptTokens: 80, completionTokens: 12 };
    },
  };

  beforeAll(async () => {
    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(mockChunks),
      llmAdapter: fastLlm,
      rateLimitMaxPerMinute: 15,
      maxDailyLlmCalls: 500,
    });
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('handles 60 concurrent /health and /search requests with 100% success and calculates p50/p95/p99 metrics', async () => {
    const healthReport = await runLoadTestScenario(
      'Concurrent /health check',
      60,
      15,
      async () => {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/health`);
        return {
          statusCode: res.status,
          durationMs: performance.now() - t0,
          success: res.ok,
        };
      },
    );

    expect(healthReport.totalRequests).toBe(60);
    expect(healthReport.successRate).toBe(100);
    expect(healthReport.statusCodes[200]).toBe(60);
    expect(healthReport.latencies.p95).toBeGreaterThanOrEqual(healthReport.latencies.p50);

    const searchReport = await runLoadTestScenario(
      'Concurrent POST /search',
      40,
      10,
      async (idx) => {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `Consulta concorrente número ${idx} sobre dispensa de licitação`,
            mode: 'hybrid',
            k: 5,
          }),
        });
        return {
          statusCode: res.status,
          durationMs: performance.now() - t0,
          success: res.ok,
        };
      },
    );

    expect(searchReport.successRate).toBe(100);
    expect(searchReport.statusCodes[200]).toBe(40);
  });

  it('streams concurrent SSE responses on POST /chat and enforces IP rate limiting under burst load', async () => {
    const sseReport = await runLoadTestScenario(
      'Concurrent SSE /chat from distinct IPs',
      20,
      5,
      async (idx) => {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `10.20.30.${idx + 1}`,
          },
          body: JSON.stringify({
            question: `Qual o limite de dispensa na consulta ${idx}?`,
          }),
        });
        const text = await res.text();
        return {
          statusCode: res.status,
          durationMs: performance.now() - t0,
          success:
            res.ok &&
            text.includes('event: token') &&
            text.includes('event: citations') &&
            text.includes('event: done'),
        };
      },
    );

    expect(sseReport.successRate).toBe(100);
    expect(sseReport.statusCodes[200]).toBe(20);

    const burstReport = await runLoadTestScenario(
      'Burst DoS from single IP on POST /chat',
      25,
      8,
      async () => {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '172.16.99.99',
          },
          body: JSON.stringify({
            question: 'Consulta em rajada do mesmo IP para validar rate limit',
          }),
        });
        await res.text();
        return {
          statusCode: res.status,
          durationMs: performance.now() - t0,
          success: res.status === 200 || res.status === 429,
        };
      },
    );

    expect(burstReport.successRate).toBe(100);
    expect(burstReport.statusCodes[200]).toBe(15);
    expect(burstReport.statusCodes[429]).toBe(10);
  });
});
