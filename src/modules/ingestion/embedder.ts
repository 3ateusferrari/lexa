import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMBEDDING_DIM } from '../db/schema.js';

export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimension: number;
  embedBatch(texts: string[]): Promise<number[][]>;
}

const PT_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'ate',
  'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois',
  'do', 'dos', 'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era', 'essa',
  'essas', 'esse', 'esses', 'esta', 'estas', 'este', 'estes', 'eu', 'foi', 'for',
  'foram', 'ha', 'isso', 'isto', 'ja', 'la', 'lhe', 'lhes', 'lo', 'mas', 'me',
  'mesmo', 'meu', 'meus', 'minha', 'minhas', 'muito', 'na', 'nas', 'nem', 'no',
  'nos', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa', 'o', 'os', 'ou',
  'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quais', 'quando',
  'que', 'quem', 'sao', 'se', 'seja', 'sejam', 'sem', 'sera', 'serao', 'seu',
  'seus', 'so', 'sua', 'suas', 'tambem', 'te', 'tem', 'tendo', 'tenha', 'ter',
  'teu', 'teus', 'ti', 'tinha', 'tua', 'tuas', 'um', 'uma', 'umas', 'uns', 'voce',
]);

// Legal domain synonym / concept clusters to bridge lexical gaps in semantic search
const LEGAL_CONCEPT_CLUSTERS: Array<{ id: string; terms: string[] }> = [
  {
    id: 'concept_dispensa_valor',
    terms: [
      'dispensa', 'dispensavel', 'valor', 'inferior', 'inferiores', '100000', '50000',
      'cem', 'mil', 'cinquenta', 'pequeno', 'vulto', 'direta', 'art75', '75',
    ],
  },
  {
    id: 'concept_inexigibilidade',
    terms: [
      'inexigivel', 'inexigibilidade', 'inviavel', 'competicao', 'exclusivo',
      'exclusivos', 'artistico', 'artista', 'consagrado', 'notoria', 'especializacao',
      'credenciamento', 'art74', '74',
    ],
  },
  {
    id: 'concept_modalidades',
    terms: [
      'modalidade', 'modalidades', 'pregao', 'concorrencia', 'concurso', 'leilao',
      'dialogo', 'competitivo', 'art28', '28',
    ],
  },
  {
    id: 'concept_criterios_julgamento',
    terms: [
      'criterio', 'criterios', 'julgamento', 'menor', 'preco', 'maior', 'desconto',
      'melhor', 'tecnica', 'artistico', 'lance', 'retorno', 'economico', 'art33', '33',
    ],
  },
  {
    id: 'concept_fases_licitacao',
    terms: [
      'fase', 'fases', 'sequencia', 'rito', 'preparatoria', 'divulgacao', 'edital',
      'propostas', 'lances', 'habilitacao', 'recursal', 'homologacao', 'inversao', 'art17', '17',
    ],
  },
  {
    id: 'concept_sancoes_licitacao',
    terms: [
      'sancao', 'sancoes', 'penalidade', 'penalidades', 'multa', 'advertencia',
      'impedimento', 'inidoneidade', 'inidoneo', 'punicao', 'infracao', 'infracoes', 'art155', 'art156', '156',
    ],
  },
  {
    id: 'concept_alteracao_aditivo',
    terms: [
      'alteracao', 'alterados', 'aditivo', 'acrescimo', 'acrescimos', 'supressao',
      'supressoes', 'unilateral', '25', '50', 'reforma', 'art124', 'art125', '125',
    ],
  },
  {
    id: 'concept_garantia_contratual',
    terms: [
      'garantia', 'caucao', 'seguro', 'fianca', 'bancaria', 'capitalizacao',
      'percentual', 'cinco', 'dez', 'art96', 'art98', '96', '98',
    ],
  },
  {
    id: 'concept_duracao_prorrogacao',
    terms: [
      'duracao', 'vigencia', 'prazo', 'prorrogacao', 'prorrogados', 'continuos',
      'decenal', '10', 'anos', 'plurianual', 'art106', 'art107', '106', '107',
    ],
  },
  {
    id: 'concept_ata_srp',
    terms: [
      'ata', 'registro', 'precos', 'srp', 'validade', 'vigencia', 'prorrogado',
      'auxiliares', 'art78', 'art84', '84',
    ],
  },
  {
    id: 'concept_impugnacao_recurso',
    terms: [
      'impugnar', 'impugnacao', 'esclarecimento', 'recurso', 'reconsideracao',
      'tres', 'dias', 'uteis', 'abertura', 'certame', 'art164', 'art165', '164', '165',
    ],
  },
  {
    id: 'concept_pncp_publicidade',
    terms: [
      'pncp', 'portal', 'nacional', 'contratacoes', 'publicas', 'sitio', 'eletronico',
      'divulgacao', 'diario', 'oficial', 'jornal', 'circulacao', 'art54', 'art174', '54', '174',
    ],
  },
  {
    id: 'concept_inexequivel_engenharia',
    terms: [
      'inexequivel', 'inexequiveis', 'desclassificadas', 'desclassificacao', '75%',
      'setenta', 'cinco', 'orcado', 'engenharia', 'art59', '59',
    ],
  },
  {
    id: 'concept_lgpd_bases_legais',
    terms: [
      'hipoteses', 'base', 'bases', 'legal', 'legais', 'consentimento', 'obrigacao',
      'legitimo', 'interesse', 'tutela', 'saude', 'protecao', 'credito', 'art7',
    ],
  },
  {
    id: 'concept_lgpd_sensiveis',
    terms: [
      'sensivel', 'sensiveis', 'racial', 'etnica', 'religiosa', 'politica', 'sindicato',
      'genetico', 'biometrico', 'sexual', 'art11', 'art5',
    ],
  },
  {
    id: 'concept_lgpd_criancas',
    terms: [
      'crianca', 'criancas', 'adolescente', 'adolescentes', 'pais', 'responsavel',
      'melhor', 'interesse', 'menor', 'art14', '14',
    ],
  },
  {
    id: 'concept_lgpd_direitos_titular',
    terms: [
      'direito', 'direitos', 'titular', 'confirmacao', 'acesso', 'correcao',
      'anonimizacao', 'portabilidade', 'eliminacao', 'revogacao', 'revisao', 'automatizado', '15', 'quinze', 'art18', 'art19', 'art20',
    ],
  },
  {
    id: 'concept_lgpd_encarregado_dpo',
    terms: [
      'encarregado', 'dpo', 'canal', 'comunicacao', 'orientar', 'reclamacoes',
      'identidade', 'contato', 'art41', '41',
    ],
  },
  {
    id: 'concept_lgpd_incidente_vazamento',
    terms: [
      'incidente', 'seguranca', 'vazamento', 'comunicar', 'anpd', 'risco', 'dano',
      'relevante', 'prazo', 'razoavel', 'art48', '48',
    ],
  },
  {
    id: 'concept_lgpd_sancoes_multa',
    terms: [
      'sancoes', 'multa', 'faturamento', '2%', 'dois', 'cinquenta', 'milhoes',
      '50000000', 'bloqueio', 'suspensao', 'proibicao', 'art52', '52',
    ],
  },
  {
    id: 'concept_penal_ilicitude_culpabilidade',
    terms: [
      'legitima', 'defesa', 'estado', 'necessidade', 'estrito', 'cumprimento', 'dever',
      'legal', 'excludente', 'ilicitude', 'culpabilidade', 'imputabilidade', 'dolo',
      'culpa', 'tentativa', 'consumacao', 'art23', 'art24', 'art25', '23', '24', '25',
    ],
  },
  {
    id: 'concept_penal_crimes_principais',
    terms: [
      'homicidio', 'furto', 'roubo', 'estelionato', 'lesao', 'corporal', 'peculato',
      'concussao', 'corrupcao', 'passiva', 'ativa', 'prevaricacao', 'art121', 'art155',
      'art157', 'art171', 'art312', 'art317', 'art333',
    ],
  },
  {
    id: 'concept_civil_personalidade_negocio',
    terms: [
      'personalidade', 'capacidade', 'incapaz', 'emancipacao', 'negocio', 'juridico',
      'defeito', 'validade', 'nulidade', 'anulabilidade', 'coacao', 'simulacao',
      'fraude', 'credores', 'art1', 'art3', 'art4', 'art104', 'art166', 'art171',
    ],
  },
  {
    id: 'concept_civil_obrigacoes_contratos',
    terms: [
      'obrigacao', 'obrigacoes', 'inadimplemento', 'mora', 'perdas', 'danos', 'clausula',
      'penal', 'contrato', 'contratos', 'boa-fe', 'objetiva', 'responsabilidade',
      'civil', 'art186', 'art389', 'art395', 'art421', 'art422', 'art927',
    ],
  },
  {
    id: 'concept_civil_reais_familia_sucessoes',
    terms: [
      'posse', 'propriedade', 'usucapiao', 'hipoteca', 'penhor', 'casamento', 'uniao',
      'estavel', 'divorcio', 'alimentos', 'heranca', 'sucessao', 'testamento',
      'art1196', 'art1228', 'art1238', 'art1566', 'art1694', 'art1784',
    ],
  },
  {
    id: 'concept_cpc_processo_civil',
    terms: [
      'competencia', 'peticao', 'inicial', 'citacao', 'contestacao', 'revelia',
      'tutela', 'urgencia', 'evidencia', 'sentenca', 'coisa', 'julgada', 'agravo',
      'instrumento', 'apelacao', 'embargos', 'declaracao', 'art300', 'art319',
      'art335', 'art485', 'art487', 'art994', 'art1015', 'art1022',
    ],
  },
  {
    id: 'concept_clt_direito_trabalho',
    terms: [
      'empregado', 'empregador', 'vinculo', 'empregaticio', 'subordinacao', 'salario',
      'remuneracao', 'jornada', 'trabalho', 'horas', 'extras', 'intervalo', 'intrajornada',
      'fgts', 'aviso', 'previo', 'rescisao', 'justa', 'causa', 'ferias', 'decimo',
      'terceiro', 'insalubridade', 'periculosidade', 'art2', 'art3', 'art58', 'art59',
      'art71', 'art477', 'art482', 'art483',
    ],
  },
  {
    id: 'concept_consumidor_cdc',
    terms: [
      'consumidor', 'fornecedor', 'produto', 'servico', 'vicio', 'aparente', 'oculto',
      'defeito', 'fato', 'decadencia', 'prescricao', 'trinta', 'noventa', 'dias',
      'inversao', 'onus', 'prova', 'propaganda', 'enganosa', 'clausulas', 'abusivas',
      'art2', 'art3', 'art6', 'art12', 'art14', 'art18', 'art20', 'art26', 'art27',
      'art39', 'art51',
    ],
  },
  {
    id: 'concept_tributario_ctn',
    terms: [
      'tributo', 'imposto', 'taxa', 'contribuicao', 'melhoria', 'fato', 'gerador',
      'sujeito', 'ativo', 'passivo', 'credito', 'tributario', 'lancamento', 'suspensao',
      'extincao', 'exclusao', 'decadencia', 'prescricao', 'imunidade', 'isencao',
      'art3', 'art97', 'art113', 'art114', 'art142', 'art151', 'art156', 'art173', 'art174',
    ],
  },
  {
    id: 'concept_constitucional_cf88',
    terms: [
      'direitos', 'garantias', 'fundamentais', 'clausula', 'petrea', 'habeas',
      'corpus', 'mandado', 'seguranca', 'acao', 'popular', 'direta', 'inconstitucionalidade',
      'adi', 'adc', 'adpf', 'separacao', 'poderes', 'executivo', 'legislativo',
      'judiciario', 'emenda', 'constitucional', 'art1', 'art2', 'art5', 'art37',
      'art60', 'art102', 'art105',
    ],
  },
  {
    id: 'concept_servidor_8112_improbidade_8429',
    terms: [
      'servidor', 'publico', 'estatutario', 'estagio', 'probatorio', 'estabilidade',
      'posse', 'exercicio', 'demissao', 'exoneracao', 'pad', 'processo', 'administrativo',
      'improbidade', 'enriquecimento', 'ilicito', 'prejuizo', 'erario', 'dolo',
      'especifico', 'perda', 'funcao', 'art20', 'art132', 'art9', 'art10', 'art11',
    ],
  },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r\n/g, ' ');
}

function stemPortuguese(token: string): string {
  if (token.length <= 4) return token;
  return token
    .replace(/(acoes|icoes|mente|amento|imento|adoras|adores|icacao|acoes)$/u, '')
    .replace(/(acao|icao|avel|ivel|ando|endo|indo|adas|ados|idas|idos|ores|oras)$/u, '')
    .replace(/(oes|ais|eis|ois|uis|ava|iam|ara|era|ira|ada|ado|ida|ido|osa|oso)$/u, '')
    .replace(/(ar|er|ir|am|em|es|os|as|is|s)$/u, '');
}

function fnv1aHash(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const v of vec) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) {
    const fallback = new Array<number>(vec.length).fill(0);
    fallback[0] = 1;
    return fallback;
  }
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function addSignedFeature(vec: number[], feature: string, weight: number): void {
  const h1 = fnv1aHash(feature, 2166136261);
  const h2 = fnv1aHash(feature, 374761393);
  const idx1 = h1 % vec.length;
  const sign1 = (h1 & 1) === 0 ? 1 : -1;
  vec[idx1] = (vec[idx1] ?? 0) + sign1 * weight;

  const idx2 = h2 % vec.length;
  const sign2 = (h2 & 1) === 0 ? 1 : -1;
  vec[idx2] = (vec[idx2] ?? 0) + sign2 * (weight * 0.5);
}

class LocalLegalSemanticEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = EMBEDDING_DIM;

  constructor(readonly modelName: string = 'local-legal-pt-v1') {}

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedSingle(text));
  }

  private embedSingle(rawText: string): number[] {
    const vec = new Array<number>(this.dimension).fill(0);
    const norm = normalizeText(rawText);

    // Extract alphanumeric tokens (keeping numbers like 75, 100000, 14133)
    const cleanNumeric = norm.replace(/(\d+)\.(\d+)/g, '$1$2');
    const tokens = cleanNumeric
      .split(/[^a-z0-9%]+/)
      .filter((t) => t.length >= 2 && !PT_STOPWORDS.has(t));

    const stems = tokens.map(stemPortuguese);
    const tokenSet = new Set([...tokens, ...stems]);

    // 1. Unigram token + stem features
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      const stem = stems[i]!;
      addSignedFeature(vec, `tok:${tok}`, 1.2);
      if (stem.length >= 3) {
        addSignedFeature(vec, `stem:${stem}`, 1.5);
      }
      // Boost explicit article references (e.g., "art 75")
      if (tok === 'art' && tokens[i + 1]) {
        addSignedFeature(vec, `art_ref:${tokens[i + 1]}`, 3.0);
      }
    }

    // 2. Stem bigrams for phrase order sensitivity
    for (let i = 0; i < stems.length - 1; i++) {
      addSignedFeature(vec, `bi:${stems[i]}_${stems[i + 1]}`, 0.9);
    }

    // 3. Legal domain concept cluster projection
    for (const cluster of LEGAL_CONCEPT_CLUSTERS) {
      let hits = 0;
      for (const term of cluster.terms) {
        if (tokenSet.has(term) || tokenSet.has(stemPortuguese(term))) {
          hits++;
        }
      }
      if (hits > 0) {
        const boost = Math.min(3.5, 1.2 * Math.sqrt(hits));
        addSignedFeature(vec, `cluster:${cluster.id}`, boost);
      }
    }

    return l2Normalize(vec);
  }
}

class LocalCharNgramEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = EMBEDDING_DIM;

  constructor(readonly modelName: string = 'local-char-ngram-v1') {}

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array<number>(this.dimension).fill(0);
      const norm = normalizeText(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
      for (let i = 0; i <= norm.length - 4; i++) {
        const gram = norm.slice(i, i + 4);
        addSignedFeature(vec, `c4:${gram}`, 1.0);
      }
      return l2Normalize(vec);
    });
  }
}

export function createLocalEmbeddingProvider(
  modelName = process.env.LOCAL_EMBEDDING_MODEL ?? 'local-legal-pt-v1',
): EmbeddingProvider {
  if (modelName === 'local-char-ngram-v1') {
    return new LocalCharNgramEmbeddingProvider(modelName);
  }
  return new LocalLegalSemanticEmbeddingProvider(modelName);
}

export interface CachedEmbedderOptions {
  cacheDir?: string;
  batchSize?: number;
  maxMemoryEntries?: number;
}

export class CachedEmbedder implements EmbeddingProvider {
  readonly modelName: string;
  readonly dimension: number;
  private readonly cacheDir: string;
  private readonly batchSize: number;
  private readonly maxMemoryEntries: number;
  private readonly memoryCache = new Map<string, number[]>();

  constructor(
    private readonly delegate: EmbeddingProvider,
    options: CachedEmbedderOptions = {},
  ) {
    this.modelName = delegate.modelName;
    this.dimension = delegate.dimension;
    const safeModelDir = this.modelName.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.cacheDir = join(options.cacheDir ?? '.cache/embeddings', safeModelDir);
    this.batchSize = options.batchSize ?? 32;
    this.maxMemoryEntries = options.maxMemoryEntries ?? 2000;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  private hashText(text: string): string {
    return createHash('sha256')
      .update(`${this.modelName}:${text}`, 'utf8')
      .digest('hex');
  }

  private getCacheFilePath(hash: string): string {
    const prefix = hash.slice(0, 2);
    const shardedDir = join(this.cacheDir, prefix);
    mkdirSync(shardedDir, { recursive: true });
    return join(shardedDir, `${hash}.json`);
  }

  private setMemoryCache(hash: string, vec: number[]): void {
    if (this.memoryCache.has(hash)) {
      this.memoryCache.delete(hash);
    } else if (this.memoryCache.size >= this.maxMemoryEntries) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest) {
        this.memoryCache.delete(oldest);
      }
    }
    this.memoryCache.set(hash, vec);
  }

  private getMemoryCache(hash: string): number[] | undefined {
    const val = this.memoryCache.get(hash);
    if (val) {
      this.memoryCache.delete(hash);
      this.memoryCache.set(hash, val);
    }
    return val;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: Array<number[] | undefined> = new Array(texts.length);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];
    const missingHashes: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]!;
      const hash = this.hashText(text);

      const memHit = this.getMemoryCache(hash);
      if (memHit) {
        results[i] = memHit;
        continue;
      }

      const filePath = this.getCacheFilePath(hash);
      const legacyPath = join(this.cacheDir, `${hash}.json`);
      const targetPath = existsSync(filePath) ? filePath : existsSync(legacyPath) ? legacyPath : null;

      if (targetPath) {
        try {
          const parsed = JSON.parse(readFileSync(targetPath, 'utf8')) as number[];
          this.setMemoryCache(hash, parsed);
          results[i] = parsed;
          continue;
        } catch {
          // Corrupted cache entry; recompute
        }
      }

      missingIndices.push(i);
      missingTexts.push(text);
      missingHashes.push(hash);
    }

    for (let start = 0; start < missingTexts.length; start += this.batchSize) {
      const batchSlice = missingTexts.slice(start, start + this.batchSize);
      const batchVectors = await this.delegate.embedBatch(batchSlice);

      for (let j = 0; j < batchVectors.length; j++) {
        const globalIdx = missingIndices[start + j]!;
        const hash = missingHashes[start + j]!;
        const vec = batchVectors[j]!;

        results[globalIdx] = vec;
        this.setMemoryCache(hash, vec);
        writeFileSync(this.getCacheFilePath(hash), JSON.stringify(vec), 'utf8');
      }
    }

    return results as number[][];
  }
}
