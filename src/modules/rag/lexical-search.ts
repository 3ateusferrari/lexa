import { sql } from 'drizzle-orm';
import type { DbClient } from '../db/client.js';
import type { SearchResultItem, VectorSearchOptions } from './vector-search.js';

interface RawLexicalSearchRow {
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

const STOPWORDS_PT = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos',
  'por', 'qual', 'quais', 'quando', 'que', 'quem', 'sao', 'são', 'se', 'sem', 'seu', 'sua',
  'um', 'uma', 'sobre', 'segundo', 'previsto', 'previstos', 'previstas', 'lei',
  'codigo', 'código', 'causas', 'hipoteses', 'hipóteses', 'define', 'requisitos',
]);

const COMMON_ACCENT_MAP: Record<string, string> = {
  legitima: 'legítima',
  legitimas: 'legítimas',
  legitimo: 'legítimo',
  legitimos: 'legítimos',
  exclusao: 'exclusão',
  exclusoes: 'exclusões',
  clausula: 'cláusula',
  clausulas: 'cláusulas',
  petrea: 'pétrea',
  petreas: 'pétreas',
  tributario: 'tributário',
  tributaria: 'tributária',
  judiciario: 'judiciário',
  codigo: 'código',
  infracao: 'infração',
  infracoes: 'infrações',
  sancao: 'sanção',
  sancoes: 'sanções',
  pregao: 'pregão',
  rescisao: 'rescisão',
  patrimonio: 'patrimônio',
  honorarios: 'honorários',
  acao: 'ação',
  acoes: 'ações',
  orgao: 'órgão',
  orgaos: 'órgãos',
  uniao: 'união',
  publico: 'público',
  publica: 'pública',
  publicos: 'públicos',
  publicas: 'públicas',
  juridico: 'jurídico',
  juridica: 'jurídica',
  juridicos: 'jurídicos',
  juridicas: 'jurídicas',
  audiencia: 'audiência',
  competencia: 'competência',
  inquerito: 'inquérito',
  estatutario: 'estatutário',
  proprio: 'próprio',
  propria: 'própria',
  previdencia: 'previdência',
  salario: 'salário',
  decisao: 'decisão',
  decisoes: 'decisões',
};

export function buildPortugueseOrTsQueryString(rawQuery: string): string {
  const rawWords = rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS_PT.has(w));

  if (rawWords.length === 0) {
    return rawQuery.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  }

  const expandedTokens = new Set<string>();
  for (const word of rawWords) {
    expandedTokens.add(word);
    const unaccented = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    expandedTokens.add(unaccented);
    const mappedAccented = COMMON_ACCENT_MAP[unaccented];
    if (mappedAccented) {
      expandedTokens.add(mappedAccented);
    }
  }

  return Array.from(expandedTokens).join(' OR ');
}

export async function lexicalSearch(
  db: DbClient,
  rawQuery: string,
  options: VectorSearchOptions = {},
): Promise<SearchResultItem[]> {
  const topK = options.topK ?? 20;
  const webQuery = buildPortugueseOrTsQueryString(rawQuery);
  if (!webQuery) return [];

  const conditions = [sql`c.tsv @@ websearch_to_tsquery('portuguese', ${webQuery})`];
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
      ts_rank_cd(c.tsv, websearch_to_tsquery('portuguese', ${webQuery})) AS score
    FROM chunks c
    INNER JOIN documents d ON d.id = c.document_id
    WHERE ${whereClause}
    ORDER BY score DESC
    LIMIT ${topK}
  `);

  const rows = result.rows as unknown as RawLexicalSearchRow[];

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
      lexicalScore: numScore,
    };
  });
}
