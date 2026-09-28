# Sales Book — Verizon leads & customers

A personal sales book for tracking Verizon leads, quotes (phones + plans per line), callbacks, and closed customers.

## Deploy (Vercel)
Pushing to `main` deploys to Vercel. `vercel.json` builds the front end into `dist/public` and sends
every `/api/*` request to one serverless function (`api/index.ts`) that runs the Express app.

Data lives in Neon Postgres. In Vercel -> the project -> Storage, create a Neon database and connect it;
that sets `DATABASE_URL`. Tables are created on the first request, and demo customers are added if the
database is empty (remove `seedIfEmpty()` in `server/storage.ts` if you don't want them).

## Run it locally
Requires Node.js 20+. Copy `.env.example` to `.env` and set `DATABASE_URL` (use a separate Neon branch
if you don't want to touch your live data).

```bash
npm install
npm run dev          # http://localhost:5000
```

## Where things live
- `shared/schema.ts` — data model, phone list, plans, default plan prices and text templates
- `server/storage.ts` — Postgres tables + demo seed
- `server/app.ts` — Express app shared by the local server (`server/index.ts`) and the Vercel function (`api/index.ts`)
- `server/routes.ts` — REST API (`/api/contacts`, `/api/tasks`, `/api/activities`, `/api/settings`, CSV export)
- `client/src/App.tsx` — top tabs and routes
- `client/src/pages/` — Today (`dashboard`), Leads (`leads`, `tasks`), Customers (`contacts`), customer page (`contact-detail`), Setup (`setup`)
- `client/src/components/dialogs.tsx` — New quote / quote builder and callback forms
- `client/src/components/quick.tsx` — text-template dialog
- `client/src/lib/quote.ts` — quote pricing, copy-quote text, template filling

Stack: React + Vite + Tailwind + shadcn/ui on the front end, Express + Drizzle + Neon Postgres on the back end.
