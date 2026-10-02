# Infrastructure

The public demo runs the same Docker Compose stack a judge runs locally, on one AWS EC2 server in Mumbai
(`ap-south-1`, the closest region to Sri Lanka), behind Caddy with an automatic HTTPS certificate for
`relay-ryzera.tech`.

| Path | What it does |
|---|---|
| `terraform/` | The server: an Ubuntu 24.04 `m7i-flex.large` (2 vCPU, 8 GB), a 30 GB encrypted disk, IMDSv2 only, an elastic IP, and a firewall that opens 80 and 443 to everyone and SSH only to the team's addresses. `cloud-init.yaml` installs Docker and a swap file on first boot |
| `../docker-compose.prod.yml` | The production overlay: Caddy on 80 and 443 with its certificates kept in a volume |
| `deploy.sh` | Ships the committed `HEAD` with `git archive` and rebuilds on the server, so uncommitted work is never deployed |
| `server/up.sh` | Runs on the server: writes `/opt/relay/.env` with random secrets the first time, then `docker compose up -d --build` |
| `server/backup.sh` | Nightly `pg_dump` at 3:30 AM Sri Lanka time into `/opt/relay-backups`, the newest 14 kept |

## Create the server

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # put your own IP in ssh_cidrs
terraform init
terraform apply
```

It uses the AWS CLI profile `relay` (`aws configure --profile relay`) and the public key
`~/.ssh/relay_aws_ed25519.pub`. Point the domain's `A` records for `@` and `www` at the `public_ip` output.

## Deploy

Add the server to `~/.ssh/config` as `relay` (the `ssh` output shows the address and key), then from the repo root:

```bash
infra/deploy.sh
```

The database, the certificates and the secrets live in Docker volumes and `/opt/relay/.env` on the server, so a
redeploy keeps every judge's private copy of the day.
