import { describe, expect, it } from 'vitest';
import { loadEvaluationDataset } from '../../../scripts/seed-eval-questions.js';

describe('Evaluation Golden Dataset (ISSUE-09)', () => {
  it('contains at least 50 questions including at least 10 out-of-corpus refusal questions', () => {
    const dataset = loadEvaluationDataset();

    expect(dataset.questions.length).toBeGreaterThanOrEqual(50);

    const answerable = dataset.questions.filter((q) => q.expectedArticle !== null);
    const unanswerable = dataset.questions.filter((q) => q.expectedArticle === null);

    expect(answerable.length).toBeGreaterThanOrEqual(40);
    expect(unanswerable.length).toBeGreaterThanOrEqual(10);

    const lei14133Count = answerable.filter((q) => q.documentSlug === 'lei-14133-2021').length;
    const lgpdCount = answerable.filter((q) => q.documentSlug === 'lei-13709-2018-lgpd').length;

    expect(lei14133Count).toBeGreaterThanOrEqual(20);
    expect(lgpdCount).toBeGreaterThanOrEqual(15);
  });
});
