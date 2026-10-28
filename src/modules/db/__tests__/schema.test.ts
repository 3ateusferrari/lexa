import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  chunks,
  documents,
  evalQuestions,
  evalRuns,
  ingestionJobs,
} from '../schema.js';
import { getInitialMigrationSql, getDownMigrationSql } from '../migration-sql.js';

describe('Drizzle database schema & migrations', () => {
  it('defines the 5 required tables with expected table names and columns', () => {
    expect(getTableConfig(documents).name).toBe('documents');
    expect(getTableConfig(chunks).name).toBe('chunks');
    expect(getTableConfig(ingestionJobs).name).toBe('ingestion_jobs');
    expect(getTableConfig(evalQuestions).name).toBe('eval_questions');
    expect(getTableConfig(evalRuns).name).toBe('eval_runs');

    const docColumns = getTableConfig(documents).columns.map((c) => c.name);
    expect(docColumns).toEqual(
      expect.arrayContaining([
        'id',
        'title',
        'doc_type',
        'source_url',
        'downloaded_at',
        'content_hash',
        'created_at',
      ]),
    );

    const chunkColumns = getTableConfig(chunks).columns.map((c) => c.name);
    expect(chunkColumns).toEqual(
      expect.arrayContaining([
        'id',
        'document_id',
        'position',
        'article',
        'section_path',
        'page',
        'content',
        'embedding',
      ]),
    );
  });

  it('includes pgvector extension, HNSW cosine index, and Portuguese GIN tsvector index in migration SQL', () => {
    const upSql = getInitialMigrationSql();
    expect(upSql).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(upSql).toContain('USING hnsw (embedding vector_cosine_ops)');
    expect(upSql).toContain("to_tsvector('portuguese', content)");
    expect(upSql).toContain('USING gin (tsv)');

    const downSql = getDownMigrationSql();
    expect(downSql).toContain('DROP TABLE IF EXISTS eval_runs');
    expect(downSql).toContain('DROP TABLE IF EXISTS chunks');
    expect(downSql).toContain('DROP TABLE IF EXISTS documents');
  });
});
