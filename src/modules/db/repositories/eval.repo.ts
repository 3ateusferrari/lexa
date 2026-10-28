import { desc } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import {
  evalQuestions,
  evalRuns,
  type EvalQuestionRow,
  type EvalRunRow,
  type NewEvalQuestionRow,
  type NewEvalRunRow,
} from '../schema.js';

export class EvalRepository {
  constructor(private readonly db: DbClient) {}

  async replaceQuestions(items: NewEvalQuestionRow[]): Promise<EvalQuestionRow[]> {
    await this.db.delete(evalQuestions);
    if (items.length === 0) return [];
    return this.db.insert(evalQuestions).values(items).returning();
  }

  async listQuestions(): Promise<EvalQuestionRow[]> {
    return this.db.select().from(evalQuestions);
  }

  async createRun(run: NewEvalRunRow): Promise<EvalRunRow> {
    const [inserted] = await this.db.insert(evalRuns).values(run).returning();
    if (!inserted) {
      throw new Error('Failed to insert eval run');
    }
    return inserted;
  }

  async listRuns(limit = 20): Promise<EvalRunRow[]> {
    return this.db.select().from(evalRuns).orderBy(desc(evalRuns.createdAt)).limit(limit);
  }
}
