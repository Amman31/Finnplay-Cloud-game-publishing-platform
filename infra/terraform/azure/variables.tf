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
  description = "VM SKU for manager and worker (e.g. Standard_B2s)."
  default     = "Standard_B2s"
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
