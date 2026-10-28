import Anthropic from '@anthropic-ai/sdk';
import { validateCitations, type CitationValidationResult } from './citation-validator.js';
import { buildGroundedClaudePrompt } from './prompt-builder.js';
import {
  DEFAULT_REFUSAL_THRESHOLD,
  evaluateRefusalGuard,
} from './refusal-guard.js';
import type { SearchResultItem } from './vector-search.js';

export interface LlmStreamAdapter {
  streamAnswer(prompt: {
    system: string;
    userMessage: string;
    chunks: SearchResultItem[];
    question: string;
  }): AsyncGenerator<string, { promptTokens: number; completionTokens: number }, void>;
}

export class AnthropicClaudeStreamAdapter implements LlmStreamAdapter {
  private readonly client?: Anthropic;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest';
    if (apiKey && !apiKey.includes('your-key-here')) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async *streamAnswer(prompt: {
    system: string;
    userMessage: string;
    chunks: SearchResultItem[];
    question: string;
  }): AsyncGenerator<string, { promptTokens: number; completionTokens: number }, void> {
    if (this.client) {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 800,
        temperature: 0,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.userMessage }],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }

      const finalMsg = await stream.finalMessage();
      return {
        promptTokens: finalMsg.usage.input_tokens,
        completionTokens: finalMsg.usage.output_tokens,
      };
    }

    // Extractive grounded synthesis when running locally without external ANTHROPIC_API_KEY
    const topChunks = prompt.chunks.slice(0, 2);
    const synthesizedParts = topChunks.map((chunk) => {
      const label = [chunk.documentTitle, chunk.article].filter(Boolean).join(' — ');
      return `Com base em **${label}**, dispõe o texto legal:\n\n> ${chunk.content} [${chunk.chunkId}]`;
    });
    const fullText = synthesizedParts.join('\n\n');
    const tokens = fullText.split(/(\s+)/);
    for (const token of tokens) {
      yield token;
    }

    return {
      promptTokens: Math.ceil(prompt.userMessage.length / 4),
      completionTokens: Math.ceil(fullText.length / 4),
    };
  }
}

export interface ChatStreamEvents {
  onToken: (token: string) => void;
  onCitations: (citations: SearchResultItem[], validation: CitationValidationResult) => void;
  onDone: (meta: {
    refused: boolean;
    reason?: string;
    searchLatencyMs: number;
    llmLatencyMs: number;
    promptTokens: number;
    completionTokens: number;
  }) => void;
}

export interface ExecuteChatOptions {
  question: string;
  k?: number;
  documentId?: string;
  docType?: string;
  refusalThreshold?: number;
  retrieveCandidates: (question: string, k: number) => Promise<SearchResultItem[]>;
  llmAdapter?: LlmStreamAdapter;
}

export const REFUSAL_MESSAGE =
  'Não encontrei informações suficientes nos documentos indexados para responder a esta pergunta com segurança.';

export async function executeGroundedChatStream(
  options: ExecuteChatOptions,
  callbacks: ChatStreamEvents,
): Promise<void> {
  const k = options.k ?? 5;
  const searchStarted = performance.now();
  const rankedChunks = await options.retrieveCandidates(options.question, k);
  const searchLatencyMs = Math.round(performance.now() - searchStarted);

  const refusalDecision = evaluateRefusalGuard(
    rankedChunks,
    options.refusalThreshold ?? DEFAULT_REFUSAL_THRESHOLD,
  );

  if (refusalDecision.refused) {
    callbacks.onToken(REFUSAL_MESSAGE);
    callbacks.onCitations([], {
      isValid: true,
      validChunkIds: [],
      invalidChunkIds: [],
      citedChunks: [],
      sanitizedAnswer: REFUSAL_MESSAGE,
    });
    callbacks.onDone({
      refused: true,
      reason: refusalDecision.reason,
      searchLatencyMs,
      llmLatencyMs: 0,
      promptTokens: 0,
      completionTokens: 0,
    });
    return;
  }

  const prompt = buildGroundedClaudePrompt(options.question, rankedChunks);
  const adapter = options.llmAdapter ?? new AnthropicClaudeStreamAdapter();

  const llmStarted = performance.now();
  let accumulated = '';
  const gen = adapter.streamAnswer({
    system: prompt.system,
    userMessage: prompt.userMessage,
    chunks: rankedChunks,
    question: options.question,
  });

  let usage = { promptTokens: 0, completionTokens: 0 };
  while (true) {
    const next = await gen.next();
    if (next.done) {
      usage = next.value;
      break;
    }
    accumulated += next.value;
    callbacks.onToken(next.value);
  }

  const llmLatencyMs = Math.round(performance.now() - llmStarted);
  const validation = validateCitations(accumulated, rankedChunks);
  const citationsToReturn =
    validation.citedChunks.length > 0 ? validation.citedChunks : rankedChunks.slice(0, 2);

  callbacks.onCitations(citationsToReturn, validation);
  callbacks.onDone({
    refused: false,
    searchLatencyMs,
    llmLatencyMs,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  });
}
