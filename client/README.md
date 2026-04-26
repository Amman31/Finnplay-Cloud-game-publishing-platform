# FinnPlay — Client (Next.js)

This folder is the **FinnPlay** frontend: Next.js App Router, Tailwind, auth context, game catalog, purchases, and admin tools.

## Local development

1. Configure **`client/.env.local`** from `client/.env.example` (at minimum `NEXT_PUBLIC_API_URL`, e.g. `http://localhost:5000/api` when the Express API runs on port 5000).
2. From the **repository root**, run `npm run dev` (starts client, server, and `python-service` on Windows as defined in root `package.json`) or start only this app:

   ```bash
   cd client && npm run dev
   ```

3. Repo-wide setup, database, Python venv, and admin bootstrap are documented in **`../README.md`** and **`../docs/development-workflow.md`**.

## Admin analytics

The **Admin → Analytics** and admin overview stats call **`GET /api/analytics/dashboard`**, which is backed by **`python-service`**. If FastAPI is down, those requests fail and the UI shows an unavailable state (no silent Prisma aggregate fallback).

For generic Next.js documentation, see [https://nextjs.org/docs](https://nextjs.org/docs).
