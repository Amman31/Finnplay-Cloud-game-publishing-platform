# Azure production deployment (Microsoft Azure for Students + GoDaddy + GitHub Actions)

This guide deploys the **FinnPlay** stack to **two Ubuntu VMs** on Azure, fronted by **Traefik** with **Let’s Encrypt HTTPS**, using your domain **`finnplay.xyz`** (example subdomains: `app.finnplay.xyz`, `api.finnplay.xyz`, …).

**What you will have at the end**

- Docker Swarm (1 manager + 1 worker)
- Traefik routing + TLS for all public hostnames
- Next.js (client), Express API (server), FastAPI (python-service), Postgres, Azurite **or** Azure Blob (you choose), Grafana, Prometheus, Loki, Promtail, Portainer
- **GitHub Actions** building images to **GHCR** and deploying to the manager over **SSH**

**Prerequisites checklist**

1. Microsoft account with **Azure for Students** (or any Azure subscription with quota for 2 small VMs).
2. **GoDaddy** control panel access for `finnplay.xyz`.
3. **GitHub** repository with this project code pushed to **`main`**.
4. A computer with **Azure CLI**, **OpenSSH client**, and **Git** installed (`az`, `ssh`, `git` in a terminal).

---

## Part 0 — Choose your hostnames (recommended)

Use one consistent pattern. Below we assume:

| Role | Hostname (DNS A record) |
|------|-------------------------|
| Web app (Next.js via Nginx) | `app.finnplay.xyz` |
| API | `api.finnplay.xyz` |
| Grafana | `grafana.finnplay.xyz` |
| Prometheus | `prometheus.finnplay.xyz` |
| Portainer | `portainer.finnplay.xyz` |
| Traefik dashboard | `traefik.finnplay.xyz` |

Your root `.env` on the manager must use **exactly** these values for `APP_HOST`, `API_HOST`, etc. (no `https://` in those variables).

---

## Part 1 — Create Azure resources (resource group + network + VMs)

You can use **either** the Azure Portal (click-through) **or** the automation script in this repo.

### Option A — Automated script (fastest)

From your **laptop**, in the repository root:

```bash
az login
```

Pick the subscription that has credits (Azure for Students).

```bash
bash infra/azure/setup-azure.sh finnplay-rg westeurope Standard_B2s azureuser
```

**What this script creates**

- Resource group: `finnplay-rg` (change the first argument if you want another name)
- Virtual network + subnet (`10.10.0.0/16`, `10.10.1.0/24`)
- Network security group (NSG) allowing:
  - **TCP 22** (SSH)
  - **TCP 80** (HTTP — needed for Let’s Encrypt HTTP-01 challenge)
  - **TCP 443** (HTTPS)
  - **Swarm**: TCP **2377**, TCP/UDP **7946**, UDP **4789** from **VirtualNetwork** (manager ↔ worker)
- **Manager VM** `finnplay-manager` with a **public IP** attached
- **Worker VM** `finnplay-worker` **without** a public IP (private only)

**Notes for Azure for Students**

- If a size like `Standard_B2s` is unavailable in your region, try `westeurope`, `northeurope`, or `eastus`, or a smaller size allowed by your subscription (e.g. `Standard_B1s` for class projects — less RAM; may be tight for everything at once).
- The script uses **Ubuntu 22.04** (`Ubuntu2204` image).

### Option B — Azure Portal (manual outline)

1. Portal → **Create a resource** → **Resource group** → name `finnplay-rg` → region **West Europe** (or your choice) → **Create**.
2. **Virtual network** → attach to `finnplay-rg` → address space e.g. `10.10.0.0/16` → subnet `10.10.1.0/24`.
3. **Network security group** → create rules matching the ports listed above (SSH, HTTP, HTTPS, Swarm ports from **VirtualNetwork**).
4. **Virtual machine** → `finnplay-manager` → Ubuntu 22.04 → size **B2s** (or allowed size) → place in VNet/subnet → **Public IP** enabled → attach NSG → create.
5. Second **VM** → `finnplay-worker` → same VNet/subnet → **no public IP** → same NSG → create.

### Get the manager public IP (you need it for DNS and SSH)

```bash
az vm show -d -g finnplay-rg -n finnplay-manager --query publicIps -o tsv
```

Save this value as **`MANAGER_PUBLIC_IP`**.

### Get the manager private IP (worker join uses this)

SSH to the manager (next section), then:

```bash
hostname -I | awk '{print $1}'
```

Or from laptop:

```bash
az vm list-ip-addresses -g finnplay-rg -n finnplay-manager -o table
```

Save the **private** IP as **`MANAGER_PRIVATE_IP`**.

### Worker private IP

```bash
az vm list-ip-addresses -g finnplay-rg -n finnplay-worker -o table
```

Save as **`WORKER_PRIVATE_IP`**.

---

## Part 2 — First SSH to the manager VM

Replace `MANAGER_PUBLIC_IP` and `azureuser` if you used a different admin name.

```bash
ssh azureuser@MANAGER_PUBLIC_IP
```

If `az vm create` generated keys, use the path Azure printed, or reset password/SSH key in Portal if needed.

---

## Part 3 — Install Docker and initialize Swarm (manager)

On the **manager** VM, install Docker and Swarm (script is in the repo — clone first **or** paste commands).

**Quick path (copy-paste on a fresh VM without the repo yet):**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# log out and SSH back in so "docker" group applies, OR:
newgrp docker
```

Initialize Swarm using the **private** IP as advertise address:

```bash
MANAGER_PRIVATE_IP="$(hostname -I | awk '{print $1}')"
docker swarm init --advertise-addr "$MANAGER_PRIVATE_IP"
```

Print the **worker join token**:

```bash
docker swarm join-token worker -q
```

Copy the entire token string — call it **`WORKER_JOIN_TOKEN`**.

---

## Part 4 — Join the worker VM to the Swarm

The worker VM has **no public IP** in the default script. From your **laptop**, open an SSH session **through the manager** (jump host):

```bash
ssh -J azureuser@MANAGER_PUBLIC_IP azureuser@WORKER_PRIVATE_IP
```

If your SSH client is older and does not support `-J`, SSH to the manager first, then from there:

```bash
ssh azureuser@WORKER_PRIVATE_IP
```

On the **worker** VM:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
docker swarm join --token WORKER_JOIN_TOKEN MANAGER_PRIVATE_IP:2377
```

Back on the **manager**:

```bash
docker node ls
```

You should see **two** nodes **Ready**, one **Leader**, one **Worker**.

---

## Part 5 — Install Node.js on the manager (required for deploy helper)

The production deploy script `scripts/stack-deploy-production.cjs` loads `.env` safely and runs `docker stack deploy`. The manager needs **Node.js** (any current LTS, e.g. 22).

On the **manager**:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

---

## Part 6 — Clone the repository on the manager

```bash
sudo mkdir -p /opt/finnplay
sudo chown -R "$USER:$USER" /opt/finnplay
cd /opt/finnplay
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git .
```

Use your real HTTPS clone URL. For private repos, use a **PAT** in the URL or SSH deploy key (GitHub docs).

**Git remote for CD:** GitHub Actions will run `git fetch` / `git reset --hard origin/main` in `/opt/finnplay`, so this directory must be a normal git checkout of **`main`**.

---

## Part 7 — Configure production `.env` on the manager

```bash
cd /opt/finnplay
cp .env.example .env
nano .env
```

Set at least the following (example values for **`finnplay.xyz`**):

```env
REGISTRY_PREFIX=ghcr.io/YOUR_GITHUB_USERNAME
IMAGE_TAG=latest

APP_HOST=app.finnplay.xyz
API_HOST=api.finnplay.xyz
GRAFANA_HOST=grafana.finnplay.xyz
PROMETHEUS_HOST=prometheus.finnplay.xyz
PORTAINER_HOST=portainer.finnplay.xyz
TRAEFIK_DASHBOARD_HOST=traefik.finnplay.xyz
TRAEFIK_ACME_EMAIL=your-real-email@example.com

POSTGRES_DB=finnplay
POSTGRES_USER=finnplay
POSTGRES_PASSWORD=STRONG_DB_PASSWORD_HERE
POSTGRESQL_URL=postgresql://finnplay:STRONG_DB_PASSWORD_HERE@postgres:5432/finnplay?schema=public

JWT_SECRET=LONG_RANDOM_SECRET_HERE
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=STRONG_GRAFANA_PASSWORD_HERE

FRONTEND_URL=https://app.finnplay.xyz

AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=finnplay-images
```

**Important**

- **`POSTGRESQL_URL`** must use hostname **`postgres`** (the Swarm service name), not `localhost`.
- **`FRONTEND_URL`** must be **`https://app.finnplay.xyz`** (matches Traefik + CORS).
- **`TRAEFIK_ACME_EMAIL`** is required for Let’s Encrypt registration.
- For **real Azure Blob Storage**, use your portal connection string. **Do not** use the Azurite `BlobEndpoint=http://azurite:...` string from local docs on Azure VMs unless you actually run Azurite there.
- **`AZURE_STORAGE_PUBLIC_ORIGIN`**: leave **empty** in real Azure if public blob URLs from the SDK are already HTTPS and browser-reachable. Use it only when you intentionally rewrite blob hosts (see `docs/deployment-local.md`).

**Image tags**

- For the **first** manual deploy you can set `IMAGE_TAG=latest` and build/push `latest` from your laptop or CI.
- After GitHub Actions CD runs, `IMAGE_TAG` will be the **git commit SHA**; the workflow exports `IMAGE_TAG` and `REGISTRY_PREFIX` during deploy — your `/opt/finnplay/.env` should still define defaults; the remote script **exports** SHA before `node scripts/stack-deploy-production.cjs` so it overrides `.env` for that deploy.

---

## Part 8 — GoDaddy DNS for `finnplay.xyz`

In GoDaddy: **My Products** → your domain **finnplay.xyz** → **DNS** → **Manage DNS**.

### 8.1 Apex domain (optional)

If you want `https://finnplay.xyz` later, add an **A** record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `MANAGER_PUBLIC_IP` | 600 |

This project’s Traefik rules use **subdomains** (`app`, `api`, …). The apex record is optional unless you add a router for it.

### 8.2 Required subdomains (A records to the manager)

Create **six** **A** records (same IP for all):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `app` | `MANAGER_PUBLIC_IP` | 600 |
| A | `api` | `MANAGER_PUBLIC_IP` | 600 |
| A | `grafana` | `MANAGER_PUBLIC_IP` | 600 |
| A | `prometheus` | `MANAGER_PUBLIC_IP` | 600 |
| A | `portainer` | `MANAGER_PUBLIC_IP` | 600 |
| A | `traefik` | `MANAGER_PUBLIC_IP` | 600 |

**Propagation:** wait a few minutes up to 48 hours. Verify from your laptop:

```bash
nslookup app.finnplay.xyz
```

It should return `MANAGER_PUBLIC_IP`.

---

## Part 9 — GitHub Container Registry (GHCR) and the manager’s ability to `docker pull`

GitHub Actions pushes images to:

`ghcr.io/<github-username>/finnplay-{server,client,python-service}:<tag>`

### Public packages (simplest for class projects)

In GitHub: your profile (or org) → **Packages** → each package → **Package settings** → **Change visibility** → **Public** (if policy allows).

Then the Azure VM can `docker pull` **without** logging in.

### Private packages (recommended for real projects)

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → create a token with at least **`read:packages`** (classic) or fine-grained equivalent to pull GHCR images.
2. On the **manager** VM (one-time):

```bash
echo 'YOUR_TOKEN_HERE' | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

3. Store the same token as GitHub secret **`GHCR_PULL_TOKEN`** (see Part 12) so CI can log in on the server before deploy.

---

## Part 10 — First production deploy (manual, on the manager)

**DNS must already resolve** to the manager IP before Traefik can obtain certificates.

```bash
cd /opt/finnplay
export IMAGE_TAG=latest
export REGISTRY_PREFIX=ghcr.io/YOUR_GITHUB_USERNAME
node scripts/stack-deploy-production.cjs
```

If you prefer the npm script (requires `package.json` deps installed on the VM — usually unnecessary):

```bash
cd /opt/finnplay
export IMAGE_TAG=latest
export REGISTRY_PREFIX=ghcr.io/YOUR_GITHUB_USERNAME
npm run production:deploy
```

**You must have pushed images** `finnplay-server:latest`, `finnplay-client:latest`, `finnplay-python-service:latest` to GHCR under your `REGISTRY_PREFIX` first (build from laptop or wait for GitHub Actions after configuring secrets).

Check services:

```bash
docker stack services finnplay
docker service ps finnplay_traefik
docker service logs finnplay_traefik --tail 80
```

Open in a browser:

- `https://app.finnplay.xyz`
- `https://api.finnplay.xyz/api/health`

---

## Part 11 — Database migrations and first admin

### 11.1 Prisma migrate (on the manager)

Find a running server task:

```bash
docker service ps finnplay_server
docker ps --filter name=finnplay_server
```

Run migrations inside the container (replace container id):

```bash
docker exec -it CONTAINER_ID npx prisma migrate deploy
```

### 11.2 Create first admin user

Still inside that container:

```bash
docker exec -e ADMIN_USERNAME=admin -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='choose-strong-password' -it CONTAINER_ID npm run create-admin:prod
```

---

## Part 12 — GitHub Actions CD (build, push, deploy)

Workflow file: **`.github/workflows/cd.yml`**

### 12.1 Repository variable (Settings → Secrets and variables → Actions → **Variables**)

| Name | Example value | Purpose |
|------|----------------|---------|
| `API_HOST` | `api.finnplay.xyz` | **Hostname only**, no `https://`. Passed at **client image build** time as `NEXT_PUBLIC_API_URL=https://<API_HOST>/api`. |

### 12.2 Repository secrets (Settings → Secrets and variables → Actions → **Secrets**)

| Name | Purpose |
|------|---------|
| `SWARM_MANAGER_HOST` | Manager **public IP** or DNS name (SSH target). |
| `SWARM_MANAGER_USER` | SSH user (e.g. `azureuser`). |
| `SWARM_MANAGER_SSH_KEY` | **Private** key (full PEM multiline), matching the public key on the manager’s `~/.ssh/authorized_keys`. |
| `GHCR_PULL_TOKEN` | **Optional** — PAT with `read:packages` if GHCR images are **private**. If omitted, images must be **public** or the manager must already be logged in to GHCR. |

### 12.3 What CD does on each push to `main`

1. Logs in to GHCR as `github.actor` with `GITHUB_TOKEN` (push images).
2. Builds and pushes three images tagged with the commit SHA `github.sha`.
3. SSHs to the manager, runs `git fetch` / `git reset --hard origin/main`, exports `IMAGE_TAG` and `REGISTRY_PREFIX`, optionally `docker login ghcr.io`, then **`node scripts/stack-deploy-production.cjs`**.

### 12.4 Manual run

Actions → **CD** → **Run workflow**.

### 12.5 CI (tests / builds on PR and push)

Workflow: **`.github/workflows/ci.yml`** — runs server/client/python checks on GitHub-hosted runners (no deploy).

---

## Part 13 — Operations commands (manager)

```bash
docker stack services finnplay
docker service logs finnplay_server --tail 100
docker service logs finnplay_traefik --tail 100
docker service update --force finnplay_client
```

Remove stack:

```bash
cd /opt/finnplay
npm run production:down
```

---

## Part 14 — Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Let’s Encrypt / certificate errors | Port **80** open to the internet; DNS **A** records point to manager; `TRAEFIK_ACME_EMAIL` set; wait for DNS propagation. |
| `docker node` not Ready on worker | NSG allows Swarm ports **2377 / 7946 / 4789** from Virtual Network; worker joined with **manager private IP**. |
| 502 from Traefik | `docker service logs` for **nginx**, **client**, **server**; confirm `traefik.swarm.network=finnplay_public` in `stack.yml` matches stack name **`finnplay`**. |
| GHCR pull denied | Set **`GHCR_PULL_TOKEN`** or make packages public; `docker login` on manager. |
| CD fails “Install Node.js” | Install Node on manager (Part 5). |

---

## File reference

| Path | Role |
|------|------|
| `infra/swarm/stack.yml` | Production Swarm stack (HTTPS, Let’s Encrypt). |
| `infra/traefik/traefik.yml` | Traefik static config (Swarm provider, ACME). |
| `infra/azure/setup-azure.sh` | Creates RG, VNet, NSG, two VMs. |
| `infra/azure/bootstrap-swarm.sh` | Reference for Docker install + join (optional if you followed Parts 3–4). |
| `scripts/stack-deploy-production.cjs` | Loads `.env` + runs `docker stack deploy` (works when CLI has no `--env-file`). |
| `.github/workflows/ci.yml` | CI only. |
| `.github/workflows/cd.yml` | Build → push GHCR → SSH deploy. |

---

## Summary — ordered checklist

1. `az login` → run `infra/azure/setup-azure.sh …` (or create resources in Portal).
2. NSG has **80/443/22** + **Swarm** ports (script includes them).
3. SSH to manager → install Docker → `docker swarm init --advertise-addr <private IP>`.
4. SSH to worker → install Docker → `docker swarm join …`.
5. Manager: install **Node.js**, clone repo to `/opt/finnplay`, create `.env` with **`finnplay.xyz`** hostnames and secrets.
6. GoDaddy: **A** records for `app`, `api`, `grafana`, `prometheus`, `portainer`, `traefik` → **manager public IP**.
7. Build/push images to GHCR (or trigger CD after secrets).
8. Manager: `npm run production:deploy` (or `node scripts/stack-deploy-production.cjs` with exports).
9. `docker exec … prisma migrate deploy` and **`create-admin:prod`**.
10. Configure GitHub **variable** `API_HOST` and **secrets** for CD; push to `main` to verify pipeline.

You are then in **Mode 3** production: same topology as local Swarm, with real DNS and TLS on Azure.
