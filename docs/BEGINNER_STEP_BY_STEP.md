# FinnPlay Beginner Step-by-Step Deployment Guide

This guide is written for beginners. Follow it in order.

If something fails, stop and fix that step before moving on.

## 0) Understand Your System (Very Important)

Your app has these parts:

- `client` = Frontend (Next.js UI)
- `server` = Backend API (Node.js + Express + JWT)
- `python-service` = Processing microservice (FastAPI: recommendations + **admin aggregate analytics** — dashboard, revenue, trending)
- `postgres` = Database (PostgreSQL, all data)
- `traefik` = Public reverse proxy + HTTPS
- `nginx` = Frontend reverse proxy in container network
- `prometheus` + `loki` + `grafana` = monitoring/logging
- `portainer` = visual management UI for Docker Swarm

## 1) Where Frontend, Backend, and Database Are Deployed

### Locally
- Frontend, backend, python-service, postgres all run as Docker services on your machine.
- Traefik receives incoming traffic and routes to:
  - frontend host -> Nginx -> client
  - api host -> server
- Database runs as `postgres` container volume-backed (`postgres_data`).

### On Azure (2 VM Swarm)
- You have:
  - VM 1: Swarm manager (public IP)
  - VM 2: Swarm worker (private)
- Docker Swarm schedules services across these VMs.
- Traefik runs on manager and exposes ports 80/443.
- Database can be:
  - Option A (simple): PostgreSQL container in your Swarm stack
  - Option B (better): Azure Database for PostgreSQL Flexible Server

## 2) Prerequisites Checklist

Before deployment, install and verify:

- Git
- Docker Desktop (local testing)
- Node.js 22+
- Python 3.13+ (or 3.12+)
- Azure CLI (`az`)
- A GitHub repo for this project
- A domain name (for HTTPS in Azure), or use temporary hostnames for local testing

## 3) Local Deployment (First Milestone)

Do this first. Azure comes after local works.

### Step 3.1: Configure environment

At repo root:

1. Copy `.env.example` to `.env`
2. Fill values (Swarm / Azure style; see `docs/deployment-local.md` for the **local HTTP** variant with `*.localhost` and **Azurite**):
   - `JWT_SECRET` = long random string
   - `POSTGRES_PASSWORD` = strong password (must match `POSTGRESQL_URL`)
   - `POSTGRESQL_URL` = container URL format:
     `postgresql://finnplay:<password>@postgres:5432/finnplay?schema=public`
   - `AZURE_STORAGE_CONNECTION_STRING` = Azure Blob in production; for **local Swarm** use the **Azurite** string from `docs/deployment-local.md`
   - `AZURE_STORAGE_CONTAINER_NAME` = `finnplay-images`
   - `REGISTRY_PREFIX` and `IMAGE_TAG` for images (`npm run local:build`)
   - For local Swarm also: `NEXT_PUBLIC_API_URL`, `FRONTEND_URL`, and `APP_HOST` / `API_HOST` / … (see deployment-local)

Also copy service env examples if needed:

- `server/.env.example` -> `server/.env`
- `client/.env.example` -> `client/.env.local`
- `python-service/.env.example` -> `python-service/.env` (optional if `server/.env` already sets `POSTGRESQL_URL`; FastAPI still loads `server/.env` for the DB URL)

**Coding on your machine (Mode 1)** — migrate Postgres, start `python-service`, then create the first admin from the repo root: `npm run dev:create-admin` (requires `ADMIN_*` in `server/.env`). Full steps: `docs/development-workflow.md`.

### Step 3.1.1: Create Python venv (development mode, Mode 1)

Use a local virtual environment inside `python-service`. Root `npm run dev` uses **`python-service/venv`** on Windows (see root `package.json` → `dev:python`).

```bash
cd python-service
python -m venv venv
```

Activate it:

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
cd ..
```

On macOS/Linux, if you do not use the Windows `dev:python` script, start FastAPI manually from `python-service/`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3.2: Configure `.env` for local Swarm

Use the same **`POSTGRESQL_URL`** shape as in Step 3.1 (`...@postgres:5432/...`). For **HTTP** routing and **Azurite**, follow **`docs/deployment-local.md`** (hostnames like `app.localhost`, `NEXT_PUBLIC_API_URL`, blob connection string).

### Step 3.3: Build Swarm images

From repo root (requires `.env` with `REGISTRY_PREFIX`, `IMAGE_TAG`, `NEXT_PUBLIC_API_URL`, etc.):

```bash
npm run local:build
```

### Step 3.4: Initialize Docker Swarm (local)

```bash
docker swarm init
```

If already initialized, Docker will tell you. That is fine.

### Step 3.5: Deploy local stack (HTTP, same topology as Azure)

From repo root:

```bash
npm run local:deploy
```

Shortcut (build + deploy): `npm run local:up`.

For a **HTTPS / Let’s Encrypt** trial on real DNS (advanced), use `npm run production:deploy` (same as `docker stack deploy -c infra/swarm/stack.yml finnplay`; export env vars first — see `docs/deployment-azure.md`).

### Step 3.6: Verify local services

```bash
docker service ls
docker service ps finnplay_server
docker service logs finnplay_server --tail 100
```

Health / UI (HTTP local Swarm; see `docs/deployment-local.md`):

- App: `http://app.localhost`
- API health: `http://api.localhost/api/health`
- Portainer: `http://portainer.localhost`

## 4) Azure Deployment (Second Milestone)

## Step 4.1: Login and create Azure infra

```bash
az login
bash infra/azure/setup-azure.sh finnplay-rg westeurope Standard_B2s azureuser
```

This creates:

- resource group
- VNet/subnet
- NSG
- manager VM (public IP)
- worker VM (private)

## Step 4.2: SSH into manager and worker, install Swarm

On manager:

```bash
bash infra/azure/bootstrap-swarm.sh manager
```

Copy worker join token from output.

On worker:

```bash
bash infra/azure/bootstrap-swarm.sh worker <manager_private_ip> <join_token>
```

Check on manager:

```bash
docker node ls
```

You should see 2 nodes.

## Step 4.3: Prepare app directory on manager

```bash
sudo mkdir -p /opt/finnplay
sudo chown -R $USER:$USER /opt/finnplay
cd /opt/finnplay
git clone <your-repo-url> .
```

## Step 4.4: Create production `.env`

```bash
cp .env.example .env
```

Fill production values:

- real domains (`APP_HOST`, `API_HOST`, etc.)
- strong secrets (`JWT_SECRET`, DB passwords)
- registry prefix and image tag

## Step 4.5: Configure DNS

Point A records to manager VM public IP:

- `app.yourdomain.com`
- `api.yourdomain.com`
- `grafana.yourdomain.com`
- `prometheus.yourdomain.com`
- `portainer.yourdomain.com`
- `traefik.yourdomain.com`

## Step 4.6: Deploy stack on Azure

```bash
cd /opt/finnplay
docker stack deploy -c infra/swarm/stack.yml finnplay
```

Then verify:

```bash
docker service ls
docker service logs finnplay_traefik --tail 100
docker service logs finnplay_server --tail 100
```

## Step 4.7: HTTPS

Traefik + Let's Encrypt are already configured in `infra/traefik/traefik.yml`.
When DNS is correct and ports 80/443 are open, certificates are created automatically.

## 5) Database Location and Options

### Current default
- Database is PostgreSQL container service in Swarm (`postgres` service).
- Data is in Docker volume `postgres_data`.

### Better production option
- Use Azure Database for PostgreSQL Flexible Server.
- Update only `POSTGRESQL_URL` in `.env` and redeploy stack.
- Keep app services in Swarm, DB managed by Azure.

## 6) CI/CD with GitHub Actions (Beginner Steps)

You already have:

- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`

## Step 6.1: Push repo to GitHub

Make sure your default branch is `main`.

## Step 6.2: Add repository secrets

In GitHub -> Settings -> Secrets and variables -> Actions, add:

- `SWARM_MANAGER_HOST` = manager public IP or DNS
- `SWARM_MANAGER_USER` = VM SSH user (for example `azureuser`)
- `SWARM_MANAGER_SSH_KEY` = private key content used by GitHub Action

Optional if you switch to custom registry auth:
- `REGISTRY_USERNAME`
- `REGISTRY_PASSWORD`

## Step 6.3: What CI does

On PR/push:
- install dependencies
- generate prisma client
- build server
- lint/build client
- install python deps

## Step 6.4: What CD does

On push to `main`:
- build Docker images
- push to GHCR
- SSH to manager VM
- run `docker stack deploy`

## 7) First Demo Checklist

After deployment, verify:

1. Open frontend URL and browse games.
2. Register/login works.
3. API works at `/api/health`.
4. Purchase and rating workflows work.
5. Recommendations endpoint returns data: `/api/recommendations/<user-id>` (Python, or Prisma-backed fallback if the recommender fails).
6. Trending endpoint returns data: `/api/analytics/trending` (**Python only** — requires healthy `python-service`).
7. As an admin, open **Admin → Analytics**; the dashboard should load only when **python-service** and Postgres are up (no Prisma substitute for these aggregates).
8. Grafana opens and shows panels.
9. Portainer opens and shows services.

## 8) Common Beginner Mistakes

- Wrong `.env` values (especially `POSTGRESQL_URL`, `PYTHON_SERVICE_URL`).
- Admin analytics 500s: **python-service** not running, wrong `PYTHON_SERVICE_URL`, or DB URL issues (Prisma `?schema=public` is normalized in Python — see `docs/architecture.md`).
- DNS not pointing to manager IP.
- Ports 80/443 blocked by NSG.
- Using private image tags in stack that were never pushed.
- Running Azure steps before local deployment works.

## 9) Safest Execution Order for You

1. Local deploy working.
2. Azure VMs and Swarm working.
3. Azure stack deploy manually working.
4. CI passing.
5. CD auto-deploy working.

If you want, next I can create a second document with only copy-paste commands (no explanations) as a fast execution checklist.
