(function (global) {
  'use strict';

  /**
   * Compressão client-side para economizar Storage Supabase (1GB).
   * - Redimensiona para maxWidth/maxHeight (1280px padrão)
   * - Converte para WebP (fallback JPEG) com quality 0.72
   * - Reduz ~70-85% vs foto original 3-5MB -> 250-500KB
   */
  const DEFAULTS = {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.72,
    mimeType: 'image/webp',
    maxSizeMB: 0.6
  };

  function canCompress(file) {
    return file && file.type.startsWith('image/');
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
        else reject(new Error('Falha na compressão'));
      }, mimeType, quality);
    });
  }

  async function compressImage(file, opts = {}) {
    const cfg = { ...DEFAULTS, ...opts };
    if (!canCompress(file)) return file;
    // PDFs e docs não-imagem retornam original
    if (file.type === 'application/pdf') return file;
    // Se já é pequeno e não precisa redimensionar, tenta leve compressão mesmo assim
    if (file.size < 350 * 1024 && file.type === cfg.mimeType) return file;

    const img = await loadImage(file);
    let { width, height } = img;
    const ratio = Math.min(cfg.maxWidth / width, cfg.maxHeight / height, 1);
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Tenta WebP, se não suportado cai para JPEG
    let mime = cfg.mimeType;
    let blob = await canvasToBlob(canvas, mime, cfg.quality).catch(() => null);
    if (!blob || blob.size === 0) {
      mime = 'image/jpeg';
      blob = await canvasToBlob(canvas, mime, cfg.quality);
    }

    // Se ainda maior que maxSizeMB, tenta segunda passada com qualidade menor
    if (blob.size > cfg.maxSizeMB * 1024 * 1024) {
      const blob2 = await canvasToBlob(canvas, mime, 0.55).catch(() => blob);
      if (blob2 && blob2.size < blob.size) blob = blob2;
    }

    // Preserva nome mas troca extensão
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // Helper para input file -> preview + texto de economia
  async function compressAndPreview(file, previewEl, infoEl, opts) {
    const originalSize = file.size;
    const compressed = await compressImage(file, opts);
    if (previewEl) {
      const url = URL.createObjectURL(compressed);
      if (previewEl.tagName === 'IMG') previewEl.src = url;
      else previewEl.style.backgroundImage = `url(${url})`;
    }
    if (infoEl) {
      const saved = originalSize - compressed.size;
      const pct = originalSize ? Math.round((saved / originalSize) * 100) : 0;
      infoEl.textContent = `${formatBytes(originalSize)} → ${formatBytes(compressed.size)} (${pct}% redução)`;
      infoEl.style.color = compressed.size < originalSize ? 'var(--color-success)' : 'var(--color-text-muted)';
    }
    return compressed;
  }

  global.BiofirmCompress = {
    compressImage,
    compressAndPreview,
    formatBytes,
    DEFAULTS
  };
})(window);
