import React, { useEffect, useState } from 'react';

export interface EvalRunView {
  id: string;
  gitSha: string;
  label: string;
  config: {
    k: number;
    chunking: string;
    reranker: string;
    searchMode: string;
    embeddingModel: string;
    refusalThreshold?: number;
  };
  metrics: {
    hitRateAt5: number;
    mrr: number;
    refusalAccuracy: number;
  };
  createdAt: string;
}

interface QualityDashboardProps {
  apiBaseUrl: string;
}

const FALLBACK_RUNS: EvalRunView[] = [
  {
    id: 'd3eb983d-fda6-4aa3-bdfb-1d4a01884d4c',
    gitSha: '7997cb9',
    label:
      'Exp 3B / 4B (Produção): Estrutural + Híbrido + Reranker + Refusal Guard (local-legal-pt-v1)',
    config: {
      k: 5,
      chunking: 'structural',
      reranker: 'local-cross-reranker-v1',
      searchMode: 'hybrid',
      embeddingModel: 'local-legal-pt-v1',
      refusalThreshold: 0.25
    },
    metrics: { hitRateAt5: 1.0, mrr: 0.9741, refusalAccuracy: 1.0 },
    createdAt: '2026-10-28T22:41:20.722Z'
  },
  {
    id: '190b7e96-be20-49bd-a2d1-d47e7c39421a',
    gitSha: '7997cb9',
    label:
      'Exp 4A: Estrutural + Híbrido + Reranker (Modelo local-char-ngram-v1)',
    config: {
      k: 5,
      chunking: 'structural',
      reranker: 'local-cross-reranker-v1',
      searchMode: 'hybrid',
      embeddingModel: 'local-char-ngram-v1',
      refusalThreshold: 0.25
    },
    metrics: { hitRateAt5: 1.0, mrr: 0.9833, refusalAccuracy: 1.0 },
    createdAt: '2026-10-28T22:41:20.002Z'
  },
  {
    id: '0bdbb48a-09da-4fdd-a9af-f0e68a968b5f',
    gitSha: '7997cb9',
    label: 'Exp 2C / 3A: Chunking Estrutural + Híbrido (RRF) sem Reranking',
    config: {
      k: 5,
      chunking: 'structural',
      reranker: 'none',
      searchMode: 'hybrid',
      embeddingModel: 'local-legal-pt-v1'
    },
    metrics: { hitRateAt5: 0.9778, mrr: 0.8341, refusalAccuracy: 0.0 },
    createdAt: '2026-10-28T22:41:18.863Z'
  },
  {
    id: 'fa879ac5-ad1f-4757-95f9-6a13a2acdc0f',
    gitSha: '7997cb9',
    label:
      'Exp 1B / 2A: Chunking Estrutural (Artigo/Inciso) + Busca Vetorial',
    config: {
      k: 5,
      chunking: 'structural',
      reranker: 'none',
      searchMode: 'vector',
      embeddingModel: 'local-legal-pt-v1'
    },
    metrics: { hitRateAt5: 0.9778, mrr: 0.9778, refusalAccuracy: 0.0 },
    createdAt: '2026-10-28T22:41:17.783Z'
  },
  {
    id: 'fb5d0265-e74f-427b-ba4c-ea25c5333cd3',
    gitSha: '7997cb9',
    label: 'Exp 2B: Chunking Estrutural + Busca Lexical (tsvector pt-BR)',
    config: {
      k: 5,
      chunking: 'structural',
      reranker: 'none',
      searchMode: 'lexical',
      embeddingModel: 'local-legal-pt-v1'
    },
    metrics: { hitRateAt5: 0.8667, mrr: 0.5967, refusalAccuracy: 0.0 },
    createdAt: '2026-10-28T22:41:18.223Z'
  },
  {
    id: '0e6eded2-3c23-45ab-9503-2b16bd4be591',
    gitSha: '7997cb9',
    label: 'Exp 1A: Chunking Fixo (240 chars) + Busca Vetorial',
    config: {
      k: 5,
      chunking: 'fixed',
      reranker: 'none',
      searchMode: 'vector',
      embeddingModel: 'local-legal-pt-v1'
    },
    metrics: { hitRateAt5: 0.6444, mrr: 0.4244, refusalAccuracy: 0.0 },
    createdAt: '2026-10-28T22:41:16.991Z'
  }
];

export const QualityDashboard: React.FC<QualityDashboardProps> = ({
  apiBaseUrl
}) => {
  const [runs, setRuns] = useState<EvalRunView[]>(FALLBACK_RUNS);
  const [totalQuestions, setTotalQuestions] = useState(55);
  const [answerableCount, setAnswerableCount] = useState(45);
  const [refusalCount, setRefusalCount] = useState(10);

  useEffect(() => {
    fetch(`${apiBaseUrl}/eval/runs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.runs) && data.runs.length > 0) {
          setRuns(data.runs as EvalRunView[]);
        }
        if (data?.dataset) {
          setTotalQuestions(Number(data.dataset.totalQuestions ?? 55));
          setAnswerableCount(Number(data.dataset.answerableCount ?? 45));
          setRefusalCount(Number(data.dataset.refusalCount ?? 10));
        }
      })
      .catch(() => {
        // Keep static fallback runs
      });
  }, [apiBaseUrl]);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '1.5rem 2rem' }}>
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>
          Painel de Qualidade & Experimentos RAG (Avaliação Quantitativa)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Dataset dourado manual com <strong>{totalQuestions} perguntas</strong>{' '}
          ({answerableCount} respondíveis com artigo esperado da Lei
          14.133/2021 e LGPD + {refusalCount} perguntas fora do escopo para
          validação de recusa segura). Gate de CI exige{' '}
          <code>Hit Rate@5 &ge; 75%</code> e <code>MRR &ge; 0.60</code>.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.88rem'
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--border-subtle)',
                  textAlign: 'left'
                }}
              >
                <th style={{ padding: '0.75rem' }}>Experimento / Configuração</th>
                <th style={{ padding: '0.75rem' }}>Chunking</th>
                <th style={{ padding: '0.75rem' }}>Busca</th>
                <th style={{ padding: '0.75rem' }}>Reranker</th>
                <th style={{ padding: '0.75rem' }}>Hit Rate@5</th>
                <th style={{ padding: '0.75rem' }}>MRR</th>
                <th style={{ padding: '0.75rem' }}>Acurácia de Recusa</th>
                <th style={{ padding: '0.75rem' }}>Commit</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                    {run.label}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {run.config.chunking}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {run.config.searchMode}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {run.config.reranker}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      fontWeight: 700,
                      color:
                        run.metrics.hitRateAt5 >= 0.95
                          ? 'var(--accent-success)'
                          : 'var(--text-primary)'
                    }}
                  >
                    {(run.metrics.hitRateAt5 * 100).toFixed(1)}%
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700
                    }}
                  >
                    {run.metrics.mrr.toFixed(4)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {(run.metrics.refusalAccuracy * 100).toFixed(0)}%
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem'
                    }}
                  >
                    {run.gitSha}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
