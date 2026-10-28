import { describe, expect, it } from 'vitest';
import { computeContentHash, extractCleanText } from '../extractor.js';

describe('extractCleanText', () => {
  it('cleans HTML, removes scripts/styles/struck-through text and repeated headers/footers while preserving legal structure', () => {
    const rawHtml = `
      <html>
        <head>
          <style>body { font-family: Arial; }</style>
          <script>console.log("noise");</script>
        </head>
        <body>
          <p>Presidência da República</p>
          <p>Casa Civil - Subchefia para Assuntos Jurídicos</p>
          <h1>TÍTULO I - DISPOSIÇÕES PRELIMINARES</h1>
          <h2>CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI</h2>
          <p>Art. 1º Esta Lei estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais da União, dos Estados, do Distrito Federal e dos Municípios.</p>
          <p><strike>Art. 1º-A Texto antigo revogado.</strike></p>
          <p>Página 1 de 85</p>
          <p>§ 1º Não são abrangidas por esta Lei as empresas públicas, as sociedades de economia mista e as suas subsidiárias, regidas pela Lei nº 13.303, de 30 de junho de 2016.</p>
          <p>12/85</p>
        </body>
      </html>
    `;

    const cleaned = extractCleanText(rawHtml, 'html');

    expect(cleaned).not.toContain('console.log');
    expect(cleaned).not.toContain('font-family');
    expect(cleaned).not.toContain('Texto antigo revogado');
    expect(cleaned).not.toContain('Página 1 de 85');
    expect(cleaned).not.toContain('Presidência da República');
    expect(cleaned).toContain('TÍTULO I - DISPOSIÇÕES PRELIMINARES');
    expect(cleaned).toContain('CAPÍTULO I - DO ÂMBITO DE APLICAÇÃO DESTA LEI');
    expect(cleaned).toContain('Art. 1º Esta Lei estabelece normas gerais de licitação');
    expect(cleaned).toContain('§ 1º Não são abrangidas por esta Lei as empresas públicas');
  });

  it('normalizes plain text and removes page numbers and repeated headers', () => {
    const rawText = [
      'Presidência da República',
      'TÍTULO II',
      'CAPÍTULO VIII - DA CONTRATAÇÃO DIRETA',
      'Seção III - Da Dispensa de Licitação',
      'Art. 75. É dispensável a licitação:',
      'Página 34 de 120',
      'I - para contratação que envolva valores inferiores a R$ 100.000,00 (cem mil reais), no caso de obras e serviços de engenharia ou de serviços de manutenção de veículos automotores;',
      'II - para contratação que envolva valores inferiores a R$ 50.000,00 (cinquenta mil reais), no caso de outros serviços e compras;',
    ].join('\n');

    const cleaned = extractCleanText(rawText, 'text');

    expect(cleaned).not.toContain('Página 34 de 120');
    expect(cleaned).toContain('Art. 75. É dispensável a licitação:');
    expect(cleaned).toContain('I - para contratação que envolva valores inferiores a R$ 100.000,00');
  });

  it('computes deterministic SHA-256 content hash', () => {
    const h1 = computeContentHash('Art. 75. É dispensável a licitação.');
    const h2 = computeContentHash('Art. 75. É dispensável a licitação.');
    const h3 = computeContentHash('Art. 74. É inexigível a licitação.');

    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});
