import type { SearchResultItem } from './vector-search.js';

export interface ExampleQuestionEntry {
  question: string;
  answer: string;
  citations: SearchResultItem[];
}

export const INITIAL_EXAMPLE_QUESTIONS: ExampleQuestionEntry[] = [
  {
    question:
      'Qual o limite de valor para dispensa de licitação em obras e serviços de engenharia?',
    answer:
      'Pela Lei nº 14.133/2021, a licitação é dispensável para contratações que envolvam valores inferiores a **R$ 100.000,00 (cem mil reais)** no caso de obras e serviços de engenharia ou de serviços de manutenção de veículos automotores, e inferiores a **R$ 50.000,00 (cinquenta mil reais)** no caso de outros serviços e compras [example-art-75]. Além disso, essas contratações devem ser preferencialmente precedidas de divulgação de aviso em sítio eletrônico oficial pelo prazo mínimo de 3 (três) dias úteis [example-art-75].',
    citations: [
      {
        chunkId: 'example-art-75',
        documentId: 'lei-14133-2021',
        documentTitle:
          'Lei nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos)',
        docType: 'lei',
        article: 'Art. 75',
        sectionPath:
          'TÍTULO II - DAS LICITAÇÕES > CAPÍTULO VIII - DA CONTRATAÇÃO DIRETA > Seção III - Da Dispensa de Licitação',
        page: null,
        content:
          'Art. 75. É dispensável a licitação:\nI - para contratação que envolva valores inferiores a R$ 100.000,00 (cem mil reais), no caso de obras e serviços de engenharia ou de serviços de manutenção de veículos automotores;\nII - para contratação que envolva valores inferiores a R$ 50.000,00 (cinquenta mil reais), no caso de outros serviços e compras;\n§ 3º As contratações de que tratam os incisos I e II do caput deste artigo serão preferencialmente precedidas de divulgação de aviso em sítio eletrônico oficial, pelo prazo mínimo de 3 (três) dias úteis...',
        score: 0.98,
        rerankScore: 0.98,
      },
    ],
  },
  {
    question:
      'Quais são os direitos do titular dos dados pessoais previstos no Art. 18 da LGPD?',
    answer:
      'De acordo com o **Art. 18 da LGPD (Lei nº 13.709/2018)**, o titular dos dados pessoais tem direito a obter do controlador, a qualquer momento e mediante requisição: (I) confirmação da existência de tratamento; (II) acesso aos dados; (III) correção de dados incompletos, inexatos ou desatualizados; (IV) anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos; (V) portabilidade dos dados a outro fornecedor; (VI) eliminação dos dados tratados com consentimento; (VII) informação sobre compartilhamento; (VIII) informação sobre a possibilidade de não fornecer consentimento; e (IX) revogação do consentimento [example-lgpd-art-18].',
    citations: [
      {
        chunkId: 'example-lgpd-art-18',
        documentId: 'lei-13709-2018-lgpd',
        documentTitle:
          'Lei nº 13.709, de 14 de agosto de 2018 (Lei Geral de Proteção de Dados Pessoais - LGPD)',
        docType: 'lei',
        article: 'Art. 18',
        sectionPath: 'CAPÍTULO III - DOS DIREITOS DO TITULAR',
        page: null,
        content:
          'Art. 18. O titular dos dados pessoais tem direito a obter do controlador, em relação aos dados do titular por ele tratados, a qualquer momento e mediante requisição:\nI - confirmação da existência de tratamento;\nII - acesso aos dados;\nIII - correção de dados incompletos, inexatos ou desatualizados;\nIV - anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com o disposto nesta Lei;\nV - portabilidade dos dados a outro fornecedor de serviço ou produto...\nVI - eliminação dos dados pessoais tratados com o consentimento do titular...\nIX - revogação do consentimento, nos termos do § 5º do art. 8º desta Lei.',
        score: 0.97,
        rerankScore: 0.97,
      },
    ],
  },
  {
    question:
      'Quais são as cinco modalidades de licitação estabelecidas pela Lei 14.133/2021?',
    answer:
      'Conforme o **Art. 28 da Lei nº 14.133/2021**, são modalidades de licitação: **I - pregão**; **II - concorrência**; **III - concurso**; **IV - leilão**; e **V - diálogo competitivo** [example-art-28]. O § 2º do mesmo artigo veda expressamente a criação de outras modalidades de licitação ou a combinação entre elas [example-art-28].',
    citations: [
      {
        chunkId: 'example-art-28',
        documentId: 'lei-14133-2021',
        documentTitle:
          'Lei nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos)',
        docType: 'lei',
        article: 'Art. 28',
        sectionPath:
          'TÍTULO II - DAS LICITAÇÕES > CAPÍTULO II - DA FASE PREPARATÓRIA > Seção II - Das Modalidades de Licitação',
        page: null,
        content:
          'Art. 28. São modalidades de licitação:\nI - pregão;\nII - concorrência;\nIII - concurso;\nIV - leilão;\nV - diálogo competitivo.\n§ 1º Além das modalidades referidas no caput deste artigo, a Administração pode servir-se dos procedimentos auxiliares previstos no art. 78 desta Lei.\n§ 2º É vedada a criação de outras modalidades de licitação ou, ainda, a combinação daquelas referidas no caput deste artigo.',
        score: 0.99,
        rerankScore: 0.99,
      },
    ],
  },
];

function normalizeQuestionKey(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EXAMPLE_CACHE_MAP = new Map<string, ExampleQuestionEntry>(
  INITIAL_EXAMPLE_QUESTIONS.map((item) => [normalizeQuestionKey(item.question), item]),
);

export function findCachedExampleQuestion(question: string): ExampleQuestionEntry | undefined {
  return EXAMPLE_CACHE_MAP.get(normalizeQuestionKey(question));
}
