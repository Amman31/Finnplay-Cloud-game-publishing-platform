# FinnPlay — Game Publishing Platform

## New Here? Start Here

If you are new to cloud/deployment, follow this first:

- `docs/BEGINNER_STEP_BY_STEP.md`
- `docs/development-workflow.md` (Mode 1: coding workflow)
- `docs/deployment-local.md` (Mode 2: full local stack via **Docker Swarm** + Portainer, same topology as Azure, **HTTP** / no CI)
- `docs/deployment-azure.md` (Mode 3: Azure Swarm + CI/CD)

It explains:
- where frontend/backend/database run
- local deployment (first)
- Azure deployment (second)
- CI/CD with GitHub Actions (third)

A full-stack **game publishing platform** where developers can publish games and players can discover, purchase, and play them. The app is branded as **FinnPlay** (“Discover and play amazing games from Finnish developers”) and supports user accounts, game catalog, purchases, ratings, ads, and admin analytics.
![Home](home.png)
![Catalog](catalog.png)
---

## What This Project Does

- **Public**
  - Browse a catalog of games with categories, tags, and search.
  - View game details (description, price, ratings, publisher).
  - Register and log in (JWT-based auth).
  - Purchase games (tracked with transaction IDs).
  - Download/play purchased games; rate and review them (1–5 stars).
  - See promotional ads (banners, sidebar, etc.) with impression/click tracking.

- **Publishers / Admins**
  - Create, edit, and delete games (with cover image upload).
  - Publish or unpublish games.
  - Manage promotional ads (create, update, delete; track impressions/clicks).
  - View analytics: total games, published games, views, downloads, revenue breakdown, and per-game stats.
  - Manage users (CRUD) and create admin accounts.

- **Technical**
  - Tracks game **views**, **plays**, and **downloads** for analytics (events stored in PostgreSQL via Prisma).
  - Uses **PostgreSQL** (via Prisma) for all domain data, including raw analytics rows and sessions.
  - **Admin aggregate analytics** (dashboard KPIs, time series, revenue breakdown, trending) are computed in **Python (FastAPI + SQL)**; the API proxies to `python-service` with **no Prisma substitute** if Python is down.
  - **Recommendations** use Python when available, with a **Prisma-backed fallback** (top games) if the recommender fails.
  - Stores game/ad images in **Azure Blob Storage** and saves only image URLs in PostgreSQL.
  - REST API with auth middleware; optional real-time features via Socket.IO.

---

## Tech Stack

| Layer   | Technology |
|--------|------------|
| Frontend | **Next.js 15** (React 19), TypeScript, Tailwind CSS, Axios, Recharts, Socket.IO client |
| Backend  | **Node.js**, **Express 5**, TypeScript |
| Database | **PostgreSQL** (Prisma ORM) — users, games, purchases, ratings, ads, analytics, sessions |
| Processing | **Python FastAPI** — recommendations; admin dashboard / revenue / trending aggregates |
| Auth     | JWT (jsonwebtoken), bcrypt for passwords |
| File     | Multer for image uploads (game covers, ad images) |

---

## Project Structure

```
├── client/                 # Next.js frontend
│   ├── app/                # App Router pages
│   │   ├── admin/          # Admin dashboard, games, ads, analytics
│   │   ├── games/          # Game list, detail, purchase flow
│   │   ├── login, register, profile
│   │   └── ...
│   ├── components/         # Navbar, AdBanner, GameAdCard, etc.
│   ├── contexts/           # AuthContext
│   ├── lib/                # API client
│   └── config/             # env (API URL)
├── server/                 # Express API
│   ├── prisma/             # Prisma schema (PostgreSQL)
│   ├── src/
│   │   ├── controllers/    # apiController.ts — HTTP handlers
│   │   ├── middlewares/    # auth, upload
│   │   ├── db/             # PostgreSQL client/bootstrap
│   │   ├── routes/         # apiRoutes.ts — REST routes
│   │   ├── services/       # domainService.ts — Prisma + calls to python-service
│   │   └── scripts/        # createAdmin.ts — bootstrap first admin (via npm run create-admin)
│   └── ...
├── python-service/         # FastAPI microservice
├── infra/                  # Swarm, Traefik, Nginx, monitoring, Azure scripts
├── docs/                   # Architecture and deployment runbooks
├── package.json            # Root scripts (concurrently run client + server)
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Python** (3.13+ recommended)
- **PostgreSQL** (for users, games, purchases, ratings, ads)

### 1. Install dependencies

From the project root:

```bash
npm run install:all
```

This installs root, `server`, and `client` dependencies. **Python** dependencies are installed separately in `python-service` (`pip install -r requirements.txt` inside your venv); see `docs/development-workflow.md`.

### 2. Environment variables

**Server** (`server/` or root `.env`):

- `PORT` — API port (default `5000`)
- `POSTGRESQL_URL` — PostgreSQL connection string (required for Prisma)
- `JWT_SECRET` — Secret for signing JWTs
- `FRONTEND_URL` — Allowed origin for CORS (e.g. `http://localhost:3000`)
- `PYTHON_SERVICE_URL` — Base URL for the FastAPI service (local dev: `http://localhost:8000`; Docker/Swarm: `http://python-service:8000`)
- `AZURE_STORAGE_CONNECTION_STRING` — Azure Blob Storage connection string
- `AZURE_STORAGE_CONTAINER_NAME` — Blob container name for uploaded images

**Client** (`client/`):

- `NEXT_PUBLIC_API_URL` — API base URL (e.g. `http://localhost:5000/api`)

### 3. Database setup (PostgreSQL)

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

Create the **first admin** (required to add games and ads). In `server/.env` set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then:

```bash
npm run create-admin
```

Or from the **repo root**: `npm run dev:create-admin` (runs `cd server && npm run create-admin`).

In production Docker images, after `npm run build` in `server/`, use: `npm run create-admin:prod` (runs `node dist/src/scripts/createAdmin.js`).

### 4. Run the app

From the **project root**:

```bash
npm run dev
```

This runs:

- **API** at `http://localhost:5000` (or your `PORT`)
- **Next.js** at `http://localhost:3000`

Or run them separately:

- `npm run dev:server` — backend only  
- `npm run dev:client` — frontend only  

---

## Main Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run dev:infra:up` | Start dev infra (Postgres + Azurite) |
| `npm run dev:infra:down` | Stop dev infra |
| `npm run dev` | Run frontend + backend + python-service with reload |
| `npm run dev:full` | Start infra, then start all local dev services |
| `npm run dev:server` | Run API only |
| `npm run dev:client` | Run Next.js only |
| `npm run dev:python` | Run python-service only (reload) |
| `npm run local:build` | Mode 2 — build `server` / `client` / `python-service` images (needs root `.env` with `REGISTRY_PREFIX`, `IMAGE_TAG`, `NEXT_PUBLIC_API_URL`, …) |
| `npm run local:deploy` | Mode 2 — deploy **`infra/swarm/stack.local.yml`** (HTTP, `*.localhost`) |
| `npm run local:up` | Mode 2 — `local:build` then `local:deploy` |
| `npm run local:down` | Remove stack **`finnplay`** after a local full deploy |
| `npm run production:deploy` | Deploy **`infra/swarm/stack.yml`** (HTTPS — loads root `.env` then `docker stack deploy`; see `docs/deployment-azure.md`) |
| `npm run production:down` | Remove stack **`finnplay`** after a production-style deploy |

What each prefix means is under **`x-scripts-legend`** in root `package.json`.
| `npm run dev:create-admin` | Create or promote admin user (`server` needs `ADMIN_*` in `.env`) |
| `npm run dev:migrate-database` | `prisma generate` + `migrate dev` in `server/` |
| `npm run install:all` | Install deps in root, server, and client |

---

## API Overview

- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Users** — CRUD (admin): `GET/POST/PATCH/DELETE /api/users`
- **Games** — `GET /api/games`, `GET /api/games/:id`, create/update/delete/publish (auth), image upload
- **Purchases** — `POST /api/purchases`, `GET /api/purchases`, check ownership
- **Ratings** — `POST /api/ratings`, `GET /api/ratings/game/:gameId`
- **Ads** — CRUD, `POST /api/ads/:id/click` for click tracking
- **Analytics** — `GET /api/analytics/dashboard`, revenue breakdown, trending (admin / discovery; **require `python-service`**). Per-game and raw event stats remain on Node/Prisma where applicable.
- **AI/Processing** — `GET /api/recommendations/:userId` (Python + optional fallback)
- **Sessions** — create/get sessions (e.g. for download/play tokens)

Protected routes use the `Authorization: Bearer <token>` header.

---

## License

ISC (see `server/package.json`).
