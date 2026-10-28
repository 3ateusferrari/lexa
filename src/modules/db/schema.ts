import {
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const EMBEDDING_DIM = 384;

const vectorType = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIM})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .filter(Boolean)
      .map(Number);
  },
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  docType: text('doc_type').notNull(), // 'lei' | 'edital' | 'contrato'
  sourceUrl: text('source_url'),
  downloadedAt: date('downloaded_at'),
  contentHash: text('content_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    article: text('article'),
    sectionPath: text('section_path'),
    page: integer('page'),
    content: text('content').notNull(),
    embedding: vectorType('embedding'),
  },
  (table) => [index('chunks_document_id_idx').on(table.documentId)],
);

export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  status: text('status').notNull(), // 'queued' | 'processing' | 'done' | 'failed'
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evalQuestions = pgTable('eval_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  expectedArticle: text('expected_article'), // null = pergunta sem resposta no corpus
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
});

export interface EvalRunConfig {
  chunking: 'structural' | 'fixed';
  searchMode: 'vector' | 'lexical' | 'hybrid';
  k: number;
  embeddingModel: string;
  reranker: string;
  refusalThreshold?: number;
  refusalAccuracy?: number;
  citationValidityRate?: number;
}

export const evalRuns = pgTable('eval_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  gitSha: text('git_sha').notNull(),
  config: jsonb('config').$type<EvalRunConfig>().notNull(),
  hitRate: real('hit_rate').notNull(),
  mrr: real('mrr').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
export type IngestionJobRow = typeof ingestionJobs.$inferSelect;
export type NewIngestionJobRow = typeof ingestionJobs.$inferInsert;
export type EvalQuestionRow = typeof evalQuestions.$inferSelect;
export type NewEvalQuestionRow = typeof evalQuestions.$inferInsert;
export type EvalRunRow = typeof evalRuns.$inferSelect;
export type NewEvalRunRow = typeof evalRuns.$inferInsert;
