import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../api/app.js';
import {
  createPgliteConnection,
  type DatabaseConnection,
} from '../../db/client.js';
import { getInitialMigrationSql } from '../../db/migration-sql.js';
import { createLocalEmbeddingProvider } from '../../ingestion/embedder.js';
import { IngestService } from '../../ingestion/ingest-service.js';
import { hybridSearchRRF } from '../hybrid-search.js';
import {
  buildPortugueseOrTsQueryString,
  lexicalSearch,
} from '../lexical-search.js';

describe('Lexical Search (tsvector pt-BR) & Hybrid Search (RRF)', () => {
  let conn: DatabaseConnection;
  let ingestedDocumentId: string;
  const embedder = createLocalEmbeddingProvider('local-legal-pt-v1');

  beforeAll(async () => {
    conn = await createPgliteConnection();
    await conn.execSql(getInitialMigrationSql());

    const ingestService = new IngestService(conn.db, embedder);
    const res = await ingestService.ingestDocument({
      title: 'Código Penal - Decreto-Lei nº 2.848/1940',
      docType: 'lei',
      format: 'text',
      rawContent: [
        'TÍTULO II - DO CRIME',
        'Art. 23. Não há crime quando o agente pratica o fato: I - em estado de necessidade; II - em legítima defesa; III - em estrito cumprimento de dever legal.',
        'Art. 25. Entende-se em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem.',
      ].join('\n'),
    });
    ingestedDocumentId = res.document.id;
  });

  afterAll(async () => {
    await conn?.close();
  });

  it('expands unaccented Portuguese legal terms into accented OR tsquery tokens and strips stopwords', () => {
    const queryStr = buildPortugueseOrTsQueryString(
      'quais sao as causas de exclusao em legitima defesa e clausula petrea?',
    );

    expect(queryStr).toContain('legitima');
    expect(queryStr).toContain('legítima');
    expect(queryStr).toContain('exclusao');
    expect(queryStr).toContain('exclusão');
    expect(queryStr).toContain('clausula');
    expect(queryStr).toContain('cláusula');
    expect(queryStr).toContain('petrea');
    expect(queryStr).toContain('pétrea');
    expect(queryStr).not.toContain('quais');
  });

  it('executes lexicalSearch and hybridSearchRRF with documentId and docType filters', async () => {
    const lexResults = await lexicalSearch(
      conn.db,
      'legitima defesa injusta agressao',
      {
        topK: 5,
        documentId: ingestedDocumentId,
        docType: 'lei',
      },
    );

    expect(lexResults.length).toBeGreaterThan(0);
    expect(lexResults[0]?.article).toBe('Art. 25');
    expect(lexResults[0]?.lexicalScore).toBeGreaterThan(0);

    const [queryVec] = await embedder.embedBatch([
      'Como o Código Penal define legítima defesa contra injusta agressão?',
    ]);
    const hybridResults = await hybridSearchRRF(
      conn.db,
      'Como o Código Penal define legítima defesa contra injusta agressão?',
      queryVec!,
      {
        candidatePoolSize: 10,
        topK: 5,
        documentId: ingestedDocumentId,
        docType: 'lei',
      },
    );

    expect(hybridResults.length).toBeGreaterThan(0);
    expect(hybridResults.map((r) => r.article)).toContain('Art. 25');
  });

  it('executes POST /search across vector, lexical, and hybrid modes (with and without rerank)', async () => {
    const app = createApp({ db: conn.db, embedder });

    for (const mode of ['vector', 'lexical', 'hybrid'] as const) {
      for (const rerank of [true, false]) {
        const res = await request(app).post('/search').send({
          query: 'legítima defesa injusta agressão',
          mode,
          rerank,
          k: 3,
          documentId: ingestedDocumentId,
          docType: 'lei',
        });

        expect(res.status).toBe(200);
        expect(res.body.mode).toBe(mode);
        expect(res.body.results.length).toBeGreaterThan(0);
      }
    }
  });
});
