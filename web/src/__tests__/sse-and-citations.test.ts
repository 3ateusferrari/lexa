import { describe, expect, it, vi } from 'vitest';
import {
  parseSseChunk,
  segmentAnswerWithCitations,
  streamChatQuestion,
  EXAMPLE_QUESTIONS_UI,
  type CitationPayload
} from '../lib/chat-stream.js';

describe('Frontend Chat SSE Parser & Citation Highlighter (ISSUE-17)', () => {
  it('parses SSE events (token, citations, done) from chunked EventStream text', () => {
    const rawStream = [
      'event: token\ndata: {"token":"O pregão "}\n\n',
      'event: token\ndata: {"token":"é obrigatório [Fonte 1]."}\n\n',
      'event: citations\ndata: {"citations":[{"sourceId":"Fonte 1","documentTitle":"Lei 14.133/2021","articleRef":"Art. 6º, XLI","content":"Pregão: modalidade de licitação obrigatória para bens e serviços comuns.","rerankScore":0.92}],"usedSources":["Fonte 1"]}\n\n',
      'event: done\ndata: {"refused":false,"latencyMs":42,"modelId":"claude-3-5-haiku-latest","cached":true}\n\n'
    ].join('');

    const events = parseSseChunk(rawStream);
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ event: 'token', data: { token: 'O pregão ' } });
    expect(events[2]?.event).toBe('citations');
    expect(events[3]).toEqual({
      event: 'done',
      data: {
        refused: false,
        latencyMs: 42,
        modelId: 'claude-3-5-haiku-latest',
        cached: true
      }
    });
  });

  it('segments answer text into text nodes and clickable [Fonte N] badges mapped to citations', () => {
    const citations: CitationPayload[] = [
      {
        sourceId: 'Fonte 1',
        documentTitle: 'Lei nº 14.133/2021',
        articleRef: 'Art. 6º, Inciso XLI',
        content: 'Pregão: modalidade de licitação obrigatória para aquisição de bens e serviços comuns.',
        rerankScore: 0.91
      }
    ];

    const segments = segmentAnswerWithCitations(
      'Conforme o artigo citado [Fonte 1], aplica-se o pregão.',
      citations
    );

    expect(segments).toEqual([
      { type: 'text', text: 'Conforme o artigo citado ' },
      {
        type: 'citation',
        sourceId: 'Fonte 1',
        label: '[Fonte 1]',
        citation: citations[0]
      },
      { type: 'text', text: ', aplica-se o pregão.' }
    ]);
  });

  it('exposes pre-populated example questions covering Lei 14.133, LGPD and out-of-scope refusal', () => {
    expect(EXAMPLE_QUESTIONS_UI.length).toBeGreaterThanOrEqual(4);
    expect(EXAMPLE_QUESTIONS_UI.some((q) => q.category === 'Fora do Escopo')).toBe(true);
  });

  it('handles trailing buffer when stream closes without double newline', async () => {
    const tokens: string[] = [];
    let doneMeta: unknown;

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: token\ndata: {"token":"Olá"}\n\n'));
        // Trailing chunk without trailing double newline
        controller.enqueue(
          new TextEncoder().encode('event: done\ndata: {"refused":false,"latencyMs":100}')
        );
        controller.close();
      }
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream
    });

    await streamChatQuestion('http://localhost:3000', 'pergunta teste', {
      onToken: (t) => tokens.push(t),
      onCitations: () => {},
      onDone: (meta) => {
        doneMeta = meta;
      },
      onError: () => {}
    });

    expect(tokens).toEqual(['Olá']);
    expect(doneMeta).toMatchObject({ refused: false, latencyMs: 100 });
  });

  it('segments answers containing non-UUID chunkId references like [example-art-75] or [chunk-art-75] into clickable [Fonte N] badges', () => {
    const citations: CitationPayload[] = [
      {
        sourceId: 'Fonte 1',
        chunkId: 'example-art-75',
        documentTitle: 'Lei nº 14.133/2021',
        articleRef: 'Art. 75',
        content: 'Art. 75. É dispensável a licitação...',
        rerankScore: 0.98
      }
    ];

    const segments = segmentAnswerWithCitations(
      'A licitação é dispensável até R$ 100.000,00 [example-art-75].',
      citations
    );

    expect(segments).toEqual([
      { type: 'text', text: 'A licitação é dispensável até R$ 100.000,00 ' },
      {
        type: 'citation',
        sourceId: 'Fonte 1',
        label: '[Fonte 1]',
        citation: citations[0]
      },
      { type: 'text', text: '.' }
    ]);
  });

  it('invokes onError when response is not ok or when an SSE error event is received', async () => {
    const errors: string[] = [];

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Limite de requisições excedido' })
    });

    await streamChatQuestion('http://localhost:3000', 'pergunta teste', {
      onToken: () => {},
      onCitations: () => {},
      onDone: () => {},
      onError: (msg) => errors.push(msg)
    });

    expect(errors).toEqual(['Limite de requisições excedido']);
  });
});
