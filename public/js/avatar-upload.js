// public/js/avatar-upload.js - v1
// Habillage « upload animé » de la zone d'avatar (/profile).
// N'AJOUTE que du visuel : drag & drop + barre de progression + vignette de
// preview. Le vrai traitement (downscale + sauvegarde) reste géré par profile.js
// via l'événement `change` de #avatar-file-input, qu'on redéclenche au drop.

function boot() {
  const drop = document.getElementById('avatar-drop');
  const input = document.getElementById('avatar-file-input');
  const bar = document.getElementById('avatar-drop-progress');
  const preview = document.getElementById('avatar-drop-preview');
  if (!drop || !input) return;

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach(ev =>
    drop.addEventListener(ev, (e) => { stop(e); drop.classList.add('dragover'); }));
  ['dragleave', 'dragend'].forEach(ev =>
    drop.addEventListener(ev, (e) => { stop(e); drop.classList.remove('dragover'); }));

  drop.addEventListener('drop', (e) => {
    stop(e);
    drop.classList.remove('dragover');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    // Injecte le fichier dans l'input puis redéclenche `change` → profile.js gère.
    try {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {
      // DataTransfer indisponible (rare) : on anime au moins le retour visuel.
      animate(files[0]);
    }
  });

  // ── Animation à la sélection (clic OU drop) ──────────────────────────────
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) animate(file);
  });

  function animate(file) {
    // Preview immédiate
    try {
      const reader = new FileReader();
      reader.onload = (ev) => { if (preview) preview.src = ev.target.result; };
      reader.readAsDataURL(file);
    } catch (_) {}

    // Barre de progression (feedback ~700 ms, purement visuel)
    drop.classList.remove('done');
    drop.classList.add('uploading');
    if (bar) bar.style.width = '0%';
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(100, pct + 8 + Math.floor(pct / 12));
      if (bar) bar.style.width = pct + '%';
      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          drop.classList.remove('uploading');
          drop.classList.add('done');
          if (bar) bar.style.width = '0%';
        }, 150);
      }
    }, 55);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

export default {};
