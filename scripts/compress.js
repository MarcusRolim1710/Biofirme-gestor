'use strict';

/**
 * Compacta imagens e PDFs em lote.
 *
 * Uso:
 *   npm run compress -- <arquivo|pasta> [mais...] [--out compressed]
 *
 * Opcoes:
 *   --out <dir>         pasta de saida (padrao: compressed)
 *   --max-width <px>    largura maxima da imagem (padrao: 1600)
 *   --quality <1-100>   qualidade WebP/JPEG (padrao: 72)
 *   --pdf-mode <modo>   auto | lossless | raster (padrao: auto)
 *   --scale <n>         escala de rasterizacao do PDF (padrao: 1.5)
 *   --max-pages <n>     nao rasteriza PDFs com mais paginas (padrao: 30)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp']);
const PDF_EXTENSIONS = new Set(['.pdf']);

function parseArgs(argv) {
  const options = {
    out: 'compressed',
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 72,
    pdfMode: 'auto',
    scale: 1.5,
    maxPages: 30,
  };
  const inputs = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--out') options.out = argv[++i];
    else if (arg === '--max-width') options.maxWidth = Number(argv[++i]);
    else if (arg === '--quality') options.quality = Number(argv[++i]);
    else if (arg === '--pdf-mode') options.pdfMode = argv[++i];
    else if (arg === '--scale') options.scale = Number(argv[++i]);
    else if (arg === '--max-pages') options.maxPages = Number(argv[++i]);
    else if (arg.startsWith('--')) throw new Error(`Opcao desconhecida: ${arg}`);
    else inputs.push(arg);
  }

  if (!inputs.length) throw new Error('Informe ao menos um arquivo ou pasta.');
  if (!['auto', 'lossless', 'raster'].includes(options.pdfMode)) {
    throw new Error('--pdf-mode deve ser auto, lossless ou raster.');
  }
  options.maxHeight = options.maxWidth;
  return { inputs, options };
}

function collectFiles(inputs) {
  const files = [];

  for (const input of inputs) {
    const absolute = path.resolve(input);
    const stat = fs.statSync(absolute);

    if (stat.isFile()) {
      files.push(absolute);
      continue;
    }

    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        const child = path.join(absolute, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles([child]));
        else if (entry.isFile()) files.push(child);
      }
      continue;
    }

    throw new Error(`Caminho invalido: ${input}`);
  }

  return files;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressImageFile(file, options) {
  const outputDir = path.resolve(options.out);
  await fs.promises.mkdir(outputDir, { recursive: true });

  const base = path.basename(file, path.extname(file));
  const output = path.join(outputDir, `${base}.webp`);

  const info = await sharp(file)
    .rotate()
    .resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: options.quality })
    .toFile(output);

  return {
    file,
    output,
    before: fs.statSync(file).size,
    after: info.size,
    method: 'imagem/webp',
  };
}

async function saveLosslessPdf(file, outputDir) {
  const bytes = await fs.promises.readFile(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const saved = await doc.save({ useObjectStreams: true });

  const output = path.join(outputDir, `${path.basename(file, path.extname(file))}.pdf`);
  await fs.promises.writeFile(output, saved);

  return { output, size: saved.length, before: bytes.length };
}

async function rasterizePdf(file, outputDir, options) {
  const { createCanvas, DOMMatrix, ImageData, Path2D } = require('@napi-rs/canvas');
  global.DOMMatrix = DOMMatrix;
  global.ImageData = ImageData;
  global.Path2D = Path2D;

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await fs.promises.readFile(file));
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  if (pdf.numPages > options.maxPages) {
    throw new Error(`PDF tem ${pdf.numPages} paginas (limite ${options.maxPages}); usando modo lossless.`);
  }

  const outputDoc = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: options.scale });

    const canvas = createCanvas(
      Math.max(1, Math.floor(viewport.width)),
      Math.max(1, Math.floor(viewport.height))
    );
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const jpeg = await canvas.encode('jpeg', options.quality);
    const image = await outputDoc.embedJpg(jpeg);
    const outputPage = outputDoc.addPage([base.width, base.height]);
    outputPage.drawImage(image, {
      x: 0,
      y: 0,
      width: base.width,
      height: base.height,
    });

    page.cleanup();
  }

  const saved = await outputDoc.save({ useObjectStreams: true });
  const output = path.join(outputDir, `${path.basename(file, path.extname(file))}.pdf`);
  await fs.promises.writeFile(output, saved);

  return { output, size: saved.length, before: fs.statSync(file).size };
}

async function compressPdfFile(file, options) {
  const outputDir = path.resolve(options.out);
  await fs.promises.mkdir(outputDir, { recursive: true });

  const originalSize = fs.statSync(file).size;
  let best = { output: file, size: originalSize, method: 'original' };

  if (options.pdfMode !== 'raster') {
    try {
      const lossless = await saveLosslessPdf(file, outputDir);
      if (lossless.size < best.size) {
        best = { ...lossless, method: 'pdf/lossless' };
      }
    } catch (err) {
      console.warn(`  lossless falhou: ${err.message}`);
    }
  }

  const losslessSaving = 1 - best.size / originalSize;
  const shouldRaster =
    options.pdfMode === 'raster' ||
    (options.pdfMode === 'auto' && losslessSaving < 0.15);

  if (shouldRaster) {
    try {
      const raster = await rasterizePdf(file, outputDir, options);
      if (raster.size < best.size) {
        best = { ...raster, method: 'pdf/raster' };
      }
    } catch (err) {
      console.warn(`  raster falhou: ${err.message}`);
    }
  }

  return {
    file,
    output: best.output,
    before: originalSize,
    after: best.size,
    method: best.method,
  };
}

async function main() {
  const { inputs, options } = parseArgs(process.argv.slice(2));
  const files = collectFiles(inputs);
  const results = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    try {
      if (IMAGE_EXTENSIONS.has(ext)) {
        results.push(await compressImageFile(file, options));
      } else if (PDF_EXTENSIONS.has(ext)) {
        results.push(await compressPdfFile(file, options));
      } else {
        console.log(`- ignorado (formato nao suportado): ${file}`);
      }
    } catch (err) {
      console.error(`- erro em ${file}: ${err.message}`);
    }
  }

  console.log('\nResultado:');
  let totalBefore = 0;
  let totalAfter = 0;

  for (const result of results) {
    totalBefore += result.before;
    totalAfter += result.after;
    const pct = result.before ? Math.round((1 - result.after / result.before) * 100) : 0;
    console.log(
      `  ${path.basename(result.file)}: ${formatBytes(result.before)} -> ${formatBytes(result.after)} (${pct}%) [${result.method}]`
    );
    console.log(`    saida: ${result.output}`);
  }

  if (results.length) {
    const pct = totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;
    console.log(
      `\nTotal: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)} (${pct}% de reducao)`
    );
  }
}

main().catch((err) => {
  console.error('Falha:', err.message);
  process.exit(1);
});
