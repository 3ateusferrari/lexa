import type { DbClient } from '../db/client.js';
import { ChunksRepository, DocumentsRepository } from '../db/repositories/index.js';
import type { DocumentRow } from '../db/schema.js';
import type { EmbeddingProvider } from './embedder.js';
import { computeContentHash, extractCleanText, type DocumentInputFormat } from './extractor.js';
import { chunkByFixedSize } from './fixed-chunker.js';
import { chunkByLegalStructure } from './legal-chunker.js';

export type ChunkingStrategy = 'structural' | 'fixed';

export interface IngestDocumentInput {
  title: string;
  docType: string;
  sourceUrl?: string | null;
  downloadedAt?: string | null;
  rawContent: string;
  format?: DocumentInputFormat;
  chunkingStrategy?: ChunkingStrategy;
}

export interface IngestDocumentResult {
  document: DocumentRow;
  chunksCount: number;
  skipped: boolean;
}

export class IngestService {
  private readonly documentsRepo: DocumentsRepository;
  private readonly chunksRepo: ChunksRepository;

  constructor(
    db: DbClient,
    private readonly embedder: EmbeddingProvider,
  ) {
    this.documentsRepo = new DocumentsRepository(db);
    this.chunksRepo = new ChunksRepository(db);
  }

  async ingestDocument(input: IngestDocumentInput): Promise<IngestDocumentResult> {
    const format = input.format ?? 'html';
    const strategy = input.chunkingStrategy ?? 'structural';
    const cleanText = extractCleanText(input.rawContent, format);

    const contentHash = computeContentHash(
      `${strategy}:${this.embedder.modelName}:${cleanText}`,
    );

    const existingDoc = await this.documentsRepo.findByContentHash(contentHash);
    if (existingDoc) {
      const existingChunks = await this.chunksRepo.findByDocumentId(existingDoc.id);
      return {
        document: existingDoc,
        chunksCount: existingChunks.length,
        skipped: true,
      };
    }

    const legalChunks =
      strategy === 'fixed'
        ? chunkByFixedSize(cleanText)
        : chunkByLegalStructure(cleanText);

    const embeddedTexts = legalChunks.map((c) => c.embeddedText);
    const vectors = await this.embedder.embedBatch(embeddedTexts);

    const document = await this.documentsRepo.create({
      title: input.title,
      docType: input.docType,
      sourceUrl: input.sourceUrl ?? null,
      downloadedAt: input.downloadedAt ?? null,
      contentHash,
    });

    await this.chunksRepo.insertBatch(
      legalChunks.map((chunk, idx) => ({
        documentId: document.id,
        position: chunk.position,
        article: chunk.article,
        sectionPath: chunk.sectionPath,
        page: chunk.page,
        content: chunk.content,
        embedding: vectors[idx]!,
      })),
    );

    return {
      document,
      chunksCount: legalChunks.length,
      skipped: false,
    };
  }
}
