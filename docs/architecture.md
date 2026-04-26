# FinnPlay Cloud Architecture

FinnPlay is deployed as microservices on **Docker Swarm** (production uses `infra/swarm/stack.yml` with HTTPS; **local full stack** uses `infra/swarm/stack.local.yml` with HTTP — see `docs/deployment-local.md`).

- `client` (Next.js) provides UI.
- `nginx` fronts `client` service internally.
- `server` (Node + Express + JWT) exposes REST API.
- `python-service` (FastAPI) provides **recommendations**, **admin dashboard aggregates**, **revenue breakdown**, and **trending** (SQL over PostgreSQL). The Node API proxies these routes to Python; there is **no** Prisma substitute for those aggregates if Python is unavailable.
- `postgres` stores all relational and analytics/session data.
- `traefik` routes external traffic (HTTPS in production; **HTTP** on port 80 for `stack.local.yml`).
- `prometheus`, `loki`, `grafana` provide observability.
- `portainer` manages the swarm cluster.

## Request flow
1. Browser requests `https://app.domain.com`.
2. Traefik routes to `nginx` then to `client`.
3. Client calls `https://api.domain.com/api/...`.
4. API reads/writes PostgreSQL (Prisma) for domain data and raw analytics events.
5. For aggregate admin analytics (`/api/analytics/dashboard`, `/api/analytics/revenue-breakdown`, `/api/analytics/trending`), the API calls **`python-service`** over the internal URL `PYTHON_SERVICE_URL` (e.g. `http://python-service:8000` on the Docker network).
6. For `GET /api/recommendations/:userId`, the API prefers **`python-service`** but may fall back to a simple Prisma-based list if the recommender errors.

## Python ↔ database URL

`POSTGRESQL_URL` is often shared with Prisma and may include `?schema=public`. **psycopg** rejects the `schema` URI parameter; the Python app normalizes the URL (drops `schema=`) before connecting.

## Security boundaries
- Only `traefik` is exposed on 80/443.
- App-to-app communication uses private overlay networks.
- JWT is validated on protected API routes.
- Monitoring/admin UIs are exposed on separate subdomains and should use strong credentials.
