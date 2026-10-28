import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createResilientDatabaseConnection, type DbClient } from '../modules/db/client.js';
import { DocumentsRepository, EvalRepository } from '../modules/db/repositories/index.js';

export interface EvalDatasetQuestion {
  question: string;
  expectedArticle: string | null;
  documentSlug: string | null;
}

export interface EvalDatasetFile {
  questions: EvalDatasetQuestion[];
}

export function loadEvaluationDataset(
  filePath = resolve(process.cwd(), 'data/eval/questions.json'),
): EvalDatasetFile {
  return JSON.parse(readFileSync(filePath, 'utf8')) as EvalDatasetFile;
}

export async function seedEvalQuestionsOnDb(db: DbClient, filePath?: string) {
  const dataset = loadEvaluationDataset(filePath);
  const docsRepo = new DocumentsRepository(db);
  const evalRepo = new EvalRepository(db);

  const allDocs = await docsRepo.listAll();
  const docBySlug = new Map<string, string>();
  for (const doc of allDocs) {
    if (doc.title.includes('14.133')) {
      docBySlug.set('lei-14133-2021', doc.id);
    } else if (doc.title.includes('13.709') || doc.title.includes('LGPD')) {
      docBySlug.set('lei-13709-2018-lgpd', doc.id);
    }
  }

  return evalRepo.replaceQuestions(
    dataset.questions.map((q) => ({
      question: q.question,
      expectedArticle: q.expectedArticle,
      documentId: q.documentSlug ? (docBySlug.get(q.documentSlug) ?? null) : null,
    })),
  );
}

export async function seedEvalQuestions(databaseUrl: string, filePath?: string) {
  const conn = await createResilientDatabaseConnection(databaseUrl);
  try {
    return await seedEvalQuestionsOnDb(conn.db, filePath);
  } finally {
    await conn.close();
  }
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://lexa:lexa_dev_password@localhost:5432/lexa_db';
  const rows = await seedEvalQuestions(databaseUrl);
  console.log(`Seeded ${rows.length} evaluation questions into eval_questions.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to seed evaluation questions:', err);
    process.exit(1);
  });
}
