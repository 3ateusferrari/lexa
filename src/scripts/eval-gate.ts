import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_QUALITY_THRESHOLDS,
  evaluateQualityGate
} from '../modules/eval/quality-gate.js';

interface StoredRun {
  id: string;
  gitSha: string;
  config: {
    chunking: string;
    searchMode: string;
    reranker: string;
    embeddingModel: string;
    refusalAccuracy?: number;
  };
  hitRate: number;
  mrr: number;
}

function main() {
  const args = process.argv.slice(2);
  const useDegradedFixedChunking =
    args.includes('--degraded') || args.includes('--chunking=fixed');

  const runsPath = path.resolve(process.cwd(), 'data/eval/baseline-runs.json');
  if (!fs.existsSync(runsPath)) {
    console.error('Arquivo data/eval/baseline-runs.json não encontrado.');
    process.exit(1);
  }

  const runs = JSON.parse(fs.readFileSync(runsPath, 'utf-8')) as StoredRun[];
  const targetRun = useDegradedFixedChunking
    ? runs.find((r) => r.config.chunking === 'fixed')
    : runs.find(
        (r) =>
          r.config.chunking === 'structural' &&
          r.config.searchMode === 'hybrid' &&
          r.config.reranker !== 'none' &&
          r.config.embeddingModel === 'local-legal-pt-v1'
      );

  if (!targetRun) {
    console.error('Execução de avaliação alvo não encontrada em baseline-runs.json.');
    process.exit(1);
  }

  const verdict = evaluateQualityGate(
    {
      hitRate: targetRun.hitRate,
      mrr: targetRun.mrr,
      refusalAccuracy: targetRun.config.refusalAccuracy
    },
    DEFAULT_QUALITY_THRESHOLDS
  );

  console.log('====================================================');
  console.log('  GATE DE QUALIDADE DO RAG (CI/CD)');
  console.log('====================================================');
  console.log(
    `Configuração: chunking=${targetRun.config.chunking}, search=${targetRun.config.searchMode}, reranker=${targetRun.config.reranker}`
  );
  console.log(
    `Hit Rate@5:   ${(verdict.metrics.hitRate * 100).toFixed(1)}% (mínimo: ${(
      verdict.thresholds.minHitRateAt5 * 100
    ).toFixed(1)}%)`
  );
  console.log(
    `MRR:          ${verdict.metrics.mrr.toFixed(4)} (mínimo: ${verdict.thresholds.minMrr.toFixed(
      4
    )})`
  );

  if (!verdict.passed) {
    console.error('\n[FALHA NO QUALITY GATE]:');
    for (const failure of verdict.failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('\n[SUCESSO] Quality Gate aprovado! Merge permitido.');
}

main();
