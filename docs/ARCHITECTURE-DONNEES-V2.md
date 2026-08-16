# Architecture données v2 — corpus partagé + cellules utilisateur

> 2026-08-16. Fait suite à `docs/BASE-DE-DONNEES.md`, qu'il **remplace sur la
> décision de base**. Arbitrages retenus : corpus des 4 natures · Supabase
> managé · bascule en dual-run.

---

## 1 · Ce qui change, et pourquoi la conclusion s'inverse

L'audit précédent disait : « Postgres serait meilleur, mais ne migre pas
maintenant, le coût de migration n'en vaut pas la peine. » Cette conclusion
reposait sur une hypothèse qui vient de tomber : **que la base ne servirait
qu'à stocker les données d'un utilisateur pour les lui réafficher.**

Un corpus partagé change trois choses, et chacune suffirait seule.

**Le modèle de facturation devient hostile.** Firestore facture **à la lecture
de document**. Un corpus est par définition lu par tout le monde, tout le temps,
et ne change jamais. 100 000 lignes de référentiel interrogées 10 fois par jour
par 10 000 utilisateurs = 1 milliard de lectures facturées par mois pour de la
donnée statique. Sur Postgres, ce corpus tient dans le cache mémoire et les
requêtes ne coûtent que du CPU déjà payé. Ce n'est pas un écart de 20 %, c'est
un écart d'un ordre de grandeur, et il joue contre toi à chaque utilisateur
supplémentaire.

**Croiser un utilisateur avec un référentiel est une jointure.** C'est
l'opération centrale de ce que tu décris : « situer cette personne par rapport à
ce qu'on sait ». Firestore ne fait pas de jointure — ni maintenant, ni
prévu. Il faudrait tout charger côté client et joindre en JavaScript, sur des
tables de référence de plusieurs centaines de milliers de lignes. Ce n'est pas
inconfortable, c'est infaisable.

**Les « axes de vie les plus probables » sont une requête de graphe.** Trouver
les chemins probables entre un état de vie courant et des états d'arrivée, c'est
un parcours de graphe pondéré. En SQL c'est un `WITH RECURSIVE` de vingt lignes.
En Firestore, ça n'a pas de traduction.

**Conclusion : Postgres n'est plus le meilleur choix, c'est le seul.** Et la
migration coûte beaucoup moins cher que prévu — voir §6.

---

## 2 · L'architecture en trois plans

```
                   ┌──────────────────────────────────────┐
                   │   PLAN 1 — CORPUS  (schema corpus)   │
                   │   partagé · lecture · ne change pas  │
                   │   textes · référentiels · trajectoires│
                   └───────────────┬──────────────────────┘
                                   │
                   ┌───────────────▼──────────────────────┐
                   │   PLAN 3 — LE PONT                   │
                   │   situer · positionner · projeter    │
                   │   = ce qui fabrique l'arbre          │
                   └───────────────▲──────────────────────┘
                                   │
                   ┌───────────────┴──────────────────────┐
                   │   PLAN 2 — CELLULES  (schema app)    │
                   │   1 utilisateur = 1 cellule · RLS    │
                   │   profil · état · events · mémoire   │
                   └──────────────────────────────────────┘
```

Le plan 3 est le produit. Les plans 1 et 2 ne sont que du stockage — n'importe
qui peut les faire. Ce qui n'existe nulle part ailleurs, c'est la fonction qui
prend une vie réelle, la situe dans un corpus, et en déduit des directions.

---

## 3 · Plan 1 — le corpus

### 3.0 Traçabilité — la table qui conditionne tout le reste

```sql
create schema corpus;

create table corpus.sources (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  publisher    text,
  url          text,
  licence      text not null,        -- CC-BY, ODbL, propriétaire, domaine public…
  retrieved_at timestamptz not null,
  version      text,
  reliability  smallint check (reliability between 1 and 5),
  notes        text
);
```

**Toute ligne de corpus référence une source, sans exception.** Trois raisons,
et aucune n'est théorique :

1. **Licences.** ESCO, INSEE, OMS, un livre sous droits : les conditions de
   réutilisation diffèrent radicalement. Sans cette table, tu ne peux pas
   répondre à « d'où vient cette donnée et ai-je le droit de m'en servir ». Le
   jour où tu ouvres le service, c'est la première question qu'on te pose.
2. **Lya doit pouvoir citer.** Une affirmation traçable à une source réelle,
   c'est ce qui sépare un coach d'un générateur de texte plausible.
3. **Correction.** Quand une source se révèle fausse ou périmée, tu veux
   supprimer *exactement* ce qu'elle a produit, pas deviner.

### 3.1 Corpus textuel (psycho, protocoles, ouvrages)

```sql
create table corpus.documents (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references corpus.sources,
  title      text not null,
  author     text,
  year       smallint,
  lang       char(2) not null default 'fr',
  kind       text not null,          -- livre | article | protocole | échelle | méthode
  categories text[] not null,        -- corps, mental, relations…
  meta       jsonb not null default '{}'
);

create table corpus.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references corpus.documents on delete cascade,
  ord         int  not null,
  text        text not null,
  categories  text[] not null,
  embedding   halfvec(768),
  fts         tsvector generated always as (to_tsvector('french', text)) stored
);

create index on corpus.chunks using hnsw (embedding halfvec_cosine_ops);
create index on corpus.chunks using gin  (fts);
create index on corpus.chunks using gin  (categories);
```

Deux choix techniques qui te feront économiser de l'argent et de la RAM :

- **`halfvec` au lieu de `vector`** : stockage 16 bits au lieu de 32. Divise la
  taille par deux, perte de qualité de rappel négligeable en pratique.
- **768 dimensions plutôt que 1536** : la plupart des modèles récents supportent
  la troncature Matryoshka — tu tronques le vecteur sans réentraîner. Encore un
  facteur deux. Combiné : **un corpus 4× plus petit** que le réglage par défaut,
  donc un tier de compute Supabase moins cher.

**Recherche hybride** (sémantique + mots-clés), qui bat systématiquement le
vectoriel seul sur un corpus spécialisé : deux requêtes, fusion par rang
réciproque. C'est ce qui permet à Lya de retrouver un protocole par son nom
exact *et* par une description approximative.

### 3.2 Référentiels structurés

```sql
create table corpus.taxonomy (          -- ESCO, ROME, CIM-11, Big Five…
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references corpus.sources,
  scheme text not null, code text not null, label text not null,
  parent_id uuid references corpus.taxonomy,
  categories text[],
  unique (scheme, code)
);

create table corpus.occupations (id uuid primary key, code text, label text, scheme text, source_id uuid references corpus.sources);
create table corpus.skills      (id uuid primary key, code text, label text, scheme text, source_id uuid references corpus.sources);

create table corpus.occupation_skills (   -- la jointure qui vaut de l'or
  occupation_id uuid references corpus.occupations,
  skill_id      uuid references corpus.skills,
  importance    numeric,               -- 0..1
  essential     boolean,
  primary key (occupation_id, skill_id)
);

create table corpus.norms (              -- « où je me situe »
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references corpus.sources,
  metric text not null,                 -- sleep_hours, steps, revenu, isolement…
  population text, sex char(1), age_min smallint, age_max smallint,
  p05 numeric, p25 numeric, p50 numeric, p75 numeric, p95 numeric,
  unit text
);
```

`corpus.norms` est la table la plus rentable à remplir en premier : c'est très
peu de lignes, les données sont publiques et gratuites (OMS, INSEE, Eurostat),
et ça produit immédiatement des phrases utiles. « Tu dors 6h05 en moyenne
depuis trois semaines ; la médiane pour ton âge est 7h20, tu es autour du 15e
percentile. » Ça, aucun tracker du marché ne le dit, et ça ne demande ni IA ni
modèle — juste une jointure.

### 3.3 Trajectoires — le cœur des « axes de vie probables »

```sql
create table corpus.life_states (
  id uuid primary key default gen_random_uuid(),
  category text not null,               -- corps, relations, finances…
  label    text not null,               -- « séparation récente », « reconversion »…
  descriptor jsonb not null             -- critères mesurables d'appartenance
);

create table corpus.transitions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references corpus.sources,
  from_state uuid not null references corpus.life_states,
  to_state   uuid not null references corpus.life_states,
  n_observed int    not null,           -- taille d'échantillon
  p_success  numeric not null,          -- 0..1
  median_months numeric,
  conditions jsonb  not null default '{}',   -- âge, contexte, ressources…
  evidence_level smallint               -- 1 anecdotique … 5 méta-analyse
);
create index on corpus.transitions (from_state, p_success desc);
```

C'est un graphe orienté pondéré, et Postgres le parcourt nativement :

```sql
-- Les chemins les plus probables depuis un état, à 3 sauts maximum
with recursive path as (
  select t.from_state, t.to_state, t.p_success as p,
         array[t.from_state, t.to_state] as steps, 1 as depth
    from corpus.transitions t
   where t.from_state = $1 and t.n_observed >= 30
  union all
  select p.from_state, t.to_state, p.p * t.p_success,
         p.steps || t.to_state, p.depth + 1
    from path p
    join corpus.transitions t on t.from_state = p.to_state
   where p.depth < 3
     and not t.to_state = any(p.steps)      -- pas de cycle
     and t.n_observed >= 30
)
select steps, p from path order by p desc limit 10;
```

**Ces dix lignes de résultat sont littéralement les branches de l'arbre.** La
métaphore cesse d'être une illustration : elle devient le rendu d'un calcul.

Note d'honnêteté sur ce plan : c'est le plus difficile à alimenter. Les données
longitudinales publiques de qualité sont rares, souvent anglo-saxonnes, souvent
sous accès contrôlé. Commence par un corpus **restreint et assumé** — quelques
dizaines de transitions bien documentées valent mieux que mille inventées. Le
champ `evidence_level` existe pour que Lya module son assurance en fonction : à
1, elle propose ; à 5, elle affirme.

### 3.4 Agrégats de tes propres utilisateurs

C'est le plan le plus puissant à terme et le plus dangereux juridiquement.
La garde-fou est technique, pas contractuelle :

```sql
create table corpus.cohort_stats (
  id uuid primary key default gen_random_uuid(),
  segment_key text not null,            -- hash du segment (tranche d'âge × contexte)
  metric      text not null,
  n           int  not null,
  p25 numeric, p50 numeric, p75 numeric,
  computed_at timestamptz not null default now(),
  constraint k_anonymity check (n >= 20)   -- non négociable
);
```

La contrainte `n >= 20` est posée **au niveau de la base**, pas dans le code.
En dessous de ce seuil, un agrégat permet de ré-identifier une personne, et tu
n'es plus dans l'anonyme mais dans le pseudonymisé — régime juridique
entièrement différent. Une contrainte SQL ne s'oublie pas dans un refactoring ;
un `if` dans un fichier JS, si.

Ces agrégats sont calculés par un job `pg_cron` nocturne, jamais à la volée, et
ne contiennent **jamais** d'identifiant utilisateur. Point important : tant que
la page d'accueil promet que les données ne sont pas utilisées, ce plan-là reste
en attente. C'est le seul des quatre qui soit réellement bloqué par la question
de la promesse. Les trois autres, tu peux les construire dès demain.

---

## 4 · Plan 2 — les cellules

```sql
create schema app;

create table app.profiles (
  uid text primary key,                 -- uid Firebase : du texte, pas un uuid
  identity jsonb not null default '{}',
  prefs    jsonb not null default '{}',
  values   jsonb not null default '{}',
  created_at timestamptz default now(),
  last_active timestamptz
);

create table app.events (               -- append-only, le flux central
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  ts timestamptz not null,
  category text not null,               -- corps mental relations finances sens creation heritage temps lieu
  subcategory text,
  branch text,                          -- branche Maslow → nourrit l'arbre
  source text not null,                 -- user gcal watch maps bank khan cyl
  kind text not null,                   -- measure action feeling event milestone
  value numeric, unit text,
  text text,
  meta jsonb not null default '{}',
  confidence numeric not null default 1.0
);
create index on app.events (uid, ts desc);              -- l'index qui compte
create index on app.events (uid, category, ts desc);
create index on app.events using gin (meta);

create table app.cards      (id uuid primary key, uid text not null, title text, branch text, col text, due timestamptz, done boolean, ...);
create table app.card_logs  (id uuid primary key, card_id uuid references app.cards on delete cascade, at timestamptz, message text);
create table app.state      (uid text, key text, value jsonb, updated_at timestamptz, primary key (uid, key));
create table app.insights   (id uuid primary key, uid text, ts timestamptz, statement text, categories text[], evidence uuid[], confidence numeric, model text);
create table app.entities   (id uuid primary key, uid text, type text, name text, first_seen timestamptz, last_seen timestamptz, weight numeric);
create table app.memories   (id uuid primary key, uid text, ts timestamptz, text text, embedding halfvec(768), source_ref uuid);
```

### La cellule, c'est RLS

```sql
alter table app.events enable row level security;

-- Permissive : je ne vois que mes lignes
create policy cell_select on app.events for select
  using (uid = auth.jwt()->>'sub');
create policy cell_write on app.events for insert
  with check (uid = auth.jwt()->>'sub');

-- Restrictive : le jeton vient bien de MON projet Firebase
create policy firebase_project on app.events as restrictive for all
  using (
    auth.jwt()->>'iss' = 'https://securetoken.google.com/changeyourlife-cc210'
    and auth.jwt()->>'aud' = 'changeyourlife-cc210'
  );
```

La seconde policy n'est pas optionnelle : Firebase Auth **signe les jetons de
tous les projets avec le même jeu de clés**. Sans le contrôle `iss`/`aud`, un
jeton d'un projet Firebase quelconque passe la validation de signature. La
plateforme Supabase gère ce cas, mais poser la policy explicitement coûte trois
lignes et te protège d'une erreur de configuration.

**RLS est plus solide que les rules Firestore** sur un point précis : la policy
est appliquée par le planificateur de requêtes, elle ne peut pas être contournée
par une requête mal formée. Il n'existe pas d'équivalent du « j'ai oublié
`allow delete` et la suppression RGPD était cassée pendant des mois » que tu as
vécu en juillet.

Le corpus, lui, reste en lecture pour tous les connectés — c'est le but.

### Partitionnement — à prévoir, pas à faire tout de suite

10 000 utilisateurs × 20 events/jour ≈ **73 millions de lignes par an**.
Postgres encaisse sans broncher jusqu'à ~50 M par table avec les bons index.
Au-delà, partitionne `app.events` par mois (`partition by range (ts)`) : les
requêtes de Lya portent presque toujours sur les 90 derniers jours, donc elles
ne touchent que trois partitions. À déclencher vers 30 M de lignes, pas avant —
partitionner trop tôt complique sans rien apporter.

---

## 5 · Plan 3 — le pont

Trois fonctions, dans cet ordre de difficulté croissante.

**Situer** — l'utilisateur contre les normes. Faisable dès que `corpus.norms`
est remplie, aucune IA requise.

```sql
create or replace function app.situate(p_uid text, p_metric text, p_days int default 30)
returns table (moyenne numeric, mediane_pop numeric, percentile text) as $$
  with mine as (
    select avg(value) v from app.events
     where uid = p_uid and subcategory = p_metric
       and ts > now() - (p_days || ' days')::interval
  )
  select mine.v, n.p50,
         case when mine.v < n.p05 then '<5' when mine.v < n.p25 then '5-25'
              when mine.v < n.p50 then '25-50' when mine.v < n.p75 then '50-75'
              else '>75' end
    from mine, corpus.norms n
   where n.metric = p_metric;
$$ language sql stable;
```

**Positionner** — déduire l'état de vie courant à partir des events récents,
via les `descriptor` de `corpus.life_states`. Vue matérialisée rafraîchie la
nuit par `pg_cron`.

**Projeter** — appliquer la requête récursive du §3.3 depuis l'état positionné.
Sortie : une liste de chemins pondérés, avec leur `evidence_level` et leurs
sources. **C'est le rendu de l'arbre.**

Le tronc est l'état courant. Chaque branche est une catégorie. La direction et
la longueur de chaque branche viennent des transitions probables. Une branche
qui pousse vite est un axe où le corpus dit qu'il se passe quelque chose pour
des gens dans ta situation. L'arbre cesse d'être une jauge d'XP déguisée.

Et le contexte envoyé à Lya devient borné et cadré : les 50 derniers events des
catégories concernées + l'état positionné + les 3 chemins les plus probables +
les chunks de corpus pertinents. Quelques milliers de tokens, au lieu du
document utilisateur entier. **C'est aussi ce qui fait tenir la facture IA**, qui
sera ton vrai poste de coût.

---

## 6 · Auth — tu gardes Firebase, personne ne se re-loggue

Supabase accepte Firebase Auth comme fournisseur tiers. Le client passe le jeton
Firebase à Supabase, qui le valide et expose ses claims à RLS via `auth.jwt()`.
**Aucun utilisateur ne recrée de compte.** C'est ce qui fait passer la migration
de trois mois à quelques semaines.

Trois pièges concrets, spécifiques à ton code :

**1. Collision sur le claim `role`.** Supabase exige `role: "authenticated"`
dans le JWT, faute de quoi la requête tombe en `anon` et RLS bloque tout. Or
`functions/src/index.ts:174` utilise déjà `role` pour `admin | mod | user`, et
`firestore.rules` teste `request.auth.token.role == 'admin'`. **Renomme le tien
en `app_role`** — dans la Function, dans les rules, et dans `settings.js` /
`getMyRole`. À faire avant la bascule, sinon tu débogues une heure sur un
`permission denied` qui n'a rien à voir avec Postgres.

**2. Tu n'as pas besoin de Blaze pour ça.** Poser un custom claim demande le SDK
Admin — mais tu l'utilises déjà depuis Vercel : `api/chat.js`, `api/coach.js`,
`api/cyl-brief.js`, `api/giveaway-draw.js` initialisent tous
`firebase-admin` avec un service account. Ajoute une route `api/set-claims.js`
sur le même modèle. Firebase reste sur Spark, uniquement comme fournisseur
d'identité — ce pour quoi il est excellent et gratuit à ton échelle.

Corollaire agréable : **le travail serveur migre vers Supabase** (Edge Functions
pour les webhooks connecteurs, `pg_cron` pour les jobs nocturnes) et les crons
Vercel pour le reste. Blaze, que je te pressais de prendre ce matin, redevient
optionnel.

**3. Le CSP va bloquer Supabase.** `vercel.json` déclare un `connect-src`
explicite qui n'autorise que Firebase et deux CDN. Tant que tu n'y ajoutes pas
`https://<ref>.supabase.co`, **toutes** les requêtes Supabase seront rejetées
par le navigateur — avec une erreur console qui ne dit pas clairement pourquoi.
Une ligne, mais elle coûte une après-midi si on l'oublie.

---

## 7 · Volumétrie et coût réel

| Poste | Volume | Note |
|---|---|---|
| Corpus textuel, 1 M chunks | ~2,5 Go | avec halfvec 768 ; ~10 Go en vector 1536 |
| Index HNSW sur 1 M vecteurs | ~1 Go | doit tenir en RAM, c'est ce qui dimensionne le compute |
| Référentiels (ESCO, normes, taxonomies) | < 500 Mo | ESCO ≈ 3 000 métiers × 13 000 compétences |
| Trajectoires | < 100 Mo | petites tables, forte valeur |
| Cellules, 10 000 utilisateurs | ~3 Go | events compris |
| **Total** | **~7 Go** | rentre dans les 8 Go inclus du plan Pro |

Coût mensuel à 10 000 utilisateurs actifs : **Pro 25 $ + compute Medium ~60 $**
(dicté par la RAM nécessaire à l'index HNSW, pas par le nombre d'utilisateurs)
= **~85 $/mois**, fixe et prévisible. Les 250 Go d'egress et les 100 000 MAU
inclus couvrent largement ton horizon.

À comparer aux ~130 $/mois de Firestore sans corpus — et le corpus y serait de
toute façon impossible. Sur les trois premières années, le coût de la base reste
un poste négligeable devant les tokens IA.

---

## 8 · Le dual-run, version disciplinée

Tu as choisi le dual-run. C'est la voie la plus sûre et la plus coûteuse en
attention — voici la version qui limite la casse. Quatre règles.

**Règle 1 — le corpus n'est jamais en dual-run.** Il naît sur Postgres et n'en
bouge pas. Rien à migrer, rien à synchroniser. Tu peux le commencer aujourd'hui
sans toucher à une ligne du site existant.

**Règle 2 — le dual-run vit dans un seul fichier.** C'est non négociable, et
ça rend la couche d'accès (le « Lot 1 » de l'audit précédent) **obligatoire, pas
recommandée**. Sans elle, dual-run veut dire écrire la double écriture dans 21
fichiers, avec 21 occasions de se tromper.

```js
// public/js/data/_mode.js — le seul endroit qui décide
export const MODE = {
  events:  'pg',     // neuf : direct Postgres, rien à migrer
  cards:   'both',   // en cours de bascule
  state:   'fs',     // pas encore touché
  profile: 'fs',
};
```

**Règle 3 — jamais de double lecture en production.** Écrire dans les deux, oui.
Lire dans les deux et comparer à chaud, non : tu doubles la latence et tu crées
une classe de bugs de divergence impossible à reproduire. La comparaison est un
**script de vérification qu'on lance à la main** avant de basculer un module.

**Règle 4 — un module à la fois, dans cet ordre.** Firestore reste la source de
vérité en lecture jusqu'à validation, puis on bascule la lecture, puis on coupe
l'écriture Firestore. Trois interrupteurs distincts, jamais simultanés.

| Ordre | Module | Pourquoi celui-là |
|---|---|---|
| 1 | `events` | Neuf, aucun existant à migrer. Zéro risque, valeur immédiate. |
| 2 | `cards` | Éteint le plafond de 1 Mo, qui est ton seul problème *bloquant*. |
| 3 | `state` (tree, board) | Petit, bien cerné. |
| 4 | `profile` | Beaucoup de points d'appel — à faire quand la couche est rodée. |
| 5 | trackers datés | Déjà propres en sous-collections, aucune urgence. |

---

## 9 · Cette semaine

- [ ] **Corriger la promesse de la page d'accueil.** Dix minutes, purement
      rédactionnel, supprime toute l'exposition. Rien d'autre ne la supprime.
- [ ] `npm run deploy:firestore` — la prod tourne sur des règles inconnues
      depuis mai. Indépendant de tout ce document, et toujours prioritaire.
- [ ] Créer le projet Supabase, activer `pgvector` et `pg_cron`.
- [ ] Renommer le claim `role` → `app_role` (Function + rules + settings.js).
- [ ] Ajouter le domaine Supabase au `connect-src` de `vercel.json`.
- [ ] Créer `public/js/data/` avec `_client.js` et `_mode.js` — **le prérequis
      du dual-run**, avant toute écriture de schéma applicatif.
- [ ] Remplir `corpus.sources` + `corpus.norms` avec deux ou trois jeux publics
      (OMS sommeil, INSEE). C'est petit, gratuit, et ça produit la première
      phrase que ton site sait dire et qu'aucun concurrent ne dit.

Blaze n'est plus dans cette liste : le travail serveur part chez Supabase.
