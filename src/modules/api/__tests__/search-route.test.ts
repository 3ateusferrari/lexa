import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { SearchResultItem } from '../../rag/vector-search.js';

describe('POST /search & GET /health', () => {
  const sampleResults: SearchResultItem[] = [
    {
      chunkId: '11111111-1111-1111-1111-111111111111',
      documentId: '22222222-2222-2222-2222-222222222222',
      documentTitle: 'Lei nº 14.133, de 1º de abril de 2021',
      docType: 'lei',
      article: 'Art. 75',
      sectionPath: 'TÍTULO II > CAPÍTULO VIII > Seção III - Da Dispensa de Licitação',
      page: null,
      content: 'Art. 75. É dispensável a licitação: I - para contratação que envolva valores inferiores a R$ 100.000,00...',
      score: 0.91,
    },
  ];

  it('returns 200 on GET /health', async () => {
    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(sampleResults),
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns 400 when query is too short or k is out of bounds', async () => {
    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(sampleResults),
    });

    const shortRes = await request(app).post('/search').send({ query: 'ab' });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.error).toBe('VALIDATION_ERROR');

    const badKRes = await request(app).post('/search').send({ query: 'dispensa de licitação', k: 99 });
    expect(badKRes.status).toBe(400);
  });

  it('executes search and returns ranked results with article metadata', async () => {
    const searchSpy = vi.fn().mockResolvedValue(sampleResults);
    const app = createApp({
      searchFn: searchSpy,
    });

    const res = await request(app)
      .post('/search')
      .send({ query: 'dispensa de licitação por valor', k: 5 });

    expect(res.status).toBe(200);
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'dispensa de licitação por valor',
        k: 5,
      }),
    );
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].article).toBe('Art. 75');
    expect(typeof res.body.latencyMs).toBe('number');
  });
});
