# Roteiro de Vídeo Demo (1 a 2 minutos) — Lexa RAG

**Duração Alvo:** 1m30s a 1m50s  
**Público-Alvo:** Recrutadores técnicos, Tech Leads e Engenheiros Sênior / Staff.

---

## Ato 1: O Problema Real (0:00 - 0:25)
- **Cena:** Tela inicial limpa do Lexa com o subtítulo em destaque.
- **Áudio / Locução:**  
  *"Alucinações de LLM em domínios críticos como o jurídico e compras públicas geram nulidade de editais e sanções regulatórias. Se um assistente de IA inventar um artigo de lei ou errar um prazo processual, a consequência é real. Por isso construí o **Lexa**, um assistente RAG especializado na Nova Lei de Licitações (Lei 14.133/2021) e na LGPD, projetado para ter **zero tolerância à alucinação** e fundamentação 100% verificável."*

---

## Ato 2: A Solução em Ação & Citações Auditáveis (0:25 - 0:55)
- **Cena:** Clicar na pergunta de exemplo: *"Quais são as modalidades de licitação previstas na Lei 14.133/2021 e é permitida a criação de novas modalidades?"*
- **Ação:** O streaming SSE começa instantaneamente token a token. A resposta cita `[Fonte 1]`. O usuário clica no badge `[Fonte 1]` e o drawer lateral destaca o texto original do **Art. 28 e § 2º**.
- **Áudio / Locução:**  
  *"Ao enviar a pergunta, a busca híbrida via RRF combina pgvector com busca lexical em português, e o cross-reranker eleva o chunk mais relevante. O Claude 3.5 gera a resposta via streaming com badges de citação vinculados diretamente ao artigo legal recuperado. O usuário não precisa confiar no modelo: basta clicar no badge para inspecionar o texto legal e o score de similaridade."*

---

## Ato 3: Recusa Segura e Painel de Qualidade (0:55 - 1:20)
- **Cena:** Enviar pergunta fora do escopo normativo: *"Qual a alíquota do Imposto sobre Grandes Fortunas no CTN?"*. O sistema exibe o banner vermelho de **Recusa Segura Calibrada**. Em seguida, clicar na aba **Painel de Qualidade & Experimentos**.
- **Áudio / Locução:**  
  *"Se a pergunta estiver fora do escopo normativo, o Refusal Guard detecta que a evidência está abaixo do limiar calibrado de 0.25 e recusa a resposta imediatamente. No painel de qualidade, temos os resultados reais medidos sobre 55 perguntas: o chunking estrutural com busca híbrida e reranking elevou o Hit Rate@5 de 64.4% para 100%, com MRR de 0.9741."*

---

## Ato 4: Arquitetura de Produção e CI/CD (1:20 - 1:45)
- **Cena:** Mostrar brevemente o diagrama de arquitetura do `README.md` e a execução do workflow de CI com o Quality Gate.
- **Áudio / Locução:**  
  *"Toda a infraestrutura é provisionada como código em Terraform na AWS: ECS Fargate, Amazon RDS PostgreSQL com pgvector isolado na VPC privada, S3 e SQS com Dead-Letter Queue. O pipeline do GitHub Actions utiliza autenticação moderna via OIDC sem chaves estáticas, e o merge só é permitido se o Quality Gate automatizado passar com Hit Rate@5 superior a 75%. O código está aberto e pronto para produção."*
