import { eq } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { chunks, type ChunkRow, type NewChunkRow } from '../schema.js';

export class ChunksRepository {
  constructor(private readonly db: DbClient) {}

  async insertBatch(items: NewChunkRow[]): Promise<ChunkRow[]> {
    if (items.length === 0) return [];
    return this.db.insert(chunks).values(items).returning();
  }

  async findByDocumentId(documentId: string): Promise<ChunkRow[]> {
    return this.db.select().from(chunks).where(eq(chunks.documentId, documentId));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.db.delete(chunks).where(eq(chunks.documentId, documentId));
  }
}
