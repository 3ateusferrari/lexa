import { describe, expect, it } from 'vitest';
import {
  parseSseChunk,
  segmentAnswerWithCitations,
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
});
