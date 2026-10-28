# Plano do projeto: assistente RAG de legislação e editais

27 de outubro de 2026

## Visão geral

O objetivo é publicar em cerca de 10 semanas um assistente de busca semântica (RAG) sobre legislação e editais brasileiros, feito com Express e React, no ar na AWS e com CI/CD, para posicionar você como desenvolvedor full stack JS/TS.

- **Problema:** achar o artigo ou a cláusula certa em documentos longos, com uma resposta que cita a fonte e pode ser conferida.
- **Usuário:** quem consulta leis, editais e contratos (servidor público, fornecedor, estudante de direito).
- **O que o recrutador faz em 30 segundos:** abre a demo, faz uma pergunta, clica na citação e vê o painel de qualidade.
- **Competências que o projeto prova:** TypeScript, AWS, RAG, infraestrutura como código e CI/CD com OIDC. Hoje nenhuma delas aparece no seu currículo.
- **Ponto de partida:** sua experiência com NestJS, BullMQ e SQL Server na ALESC e com chatbots na Dígitro. O projeto reaproveita esse domínio em vez de começar do zero.

## Escopo

O MVP entrega busca com resposta citada sobre um corpus pequeno e bem escolhido, medida por uma avaliação automática. Tudo que não ajuda a provar isso fica fora.

**Dentro do MVP**

- Ingestão de PDF/HTML por upload e por script, com extração da estrutura (artigo, parágrafo, inciso)
- Busca híbrida (vetorial + texto) com reranking
- Chat com resposta em streaming, citação clicável e recusa quando não há base
- Painel de qualidade com hit rate@k e MRR
- Deploy na AWS, CI/CD e demo pública sem cadastro

**Fora do MVP**

- Login e contas de usuário (a demo é pública; adicione depois se sobrar tempo)
- Multi-tenant, pagamentos e múltiplos idiomas
- Fine-tuning de modelos

**Corpus inicial sugerido:** a Lei 14.133/2021 (licitações e contratos), por ligar com o seu trabalho no SPECTRO, mais a LGPD (Lei 13.709/2018) para ter dois domínios. Baixe os textos das fontes oficiais (planalto.gov.br) e registre a data de download no repositório.

**Decisões em aberto**

| Decisão | Opções | Tradeoff |
| --- | --- | --- |
| LLM e embeddings | API da OpenAI · Amazon Bedrock | OpenAI é mais simples de começar; Bedrock mantém tudo na conta AWS e mostra mais serviços |
| Linguagem | TypeScript · JavaScript | TypeScript pesa mais no currículo JS/TS e pega erros cedo |
| Hospedagem do banco | RDS PostgreSQL · Postgres em Docker numa EC2/Lightsail | RDS é o padrão de mercado e custa mais; a EC2 é barata e exige mais operação |
| Computação da API | ECS Fargate · App Runner | Fargate ensina mais (redes, tasks, IAM); App Runner é mais rápido de subir |

## Stack

A stack enxuta, com cada peça justificável em entrevista: o objetivo é demonstrar decisões, não acumular ferramentas.

| Camada | Escolha | Por quê |
| --- | --- | --- |
| API | Node + Express + TypeScript | Pedido seu; Express deixa as decisões de estrutura explícitas |
| Validação | Zod | Valida entrada em runtime e gera os tipos |
| Front | React + Vite + TypeScript | Build rápido e deploy estático em S3/CloudFront |
| Banco | PostgreSQL + pgvector | Vetores e texto no mesmo banco; o mesmo schema serve no Spring depois |
| Acesso a dados | SQL direto (node-postgres) ou Drizzle | Mostra que você domina SQL; evite ORM pesado nas queries de busca |
| Fila | SQS + worker Node | Ingestão assíncrona com retry e DLQ |
| LLM | OpenAI ou Bedrock | Ver decisão em aberto no escopo |
| Infra como código | Terraform | Ambiente reproduzível e revisável |
| Testes | Vitest + Supertest + Testcontainers | Testes de integração com Postgres real |
| Qualidade | ESLint, Prettier, `tsc --noEmit` | Rodam no CI |
| Containers | Docker + Docker Compose | Ambiente local idêntico ao de produção |

## Arquitetura

Consulta (síncrona e curta): Navegador (React, CloudFront + S3) → API Express (Node + TypeScript, ECS Fargate) → RDS PostgreSQL (pgvector + tsvector) e LLM/embeddings (OpenAI ou Bedrock) para gerar a resposta.

Ingestão (assíncrona, fora da requisição do usuário): Navegador → S3 documentos (upload por URL assinada) → evento → SQS + DLQ (fila, retry) → Worker Node (chunking por artigo, gera embeddings via LLM/embeddings) → grava no RDS PostgreSQL.

A consulta é síncrona e curta. O documento vai direto para o S3, e o worker o processa pela fila, com retry e DLQ, sem travar a API.

Também na AWS: ECR para as imagens, Secrets Manager para segredos, CloudWatch para logs e alarmes, e uma role IAM separada para API, worker e deploy.

## Modelo de dados

Cinco tabelas bastam: documentos, trechos (com vetor e texto indexados), jobs de ingestão e duas de avaliação. A dimensão do vetor depende do modelo de embeddings escolhido; o 1536 abaixo é um exemplo.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  doc_type      text NOT NULL,          -- lei, edital, contrato
  source_url    text,
  downloaded_at date,
  content_hash  text NOT NULL UNIQUE,   -- evita ingerir duas vezes
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position     int  NOT NULL,           -- ordem no documento
  article      text,                    -- ex.: Art. 75
  section_path text,                    -- ex.: Título II > Capítulo I
  page         int,
  content      text NOT NULL,
  embedding    vector(1536),
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED
);

CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX chunks_tsv_idx       ON chunks USING gin (tsv);

CREATE TABLE ingestion_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id),
  status      text NOT NULL,            -- queued, processing, done, failed
  attempts    int  NOT NULL DEFAULT 0,
  error       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eval_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question         text NOT NULL,
  expected_article text,                -- NULL = pergunta sem resposta no corpus
  document_id      uuid REFERENCES documents(id)
);

CREATE TABLE eval_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  git_sha    text NOT NULL,
  config     jsonb NOT NULL,            -- chunking, k, modelo, reranker
  hit_rate   real NOT NULL,
  mrr        real NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

As migrations ficam versionadas no repositório (node-pg-migrate ou Drizzle Kit) e rodam no CI e no deploy.

## Pipeline de RAG

A qualidade vem de chunking que respeita a estrutura legal e de busca híbrida, não do modelo de linguagem. Os números abaixo são valores iniciais para ajustar com a avaliação, não verdades.

1. **Extração:** PDF/HTML para texto limpo, removendo cabeçalhos, rodapés e numeração de página repetidos.
2. **Chunking por estrutura:** um chunk por artigo, e por parágrafo ou inciso quando o artigo for longo. Cada chunk leva o caminho (título, capítulo, artigo) como metadado e como prefixo do texto embutido.
3. **Embeddings:** gerados em lote no worker, com cache pelo hash do texto para não pagar duas vezes.
4. **Busca híbrida:** consulta vetorial (pgvector) e consulta de texto (tsvector em português) em paralelo, cerca de 20 resultados cada, unidas por Reciprocal Rank Fusion.
5. **Reranking:** os melhores candidatos da fusão passam por um reranker (modelo de reranking via API ou LLM), ficando com 5 trechos.
6. **Geração:** o prompt separa instruções de contexto, pede resposta só com base nos trechos e exige o identificador do trecho em cada afirmação. Resposta em streaming via SSE.
7. **Recusa:** se o melhor trecho ficar abaixo de um limiar de relevância, a API responde "não encontrei isso nos documentos" sem chamar o LLM. O limiar sai da avaliação.

**Contra prompt injection:** trate o texto dos documentos como dado, delimite-o no prompt, e valide que os identificadores citados existem entre os trechos recuperados antes de devolver a resposta.

**Pergunta para você registrar no README:** por que RRF em vez de somar scores? (Resposta curta: os scores vetorial e textual têm escalas diferentes; RRF usa só a posição no ranking.)

## Avaliação

A avaliação é o que separa o projeto de uma demo: um dataset escrito por você, métricas calculadas a cada PR e um build que falha quando a qualidade cai.

**Dataset:** de 50 a 100 perguntas escritas à mão, cada uma com o artigo esperado. Inclua cerca de 10 perguntas sem resposta no corpus, para testar a recusa. Escreva-as você mesmo: se a IA gerar tudo, o número no currículo perde valor.

**Métricas**

- **Hit rate@k:** fração das perguntas em que o artigo esperado aparece entre os k primeiros resultados.
- **MRR:** média do inverso da posição do primeiro resultado correto.
- **Taxa de recusa correta:** fração das perguntas sem resposta em que o sistema recusa.
- **Citação válida:** fração das respostas cujos identificadores citados existem entre os trechos recuperados.

```latex
\mathrm{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\mathrm{rank}_i}
```

**Gate no CI:** um script roda o dataset contra a API de teste, grava o resultado em `eval_runs` e compara com a última execução da `main`. Se hit rate@5 ou MRR caírem além de uma tolerância, o job falha. Defina a tolerância depois da primeira medição, não antes.

**Experimentos para registrar no README** (cada um com a tabela de resultados):

- Chunking por estrutura contra tamanho fixo
- Só vetorial contra só texto contra híbrido
- Com e sem reranking
- Dois modelos de embeddings

## Roadmap

São seis fases em 10 semanas, e a avaliação vem antes do front de propósito: medir cedo evita otimizar o pipeline no escuro. Em cada tarefa, **[à mão]** significa que o núcleo é seu e a IA só revisa ou explica; **[IA ok]** significa que pode delegar e você revisa.

| Fase | Semanas | Entrega | Gate de saída |
| --- | --- | --- | --- |
| 1. Busca local | 1–2 | Ingestão e busca vetorial rodando no Docker Compose | Pergunta no terminal retorna o artigo certo |
| 2. Avaliação e busca híbrida | 3–4 | Dataset, métricas, RRF e reranking | Tabela de experimentos com ganho medido |
| 3. Chat e front | 5–6 | API de chat com SSE e interface React | Demo local completa com citações clicáveis |
| 4. AWS | 7–8 | Infra em Terraform e app no ar | URL pública funcionando |
| 5. CI/CD | 9 | Pipelines com OIDC e gate de avaliação | PR que piora a métrica falha o build |
| 6. Acabamento | 10 | Observabilidade, README, demo e currículo | Checklist final marcado |

### Fase 1 · Busca local (semanas 1–2)

- [ ] Repositório, Docker Compose com Postgres + pgvector e `.env.example` **[IA ok]**
- [ ] CI básico no GitHub Actions: lint, `tsc --noEmit` e testes **[IA ok]**
- [ ] Schema e migrations **[à mão]**
- [ ] Extração de texto e chunking por artigo da Lei 14.133 **[à mão]**
- [ ] Script de ingestão com embeddings em lote e cache por hash **[à mão]**
- [ ] `POST /search` com busca vetorial e validação Zod **[à mão]**
- [ ] Testes de integração com Testcontainers **[IA ok]**

### Fase 2 · Avaliação e busca híbrida (semanas 3–4)

- [ ] Dataset de 50+ perguntas com artigo esperado, incluindo ~10 sem resposta **[à mão]**
- [ ] Script de avaliação com hit rate@k e MRR, gravando em `eval_runs` **[à mão]**
- [ ] Baseline só vetorial, registrado **[à mão]**
- [ ] Busca de texto (tsvector) e fusão por RRF **[à mão]**
- [ ] Reranking e limiar de recusa **[à mão]**
- [ ] Tabela de experimentos no README (chunking, híbrido, reranking) **[à mão]**

### Fase 3 · Chat e front (semanas 5–6)

- [ ] `POST /chat` com prompt, streaming SSE e validação de citações **[à mão]**
- [ ] Upload de documento, fila SQS (LocalStack no Compose) e worker de ingestão **[à mão]**
- [ ] Front React: chat com streaming e citação clicável com trecho destacado **[IA ok]**
- [ ] Painel de qualidade lendo `eval_runs` **[IA ok]**
- [ ] Rate limiting e tratamento de erros padronizado **[à mão]**

### Fase 4 · AWS (semanas 7–8)

- [ ] Alarme de orçamento da AWS antes de criar qualquer recurso **[à mão]**
- [ ] Terraform: rede, banco, ECR, serviço da API, SQS com DLQ, buckets, CloudFront **[à mão a estrutura; IA ok para sintaxe]**
- [ ] Roles IAM com menor privilégio para API e worker **[à mão]**
- [ ] Segredos no Secrets Manager ou SSM, nunca no código **[à mão]**
- [ ] Migrations rodando no deploy e ingestão do corpus no ambiente **[à mão]**
- [ ] Teste de ponta a ponta na URL pública **[IA ok]**

### Fase 5 · CI/CD (semana 9)

- [ ] Workflow de PR: lint, tipos, testes, build da imagem e avaliação **[à mão]**
- [ ] Workflow de deploy na `main`: ECR, ECS e S3 + invalidação do CloudFront **[à mão]**
- [ ] Autenticação com a AWS por OIDC, sem chaves fixas **[à mão]**
- [ ] `terraform plan` comentado no PR **[IA ok]**
- [ ] Provar o gate: abrir um PR que piora o chunking e ver o build falhar **[à mão]**

### Fase 6 · Acabamento (semana 10)

- [ ] Logs estruturados, métricas e alarmes no CloudWatch **[à mão a escolha; IA ok para a configuração]**
- [ ] README com diagrama, decisões e tabela de experimentos **[à mão]**
- [ ] Demo com corpus carregado e perguntas de exemplo na tela inicial **[IA ok]**
- [ ] Vídeo curto (1 a 2 minutos) mostrando o fluxo **[à mão]**
- [ ] Bullet do currículo e atualização do portfólio **[à mão]**

## CI/CD

Dois workflows no GitHub Actions: um valida cada PR e outro faz o deploy da `main`. A autenticação na AWS usa OIDC, então nenhuma chave de acesso fica guardada no GitHub.

| Workflow | Gatilho | Passos |
| --- | --- | --- |
| `ci.yml` | Pull request | Instalar dependências com cache, lint, `tsc --noEmit`, testes de integração, build da imagem, avaliação do RAG com gate, `terraform plan` |
| `deploy.yml` | Push na `main` | Build e push da imagem para o ECR, rodar migrations, atualizar o serviço da API, build do front, sync para o S3 e invalidação do CloudFront |

**Como configurar o OIDC**

1. Criar na AWS um provedor de identidade OIDC para o GitHub Actions (`token.actions.githubusercontent.com`).
2. Criar uma role IAM cuja política de confiança aceite só o seu repositório e a branch `main` (condição no campo `sub` do token).
3. Dar à role apenas as permissões do deploy: ECR, ECS, S3 do front e invalidação do CloudFront.
4. No workflow, declarar `permissions: id-token: write` e usar a action oficial `aws-actions/configure-aws-credentials` com o ARN da role.

**Boas práticas para mostrar**

- Ambiente `production` do GitHub com aprovação manual no deploy (opcional, mas sinaliza maturidade)
- Versões das actions fixadas e Dependabot ativo
- Tag da imagem igual ao SHA do commit, para rastrear o que está no ar
- Rollback documentado: reimplantar a imagem anterior pelo SHA

**Pergunta para você registrar no README:** por que OIDC é mais seguro que uma access key? (Credenciais de curta duração, sem segredo para vazar ou rotacionar, e a role só vale para este repositório e esta branch.)

## Segurança, observabilidade e custo

Uma demo pública que chama um LLM é um alvo de abuso e de conta alta, então estes três assuntos precisam estar resolvidos antes de divulgar o link.

**Segurança**

- Validação de toda entrada com Zod e limite de tamanho do corpo e dos uploads
- Rate limiting por IP na API de chat
- Upload restrito a tipo e tamanho; processar arquivos só no worker, nunca na API
- Helmet e CORS restrito ao domínio do front
- Segredos no Secrets Manager ou SSM; `.env` fora do Git e varredura de segredos no CI
- Roles IAM separadas para API, worker e deploy, cada uma com o mínimo necessário
- Prompt injection tratada como descrito no pipeline de RAG

**Observabilidade**

- Logs em JSON com um identificador de requisição que atravessa API, fila e worker
- Métricas por requisição: latência da busca, latência da geração, tokens usados e resultado da recusa
- Alarmes no CloudWatch para erro 5xx, mensagens na DLQ e custo
- Endpoint `/health` usado pelo balanceador e pelo deploy

**Custo**

- Criar o alarme de orçamento antes de qualquer recurso
- Limite diário de chamadas ao LLM no servidor, com mensagem amigável ao estourar
- Cache de embeddings e de respostas para as perguntas de exemplo da tela inicial
- Documentar no README quanto o ambiente custa por mês e como derrubá-lo (`terraform destroy`) fora de períodos de entrevista

**Pergunta para você registrar no README:** o que acontece se alguém tentar gastar o seu orçamento? (Rate limit, limite diário e alarme.)

## README, demo e currículo

O recrutador decide em poucos minutos, então o README e a demo valem tanto quanto o código.

**Estrutura do README, nesta ordem**

1. Uma frase do que o projeto faz, link da demo e captura de tela ou GIF
2. Diagrama de arquitetura
3. Como rodar localmente com um comando (`docker compose up`)
4. Decisões e trade-offs (banco, chunking, híbrido, OIDC, custo)
5. Resultados da avaliação, com a tabela de experimentos
6. Segurança e custo
7. Uso de IA: uma linha dizendo em quais partes você usou apoio de IA e que arquitetura, avaliação e decisões são suas

**Demo**

- Abre sem cadastro, com o corpus carregado e três perguntas de exemplo clicáveis
- Mostra a citação ao lado da resposta e o painel de qualidade em uma aba visível
- Aviso de que é um projeto de portfólio e não substitui consulta jurídica

**Bullet do currículo (preencha com os números medidos)**

```markdown
**[Nome do projeto]** | Node.js, Express, React, TypeScript, PostgreSQL/pgvector, AWS, Terraform
- Busca híbrida com reranking sobre legislação, com citação por artigo; avaliada em [N] perguntas (hit rate@5 de [X]%, MRR de [Y]).
- Deploy na AWS com infraestrutura em Terraform e CI/CD no GitHub Actions com OIDC; o build falha quando a qualidade de recuperação cai.
- [demo] [repo]
```

Só publique os números depois de medi-los. Os valores entre colchetes ficam em branco até lá.

**Roteiro de entrevista: perguntas que você deve responder sem abrir o código**

- Por que chunking por artigo e não por tamanho fixo? O que a avaliação mostrou?
- Como a busca híbrida combina vetor e texto, e por que RRF?
- Como o sistema evita que o modelo invente uma resposta?
- O que a role do deploy pode e não pode fazer na AWS?
- Por que SQS entre a API e o worker? O que acontece quando um job falha de novo e de novo?
- Quanto custa rodar e como você limita o abuso?
- O que você faria diferente com mais tempo?

## Checklist de publicação

O projeto só entra no currículo quando todos os itens abaixo estiverem marcados.

- [ ] A demo abre em uma URL pública, sem cadastro, e responde às perguntas de exemplo
- [ ] Qualquer pessoa sobe o ambiente local com `docker compose up` seguindo o README
- [ ] O README tem diagrama, decisões, tabela de experimentos e a linha sobre uso de IA
- [ ] Os números do currículo vêm de uma execução registrada em `eval_runs`
- [ ] O CI passa na `main` e um PR de teste que piora a métrica falha o build
- [ ] Não há chave de acesso nem segredo no repositório nem no histórico do Git
- [ ] O alarme de orçamento e o limite diário de LLM estão ativos
- [ ] Você responde sem consultar o código todas as perguntas do roteiro de entrevista
- [ ] Um amigo escolheu um arquivo aleatório e você explicou o que ele faz e por quê
- [ ] O repositório está fixado no GitHub e o projeto está no topo do portfólio e do currículo JS/TS
- [ ] Existe um plano para derrubar o ambiente (`terraform destroy`) quando não for usado
