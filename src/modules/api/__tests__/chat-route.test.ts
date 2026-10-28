import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { LlmStreamAdapter } from '../../rag/chat-service.js';
import type { SearchResultItem } from '../../rag/vector-search.js';

describe('POST /chat SSE Streaming & Refusal Guard (ISSUE-14)', () => {
  const highRelevanceChunks: SearchResultItem[] = [
    {
      chunkId: 'chunk-art-75',
      documentId: 'doc-14133',
      documentTitle: 'Lei nº 14.133/2021',
      docType: 'lei',
      article: 'Art. 75',
      sectionPath: 'TÍTULO II > CAPÍTULO VIII > Seção III',
      page: null,
      content:
        'Art. 75. É dispensável a licitação: I - valores inferiores a R$ 100.000,00 para obras e serviços de engenharia.',
      score: 0.88,
      rerankScore: 0.88,
    },
  ];

  it('streams SSE token, citations, and done events for grounded questions', async () => {
    const fakeLlm: LlmStreamAdapter = {
      async *streamAnswer() {
        yield 'O limite é R$ 100.000,00 ';
        yield '[chunk-art-75].';
        return { promptTokens: 120, completionTokens: 18 };
      },
    };

    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(highRelevanceChunks),
      llmAdapter: fakeLlm,
    });

    const res = await request(app)
      .post('/chat')
      .send({ question: 'Qual o limite de dispensa para obras de engenharia?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: token');
    expect(res.text).toContain('O limite é R$ 100.000,00 ');
    expect(res.text).toContain('event: citations');
    expect(res.text).toContain('"chunkId":"chunk-art-75"');
    expect(res.text).toContain('event: done');
    expect(res.text).toContain('"refused":false');
  });

  it('refuses immediately via SSE without calling LLM when top chunk score is below threshold', async () => {
    const llmSpy = vi.fn();
    const fakeLlm: LlmStreamAdapter = {
      // eslint-disable-next-line require-yield
      async *streamAnswer() {
        llmSpy();
        return { promptTokens: 0, completionTokens: 0 };
      },
    };

    const lowScoreChunks: SearchResultItem[] = [
      {
        ...highRelevanceChunks[0]!,
        score: 0.08,
        rerankScore: 0.08,
      },
    ];

    const app = createApp({
      searchFn: vi.fn().mockResolvedValue(lowScoreChunks),
      llmAdapter: fakeLlm,
    });

    const res = await request(app)
      .post('/chat')
      .send({ question: 'Como fazer receita de pão de queijo mineiro?' });

    expect(res.status).toBe(200);
    expect(llmSpy).not.toHaveBeenCalled();
    expect(res.text).toContain('"refused":true');
    expect(res.text).toContain('Não encontrei informações suficientes');
  });
});
