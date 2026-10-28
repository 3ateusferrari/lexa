import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractCleanText } from '../extractor.js';
import { chunkByLegalStructure } from '../legal-chunker.js';
import { chunkByFixedSize } from '../fixed-chunker.js';

describe('chunkByLegalStructure & chunkByFixedSize', () => {
  it('extracts articles with full hierarchical sectionPath from Lei 14.133/2021', () => {
    const html = readFileSync(resolve(process.cwd(), 'data/corpus/lei-14133-2021.html'), 'utf8');
    const cleanText = extractCleanText(html, 'html');
    const chunks = chunkByLegalStructure(cleanText);

    expect(chunks.length).toBeGreaterThan(25);

    const art1 = chunks.find((c) => c.article === 'Art. 1º');
    expect(art1).toBeDefined();
    expect(art1?.sectionPath).toContain('TÍTULO I');
    expect(art1?.sectionPath).toContain('CAPÍTULO I');

    const art75 = chunks.find((c) => c.article === 'Art. 75');
    expect(art75).toBeDefined();
    expect(art75?.sectionPath).toContain('TÍTULO II');
    expect(art75?.sectionPath).toContain('CAPÍTULO VIII');
    expect(art75?.sectionPath).toContain('Seção III');
    expect(art75?.content).toContain('R$ 100.000,00');
    expect(art75?.embeddedText).toContain('Art. 75');
  });

  it('splits oversized articles by paragraph/inciso while preserving caput and article metadata', () => {
    const sample = [
      'TÍTULO I - DISPOSIÇÕES PRELIMINARES',
      'CAPÍTULO I - DO ÂMBITO',
      'Art. 10. Este é o caput do artigo dez com regras gerais obrigatórias.',
      'I - primeiro inciso com detalhamento extenso sobre obras públicas e engenharia;',
      'II - segundo inciso com detalhamento extenso sobre serviços contínuos e compras;',
      '§ 1º Primeiro parágrafo explicando exceções importantes ao regime geral.',
      '§ 2º Segundo parágrafo definindo prazos e responsabilidades.',
    ].join('\n');

    const chunks = chunkByLegalStructure(sample, { maxCharsPerChunk: 180 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.article).toBe('Art. 10');
      expect(chunk.sectionPath).toBe('TÍTULO I - DISPOSIÇÕES PRELIMINARES > CAPÍTULO I - DO ÂMBITO');
      expect(chunk.content).toContain('Art. 10.');
    }
  });

  it('chunks text by fixed character window for baseline comparison', () => {
    const html = readFileSync(resolve(process.cwd(), 'data/corpus/lei-14133-2021.html'), 'utf8');
    const cleanText = extractCleanText(html, 'html');
    const fixedChunks = chunkByFixedSize(cleanText, { chunkSize: 500, overlap: 50 });

    expect(fixedChunks.length).toBeGreaterThan(10);
    expect(fixedChunks[0]?.position).toBe(0);
  });
});
