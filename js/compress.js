(function (global) {
  'use strict';

  /**
   * Compressao client-side antes do upload para o Neon Object Storage.
   * - Imagens: canvas -> WebP (fallback JPEG), maxWidth/maxHeight e qualidade
   * - PDFs: renderiza as paginas com pdf.js e remonta com jsPDF (modo auto)
   *   Se o resultado nao for menor, o arquivo original e mantido.
   */

  const DEFAULTS = {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.72,
    mimeType: 'image/webp',
    maxSizeMB: 0.6
  };

  const PDF_DEFAULTS = {
    scale: 1.5,
    quality: 0.72,
    maxPages: 30,
    minSizeBytes: 250 * 1024,
    minSaving: 0.05
  };

  const PDFJS_VERSION = '6.5.438';
  const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
  const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  let pdfjsPromise = null;

  function isImage(file) {
    return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
  }

  function isPdf(file) {
    return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
  }

  function loadPdfJs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS_URL).then((mod) => {
        const lib = mod.default || mod;
        if (lib.GlobalWorkerOptions) {
          lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        }
        return lib;
      });
    }
    return pdfjsPromise;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha na compressao'));
      }, mimeType, quality);
    });
  }

  async function compressImage(file, opts = {}) {
    const cfg = { ...DEFAULTS, ...opts };
    if (!isImage(file)) return file;
    if (file.size < 350 * 1024 && file.type === cfg.mimeType) return file;

    const img = await loadImage(file);
    const { width, height } = img;
    const ratio = Math.min(cfg.maxWidth / width, cfg.maxHeight / height, 1);
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    let mime = cfg.mimeType;
    let blob = await canvasToBlob(canvas, mime, cfg.quality).catch(() => null);
    if (!blob || blob.size === 0) {
      mime = 'image/jpeg';
      blob = await canvasToBlob(canvas, mime, cfg.quality);
    }

    if (blob.size > cfg.maxSizeMB * 1024 * 1024) {
      const blob2 = await canvasToBlob(canvas, mime, 0.55).catch(() => blob);
      if (blob2 && blob2.size < blob.size) blob = blob2;
    }

    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() });
  }

  async function compressPdf(file, opts = {}) {
    const cfg = { ...PDF_DEFAULTS, ...opts };
    if (!isPdf(file)) return file;
    if (file.size < cfg.minSizeBytes) return file;

    const jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) return file;

    let pdfjs;
    try {
      pdfjs = await loadPdfJs();
    } catch (err) {
      console.warn('pdf.js indisponivel; mantendo PDF original.', err);
      return file;
    }

    let pdf;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      pdf = await pdfjs.getDocument({ data }).promise;
    } catch (err) {
      console.warn('Nao foi possivel ler o PDF; mantendo original.', err);
      return file;
    }

    if (pdf.numPages > cfg.maxPages) {
      if (typeof cfg.onProgress === 'function') cfg.onProgress(100);
      return file;
    }

    let doc = null;

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const mmW = (base.width * 25.4) / 72;
        const mmH = (base.height * 25.4) / 72;
        const viewport = page.getViewport({ scale: cfg.scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const image = canvas.toDataURL('image/jpeg', cfg.quality);
        const orientation = mmW > mmH ? 'landscape' : 'portrait';

        if (!doc) {
          doc = new jsPDF({ unit: 'mm', format: [mmW, mmH], orientation, compress: true });
        } else {
          doc.addPage([mmW, mmH], orientation);
        }

        doc.addImage(image, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
        page.cleanup();

        if (typeof cfg.onProgress === 'function') {
          cfg.onProgress(Math.round((pageNumber / pdf.numPages) * 100));
        }
      }

      const blob = doc.output('blob');
      const saving = file.size ? 1 - blob.size / file.size : 0;

      if (!blob || blob.size === 0 || saving < cfg.minSaving) return file;

      const baseName = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}.pdf`, {
        type: 'application/pdf',
        lastModified: Date.now()
      });
    } catch (err) {
      console.warn('Falha ao compactar PDF; mantendo original.', err);
      return file;
    }
  }

  async function compressFile(file, opts = {}) {
    if (!file) return file;
    if (isPdf(file)) return compressPdf(file, opts.pdf || opts);
    if (isImage(file)) return compressImage(file, opts.image || opts);
    return file;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function reductionText(originalSize, compressedSize) {
    const saved = originalSize - compressedSize;
    const pct = originalSize ? Math.round((saved / originalSize) * 100) : 0;
    return `${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${pct}% redução)`;
  }

  // Helper para input file -> preview + texto de economia
  async function compressAndPreview(file, previewEl, infoEl, opts = {}) {
    const originalSize = file.size;
    const pdf = isPdf(file);

    if (infoEl) infoEl.textContent = pdf ? 'Compactando PDF...' : 'Comprimindo...';

    const compressed = await compressFile(file, {
      ...opts,
      onProgress: pdf
        ? (pct) => { if (infoEl) infoEl.textContent = `Compactando PDF... ${pct}%`; }
        : opts.onProgress
    });

    if (previewEl && isImage(compressed)) {
      const url = URL.createObjectURL(compressed);
      if (previewEl.tagName === 'IMG') previewEl.src = url;
      else previewEl.style.backgroundImage = `url(${url})`;
    }

    if (infoEl) {
      infoEl.textContent = reductionText(originalSize, compressed.size);
      infoEl.style.color = compressed.size < originalSize ? 'var(--color-success)' : 'var(--color-text-muted)';
    }

    return compressed;
  }

  global.BiofirmeCompress = {
    compressImage,
    compressPdf,
    compressFile,
    compressAndPreview,
    formatBytes,
    reductionText,
    isImage,
    isPdf,
    DEFAULTS,
    PDF_DEFAULTS
  };
})(window);
