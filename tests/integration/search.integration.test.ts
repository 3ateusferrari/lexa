import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/modules/api/app.js';
import { CachedEmbedder, createLocalEmbeddingProvider } from '../../src/modules/ingestion/embedder.js';
import { IngestService } from '../../src/modules/ingestion/ingest-service.js';
import { startPostgresTestContainer, type IntegrationDbContext } from './setup-testcontainer.js';

describe('Integration: IngestService + pgvector + POST /search (Testcontainers)', () => {
  let ctx: IntegrationDbContext;
  let cacheDir: string;

  beforeAll(async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'lexa-int-cache-'));
    ctx = await startPostgresTestContainer();
  }, 120000);

  afterAll(async () => {
    if (ctx) {
      await ctx.teardown();
    }
    if (cacheDir) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('ingests Lei 14.133/2021 once, skips duplicate content_hash, and retrieves Art. 75 via POST /search', async () => {
    const embedder = new CachedEmbedder(createLocalEmbeddingProvider('local-legal-pt-v1'), {
      cacheDir,
    });
    const ingestService = new IngestService(ctx.conn.db, embedder);

    const rawHtml = readFileSync(resolve(process.cwd(), 'data/corpus/lei-14133-2021.html'), 'utf8');

    const firstIngest = await ingestService.ingestDocument({
      title: 'Lei nº 14.133/2021',
      docType: 'lei',
      sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
      downloadedAt: '2026-10-28',
      rawContent: rawHtml,
      format: 'html',
    });

    expect(firstIngest.skipped).toBe(false);
    expect(firstIngest.chunksCount).toBeGreaterThan(25);

    const secondIngest = await ingestService.ingestDocument({
      title: 'Lei nº 14.133/2021',
      docType: 'lei',
      rawContent: rawHtml,
      format: 'html',
    });

    expect(secondIngest.skipped).toBe(true);
    expect(secondIngest.document.id).toBe(firstIngest.document.id);

    const app = createApp({
      db: ctx.conn.db,
      embedder,
    });

    const searchRes = await request(app).post('/search').send({
      query: 'dispensa de licitação por valor para obras e serviços de engenharia R$ 100.000,00',
      k: 5,
    });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results.length).toBe(5);
    const articles = searchRes.body.results.map((r: { article: string }) => r.article);
    expect(articles).toContain('Art. 75');
  });
});
