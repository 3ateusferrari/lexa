import { describe, expect, it } from 'vitest';
import {
  calculateQuestionHit,
  calculateReciprocalRank,
  evaluateBatchMetrics,
  type QuestionEvalOutcome,
} from '../metrics.js';

describe('Evaluation Metrics (Hit Rate@k, MRR, Refusal Accuracy)', () => {
  it('computes hit@k and reciprocal rank for a single question', () => {
    const retrieved = ['Art. 72', 'Art. 74', 'Art. 75', 'Art. 78', 'Art. 84'];

    expect(calculateQuestionHit(retrieved, 'Art. 75', 5)).toBe(true);
    expect(calculateQuestionHit(retrieved, 'Art. 75', 2)).toBe(false);
    expect(calculateReciprocalRank(retrieved, 'Art. 75', 5)).toBeCloseTo(1 / 3, 5);
    expect(calculateReciprocalRank(retrieved, 'Art. 156', 5)).toBe(0);
  });

  it('matches article labels even when chunk content contains the expected article tag', () => {
    const outcomes: QuestionEvalOutcome[] = [
      {
        question: 'Dispensa de licitação por valor',
        expectedArticle: 'Art. 75',
        retrievedArticles: ['Art. 75', 'Art. 74'],
        refused: false,
      },
      {
        question: 'Modalidades de licitação',
        expectedArticle: 'Art. 28',
        retrievedArticles: ['Art. 29', 'Art. 28'],
        refused: false,
      },
      {
        question: 'Prazo de impugnação',
        expectedArticle: 'Art. 164',
        retrievedArticles: ['Art. 55', 'Art. 54'],
        refused: false,
      },
      {
        question: 'Pergunta sobre CLT fora do corpus',
        expectedArticle: null,
        retrievedArticles: ['Art. 1º'],
        refused: true,
      },
      {
        question: 'Pergunta sobre receita culinária fora do corpus',
        expectedArticle: null,
        retrievedArticles: ['Art. 2º'],
        refused: false,
      },
    ];

    const summary = evaluateBatchMetrics(outcomes, 5);
    expect(summary.answerableCount).toBe(3);
    expect(summary.unanswerableCount).toBe(2);
    // Hits: Q1 (rank 1 -> 1.0), Q2 (rank 2 -> 0.5), Q3 (miss -> 0) => 2/3 hit rate, (1 + 0.5 + 0)/3 = 0.5 MRR
    expect(summary.hitRateAtK).toBeCloseTo(2 / 3, 4);
    expect(summary.mrr).toBeCloseTo(0.5, 4);
    expect(summary.refusalAccuracy).toBeCloseTo(0.5, 4);
  });
});
