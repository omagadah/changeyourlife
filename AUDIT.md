# Audit changeyourlife.ai

> **Dernière MAJ :** 2026-07-07 (audit total — sécurité + architecture + UX, session Cowork)
> **Branche :** `main` (synchro origin + prod Vercel au moment de l'audit, dernier commit 2026-06-08)
> **Type :** complet — 3 audits parallèles (sécurité / code-architecture / UX anti-IA)
> **Plan d'action détaillé :** [PLAN-PRODUCTION.md](PLAN-PRODUCTION.md)

---

## 1 · Verdict global

Le socle sécurité API est sérieux, mais un mois de dev intensif (juin) a ouvert des trous
jamais audités. **1 faille critique trouvée et corrigée ce jour.** Les vrais bloquants
production ne sont pas la sécurité : fiabilité des écritures, modèle de données, CSP
accueil, légal.

| Axe | Note | Évolution |
|---|:---:|---|
| Architecture | **B** | ↘ — mono-document users/{uid} plafonnera à 1 Mo ; 3,5 Mo de fichiers morts ; web/ fantôme |
| Sécurité | **B+ → A−** | ↘ puis fix — /api/translate était ouvert (corrigé 07/07) ; token GCal en localStorage ; App Check absent |
| Qualité code | **B** | ↘ — 17 toasts locaux, 10 escapeHtml, 1128 hex hardcodés, Lya/SYL en double |
| Fiabilité | **C** | nouveau — écritures Firestore perdues en silence (gratitude, organizer, plan, skills) |
| UX « humain »  | **C+** | nouveau — ~700 emojis décoratifs + palette Tailwind = signature IA ; landing organique excellente |
| Légal | **F** | nouveau — aucune CGU / mentions / confidentialité / consentement SYL |

## 2 · Corrigé ce jour (2026-07-07)

- **CRITIQUE** `api/translate.js` : public, sans auth ni rate-limit → quota Groq/Gemini
  vidable par n'importe qui. → rate-limit 4/min/IP + plafond global 400/j (Firestore
  `translateRate`, fail-closed) + contrôle d'origine.
- `api/chat.js` / `api/coach.js` / `api/translate.js` : fuites `details`/`status` provider
  supprimées des réponses d'erreur.
- `vercel.json` : `X-XSS-Protection: 1; mode=block` (obsolète, contre-indiqué) → `0`.
- `firestore.rules` : deny explicite `chatRate` + `translateRate`.
- `LICENSE` : source visible, tous droits réservés (transparence sans droit de copie).

## 3 · Findings ouverts — voir PLAN-PRODUCTION.md pour le détail

### P0 (bloquant prod)
1. CSP casse 3 scripts inline accueil → failsafe `tree-ready` mort (accueil noir si module KO).
2. Écritures Firestore silencieusement perdues (gratitude:203, organizer:74, plan, skills) + zéro gestion offline.
3. Modèle mono-document `users/{uid}` (goals, habits, organizer, meditation.history non borné, avatar data-URL) → plafond 1 Mo.
4. Légal absent (CGU, mentions, confidentialité, consentement SYL) — produit bien-être mental + IA + tiers US.
5. Deploy Firebase en retard depuis mai : les rules du repo ≠ rules en prod. **À faire en premier.**

### P1
Token GCal en localStorage (scopes écriture) · CSP à durcir (CDN, SRI) · App Check absent ·
ROOT_ADMIN_UID à retirer · XP client-side (dette documentée, OK sans leaderboard) ·
ipwho.is sans consentement · unifier Lya/SYL (3 stacks IA concurrentes) · purger ~3,5 Mo
de fichiers morts (⚠ retirer du précache SW AVANT suppression, `addAll` atomique) ·
trancher `web/` (2,7 Mo Next.js non documenté) · factoriser toast/escapeHtml · minifier
ez-tree (3,9 Mo) · MAJ CLAUDE.md/ROADMAP (16→32 pages, 3→5 API).

### P2 (chantier « ne pas sentir l'IA »)
Généraliser la palette organique de la landing (forêt/or) via main.min.css · purger 769 hex
inline (Tailwind défaut) · zéro emoji décoratif (~700, tous les h1/CTA/toasts) → SVG trait
fin · typo distinctive auto-hébergée (aucune fonte chargée aujourd'hui) · ton : tutoiement
partout, une langue par écran, réécrire titres clichés (« meilleure version de toi-même ») ·
migration /yourlife/ → arbre.

## 4 · Points forts confirmés

- Aucun secret dans le code NI dans l'historique git (scan complet patterns clés : 0 résultat).
- `chat.js`/`coach.js` : verifyIdToken + email_verified, rate-limit fail-closed, CORS strict,
  troncature input, prompt SYL non-directif avec cadre éthique.
- `verify-code.js`/`send-verification.js` : OTP `crypto.randomInt`, 5 essais, expiration 15 min.
- `firestore.rules` : deny-all par défaut, ownership strict, bornes journal/codex/bilan/gratitude.
- SW network-first sain (cache same-origin 200 uniquement), `CACHE_NAME` v147 à jour.
- Aucun eval/new Function ; Math.random cosmétique uniquement.
- Identité landing (arbre 3D, plaque Pioneer, satellite vie privée, hero copy) : différenciante, à préserver.

## 5 · Stats du repo (réel au 2026-07-07)

| Métrique | Valeur |
|---|---|
| Pages HTML | 32 (doc en disait 16-20) |
| Fichiers JS `public/js/` | 52 (doc en disait 26) |
| API serverless | 5 (`coach`, `chat`, `translate`, `send-verification`, `verify-code`) |
| Cloud Functions | 3 (`addXp`, `setUserRole`, `getMyRole`) |
| Poids `public/` | 12 Mo (dont ~3,5 Mo morts, ez-tree 3,9 Mo non minifié) |
| Emojis frontend | ~700 |
| Couleurs hex hardcodées hors CSS | 1 128 (769 dans les `<style>` des HTML) |
| Implémentations locales de toast | 17 · copies d'`escapeHtml` : 10 |

## Méthode

Audit du 2026-07-07 : 3 agents parallèles (sécurité — 34 lectures/greps dont historique git
complet ; code-architecture — inventaire exhaustif + graphe d'imports ; UX anti-IA — 32 pages
lues). Correctifs sécurité appliqués en session. Plan d'action → PLAN-PRODUCTION.md.
