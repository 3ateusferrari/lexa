import { sql } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  docType: string;
  article: string | null;
  sectionPath: string | null;
  page: number | null;
  content: string;
  score: number;
  vectorScore?: number;
  lexicalScore?: number;
  rerankScore?: number;
}

export interface VectorSearchOptions {
  topK?: number;
  documentId?: string;
  docType?: string;
}

interface RawVectorSearchRow {
  chunk_id: string;
  document_id: string;
  document_title: string;
  doc_type: string;
  article: string | null;
  section_path: string | null;
  page: number | null;
  content: string;
  score: number | string;
}

export async function vectorSearch(
  db: DbClient,
  queryEmbedding: number[],
  options: VectorSearchOptions = {},
): Promise<SearchResultItem[]> {
  const topK = options.topK ?? 5;
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  const conditions = [sql`c.embedding IS NOT NULL`];
  if (options.documentId) {
    conditions.push(sql`c.document_id = ${options.documentId}::uuid`);
  }
  if (options.docType) {
    conditions.push(sql`d.doc_type = ${options.docType}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      d.title AS document_title,
      d.doc_type,
      c.article,
      c.section_path,
      c.page,
      c.content,
      (1 - (c.embedding <=> ${vectorLiteral}::vector)) AS score
    FROM chunks c
    INNER JOIN documents d ON d.id = c.document_id
    WHERE ${whereClause}
    ORDER BY c.embedding <=> ${vectorLiteral}::vector ASC
    LIMIT ${topK}
  `);

  const rows = result.rows as unknown as RawVectorSearchRow[];

  return rows.map((row) => {
    const numScore = Number(row.score);
    return {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      docType: row.doc_type,
      article: row.article,
      sectionPath: row.section_path,
      page: row.page,
      content: row.content,
      score: numScore,
      vectorScore: numScore,
    };
  });
}
