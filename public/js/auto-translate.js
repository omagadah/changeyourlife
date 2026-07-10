// public/js/auto-translate.js - v1
// Traduction AUTOMATIQUE du DOM : le site est écrit en français ; quand
// l'utilisateur choisit une autre langue, on traduit tous les textes visibles
// (pas seulement ceux taggés data-i18n) via /api/translate, avec cache localStorage.
//
// Pourquoi : tagger manuellement des milliers d'éléments sur 16 modules est
// intenable. Ici on parcourt les nœuds texte, on traduit par lots (dans les
// limites de l'API), on met en cache par (langue, texte source), et on observe
// le DOM pour traduire aussi le contenu injecté dynamiquement par les modules.
//
// Robuste : ne casse jamais la page (échecs silencieux), saute les nombres, le
// code, les zones éditables, le sélecteur de langue et les éléments data-i18n.

const CACHE_VERSION = 1;
const MAX_ITEMS = 45;        // < 200 (limite API) ; petits lots = JSON IA fiable
const MAX_CHARS = 7000;      // < 24000 (limite API)
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'KBD', 'SAMP', 'CANVAS', 'SVG']);
const SKIP_SELECTOR = '[data-i18n],[data-i18n-html],[data-i18n-ph],[data-no-i18n],.notranslate,#lang-switch,.lang-list,.lang-opt,#cyl-lang-css';

const hasLetter = (s) => /[A-Za-zÀ-ÖØ-öø-ÿА-Яа-яΑ-Ωα-ω]/.test(s);

function cacheKey(lang) { return `cyl_autotr:${lang}`; }
function loadCache(lang) {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(lang)) || 'null');
    if (raw && raw.v === CACHE_VERSION && raw.m) return raw.m;
  } catch (_) {}
  return {};
}
function saveCache(lang, map) {
  try { localStorage.setItem(cacheKey(lang), JSON.stringify({ v: CACHE_VERSION, m: map })); } catch (_) {}
}

// Un nœud texte est traduisible s'il porte du vrai texte et n'est pas dans une
// zone à ignorer (code, sélecteur de langue, data-i18n, éditable…).
function nodeEligible(node) {
  const p = node.parentElement;
  if (!p) return false;
  if (SKIP_TAGS.has(p.tagName)) return false;
  if (p.closest(SKIP_SELECTOR)) return false;
  if (p.closest('[contenteditable=""],[contenteditable="true"],input')) return false;
  const raw = node.nodeValue;
  if (!raw) return false;
  const s = raw.trim();
  if (s.length < 2) return false;
  if (!hasLetter(s)) return false;               // nombres / symboles / emojis seuls
  if (/^[\d\s.,:%+\-–—/()€$£¥]+$/.test(s)) return false;
  return true;
}

export function autoTranslatePage(lang, targetName) {
  if (!lang || lang === 'fr') return;            // source = français
  const cache = loadCache(lang);
  const seen = new WeakSet();
  let pending = new Map();                        // src -> [nodes]
  let flushTimer = 0;
  let inFlight = false;

  function collect(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (nodeEligible(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const found = [];
    let n; while ((n = walker.nextNode())) found.push(n);
    for (const node of found) {
      if (seen.has(node)) continue;
      seen.add(node);
      const src = node.nodeValue;
      const key = src.trim();
      if (cache[key] != null) { applyToNode(node, src, cache[key]); continue; }
      if (!pending.has(key)) pending.set(key, []);
      pending.get(key).push({ node, src });
    }
    scheduleFlush();
  }

  // Réinjecte la traduction en conservant les espaces de début/fin d'origine.
  function applyToNode(node, src, translated) {
    if (translated == null || translated === '') return;
    const lead = (src.match(/^\s*/) || [''])[0];
    const trail = (src.match(/\s*$/) || [''])[0];
    node.nodeValue = lead + translated + trail;
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = 0; flush(); }, 250);
  }

  async function flush() {
    if (inFlight) { scheduleFlush(); return; }
    if (!pending.size) return;
    inFlight = true;
    // src (clé trim) -> liste de {node, src d'origine}
    const srcToNodes = pending;
    pending = new Map();

    // Découpe en lots sous les limites de l'API (nb d'items + total caractères).
    const srcs = Array.from(srcToNodes.keys());
    const batches = [];
    let cur = [], curChars = 0;
    for (const src of srcs) {
      if (cur.length >= MAX_ITEMS || curChars + src.length > MAX_CHARS) {
        if (cur.length) batches.push(cur);
        cur = []; curChars = 0;
      }
      cur.push(src); curChars += src.length;
    }
    if (cur.length) batches.push(cur);

    for (const batch of batches) {
      const items = {}; const idToSrc = {};
      batch.forEach((src, i) => { const id = 't' + i; items[id] = src; idToSrc[id] = src; });
      const translations = await translateBatch(lang, targetName, items);
      if (!translations) continue;
      let changed = false;
      for (const id in idToSrc) {
        const src = idToSrc[id];
        const tr = translations[id];
        if (tr == null || tr === '') continue;
        cache[src] = tr;                        // clé = texte source (déjà trim)
        changed = true;
        const nodes = srcToNodes.get(src) || [];
        for (const { node, src: nsrc } of nodes) applyToNode(node, nsrc, tr);
      }
      if (changed) saveCache(lang, cache);
    }
    inFlight = false;
    if (pending.size) scheduleFlush();
  }

  let rateWaitUntil = 0;
  async function translateBatch(lang, targetName, items) {
    if (!Object.keys(items).length) return null;
    // Respecte un éventuel back-off après un 429.
    const wait = rateWaitUntil - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: lang, targetName, items }),
        });
        if (r.status === 429) { rateWaitUntil = Date.now() + 16000; await new Promise((res) => setTimeout(res, 16000)); continue; }
        if (!r.ok) return null;
        const data = await r.json();
        return (data && data.translations) || null;
      } catch (_) { if (attempt === 1) return null; }
    }
    return null;
  }

  // ── Premier passage + observation du contenu injecté dynamiquement ─────────
  collect(document.body);

  try {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) collect(node);
          else if (node.nodeType === 3 && nodeEligible(node)) collect(node.parentElement || document.body);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}
}

export default { autoTranslatePage };
