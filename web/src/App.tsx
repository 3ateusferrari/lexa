import React, { useState } from 'react';
import { ChatPanel } from './components/ChatPanel.js';
import { QualityDashboard } from './components/QualityDashboard.js';
import { DocumentUploadModal } from './components/DocumentUploadModal.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'quality' | 'upload'>(
    'chat'
  );

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

        <nav className="nav-tabs" aria-label="Navegação Principal">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Consulta Jurídica (RAG)
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            Painel de Qualidade & Experimentos
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Ingestão Assíncrona (S3 + SQS)
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'chat' && <ChatPanel apiBaseUrl={apiBaseUrl} />}
        {activeTab === 'quality' && (
          <QualityDashboard apiBaseUrl={apiBaseUrl} />
        )}
        {activeTab === 'upload' && (
          <DocumentUploadModal apiBaseUrl={apiBaseUrl} />
        )}
      </main>
    </div>
  );
};
