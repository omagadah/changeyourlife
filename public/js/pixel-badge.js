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

  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas'); off.width = px; off.height = px;
    const o = off.getContext('2d'); o.imageSmoothingEnabled = true;
    const s = Math.max(px / img.width, px / img.height);
    const dw = img.width * s, dh = img.height * s;
    o.drawImage(img, (px - dw) / 2, (px - dh) / 2, dw, dh);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  };
  img.onerror = () => {};
  img.src = opts.imageUrl;

  return { destroy() { if (container.contains(canvas)) container.removeChild(canvas); } };
}
