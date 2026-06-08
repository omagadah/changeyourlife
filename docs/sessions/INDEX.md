# Sessions — index chronologique

Log incrémental du travail effectué session par session sur changeyourlife.ai.

| Date | Récap | Commits |
|---|---|---|
| [2026-05-08](2026-05-08.md) | Session marathon : audit initial → fixes (PWA, XSS, OTP, nav) + setup workflow + audit profond → cleanup ~2000 LOC + sécurité (Coach auth, XP server-side, Firestore rules durcies) + landing honnête + **Custom Claims** + **DX (Prettier, EditorConfig, scripts npm)** | 9 commits |
| [2026-05-16](2026-05-16.md) | Reprise projet : réparation toolchain (git cassé reconstruit, Node/Vercel/Firebase CLI) + audit complet → Bloc A sécurité (4 XSS, vuln critique protobufjs) + Bloc B nettoyage (imports/deps/code morts) + Bloc D mineurs + **purge token v0 de l'historique git** (filter-branch) + UI (bug codex/autoeval, restyle 404, responsive login/verify-email, nav unifiée) | 7 commits |
| [2026-06-08](2026-06-08.md) | **Journée massive** (SW v92 → v147). Matin : refonte visuelle espace + arbre **ez-tree** + atome + plaque Pioneer + nébuleuse + perf adaptative. Suite : univers Chêne/Frêne/**Architecture** · **badge pixel-art** (+ devient logo/favicon global) · **ORGANIZER vue Canvas + connecteurs** (workflow IA) · **croissance PAR BRANCHE Maslow** sur /app · **SYL = chatbot Claude activé** (clé `API_ANTHROPIC_CHATBOT`) + **cadre strictement non-directif** · **bouton Urgence** + flux de crise (3114/15/112) · **système solaire à l'échelle** · **emojis Fluent 3D** (Twemoji-first + upgrade) · **squelette ESP** (exosquelette aligné, tronc + branches-catégories) | ~50 commits |

---

**Format** : un fichier `YYYY-MM-DD.md` par session de travail.
À chaque fin de session, le fichier est créé/mis à jour avec ce qui a été fait, les commits, les observations et le TODO restant.

Pour fermer la session courante : tape `/session-end`.
