import { chunkByFixedSize } from './fixed-chunker.js';

export interface LegalChunk {
  position: number;
  article: string | null;
  sectionPath: string | null;
  page: number | null;
  content: string;
  embeddedText: string;
}

export interface LegalChunkerOptions {
  maxCharsPerChunk?: number;
}

const TITULO_REGEX = /^T[ÍI]TULO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?$/i;
const CAPITULO_REGEX = /^CAP[ÍI]TULO\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?$/i;
const SECAO_REGEX = /^Se[çc][ãa]o\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?$/i;
const SUBSECAO_REGEX = /^Subse[çc][ãa]o\s+[IVXLCDM]+(?:\s*[-–—]\s*.*)?$/i;
const ARTIGO_REGEX = /^Art\.\s*(\d+(?:-[A-Z])?(?:º|°)?)\b\.?\s*(.*)$/i;
const CLAUSULA_REGEX = /^CL[ÁA]USULA\s+([A-Z0-9ªº\s–-]+)\b\.?\s*(.*)$/i;
const ITEM_REGEX = /^(?:ITEM\s+)?(\d+(?:\.\d+)+)\s*[-–—.]?\s*(.*)$/i;

function normalizeArticleLabel(rawNumber: string): string {
  const cleaned = rawNumber.replace(/°/g, 'º').trim();
  const numericMatch = cleaned.match(/^(\d+)(.*)$/);
  if (!numericMatch) return `Art. ${cleaned}`;
  const num = Number.parseInt(numericMatch[1] ?? '0', 10);
  const suffix = (numericMatch[2] ?? '').replace(/º/g, '');
  if (num >= 1 && num <= 9) {
    return `Art. ${num}º${suffix}`;
  }
  return `Art. ${num}${suffix}`;
}

function buildSectionPath(hierarchy: {
  titulo: string | null;
  capitulo: string | null;
  secao: string | null;
  subsecao: string | null;
}): string | null {
  const parts = [
    hierarchy.titulo,
    hierarchy.capitulo,
    hierarchy.secao,
    hierarchy.subsecao,
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' > ') : null;
}

function buildEmbeddedText(sectionPath: string | null, article: string | null, content: string): string {
  const prefixParts = [sectionPath, article].filter(Boolean);
  if (prefixParts.length === 0) return content;
  return `[${prefixParts.join(' | ')}]\n${content}`;
}

export function chunkByLegalStructure(
  cleanText: string,
  options: LegalChunkerOptions = {},
): LegalChunk[] {
  const maxChars = options.maxCharsPerChunk ?? 1800;
  const lines = cleanText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const hierarchy = {
    titulo: null as string | null,
    capitulo: null as string | null,
    secao: null as string | null,
    subsecao: null as string | null,
  };

  interface RawArticleBlock {
    article: string;
    sectionPath: string | null;
    lines: string[];
  }

  const articleBlocks: RawArticleBlock[] = [];
  const preambleLines: string[] = [];
  let currentBlock: RawArticleBlock | null = null;

  for (const line of lines) {
    if (TITULO_REGEX.test(line)) {
      hierarchy.titulo = line;
      hierarchy.capitulo = null;
      hierarchy.secao = null;
      hierarchy.subsecao = null;
      continue;
    }

    if (CAPITULO_REGEX.test(line)) {
      hierarchy.capitulo = line;
      hierarchy.secao = null;
      hierarchy.subsecao = null;
      continue;
    }

    if (SECAO_REGEX.test(line)) {
      hierarchy.secao = line;
      hierarchy.subsecao = null;
      continue;
    }

    if (SUBSECAO_REGEX.test(line)) {
      hierarchy.subsecao = line;
      continue;
    }

    let detectedLabel: string | null = null;
    const artMatch = line.match(ARTIGO_REGEX);
    if (artMatch && artMatch[1]) {
      detectedLabel = normalizeArticleLabel(artMatch[1]);
    } else {
      const clausulaMatch = line.match(CLAUSULA_REGEX);
      if (clausulaMatch && clausulaMatch[1]) {
        detectedLabel = `Cláusula ${clausulaMatch[1].trim()}`;
      } else {
        const itemMatch = line.match(ITEM_REGEX);
        if (itemMatch && itemMatch[1]) {
          detectedLabel = `Item ${itemMatch[1].trim()}`;
        }
      }
    }

    if (detectedLabel) {
      if (preambleLines.length > 0 && !currentBlock && articleBlocks.length === 0) {
        articleBlocks.push({
          article: 'Preâmbulo / Ementa',
          sectionPath: buildSectionPath(hierarchy),
          lines: [...preambleLines],
        });
        preambleLines.length = 0;
      }

      if (currentBlock) {
        articleBlocks.push(currentBlock);
      }

      currentBlock = {
        article: detectedLabel,
        sectionPath: buildSectionPath(hierarchy),
        lines: [line],
      };
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (currentBlock) {
    articleBlocks.push(currentBlock);
  } else if (preambleLines.length > 0 && articleBlocks.length === 0) {
    articleBlocks.push({
      article: 'Documento Geral',
      sectionPath: buildSectionPath(hierarchy),
      lines: preambleLines,
    });
  }

  // Fallback to fixed chunking if no structural blocks could be extracted
  if (articleBlocks.length === 0) {
    const fixedChunks = chunkByFixedSize(cleanText, { chunkSize: maxChars, overlap: 100 });
    return fixedChunks.map((c) => ({
      position: c.position,
      article: null,
      sectionPath: null,
      page: null,
      content: c.content,
      embeddedText: c.content,
    }));
  }

  const results: LegalChunk[] = [];
  let position = 0;

  for (const block of articleBlocks) {
    const fullContent = block.lines.join('\n');
    if (fullContent.length <= maxChars) {
      results.push({
        position: position++,
        article: block.article,
        sectionPath: block.sectionPath,
        page: null,
        content: fullContent,
        embeddedText: buildEmbeddedText(block.sectionPath, block.article, fullContent),
      });
      continue;
    }

    if (block.lines.length <= 1) {
      const fixed = chunkByFixedSize(fullContent, { chunkSize: maxChars, overlap: 50 });
      for (const fc of fixed) {
        results.push({
          position: position++,
          article: block.article,
          sectionPath: block.sectionPath,
          page: null,
          content: fc.content,
          embeddedText: buildEmbeddedText(block.sectionPath, block.article, fc.content),
        });
      }
      continue;
    }

    // Split oversized article/clause into sub-chunks while always retaining the caput (first line)
    const caput = block.lines[0] ?? '';
    const subLines = block.lines.slice(1);
    let buffer: string[] = [caput];

    for (const subLine of subLines) {
      const candidate = [...buffer, subLine].join('\n');
      if (candidate.length > maxChars && buffer.length > 1) {
        const subContent = buffer.join('\n');
        results.push({
          position: position++,
          article: block.article,
          sectionPath: block.sectionPath,
          page: null,
          content: subContent,
          embeddedText: buildEmbeddedText(block.sectionPath, block.article, subContent),
        });
        buffer = [caput, subLine];
      } else {
        buffer.push(subLine);
      }
    }

    if (buffer.length > 1) {
      const subContent = buffer.join('\n');
      results.push({
        position: position++,
        article: block.article,
        sectionPath: block.sectionPath,
        page: null,
        content: subContent,
        embeddedText: buildEmbeddedText(block.sectionPath, block.article, subContent),
      });
    }
  }

  return results;
}
