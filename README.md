# APEX — Gestion des plans de cycle

Application web permettant aux délégués terrain de construire et mettre à jour leur plan de cycle,
de le faire valider par leur manager, puis de l'envoyer dans le CRM. Interface FR / EN.

## Stack

| Rôle | Outil |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Base de données | PostgreSQL 17 + PostGIS (Docker en local) |
| ORM | Prisma 7 (`prisma/schema.prisma`, client généré dans `src/generated/prisma`) |
| Authentification | Auth.js v5 (identifiants, session JWT, rôles) — `src/auth.ts`, `src/lib/dal.ts`, `src/proxy.ts` |
| Interface | Tailwind CSS 4 (+ shadcn/ui à ajouter), Framer Motion |
| Tableaux / graphiques | TanStack Table, ECharts |
| Langues | next-intl (cookie `NEXT_LOCALE`, fichiers `messages/fr.json` et `messages/en.json`) |
| E-mails | Nodemailer → Mailpit en local |
| Imports Excel | ExcelJS |
| Tests | Vitest, Playwright |

## Démarrer en local

Prérequis : Node.js 22+, Docker Desktop.

```powershell
npm install
```

```powershell
Copy-Item .env.example .env   # puis renseigner AUTH_SECRET (npx auth secret)
```

```powershell
npm run db:up        # PostgreSQL + Mailpit
```

```powershell
npm run db:migrate   # crée les tables
```

```powershell
npm run db:seed      # données de démo (secteur 104, plans 26C1 / 26C2)
```

```powershell
npm run dev          # http://localhost:3000
```

- Mailpit (e-mails envoyés par l'app) : http://localhost:8025
- Explorer la base : `npm run db:studio`
- Comptes de démo : voir `prisma/seed.ts` (un compte par rôle, même mot de passe).

## Scripts utiles

| Script | Effet |
|---|---|
| `npm run db:reset` | Vide la base, rejoue les migrations et le seed |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` / `npm run test:e2e` | Tests unitaires / parcours navigateur |

## Déploiement

- **Démo / préproduction** : Vercel + Postgres Neon (région UE).
- **Production hors Vercel** : `Dockerfile` (build `standalone`).

## Arborescence

```
messages/            traductions FR / EN
prisma/              schéma, migrations, seed
src/app/             pages (App Router)
src/components/      composants d'interface
src/i18n/            configuration des langues
src/lib/db.ts        client Prisma partagé
src/generated/       client Prisma généré (non versionné)
```
