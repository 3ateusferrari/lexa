import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractTextFromPdf } from '../pdf-extractor.js';

describe('PDF Stream Text Extractor', () => {
  it('extracts text from uncompressed PDF streams with Tj operators', () => {
    const pdfContent = [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Length 120 >>',
      'stream',
      'BT',
      '/F1 12 Tf',
      '(Artigo 1. Esta lei regula licitacoes.) Tj',
      'T*',
      '(Paragrafo unico. Aplica-se a todos.) Tj',
      'ET',
      'endstream',
      'endobj',
      '%%EOF',
    ].join('\n');

    const text = extractTextFromPdf(pdfContent);
    expect(text).toContain('Artigo 1. Esta lei regula licitacoes.');
    expect(text).toContain('Paragrafo unico. Aplica-se a todos.');
  });

  it('extracts text from FlateDecode compressed PDF streams with TJ array operators', () => {
    const rawStream = 'BT /F1 12 Tf [(Artigo 75. ) -20 (E dispensavel a licitacao.)] TJ ET';
    const compressed = zlib.deflateSync(Buffer.from(rawStream));

    const pdfBuffer = Buffer.concat([
      Buffer.from(
        `%PDF-1.7\n1 0 obj\n<< /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
      ),
      compressed,
      Buffer.from('\nendstream\nendobj\n%%EOF'),
    ]);

    const text = extractTextFromPdf(pdfBuffer);
    expect(text).toContain('Artigo 75. E dispensavel a licitacao.');
  });

  it('decodes escaped characters and parentheses inside PDF strings', () => {
    const rawStream = 'BT (Lei 14.133\\/2021 \\(Nova Lei\\) \\\\ Dispensa) Tj ET';
    const pdfContent = `%PDF-1.4\nstream\n${rawStream}\nendstream\n%%EOF`;
    const text = extractTextFromPdf(pdfContent);
    expect(text).toContain('Lei 14.133/2021 (Nova Lei) \\ Dispensa');
  });

  it('falls back cleanly to plain text if input is not a binary PDF', () => {
    const plain = 'Art. 1º Texto puro sem cabeçalho PDF';
    expect(extractTextFromPdf(plain)).toBe(plain);
  });
});
