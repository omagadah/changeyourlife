// /js/frise-map.js - La carte mentale de la frise (vue « Carte »).
//
// Reprend le principe de XMind : un arbre qui se deploie vers la droite, dont
// chaque noeud se cree, se renomme, se deplace et se relie. L'owner avait deja
// construit son audit de vie dans XMind ; cette vue le ramene DANS le site,
// pour que la carte et les donnees soient enfin le meme objet.
//
// Pourquoi ecrit a la main plutot qu'une librairie de mindmap :
// la CSP du site interdit les scripts externes (script-src 'self', pas de CDN)
// et le projet n'a pas de build step pour empaqueter un module npm. Le rendu
// tient de toute facon en un layout d'arbre + des courbes de Bezier.
//
// Rendu : les noeuds sont des elements HTML (texte natif, selectionnable,
// accessible, editable) poses en absolu ; les liens sont un SVG DERRIERE eux.
// Un seul conteneur porte le pan et le zoom, donc les deux restent alignes.

import { ROOT_ID, FULL_MSG, ERA_BY_KEY, PILLAR_BY_KEY, childrenOf, addNode, removeNode, reparent, toggleLink, eraOf } from '/js/frise-data.js';

const GAP_X = 46;    // espace horizontal entre deux niveaux
const GAP_Y = 10;    // espace vertical entre deux voisins
const W = [210, 168, 156, 150];  // largeur de noeud par profondeur

export function createMap(host, map, { onChange, onSelect } = {}) {
  host.innerHTML = '';
  host.classList.add('fm-stage');

  const world = document.createElement('div');
  world.className = 'fm-world';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fm-links');
  world.appendChild(svg);
  host.appendChild(world);

  const els = new Map();          // id -> element du noeud
  const box = new Map();          // id -> { x, y, w, h }
  let selected = null;
  let linkMode = false;
  let linkFrom = null;
  let cam = map.cam;

  // ── Camera ────────────────────────────────────────────────────────────────
  function applyCam() {
    world.style.transform = 'translate(' + cam.x + 'px,' + cam.y + 'px) scale(' + cam.z + ')';
  }

  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = host.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const z = Math.min(2.2, Math.max(0.35, cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    // On zoome SUR LE CURSEUR : le point sous la souris ne doit pas bouger.
    cam.x = mx - (mx - cam.x) * (z / cam.z);
    cam.y = my - (my - cam.y) * (z / cam.z);
    cam.z = z;
    applyCam();
  }, { passive: false });

  let pan = null;
  host.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.fm-node')) return;   // le noeud gere son propre geste
    pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
    host.setPointerCapture(e.pointerId);
    host.classList.add('grabbing');
    select(null);
  });
  host.addEventListener('pointermove', (e) => {
    if (!pan) return;
    cam.x = pan.cx + (e.clientX - pan.x);
    cam.y = pan.cy + (e.clientY - pan.y);
    applyCam();
  });
  const endPan = () => { if (pan) { pan = null; host.classList.remove('grabbing'); } };
  host.addEventListener('pointerup', endPan);
  host.addEventListener('pointercancel', endPan);

  // ── Construction des noeuds ───────────────────────────────────────────────
  function visible() {
    const out = [];
    const walk = (id, depth) => {
      const n = map.nodes[id];
      if (!n) return;
      out.push({ n, depth });
      if (n.collapsed) return;
      for (const c of childrenOf(map, id)) walk(c.id, depth + 1);
    };
    walk(ROOT_ID, 0);
    return out;
  }

  function nodeEl(n, depth) {
    let el = els.get(n.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'fm-node';
      el.dataset.id = n.id;
      el.tabIndex = 0;
      world.appendChild(el);
      els.set(n.id, el);
      wire(el, n.id);
    }
    const kids = childrenOf(map, n.id).length;
    const era = eraOf(map, n);
    const pil = n.pillar ? PILLAR_BY_KEY[n.pillar] : null;
    const accent = n.urgent ? '#e0785f' : (pil ? pil.color : (era ? ERA_BY_KEY[era].color : '#84c25e'));

    el.className = 'fm-node d' + Math.min(depth, 3) + (n.id === selected ? ' sel' : '')
      + (linkFrom === n.id ? ' linking' : '') + (n.kind === 'root' ? ' root' : '');
    el.style.width = W[Math.min(depth, W.length - 1)] + 'px';
    el.style.setProperty('--ac', accent);

    // textContent partout : un libelle est du texte saisi par l'utilisateur, il
    // ne doit jamais etre interprete comme du HTML.
    el.replaceChildren();
    const t = document.createElement('div');
    t.className = 'fm-t';
    t.textContent = n.label || '(sans titre)';
    el.appendChild(t);

    if (n.note.trim()) {
      const s = document.createElement('div');
      s.className = 'fm-s';
      s.textContent = n.note.trim().split(/\r?\n/)[0].slice(0, 90);
      el.appendChild(s);
    } else if (n.hint && depth >= 2) {
      const s = document.createElement('div');
      s.className = 'fm-s hint';
      s.textContent = n.hint;
      el.appendChild(s);
    }

    const meta = document.createElement('div');
    meta.className = 'fm-meta';
    if (n.date) {
      const d = document.createElement('span');
      d.className = 'fm-date';
      d.textContent = new Date(n.date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      meta.appendChild(d);
    }
    if (kids) {
      const b = document.createElement('button');
      b.className = 'fm-fold';
      b.type = 'button';
      b.dataset.fold = n.id;
      b.textContent = n.collapsed ? '+' + kids : '−';
      b.title = n.collapsed ? 'Déplier' : 'Replier';
      b.setAttribute('aria-label', b.title);
      meta.appendChild(b);
    }
    if (meta.childNodes.length) el.appendChild(meta);

    const add = document.createElement('button');
    add.className = 'fm-add';
    add.type = 'button';
    add.dataset.add = n.id;
    add.textContent = '+';
    add.title = 'Ajouter dessous';
    add.setAttribute('aria-label', 'Ajouter un élément sous ' + (n.label || 'ce nœud'));
    el.appendChild(add);
    return el;
  }

  // ── Layout : arbre horizontal ─────────────────────────────────────────────
  // Chaque feuille prend sa hauteur ; chaque parent se centre sur ses enfants.
  // Les hauteurs sont MESUREES apres rendu, sinon un libelle qui passe sur
  // trois lignes chevauche son voisin.
  function layout(list) {
    const depthX = [];
    let x = 0;
    for (let d = 0; d < 8; d++) { depthX[d] = x; x += W[Math.min(d, W.length - 1)] + GAP_X; }

    const byId = new Map(list.map((v) => [v.n.id, v]));
    let cursor = 0;
    const place = (id, depth) => {
      const v = byId.get(id);
      if (!v) return 0;
      const el = els.get(id);
      const h = el ? el.offsetHeight : 40;
      const kids = map.nodes[id].collapsed ? [] : childrenOf(map, id).filter((c) => byId.has(c.id));
      let y;
      if (!kids.length) {
        y = cursor;
        cursor += h + GAP_Y;
      } else {
        kids.forEach((c) => place(c.id, depth + 1));
        const fb = box.get(kids[0].id), lb = box.get(kids[kids.length - 1].id);
        const c1 = fb.y + fb.h / 2, c2 = lb.y + lb.h / 2;
        y = (c1 + c2) / 2 - h / 2;
        // Un parent plus haut que la travee de ses enfants deborderait vers le
        // haut : on repousse le curseur pour garder la place.
        const need = y + h + GAP_Y;
        if (need > cursor) cursor = need;
      }
      box.set(id, { x: depthX[depth], y, w: W[Math.min(depth, W.length - 1)], h });
      return y;
    };
    place(ROOT_ID, 0);

    // Recadrage : tout ce qui est negatif repasse dans le positif, sinon le SVG
    // et les noeuds sortiraient du conteneur par le haut.
    let minY = Infinity, maxY = -Infinity, maxX = 0;
    for (const b of box.values()) { minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h); maxX = Math.max(maxX, b.x + b.w); }
    const off = 24 - (Number.isFinite(minY) ? minY : 0);
    for (const b of box.values()) b.y += off;

    for (const [id, b] of box) {
      const el = els.get(id);
      if (el) { el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; }
    }
    const H = (Number.isFinite(maxY) ? maxY - minY : 0) + 48;
    world.style.width = (maxX + 40) + 'px';
    world.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + (maxX + 40) + ' ' + H);
    svg.setAttribute('width', maxX + 40);
    svg.setAttribute('height', H);
  }

  function drawLinks() {
    svg.replaceChildren();
    const mk = (d, cls, color) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', cls);
      if (color) p.setAttribute('stroke', color);
      svg.appendChild(p);
      return p;
    };
    // Hierarchie : une courbe qui sort a droite du parent et entre a gauche
    // de l'enfant.
    for (const [id, b] of box) {
      const n = map.nodes[id];
      if (!n || !n.parent) continue;
      const pb = box.get(n.parent);
      if (!pb) continue;
      const x1 = pb.x + pb.w, y1 = pb.y + pb.h / 2;
      const x2 = b.x, y2 = b.y + b.h / 2;
      const mid = x1 + (x2 - x1) / 2;
      const era = eraOf(map, n);
      const col = n.pillar ? PILLAR_BY_KEY[n.pillar].color : (era ? ERA_BY_KEY[era].color : '#6f7a63');
      mk('M' + x1 + ',' + y1 + 'C' + mid + ',' + y1 + ' ' + mid + ',' + y2 + ' ' + x2 + ',' + y2, 'fm-edge', col);
    }
    // Liens libres : ce que l'utilisateur relie lui-meme, par-dessus la
    // hierarchie. Pointilles, pour qu'on ne les confonde pas avec l'arbre.
    for (const l of map.links) {
      const a = box.get(l.from), c = box.get(l.to);
      if (!a || !c) continue;
      const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2;
      const x2 = c.x + c.w / 2, y2 = c.y + c.h / 2;
      const dx = Math.abs(x2 - x1) * 0.3 + 30;
      mk('M' + x1 + ',' + y1 + 'C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2, 'fm-free');
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  function render() {
    const list = visible();
    const keep = new Set(list.map((v) => v.n.id));
    for (const [id, el] of els) if (!keep.has(id)) { el.remove(); els.delete(id); box.delete(id); }
    for (const { n, depth } of list) nodeEl(n, depth);
    box.clear();
    layout(list);
    drawLinks();
  }

  // ── Interactions ──────────────────────────────────────────────────────────
  function select(id) {
    if (selected === id) { if (onSelect) onSelect(id ? map.nodes[id] : null); return; }
    const old = els.get(selected);
    if (old) old.classList.remove('sel');
    selected = id;
    const el = els.get(id);
    if (el) { el.classList.add('sel'); el.focus({ preventScroll: true }); }
    if (onSelect) onSelect(id ? map.nodes[id] : null);
  }

  // Toute modification passe par ici : on sauvegarde, puis on relayoute -
  // un noeud renomme ou replie change la place de tous ses voisins.
  function commit() {
    if (onChange) onChange();
    render();
  }

  function wire(el, id) {
    let press = null;

    el.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button');
      if (btn) return;
      e.stopPropagation();
      select(id);
      if (linkMode) return;
      press = { x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId };
    });

    el.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
        press.moved = true;
        el.classList.add('dragging');
        el.setPointerCapture(press.pid);
      }
      if (!press.moved) return;
      // La cible est cherchee SOUS le pointeur, en masquant le noeud tire :
      // sinon il se trouve lui-meme a chaque mouvement.
      el.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      el.style.pointerEvents = '';
      const tgt = under && under.closest ? under.closest('.fm-node') : null;
      for (const o of els.values()) o.classList.remove('drop');
      if (tgt && tgt !== el) tgt.classList.add('drop');
    });

    const release = (e) => {
      if (!press) return;
      const wasMoved = press.moved;
      press = null;
      el.classList.remove('dragging');
      if (!wasMoved) return;
      el.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      el.style.pointerEvents = '';
      const tgt = under && under.closest ? under.closest('.fm-node') : null;
      for (const o of els.values()) o.classList.remove('drop');
      if (tgt && tgt !== el && reparent(map, id, tgt.dataset.id)) commit();
      else render();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', () => { press = null; el.classList.remove('dragging'); });

    el.addEventListener('click', (e) => {
      const fold = e.target.closest('[data-fold]');
      if (fold) { e.stopPropagation(); map.nodes[id].collapsed = !map.nodes[id].collapsed; commit(); return; }
      const add = e.target.closest('[data-add]');
      if (add) { e.stopPropagation(); grow(id); return; }
      if (linkMode) {
        e.stopPropagation();
        if (!linkFrom) { linkFrom = id; render(); return; }
        if (linkFrom !== id) toggleLink(map, linkFrom, id);
        linkFrom = null;
        commit();
      }
    });

    el.addEventListener('dblclick', (e) => { e.stopPropagation(); edit(id); });

    el.addEventListener('keydown', (e) => {
      if (el.querySelector('.fm-t[contenteditable="true"]')) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const p = map.nodes[id].parent;
        if (p) grow(p);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        grow(id);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        askRemove(id);
      } else if (e.key === 'F2') {
        e.preventDefault(); edit(id);
      } else if (e.key === 'Escape') {
        select(null);
      }
    });
  }

  // Ajout d'un enfant, avec le refus rendu visible plutot que silencieux.
  function grow(parentId) {
    const n = addNode(map, parentId, 'Nouveau');
    if (!n) { alert(FULL_MSG); return; }
    commit();
    select(n.id);
    edit(n.id);
  }

  function askRemove(id) {
    if (id === ROOT_ID) return;
    const n = map.nodes[id];
    const kids = childrenOf(map, id).length;
    const msg = kids
      ? 'Supprimer « ' + n.label +' » et les ' + kids + ' élément(s) en dessous ?'
      : 'Supprimer « ' + n.label + ' » ?';
    if (!confirm(msg)) return;
    const parent = n.parent;
    removeNode(map, id);
    selected = null;
    commit();
    select(parent);
  }

  // Renommage sur place. contenteditable sur le seul titre, jamais sur la
  // carte entiere - et on relit avec textContent.
  function edit(id) {
    const el = els.get(id);
    if (!el) return;
    const t = el.querySelector('.fm-t');
    if (!t) return;
    t.contentEditable = 'true';
    t.spellcheck = false;
    t.focus();
    const r = document.createRange();
    r.selectNodeContents(t);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);

    const done = (keep) => {
      t.contentEditable = 'false';
      const v = t.textContent.trim().slice(0, 160);
      if (keep && v && v !== map.nodes[id].label) { map.nodes[id].label = v; commit(); }
      else render();
      const back = els.get(id);
      if (back) back.focus({ preventScroll: true });
    };
    t.addEventListener('blur', () => done(true), { once: true });
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); t.textContent = map.nodes[id].label; t.blur(); }
      e.stopPropagation();
    });
  }

  // ── Cadrage ───────────────────────────────────────────────────────────────
  function fit() {
    const w = world.offsetWidth || 1, h = world.offsetHeight || 1;
    const r = host.getBoundingClientRect();
    cam.z = Math.min(1, Math.max(0.35, Math.min((r.width - 32) / w, (r.height - 32) / h)));
    cam.x = 16;
    cam.y = Math.max(16, (r.height - h * cam.z) / 2);
    applyCam();
  }

  render();
  applyCam();

  return {
    render,
    fit,
    select,
    selected: () => selected,
    refreshSelected() { if (selected) { render(); } },
    setLinkMode(on) {
      linkMode = !!on;
      linkFrom = null;
      host.classList.toggle('link-mode', linkMode);
      render();
    },
    linkMode: () => linkMode,
    remove: askRemove,
    expandAll(open) {
      for (const n of Object.values(map.nodes)) n.collapsed = !open;
      commit();
    },
  };
}
