import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabaseConnection } from '../modules/db/client.js';
import { CachedEmbedder, createLocalEmbeddingProvider } from '../modules/ingestion/embedder.js';
import type { DocumentInputFormat } from '../modules/ingestion/extractor.js';
import { IngestService, type ChunkingStrategy } from '../modules/ingestion/ingest-service.js';

interface CorpusManifestItem {
  slug: string;
  title: string;
  docType: string;
  filePath: string;
  format: DocumentInputFormat;
  sourceUrl: string;
  downloadedAt: string;
}

interface CorpusManifest {
  documents: CorpusManifestItem[];
}

export async function ingestCorpusFromManifest(options: {
  databaseUrl: string;
  manifestPath?: string;
  chunkingStrategy?: ChunkingStrategy;
  embeddingModel?: string;
  cacheDir?: string;
}) {
  const manifestPath = options.manifestPath ?? resolve(process.cwd(), 'data/corpus/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CorpusManifest;

  const conn = createDatabaseConnection(options.databaseUrl);
  try {
    const baseProvider = createLocalEmbeddingProvider(options.embeddingModel);
    const embedder = new CachedEmbedder(baseProvider, {
      cacheDir: options.cacheDir ?? process.env.EMBEDDING_CACHE_DIR ?? '.cache/embeddings',
    });
    const service = new IngestService(conn.db, embedder);

    const results = [];
    for (const item of manifest.documents) {
      const rawContent = readFileSync(resolve(process.cwd(), item.filePath), 'utf8');
      const result = await service.ingestDocument({
        title: item.title,
        docType: item.docType,
        sourceUrl: item.sourceUrl,
        downloadedAt: item.downloadedAt,
        rawContent,
        format: item.format,
        chunkingStrategy: options.chunkingStrategy ?? 'structural',
      });
      results.push({ slug: item.slug, ...result });
    }
    return results;
  } finally {
    await conn.close();
  }
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://lexa:lexa_dev_password@localhost:5432/lexa_db';
  const results = await ingestCorpusFromManifest({ databaseUrl });
  for (const r of results) {
    console.log(
      `[${r.skipped ? 'SKIPPED' : 'INGESTED'}] ${r.document.title} (${r.chunksCount} chunks)`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to ingest corpus:', err);
    process.exit(1);
  });
}
