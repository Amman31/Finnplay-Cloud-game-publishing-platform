variable "resource_group_name" {
  type        = string
  description = "Azure resource group name."
  default     = "finnplay-rg"
}

variable "location" {
  type        = string
  description = "Azure region (e.g. westeurope, swedencentral)."
  default     = "westeurope"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for VNet, subnet, NSG, public IP, and VM hostnames."
  default     = "finnplay"
}

variable "admin_username" {
  type        = string
  description = "Linux admin user on both VMs (e.g. azureuser)."
  default     = "azureuser"
}

variable "admin_ssh_public_key" {
  type        = string
  description = "OpenSSH public key string for VM login (same key pair you use for GitHub Actions CD if you deploy via SSH)."
  sensitive   = true
}

variable "vm_size" {
  type        = string
  description = "VM SKU for manager and worker. Default is Bsv2 burstable (Standard_B2ls_v2); override if your subscription or region does not offer it (e.g. Standard_B1s, Standard_B2s)."
  default     = "Standard_B2ls_v2"
}

variable "vm_zone" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional single availability zone for both VMs: \"1\", \"2\", or \"3\". Set when Azure reports capacity restrictions without a better SKU."
}

variable "vnet_address_space" {
  type        = list(string)
  description = "Address prefixes for the virtual network."
  default     = ["10.10.0.0/16"]
}

variable "subnet_address_prefix" {
  type        = string
  description = "CIDR for the workload subnet."
  default     = "10.10.1.0/24"
}

variable "storage_container_name" {
  type        = string
  description = "Blob container for game images (matches server default AZURE_STORAGE_CONTAINER_NAME)."
  default     = "finnplay-images"
}
