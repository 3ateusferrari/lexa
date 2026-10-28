import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

export type DocumentInputFormat = 'html' | 'text';

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^Presid[êe]ncia da Rep[úu]blica$/i,
  /^Casa Civil(\s*-\s*Subchefia para Assuntos Jur[íi]dicos)?$/i,
  /^Secretaria-Geral(\s*-\s*Subchefia para Assuntos Jur[íi]dicos)?$/i,
  /^P[áa]gina\s+\d+\s+(de|\/)\s+\d+$/i,
  /^\d+\s*\/\s*\d+$/,
  /^Este texto n[ãa]o substitui o publicado no DOU/i,
];

export function computeContentHash(content: string): string {
  return createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

export function extractCleanText(rawInput: string, format: DocumentInputFormat = 'html'): string {
  let plainText = rawInput;

  if (format === 'html') {
    const $ = cheerio.load(rawInput);
    $('script, style, noscript, iframe, strike, s, del').remove();

    // Ensure block elements produce line breaks before extracting text
    $('p, div, br, h1, h2, h3, h4, h5, h6, li, tr').each((_, el) => {
      $(el).append('\n');
    });

    plainText = $.root().text();
  }

  const lines = plainText
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => {
      if (!line) return false;
      return !NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line));
    });

  return lines.join('\n');
}
