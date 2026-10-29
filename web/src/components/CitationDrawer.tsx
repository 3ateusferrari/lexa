import React from 'react';
import type { CitationPayload } from '../lib/chat-stream.js';

interface CitationDrawerProps {
  citations: CitationPayload[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  citations,
  selectedSourceId,
  onSelectSource
}) => {
  return (
    <aside className="card drawer-card" aria-label="Fontes e Dispositivos Citados">
      <div className="answer-header">
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
          Dispositivos Normativos ({citations.length})
        </h2>
      </div>
      {citations.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Envie uma pergunta ou clique em uma citação <code>[Fonte N]</code> para
          inspecionar o texto integral do artigo recuperado e seu score de
          relevância.
        </p>
      ) : (
        citations.map((item) => {
          const isSelected = selectedSourceId === item.sourceId;
          return (
            <div
              key={item.sourceId}
              className={`source-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectSource(item.sourceId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectSource(item.sourceId);
                }
              }}
            >
              <div className="source-meta">
                <span>[{item.sourceId}]</span>
                <span>Score: {(item.rerankScore * 100).toFixed(1)}%</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {item.documentTitle} — {item.articleRef}
              </div>
              <p className="source-excerpt">{item.content}</p>
            </div>
          );
        })
      )}
    </aside>
  );
};
