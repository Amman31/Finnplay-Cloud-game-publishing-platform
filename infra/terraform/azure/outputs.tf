output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Resource group containing the Swarm VMs and networking."
}

output "manager_network_interface_import_id" {
  description = "ARM resource ID for terraform import azurerm_network_interface.manager (after state exists, run terraform output -raw manager_network_interface_import_id)."
  value       = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.Network/networkInterfaces/${var.name_prefix}-manager-nic"
}

output "manager_public_ip" {
  value       = azurerm_public_ip.manager.ip_address
  description = "Public IPv4 of the manager VM (DNS A records and SSH target)."
}

output "manager_private_ip" {
  value       = azurerm_network_interface.manager.private_ip_address
  description = "Private IP of the manager (Swarm advertise address and worker join target)."
}

output "worker_private_ip" {
  value       = azurerm_network_interface.worker.private_ip_address
  description = "Private IP of the worker VM."
}

output "ssh_manager" {
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.manager.ip_address}"
  description = "Example SSH command to the manager."
}

output "storage_account_name" {
  value       = azurerm_storage_account.blob.name
  description = "Azure Storage account name for blob uploads (AZURE_STORAGE_CONNECTION_STRING account segment)."
}

output "storage_container_name" {
  value       = azurerm_storage_container.images.name
  description = "Blob container name; set AZURE_STORAGE_CONTAINER_NAME on the server to this value."
}

output "storage_blob_endpoint" {
  value       = azurerm_storage_account.blob.primary_blob_endpoint
  description = "HTTPS blob service base URL (optional AZURE_STORAGE_PUBLIC_ORIGIN if you rewrite URLs)."
}

output "storage_primary_connection_string" {
  value       = azurerm_storage_account.blob.primary_connection_string
  sensitive   = true
  description = "Use as AZURE_STORAGE_CONNECTION_STRING for the API server (treat as a secret)."
}
