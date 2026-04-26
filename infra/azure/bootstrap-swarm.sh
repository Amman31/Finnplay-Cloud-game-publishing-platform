#!/usr/bin/env bash
set -euo pipefail

# Run on manager and worker nodes.
# Manager:
#   ./bootstrap-swarm.sh manager
# Worker:
#   ./bootstrap-swarm.sh worker <manager_private_ip> <join_token>

ROLE="${1:-manager}"

curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

if [[ "$ROLE" == "manager" ]]; then
  PRIVATE_IP="$(hostname -I | awk '{print $1}')"
  docker swarm init --advertise-addr "$PRIVATE_IP" || true
  echo "Manager token:"
  docker swarm join-token worker -q
  exit 0
fi

MANAGER_IP="${2:-}"
JOIN_TOKEN="${3:-}"
if [[ -z "$MANAGER_IP" || -z "$JOIN_TOKEN" ]]; then
  echo "Usage for worker: ./bootstrap-swarm.sh worker <manager_private_ip> <join_token>"
  exit 1
fi

docker swarm join --token "$JOIN_TOKEN" "${MANAGER_IP}:2377"
echo "Worker joined swarm."
