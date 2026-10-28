#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = resolve(__dirname, '../docs/plano-milestones-issues.md');
const REPO = process.env.GH_REPO || '3ateusferrari/lexa';
const DRY_RUN = process.argv.includes('--dry-run');

function runGh(args, input = undefined) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function parsePlan(markdown) {
  const milestones = [];
  const issues = [];

  const milestoneRegex = /^### (Milestone \d+: [^\n]+)\n\n\*\*Objetivo:\*\* ([^\n]+)/gm;
  let mMatch;
  const milestonePositions = [];

  while ((mMatch = milestoneRegex.exec(markdown)) !== null) {
    const title = mMatch[1].trim();
    const description = mMatch[2].trim();
    const milestoneObj = { title, description, index: mMatch.index };
    milestones.push(milestoneObj);
    milestonePositions.push(milestoneObj);
  }

  const issueHeaderRegex = /^#### `(ISSUE-\d+)` · ([^\n]+)\n([\s\S]*?)(?=^#### `ISSUE-\d+`|^---|^## 4\.)/gm;
  let iMatch;
  while ((iMatch = issueHeaderRegex.exec(markdown)) !== null) {
    const id = iMatch[1].trim();
    const rawTitle = iMatch[2].trim();
    const bodyContent = iMatch[3].trim();
    const pos = iMatch.index;

    // Find which milestone this issue belongs to
    let currentMilestone = milestones[0]?.title || '';
    for (const ms of milestonePositions) {
      if (pos > ms.index) {
        currentMilestone = ms.title;
      }
    }

    // Extract labels from Módulo and Execução lines
    const labels = new Set();
    const modLine = bodyContent.match(/^- \*\*Módulo:\*\*\s*(.+)$/m);
    if (modLine) {
      const modMatches = modLine[1].match(/mod:[a-z0-9_-]+/g);
      if (modMatches) {
        modMatches.forEach((m) => labels.add(m));
      } else if (modLine[1].toLowerCase().includes('documentação')) {
        labels.add('mod:docs');
      } else if (modLine[1].toLowerCase().includes('portfólio') || modLine[1].toLowerCase().includes('apresentação')) {
        labels.add('mod:portfolio');
      }
    }

    const execLine = bodyContent.match(/^- \*\*Execução:\*\*\s*(.+)$/m);
    if (execLine) {
      if (execLine[1].includes('[à mão')) labels.add('exec:a-mao');
      if (execLine[1].includes('[IA ok')) labels.add('exec:ia-ok');
    }

    const fullTitle = `[${id}] ${rawTitle}`;
    const fullBody = [
      `> **Milestone:** ${currentMilestone}`,
      '',
      bodyContent,
      '',
      '---',
      '*Gerado a partir de `docs/plano-milestones-issues.md`*',
    ].join('\n');

    issues.push({
      id,
      title: fullTitle,
      milestone: currentMilestone,
      labels: Array.from(labels),
      body: fullBody,
    });
  }

  return { milestones, issues };
}

const LABEL_DEFINITIONS = {
  'mod:db': { color: '1D76DB', description: 'Banco de dados PostgreSQL, pgvector, tsvector e Drizzle ORM' },
  'mod:ingestion': { color: '0E8A16', description: 'Extração, chunking estrutural legal e embeddings locais' },
  'mod:rag': { color: '5319E7', description: 'Busca vetorial, lexical, RRF, reranking, prompt Claude e citações' },
  'mod:eval': { color: 'FBCA04', description: 'Dataset ouro, métricas Hit Rate@k / MRR e CI Quality Gate' },
  'mod:api': { color: 'D93F0B', description: 'API HTTP Express, SSE streaming, middlewares e segurança' },
  'mod:worker': { color: '006B75', description: 'Worker SQS assíncrono e processamento de documentos S3' },
  'mod:web': { color: 'C2E0C6', description: 'Frontend React + Vite, citações clicáveis e painel de qualidade' },
  'mod:infra': { color: '0052CC', description: 'Infraestrutura AWS com Terraform (RDS, ECS Fargate, S3, CloudFront, IAM)' },
  'mod:ci': { color: 'BFD4F2', description: 'GitHub Actions CI/CD, OIDC e automação de deploy' },
  'mod:docs': { color: 'FEF2C0', description: 'Documentação técnica, experimentos e README' },
  'mod:portfolio': { color: 'F9D0C4', description: 'Demo pública, vídeo, roteiro de entrevista e currículo' },
  'exec:a-mao': { color: 'B60205', description: 'Núcleo implementado à mão (IA apenas revisa/explica)' },
  'exec:ia-ok': { color: '0E8A16', description: 'Pode delegar para IA e revisar' },
};

async function main() {
  const markdown = readFileSync(PLAN_PATH, 'utf8');
  const { milestones, issues } = parsePlan(markdown);

  console.log(`Plano lido com sucesso: ${milestones.length} Milestones e ${issues.length} Issues encontradas.`);

  if (DRY_RUN) {
    console.log('\n--- MILESTONES ---');
    for (const m of milestones) {
      console.log(`* ${m.title} -> ${m.description}`);
    }
    console.log('\n--- ISSUES ---');
    for (const i of issues) {
      console.log(`* ${i.title} | Milestone: ${i.milestone} | Labels: ${i.labels.join(', ')}`);
    }
    return;
  }

  // Verify gh auth
  try {
    runGh(['auth', 'status']);
  } catch (err) {
    console.error('Erro: GitHub CLI (gh) não está autenticado. Execute `gh auth login` primeiro.');
    process.exit(1);
  }

  console.log(`\n1. Sincronizando Labels em ${REPO}...`);
  for (const [name, meta] of Object.entries(LABEL_DEFINITIONS)) {
    try {
      runGh([
        'label',
        'create',
        name,
        '--repo',
        REPO,
        '--color',
        meta.color,
        '--description',
        meta.description,
        '--force',
      ]);
      console.log(`  [OK] Label: ${name}`);
    } catch (e) {
      console.error(`  [ERRO] Label ${name}:`, e.message);
    }
  }

  console.log(`\n2. Sincronizando Milestones em ${REPO}...`);
  const existingMilestonesJson = runGh(['api', `repos/${REPO}/milestones?state=all&per_page=100`]);
  const existingMilestones = JSON.parse(existingMilestonesJson);
  const milestoneMap = new Map(existingMilestones.map((m) => [m.title, m.number]));

  for (const m of milestones) {
    if (milestoneMap.has(m.title)) {
      console.log(`  [EXISTE] ${m.title} (#${milestoneMap.get(m.title)})`);
    } else {
      const createdJson = runGh([
        'api',
        `repos/${REPO}/milestones`,
        '-X',
        'POST',
        '-f',
        `title=${m.title}`,
        '-f',
        `description=${m.description}`,
      ]);
      const created = JSON.parse(createdJson);
      milestoneMap.set(m.title, created.number);
      console.log(`  [CRIADO] ${m.title} (#${created.number})`);
    }
  }

  console.log(`\n3. Sincronizando Issues em ${REPO}...`);
  const existingIssuesJson = runGh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--state',
    'all',
    '--limit',
    '200',
    '--json',
    'number,title',
  ]);
  const existingIssues = JSON.parse(existingIssuesJson);
  const existingTitles = new Set(existingIssues.map((i) => i.title));

  for (const issue of issues) {
    if (existingTitles.has(issue.title)) {
      console.log(`  [EXISTE] ${issue.title}`);
      continue;
    }

    const args = [
      'issue',
      'create',
      '--repo',
      REPO,
      '--title',
      issue.title,
      '--body',
      issue.body,
      '--milestone',
      issue.milestone,
    ];
    for (const label of issue.labels) {
      args.push('--label', label);
    }

    const url = runGh(args);
    console.log(`  [CRIADA] ${issue.title} -> ${url}`);
  }

  console.log('\nConcluído! Todas as Milestones e Issues foram publicadas no GitHub.');
}

main();
