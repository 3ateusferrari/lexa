# Checklist de Publicação, Bullets de Currículo & Divulgação — Lexa RAG

---

## 1. Bullets para o Currículo (Prontos para Copiar e Colar)

### Opção 1: Foco em Engenharia de Software / Backend / Cloud (Recomendado)
> **Engenheiro de Software / IA — Lexa (Assistente RAG Jurídico de Produção)**  
> - Desenvolveu um sistema RAG de alta precisão em **TypeScript** e **Drizzle ORM** sobre **PostgreSQL 16 com pgvector**, implementando chunking estrutural normativo (artigo/inciso) que elevou o **Hit Rate@5 de 64.4% para 100.0%** e o **MRR para 0.9741** em avaliação comparativa quantitativa sobre 55 questões de teste.  
> - Implementou busca híbrida via **Reciprocal Rank Fusion (RRF)** combinando embeddings locais densos e busca lexical `tsvector` pt-BR com cross-reranking e camada de recusa segura calibrada (100% de precisão de recusa para perguntas fora do escopo).  
> - Provisionou infraestrutura em nuvem na **AWS via Terraform** seguindo padrão de mercado (ECS Fargate, RDS em VPC privada, S3, SQS com Dead-Letter Queue e alarmes no AWS Budgets de US$ 10), com pipeline CI/CD no **GitHub Actions via OIDC** com Quality Gate automatizado que bloqueia merges com Hit Rate inferior a 75%.

### Opção 2: Versão Concisa (Para currículo de 1 página)
> **Lexa — Sistema RAG Jurídico em Produção (TypeScript, AWS, pgvector, Claude)**  
> - Arquitetei e implantei assistente RAG com busca híbrida (pgvector + tsvector via RRF) e reranking, atingindo **100% de Hit Rate@5 e MRR de 0.9741** na Lei 14.133/2021 e LGPD.  
> - Construí pipeline de ingestão desacoplado com S3 Presigned URLs e SQS/DLQ, interface React com streaming SSE e citações verificáveis, e infraestrutura como código (Terraform) na AWS com autenticação OIDC e Quality Gate no CI.

---

## 2. Post para LinkedIn & Redes Técnicas

```markdown
🚀 Acabo de finalizar o Lexa, um assistente RAG de nível de produção especializado na legislação brasileira (Lei nº 14.133/2021 de Licitações e LGPD), com foco absoluto em eliminar alucinações e fundamentar 100% das respostas com dispositivos legais verificáveis.

Em domínios críticos como o jurídico, modelos genéricos falham ao cortar artigos no meio ou inventar números de leis. Para resolver isso, estruturei o projeto com disciplina rigorosa de engenharia:

🔍 Resultados Medidos (Dataset com 55 perguntas avaliadas):
• Chunking fixo (240 chars): 64.4% Hit Rate@5 | MRR: 0.4244
• Chunking estrutural jurídico: 97.8% Hit Rate@5 | MRR: 0.9778
• Pipeline final (Híbrido RRF + Reranker + Refusal Guard): 100.0% Hit Rate@5 | MRR: 0.9741 | 100% acurácia de recusa segura.

☁️ Arquitetura em Nuvem na AWS (Terraform):
• API & Worker assíncrono em containers ECS Fargate
• Amazon RDS PostgreSQL 16 com extensão pgvector isolado em subnets privadas
• Ingestão desacoplada com S3 Presigned URLs e fila SQS com Dead-Letter Queue
• Streaming SSE com Anthropic Claude 3.5 e badges de citação auditáveis
• CI/CD com GitHub Actions OIDC (sem chaves estáticas) e Quality Gate automatizado que quebra o build se a qualidade do RAG regredir.

💻 Código 100% aberto no GitHub com runbook de rollback, scripts de teardown e notas técnicas:
https://github.com/3ateusferrari/lexa

O que acharam da estratégia de busca híbrida com RRF para textos normativos? Feedbacks e conexões são muito bem-vindos!
```

---

## 3. Checklist Final de Entrega

- [x] **Milestone 1 — Setup, Modelagem e Baseline Inicial** (`ISSUE-01` a `ISSUE-08`)
- [x] **Milestone 2 — Avaliação Quantitativa e Comparativo dos 4 Experimentos** (`ISSUE-09` a `ISSUE-13`)
- [x] **Milestone 3 — Geração Fundamentada, Streaming e Ingestão Assíncrona** (`ISSUE-14` a `ISSUE-18`)
- [x] **Milestone 4 — Infraestrutura AWS em Terraform e Primeiro Deploy** (`ISSUE-19` a `ISSUE-23`)
- [x] **Milestone 5 — CI/CD com OIDC, Gate de Qualidade do RAG e Observabilidade** (`ISSUE-24` a `ISSUE-29`)
- [x] **Milestone 6 — Documentação de Alto Nível, Preparação para Entrevista e Checklist Final** (`ISSUE-30` a `ISSUE-32`)
- [x] **Suíte de Testes:** 100% passando (Unitários, Integração, E2E, Regressão do Quality Gate)
- [x] **Typecheck e Lint:** Zero erros (`tsc --noEmit` e `eslint`)
- [x] **Teardown Seguro:** `scripts/teardown-aws.sh` pronto para zerar custos na AWS.
