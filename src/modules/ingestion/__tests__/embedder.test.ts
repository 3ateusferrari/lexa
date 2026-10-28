import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CachedEmbedder,
  cosineSimilarity,
  createLocalEmbeddingProvider,
  type EmbeddingProvider,
} from '../embedder.js';

describe('Local EmbeddingProvider & CachedEmbedder', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'lexa-emb-cache-'));
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('produces normalized 384-dimensional vectors with higher similarity for semantically related legal texts', async () => {
    const provider = createLocalEmbeddingProvider('local-legal-pt-v1');
    const vectors = await provider.embedBatch([
      'Qual o limite de valor para dispensa de licitação em obras de engenharia?',
      'Art. 75. É dispensável a licitação: I - para contratação que envolva valores inferiores a R$ 100.000,00 no caso de obras e serviços de engenharia',
      'Art. 14. O tratamento de dados pessoais de crianças e de adolescentes deverá ser realizado em seu melhor interesse',
    ]);

    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toHaveLength(384);

    const simRelated = cosineSimilarity(vectors[0]!, vectors[1]!);
    const simUnrelated = cosineSimilarity(vectors[0]!, vectors[2]!);
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it('caches embeddings by content hash and makes 0 provider calls on second batch execution', async () => {
    const baseProvider = createLocalEmbeddingProvider('local-legal-pt-v1');
    const spy = vi.spyOn(baseProvider, 'embedBatch');
    const cached = new CachedEmbedder(baseProvider, { cacheDir });

    const texts = [
      'Art. 1º Esta Lei estabelece normas gerais de licitação.',
      'Art. 75. É dispensável a licitação.',
    ];

    const firstRun = await cached.embedBatch(texts);
    expect(firstRun).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(1);

    // Second run with the same texts should hit cache and not invoke underlying provider
    const cachedSecondInstance = new CachedEmbedder(baseProvider, { cacheDir });
    const secondRun = await cachedSecondInstance.embedBatch(texts);
    expect(secondRun).toEqual(firstRun);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('supports a second distinct embedding model for comparative evaluation experiments', async () => {
    const modelA: EmbeddingProvider = createLocalEmbeddingProvider('local-legal-pt-v1');
    const modelB: EmbeddingProvider = createLocalEmbeddingProvider('local-char-ngram-v1');

    const [vecA] = await modelA.embedBatch(['dispensa de licitação por valor']);
    const [vecB] = await modelB.embedBatch(['dispensa de licitação por valor']);

    expect(vecA).toHaveLength(384);
    expect(vecB).toHaveLength(384);
    expect(vecA).not.toEqual(vecB);
  });
});
