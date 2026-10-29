# Guia Completo de Respostas Técnicas para Entrevistas — Lexa RAG

Este documento contém as respostas aprofundadas para as **7 perguntas essenciais de arquitetura e engenharia** frequentemente feitas por Tech Leads e Engenheiros Staff em entrevistas.

---

### Pergunta 1: Por que você escolheu chunking por artigo em vez de janela de caracteres com overlap?
> **Resposta:**  
> "A legislação brasileira possui uma gramática hierárquica bem definida: Artigos contêm o *caput* (regra geral), Parágrafos estabelecem exceções ou condições, e Incisos enumeram hipóteses taxativas ou exemplificativas.  
> Quando aplicamos um chunker ingênuo de janela fixa de 240 caracteres com overlap (nosso Experimento 1A), o Hit Rate@5 medido caiu para **64.4%** e o MRR para **0.4244**. Isso aconteceu porque frases eram cortadas no meio, e uma sanção administrativa (ex.: proibição de licitar) ficava separada do prazo legal no chunk seguinte.  
> Ao construir um parser específico (`legal-chunker.ts`) que segmenta respeitando as fronteiras normativas de cada Artigo e preserva o `sectionPath`, nosso Hit Rate@5 subiu imediatamente para **97.8%** e o MRR para **0.9778**, um ganho direto de **+33.4 pontos percentuais** comprovado no dataset de avaliação."

---

### Pergunta 2: Como você garantiu que o modelo não alucinasse artigos que não existem?
> **Resposta:**  
> "Adotamos uma abordagem de **defesa em profundidade com três camadas**:
> 1. **Pré-geração (Refusal Guard):** Antes de gastar tokens na API do Claude, avaliamos o score de relevância do reranker. Se o melhor candidato estiver abaixo do limiar calibrado de **0.25** (ou se a pergunta for expressamente fora do escopo), o sistema recusa a resposta imediatamente com mensagem padronizada, alcançando **100% de acurácia de recusa**.
> 2. **System Prompt com Grounding Estrito:** Instruímos o modelo a responder exclusivamente a partir dos blocos delimitados por tags XML `<context>` e exigimos que toda afirmativa factual cite explicitamente o identificador da fonte (`[chunkId]`). Se a resposta não estiver nos documentos, o modelo é instruído a declarar que a informação não consta na legislação fornecida.
> 3. **Pós-geração (Citation Validator Determinístico):** Implementamos um validador pós-geração (`citation-validator.ts`) que faz o parse da resposta via regex, extrai todos os IDs citados e valida se eles pertencem ao conjunto real de chunks recuperados pelo banco de dados. Qualquer citação de chunk inexistente é detectada e sinalizada como inválida."

---

### Pergunta 3: Por que usar busca híbrida (vetorial + lexical) em vez de apenas vetorial?
> **Resposta:**  
> "A busca puramente vetorial é excelente para similaridade semântica e paráfrases conceituais, mas sofre em consultas jurídicas que contêm termos técnicos exatos, jargões normativos ou números de dispositivos legais — como `'diálogo competitivo'`, `'segregação de funções'` ou `'Art. 75, inciso II'`.  
> Por outro lado, a busca lexical pura (BM25 / `tsvector` do PostgreSQL) falha quando o usuário faz uma pergunta usando sinônimos coloquiais ou formulação indireta (atingiu apenas 86.7% de Hit Rate no Exp 2B).  
> A solução foi combinar o melhor dos dois mundos através de **Reciprocal Rank Fusion (RRF)** com $k=60$: executamos as duas consultas em paralelo e somamos os pesos normalizados pelas posições no ranking. O resultado híbrido alimenta um cross-reranker leve que reordena o top 20 para entregar os 5 chunks finais, atingindo **100% de Hit Rate@5**."

---

### Pergunta 4: Como funciona o pipeline de CI/CD e como o Quality Gate impede que código ruim vá para produção?
> **Resposta:**  
> "Implementamos dois workflows no GitHub Actions:
> 1. **CI de Pull Request (`ci.yml`):** Executa linting, typechecking rigoroso com TypeScript em modo estrito, suíte de testes unitários, testes de integração no PostgreSQL via Testcontainers/PGlite e o **Quality Gate do RAG (`eval:ci`)**. O script `eval-gate.ts` roda o dataset de avaliação e exige `Hit Rate@5 >= 75%` e `MRR >= 0.60`. Se alguém alterar o chunker ou mexer no algoritmo de ranking e a métrica degradar (como demonstrado pelo nosso script de prova `prove-quality-gate.sh`), o CI falha com exit code 1 e o botão de merge é bloqueado. O workflow também executa `terraform fmt -check` e `terraform validate`.
> 2. **CD de Produção (`deploy.yml`):** Acionado no merge para a branch `main`. Autentica na AWS usando **GitHub Actions OIDC** (sem secrets estáticos de longa duração), constrói a imagem Docker multi-stage, tagueia com o git commit SHA imutável, publica no ECR, roda as migrations do Drizzle ORM, atualiza os serviços ECS Fargate e sincroniza o build do React no S3 invalidando a CDN CloudFront."

---

### Pergunta 5: Como você desenhou a arquitetura para ser segura na AWS?
> **Resposta:**  
> "A segurança foi modelada pelo princípio de **privilégio mínimo e separação de planos**:
> - **Zero Segredos Estáticos em Repositório ou CI:** O GitHub Actions utiliza OIDC federado via `token.actions.githubusercontent.com:sub` restrito estritamente a `repo:3ateusferrari/lexa:ref:refs/heads/main`.
> - **Rede e Banco de Dados Isolados:** O Amazon RDS PostgreSQL 16 não possui IP público e reside em subnets privadas da VPC. O Security Group do banco aceita conexões na porta 5432 unicamente originadas do Security Group das tasks ECS de compute.
> - **Roles IAM Segregadas:** A API Express tem permissão apenas de `s3:PutObject` (via presigned URLs) e `sqs:SendMessage`. O Worker assíncrono possui apenas `s3:GetObject` e `sqs:ReceiveMessage`. Nenhuma role possui `Resource: '*'`.
> - **Proteção da Aplicação:** Headers HTTP via Helmet, CORS restrito à origem da CDN, rate limiting por IP na API, limite de gasto diário com LLM, e parâmetros sensíveis armazenados em AWS Systems Manager (SSM) com criptografia `SecureString`."

---

### Pergunta 6: Qual foi a maior surpresa nos resultados dos experimentos de avaliação?
> **Resposta:**  
> "A maior surpresa foi a magnitude da diferença gerada pelo **chunking estrutural** em comparação com a busca vetorial simples. Inicialmente, poderíamos supor que usar embeddings mais avançados compensaria um fatiamento de texto qualquer. No entanto, os dados provaram que uma estratégia de chunking inadequada impõe um teto severo à qualidade: o modelo errava consultas simples de licitação porque o artigo perdia seu contexto hierárquico.  
> Além disso, descobrimos que modelos locais leves e rápidos (como n-grams com TF-IDF ponderado) combinados com busca lexical e reranker conseguem bater 100% de Hit Rate para o corpus normativo com **latência inferior a 15ms por busca**, provando que uma boa arquitetura de dados e ranking supera o uso cego de modelos pesados de embeddings para busca de primeiro estágio."

---

### Pergunta 7: Se o volume de documentos aumentasse 100x amanhã, o que quebraria primeiro e como você escalaria?
> **Resposta:**  
> "Com 100x mais documentos (de 2 leis para milhares de editais e acórdãos do TCU):
> 1. **O que quebraria primeiro no banco de dados:** A busca sequencial exata por similaridade de cosseno com `<=>` no `pgvector`. Sem índices vetoriais aproximados, o tempo de busca cresce linearmente com $O(N)$.
>    - **Como resolver:** Criar índice **HNSW (`vector_cosine_ops`)** ou **IVFFlat** com listas particionadas, particionamento declarativo do PostgreSQL por `doc_type` e ano (`partition by range`), e réplica de leitura do RDS (Read Replica) para descarregar o tráfego de busca.
> 2. **O que quebraria na camada de ingestão:** O processamento síncrono.
>    - **Como resolvemos na arquitetura:** Já desenhamos o sistema de forma assíncrona! O upload gera uma URL pré-assinada para o S3 e publica uma mensagem no Amazon SQS. O Worker em ECS Fargate pode ser escalado horizontalmente via **ECS Target Tracking Scaling Policy** baseado na métrica `ApproximateNumberOfMessagesVisible` da fila SQS, permitindo subir dezenas de tarefas em paralelo sem sobrecarregar a API principal.
> 3. **Custos de LLM:** O envio indiscriminado de contexto para a Anthropic explodiria os custos.
>    - **Como resolver:** Manter o Refusal Guard estrito, usar cache semântico de respostas frequentes em memória/Redis (já preparado no módulo `example-cache.ts`) e roteamento inteligente para modelos menores como Haiku para perguntas simples e Sonnet apenas para sínteses complexas."
