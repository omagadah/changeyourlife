# Base de données ChangeYourLife.ai — état réel, scale, et cap

> Audit du 2026-08-16. Répond à : où est la base, comment elle est structurée,
> ce qui casse à 10 000 utilisateurs, et faut-il passer à Supabase.

---

## 1 · Où la base est référencée (les 4 seuls endroits qui comptent)

| Fichier | Rôle | État |
|---|---|---|
| `public/js/firebase.js` | Config + singleton `db` exporté | ✅ propre, une seule source |
| `firestore.rules` | 199 lignes — **la seule spec du schéma qui existe** | ✅ solide, mais pas déployée depuis mai |
| `firestore.indexes.json` | Index composites | ⚠️ **vide** (`{"indexes":[],"fieldOverrides":[]}`) |
| `functions/src/index.ts` | `addXp`, `setUserRole`, `getMyRole` | ⚠️ **non déployées** (plan Spark) |

**Le problème n°0 : il n'y a pas de couche d'accès aux données.**
`firebase.js` n'exporte que `db` et `awardXp`. Les **21 fichiers JS** suivants
appellent Firestore *en direct*, chacun avec ses propres `getDoc`/`setDoc` :

```
settings.js(34)  profile.js(20)  app.js(17)  skills.js(14)  bilan.js(14)
meditation.js(12) humeur.js(9)  objectifs.js(8) habitudes.js(8) gratitude.js(8)
yourlife.js(7) sommeil.js(7) plan.js(7) organizer.js(7) organizer-data.js(7)
codex.js(7) coach.js(7) branche.js(7) autoevaluation.js(7) journal.js(6) giveaway.js(6)
```

Conséquence directe : **le schéma n'est écrit nulle part.** Il n'existe que
comme somme de 21 fichiers + les rules. Et surtout : changer de base de données
aujourd'hui = réécrire 21 fichiers. C'est ça qui rend la question « Firebase ou
Supabase ? » difficile à trancher — et c'est réparable indépendamment.

---

## 2 · Le schéma réel aujourd'hui

```
users/{uid}                          ← DOCUMENT UNIQUE, ~20 champs de nature très différente
├── (profil)     displayName, email, avatarUrl, bio, website, profileTitle,
│                selectedTitle, titles[], badges[], founder, prefs{}, lastActive
├── (jeu)        tree{}, levels{}            ← XP par branche Maslow + miroir legacy
├── (ORGANIZER)  organizer{}                 ← ⚠️ LE BOARD ENTIER : colonnes, fiches,
│                                               checklists, logs (60/fiche), liens, canvas
├── (modules)    plan{}, skills[], maVieSkills[], habits[], goals[],
│                meditation{ totalSessions, totalMinutes, streak, history[20] }, dim{}
│
├── journal/{entryId}     ← sous-collection  ✅ bien fait
├── moods/{YYYY-MM-DD}    ← sous-collection  ✅
├── bilans/{weekKey}      ← sous-collection  ✅
├── sleep/{YYYY-MM-DD}    ← sous-collection  ✅
└── gratitude/{YYYY-MM-DD}← sous-collection  ✅

assessments/{docId}          (roue de vie, filtrée par champ uid)
codexNotes/{docId}           (notes, filtrées par champ uid)
giveaways/{cycleId}/entries/{uid}
roles/{uid}                  (miroir read-only des custom claims)
verificationCodes/ coachRate/ chatRate/ translateRate/ briefRate/   (serveur only)
```

La moitié du modèle est bien conçue (les sous-collections datées). L'autre
moitié — tout ce qui est empilé dans `users/{uid}` — est le problème.

---

## 3 · Les 5 problèmes structurels

### P1 — Le mono-document `users/{uid}` va taper le plafond de 1 Mo
Firestore impose **1 Mo par document, limite dure**. Le champ `organizer` à lui
seul contient tout le board : chaque fiche porte `logs[]` plafonné à 60 entrées
(≈ 3,5 Ko) + checklist + description. À ~4 Ko la fiche :

| Fiches accumulées | Poids `organizer` | % du plafond |
|---|---|---|
| 50 | ~200 Ko | 20 % |
| 100 | ~400 Ko | 40 % |
| 250 | ~1 Mo | **écriture refusée, définitivement** |

Un utilisateur qui tient son organizer un an dépasse 250 fiches. À ce moment-là
il ne peut **plus rien sauvegarder** — ni son thème, ni son XP, ni une nouvelle
fiche. Le doc est mort.

### P2 — Chaque écriture réécrit tout, chaque lecture lit tout
`saveBoard()` fait `setDoc(users/{uid}, { organizer: board }, {merge:true})`.
Déplacer une fiche renvoie **tout le board** sur le réseau. Et à l'inverse,
`plan.js`, `skills.js`, `habitudes.js`, `objectifs.js`, `meditation.js`,
`app.js` font chacun **leur propre `getDoc(users/{uid})`** : ouvrir `/app/`
télécharge le même document 4 à 6 fois, organizer compris, pour en lire 3 champs.

C'est le poste de coût n°1 et il est invisible tant qu'on est seul.

### P3 — Limite d'1 écriture/seconde soutenue par document
C'est une contrainte Firestore sur un document unique. Aujourd'hui ça passe.
Avec les connecteurs de la vision (montre + agenda + Maps + banque écrivant en
continu **sur le même document**), c'est de la contention garantie : écritures
en échec, ou pire, écrasement silencieux (last-write-wins entre deux onglets).

### P4 — Aucune catégorie n'est requêtable
C'est le point qui touche directement ton objectif de « supra-base par
catégories ». Aujourd'hui :

- « Toutes mes actions **Corps** de mars » → impossible, c'est enfoui dans une
  map imbriquée d'un document. Il faut tout charger et filtrer en JS.
- « Croise mon sommeil × mon humeur × mes dépenses sur 6 mois » → impossible,
  ce sont 3 sous-collections sans jointure possible.
- `firestore.indexes.json` est **vide** : dès que tu écriras une vraie requête
  (filtre + tri), elle échouera au runtime tant que l'index n'est pas déclaré.

Autrement dit : les catégories existent dans ta tête et dans les noms de champs,
**mais pas dans la base**. Rien ne les impose, rien ne permet de les interroger.

### P5 — Le plan Spark bloque tout le reste
`functions/src/index.ts` existe mais n'est **pas déployable** : Cloud Functions
n'est pas disponible sur le plan gratuit. Conséquences déjà présentes dans le
code (commentaire de `firebase.js`) : l'XP est calculé **côté client**, donc
falsifiable. Et plus grave pour la vision : **pas de cron, pas de webhook, pas
de sync serveur.** Or les connecteurs (montre, agenda, banque) sont *par nature*
du travail serveur qui tourne sans l'utilisateur. Sur Spark, la vision
« le site observe ta vie » est techniquement impossible.

---

## 4 · La scale : les chiffres

### Quotas du plan gratuit (Spark) — ce sont des quotas **totaux, pas par utilisateur**

| Ressource | Quota gratuit/jour |
|---|---|
| Lectures de documents | 50 000 |
| Écritures | 20 000 |
| Suppressions | 20 000 |
| Stockage | 1 GiB total |
| **Sortie réseau (egress)** | **10 GiB / mois** |

### À combien d'utilisateurs ça casse ?

Avec l'usage actuel (≈ 5 lectures du gros doc par session, 3 sessions/jour,
~30 écritures/jour pour un usage normal de l'organizer) :

| Mur | Calcul | Utilisateurs actifs max |
|---|---|---|
| **Egress 10 GiB/mois** | doc de 200 Ko × 5 lectures × 90 sessions/mois = 90 Mo/user | **~110** ⚠️ premier mur |
| Écritures 20 k/j | 30 écritures/user/jour | ~660 |
| Lectures 50 k/j | 15 lectures/user/jour | ~3 300 |
| Stockage 1 GiB | 200 Ko/user | ~5 000 |

**Réponse directe : le site ne tient pas 10 000 utilisateurs. Il ne tient pas
non plus 1 000. Il casse entre 100 et 700 utilisateurs actifs**, et le premier
mur est la bande passante — précisément à cause du mono-document (P2).

À 10 000 utilisateurs sur Spark, le quota de lecture serait de **5 lectures par
utilisateur par jour**. Le site serait inutilisable dès 9 h du matin.

### Sur Blaze (pay-as-you-go), à 10 000 utilisateurs actifs

Tarifs Firestore : lectures **0,03 $ / 100 000**, écritures **0,09 $ / 100 000**,
suppressions 0,01 $ / 100 000, stockage ≈ 0,15 $ / GiB / mois. Le quota gratuit
journalier reste inclus.

| Poste | Volume mensuel | Coût |
|---|---|---|
| Lectures (40/user/jour) | 12 M | ~3 $ |
| Écritures (60/user/jour) | 18 M | ~16 $ |
| Stockage (300 Ko/user) | 3 Go | ~0,5 $ |
| **Egress** — schéma corrigé (~20 Mo/user/mois) | 200 Go | **~24 $** |
| **Egress** — schéma actuel (~90 Mo/user/mois) | 900 Go | **~110 $** |

**Total ≈ 45 $/mois avec un schéma propre, ≈ 130 $/mois sans.**

Trois choses à retenir de ce tableau :

1. **Le coût de la base n'est pas un problème à 10 000 utilisateurs.** 45 $/mois.
   Ce n'est pas là que se joue ta rentabilité.
2. **Le poste dominant est l'egress**, et il est directement proportionnel à la
   bêtise du mono-document. Corriger P2 divise la facture par 4.
3. **Le vrai coût sera l'IA**, pas la base : 10 000 utilisateurs × 1 brief
   quotidien ≈ plusieurs centaines à plusieurs milliers de $/mois de tokens
   Anthropic. C'est un ordre de grandeur au-dessus.

⚠️ **Piège Blaze** : il n'y a pas de plafond de dépense automatique. Une boucle
`onSnapshot` mal écrite peut générer une facture à 4 chiffres en une nuit.
Configurer une **alerte budget Google Cloud à 20 $ / 50 $ / 100 $** le jour même
du passage à Blaze — c'est non négociable.

---

## 5 · Firebase vs Supabase — sur *tes* besoins, pas en général

| Besoin (issu de la vision) | Firestore | Postgres / Supabase |
|---|---|---|
| Catégories **imposées** et typées | ❌ schemaless, convention seulement | ✅ le schéma EST la garantie |
| « Toutes mes actions Corps de mars » | ⚠️ possible si tout est en sous-collections + index | ✅ trivial |
| **Croiser** sommeil × humeur × agenda × finances | ❌ pas de jointure | ✅ une requête SQL |
| Frise chronologique / patterns sur 10 ans | ⚠️ coûteux (1 lecture facturée par doc) | ✅ time-series natif, agrégats gratuits |
| **Mémoire longue vectorielle de Lya** (embeddings) | ⚠️ `findNearest` existe, mais 1 champ vecteur, pré-filtrage limité | ✅ **pgvector**, index HNSW, filtres SQL combinés |
| Temps réel (l'arbre qui pousse en direct) | ✅ excellent, c'est son point fort | ✅ Realtime, correct mais moins fluide |
| Auth + OAuth Google | ✅ déjà en place et éprouvé | ✅ équivalent, mais **migration = re-login de tous** |
| Coût à 10 k users | ~45 $/mois, variable | ~50-100 $/mois, **fixe et prévisible** (Pro 25 $ + compute) |
| Travail serveur (cron, webhooks connecteurs) | Cloud Functions, **plan Blaze obligatoire** | Edge Functions + pg_cron, inclus dès le Free |

**Verdict honnête :** si tu repartais de zéro aujourd'hui, avec cette vision
précise — une supra-base catégorisée que l'IA doit croiser en permanence, plus
une mémoire longue vectorielle — **Postgres/Supabase serait le meilleur outil.**
Le modèle relationnel est littéralement fait pour « des catégories bien
distinctes qu'on recombine ». Firestore est fait pour « lire vite un document
que je connais déjà par son chemin ».

**Mais tu ne repars pas de zéro**, et migrer maintenant serait une erreur de
séquencement, pour deux raisons :

1. **80 % de tes problèmes ne viennent pas de Firebase, ils viennent de ton
   schéma.** Le mono-document, l'absence de catégories requêtables, les 21
   fichiers couplés : tu retrouverais exactement les mêmes défauts sur Supabase
   si tu portais le modèle tel quel. Tu aurais payé une migration pour rien.
2. **Sans couche d'accès, la migration coûte 21 fichiers.** Avec une couche,
   elle coûte un dossier. Le même travail qui rend Firestore supportable rend
   aussi la bascule vers Supabase quasi gratuite plus tard.

---

## 6 · Ma recommandation — l'ordre des opérations

> **Ne change pas de base maintenant. Change de schéma. La base se décidera
> toute seule après, et le choix sera réversible.**

### Lot 0 — cette semaine, non négociable
- [ ] **Passer sur Blaze** + poser une **alerte budget à 20/50/100 $**.
      Débloque les Cloud Functions → connecteurs serveur, cron, anti-triche XP.
      Coût réel actuel à ton volume : ~0 $.
- [ ] `npm run deploy:firestore` — les rules du repo ne sont pas en prod depuis mai.
      **Aujourd'hui la prod tourne sur des règles inconnues.** C'est le vrai risque.

### Lot 1 — la couche d'accès (le vrai investissement)
Créer `public/js/data/` : un module par catégorie, seul autorisé à toucher `db`.

```
public/js/data/
  _client.js     ← le SEUL fichier qui importe firebase-firestore.js
  profile.js     getProfile / patchProfile
  tree.js        getTree / awardXp
  cards.js       listCards / saveCard / archiveCard      (ex-organizer)
  events.js      appendEvent / queryEvents               ← le cœur de la supra-base
  timeline.js    getTimeline(range, categories)
```

Les 21 fichiers n'importent plus que ces modules. À partir de là, changer de
base = réécrire `data/` et rien d'autre. **C'est le seul travail qui rend la
décision Firebase/Supabase réversible — donc il passe avant la décision.**

### Lot 2 — éclater le mono-document
- `organizer` → sous-collection `users/{uid}/cards/{cardId}` (1 fiche = 1 doc).
  Supprime P1, P2 et P3 d'un coup. Les logs deviennent `cards/{id}/logs/{logId}`.
- `meditation.history` → événements (voir §7).
- Déclarer les index composites correspondants dans `firestore.indexes.json`.
- Script de migration one-shot, lancé au premier login (idempotent).

### Lot 3 — le flux d'événements catégorisé (§7)
C'est là que naît réellement la « supra-base ».

### Lot 4 — réévaluer Supabase, sur données réelles
Une fois Lot 1 fait, la question devient : « est-ce que j'ai besoin de SQL et de
pgvector ? » Si la réponse est oui (elle le sera probablement quand Lya devra
croiser 5 ans de données), la bascule coûte deux semaines au lieu de trois mois.

**Option hybride, à garder en tête :** garder Firebase Auth + Firestore pour
l'app temps réel, et ajouter Postgres **en entrepôt** (frise, embeddings,
analyses de Lya), alimenté par les Cloud Functions. C'est un pattern courant et
il évite la migration frontale. Mais il double la surface à maintenir — à ne
faire que quand le besoin analytique est démontré, pas avant.

---

## 7 · Le schéma cible « supra-base »

L'idée clé : arrêter d'empiler des modules et **séparer trois natures de données
qui n'ont ni le même rythme, ni le même usage.**

### Couche 1 — PROFIL (qui il est) — lent, petit, lu à chaque session
```
users/{uid}                    ← redevient un petit document
  identity   { displayName, avatarUrl, bio, locale, tz, birthDate }
  prefs      { theme, anim, reminders, weeklyEmails }
  values     { priorities[], constraints[], nonNegotiables[] }
  meta       { createdAt, lastActive, plan, roles }
```

### Couche 2 — ÉTAT (où il en est) — moyen, réécrit souvent
```
users/{uid}/state/tree         { branches{ xp, level, lastActionAt }, streaks{} }
users/{uid}/state/board        { colonnes, ordre — SANS les fiches }
users/{uid}/cards/{cardId}     1 fiche = 1 document
users/{uid}/cards/{id}/logs/{logId}
```

### Couche 3 — FAITS (ce qui s'est passé) — **append-only, la mine d'or de l'IA**
```
users/{uid}/events/{eventId}
{
  ts:          1786881600000,      // horodatage — c'est l'axe de tout
  category:    'corps',            // ← LA catégorie, imposée
  subcategory: 'sommeil',
  branch:      'physio',           // branche Maslow → nourrit l'arbre
  source:      'watch',            // user | gcal | watch | maps | bank | khan | cyl
  kind:        'measure',          // measure | action | feeling | event | milestone
  value:       7.5,  unit: 'h',
  text:        null,               // libre, pour les faits qualitatifs
  meta:        { deviceId, place, people[] },
  confidence:  0.9                 // 1 = déclaré par l'utilisateur, <1 = inféré
}
```

**Catégories canoniques** (alignées sur les branches de la vision) :
`corps · mental · relations · finances · sens · creation · heritage · temps · lieu`

Ce flux unique est *la* supra-base. Tout s'y range avec le même format :
une nuit de sommeil de la montre, un événement Google Agenda, une fiche
organizer terminée, une note de gratitude, un achat bancaire, un chapitre Khan.

Ce que ça débloque immédiatement :
- **La frise chronologique** = `events` triés par `ts`. Elle existe gratuitement.
- **Les patterns** = agrégation par `category` × fenêtre temporelle.
- **Le contexte de Lya** = « donne-moi les 50 derniers events des catégories
  corps + mental » → une requête, un prompt cadré, un coût de tokens maîtrisé.
  Aujourd'hui il faudrait lui envoyer tout le document utilisateur.
- **L'XP** devient une conséquence dérivée des events, plus un compteur qu'on
  écrit à la main et qu'on peut falsifier.

### Couche 4 — DÉRIVÉ (ce que l'IA a compris) — écrit par le serveur uniquement
```
users/{uid}/insights/{id}   { ts, statement, categories[], evidence[eventIds], confidence }
users/{uid}/entities/{id}   { type: person|place|project, name, firstSeen, lastSeen, weight }
users/{uid}/embeddings/{id} { vector[768], sourceRef, ts }    ← mémoire longue de Lya
```

`insights` porte `evidence[]` : **toute affirmation de Lya doit être traçable à
des events réels.** C'est ce qui la sépare d'un chatbot qui invente. Et c'est
exactement la couche qui sera pénible sur Firestore et naturelle sur pgvector —
d'où la réévaluation prévue au Lot 4.

---

## 8 · Réponses courtes à tes questions

**« Où est référencée la base ? »**
`public/js/firebase.js` pour la config, `firestore.rules` pour le schéma
implicite — et **21 fichiers JS qui parlent à Firestore en direct**, ce qui est
le vrai problème.

**« Tout est sur Firebase ? »**
Oui : Firestore (données) + Auth + Functions (écrites mais non déployées).
Aucune autre base. Rien en local hors préférences d'affichage.

**« La limite à 10 000 utilisateurs ? »**
Sur le plan gratuit actuel : ça casse **entre 100 et 700 utilisateurs actifs**,
la bande passante en premier. 10 000 est hors d'atteinte sans passer Blaze.

**« Ça va se stocker où ? »**
Sur les serveurs Google Cloud du projet `changeyourlife-cc210`. À 10 000
utilisateurs et un schéma propre : **~3 Go**, soit ~0,50 $/mois de stockage.
Le volume n'est pas un problème ; sa forme l'est.

**« C'est quoi la scale ? »**
~45 $/mois de base à 10 000 utilisateurs actifs si le schéma est corrigé,
~130 $/mois sinon. Le mur technique n'est pas le coût, c'est le **plafond de
1 Mo par document** et l'**impossibilité de requêter les catégories**.

**« On utiliserait pas Supabase ? »**
Probablement, un jour — c'est le meilleur outil pour ce que tu décris. Mais
**pas avant d'avoir fait le Lot 1**, sinon tu paies une migration pour reporter
les mêmes défauts. Fais la couche d'accès, éclate le mono-document, monte le
flux d'events ; à ce moment-là la question se tranche en deux semaines et sur
des données réelles au lieu d'une intuition.
