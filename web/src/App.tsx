import React from 'react';
import { ChatPanel } from './components/ChatPanel.js';

export const App: React.FC = () => {
  const apiBaseUrl =
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_API_BASE_URL ?? '';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <h1 className="brand-title">Lexa — Assistente RAG Jurídico</h1>
          <p className="brand-subtitle">
            Lei nº 14.133/2021 (Nova Lei de Licitações) & Lei nº 13.709/2018
            (LGPD) • Busca Híbrida + Reranking + Citações Verificáveis
          </p>
        </div>
      </header>

      <main>
        <ChatPanel apiBaseUrl={apiBaseUrl} />
      </main>
    </div>
  );
};
