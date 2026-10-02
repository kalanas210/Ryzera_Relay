# One small server runs the same Docker Compose stack a judge runs locally, behind Caddy with HTTPS.
# The default VPC is enough: one public instance, a fixed address, and a firewall that only opens the web.

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "deploy" {
  key_name   = "relay-deploy"
  public_key = file(pathexpand(var.public_key_path))
}

resource "aws_security_group" "web" {
  name        = "relay-web"
  description = "Relay: HTTPS for everyone, SSH for the team"

  ingress {
    description = "HTTP, redirected to HTTPS and used for the certificate challenge"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP/3"
    from_port   = 443
    to_port     = 443
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH for deploys"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "relay" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.deploy.key_name
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = file("${path.module}/cloud-init.yaml")

  root_block_device {
    volume_size = var.disk_gb
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  tags = {
    Name = "relay"
  }

  lifecycle {
    # a newer Ubuntu image must not replace the running server and its database
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "relay" {
  domain   = "vpc"
  instance = aws_instance.relay.id

  tags = {
    Name = "relay"
  }
}
