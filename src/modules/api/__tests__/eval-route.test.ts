import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GET /eval/runs (ISSUE-18)', () => {
  it('returns the comparative RAG experiment runs and golden dataset summary', async () => {
    const app = createApp();
    const res = await request(app).get('/eval/runs');

    expect(res.status).toBe(200);
    expect(res.body.dataset).toEqual(
      expect.objectContaining({
        totalQuestions: 55,
        answerableCount: 45,
        refusalCount: 10
      })
    );
    expect(Array.isArray(res.body.runs)).toBe(true);
    expect(res.body.runs.length).toBeGreaterThanOrEqual(6);

    const prodRun = res.body.runs.find(
      (r: { label?: string }) =>
        typeof r.label === 'string' && r.label.includes('Exp 3B')
    );
    expect(prodRun).toBeDefined();
    expect(prodRun.metrics.hitRateAt5).toBeGreaterThanOrEqual(0.95);
    expect(prodRun.metrics.refusalAccuracy).toBe(1);
  });
});
