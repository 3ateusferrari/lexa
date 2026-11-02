export interface CitationPayload {
  sourceId: string;
  chunkId?: string;
  documentTitle: string;
  articleRef: string;
  content: string;
  rerankScore: number;
}

export interface SseParsedEvent {
  event: 'token' | 'citations' | 'done' | 'error';
  data: Record<string, unknown>;
}

export type AnswerSegment =
  | { type: 'text'; text: string }
  | {
      type: 'citation';
      sourceId: string;
      label: string;
      citation?: CitationPayload;
    };

export interface ExampleQuestionItem {
  id: string;
  category:
    | 'Constituição Federal (CF/88)'
    | 'Código Penal (CP)'
    | 'Código Civil (CC)'
    | 'Trabalhista (CLT)'
    | 'Consumidor (CDC)'
    | 'Tributário (CTN)'
    | 'Lei 14.133/2021'
    | 'LGPD (Lei 13.709/2018)'
    | 'Fora do Escopo';
  question: string;
}

export const EXAMPLE_QUESTIONS_UI: ExampleQuestionItem[] = [
  {
    id: 'ex-cf',
    category: 'Constituição Federal (CF/88)',
    question:
      'Quais são as cláusulas pétreas da Constituição Federal de 1988 que não podem ser objeto de emenda tendente a aboli-las?'
  },
  {
    id: 'ex-cp',
    category: 'Código Penal (CP)',
    question:
      'Quais são as causas de exclusão de ilicitude no Código Penal e como a lei define legítima defesa?'
  },
  {
    id: 'ex-cc',
    category: 'Código Civil (CC)',
    question:
      'Quais são os requisitos de validade do negócio jurídico e as hipóteses de nulidade absoluta segundo o Código Civil?'
  },
  {
    id: 'ex-clt',
    category: 'Trabalhista (CLT)',
    question:
      'Qual é a duração normal do trabalho e qual o percentual mínimo de remuneração da hora extra previsto na CLT?'
  },
  {
    id: 'ex-cdc',
    category: 'Consumidor (CDC)',
    question:
      'Qual é o prazo decadencial para o consumidor reclamar por vícios aparentes e ocultos em produtos duráveis e não duráveis?'
  },
  {
    id: 'ex-ctn',
    category: 'Tributário (CTN)',
    question:
      'Quais são as causas de suspensão da exigibilidade do crédito tributário previstas no Art. 151 do CTN?'
  },
  {
    id: 'ex-licit',
    category: 'Lei 14.133/2021',
    question:
      'Qual é o limite de valor para dispensa de licitação em obras e serviços de engenharia na Lei 14.133/2021?'
  },
  {
    id: 'ex-lgpd',
    category: 'LGPD (Lei 13.709/2018)',
    question:
      'Quais são os direitos do titular dos dados pessoais em relação ao controlador na LGPD?'
  },
  {
    id: 'ex-out',
    category: 'Fora do Escopo',
    question:
      'Como preparar uma receita autêntica de bolo de cenoura com cobertura de brigadeiro crocante?'
  }
];

export function parseSseChunk(rawChunk: string): SseParsedEvent[] {
  const blocks = rawChunk
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const parsed: SseParsedEvent[] = [];

  for (const block of blocks) {
    let eventName: SseParsedEvent['event'] = 'token';
    const dataLines: string[] = [];

    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        const name = line.slice('event:'.length).trim();
        if (
          name === 'token' ||
          name === 'citations' ||
          name === 'done' ||
          name === 'error'
        ) {
          eventName = name;
        }
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length > 0) {
      try {
        const json = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
        parsed.push({ event: eventName, data: json });
      } catch {
        // Ignore malformed partial block
      }
    }
  }

  return parsed;
}

export function segmentAnswerWithCitations(
  answer: string,
  citations: CitationPayload[]
): AnswerSegment[] {
  const bySourceId = new Map<string, CitationPayload>();
  citations.forEach((c, idx) => {
    const canonicalKey = (c.sourceId || `Fonte ${idx + 1}`).toLowerCase();
    bySourceId.set(canonicalKey, c);
    if (c.chunkId) {
      bySourceId.set(c.chunkId.toLowerCase(), c);
      bySourceId.set(`fonte ${idx + 1}`, c);
    }
  });

  const regex =
    /(\[(?:Fonte\s+\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\])/gi;
  const parts = answer.split(regex);
  const segments: AnswerSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const match =
      /^\[(Fonte\s+\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]$/i.exec(
        part
      );
    if (match && match[1]) {
      const rawKey = match[1].trim();
      const matchedCitation = bySourceId.get(rawKey.toLowerCase());
      const label = matchedCitation?.sourceId
        ? `[${matchedCitation.sourceId}]`
        : `[${rawKey}]`;
      segments.push({
        type: 'citation',
        sourceId: matchedCitation?.sourceId || rawKey,
        label,
        citation: matchedCitation
      });
    } else {
      segments.push({ type: 'text', text: part });
    }
  }

  return segments;
}

export interface StreamChatCallbacks {
  onToken: (token: string) => void;
  onCitations: (citations: CitationPayload[], usedSources: string[]) => void;
  onDone: (meta: {
    refused: boolean;
    latencyMs: number;
    modelId: string;
    cached?: boolean;
  }) => void;
  onError: (message: string) => void;
}

export async function streamChatQuestion(
  apiBaseUrl: string,
  question: string,
  callbacks: StreamChatCallbacks
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  if (!response.ok || !response.body) {
    const errBody = await response.json().catch(() => ({}));
    const msg =
      typeof (errBody as { message?: string }).message === 'string'
        ? (errBody as { message: string }).message
        : `Erro HTTP ${response.status}`;
    callbacks.onError(msg);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lastDoubleNewline = buffer.lastIndexOf('\n\n');
    if (lastDoubleNewline === -1) continue;

    const completePart = buffer.slice(0, lastDoubleNewline + 2);
    buffer = buffer.slice(lastDoubleNewline + 2);

    const events = parseSseChunk(completePart);
    for (const ev of events) {
      const tokenText =
        typeof ev.data.token === 'string'
          ? ev.data.token
          : typeof ev.data.text === 'string'
            ? ev.data.text
            : '';

      if (ev.event === 'token' && tokenText) {
        callbacks.onToken(tokenText);
      } else if (ev.event === 'citations') {
        const rawCitations = Array.isArray(ev.data.citations)
          ? (ev.data.citations as Array<Record<string, unknown>>)
          : [];
        const citations: CitationPayload[] = rawCitations.map((c, idx) => ({
          sourceId: typeof c.sourceId === 'string' && c.sourceId ? c.sourceId : `Fonte ${idx + 1}`,
          chunkId: typeof c.chunkId === 'string' ? c.chunkId : undefined,
          documentTitle: typeof c.documentTitle === 'string' ? c.documentTitle : 'Legislação Brasileira',
          articleRef:
            typeof c.articleRef === 'string' && c.articleRef
              ? c.articleRef
              : typeof c.article === 'string' && c.article
                ? c.article
                : 'Dispositivo',
          content: typeof c.content === 'string' ? c.content : '',
          rerankScore: Number(c.rerankScore ?? c.score ?? 0)
        }));
        const usedSources = Array.isArray(ev.data.usedSources)
          ? (ev.data.usedSources as string[])
          : citations.map((c) => c.sourceId);
        callbacks.onCitations(citations, usedSources);
      } else if (ev.event === 'done') {
        const totalLatency =
          Number(ev.data.latencyMs ?? 0) ||
          Number(ev.data.searchLatencyMs ?? 0) + Number(ev.data.llmLatencyMs ?? 0);
        callbacks.onDone({
          refused: Boolean(ev.data.refused),
          latencyMs: totalLatency,
          modelId: String(ev.data.modelId ?? 'claude-3-5-haiku-latest'),
          cached: Boolean(ev.data.cached)
        });
      } else if (ev.event === 'error') {
        callbacks.onError(String(ev.data.message ?? 'Erro inesperado no streaming'));
      }
    }
  }
}
