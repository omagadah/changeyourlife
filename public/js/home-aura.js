// home-aura.js — Fond shader végétal animé (dappled light) de l'accueil.
// Extrait d'un <script> inline de index.html (bloqué par la CSP script-src 'self').
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var cv = document.getElementById('aura-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize); resize();
  var blobs = [
    { x: .22, y: .30, r: .42, c: [132, 194, 94], s: 0.55, a: 0.10, px: 0.013, py: 0.009 },
    { x: .74, y: .22, r: .36, c: [231, 177, 92], s: 0.40, a: 0.11, px: 0.010, py: 0.012 },
    { x: .55, y: .68, r: .50, c: [110, 154, 82], s: 0.30, a: 0.08, px: 0.008, py: 0.010 },
    { x: .85, y: .60, r: .30, c: [241, 205, 146], s: 0.62, a: 0.07, px: 0.014, py: 0.007 }
  ];
  var t = 0;
  function frame() {
    t += 0.005;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var cx = (b.x + Math.sin(t * b.s + i) * b.px) * w;
      var cy = (b.y + Math.cos(t * b.s * 0.8 + i * 1.7) * b.py) * h;
      var rad = b.r * Math.max(w, h) * (0.92 + 0.08 * Math.sin(t * b.s + i));
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      var col = b.c.join(',');
      g.addColorStop(0, 'rgba(' + col + ',' + b.a + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
