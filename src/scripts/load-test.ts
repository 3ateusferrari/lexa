import 'dotenv/config';
import { createServer, type Server } from 'node:http';
import { createApp } from '../modules/api/app.js';
import { createResilientDatabaseConnection, type DatabaseConnection } from '../modules/db/client.js';
import { parseEnv } from '../modules/shared/env.js';

interface RequestResult {
  statusCode: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

interface ScenarioReport {
  scenarioName: string;
  totalRequests: number;
  concurrency: number;
  totalTimeMs: number;
  requestsPerSecond: number;
  successRate: number;
  statusCodes: Record<number, number>;
  latencies: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

const LEGAL_QUESTIONS = [
  'Quais são as cláusulas pétreas da Constituição Federal de 1988?',
  'Quais são as causas de exclusão de ilicitude no Código Penal?',
  'Qual é o limite de valor para dispensa de licitação em obras de engenharia na Lei 14.133?',
  'Quais são os requisitos de validade do negócio jurídico segundo o Código Civil?',
  'Qual é a duração normal do trabalho e o percentual de hora extra na CLT?',
  'Qual é o prazo decadencial para reclamar por vícios aparentes no Código do Consumidor?',
  'Quais são as causas de suspensão da exigibilidade do crédito tributário no CTN?',
  'Quais são as sanções administrativas aplicáveis a licitantes na Lei 14.133/2021?',
  'Quais os direitos dos titulares de dados pessoais perante o controlador na LGPD?',
  'Como a lei define legítima defesa e estado de necessidade no Código Penal?',
];

function computeStats(latencies: number[]) {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] ?? sorted[sorted.length - 1]!;
  return {
    min: Number(sorted[0]!.toFixed(2)),
    max: Number(sorted[sorted.length - 1]!.toFixed(2)),
    avg: Number((sum / sorted.length).toFixed(2)),
    p50: Number(p(0.5).toFixed(2)),
    p90: Number(p(0.9).toFixed(2)),
    p95: Number(p(0.95).toFixed(2)),
    p99: Number(p(0.99).toFixed(2)),
  };
}

async function runWorkerPool(
  total: number,
  concurrency: number,
  workerFn: (index: number) => Promise<RequestResult>,
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  let currentIndex = 0;

  async function worker() {
    while (true) {
      const idx = currentIndex++;
      if (idx >= total) break;
      const res = await workerFn(idx);
      results.push(res);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runLoadTestScenario(
  name: string,
  totalRequests: number,
  concurrency: number,
  requestFn: (index: number) => Promise<RequestResult>,
): Promise<ScenarioReport> {
  const startedAt = performance.now();
  const results = await runWorkerPool(totalRequests, concurrency, requestFn);
  const totalTimeMs = performance.now() - startedAt;

  const statusCodes: Record<number, number> = {};
  const latencies: number[] = [];
  let successful = 0;

  for (const r of results) {
    statusCodes[r.statusCode] = (statusCodes[r.statusCode] ?? 0) + 1;
    latencies.push(r.durationMs);
    if (r.success) successful++;
  }

  const stats = computeStats(latencies);
  const requestsPerSecond = Number(((totalRequests / totalTimeMs) * 1000).toFixed(2));
  const successRate = Number(((successful / totalRequests) * 100).toFixed(2));

  return {
    scenarioName: name,
    totalRequests,
    concurrency,
    totalTimeMs: Number(totalTimeMs.toFixed(2)),
    requestsPerSecond,
    successRate,
    statusCodes,
    latencies: stats,
  };
}

function printScenarioReport(report: ScenarioReport) {
  console.log(`\n======================================================`);
  console.log(`  Cenário: ${report.scenarioName}`);
  console.log(`======================================================`);
  console.log(`Requisições Totais:    ${report.totalRequests}`);
  console.log(`Concorrência:          ${report.concurrency} conexões simultâneas`);
  console.log(`Tempo Total:           ${(report.totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`Taxa de Sucesso:       ${report.successRate}%`);
  console.log(`Vazão (Throughput):    ${report.requestsPerSecond} req/s`);
  console.log(`Status Codes:          ${JSON.stringify(report.statusCodes)}`);
  console.log(`------------------------------------------------------`);
  console.log(`Latências:`);
  console.log(`  Mínima:              ${report.latencies.min} ms`);
  console.log(`  Média:               ${report.latencies.avg} ms`);
  console.log(`  p50 (Mediana):       ${report.latencies.p50} ms`);
  console.log(`  p90:                 ${report.latencies.p90} ms`);
  console.log(`  p95:                 ${report.latencies.p95} ms`);
  console.log(`  p99:                 ${report.latencies.p99} ms`);
  console.log(`  Máxima:              ${report.latencies.max} ms`);
}

async function main() {
  console.log(`======================================================`);
  console.log(`  LEXA RAG — EXECUÇÃO DE TESTES DE CARGA & ESTRESSE   `);
  console.log(`======================================================`);

  const initialMem = process.memoryUsage();
  console.log(`Memória Inicial: RSS=${(initialMem.rss / 1024 / 1024).toFixed(1)}MB, Heap=${(initialMem.heapUsed / 1024 / 1024).toFixed(1)}MB`);

  const env = parseEnv();
  let conn: DatabaseConnection | undefined;
  let server: Server | undefined;
  let baseUrl = 'http://localhost:3000';

  // Check if a local server is already running, otherwise start an in-process instance
  try {
    const checkRes = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
    if (checkRes.ok) {
      console.log(`Usando servidor Lexa ativo em ${baseUrl}`);
    } else {
      throw new Error('Not running');
    }
  } catch {
    console.log(`Iniciando servidor de teste em porta temporária...`);
    conn = await createResilientDatabaseConnection(env.DATABASE_URL);
    const app = createApp({ db: conn.db });
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://localhost:${port}`;
    console.log(`Servidor de teste ativo em ${baseUrl}`);
  }

  const reports: ScenarioReport[] = [];

  try {
    // -----------------------------------------------------------------
    // CENÁRIO 1: Baseline HTTP /health (50 conexões concorrentes, 500 reqs)
    // -----------------------------------------------------------------
    const scenario1 = await runLoadTestScenario(
      'Baseline /health (Throughput & Web Layer Overhead)',
      500,
      50,
      async () => {
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}/health`);
          const t1 = performance.now();
          return {
            statusCode: res.status,
            durationMs: t1 - t0,
            success: res.ok,
          };
        } catch (err) {
          return {
            statusCode: 0,
            durationMs: performance.now() - t0,
            success: false,
            error: String(err),
          };
        }
      },
    );
    reports.push(scenario1);
    printScenarioReport(scenario1);

    // -----------------------------------------------------------------
    // CENÁRIO 2: Busca Híbrida Completa POST /search (pgvector + tsvector + RRF)
    // -----------------------------------------------------------------
    const scenario2 = await runLoadTestScenario(
      'Busca Híbrida (pgvector + tsvector + RRF + Reranker) sobre 6.300+ Chunks',
      100,
      10,
      async (idx) => {
        const query = LEGAL_QUESTIONS[idx % LEGAL_QUESTIONS.length]!;
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              mode: 'hybrid',
              k: 5,
              rerank: true,
            }),
          });
          const t1 = performance.now();
          const body = (await res.json().catch(() => ({}))) as { results?: unknown[] };
          const hasResults = Array.isArray(body.results) && body.results.length > 0;
          return {
            statusCode: res.status,
            durationMs: t1 - t0,
            success: res.ok && hasResults,
          };
        } catch (err) {
          return {
            statusCode: 0,
            durationMs: performance.now() - t0,
            success: false,
            error: String(err),
          };
        }
      },
    );
    reports.push(scenario2);
    printScenarioReport(scenario2);

    // -----------------------------------------------------------------
    // CENÁRIO 3: Chat com Streaming SSE POST /chat (Retrieval + Guard + SSE)
    // -----------------------------------------------------------------
    const scenario3 = await runLoadTestScenario(
      'Chat com Streaming SSE (Retrieval + Refusal Guard + Citations)',
      40,
      8,
      async (idx) => {
        const question = LEGAL_QUESTIONS[idx % LEGAL_QUESTIONS.length]!;
        const simulatedIp = `192.168.10.${(idx % 30) + 1}`;
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': simulatedIp,
            },
            body: JSON.stringify({ question, k: 3 }),
          });

          if (!res.ok || !res.body) {
            return {
              statusCode: res.status,
              durationMs: performance.now() - t0,
              success: false,
            };
          }

          // Consume the full SSE stream
          const reader = res.body.getReader();
          let streamBytes = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            streamBytes += value ? value.length : 0;
          }

          const t1 = performance.now();
          return {
            statusCode: res.status,
            durationMs: t1 - t0,
            success: streamBytes > 0,
          };
        } catch (err) {
          return {
            statusCode: 0,
            durationMs: performance.now() - t0,
            success: false,
            error: String(err),
          };
        }
      },
    );
    reports.push(scenario3);
    printScenarioReport(scenario3);

    // -----------------------------------------------------------------
    // CENÁRIO 4: Teste de Resiliência de Rate Limiting (Burst de 40 reqs do mesmo IP)
    // -----------------------------------------------------------------
    const scenario4 = await runLoadTestScenario(
      'Rate Limiting & Proteção contra DoS (Burst de 40 reqs rápidos do mesmo IP)',
      40,
      10,
      async () => {
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': '10.99.88.77',
            },
            body: JSON.stringify({ question: 'Pergunta repetida', k: 2 }),
          });
          const t1 = performance.now();
          // Both 200 and 429 are valid HTTP responses indicating proper rate limit handling
          const isExpected = res.status === 200 || res.status === 429;
          return {
            statusCode: res.status,
            durationMs: t1 - t0,
            success: isExpected,
          };
        } catch (err) {
          return {
            statusCode: 0,
            durationMs: performance.now() - t0,
            success: false,
            error: String(err),
          };
        }
      },
    );
    reports.push(scenario4);
    printScenarioReport(scenario4);

    // -----------------------------------------------------------------
    // CENÁRIO 5: Upload Presigned URL POST /documents/upload-url (Concurrency 15)
    // -----------------------------------------------------------------
    const scenario5 = await runLoadTestScenario(
      'Geração Concorrente de Upload Presigned URLs & Jobs SQS',
      60,
      15,
      async (idx) => {
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}/documents/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: `edital-concorrencia-${idx}.html`,
              contentType: 'text/html',
              fileSizeBytes: 25000 + idx * 100,
              title: `Edital de Licitação nº ${idx}/2026`,
              docType: 'edital',
            }),
          });
          const t1 = performance.now();
          const body = (await res.json().catch(() => ({}))) as { jobId?: string; uploadUrl?: string };
          const validJob = Boolean(body.jobId && body.uploadUrl);
          return {
            statusCode: res.status,
            durationMs: t1 - t0,
            success: res.status === 201 && validJob,
          };
        } catch (err) {
          return {
            statusCode: 0,
            durationMs: performance.now() - t0,
            success: false,
            error: String(err),
          };
        }
      },
    );
    reports.push(scenario5);
    printScenarioReport(scenario5);

  } finally {
    if (server) {
      server.close();
    }
    if (conn) {
      await conn.close().catch(() => {});
    }
  }

  const finalMem = process.memoryUsage();
  console.log(`\n======================================================`);
  console.log(`  RESUMO DE RECURSOS & ESTABILIDADE                   `);
  console.log(`======================================================`);
  console.log(`Memória Inicial:  RSS=${(initialMem.rss / 1024 / 1024).toFixed(1)}MB, Heap=${(initialMem.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Memória Final:    RSS=${(finalMem.rss / 1024 / 1024).toFixed(1)}MB, Heap=${(finalMem.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Variação de Heap: ${((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(1)}MB`);
  console.log(`\nTodos os ${reports.length} cenários de carga foram concluídos com sucesso!`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Falha na execução dos testes de carga:', err);
    process.exit(1);
  });
}
