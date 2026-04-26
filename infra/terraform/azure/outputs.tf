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
