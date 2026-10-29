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
  category: 'Lei 14.133/2021' | 'LGPD (Lei 13.709/2018)' | 'Fora do Escopo';
  question: string;
}

export const EXAMPLE_QUESTIONS_UI: ExampleQuestionItem[] = [
  {
    id: 'ex-1',
    category: 'Lei 14.133/2021',
    question:
      'Quais são as modalidades de licitação previstas na Lei 14.133/2021 e é permitida a criação de novas modalidades?'
  },
  {
    id: 'ex-2',
    category: 'Lei 14.133/2021',
    question:
      'Qual é o limite de valor para dispensa de licitação em obras e serviços de engenharia ou manutenção de veículos automotores?'
  },
  {
    id: 'ex-3',
    category: 'LGPD (Lei 13.709/2018)',
    question:
      'Quais são as sanções administrativas e o limite máximo de multa aplicáveis pela ANPD na LGPD?'
  },
  {
    id: 'ex-4',
    category: 'LGPD (Lei 13.709/2018)',
    question:
      'Quais são os direitos do titular dos dados pessoais em relação ao controlador?'
  },
  {
    id: 'ex-5',
    category: 'Fora do Escopo',
    question:
      'Qual é a alíquota do Imposto sobre Grandes Fortunas e do ICMS interestadual prevista no Código Tributário Nacional?'
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
  for (const c of citations) {
    bySourceId.set(c.sourceId.toLowerCase(), c);
  }

  const regex = /(\[Fonte\s+\d+\])/gi;
  const parts = answer.split(regex);
  const segments: AnswerSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const match = /^\[(Fonte\s+\d+)\]$/i.exec(part);
    if (match && match[1]) {
      const normalizedNumber = match[1].replace(/\s+/g, ' ').trim();
      const canonicalId = `Fonte ${normalizedNumber.split(' ')[1]}`;
      segments.push({
        type: 'citation',
        sourceId: canonicalId,
        label: `[${canonicalId}]`,
        citation: bySourceId.get(canonicalId.toLowerCase())
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
      if (ev.event === 'token' && typeof ev.data.token === 'string') {
        callbacks.onToken(ev.data.token);
      } else if (ev.event === 'citations') {
        const citations = Array.isArray(ev.data.citations)
          ? (ev.data.citations as CitationPayload[])
          : [];
        const usedSources = Array.isArray(ev.data.usedSources)
          ? (ev.data.usedSources as string[])
          : [];
        callbacks.onCitations(citations, usedSources);
      } else if (ev.event === 'done') {
        callbacks.onDone({
          refused: Boolean(ev.data.refused),
          latencyMs: Number(ev.data.latencyMs ?? 0),
          modelId: String(ev.data.modelId ?? 'claude-3-5-haiku-latest'),
          cached: Boolean(ev.data.cached)
        });
      } else if (ev.event === 'error') {
        callbacks.onError(String(ev.data.message ?? 'Erro inesperado no streaming'));
      }
    }
  }
}
