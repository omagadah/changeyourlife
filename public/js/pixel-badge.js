// /js/pixel-badge.js - Génère un BADGE PIXEL-ART (sceau) à partir d'une image
// (avatar / photo de profil). Sous-échantillonne l'image en petite grille puis
// la ré-affiche en gros, sans lissage -> rendu pixel-art net. Cadre lumineux.

export function mountPixelBadge(container, opts = {}) {
  if (!container || !opts.imageUrl) return { destroy() {} };
  const size = opts.size || 84;      // taille visible (px)
  const px = opts.px || 20;          // résolution pixel-art (px x px)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
  canvas.style.cssText = `width:${size}px;height:${size}px;display:block;image-rendering:pixelated;border-radius:50%;`;
  container.innerHTML = '';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const levels = opts.levels || 5;   // paliers par canal (palette rétro)
  const sat = opts.sat || 1.3;       // boost saturation
  const contrast = opts.contrast || 1.12;

  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas'); off.width = px; off.height = px;
    const o = off.getContext('2d'); o.imageSmoothingEnabled = true;
    const s = Math.max(px / img.width, px / img.height);
    const dw = img.width * s, dh = img.height * s;
    o.drawImage(img, (px - dw) / 2, (px - dh) / 2, dw, dh);

    // Quantification palette + saturation/contraste -> vrai look pixel-art rétro.
    try {
      const id = o.getImageData(0, 0, px, px);
      const d = id.data;
      const q = (v) => Math.round(v / 255 * (levels - 1)) / (levels - 1) * 255;
      const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const avg = (r + g + b) / 3;                 // saturation autour du gris moyen
        r = avg + (r - avg) * sat; g = avg + (g - avg) * sat; b = avg + (b - avg) * sat;
        r = (r - 128) * contrast + 128;              // contraste autour de 128
        g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128;
        d[i] = q(cl(r)); d[i + 1] = q(cl(g)); d[i + 2] = q(cl(b));
      }
      o.putImageData(id, 0, 0);
    } catch (_) { /* image tainted -> on garde le downscale brut */ }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  };
  img.onerror = () => {};
  img.src = opts.imageUrl;

  return { destroy() { if (container.contains(canvas)) container.removeChild(canvas); } };
}
