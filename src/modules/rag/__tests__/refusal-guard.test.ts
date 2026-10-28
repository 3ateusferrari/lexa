import { describe, expect, it } from 'vitest';
import { rerankChunks } from '../reranker.js';
import { evaluateRefusalGuard } from '../refusal-guard.js';
import type { SearchResultItem } from '../vector-search.js';

describe('Reranker & Refusal Guard (ISSUE-12)', () => {
  const candidates: SearchResultItem[] = [
    {
      chunkId: 'chunk-74',
      documentId: 'doc-1',
      documentTitle: 'Lei 14.133/2021',
      docType: 'lei',
      article: 'Art. 74',
      sectionPath: 'TÍTULO II > CAPÍTULO VIII > Seção II - Da Inexigibilidade de Licitação',
      page: null,
      content:
        'Art. 74. É inexigível a licitação quando inviável a competição, em especial nos casos de fornecedor exclusivo.',
      score: 0.032,
      vectorScore: 0.65,
      lexicalScore: 0.1,
    },
    {
      chunkId: 'chunk-75',
      documentId: 'doc-1',
      documentTitle: 'Lei 14.133/2021',
      docType: 'lei',
      article: 'Art. 75',
      sectionPath: 'TÍTULO II > CAPÍTULO VIII > Seção III - Da Dispensa de Licitação',
      page: null,
      content:
        'Art. 75. É dispensável a licitação: I - para contratação que envolva valores inferiores a R$ 100.000,00 no caso de obras e serviços de engenharia; II - R$ 50.000,00 para outros serviços e compras.',
      score: 0.031,
      vectorScore: 0.72,
      lexicalScore: 0.25,
    },
  ];

  it('promotes the candidate with highest cross-feature relevance to rank 1', () => {
    const reranked = rerankChunks(
      'Qual o limite de valor para dispensa de licitação em obras de engenharia R$ 100.000,00?',
      candidates,
      { topK: 5 },
    );

    expect(reranked[0]?.article).toBe('Art. 75');
    expect(reranked[0]?.rerankScore).toBeGreaterThan(reranked[1]!.rerankScore!);
  });

  it('refuses to answer when query is out of corpus and top relevance falls below calibrated threshold', () => {
    const outOfCorpusReranked = rerankChunks(
      'Como preparar uma receita tradicional de pão de queijo mineiro com polvilho azedo?',
      candidates.map((c) => ({ ...c, vectorScore: 0.04, lexicalScore: undefined })),
      { topK: 5 },
    );

    const decision = evaluateRefusalGuard(outOfCorpusReranked);
    expect(decision.refused).toBe(true);
    expect(decision.reason).toContain('limiar de relevância');

    const validReranked = rerankChunks(
      'Qual o limite de valor para dispensa de licitação em obras de engenharia?',
      candidates,
      { topK: 5 },
    );
    const validDecision = evaluateRefusalGuard(validReranked);
    expect(validDecision.refused).toBe(false);
  });
});
