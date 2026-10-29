# Runbook Operacional de Rollback — Lexa RAG

Este runbook descreve os procedimentos exatos de reversão (*rollback*) em caso de incidente após deploy na branch `main`.

---

## 1. Rollback da Aplicação no ECS Fargate (API e Worker)

Todas as imagens no Amazon ECR são imutáveis e tagueadas com o SHA do commit (`<git-sha>`). Para reverter para a revisão anterior da Task Definition:

```bash
# 1. Listar as últimas revisões da Task Definition da API
aws ecs list-task-definitions \
  --family-prefix lexa-api \
  --sort DESC \
  --max-items 5

# 2. Apontar o serviço ECS para a revisão anterior estável (ex.: lexa-api:4)
aws ecs update-service \
  --cluster lexa-cluster \
  --service lexa-api-service \
  --task-definition lexa-api:4 \
  --force-new-deployment

# 3. Repetir para o Worker se necessário (ex.: lexa-worker:4)
aws ecs update-service \
  --cluster lexa-cluster \
  --service lexa-worker-service \
  --task-definition lexa-worker:4 \
  --force-new-deployment

# 4. Aguardar estabilização e validar o healthcheck
aws ecs wait services-stable \
  --cluster lexa-cluster \
  --services lexa-api-service lexa-worker-service
```

---

## 2. Rollback de Migration de Banco de Dados (Drizzle / PostgreSQL)

As migrations em `src/modules/db/migration-sql.ts` possuem scripts determinísticos de `up` e `down`.

> **Regra de ouro:** Sempre reverta primeiro a versão do container no ECS para uma versão compatível com o schema anterior antes de executar o `down` no banco.

```bash
# Reverter o schema de banco de dados
DATABASE_URL="postgresql://..." npm run db:migrate:down
```

---

## 3. Rollback do Frontend (S3 + CloudFront)

Para restaurar a versão anterior do frontend estático:

```bash
# 1. Fazer checkout do commit anterior estável
git checkout <commit-sha-anterior>

# 2. Gerar o build estático e sincronizar com o bucket S3 privado
npm run build:web
aws s3 sync web/dist "s3://lexa-web-frontend" --delete

# 3. Invalidar o cache da distribuição CloudFront
aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths "/*"
```
