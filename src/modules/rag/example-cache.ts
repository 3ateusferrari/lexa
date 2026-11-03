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
  {
    question:
      'Quais são as cláusulas pétreas da Constituição Federal de 1988 que não podem ser objeto de emenda tendente a aboli-las?',
    answer:
      'Nos termos do **Art. 60, § 4º, da Constituição Federal de 1988**, não será objeto de deliberação a proposta de emenda tendente a abolir: **I - a forma federativa de Estado**; **II - o voto direto, secreto, universal e periódico**; **III - a separação dos Poderes**; e **IV - os direitos e garantias individuais** [example-cf-art-60].',
    citations: [
      {
        chunkId: 'example-cf-art-60',
        documentId: 'constituicao-1988',
        documentTitle: 'Constituição da República Federativa do Brasil de 1988 (CF/88)',
        docType: 'lei',
        article: 'Art. 60',
        sectionPath: 'TÍTULO IV - DA ORGANIZAÇÃO DOS PODERES > CAPÍTULO I - DO PODER LEGISLATIVO > Seção VIII - Do Processo Legislativo',
        page: null,
        content:
          'Art. 60. A Constituição poderá ser emendada mediante proposta:\n§ 4º Não será objeto de deliberação a proposta de emenda tendente a abolir:\nI - a forma federativa de Estado;\nII - o voto direto, secreto, universal e periódico;\nIII - a separação dos Poderes;\nIV - os direitos e garantias individuais.',
        score: 0.99,
        rerankScore: 0.99,
      },
    ],
  },
  {
    question:
      'Quais são as causas de exclusão de ilicitude no Código Penal e como a lei define legítima defesa?',
    answer:
      'Conforme o **Art. 23 do Código Penal (Decreto-Lei nº 2.848/1940)**, não há crime quando o agente pratica o fato: **I - em estado de necessidade**; **II - em legítima defesa**; ou **III - em estrito cumprimento de dever legal ou no exercício regular de direito** [example-cp-art-23]. Já o **Art. 25** define que se entende em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem [example-cp-art-25].',
    citations: [
      {
        chunkId: 'example-cp-art-23',
        documentId: 'decreto-lei-2848-1940-cp',
        documentTitle: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal)',
        docType: 'lei',
        article: 'Art. 23',
        sectionPath: 'PARTE GERAL > TÍTULO II - DO CRIME',
        page: null,
        content:
          'Art. 23. Não há crime quando o agente pratica o fato:\nI - em estado de necessidade;\nII - em legítima defesa;\nIII - em estrito cumprimento de dever legal ou no exercício regular de direito.\nParágrafo único. O agente, em qualquer das hipóteses deste artigo, responderá pelo excesso doloso ou culposo.',
        score: 0.98,
        rerankScore: 0.98,
      },
      {
        chunkId: 'example-cp-art-25',
        documentId: 'decreto-lei-2848-1940-cp',
        documentTitle: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal)',
        docType: 'lei',
        article: 'Art. 25',
        sectionPath: 'PARTE GERAL > TÍTULO II - DO CRIME',
        page: null,
        content:
          'Art. 25. Entende-se em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem.\nParágrafo único. Observados os requisitos previstos no caput deste artigo, considera-se também em legítima defesa o agente de segurança pública que repele agressão ou risco de agressão a vítima mantida refém durante a prática de crimes.',
        score: 0.97,
        rerankScore: 0.97,
      },
    ],
  },
  {
    question:
      'Quais são os requisitos de validade do negócio jurídico e as hipóteses de nulidade absoluta segundo o Código Civil?',
    answer:
      'Segundo o **Art. 104 do Código Civil (Lei nº 10.406/2002)**, a validade do negócio jurídico requer: **I - agente capaz**; **II - objeto lícito, possível, determinado ou determinável**; e **III - forma prescrita ou não defesa em lei** [example-cc-art-104]. Por sua vez, o **Art. 166** estabelece que é nulo o negócio jurídico quando celebrado por pessoa absolutamente incapaz, for ilícito ou impossível seu objeto, o motivo determinante comum for ilícito, não revestir a forma legal, preterir solenidade essencial, tiver por objetivo fraudar lei imperativa ou a lei taxativamente o declarar nulo [example-cc-art-166].',
    citations: [
      {
        chunkId: 'example-cc-art-104',
        documentId: 'lei-10406-2002-cc',
        documentTitle: 'Lei nº 10.406, de 10 de janeiro de 2002 (Código Civil)',
        docType: 'lei',
        article: 'Art. 104',
        sectionPath: 'PARTE GERAL > LIVRO III - DOS FATOS JURÍDICOS > TÍTULO I - DO NEGÓCIO JURÍDICO',
        page: null,
        content:
          'Art. 104. A validade do negócio jurídico requer:\nI - agente capaz;\nII - objeto lícito, possível, determinado ou determinável;\nIII - forma prescrita ou não defesa em lei.',
        score: 0.98,
        rerankScore: 0.98,
      },
      {
        chunkId: 'example-cc-art-166',
        documentId: 'lei-10406-2002-cc',
        documentTitle: 'Lei nº 10.406, de 10 de janeiro de 2002 (Código Civil)',
        docType: 'lei',
        article: 'Art. 166',
        sectionPath: 'PARTE GERAL > LIVRO III - DOS FATOS JURÍDICOS > TÍTULO I > CAPÍTULO V - DA INVALIDADE DO NEGÓCIO JURÍDICO',
        page: null,
        content:
          'Art. 166. É nulo o negócio jurídico quando:\nI - celebrado por pessoa absolutamente incapaz;\nII - for ilícito, impossível ou indeterminável o seu objeto;\nIII - o motivo determinante, comum a ambas as partes, for ilícito;\nIV - não revestir a forma prescrita em lei;\nV - for preterida alguma solenidade que a lei considere essencial para a sua validade;\nVI - tiver por objetivo fraudar lei imperativa;\nVII - a lei taxativamente o declarar nulo, ou proibir-lhe a prática, sem cominar sanção.',
        score: 0.97,
        rerankScore: 0.97,
      },
    ],
  },
  {
    question:
      'Qual é a duração normal do trabalho e qual o percentual mínimo de remuneração da hora extra previsto na CLT?',
    answer:
      'De acordo com o **Art. 58 da CLT (Decreto-Lei nº 5.452/1943)**, a duração normal do trabalho, para os empregados em qualquer atividade privada, não excederá de **8 (oito) horas diárias**, desde que não seja fixado expressamente outro limite [example-clt-art-58]. Conforme o **Art. 59, § 1º**, a duração diária poderá ser acrescida de horas extras, em número não excedente de 2 (duas), com remuneração pelo menos **50% (cinquenta por cento)** superior à da hora normal [example-clt-art-59].',
    citations: [
      {
        chunkId: 'example-clt-art-58',
        documentId: 'decreto-lei-5452-1943-clt',
        documentTitle: 'Decreto-Lei nº 5.452, de 1º de maio de 1943 (Consolidação das Leis do Trabalho - CLT)',
        docType: 'lei',
        article: 'Art. 58',
        sectionPath: 'TÍTULO II - DAS NORMAS GERAIS DE TUTELA DO TRABALHO > CAPÍTULO II - DA DURAÇÃO DO TRABALHO',
        page: null,
        content:
          'Art. 58. A duração normal do trabalho, para os empregados em qualquer atividade privada, não excederá de 8 (oito) horas diárias, desde que não seja fixado expressamente outro limite.',
        score: 0.98,
        rerankScore: 0.98,
      },
      {
        chunkId: 'example-clt-art-59',
        documentId: 'decreto-lei-5452-1943-clt',
        documentTitle: 'Decreto-Lei nº 5.452, de 1º de maio de 1943 (Consolidação das Leis do Trabalho - CLT)',
        docType: 'lei',
        article: 'Art. 59',
        sectionPath: 'TÍTULO II - DAS NORMAS GERAIS DE TUTELA DO TRABALHO > CAPÍTULO II - DA DURAÇÃO DO TRABALHO',
        page: null,
        content:
          'Art. 59. A duração diária do trabalho poderá ser acrescida de horas extras, em número não excedente de duas, por acordo individual, convenção coletiva ou acordo coletivo de trabalho.\n§ 1º A remuneração da hora extra será, pelo menos, 50% (cinquenta por cento) superior à da hora normal.',
        score: 0.97,
        rerankScore: 0.97,
      },
    ],
  },
  {
    question:
      'Qual é o prazo decadencial para o consumidor reclamar por vícios aparentes e ocultos em produtos duráveis e não duráveis?',
    answer:
      'Pelo **Art. 26 do Código de Defesa do Consumidor (Lei nº 8.078/1990)**, o direito de reclamar pelos vícios aparentes ou de fácil constatação caduca em: **I - 30 (trinta) dias**, tratando-se de fornecimento de serviço e de produtos não duráveis; e **II - 90 (noventa) dias**, tratando-se de fornecimento de serviço e de produtos duráveis [example-cdc-art-26]. Na hipótese de **vício oculto** (§ 3º), o prazo decadencial inicia-se no momento em que ficar evidenciado o defeito [example-cdc-art-26].',
    citations: [
      {
        chunkId: 'example-cdc-art-26',
        documentId: 'lei-8078-1990-cdc',
        documentTitle: 'Lei nº 8.078, de 11 de setembro de 1990 (Código de Defesa do Consumidor - CDC)',
        docType: 'lei',
        article: 'Art. 26',
        sectionPath: 'TÍTULO I - DOS DIREITOS DO CONSUMIDOR > CAPÍTULO IV > Seção IV - Da Decadência e da Prescrição',
        page: null,
        content:
          'Art. 26. O direito de reclamar pelos vícios aparentes ou de fácil constatação caduca em:\nI - trinta dias, tratando-se de fornecimento de serviço e de produtos não duráveis;\nII - noventa dias, tratando-se de fornecimento de serviço e de produtos duráveis.\n§ 1º Inicia-se a contagem do prazo decadencial a partir da entrega efetiva do produto ou do término da execução dos serviços.\n§ 3º Tratando-se de vício oculto, o prazo decadencial inicia-se no momento em que ficar evidenciado o defeito.',
        score: 0.99,
        rerankScore: 0.99,
      },
    ],
  },
  {
    question:
      'Quais são as causas de suspensão da exigibilidade do crédito tributário previstas no Art. 151 do CTN?',
    answer:
      'Conforme o **Art. 151 do Código Tributário Nacional (Lei nº 5.172/1966)**, suspendem a exigibilidade do crédito tributário: **I - moratória**; **II - o depósito do seu montante integral**; **III - as reclamações e os recursos**, nos termos das leis reguladoras do processo tributário administrativo; **IV - a concessão de medida liminar em mandado de segurança**; **V - a concessão de medida liminar ou de tutela antecipada**, em outras espécies de ação judicial; e **VI - o parcelamento** [example-ctn-art-151].',
    citations: [
      {
        chunkId: 'example-ctn-art-151',
        documentId: 'lei-5172-1966-ctn',
        documentTitle: 'Lei nº 5.172, de 25 de outubro de 1966 (Código Tributário Nacional - CTN)',
        docType: 'lei',
        article: 'Art. 151',
        sectionPath: 'LIVRO SEGUNDO > TÍTULO III - CRÉDITO TRIBUTÁRIO > CAPÍTULO III - Suspensão do Crédito Tributário',
        page: null,
        content:
          'Art. 151. Suspendem a exigibilidade do crédito tributário:\nI - moratória;\nII - o depósito do seu montante integral;\nIII - as reclamações e os recursos, nos termos das leis reguladoras do processo tributário administrativo;\nIV - a concessão de medida liminar em mandado de segurança.\nV - a concessão de medida liminar ou de tutela antecipada, em outras espécies de ação judicial;\nVI - o parcelamento.',
        score: 0.99,
        rerankScore: 0.99,
      },
    ],
  },
  {
    question:
      'Qual é o limite de valor para dispensa de licitação em obras e serviços de engenharia na Lei 14.133/2021?',
    answer:
      'Pela **Lei nº 14.133/2021 (Art. 75, incisos I e II)**, a licitação é dispensável para contratações que envolvam valores inferiores a **R$ 100.000,00 (cem mil reais)** no caso de obras e serviços de engenharia ou de serviços de manutenção de veículos automotores, e inferiores a **R$ 50.000,00 (cinquenta mil reais)** no caso de outros serviços e compras [example-art-75].',
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
      'Quais são os direitos do titular dos dados pessoais em relação ao controlador na LGPD?',
    answer:
      'De acordo com o **Art. 18 da LGPD (Lei nº 13.709/2018)**, o titular dos dados pessoais tem direito a obter do controlador, a qualquer momento e mediante requisição: confirmação da existência de tratamento, acesso aos dados, correção de dados incompletos ou inexatos, anonimização/bloqueio/eliminação de dados desnecessários, portabilidade, eliminação dos dados tratados com consentimento, informações sobre compartilhamento e revogação do consentimento [example-lgpd-art-18].',
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
