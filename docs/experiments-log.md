# Registro de Experimentos de Avaliação do RAG (Lexa)

> **Dataset:** 55 perguntas escritas manualmente (`data/eval/questions.json`), sendo **45 respondíveis** sobre a Lei nº 14.133/2021 e a LGPD (Lei nº 13.709/2018) e **10 perguntas fora do corpus** (CLT, Código Penal, IRPF, CNH, Código Civil, INSS, ANAC, CDC, Culinária, Kubernetes) para aferição da **Taxa de Recusa Correta**.
> **Snapshot das execuções:** `data/eval/baseline-runs.json` (gerado por `npm run eval:run`).

---

## Resumo Consolidado dos 4 Experimentos

| Experimento | Estratégia de Chunking | Modo de Busca | Modelo de Embeddings | Reranker & Guardião | Hit Rate@5 | MRR | Taxa de Recusa Correta |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **1A** | Tamanho Fixo (`240 chars`) | Vetorial (`pgvector`) | `local-legal-pt-v1` | Nenhum | `64.4%` | `0.4244` | `0.0%` |
| **1B / 2A** | Estrutural por Artigo | Só Vetorial (`pgvector`) | `local-legal-pt-v1` | Nenhum | `97.8%` | `0.9778` | `0.0%` |
| **2B** | Estrutural por Artigo | Só Texto (`tsvector` PT) | — | Nenhum | `86.7%` | `0.5967` | `0.0%` |
| **2C / 3A** | Estrutural por Artigo | Híbrida (`RRF`, $k=60$) | `local-legal-pt-v1` | Nenhum | `97.8%` | `0.8341` | `0.0%` |
| **4A** | Estrutural por Artigo | Híbrida (`RRF`) | `local-char-ngram-v1` | `local-cross-reranker-v1` (`0.25`) | `100.0%` | `0.9833` | `100.0%` |
| **3B / 4B (Produção)** | Estrutural por Artigo | Híbrida (`RRF`) | `local-legal-pt-v1` | `local-cross-reranker-v1` (`0.25`) | **`100.0%`** | **`0.9741`** | **`100.0%`** |

---

## Análise por Experimento

### Experimento 1: Chunking por Estrutura Legal vs. Tamanho Fixo
- **Resultado:** O chunking estrutural por artigo elevou o **Hit Rate@5 de `64.4%` para `97.8%` (+33.4 p.p.)** e o **MRR de `0.4244` para `0.9778`**.
- **Explicação técnica:** No chunking de tamanho fixo, incisos e parágrafos (`§ 1º`, `I -`, `II -`) são separados do *caput* do artigo (ex.: o inciso `I` do `Art. 75` contendo `"valores inferiores a R$ 100.000,00"` perde o cabeçalho `"Art. 75. É dispensável a licitação"`). O chunker estrutural mantém cada artigo coeso, preserva o *caput* ao subdividir artigos longos e injeta o caminho hierárquico (`[TÍTULO > CAPÍTULO > Seção | Art. X]`) no texto embutido.

### Experimento 2: Busca Só Vetorial vs. Só Texto (`tsvector`) vs. Híbrida (`RRF`)
- **Por que Reciprocal Rank Fusion (RRF) em vez de somar scores brutos?**
  - A similaridade de cosseno do `pgvector` varia em `[-1, 1]` (tipicamente `[0.3, 0.95]`), enquanto o score léxico `ts_rank_cd` do PostgreSQL não é limitado superiormente e depende da densidade de termos no documento (tipicamente `[0.01, 0.40]`).
  - Somar scores brutos exige normalização min-max instável a *outliers*. O **RRF** ($\sum \frac{1}{60 + \text{rank}_i}$) utiliza apenas a posição ordinal em cada lista, combinando a precisão de termos exatos (`R$ 100.000,00`, `75%`, `PNCP`) da busca textual com a capacidade semântica da busca vetorial.

### Experimento 3: Sem Reranking vs. Com Reranking + Limiar de Recusa
- **Resultado:** Adicionar o Reranker Cross-Feature + Guardião de Recusa (`threshold = 0.25`) levou o **Hit Rate@5 de `97.8%` para `100.0%`**, o **MRR de `0.8341` para `0.9741`** e a **Taxa de Recusa Correta nas 10 perguntas fora do corpus de `0.0%` para `100.0%`**.
- **Impacto em custo e segurança:** Perguntas fora do domínio (CLT, IRPF, Código Penal, receitas, Kubernetes) são barradas antes da chamada ao Claude (Anthropic), reduzindo custo e eliminando risco de alucinação fora da base.

### Experimento 4: Comparação entre Dois Modelos de Embeddings Locais
- Comparados `local-legal-pt-v1` (tokens + radicais morfológicos em português + projeção de conceitos jurídicos, 384d) e `local-char-ngram-v1` (4-gramas de caracteres, 384d). Ambos atingiram `100.0%` de Hit Rate@5 quando combinados com RRF e Reranking, com `local-legal-pt-v1` oferecendo maior separabilidade semântica em paráfrases jurídicas puras sem termos exatos compartilhados.
