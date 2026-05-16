# Sessions — index chronologique

Log incrémental du travail effectué session par session sur changeyourlife.ai.

| Date | Récap | Commits |
|---|---|---|
| [2026-05-08](2026-05-08.md) | Session marathon : audit initial → fixes (PWA, XSS, OTP, nav) + setup workflow + audit profond → cleanup ~2000 LOC + sécurité (Coach auth, XP server-side, Firestore rules durcies) + landing honnête + **Custom Claims** + **DX (Prettier, EditorConfig, scripts npm)** | 9 commits |
| [2026-05-16](2026-05-16.md) | Reprise projet : réparation toolchain (git cassé reconstruit, Node/Vercel/Firebase CLI) + audit complet → Bloc A sécurité (4 XSS, vuln critique protobufjs) + Bloc B nettoyage (imports/deps/code morts) + Bloc D mineurs + **purge token v0 de l'historique git** (filter-branch) + UI (bug codex/autoeval, restyle 404, responsive login/verify-email, nav unifiée) | 7 commits |

---

**Format** : un fichier `YYYY-MM-DD.md` par session de travail.
À chaque fin de session, le fichier est créé/mis à jour avec ce qui a été fait, les commits, les observations et le TODO restant.

Pour fermer la session courante : tape `/session-end`.
