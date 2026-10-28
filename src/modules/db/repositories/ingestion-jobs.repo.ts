import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { ingestionJobs, type IngestionJobRow, type NewIngestionJobRow } from '../schema.js';

export class IngestionJobsRepository {
  constructor(private readonly db: DbClient) {}

  async create(job: NewIngestionJobRow): Promise<IngestionJobRow> {
    const [inserted] = await this.db.insert(ingestionJobs).values(job).returning();
    if (!inserted) {
      throw new Error('Failed to create ingestion job');
    }
    return inserted;
  }

  async findById(id: string): Promise<IngestionJobRow | undefined> {
    const rows = await this.db
      .select()
      .from(ingestionJobs)
      .where(eq(ingestionJobs.id, id))
      .limit(1);
    return rows[0];
  }

  async updateStatus(
    id: string,
    update: {
      status: 'queued' | 'processing' | 'done' | 'failed';
      documentId?: string;
      error?: string | null;
      incrementAttempt?: boolean;
    },
  ): Promise<IngestionJobRow | undefined> {
    const [updated] = await this.db
      .update(ingestionJobs)
      .set({
        status: update.status,
        ...(update.documentId !== undefined ? { documentId: update.documentId } : {}),
        ...(update.error !== undefined ? { error: update.error } : {}),
        ...(update.incrementAttempt
          ? { attempts: sql`${ingestionJobs.attempts} + 1` }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(ingestionJobs.id, id))
      .returning();

    return updated;
  }
}
