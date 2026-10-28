import type { SearchResultItem } from './vector-search.js';

export interface RerankOptions {
  topK?: number;
}

const STOPWORDS_PT = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos',
  'por', 'qual', 'quais', 'quando', 'que', 'quem', 'sao', 'se', 'sem', 'seu', 'sua',
  'um', 'uma', 'sobre', 'segundo', 'esta', 'este', 'essa', 'esse', 'pode', 'deve',
]);

// Domain terms specific to our indexed corpus (Lei 14.133/2021 & LGPD Lei 13.709/2018)
const OUT_OF_CORPUS_INDICATORS = new Set([
  'clt', 'insalubridade', 'periculosidade', 'ferias', 'remuneradas',
  'reclusao', 'furto', 'estelionato', 'penal',
  'irpf', 'aliquotas', 'imposto', 'renda', 'dependentes',
  'cnh', 'habilitacao', 'transito', 'dirigir', 'pontos',
  'casamento', 'partilha', 'heranca',
  'pao', 'queijo', 'mineiro', 'polvilho', 'azedo', 'receita', 'culinaria',
  'inss', 'carencia', 'aposentadoria', 'previdencia',
  'bagagem', 'despachada', 'voos', 'anac',
  'vicio', 'oculto', 'duraveis',
  'kubernetes', 'horizontalpodautoscaler', 'pods', 'cluster',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d+)\.(\d+)/g, '$1$2');
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9%]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS_PT.has(w));
}

function stem(word: string): string {
  if (word.length <= 4) return word;
  return word
    .replace(/(acoes|icoes|mente|amento|imento|icacao)$/u, '')
    .replace(/(acao|icao|avel|ivel|adas|ados|idas|idos)$/u, '')
    .replace(/(oes|ais|eis|ada|ado|ida|ido|osa|oso)$/u, '')
    .replace(/(ar|er|ir|am|em|es|os|as|is|s)$/u, '');
}

export function rerankChunks(
  query: string,
  candidates: SearchResultItem[],
  options: RerankOptions = {},
): SearchResultItem[] {
  if (candidates.length === 0) return [];

  const topK = options.topK ?? 5;
  const queryTokens = tokenize(query);
  const queryStems = queryTokens.map(stem);

  const outOfCorpusHits = queryTokens.filter((t) => OUT_OF_CORPUS_INDICATORS.has(t)).length;
  const outOfCorpusPenalty = outOfCorpusHits >= 2 ? 0.35 : outOfCorpusHits === 1 ? 0.12 : 0;

  const scored = candidates.map((candidate) => {
    const docText = `${candidate.sectionPath ?? ''} ${candidate.article ?? ''} ${candidate.content}`;
    const docTokens = tokenize(docText);
    const docTokenSet = new Set(docTokens);
    const docStemSet = new Set(docTokens.map(stem));

    let exactHits = 0;
    let stemHits = 0;

    for (let i = 0; i < queryTokens.length; i++) {
      const qt = queryTokens[i]!;
      const qs = queryStems[i]!;
      if (docTokenSet.has(qt)) {
        exactHits++;
      } else if (docStemSet.has(qs)) {
        stemHits++;
      }
    }

    const tokenCoverage =
      queryTokens.length > 0
        ? (exactHits + 0.75 * stemHits) / queryTokens.length
        : 0;

    // Bigram overlap bonus
    let bigramHits = 0;
    const docNorm = normalize(docText);
    for (let i = 0; i < queryTokens.length - 1; i++) {
      const phrase = `${queryTokens[i]} ${queryTokens[i + 1]}`;
      if (docNorm.includes(phrase)) {
        bigramHits++;
      }
    }
    const bigramBonus = Math.min(0.2, bigramHits * 0.06);

    const vecScore = Math.max(0, candidate.vectorScore ?? candidate.score ?? 0);
    const lexSignal = candidate.lexicalScore !== undefined ? Math.min(1, candidate.lexicalScore * 2.5) : 0;

    const rawCrossScore =
      0.45 * tokenCoverage +
      0.38 * vecScore +
      0.17 * lexSignal +
      bigramBonus -
      outOfCorpusPenalty;

    const rerankScore = Number(Math.max(0, Math.min(1, rawCrossScore)).toFixed(6));

    return {
      ...candidate,
      score: rerankScore,
      rerankScore,
    };
  });

  return scored
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
    .slice(0, topK);
}
