# Task 22 Report — Module OPS-DEPLOY : Déploiement production

**Date :** 21 juillet 2026  
**Statut :** ✅ Complet (infra versionnée — provisioning VPS = action ops ALTERRA)

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | VPS provisionné (condition Sprint 5) | 📋 Doc `setup-vps.sh` + checklist |
| 2 | Docker Compose prod + Nginx + certbot Let's Encrypt | ✅ |
| 3 | Backup cron Backblaze B2 + monitoring | ✅ |
| 4 | Smoke test production | ✅ |

---

## Fichiers modifiés / créés

| Fichier | Rôle |
| ------- | ---- |
| `infra/docker-compose.prod.yml` | GHCR_IMAGE_PREFIX, ports 80/443, MinIO health |
| `infra/scripts/deploy.sh` | Backup, migrate, smoke test intégré |
| `infra/scripts/smoke-test.sh` | Vérif API, DB, Redis, MinIO, fronts |
| `infra/scripts/certbot-init.sh` | Certificats Let's Encrypt initiaux |
| `infra/scripts/install-cron.sh` | Cron backup 02h + renew TLS 03h |
| `infra/scripts/setup-vps.sh` | Provisionnement Debian + Docker |
| `docs/deploy/production.md` | Runbook déploiement complet |
| `.env.prod.example` | Variables production |
| `.github/workflows/deploy.yml` | Alignement tags GHCR + smoke via deploy |

## Commandes clés

```bash
sudo ./infra/scripts/setup-vps.sh
CERTBOT_EMAIL=ops@alterra.mg ./infra/scripts/certbot-init.sh
GHCR_IMAGE_PREFIX=ghcr.io/org/alterra TAG=sha ./infra/scripts/deploy.sh
HEALTHCHECK_URL=https://hc-ping.com/xxx ./infra/scripts/install-cron.sh
```
