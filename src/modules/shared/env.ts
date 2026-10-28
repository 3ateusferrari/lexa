import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOCAL_EMBEDDING_MODEL: z.string().default('Xenova/multilingual-e5-small'),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(384),
  EMBEDDING_CACHE_DIR: z.string().default('.cache/embeddings'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-haiku-latest'),
  MAX_DAILY_LLM_CALLS: z.coerce.number().int().positive().default(200),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ENDPOINT_URL: z.string().optional(),
  S3_DOCUMENTS_BUCKET: z.string().default('lexa-documents'),
  SQS_INGESTION_QUEUE_URL: z
    .string()
    .default('http://localhost:4566/000000000000/lexa-ingestion-queue'),
  SQS_INGESTION_DLQ_URL: z
    .string()
    .default('http://localhost:4566/000000000000/lexa-ingestion-dlq'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
