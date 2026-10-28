import { execSync } from 'node:child_process';
import type { DbClient } from '../db/client.js';
import { EvalRepository } from '../db/repositories/index.js';
import type { EvalRunConfig, EvalRunRow } from '../db/schema.js';
import type { SearchResultItem } from '../rag/vector-search.js';
import {
  evaluateBatchMetrics,
  type BatchEvalMetrics,
  type QuestionEvalOutcome,
} from './metrics.js';

export interface EvalRetrievalFn {
  (query: string, k: number): Promise<{
    results: SearchResultItem[];
    refused: boolean;
  }>;
}

export interface RunEvaluationOptions {
  db: DbClient;
  retrieve: EvalRetrievalFn;
  config: EvalRunConfig;
  gitSha?: string;
}

export interface RunEvaluationResult {
  evalRun: EvalRunRow;
  metrics: BatchEvalMetrics;
  outcomes: QuestionEvalOutcome[];
}

export function resolveCurrentGitSha(): string {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'local-dev';
  }
}

export async function runEvaluationSuite(
  options: RunEvaluationOptions,
): Promise<RunEvaluationResult> {
  const evalRepo = new EvalRepository(options.db);
  const questions = await evalRepo.listQuestions();

  if (questions.length === 0) {
    throw new Error('No evaluation questions found in eval_questions. Run seedEvalQuestions first.');
  }

  const outcomes: QuestionEvalOutcome[] = [];
  const k = options.config.k;

  for (const q of questions) {
    const { results, refused } = await options.retrieve(q.question, k);
    outcomes.push({
      question: q.question,
      expectedArticle: q.expectedArticle,
      expectedDocumentId: q.documentId,
      retrievedArticles: results.map((r) => r.article),
      retrievedDocumentIds: results.map((r) => r.documentId),
      retrievedContents: results.map((r) => r.content),
      refused,
    });
  }

  const metrics = evaluateBatchMetrics(outcomes, k);
  const gitSha = options.gitSha ?? resolveCurrentGitSha();

  const fullConfig: EvalRunConfig = {
    ...options.config,
    refusalAccuracy: metrics.refusalAccuracy,
  };

  const evalRun = await evalRepo.createRun({
    gitSha,
    config: fullConfig,
    hitRate: metrics.hitRateAtK,
    mrr: metrics.mrr,
  });

  return {
    evalRun,
    metrics,
    outcomes,
  };
}
