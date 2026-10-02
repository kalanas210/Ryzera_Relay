variable "region" {
  description = "Mumbai is the closest AWS region to Sri Lanka."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "The AWS CLI profile whose credentials Terraform uses."
  type        = string
  default     = "relay"
}

variable "instance_type" {
  description = "2 vCPU and 8 GB: the planning engine's exact search and the image builds both run on the box."
  type        = string
  default     = "m7i-flex.large"
}

variable "disk_gb" {
  type    = number
  default = 30
}

variable "domain" {
  description = "The public name Caddy gets an HTTPS certificate for. Point its A records at the elastic IP."
  type        = string
  default     = "relay-ryzera.tech"
}

variable "ssh_cidrs" {
  description = "Who may reach SSH, for example [\"203.0.113.7/32\"]. Everyone else sees only ports 80 and 443."
  type        = list(string)
}

variable "public_key_path" {
  description = "The public half of the deploy key. The private half never leaves the deploying machine."
  type        = string
  default     = "~/.ssh/relay_aws_ed25519.pub"
}
