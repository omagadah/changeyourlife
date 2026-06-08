// /js/particle-avatar.js - Rend une image (avatar / photo de profil) sous forme
// de NUAGE DE PARTICULES animé (2D canvas, léger). Les particules se rassemblent
// pour former l'image, et se dispersent au passage de la souris puis reviennent.
// Source = data URL (avatar généré ou photo uploadée) -> canvas propre (pas de CORS).

export function mountParticleAvatar(container, opts = {}) {
  if (!container || !opts.imageUrl) return { destroy() {} };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = opts.w || container.clientWidth || 112;
  const H = opts.h || container.clientHeight || W;
  const round = opts.round !== false;       // true -> masque circulaire (avatar)
  const fit = opts.fit || 'cover';          // 'cover' | 'height'
  const step = opts.step || 3;              // densité (px entre particules)
  const dot = opts.dot || 1.7;
  const repel = opts.repel || 26;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.cssText = `width:${W}px;height:${H}px;display:block;`;
  container.innerHTML = '';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);

  let particles = [], raf = 0;
  const mouse = { x: -999, y: -999 };

  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d');
    let s, dw, dh;
    if (fit === 'height') { s = H / img.height; dw = img.width * s; dh = H; }
    else { s = Math.max(W / img.width, H / img.height); dw = img.width * s; dh = img.height * s; }
    o.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    let data;
    try { data = o.getImageData(0, 0, W, H).data; }
    catch (e) {  // image tainted -> repli image simple
      container.innerHTML = '';
      const im = document.createElement('img');
      im.src = img.src; im.style.cssText = `width:${W}px;height:${H}px;object-fit:cover;${round ? 'border-radius:50%;' : ''}`;
      container.appendChild(im); return;
    }
    const cx = W / 2, cy = H / 2, rad = Math.min(W, H) / 2 - 1;
    particles = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4;
        if (data[i + 3] < 60) continue;
        if (round && Math.hypot(x - cx, y - cy) > rad) continue;
        particles.push({ x: Math.random() * W, y: Math.random() * H, tx: x, ty: y,
          r: data[i], g: data[i + 1], b: data[i + 2], vx: 0, vy: 0 });
      }
    }
    if (!raf) loop();
  };
  img.onerror = () => {};
  img.src = opts.imageUrl;

  canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });

  function loop() {
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      p.vx += (p.tx - p.x) * 0.06; p.vy += (p.ty - p.y) * 0.06;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < repel * repel) { const d = Math.sqrt(d2) || 1; const f = (repel - d) / repel * 4; p.vx += dx / d * f; p.vy += dy / d * f; }
      p.vx *= 0.86; p.vy *= 0.86; p.x += p.vx; p.y += p.vy;
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fillRect(p.x, p.y, dot, dot);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  return { destroy() { cancelAnimationFrame(raf); raf = 0; if (container.contains(canvas)) container.removeChild(canvas); } };
}
