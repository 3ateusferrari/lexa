#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/4] Aplicando migrations Drizzle/PostgreSQL (pgvector + tsvector)..."
npm run db:migrate

echo "==> [2/4] Ingerindo corpus normativo inicial (Lei 14.133/2021 + LGPD)..."
npm run ingest:corpus

echo "==> [3/4] Semeando dataset dourado de avaliacao (55 perguntas)..."
npm run eval:seed

if [[ -n "${FRONTEND_S3_BUCKET:-}" ]]; then
  echo "==> [4/4] Publicando build do frontend React no S3 e invalidando CloudFront..."
  npm run build:web
  aws s3 sync web/dist "s3://${FRONTEND_S3_BUCKET}" --delete
  if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
    aws cloudfront create-invalidation \
      --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
      --paths "/*"
  fi
else
  echo "==> [4/4] Variavel FRONTEND_S3_BUCKET nao definida; pulando sync S3."
fi

echo "==> Deploy, migrations e seed concluidos com sucesso!"
