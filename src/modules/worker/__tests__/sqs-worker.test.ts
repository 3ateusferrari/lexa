import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../api/app.js';
import { processIngestionQueueMessage, type IngestionQueueMessage } from '../sqs-worker.js';

describe('Upload Presigned URL & SQS Ingestion Worker (ISSUE-15)', () => {
  it('validates file extension and size on POST /documents/upload-url and creates a queued job', async () => {
    const createUploadJobSpy = vi.fn().mockResolvedValue({
      jobId: '33333333-3333-3333-3333-333333333333',
      uploadUrl: 'https://s3.localhost/lexa-documents/uploads/edital.html?X-Amz-Signature=123',
      s3Key: 'uploads/edital.html',
      status: 'queued',
    });

    const app = createApp({
      documentUploadService: {
        createPresignedUploadJob: createUploadJobSpy,
        getJobById: vi.fn().mockResolvedValue({
          id: '33333333-3333-3333-3333-333333333333',
          status: 'done',
          attempts: 1,
          documentId: '44444444-4444-4444-4444-444444444444',
          error: null,
        }),
      },
    });

    // Reject unsupported extension (.exe)
    const badExtRes = await request(app).post('/documents/upload-url').send({
      fileName: 'malware.exe',
      contentType: 'application/octet-stream',
      fileSizeBytes: 1024,
      title: 'Arquivo Inválido',
      docType: 'edital',
    });
    expect(badExtRes.status).toBe(400);

    // Reject oversized file (> 10 MB)
    const hugeRes = await request(app).post('/documents/upload-url').send({
      fileName: 'edital.pdf',
      contentType: 'application/pdf',
      fileSizeBytes: 25 * 1024 * 1024,
      title: 'Edital Gigante',
      docType: 'edital',
    });
    expect(hugeRes.status).toBe(400);

    // Accept valid document upload request
    const validRes = await request(app).post('/documents/upload-url').send({
      fileName: 'edital-pregao-01.html',
      contentType: 'text/html',
      fileSizeBytes: 45000,
      title: 'Edital de Pregão Eletrônico nº 01/2026',
      docType: 'edital',
    });
    expect(validRes.status).toBe(201);
    expect(validRes.body.jobId).toBe('33333333-3333-3333-3333-333333333333');
    expect(validRes.body.uploadUrl).toContain('https://');
  });

  it('transitions job status queued -> processing -> done on worker success and records error on failure', async () => {
    const statusUpdates: Array<{ status: string; incrementAttempt?: boolean; error?: string | null }> = [];

    const msg: IngestionQueueMessage = {
      jobId: 'job-123',
      s3Key: 'uploads/lei-teste.html',
      title: 'Lei Municipal de Teste',
      docType: 'lei',
      format: 'html',
      requestId: 'req-abc-123',
    };

    const result = await processIngestionQueueMessage(msg, {
      updateJobStatus: async (_id, update) => {
        statusUpdates.push(update);
      },
      fetchS3Content: async () =>
        '<h1>TÍTULO I</h1><p>Art. 1º Esta lei municipal regula contratações locais.</p>',
      ingestDocument: async () => ({
        documentId: 'doc-999',
        chunksCount: 1,
      }),
    });

    expect(result.status).toBe('done');
    expect(statusUpdates[0]).toMatchObject({ status: 'processing', incrementAttempt: true });
    expect(statusUpdates[1]).toMatchObject({ status: 'done', documentId: 'doc-999' });
  });
});
