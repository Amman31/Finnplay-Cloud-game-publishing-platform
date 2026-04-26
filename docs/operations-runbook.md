# Operations Runbook

## Operating modes
- Mode 1: Development (local app processes + docker postgres/azurite)
- Mode 2: Local full Docker Swarm (`stack.local.yml`, HTTP)
- Mode 3: Azure Docker Swarm production deployment

## Mode-specific quick start

### Mode 1 (development)
- `npm run dev:infra:up`
- `npm run dev`

### Mode 2 (local full stack — same topology as Azure, HTTP)
- `docker swarm init` (once)
- `npm run local:up` (build + deploy `stack.local.yml`; see `docs/deployment-local.md`)
- `npm run local:down`

### Mode 3 (Azure / HTTPS `stack.yml`)
- `npm run production:deploy` (loads repo root `.env` via `scripts/stack-deploy-production.cjs`, then `docker stack deploy`; see `docs/deployment-azure.md`)
- `npm run production:down`

## Common commands
- List services: `docker service ls`
- Rolling update: `docker service update --force finnplay_server`
- Redeploy stack: `npm run production:deploy` (from repo root on the manager, with `.env` present)
- Check logs: `docker service logs finnplay_server -f`

## Incident checklist
1. Confirm Traefik is running.
2. Check API health endpoint.
3. Validate PostgreSQL connectivity from API container.
4. Validate **python-service** (`/health` on port 8000 internally). If it is down, **admin analytics** (`/api/analytics/dashboard`, revenue breakdown, trending) return **500** — there is no Prisma fallback for those aggregates.
5. From the server container, confirm `PYTHON_SERVICE_URL` resolves to the `python-service` task (typically `http://python-service:8000` on the Swarm network).
6. Check Prometheus target status and Grafana logs.

## Backup strategy
- PostgreSQL:
  - Daily `pg_dump` cron job from manager VM.
  - Retain last 7 daily backups and weekly snapshots.
- Grafana:
  - Back up `grafana_data` volume weekly.

## Secret rotation
- Rotate `JWT_SECRET`, database password, Grafana admin password each release cycle.
- Update `.env` and redeploy stack.

## Demo checklist
- Register/login works (JWT flow).
- Browse games and purchase/download flow works.
- Rating and reviews work.
- **python-service** is running; admin **analytics dashboard** loads (data from FastAPI, not Prisma aggregates).
- `/api/recommendations/:userId` returns recommendations (Python, or fallback list if recommender errors).
- `/api/analytics/trending` returns trending list (Python only).
- Grafana dashboards show metrics.
- Loki shows service logs.
- Portainer shows Swarm services and nodes.
