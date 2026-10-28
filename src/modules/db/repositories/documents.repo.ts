import { eq } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { documents, type DocumentRow, type NewDocumentRow } from '../schema.js';

export class DocumentsRepository {
  constructor(private readonly db: DbClient) {}

  async findByContentHash(contentHash: string): Promise<DocumentRow | undefined> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.contentHash, contentHash))
      .limit(1);
    return rows[0];
  }

  async findById(id: string): Promise<DocumentRow | undefined> {
    const rows = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return rows[0];
  }

  async listAll(): Promise<DocumentRow[]> {
    return this.db.select().from(documents);
  }

  async create(doc: NewDocumentRow): Promise<DocumentRow> {
    const [inserted] = await this.db.insert(documents).values(doc).returning();
    if (!inserted) {
      throw new Error('Failed to insert document');
    }
    return inserted;
  }
}
