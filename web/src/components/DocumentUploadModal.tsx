import React, { useState } from 'react';

interface DocumentUploadModalProps {
  apiBaseUrl: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  apiBaseUrl
}) => {
  const [title, setTitle] = useState('Edital Pregão Eletrônico nº 01/2026');
  const [docType, setDocType] = useState<'edital' | 'lei' | 'decreto'>('edital');
  const [contentText, setContentText] = useState(
    'Art. 1º Este Edital regulamenta o pregão eletrônico para contratação de serviços de nuvem sob a Lei 14.133/2021.\nArt. 2º O critério de julgamento será o de menor preço por item.'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setStatusMessage('Solicitando URL pré-assinada do S3...');

    try {
      const res = await fetch(`${apiBaseUrl}/documents/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          docType,
          fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
          contentType: 'text/plain'
        })
      });

      const data = (await res.json()) as {
        documentId?: string;
        uploadUrl?: string;
        status?: string;
        message?: string;
      };

      if (!res.ok || !data.documentId || !data.uploadUrl) {
        setStatusMessage(data.message ?? 'Serviço de upload S3 indisponível.');
        setIsBusy(false);
        return;
      }

      setDocumentId(data.documentId);
      setIngestStatus(data.status ?? 'pending');
      setStatusMessage(
        `Documento registrado (${data.documentId}). Enviando arquivo para S3 e aguardando worker SQS...`
      );

      await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: contentText
      }).catch(() => {
        // Local preview when LocalStack is offline
      });

      const statusRes = await fetch(
        `${apiBaseUrl}/documents/${data.documentId}/status`
      );
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as { status?: string };
        setIngestStatus(statusData.status ?? 'pending');
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao iniciar upload assíncrono'
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '1.5rem 2rem' }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>
          Ingestão Assíncrona de Documentos (S3 Presigned URL + SQS + DLQ)
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Fluxo desacoplado de produção: a API gera uma URL pré-assinada para o
          Amazon S3 e publica um evento na fila SQS (com Dead-Letter Queue após
          3 falhas). O Worker Fargate consome a fila, aplica o chunking
          estrutural por artigo/inciso e indexa os vetores no PostgreSQL.
        </p>

        <form onSubmit={(e) => void handleUpload(e)}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.35rem'
              }}
            >
              Título do Documento / Edital
            </label>
            <input
              type="text"
              className="chat-input"
              style={{ width: '100%' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.35rem'
              }}
            >
              Tipo Normativo
            </label>
            <select
              className="chat-input"
              value={docType}
              onChange={(e) =>
                setDocType(e.target.value as 'edital' | 'lei' | 'decreto')
              }
            >
              <option value="edital">Edital de Licitação</option>
              <option value="lei">Lei Federal / Estadual</option>
              <option value="decreto">Decreto Regulamentar</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.35rem'
              }}
            >
              Conteúdo Textual do Documento
            </label>
            <textarea
              className="chat-input"
              style={{ width: '100%', minHeight: 140 }}
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isBusy}>
            {isBusy ? 'Enviando...' : 'Gerar Presigned URL & Enfileirar no SQS'}
          </button>
        </form>

        {statusMessage && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem'
            }}
          >
            <div>{statusMessage}</div>
            {documentId && (
              <div style={{ marginTop: '0.35rem' }}>
                ID: <strong>{documentId}</strong> • Status:{' '}
                <strong>{ingestStatus}</strong>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
