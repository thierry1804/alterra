# Runbook d'exploitation — ALTERRA

## Contacts

| Rôle                     | Contact | Astreinte   |
| ------------------------ | ------- | ----------- |
| Infogérance applicative  | NextA   | à compléter |
| Référent physique/réseau | ALTERRA | à compléter |

## Gestes courants

### Vérifier l'état des services

```bash
cd /opt/alterra/infra
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api --tail=200
```

### Redémarrer un service

```bash
docker compose -f docker-compose.prod.yml restart api
```

### Déployer une nouvelle version

```bash
TAG=<git-sha> ./scripts/deploy.sh
```

### Rollback

```bash
TAG=<sha-precedent> ./scripts/rollback.sh
```

### Backup manuel (hors planning automatique)

```bash
HEALTHCHECK_URL=<url> ./scripts/backup-offsite.sh
```

### Restauration (test mensuel obligatoire sur staging)

```bash
COMPOSE_FILE=docker-compose.staging.yml ./scripts/restore.sh 2026-07-01
```

Consigner chaque test de restauration ici : date, durée, résultat.

| Date | Opérateur | Résultat | Durée |
| ---- | --------- | -------- | ----- |
|      |           |          |       |

## Incidents fréquents

### Coupure électrique (délestage)

Normal, pas une exception. L'onduleur couvre 30 min ; au-delà, arrêt propre automatisé (NUT). Au retour du courant, les conteneurs redémarrent (`restart: always`). Vérifier `docker compose ps` après redémarrage — tout doit repasser `healthy` en quelques minutes. La PWA terrain continue de fonctionner offline pendant l'indisponibilité.

### Perte de connectivité

Bascule fibre → 4G automatique côté routeur. Le tunnel Cloudflare rétablit l'exposition dès le retour de n'importe quelle connectivité, sans reconfiguration. Vérifier la sonde externe (UptimeRobot) pour confirmer le retour en ligne côté Internet.

### Alerte "job backup en échec"

Le silence (absence de ping healthcheck) est le signal, pas une erreur explicite. Vérifier :

1. `docker compose logs backup-offsite`
2. Espace disque (`df -h`) — WAL et photos sont les deux consommateurs à surveiller
3. Connectivité vers Backblaze B2

### Certificat TLS expire bientôt

Renouvellement automatique attendu (certbot / Let's Encrypt). Si l'alerte persiste au-delà de J-7, forcer :

```bash
certbot renew --force-renewal
docker compose -f docker-compose.prod.yml restart nginx
```

### Panne du tunnel Cloudflare

Symptôme : sonde externe down, sonde interne (Uptime Kuma) OK. Vérifier :

```bash
docker compose -f docker-compose.prod.yml logs cloudflared
docker compose -f docker-compose.prod.yml restart cloudflared
```

## Sinistre majeur (serveur détruit/volé)

1. Provisionner un VPS de secours (OVH ou Telma).
2. Cloner le dépôt Git (`infra/` est versionné et reconstruit le serveur intégralement).
3. Restaurer la dernière sauvegarde offsite (`./scripts/restore.sh <dernière-date>`).
4. Rebasculer le tunnel Cloudflare vers le nouveau host (`cloudflared tunnel route dns`).
5. Vérifier `/health` sur les deux domaines avant de communiquer le retour de service.

Pendant l'indisponibilité, la PWA terrain continue de fonctionner offline et resynchronise au retour du service.

## Fenêtre de maintenance

Mardi 12h–14h (créneau de faible activité terrain). Couvre mises à jour système et déploiements planifiés.
