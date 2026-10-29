import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

interface BaselineRunRecord {
  id: string;
  gitSha: string;
  config: {
    k: number;
    chunking: string;
    reranker: string;
    searchMode: string;
    embeddingModel: string;
    refusalAccuracy?: number;
    refusalThreshold?: number;
  };
  hitRate: number;
  mrr: number;
  createdAt: string;
}

function buildRunLabel(cfg: BaselineRunRecord['config']): string {
  if (cfg.chunking === 'fixed') {
    return 'Exp 1A: Chunking Fixo (240 chars) + Busca Vetorial';
  }
  if (cfg.searchMode === 'vector' && cfg.reranker === 'none') {
    return 'Exp 1B / 2A: Chunking Estrutural (Artigo/Inciso) + Busca Vetorial';
  }
  if (cfg.searchMode === 'lexical' && cfg.reranker === 'none') {
    return 'Exp 2B: Chunking Estrutural + Busca Lexical (tsvector pt-BR)';
  }
  if (cfg.searchMode === 'hybrid' && cfg.reranker === 'none') {
    return 'Exp 2C / 3A: Chunking Estrutural + Híbrido (RRF) sem Reranking';
  }
  if (
    cfg.searchMode === 'hybrid' &&
    cfg.reranker !== 'none' &&
    cfg.embeddingModel === 'local-char-ngram-v1'
  ) {
    return 'Exp 4A: Estrutural + Híbrido + Reranker (Modelo local-char-ngram-v1)';
  }
  return 'Exp 3B / 4B (Produção): Estrutural + Híbrido + Reranker + Refusal Guard (local-legal-pt-v1)';
}

export function createEvalRouter(): Router {
  const router = Router();

  router.get('/runs', (_req, res) => {
    const baselinePath = path.resolve(
      process.cwd(),
      'data/eval/baseline-runs.json'
    );
    const questionsPath = path.resolve(
      process.cwd(),
      'data/eval/questions.json'
    );

    const rawRuns: BaselineRunRecord[] = fs.existsSync(baselinePath)
      ? (JSON.parse(
          fs.readFileSync(baselinePath, 'utf-8')
        ) as BaselineRunRecord[])
      : [];

    const parsedQuestionsFile = fs.existsSync(questionsPath)
      ? (JSON.parse(fs.readFileSync(questionsPath, 'utf-8')) as {
          questions?: Array<{ expectedArticle: string | null }>;
        })
      : { questions: [] };

    const rawQuestions = parsedQuestionsFile.questions ?? [];
    const refusalCount = rawQuestions.filter(
      (q) => q.expectedArticle === null
    ).length;
    const answerableCount = rawQuestions.length - refusalCount;

    const runs = rawRuns.map((run) => ({
      id: run.id,
      gitSha: run.gitSha,
      label: buildRunLabel(run.config),
      config: run.config,
      metrics: {
        hitRateAt5: run.hitRate,
        mrr: run.mrr,
        refusalAccuracy: Number(run.config.refusalAccuracy ?? 0)
      },
      createdAt: run.createdAt
    }));

    res.status(200).json({
      dataset: {
        totalQuestions: rawQuestions.length,
        answerableCount,
        refusalCount,
        corpora: ['Lei nº 14.133/2021 (Nova Lei de Licitações)', 'Lei nº 13.709/2018 (LGPD)']
      },
      runs
    });
  });

  return router;
}
