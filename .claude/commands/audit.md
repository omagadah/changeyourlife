---
description: Audit complet du codebase — sécurité, anomalies, code mort, perf
---

Tu vas faire un audit profond du codebase changeyourlife.ai et mettre à jour le fichier `AUDIT.md` à la racine avec les findings actuels.

**Contexte** : lis CLAUDE.md à la racine pour la structure, puis le dernier fichier dans `docs/sessions/` pour savoir ce qui a déjà été fait.

**Périmètre de l'audit** :

1. **Sécurité**
   - Patterns dangereux : `eval`, `new Function`, `document.write`, `innerHTML` sur input user
   - Secrets en clair (hors apiKey Firebase web qui est public par design)
   - URL externes suspectes (exfiltration, C2)
   - `npm audit` dans `/`, `/functions/`, `/api/`
   - CSP `vercel.json` — failles ?

2. **Code quality**
   - Code mort, lignes orphelines, blocs unreachable
   - Imports inutilisés
   - CSS classes définies mais non utilisées
   - Doublons (.js vs .min.js désynchronisés)

3. **Cohérence repo**
   - Fichiers obsolètes ?
   - Pages orphelines (pas dans sitemap ni service worker) ?
   - Dépendances inutilisées dans `package.json` ?

4. **PWA / perf**
   - Service worker à jour ?
   - Manifest icônes existantes ?
   - Toutes les pages chargent `/css/main.min.css` ?

5. **Firebase**
   - `firestore.rules` — collections sans règles ?
   - `firestore.indexes.json` — JSON valide ?

**Output** :
- Mets à jour `AUDIT.md` avec sections : Critique / Important / Mineur / Curiosités / Stats
- Référence précise : `fichier:ligne`, jamais vague
- Si rien trouvé dans une section, l'écrire explicitement
- Si tu trouves quelque chose qui mérite un fix immédiat, propose-le mais ne fixe pas avant validation utilisateur

Sois READ-ONLY pour l'audit — n'édite que `AUDIT.md` à la fin.
