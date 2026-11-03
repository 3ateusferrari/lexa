import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXAMPLE_QUESTIONS_UI } from '../../../../web/src/lib/chat-stream.js';
import {
  createPgliteConnection,
  type DatabaseConnection,
} from '../../db/client.js';
import { getInitialMigrationSql } from '../../db/migration-sql.js';
import { findCachedExampleQuestion } from '../../rag/example-cache.js';
import { createApp } from '../app.js';
import { errorHandlerMiddleware } from '../middlewares/error-handler.js';

describe('Documents Upload Flow, Example Questions Alignment & Error Middleware', () => {
  let conn: DatabaseConnection;

  beforeAll(async () => {
    conn = await createPgliteConnection();
    await conn.execSql(getInitialMigrationSql());
  });

  afterAll(async () => {
    await conn?.close();
  });

  it('creates presigned upload job quickly (< 500ms) in local mode without hanging on AWS IMDS and retrieves job via GET /documents/jobs/:id', async () => {
    const app = createApp({ db: conn.db });

    const startedAt = performance.now();
    const uploadRes = await request(app).post('/documents/upload-url').send({
      title: 'Decreto Regulamentar nº 10.024/2026',
      docType: 'decreto',
      fileName: 'decreto-regulamentar-10024.html',
      contentType: 'text/html',
      fileSizeBytes: 1024,
    });
    const elapsedMs = performance.now() - startedAt;

    expect(uploadRes.status).toBe(201);
    expect(elapsedMs).toBeLessThan(500);
    expect(uploadRes.body.jobId).toBeDefined();
    expect(uploadRes.body.uploadUrl).toContain('decreto-regulamentar-10024.html');
    expect(uploadRes.body.status).toBe('queued');

    const jobRes = await request(app).get(`/documents/jobs/${uploadRes.body.jobId}`);
    expect(jobRes.status).toBe(200);
    expect(jobRes.body.id).toBe(uploadRes.body.jobId);
    expect(jobRes.body.status).toBe('queued');

    const missingJobRes = await request(app).get(
      '/documents/jobs/00000000-0000-0000-0000-000000000000',
    );
    expect(missingJobRes.status).toBe(404);
    expect(missingJobRes.body.error).toBe('NOT_FOUND');

    const listDocsRes = await request(app).get('/documents');
    expect(listDocsRes.status).toBe(200);
    expect(Array.isArray(listDocsRes.body.documents)).toBe(true);
  });

  it('caches all 8 answerable UI example questions while keeping the out-of-scope UI question uncached for Refusal Guard', () => {
    const answerableUiQuestions = EXAMPLE_QUESTIONS_UI.filter(
      (q) => q.category !== 'Fora do Escopo',
    );
    const outOfScopeUiQuestions = EXAMPLE_QUESTIONS_UI.filter(
      (q) => q.category === 'Fora do Escopo',
    );

    expect(answerableUiQuestions.length).toBe(8);
    expect(outOfScopeUiQuestions.length).toBe(1);

    for (const item of answerableUiQuestions) {
      const cached = findCachedExampleQuestion(item.question);
      expect(cached, `Expected UI question "${item.question}" to be cached`).toBeDefined();
      expect(cached?.citations.length).toBeGreaterThan(0);
    }

    for (const item of outOfScopeUiQuestions) {
      const cached = findCachedExampleQuestion(item.question);
      expect(cached).toBeUndefined();
    }
  });

  it('formats 413, 400 and 500 errors consistently in errorHandlerMiddleware', () => {
    const makeRes = () => {
      let code = 0;
      let payload: unknown = null;
      return {
        status(s: number) {
          code = s;
          return this;
        },
        json(body: unknown) {
          payload = body;
          return this;
        },
        getResult: () => ({ code, payload }),
      };
    };

    const res413 = makeRes();
    const err413 = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
    });
    errorHandlerMiddleware(err413, {} as never, res413 as never, (() => {}) as never);
    expect(res413.getResult()).toEqual({
      code: 413,
      payload: { error: 'PAYLOAD_TOO_LARGE', message: 'request entity too large' },
    });

    const res400 = makeRes();
    const err400 = Object.assign(new Error('Invalid JSON'), { status: 400 });
    errorHandlerMiddleware(err400, {} as never, res400 as never, (() => {}) as never);
    expect(res400.getResult()).toEqual({
      code: 400,
      payload: { error: 'BAD_REQUEST', message: 'Invalid JSON' },
    });

    const res500 = makeRes();
    errorHandlerMiddleware('string error', {} as never, res500 as never, (() => {}) as never);
    expect(res500.getResult()).toEqual({
      code: 500,
      payload: { error: 'INTERNAL_SERVER_ERROR', message: 'Unexpected server error' },
    });
  });
});
