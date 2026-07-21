# Déploiement production — ALTERRA

Checklist Task 22 (UC-OPS-VPS). Condition Sprint 5 : VPS ou serveur on-premise provisionné.

## Prérequis

| Élément | Statut |
| ------- | ------ |
| Serveur Debian 12+ avec Docker | ☐ |
| Domaines `app.alterra.mg`, `admin.alterra.mg` | ☐ |
| Tunnel Cloudflare ou IP fixe + ports 443 | ☐ |
| Secrets `infra/secrets/` remplis | ☐ |
| Fichier `.env.prod` à la racine du dépôt | ☐ |
| Compte Backblaze B2 + rclone crypt configuré | ☐ |
| URL Healthchecks.io pour backup | ☐ |

## Installation initiale

```bash
sudo REPO_URL=git@github.com:ORG/alterra.git ./infra/scripts/setup-vps.sh
sudo -u deploy git clone ... /opt/alterra
cd /opt/alterra
cp .env.prod.example .env.prod   # éditer les valeurs
mkdir -p infra/secrets
# pg_password.txt, minio_user.txt, minio_pass.txt, cloudflared credentials
```

### TLS (Let's Encrypt)

```bash
cd /opt/alterra/infra
CERTBOT_EMAIL=ops@alterra.mg ./scripts/certbot-init.sh
```

### Premier déploiement

```bash
export GHCR_IMAGE_PREFIX=ghcr.io/VOTRE_ORG/alterra
export TAG=<git-sha>
./scripts/deploy.sh
```

Variables compose :

| Variable | Défaut | Description |
| -------- | ------ | ----------- |
| `GHCR_IMAGE_PREFIX` | `ghcr.io/alterra` | Préfixe images GHCR |
| `TAG` | `latest` | Tag d'image (git SHA en prod) |

### Backup + monitoring

```bash
HEALTHCHECK_URL=https://hc-ping.com/xxx ./scripts/install-cron.sh
```

- Backup quotidien 02h00 → Backblaze B2 (script `backup-offsite.sh`)
- Renouvellement certbot 03h00
- Uptime Kuma + Netdata dans `docker-compose.prod.yml`

## Déploiements suivants

```bash
cd /opt/alterra/infra
TAG=<git-sha> ./scripts/deploy.sh
```

Le script : backup pre-deploy → pull → migrate → up → smoke test.

## Smoke test manuel

```bash
./scripts/smoke-test.sh
SMOKE_APP_URL=https://app.alterra.mg SMOKE_ADMIN_URL=https://admin.alterra.mg ./scripts/smoke-test.sh
```

## Rollback

```bash
TAG=<sha-precedent> ./scripts/rollback.sh
```

## CI/CD

GitHub Actions `.github/workflows/deploy.yml` : build GHCR → SSH deploy avec approbation manuelle environment `production`.

Secrets repo : `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_PRIVATE_KEY`.
