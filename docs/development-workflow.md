# Development Workflow (Mode 1)

This document is only for **daily coding mode**.

In development mode:
- frontend, backend, and python-service run locally with hot reload
- PostgreSQL and Azurite run in Docker
- this is the fastest workflow for coding/debugging

## Architecture in this mode

- `client` -> local Next.js dev server (`localhost:3000`)
- `server` -> local Express dev server (`localhost:5000`)
- `python-service` -> local FastAPI reload server (`localhost:8000`)
- `postgres` -> Docker container (`localhost:5433` on the host maps to Postgres in the container)
- `azurite` -> Docker container (`localhost:10000`)

## 1) Start prerequisites

Install:
- Node.js 22+
- Python 3.13+ (or 3.12+)
- Docker Desktop

Install project dependencies:

```bash
npm run install:all
```

Create and use a local Python virtual environment inside `python-service`.

The root script `npm run dev:python` (see root `package.json`) invokes **`python-service/venv\Scripts\python`** on Windows. Create that venv name so `npm run dev` can start FastAPI without changes:

```bash
cd python-service
python -m venv venv
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

macOS/Linux (use `venv` as the folder name, or run Uvicorn yourself — the root `dev:python` script is Windows-oriented):

```bash
python -m venv venv
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
cd ..
```

If you prefer `.venv`, activate it and start the API manually (from `python-service/`):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 2) Configure env files

Create these files:

- root: copy `.env.example` -> `.env` (used for infra and deployment flows)
- server: copy `server/.env.example` -> `server/.env`
- client: copy `client/.env.example` -> `client/.env.local`
- python: copy `python-service/.env.example` -> `python-service/.env` (**optional** if `server/.env` already defines `POSTGRESQL_URL` — `python-service/app/main.py` loads `server/.env` after `python-service/.env`, without overriding existing variables)

Set development-safe values in `server/.env`:
- `POSTGRESQL_URL=postgresql://finnplay:finnplay_dev_password@localhost:5433/finnplay?schema=public`  
  Use the same value for Prisma. The Python service **strips** the Prisma-only `schema=` query parameter internally before connecting with **psycopg** (libpq rejects `schema=` in the URI).

The **host port is 5433** (see `docker-compose.dev.yml`) so Prisma does not hit a separate PostgreSQL you may have on `localhost:5432`.

This password **must match** `POSTGRES_PASSWORD` in `infra/local/docker-compose.dev.yml` (currently `finnplay_dev_password`).

If you already started Postgres once with a different password, Docker keeps the old data volume. Reset it:

```bash
docker compose -f infra/local/docker-compose.dev.yml down -v
npm run dev:infra:up
```

(`down -v` removes the named volumes from this compose file so Postgres re-initializes with the current `POSTGRES_PASSWORD`.)
- `PYTHON_SERVICE_URL=http://localhost:8000`
- `AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true`
- `AZURE_STORAGE_CONTAINER_NAME=finnplay-images`

## 3) Start infra (postgres + azurite)

```bash
npm run dev:infra:up
```

Equivalent:

```bash
docker compose -f infra/local/docker-compose.dev.yml up -d
```

## 4) Run database migration

```bash
npm run dev:migrate-database
```

## 5) Create the first admin user

Public registration always creates a normal **user** account. Only admins can add games and ads, so bootstrap one admin after the database exists.

1. In `server/.env`, set (uncomment or add):

   - `ADMIN_USERNAME` — e.g. `admin`
   - `ADMIN_EMAIL` — login email for this admin
   - `ADMIN_PASSWORD` — strong password (change after first login if you like)

2. From the **repo root**:

```bash
npm run dev:create-admin
```

This script is **idempotent**: if that email or username already exists, that account is promoted to `admin` and the password is updated to `ADMIN_PASSWORD`.

## 6) Start app services with hot reload

Single command:

```bash
npm run dev
```

This starts:
- frontend (`client`)
- backend (`server`)
- **python-service** (required for admin analytics: dashboard, revenue breakdown, trending — these routes return **500** if FastAPI is down)

On Windows, `python-service` is started via root `package.json` → `venv\Scripts\python -m uvicorn ...` (see above). Ensure `POSTGRESQL_URL` is available to Python (via `server/.env` and/or `python-service/.env`).

## 7) Verify development mode

Check:
- Frontend: `http://localhost:3000`
- API health: `http://localhost:5000/api/health`
- Python health: `http://localhost:8000/health`
- Admin aggregates (as admin user, with JWT): `GET http://localhost:5000/api/analytics/dashboard` should return **200** when Python and Postgres are healthy (same data shape the Next admin UI consumes).

## 8) Stop development mode

Stop app processes: Ctrl+C in terminal.

Stop infra:

```bash
npm run dev:infra:down
```
