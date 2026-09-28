# Sales Book — Verizon leads & customers

A personal sales book for tracking Verizon leads, quotes (phones + plans per line), callbacks, and closed customers.

## Run it locally
Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:5000
```

Production build:

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

Data is stored in a local SQLite file, `data.db`, created on first run with demo customers.
Delete `data.db` to start fresh with an empty book (demo data re-seeds only when the DB is empty —
remove the seed block at the bottom of `server/storage.ts` if you don't want it).

## Where things live
- `shared/schema.ts` — data model, phone list, plans, default plan prices and text templates
- `server/storage.ts` — SQLite tables + demo seed
- `server/routes.ts` — REST API (`/api/contacts`, `/api/tasks`, `/api/activities`, `/api/settings`, CSV export)
- `client/src/App.tsx` — top tabs and routes
- `client/src/pages/` — Today (`dashboard`), Leads (`leads`, `tasks`), Customers (`contacts`), customer page (`contact-detail`), Setup (`setup`)
- `client/src/components/dialogs.tsx` — New quote / quote builder and callback forms
- `client/src/components/quick.tsx` — text-template dialog
- `client/src/lib/quote.ts` — quote pricing, copy-quote text, template filling

Stack: React + Vite + Tailwind + shadcn/ui on the front end, Express + Drizzle + better-sqlite3 on the back end.
