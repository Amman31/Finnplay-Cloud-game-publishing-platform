# Local Full Stack — Docker Swarm (Mode 2)

This mode mirrors **Azure production** (same `infra/swarm/stack.yml` topology: Traefik, Nginx, client, server, `python-service`, Postgres, Prometheus, Loki, Promtail, Grafana, **Portainer** + agent) but:

- runs on a **single-machine Docker Swarm** (Docker Desktop or Linux)
- uses **`infra/swarm/stack.local.yml`** — **HTTP only** on port **80** (no GitHub Actions, no Let’s Encrypt)
- uses **\*.localhost** hostnames (no real DNS)
- builds images locally (`infra/local/docker-compose.build.yml`) instead of CI pushing to a registry

**Production / HTTPS** on real domains still uses **`infra/swarm/stack.yml`** (see `docs/deployment-azure.md`).

## What runs (same services as Azure stack)

| Piece | Notes |
|--------|--------|
| **Traefik** | Swarm provider, routes by `Host()` on entrypoint `web` |
| **Nginx** | Serves Next.js via `APP_HOST` |
| **client / server / python-service** | Same images names as Azure: `${REGISTRY_PREFIX}/finnplay-*:${IMAGE_TAG}` |
| **postgres** | Overlay network; also published **`localhost:5433` → 5432** for host tools |
| **azurite** | Blob emulator; published **`localhost:10000`**; server uses Docker DNS **`azurite`** in connection string |
| **Prometheus, Loki, Promtail, Grafana** | Same as Azure stack |
| **Portainer CE + agent** | Same as Azure stack (`PORTAINER_HOST`) |

## 1) Prerequisites

- **Docker Desktop** (Windows/macOS) or Docker Engine on Linux with Swarm enabled
- **No GitHub Actions** — you build images yourself
- Stop **Mode 1** dev Postgres (`npm run dev:infra:down`) if it uses port **5433**, or you will get a port bind error on Postgres.

## 2) Initialize Swarm (once per machine)

```bash
docker swarm init
```

If Swarm is already initialized, Docker will say so; that is fine.

## 3) Configure `.env` at the repository root

```bash
cp .env.example .env
```

Set at least:

| Variable | Local Swarm example |
|----------|---------------------|
| `REGISTRY_PREFIX` | e.g. `ghcr.io/your-github-username` (images are **tagged** locally; nothing is pushed unless you choose to) |
| `IMAGE_TAG` | e.g. `local` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Must match `POSTGRESQL_URL` credentials |
| `POSTGRESQL_URL` | `postgresql://finnplay:YOUR_PASSWORD@postgres:5432/finnplay?schema=public` (hostname **`postgres`**, port **5432** inside the overlay) |
| `JWT_SECRET` | Strong secret |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana login |
| `FRONTEND_URL` | e.g. `http://app.localhost` (must match browser origin for CORS) |
| `NEXT_PUBLIC_API_URL` | e.g. `http://api.localhost/api` — **baked into the client image at build time** |
| `AZURE_STORAGE_CONNECTION_STRING` | Use the **Azurite** string pointing at the **`azurite`** service (see below) |
| `AZURE_STORAGE_CONTAINER_NAME` | e.g. `finnplay-images` |
| `AZURE_STORAGE_PUBLIC_ORIGIN` | Optional override for blob URLs in API responses (see Azurite block; if omitted, `http://azurite:...` is rewritten to `http://127.0.0.1:10000` automatically) |

**HTTP hostnames** (resolve to `127.0.0.1` on many systems; if not, add them to your hosts file):

```env
APP_HOST=app.localhost
API_HOST=api.localhost
GRAFANA_HOST=grafana.localhost
PROMETHEUS_HOST=prometheus.localhost
PORTAINER_HOST=portainer.localhost
TRAEFIK_DASHBOARD_HOST=traefik.localhost
```

**Azurite** (from containers on the `internal` network; matches common Azurite defaults):

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;
AZURE_STORAGE_PUBLIC_ORIGIN=http://127.0.0.1:10000
```

The API still talks to Azurite using `BlobEndpoint=http://azurite:10000/...`. By default the server **rewrites** `http://azurite:...` blob URLs to **`http://127.0.0.1:10000`** for the browser (same port you publish in `stack.local.yml`). Set **`AZURE_STORAGE_PUBLIC_ORIGIN`** only if you need a different public host or port. Omit in real Azure when blob URLs are already public HTTPS.

`TRAEFIK_ACME_EMAIL` is **not** required for `stack.local.yml`.

## 4) Build images (no CI)

From the **repository root** (where `.env` lives):

```bash
npm run local:build
```

Equivalent:

```bash
docker compose -f infra/local/docker-compose.build.yml --env-file .env build
```

This tags `finnplay-server`, `finnplay-client`, and `finnplay-python-service` with `${REGISTRY_PREFIX}/...:${IMAGE_TAG}`.

## 5) Deploy the stack

```bash
npm run local:deploy
```

One-shot (build + deploy):

```bash
npm run local:up
```

Equivalent to `local:up`:

```bash
docker compose -f infra/local/docker-compose.build.yml --env-file .env build
node scripts/stack-deploy-local.cjs
```

Deploy **must** be run from the **repo root** so bind mounts such as `../traefik/traefik.local.yml` resolve correctly relative to `infra/swarm/stack.local.yml`.

## 6) Database migrations

Find a running **server** task container, then run Prisma inside it:

```bash
docker service ps finnplay_server
docker ps --filter name=finnplay_server
```

Then (replace `<container_id>`):

```bash
docker exec -it <container_id> npx prisma migrate deploy
```

For first-time schema creation you may use `migrate dev` instead of `deploy` only if acceptable for a throwaway DB.

## 7) Create the first admin user

```bash
docker exec -e ADMIN_USERNAME=admin -e ADMIN_EMAIL=admin@localhost -e ADMIN_PASSWORD=YourStrongPassword -it <container_id> npm run create-admin:prod
```

Or pass env in one line as in `docs/deployment-azure.md`. **Admin analytics** need **`python-service`** healthy.

## 8) Verify

- **App:** `http://app.localhost` (through Traefik → Nginx → client)
- **API:** `http://api.localhost/api/health`
- **Traefik dashboard:** `http://traefik.localhost`
- **Portainer:** `http://portainer.localhost`
- **Grafana:** `http://grafana.localhost`
- **Prometheus:** `http://prometheus.localhost`
- **Postgres from host:** `localhost:5433`
- **Azurite from host:** `http://127.0.0.1:10000`

```bash
docker stack services finnplay
```

### Portainer: “New Portainer installation … timed out for security purposes”

On a **new** Portainer CE install you must create the first admin user within a few minutes. If the UI was unreachable (for example while Traefik was still misconfigured) or the tab sat idle, Portainer locks itself and shows `timeout.html` until you **restart the Portainer service** (this is [documented by Portainer](https://docs.portainer.io/faqs/installing/your-portainer-instance-has-timed-out-for-security-purposes-error-fix)).

From the repo host:

```bash
docker service update --force finnplay_portainer
```

Then open **`http://portainer.localhost/`** (not `timeout.html` directly), finish **Create admin**, and within the same session add a **Docker Swarm** environment if prompted (this stack already points Portainer at `tasks.portainer-agent:9001`).

If a forced update still leaves you on the timeout page, remove the stack and the Portainer volume, then deploy again (you will lose Portainer’s saved settings only):

```bash
npm run local:down
docker volume rm finnplay_portainer_data
npm run local:up
```

## 9) Remove the stack

```bash
npm run local:down
```

Equivalent: `docker stack rm finnplay`. The same command is what **`npm run production:down`** runs (only one stack named `finnplay` at a time).

## Azure vs local (quick reference)

| | Local Swarm (`stack.local.yml`) | Azure (`stack.yml` + CD) |
|---|----------------|--------------------------|
| Orchestration | Docker Swarm | Docker Swarm |
| TLS | HTTP on `:80` | HTTPS (Let’s Encrypt) on `:443` |
| Images | `npm run local:build` | GitHub Actions build + push |
| Domains | `*.localhost` | Real DNS `APP_HOST`, `API_HOST`, … |
