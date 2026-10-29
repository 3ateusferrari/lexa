import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../api/app.js';
import { getAppLogger } from '../logger.js';

describe('Structured JSON Logging & Distributed Request-ID Tracing (ISSUE-28)', () => {
  it('instantiates pino structured logger with JSON format and log helper', () => {
    const logger = getAppLogger('test-service');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('assigns and returns X-Request-Id header in Express responses', async () => {
    const app = createApp();

    const resWithCustom = await request(app)
      .get('/health')
      .set('X-Request-Id', 'req-client-12345');
    expect(resWithCustom.status).toBe(200);
    expect(resWithCustom.headers['x-request-id']).toBe('req-client-12345');

    const resGenerated = await request(app).get('/health');
    expect(resGenerated.status).toBe(200);
    expect(resGenerated.headers['x-request-id']).toBeDefined();
    expect(typeof resGenerated.headers['x-request-id']).toBe('string');
  });
});
