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
4. A computer with **Terraform** (≥ 1.3), **Azure CLI**, **OpenSSH client**, and **Git** installed (`terraform`, `az`, `ssh`, `git` in a terminal). Terraform drives the recommended Azure provisioning path; the Azure CLI is still used for `az login` (unless you use a service principal) and for optional queries.

---

## Part 0 — Choose your hostnames (recommended)

Use one consistent pattern. Below we assume:

| Role | Hostname (DNS A record) |
|------|-------------------------|
| Web app (Next.js via Nginx) | `finnplay.xyz` |
| API | `api.finnplay.xyz` |
| Grafana | `grafana.finnplay.xyz` |
| Prometheus | `prometheus.finnplay.xyz` |
| Portainer | `portainer.finnplay.xyz` |
| Traefik dashboard | `traefik.finnplay.xyz` |

Your root `.env` on the manager must use **exactly** these values for `APP_HOST`, `API_HOST`, etc. (no `https://` in those variables).

---

## Part 1 — Create Azure resources (resource group + network + VMs)

**Recommended: Terraform** (`infra/terraform/azure/`). It declares the full Azure footprint for this project, lets Azure build resources in a consistent dependency order (which avoids many “resource not found” / provider-registration races), and gives you **`terraform plan`**, state, and **`terraform destroy`** for teardown.

Install [Terraform](https://developer.hashicorp.com/terraform/install) and the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli). Authenticate for Terraform using **one** of these:

- **Interactive (typical for students):** run `az login` and pick the subscription that has credits. The AzureRM provider uses your Azure CLI session by default.
- **CI / automation:** create a service principal and export `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`, and `ARM_SUBSCRIPTION_ID` (see [HashiCorp: authenticate to Azure with the Azure CLI](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/guides/azure_cli)).

### Option A — Terraform (recommended)

From the repository root:

1. **SSH key:** Terraform provisions Linux VMs with **public-key SSH only** (no `az vm create --generate-ssh-keys`). Use the **same** key pair you intend to use for **GitHub Actions CD** (`SWARM_MANAGER_SSH_KEY` must be the **private** key matching this public key).

   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/finnplay-azure -N ""
   ```

   Put the contents of **`~/.ssh/finnplay-azure.pub`** (or your existing `id_rsa.pub`) into `admin_ssh_public_key` in the next step.

2. **Variables:** copy the example tfvars and edit values (region, resource group name, VM size, public key).

   ```bash
   cd infra/terraform/azure
   cp terraform.tfvars.example terraform.tfvars
   ```

   At minimum set **`location`**, **`resource_group_name`**, **`admin_username`**, **`admin_ssh_public_key`**, and **`vm_size`** if you differ from the defaults.

3. **Install providers and apply:**

   ```bash
   terraform init
   terraform apply
   ```

   On first `apply`, a brand-new subscription may still be registering `Microsoft.Network` / `Microsoft.Compute`. If `apply` fails with provider or “not found” errors, run once on your machine, wait until both show **Registered**, then run **`terraform apply`** again:

   ```bash
   az provider register --namespace Microsoft.Network --wait
   az provider register --namespace Microsoft.Compute --wait
   ```

4. **Read outputs** (DNS, SSH, Swarm join all use these):

   ```bash
   terraform output manager_public_ip
   terraform output manager_private_ip
   terraform output worker_private_ip
   terraform output ssh_manager
   ```

   Save **`manager_public_ip`** as **`MANAGER_PUBLIC_IP`**, **`manager_private_ip`** as **`MANAGER_PRIVATE_IP`**, and **`worker_private_ip`** as **`WORKER_PRIVATE_IP`**.

**What Terraform creates** (names default with `name_prefix = "finnplay"`)

- Resource group (your `resource_group_name` variable)
- Virtual network + subnet (`10.10.0.0/16`, `10.10.1.0/24` by default; overridable in variables)
- NSG attached to the subnet, with rules for:
  - **TCP 22** (SSH), **TCP 80** (HTTP — Let’s Encrypt HTTP-01), **TCP 443** (HTTPS)
  - **Swarm:** TCP **2377**, TCP/UDP **7946**, UDP **4789** from **VirtualNetwork**
- **`finnplay-manager`** VM with a **static** public IP (`finnplay-manager-pip`)
- **`finnplay-worker`** VM **without** a public IP

**State:** by default Terraform writes **`terraform.tfstate`** in `infra/terraform/azure/`. That file is **secret-ish** (resource IDs) and is **gitignored**. Do not commit it. For team projects, configure a [remote backend](https://developer.hashicorp.com/terraform/language/settings/backends/azurerm) (optional).

**Teardown:** from `infra/terraform/azure/` run **`terraform destroy`** when you want to delete the resource group and everything inside it.

**Notes for Azure for Students**

- Default Terraform **`vm_size`** is **`Standard_B2ls_v2`** (Bsv2 burstable, 2 vCPU / 4 GiB) in **`westeurope`** by default. If **`SkuNotAvailable`** appears, set **`vm_size`** to another allowed SKU (e.g. **`Standard_B1s`**, **`Standard_B2s_v2`**) or change **`location`** / **`vm_zone`** (see troubleshooting table).
- Images: **Ubuntu 22.04 LTS** (Canonical Jammy marketplace image).

### Option B — Azure Portal (manual outline)

1. Portal → **Resource group** → create `finnplay-rg` (or your name) in your chosen region.
2. **Virtual network** → address space `10.10.0.0/16` → subnet `10.10.1.0/24`.
3. **Network security group** → attach to the subnet (or to each NIC) → rules as listed above.
4. **Linux VM** `finnplay-manager` → Ubuntu 22.04 → size **Standard_B2ls_v2** (or another allowed SKU) → subnet → **public IP** → SSH public key.
5. Second **Linux VM** `finnplay-worker` → same subnet → **no public IP** → same NSG rules via subnet or NIC.

### Get the manager public IP (DNS and SSH)

After Terraform:

```bash
cd infra/terraform/azure
terraform output -raw manager_public_ip
```

Or with the Azure CLI (works for Terraform-created VMs):

```bash
az vm show -d -g finnplay-rg -n finnplay-manager --query publicIps -o tsv
```

Save this value as **`MANAGER_PUBLIC_IP`**.

### Get the manager private IP (worker join uses this)

After Terraform:

```bash
terraform output -raw manager_private_ip
```

Or SSH to the manager (Part 2) and run:

```bash
hostname -I | awk '{print $1}'
```

Or from your laptop:

```bash
az vm list-ip-addresses -g finnplay-rg -n finnplay-manager -o table
```

Save the **private** IP as **`MANAGER_PRIVATE_IP`**.

### Worker private IP

```bash
cd infra/terraform/azure && terraform output -raw worker_private_ip
```

Or:

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

Use the **private** SSH key that matches **`admin_ssh_public_key`** in your `terraform.tfvars`. If you lose it, add a new public key in the Azure Portal (VM → Reset password / SSH public key).

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

The worker VM has **no public IP** in the default Terraform layout. From your **laptop**, open an SSH session **through the manager** (jump host):

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
| Terraform `apply` fails on **`azurerm_network_security_rule`** with **ResourceNotFound** for the NSG | Use the current repo config: rules are defined **inline** on `azurerm_network_security_group` (one ARM update). Pull latest `infra/terraform/azure/main.tf`, then **`terraform apply`** again. If state still lists old `azurerm_network_security_rule.*` resources, let Terraform destroy them on the next apply. |
| **`already exists` … `azurerm_network_interface` … needs to be imported** | A previous partial apply left the NIC in Azure but not in Terraform state. From `infra/terraform/azure/`, build the import ID (use your real subscription, resource group, and `name_prefix` from `terraform.tfvars`): `SUB="$(az account show --query id -o tsv)"` then `terraform import azurerm_network_interface.manager "/subscriptions/$SUB/resourceGroups/finnplay-rg/providers/Microsoft.Network/networkInterfaces/finnplay-manager-nic"`. After at least one successful apply, you can also use **`terraform output -raw manager_network_interface_import_id`**. Then run **`terraform apply`** again. Alternatively, delete the orphan NIC in the Azure Portal if it is **not** attached to a VM you need, then apply. |
| **`SkuNotAvailable`** for your chosen **`vm_size`** | Set **`vm_size`** to another SKU your subscription offers in that region (e.g. **`Standard_B1s`**, **`Standard_B2s_v2`**, **`Standard_B2ls_v2`**), change **`location`**, or set **`vm_zone = "1"`** / **`"2"`** / **`"3"`** (see `infra/terraform/azure/variables.tf`) and retry **`terraform apply`**. Manager and worker VMs are created **in sequence** so the first allocation error is easier to spot. |

---

## File reference

| Path | Role |
|------|------|
| `infra/terraform/azure/` | Terraform: resource group, VNet, subnet, NSG, public IP, two Ubuntu 22.04 VMs. |
| `infra/swarm/stack.yml` | Production Swarm stack (HTTPS, Let’s Encrypt). |
| `infra/traefik/traefik.yml` | Traefik static config (Swarm provider, ACME). |
| `infra/azure/bootstrap-swarm.sh` | Optional on-VM helper for Docker install + Swarm join (same commands as Parts 3–4). |
| `scripts/stack-deploy-production.cjs` | Loads `.env` + runs `docker stack deploy` (works when CLI has no `--env-file`). |
| `.github/workflows/ci.yml` | CI only. |
| `.github/workflows/cd.yml` | Build → push GHCR → SSH deploy. |

---

## Summary — ordered checklist

1. `az login` → **`cd infra/terraform/azure`**, configure `terraform.tfvars`, **`terraform init`** → **`terraform apply`** (or recreate the same layout manually in the Portal — Part 1, Option B).
2. NSG has **80/443/22** + **Swarm** ports (defined in Terraform).
3. SSH to manager → install Docker → `docker swarm init --advertise-addr <private IP>`.
4. SSH to worker → install Docker → `docker swarm join …`.
5. Manager: install **Node.js**, clone repo to `/opt/finnplay`, create `.env` with **`finnplay.xyz`** hostnames and secrets.
6. GoDaddy: **A** records for `app`, `api`, `grafana`, `prometheus`, `portainer`, `traefik` → **manager public IP**.
7. Build/push images to GHCR (or trigger CD after secrets).
8. Manager: `npm run production:deploy` (or `node scripts/stack-deploy-production.cjs` with exports).
9. `docker exec … prisma migrate deploy` and **`create-admin:prod`**.
10. Configure GitHub **variable** `API_HOST` and **secrets** for CD; push to `main` to verify pipeline.

You are then in **Mode 3** production: same topology as local Swarm, with real DNS and TLS on Azure.
