#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./infra/azure/setup-azure.sh <resource_group> <location> <vm_size> <admin_username>

RG_NAME="${1:-finnplay-rg}"
LOCATION="${2:-westeurope}"
VM_SIZE="${3:-Standard_B2s}"
ADMIN_USER="${4:-azureuser}"
VNET_NAME="finnplay-vnet"
SUBNET_NAME="finnplay-subnet"
NSG_NAME="finnplay-nsg"
PIP_NAME="finnplay-manager-pip"

az group create --name "$RG_NAME" --location "$LOCATION"

az network vnet create \
  --resource-group "$RG_NAME" \
  --name "$VNET_NAME" \
  --address-prefixes 10.10.0.0/16 \
  --subnet-name "$SUBNET_NAME" \
  --subnet-prefixes 10.10.1.0/24

az network nsg create --resource-group "$RG_NAME" --name "$NSG_NAME"
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowSSH --priority 100 --destination-port-ranges 22 --access Allow --protocol Tcp
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowHTTP --priority 110 --destination-port-ranges 80 --access Allow --protocol Tcp
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowHTTPS --priority 120 --destination-port-ranges 443 --access Allow --protocol Tcp

# Docker Swarm (manager ↔ worker overlay). See https://docs.docker.com/engine/swarm/networking/
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowSwarmTCP2377 --priority 130 \
  --access Allow --protocol Tcp --direction Inbound \
  --source-address-prefixes VirtualNetwork --source-port-ranges '*' \
  --destination-address-prefixes '*' --destination-port-ranges 2377
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowSwarmTCP7946 --priority 131 \
  --access Allow --protocol Tcp --direction Inbound \
  --source-address-prefixes VirtualNetwork --source-port-ranges '*' \
  --destination-address-prefixes '*' --destination-port-ranges 7946
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowSwarmUDP7946 --priority 132 \
  --access Allow --protocol Udp --direction Inbound \
  --source-address-prefixes VirtualNetwork --source-port-ranges '*' \
  --destination-address-prefixes '*' --destination-port-ranges 7946
az network nsg rule create --resource-group "$RG_NAME" --nsg-name "$NSG_NAME" --name AllowSwarmUDP4789 --priority 133 \
  --access Allow --protocol Udp --direction Inbound \
  --source-address-prefixes VirtualNetwork --source-port-ranges '*' \
  --destination-address-prefixes '*' --destination-port-ranges 4789

az network public-ip create --resource-group "$RG_NAME" --name "$PIP_NAME" --sku Standard

az vm create \
  --resource-group "$RG_NAME" \
  --name finnplay-manager \
  --image Ubuntu2204 \
  --admin-username "$ADMIN_USER" \
  --generate-ssh-keys \
  --size "$VM_SIZE" \
  --public-ip-sku Standard \
  --public-ip-address "$PIP_NAME" \
  --vnet-name "$VNET_NAME" \
  --subnet "$SUBNET_NAME" \
  --nsg "$NSG_NAME"

az vm create \
  --resource-group "$RG_NAME" \
  --name finnplay-worker \
  --image Ubuntu2204 \
  --admin-username "$ADMIN_USER" \
  --generate-ssh-keys \
  --size "$VM_SIZE" \
  --public-ip-address "" \
  --vnet-name "$VNET_NAME" \
  --subnet "$SUBNET_NAME" \
  --nsg "$NSG_NAME"

echo "Azure VM infrastructure created."
