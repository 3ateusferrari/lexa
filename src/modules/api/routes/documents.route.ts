import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { DbClient } from '../../db/client.js';
import { DocumentsRepository, IngestionJobsRepository } from '../../db/repositories/index.js';
import type { IngestionJobRow } from '../../db/schema.js';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadUrlRequestSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .regex(/\.(pdf|html|htm)$/i, 'Only .pdf, .html, or .htm files are allowed'),
  contentType: z.enum(['application/pdf', 'text/html', 'text/plain']),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_SIZE_BYTES, 'File size exceeds 10 MB limit'),
  title: z.string().trim().min(3).max(200),
  docType: z.enum(['lei', 'edital', 'contrato']),
  sourceUrl: z.string().url().optional(),
});

export type UploadUrlRequestInput = z.infer<typeof uploadUrlRequestSchema>;

export interface PresignedUploadJobResult {
  jobId: string;
  uploadUrl: string;
  s3Key: string;
  status: string;
}

export interface DocumentUploadService {
  createPresignedUploadJob(
    input: UploadUrlRequestInput,
    requestId?: string,
  ): Promise<PresignedUploadJobResult>;
  getJobById(jobId: string): Promise<IngestionJobRow | undefined>;
}

export function createAwsDocumentUploadService(db: DbClient): DocumentUploadService {
  const jobsRepo = new IngestionJobsRepository(db);
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const bucket = process.env.S3_DOCUMENTS_BUCKET ?? 'lexa-documents';
  const queueUrl =
    process.env.SQS_INGESTION_QUEUE_URL ??
    'http://localhost:4566/000000000000/lexa-ingestion-queue';

  const s3 = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });

  const sqs = new SQSClient({
    region,
    ...(endpoint ? { endpoint } : {}),
  });

  return {
    async createPresignedUploadJob(input, requestId) {
      const job = await jobsRepo.create({
        status: 'queued',
        attempts: 0,
      });

      const safeFile = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const s3Key = `uploads/${job.id}-${randomUUID().slice(0, 8)}-${safeFile}`;

      const putCmd = new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        ContentType: input.contentType,
      });

      const uploadUrl = await getSignedUrl(s3, putCmd, { expiresIn: 900 });

      try {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              jobId: job.id,
              s3Key,
              title: input.title,
              docType: input.docType,
              sourceUrl: input.sourceUrl ?? null,
              format: input.fileName.toLowerCase().endsWith('.pdf') ? 'text' : 'html',
              requestId: requestId ?? randomUUID(),
            }),
            ...(requestId
              ? {
                  MessageAttributes: {
                    RequestId: {
                      DataType: 'String',
                      StringValue: requestId,
                    },
                  },
                }
              : {}),
          }),
        );
      } catch {
        // In local mode without LocalStack running, the job remains queued in DB
      }

      return {
        jobId: job.id,
        uploadUrl,
        s3Key,
        status: job.status,
      };
    },
    async getJobById(jobId) {
      return jobsRepo.findById(jobId);
    },
  };
}

export function createDocumentsRouter(deps: {
  db?: DbClient;
  uploadService?: DocumentUploadService;
}): Router {
  const router = Router();
  const service =
    deps.uploadService ??
    (deps.db ? createAwsDocumentUploadService(deps.db) : undefined);

  router.get('/', async (_req: Request, res: Response) => {
    if (!deps.db) {
      res.status(200).json({ documents: [] });
      return;
    }
    const docsRepo = new DocumentsRepository(deps.db);
    const docs = await docsRepo.listAll();
    res.status(200).json({ documents: docs });
  });

  router.post('/upload-url', async (req: Request, res: Response) => {
    const parsed = uploadUrlRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid upload request',
        details: parsed.error.issues,
      });
      return;
    }

    if (!service) {
      res.status(500).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Document upload service is not configured',
      });
      return;
    }

    const requestId = req.headers['x-request-id'] as string | undefined;
    const result = await service.createPresignedUploadJob(parsed.data, requestId);
    res.status(201).json(result);
  });

  router.get('/jobs/:id', async (req: Request, res: Response) => {
    if (!service) {
      res.status(500).json({ error: 'SERVICE_UNAVAILABLE' });
      return;
    }
    const jobId = String(req.params.id ?? '');
    const job = await service.getJobById(jobId);
    if (!job) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Ingestion job not found' });
      return;
    }
    res.status(200).json(job);
  });

  return router;
}
