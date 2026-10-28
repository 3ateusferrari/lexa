import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyMigrationsOnConnection,
  createResilientDatabaseConnection,
} from '../modules/db/client.js';
import { EvalRepository } from '../modules/db/repositories/index.js';
import type { EvalRunConfig, EvalRunRow } from '../modules/db/schema.js';
import { runEvaluationSuite } from '../modules/eval/eval-runner.js';
import { CachedEmbedder, createLocalEmbeddingProvider } from '../modules/ingestion/embedder.js';
import { extractCleanText } from '../modules/ingestion/extractor.js';
import { chunkByFixedSize } from '../modules/ingestion/fixed-chunker.js';
import { chunkByLegalStructure } from '../modules/ingestion/legal-chunker.js';
import { ChunksRepository, DocumentsRepository } from '../modules/db/repositories/index.js';
import { computeContentHash } from '../modules/ingestion/extractor.js';
import { hybridSearchRRF } from '../modules/rag/hybrid-search.js';
import { lexicalSearch } from '../modules/rag/lexical-search.js';
import {
  DEFAULT_REFUSAL_THRESHOLD,
  evaluateRefusalGuard,
} from '../modules/rag/refusal-guard.js';
import { rerankChunks } from '../modules/rag/reranker.js';
import { vectorSearch } from '../modules/rag/vector-search.js';
import { seedEvalQuestionsOnDb } from './seed-eval-questions.js';

interface ExperimentSpec {
  name: string;
  config: EvalRunConfig;
  fixedChunkSize?: number;
}

const EXPERIMENTS: ExperimentSpec[] = [
  {
    name: 'Exp 1A · Chunking Fixo (240 chars) + Busca Vetorial',
    fixedChunkSize: 240,
    config: {
      chunking: 'fixed',
      searchMode: 'vector',
      k: 5,
      embeddingModel: 'local-legal-pt-v1',
      reranker: 'none',
    },
  },
  {
    name: 'Exp 1B / 2A · Chunking Estrutural por Artigo + Busca Só Vetorial',
    config: {
      chunking: 'structural',
      searchMode: 'vector',
      k: 5,
      embeddingModel: 'local-legal-pt-v1',
      reranker: 'none',
    },
  },
  {
    name: 'Exp 2B · Chunking Estrutural + Busca Só Texto (tsvector português)',
    config: {
      chunking: 'structural',
      searchMode: 'lexical',
      k: 5,
      embeddingModel: 'local-legal-pt-v1',
      reranker: 'none',
    },
  },
  {
    name: 'Exp 2C / 3A · Chunking Estrutural + Busca Híbrida (RRF) sem Reranking',
    config: {
      chunking: 'structural',
      searchMode: 'hybrid',
      k: 5,
      embeddingModel: 'local-legal-pt-v1',
      reranker: 'none',
    },
  },
  {
    name: 'Exp 4A · Modelo Local Char-Ngram (local-char-ngram-v1) + Híbrido',
    config: {
      chunking: 'structural',
      searchMode: 'hybrid',
      k: 5,
      embeddingModel: 'local-char-ngram-v1',
      reranker: 'local-cross-reranker-v1',
      refusalThreshold: DEFAULT_REFUSAL_THRESHOLD,
    },
  },
  {
    name: 'Exp 3B / 4B (Produção) · Estrutural + Híbrido (RRF) + Reranking + Limiar de Recusa',
    config: {
      chunking: 'structural',
      searchMode: 'hybrid',
      k: 5,
      embeddingModel: 'local-legal-pt-v1',
      reranker: 'local-cross-reranker-v1',
      refusalThreshold: DEFAULT_REFUSAL_THRESHOLD,
    },
  },
];

async function populateCorpusForExperiment(
  db: Parameters<typeof vectorSearch>[0],
  spec: ExperimentSpec,
) {
  const docsRepo = new DocumentsRepository(db);
  const chunksRepo = new ChunksRepository(db);
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data/corpus/manifest.json'), 'utf8'),
  ) as {
    documents: Array<{
      slug: string;
      title: string;
      docType: string;
      filePath: string;
      format: 'html' | 'text';
      sourceUrl: string;
      downloadedAt: string;
    }>;
  };

  const embedder = new CachedEmbedder(
    createLocalEmbeddingProvider(spec.config.embeddingModel),
  );

  // Clear existing documents/chunks so only the active experiment corpus is queried
  const existingDocs = await docsRepo.listAll();
  for (const d of existingDocs) {
    await chunksRepo.deleteByDocumentId(d.id);
  }

  for (const item of manifest.documents) {
    const raw = readFileSync(resolve(process.cwd(), item.filePath), 'utf8');
    const cleanText = extractCleanText(raw, item.format);
    const contentHash = computeContentHash(
      `${spec.name}:${spec.config.chunking}:${spec.config.embeddingModel}:${cleanText}`,
    );

    let doc = await docsRepo.findByContentHash(contentHash);
    if (!doc) {
      doc = await docsRepo.create({
        title: item.title,
        docType: item.docType,
        sourceUrl: item.sourceUrl,
        downloadedAt: item.downloadedAt,
        contentHash,
      });
    }

    const chunks =
      spec.config.chunking === 'fixed'
        ? chunkByFixedSize(cleanText, { chunkSize: spec.fixedChunkSize ?? 240, overlap: 30 })
        : chunkByLegalStructure(cleanText);

    const vectors = await embedder.embedBatch(chunks.map((c) => c.embeddedText));
    await chunksRepo.insertBatch(
      chunks.map((c, idx) => ({
        documentId: doc.id,
        position: c.position,
        article: c.article,
        sectionPath: c.sectionPath,
        page: c.page,
        content: c.content,
        embedding: vectors[idx]!,
      })),
    );
  }
}

export async function runAllExperiments(databaseUrl: string): Promise<EvalRunRow[]> {
  const conn = await createResilientDatabaseConnection(databaseUrl);
  try {
    await applyMigrationsOnConnection(conn, 'down');
    await applyMigrationsOnConnection(conn, 'up');

    for (const spec of EXPERIMENTS) {
      await populateCorpusForExperiment(conn.db, spec);
      await seedEvalQuestionsOnDb(conn.db);

      const embedder = new CachedEmbedder(
        createLocalEmbeddingProvider(spec.config.embeddingModel),
      );

      const res = await runEvaluationSuite({
        db: conn.db,
        config: spec.config,
        retrieve: async (query, k) => {
          const useReranker = spec.config.reranker !== 'none';
          const candidatePool = useReranker ? 20 : k;

          let candidates;
          if (spec.config.searchMode === 'lexical') {
            candidates = await lexicalSearch(conn.db, query, { topK: candidatePool });
          } else {
            const [qVec] = await embedder.embedBatch([query]);
            if (spec.config.searchMode === 'hybrid') {
              candidates = await hybridSearchRRF(conn.db, query, qVec!, {
                candidatePoolSize: 20,
                topK: candidatePool,
              });
            } else {
              candidates = await vectorSearch(conn.db, qVec!, { topK: candidatePool });
            }
          }

          const finalResults = useReranker
            ? rerankChunks(query, candidates, { topK: k })
            : candidates.slice(0, k);

          const refusal =
            spec.config.refusalThreshold !== undefined
              ? evaluateRefusalGuard(finalResults, spec.config.refusalThreshold)
              : { refused: false };

          return {
            results: finalResults,
            refused: refusal.refused,
          };
        },
      });

      console.log(
        `[OK] ${spec.name} => Hit Rate@5: ${(res.metrics.hitRateAtK * 100).toFixed(1)}% | MRR: ${res.metrics.mrr.toFixed(4)} | Refusal Acc: ${(res.metrics.refusalAccuracy * 100).toFixed(1)}%`,
      );
    }

    const evalRepo = new EvalRepository(conn.db);
    const allRuns = await evalRepo.listRuns(50);

    writeFileSync(
      resolve(process.cwd(), 'data/eval/baseline-runs.json'),
      JSON.stringify(allRuns, null, 2),
      'utf8',
    );

    return allRuns;
  } finally {
    await conn.close();
  }
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://lexa:lexa_dev_password@localhost:5432/lexa_db';
  await runAllExperiments(databaseUrl);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to run experiments:', err);
    process.exit(1);
  });
}
