import 'dotenv/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { createResilientDatabaseConnection } from '../db/client.js';
import { IngestionJobsRepository } from '../db/repositories/index.js';
import { CachedEmbedder, createLocalEmbeddingProvider } from '../ingestion/embedder.js';
import type { DocumentInputFormat } from '../ingestion/extractor.js';
import { IngestService } from '../ingestion/ingest-service.js';
import { getAppLogger } from '../shared/logger.js';

const logger = getAppLogger('sqs-worker');

export interface IngestionQueueMessage {
  jobId: string;
  s3Key: string;
  title: string;
  docType: string;
  sourceUrl?: string | null;
  format?: DocumentInputFormat;
  requestId?: string;
}

export interface WorkerMessageDependencies {
  updateJobStatus: (
    jobId: string,
    update: {
      status: 'queued' | 'processing' | 'done' | 'failed';
      documentId?: string;
      error?: string | null;
      incrementAttempt?: boolean;
    },
  ) => Promise<unknown>;
  fetchS3Content: (s3Key: string) => Promise<string>;
  ingestDocument: (input: {
    title: string;
    docType: string;
    sourceUrl?: string | null;
    rawContent: string;
    format: DocumentInputFormat;
  }) => Promise<{ documentId: string; chunksCount: number }>;
}

export async function processIngestionQueueMessage(
  msg: IngestionQueueMessage,
  deps: WorkerMessageDependencies,
): Promise<{ status: 'done'; documentId: string; chunksCount: number }> {
  await deps.updateJobStatus(msg.jobId, {
    status: 'processing',
    incrementAttempt: true,
    error: null,
  });

  logger.info({
    event: 'worker_job_processing_started',
    jobId: msg.jobId,
    requestId: msg.requestId,
    s3Key: msg.s3Key,
    title: msg.title,
  });

  try {
    const rawContent = await deps.fetchS3Content(msg.s3Key);
    const ingested = await deps.ingestDocument({
      title: msg.title,
      docType: msg.docType,
      sourceUrl: msg.sourceUrl ?? null,
      rawContent,
      format: msg.format ?? 'html',
    });

    await deps.updateJobStatus(msg.jobId, {
      status: 'done',
      documentId: ingested.documentId,
      error: null,
    });

    return {
      status: 'done',
      documentId: ingested.documentId,
      chunksCount: ingested.chunksCount,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown worker error';
    await deps.updateJobStatus(msg.jobId, {
      status: 'failed',
      error: errorMessage,
    });
    throw err;
  }
}

export async function startSqsWorkerLoop(options: {
  databaseUrl: string;
  queueUrl: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  abortSignal?: AbortSignal;
}): Promise<void> {
  const conn = await createResilientDatabaseConnection(options.databaseUrl);
  const jobsRepo = new IngestionJobsRepository(conn.db);
  const embedder = new CachedEmbedder(createLocalEmbeddingProvider());
  const ingestService = new IngestService(conn.db, embedder);

  const region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
  const s3 = new S3Client({
    region,
    ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
  });
  const sqs = new SQSClient({
    region,
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
  });

  try {
    while (!options.abortSignal?.aborted) {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: options.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 10,
          MessageAttributeNames: ['All'],
        }),
      );

      for (const message of response.Messages ?? []) {
        if (!message.Body || !message.ReceiptHandle) continue;
        const payload = JSON.parse(message.Body) as IngestionQueueMessage;

        await processIngestionQueueMessage(payload, {
          updateJobStatus: (jobId, update) => jobsRepo.updateStatus(jobId, update),
          fetchS3Content: async (s3Key) => {
            const obj = await s3.send(
              new GetObjectCommand({
                Bucket: options.bucket,
                Key: s3Key,
              }),
            );
            return (await obj.Body?.transformToString('utf-8')) ?? '';
          },
          ingestDocument: async (input) => {
            const res = await ingestService.ingestDocument({
              ...input,
              downloadedAt: new Date().toISOString().slice(0, 10),
            });
            return {
              documentId: res.document.id,
              chunksCount: res.chunksCount,
            };
          },
        });

        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: options.queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
      }
    }
  } finally {
    await conn.close();
  }
}
