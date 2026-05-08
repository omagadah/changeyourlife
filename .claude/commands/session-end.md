---
description: Cloturer la session — créer/MAJ docs/sessions/YYYY-MM-DD.md + update INDEX
---

Tu vas créer ou mettre à jour le fichier `docs/sessions/YYYY-MM-DD.md` (date du jour) avec un récap de la session courante.

**Étapes** :

1. **Détermine la date du jour** (ISO `YYYY-MM-DD`) via `Date.now()` ou via le contexte de la conversation.

2. **Récap structuré** dans le fichier — format :

```markdown
# Session YYYY-MM-DD

## Contexte
(Pourquoi cette session, ce qui était demandé)

## Travaux effectués

### 1 · <Sujet 1> (commit `SHA`)
- Descriptif clair, références fichier:ligne
- Pourquoi ce changement

### 2 · <Sujet 2> (commit `SHA`)
…

## Fichiers touchés (résumé)
- Liste concise

## Observations
- Trucs notables découverts pendant la session
- Bugs pré-existants repérés mais pas fixés
- Curiosités

## TODO restant
- [ ] Items pour la prochaine session

## Commits de la session
- `SHA` — message court
…
```

3. **Mets à jour `docs/sessions/INDEX.md`** : ajoute/MAJ la ligne pour aujourd'hui dans le tableau.

4. **Récupère les commits du jour** via `git log --since=midnight --pretty=format:'%h %s'` pour les lister.

5. **Si la session a touché des fichiers non committés**, mentionne-les comme "uncommitted changes" en bas. Ne fais pas de commit automatique sauf si l'utilisateur le demande.

6. **À la fin**, propose à l'utilisateur de committer le log de session via un message court.
