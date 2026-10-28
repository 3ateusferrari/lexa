import 'dotenv/config';
import { createResilientDatabaseConnection } from '../modules/db/client.js';
import { runEvaluationSuite } from '../modules/eval/eval-runner.js';
import { CachedEmbedder, createLocalEmbeddingProvider } from '../modules/ingestion/embedder.js';
import { vectorSearch } from '../modules/rag/vector-search.js';
import { ingestCorpusFromManifest } from './ingest-corpus.js';
import { seedEvalQuestions } from './seed-eval-questions.js';

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://lexa:lexa_dev_password@localhost:5432/lexa_db';
  const embeddingModel = process.env.LOCAL_EMBEDDING_MODEL ?? 'local-legal-pt-v1';

  await ingestCorpusFromManifest({ databaseUrl, embeddingModel });
  await seedEvalQuestions(databaseUrl);

  const conn = await createResilientDatabaseConnection(databaseUrl);
  try {
    const embedder = new CachedEmbedder(createLocalEmbeddingProvider(embeddingModel));

    const result = await runEvaluationSuite({
      db: conn.db,
      config: {
        chunking: 'structural',
        searchMode: 'vector',
        k: 5,
        embeddingModel,
        reranker: 'none',
      },
      retrieve: async (query, k) => {
        const [queryEmbedding] = await embedder.embedBatch([query]);
        const results = await vectorSearch(conn.db, queryEmbedding!, { topK: k });
        return { results, refused: false };
      },
    });

    console.table([
      {
        gitSha: result.evalRun.gitSha,
        mode: result.evalRun.config.searchMode,
        chunking: result.evalRun.config.chunking,
        embeddingModel: result.evalRun.config.embeddingModel,
        'Hit Rate@5': `${(result.metrics.hitRateAtK * 100).toFixed(1)}%`,
        MRR: result.metrics.mrr.toFixed(4),
        'Refusal Acc': `${(result.metrics.refusalAccuracy * 100).toFixed(1)}%`,
      },
    ]);
  } finally {
    await conn.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Evaluation failed:', err);
    process.exit(1);
  });
}
