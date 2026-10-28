import type { LegalChunk } from './legal-chunker.js';

export interface FixedChunkerOptions {
  chunkSize?: number;
  overlap?: number;
}

const FIRST_ARTICLE_IN_WINDOW_REGEX = /Art\.\s*(\d+(?:-[A-Z])?(?:º|°)?)\b/i;

function extractArticleTag(text: string): string | null {
  const match = text.match(FIRST_ARTICLE_IN_WINDOW_REGEX);
  if (!match || !match[1]) return null;
  const raw = match[1].replace(/°/g, 'º');
  const numMatch = raw.match(/^(\d+)(.*)$/);
  if (!numMatch) return `Art. ${raw}`;
  const num = Number.parseInt(numMatch[1] ?? '0', 10);
  const suffix = (numMatch[2] ?? '').replace(/º/g, '');
  return num >= 1 && num <= 9 ? `Art. ${num}º${suffix}` : `Art. ${num}${suffix}`;
}

export function chunkByFixedSize(
  cleanText: string,
  options: FixedChunkerOptions = {},
): LegalChunk[] {
  const chunkSize = options.chunkSize ?? 600;
  const overlap = Math.min(options.overlap ?? 80, Math.floor(chunkSize / 2));
  const step = Math.max(1, chunkSize - overlap);

  const chunks: LegalChunk[] = [];
  let position = 0;

  for (let start = 0; start < cleanText.length; start += step) {
    const slice = cleanText.slice(start, start + chunkSize).trim();
    if (!slice) continue;

    const article = extractArticleTag(slice);
    chunks.push({
      position: position++,
      article,
      sectionPath: null,
      page: null,
      content: slice,
      embeddedText: slice,
    });

    if (start + chunkSize >= cleanText.length) break;
  }

  return chunks;
}
