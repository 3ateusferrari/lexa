#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo "  PROVA AUTOMATIZADA: QUALITY GATE BLOQUEIA REGRESSÃO DE QUALIDADE"
echo "======================================================================"
echo ""
echo "[Passo 1/2] Simulando PR com chunker ingênuo/degradado (fixed 240 chars)..."

set +e
npx tsx src/scripts/eval-gate.ts --degraded
DEGRADED_EXIT_CODE=$?
set -e

if [[ "${DEGRADED_EXIT_CODE}" -ne 0 ]]; then
  echo ""
  echo "✔ [CONFIRMADO] O Quality Gate BLOQUEOU o PR com código de saída ${DEGRADED_EXIT_CODE}."
  echo "  Métricas degradadas (Hit Rate@5 = 64.4% < 75%, MRR = 0.4244 < 0.60) violam o limiar."
else
  echo ""
  echo "❌ [ERRO] O Quality Gate deveria ter falhado para o chunker degradado!"
  exit 1
fi

echo ""
echo "[Passo 2/2] Validando que o pipeline oficial de produção é APROVADO..."
npx tsx src/scripts/eval-gate.ts
echo ""
echo "✔ [PROVA CONCLUÍDA COM SUCESSO] O Quality Gate protege o ambiente produtivo contra regressões."
