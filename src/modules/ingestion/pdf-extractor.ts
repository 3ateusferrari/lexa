import zlib from 'node:zlib';

function unescapePdfLiteralString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\\//g, '/');
}

function decodeHexPdfString(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  let res = '';
  for (let i = 0; i < clean.length; i += 2) {
    const byteHex = clean.slice(i, i + 2);
    if (byteHex.length === 2) {
      res += String.fromCharCode(parseInt(byteHex, 16));
    }
  }
  return res;
}

function parseTextFromContentStream(streamText: string): string[] {
  const lines: string[] = [];
  const textBlocks = streamText.matchAll(/BT([\s\S]*?)ET/g);

  for (const blockMatch of textBlocks) {
    const block = blockMatch[1];
    if (!block) continue;

    const blockLines: string[] = [];
    let currentLineTokens: string[] = [];

    // Match text showing operators: Tj, TJ, ', "
    // Also match line breaking operators: T*, Td, TD
    const operatorRegex =
      /(\((?:[^\\)]|\\.)*\)\s*Tj)|(\[(?:[^\]]|\\.)*\]\s*TJ)|(\((?:[^\\)]|\\.)*\)\s*['"])|(T\*)|(?:(?:-?\d+(?:\.\d+)?\s+){2}(?:Td|TD))/g;

    let match: RegExpExecArray | null;
    while ((match = operatorRegex.exec(block)) !== null) {
      const full = match[0];
      if (match[1]) {
        // (text) Tj
        const parenMatch = full.match(/^\(((?:[^\\)]|\\.)*)\)\s*Tj$/);
        if (parenMatch && parenMatch[1]) {
          currentLineTokens.push(unescapePdfLiteralString(parenMatch[1]));
        }
      } else if (match[2]) {
        // [(part1) num (part2)] TJ
        const arrayContent = full.slice(1, full.lastIndexOf(']'));
        const parts = arrayContent.matchAll(/(?:\(((?:[^\\)]|\\.)*)\))|(?:<([0-9a-fA-F]+)>)/g);
        for (const p of parts) {
          if (p[1] !== undefined) {
            currentLineTokens.push(unescapePdfLiteralString(p[1]));
          } else if (p[2] !== undefined) {
            currentLineTokens.push(decodeHexPdfString(p[2]));
          }
        }
      } else if (match[3]) {
        // (text) ' or " (moves to next line and shows text)
        if (currentLineTokens.length > 0) {
          blockLines.push(currentLineTokens.join(''));
          currentLineTokens = [];
        }
        const parenMatch = full.match(/^\(((?:[^\\)]|\\.)*)\)\s*['"]$/);
        if (parenMatch && parenMatch[1]) {
          currentLineTokens.push(unescapePdfLiteralString(parenMatch[1]));
        }
      } else if (match[4] || full.endsWith('Td') || full.endsWith('TD')) {
        // Line break
        if (currentLineTokens.length > 0) {
          blockLines.push(currentLineTokens.join(''));
          currentLineTokens = [];
        }
      }
    }

    if (currentLineTokens.length > 0) {
      blockLines.push(currentLineTokens.join(''));
    }

    if (blockLines.length > 0) {
      lines.push(blockLines.join('\n'));
    }
  }

  return lines;
}

export function extractTextFromPdf(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'binary');
  const headerCheck = buf.subarray(0, 1024).toString('ascii');

  if (!headerCheck.includes('%PDF-')) {
    return typeof input === 'string' ? input : buf.toString('utf-8');
  }

  const collectedParagraphs: string[] = [];
  const latin1Text = buf.toString('latin1');

  // Regex to match PDF stream objects
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(latin1Text)) !== null) {
    const dict = match[1] ?? '';
    const streamStartIndex = match.index + match[0].indexOf('stream') + 6;
    // Skip optional \r\n
    let dataStart = streamStartIndex;
    if (buf[dataStart] === 0x0d && buf[dataStart + 1] === 0x0a) {
      dataStart += 2;
    } else if (buf[dataStart] === 0x0a || buf[dataStart] === 0x0d) {
      dataStart += 1;
    }

    const endstreamPos = latin1Text.indexOf('endstream', dataStart);
    if (endstreamPos === -1) continue;

    let dataEnd = endstreamPos;
    if (buf[dataEnd - 2] === 0x0d && buf[dataEnd - 1] === 0x0a) {
      dataEnd -= 2;
    } else if (buf[dataEnd - 1] === 0x0a || buf[dataEnd - 1] === 0x0d) {
      dataEnd -= 1;
    }

    const rawStreamSlice = buf.subarray(dataStart, dataEnd);
    let streamText: string;

    const isFlate = dict.includes('/FlateDecode');
    if (isFlate) {
      try {
        const decompressed = zlib.inflateSync(rawStreamSlice);
        streamText = decompressed.toString('latin1');
      } catch {
        try {
          const rawDecompressed = zlib.inflateRawSync(rawStreamSlice);
          streamText = rawDecompressed.toString('latin1');
        } catch {
          // Skip corrupt stream
          continue;
        }
      }
    } else {
      streamText = rawStreamSlice.toString('latin1');
    }

    if (streamText.includes('BT') && streamText.includes('ET')) {
      const parsedBlocks = parseTextFromContentStream(streamText);
      for (const p of parsedBlocks) {
        if (p.trim()) {
          collectedParagraphs.push(p.trim());
        }
      }
    }
  }

  if (collectedParagraphs.length === 0) {
    // If no text streams found (e.g. text already in plain layout), extract strings
    const rawMatches = latin1Text.match(/\((?:[^\\)]|\\.)*\)\s*Tj/g);
    if (rawMatches) {
      for (const m of rawMatches) {
        const pMatch = m.match(/^\(((?:[^\\)]|\\.)*)\)\s*Tj$/);
        if (pMatch && pMatch[1]) {
          collectedParagraphs.push(unescapePdfLiteralString(pMatch[1]));
        }
      }
    }
  }

  return collectedParagraphs.join('\n\n');
}
