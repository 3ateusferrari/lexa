import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface LawToDownload {
  slug: string;
  title: string;
  docType: 'constituicao' | 'codigo' | 'lei';
  fileName: string;
  url: string;
}

const GOLDEN_LAWS: LawToDownload[] = [
  {
    slug: 'cf-1988',
    title: 'Constituição da República Federativa do Brasil de 1988',
    docType: 'constituicao',
    fileName: 'constituicao-1988.html',
    url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicaocompilado.htm',
  },
  {
    slug: 'lei-8078-1990-cdc',
    title: 'Lei nº 8.078, de 11 de setembro de 1990 (Código de Defesa do Consumidor - CDC)',
    docType: 'codigo',
    fileName: 'lei-8078-1990-cdc.html',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  },
  {
    slug: 'lei-5172-1966-ctn',
    title: 'Lei nº 5.172, de 25 de outubro de 1966 (Código Tributário Nacional - CTN)',
    docType: 'codigo',
    fileName: 'lei-5172-1966-ctn.html',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm',
  },
  {
    slug: 'decreto-lei-2848-1940-cp',
    title: 'Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal - CP)',
    docType: 'codigo',
    fileName: 'decreto-lei-2848-1940-cp.html',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
  },
  {
    slug: 'decreto-lei-5452-1943-clt',
    title: 'Decreto-Lei nº 5.452, de 1º de maio de 1943 (Consolidação das Leis do Trabalho - CLT)',
    docType: 'codigo',
    fileName: 'decreto-lei-5452-1943-clt.html',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',
  },
  {
    slug: 'lei-10406-2002-cc',
    title: 'Lei nº 10.406, de 10 de janeiro de 2002 (Código Civil - CC)',
    docType: 'codigo',
    fileName: 'lei-10406-2002-cc.html',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
  },
  {
    slug: 'lei-13105-2015-cpc',
    title: 'Lei nº 13.105, de 16 de março de 2015 (Código de Processo Civil - CPC)',
    docType: 'codigo',
    fileName: 'lei-13105-2015-cpc.html',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
  },
  {
    slug: 'lei-8112-1990',
    title: 'Lei nº 8.112, de 11 de dezembro de 1990 (Regime Jurídico dos Servidores Públicos Civis da União)',
    docType: 'lei',
    fileName: 'lei-8112-1990.html',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
  },
  {
    slug: 'lei-8429-1992',
    title: 'Lei nº 8.429, de 2 de junho de 1992 (Lei de Improbidade Administrativa)',
    docType: 'lei',
    fileName: 'lei-8429-1992.html',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
  },
  {
    slug: 'lei-9784-1999',
    title: 'Lei nº 9.784, de 29 de janeiro de 1999 (Processo Administrativo Federal)',
    docType: 'lei',
    fileName: 'lei-9784-1999.html',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm',
  },
];

async function downloadLaw(item: LawToDownload): Promise<boolean> {
  const targetPath = resolve(process.cwd(), 'data/corpus', item.fileName);
  if (existsSync(targetPath)) {
    console.log(`[EXISTENTE] ${item.slug} já presente em data/corpus/${item.fileName}`);
    return true;
  }

  console.log(`[BAIXANDO] ${item.title} a partir de ${item.url}...`);
  try {
    const res = await fetch(item.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      console.error(`❌ Erro HTTP ${res.status} ao baixar ${item.slug}`);
      return false;
    }

    const buf = await res.arrayBuffer();
    // Decodifica Windows-1252 / ISO-8859-1 do Planalto para UTF-8 limpo
    const htmlUtf8 = new TextDecoder('windows-1252').decode(buf);
    writeFileSync(targetPath, htmlUtf8, 'utf8');
    console.log(`✅ Salvo: data/corpus/${item.fileName} (${(htmlUtf8.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.error(`❌ Falha na conexão ao baixar ${item.slug}:`, err);
    return false;
  }
}

async function main() {
  console.log('====================================================');
  console.log('  DOWNLOAD DO NÚCLEO DE OURO DA LEGISLAÇÃO BRASILEIRA');
  console.log('====================================================');

  const todayStr = new Date().toISOString().slice(0, 10);
  const manifestPath = resolve(process.cwd(), 'data/corpus/manifest.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { documents: [] };

  const existingSlugs = new Set(manifest.documents.map((d: { slug: string }) => d.slug));

  for (const item of GOLDEN_LAWS) {
    const ok = await downloadLaw(item);
    if (ok && !existingSlugs.has(item.slug)) {
      manifest.documents.push({
        slug: item.slug,
        title: item.title,
        docType: item.docType,
        filePath: `data/corpus/${item.fileName}`,
        format: 'html',
        sourceUrl: item.url,
        downloadedAt: todayStr,
      });
      existingSlugs.add(item.slug);
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n🎉 Manifest atualizado com sucesso em ${manifestPath}! Total de documentos: ${manifest.documents.length}`);
}

main().catch(console.error);
