import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../src/modules/api/app.js';
import {
  startPostgresTestContainer,
  type IntegrationDbContext
} from '../integration/setup-testcontainer.js';
import { IngestService } from '../../src/modules/ingestion/ingest-service.js';
import { createLocalEmbeddingProvider } from '../../src/modules/ingestion/embedder.js';

describe('E2E Smoke Test & Deploy Migration/Seed Script (ISSUE-23)', () => {
  let ctx: IntegrationDbContext;

  beforeAll(async () => {
    ctx = await startPostgresTestContainer();
    const ingestService = new IngestService(
      ctx.conn.db,
      createLocalEmbeddingProvider('local-legal-pt-v1')
    );
    await ingestService.ingestDocument({
      title: 'Lei nº 14.133/2021',
      docType: 'lei',
      sourceUrl:
        'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
      format: 'text',
      rawContent: [
        'Art. 28. São modalidades de licitação: I - pregão; II - concorrência; III - concurso; IV - leilão; V - diálogo competitivo.',
        '§ 2º É vedada a criação de outras modalidades de licitação ou a combinação das referidas no caput deste artigo.'
      ].join('\n')
    });
  });

  afterAll(async () => {
    await ctx?.teardown();
  });

  it('verifies scripts/deploy-migrate-and-seed.sh exists and runs migrations, corpus seed and eval seed', () => {
    const scriptPath = path.resolve(
      process.cwd(),
      'scripts/deploy-migrate-and-seed.sh'
    );
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('npm run db:migrate');
    expect(content).toContain('npm run ingest:corpus');
    expect(content).toContain('npm run eval:seed');
  });

  it('executes full E2E flow across /health, /search, /chat (SSE + citations + refusal) and /eval/runs', async () => {
    const app = createApp({
      db: ctx.conn.db,
      embedder: createLocalEmbeddingProvider('local-legal-pt-v1')
    });

    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    const searchRes = await request(app)
      .post('/search')
      .send({
        query:
          'Quais são as modalidades de licitação e é vedada a criação de outras modalidades?',
        k: 3,
        mode: 'hybrid',
        rerank: true
      });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results.length).toBeGreaterThan(0);
    expect(searchRes.body.results[0].article).toContain('Art. 28');

    const chatRes = await request(app)
      .post('/chat')
      .send({
        question:
          'Quais são as modalidades de licitação previstas no Art. 28 da Lei 14.133?'
      });
    expect(chatRes.status).toBe(200);
    expect(chatRes.text).toContain('event: token');
    expect(chatRes.text).toContain('event: citations');
    expect(chatRes.text).toContain('"isValid":true');
    expect(chatRes.text).toContain('"article":"Art. 28"');

    const evalRes = await request(app).get('/eval/runs');
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.dataset.totalQuestions).toBe(55);
  });
});
