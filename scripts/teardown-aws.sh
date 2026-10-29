#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo "  SCRIPT DE TEARDOWN E LIMPEZA DE CUSTOS AWS (TERRAFORM DESTROY)"
echo "======================================================================"
echo ""
echo "AVISO: Este script remove todos os recursos criados na AWS para evitar custos residuais."
read -p "Deseja realmente destruir toda a infraestrutura AWS? (digite 'sim' para prosseguir): " CONFIRM
if [[ "${CONFIRM}" != "sim" ]]; then
  echo "Operação abortada pelo usuário."
  exit 0
fi

TF_DIR="infra/terraform"

if [[ ! -d "${TF_DIR}" ]]; then
  echo "Diretório de Terraform não encontrado em ${TF_DIR}."
  exit 1
fi

cd "${TF_DIR}"

echo "==> [1/3] Limpando buckets S3 (necessário antes do destroy)..."
DOCUMENTS_BUCKET=$(terraform output -raw documents_bucket_name 2>/dev/null || true)
if [[ -n "${DOCUMENTS_BUCKET}" ]]; then
  echo "Esvaziando bucket S3: ${DOCUMENTS_BUCKET}..."
  aws s3 rm "s3://${DOCUMENTS_BUCKET}" --recursive || true
fi

FRONTEND_BUCKET="lexa-web-frontend"
echo "Esvaziando bucket S3 do frontend: ${FRONTEND_BUCKET}..."
aws s3 rm "s3://${FRONTEND_BUCKET}" --recursive 2>/dev/null || true

echo "==> [2/3] Executando terraform destroy..."
terraform destroy -auto-approve

echo "==> [3/3] Todos os recursos AWS foram destruídos com sucesso. Custo residual: US$ 0,00."
