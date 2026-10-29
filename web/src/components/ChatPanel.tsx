import React, { useState } from 'react';
import {
  segmentAnswerWithCitations,
  streamChatQuestion,
  type CitationPayload
} from '../lib/chat-stream.js';
import { ExampleQuestions } from './ExampleQuestions.js';
import { CitationDrawer } from './CitationDrawer.js';

interface ChatPanelProps {
  apiBaseUrl: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ apiBaseUrl }) => {
  const [question, setQuestion] = useState('');
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<CitationPayload[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [refused, setRefused] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runQuestion = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isStreaming) return;

    setQuestion(trimmed);
    setActiveQuestion(trimmed);
    setAnswer('');
    setCitations([]);
    setSelectedSourceId(null);
    setRefused(false);
    setLatencyMs(null);
    setErrorMessage(null);
    setIsStreaming(true);

    try {
      await streamChatQuestion(apiBaseUrl, trimmed, {
        onToken: (token) => {
          setAnswer((prev) => prev + token);
        },
        onCitations: (items) => {
          setCitations(items);
          if (items[0]) {
            setSelectedSourceId(items[0].sourceId);
          }
        },
        onDone: (meta) => {
          setRefused(meta.refused);
          setLatencyMs(meta.latencyMs);
          setIsStreaming(false);
        },
        onError: (msg) => {
          setErrorMessage(msg);
          setIsStreaming(false);
        }
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha de conexão com a API'
      );
      setIsStreaming(false);
    }
  };

  const segments = segmentAnswerWithCitations(answer, citations);

  return (
    <div className="workspace-grid">
      <div className="chat-column">
        <ExampleQuestions
          disabled={isStreaming}
          onSelect={(exampleQ) => {
            void runQuestion(exampleQ);
          }}
        />

        <section className="card">
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void runQuestion(question);
            }}
          >
            <input
              type="text"
              className="chat-input"
              placeholder="Pergunte sobre a Lei 14.133/2021 (Licitações) ou Lei 13.709/2018 (LGPD)..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isStreaming}
              aria-label="Pergunta jurídica"
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={isStreaming || question.trim().length < 3}
            >
              {isStreaming ? 'Consultando...' : 'Consultar'}
            </button>
          </form>
        </section>

        {(activeQuestion || errorMessage) && (
          <section className="card" aria-live="polite">
            <div className="answer-header">
              <div>
                <strong style={{ fontSize: '0.95rem' }}>
                  {activeQuestion}
                </strong>
              </div>
              {latencyMs !== null && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  {latencyMs} ms
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="refusal-banner" role="alert">
                {errorMessage}
              </div>
            )}

            {refused && (
              <div className="refusal-banner">
                Recusa Segura Calibrada: Pergunta fora do escopo normativo ou
                abaixo do limiar mínimo de evidência (0.25).
              </div>
            )}

            <div className="answer-body">
              {segments.map((seg, idx) =>
                seg.type === 'text' ? (
                  <React.Fragment key={idx}>{seg.text}</React.Fragment>
                ) : (
                  <button
                    key={idx}
                    type="button"
                    className={`citation-badge ${
                      selectedSourceId === seg.sourceId ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedSourceId(seg.sourceId)}
                    title={
                      seg.citation
                        ? `${seg.citation.documentTitle} — ${seg.citation.articleRef}`
                        : seg.sourceId
                    }
                  >
                    {seg.label}
                  </button>
                )
              )}
            </div>
          </section>
        )}
      </div>

      <CitationDrawer
        citations={citations}
        selectedSourceId={selectedSourceId}
        onSelectSource={(sourceId) => setSelectedSourceId(sourceId)}
      />
    </div>
  );
};
