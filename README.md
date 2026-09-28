# Sales Book — Verizon leads & customers

A personal sales book for tracking Verizon leads, quotes (phones + plans per line), callbacks, and closed customers.

## How it works
Like the commission tracker and budget apps, Sales Book is a static site: there is no server or database.
Everything you enter is saved in this browser's localStorage (key `salesbook`), so it stays on your device
and isn't reachable by anyone else with the link. It does **not** sync between devices, and clearing the
browser's site data erases it; use **Export CSV** on the Customers tab for a backup.

Pushing to `main` deploys to Vercel (`vercel.json` publishes the Vite build in `dist/public`).

## Run it locally
Requires Node.js 20+.

```bash
npm install
npm run dev          # local dev server
npm run build        # production build into dist/public
```

## Where things live
- `shared/schema.ts` — data model, phone list, plans and default text templates
- `client/src/lib/localdb.ts` — localStorage store; answers the app's `/api/...` calls in the browser, plus CSV export
- `client/src/App.tsx` — top tabs and routes
- `client/src/pages/` — Today (`dashboard`), Leads (`leads`, `tasks`), Customers (`contacts`), customer page (`contact-detail`), Setup (`setup`)
- `client/src/components/dialogs.tsx` — New quote / quote builder and callback forms
- `client/src/components/quick.tsx` — text-template dialog
- `client/src/lib/quote.ts` — copy-quote text, template filling

Stack: React + Vite + Tailwind + shadcn/ui, data in localStorage.
