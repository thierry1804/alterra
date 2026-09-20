#!/usr/bin/env bash
# Durcissement de l'hôte (une fois, avec sudo) : fail2ban sur SSH + pare-feu ALTERRA.
# NE désactive PAS l'authentification SSH par mot de passe : authorized_keys est vide, ça t'enfermerait dehors.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Lancer avec sudo"; exit 1; }
REPO="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> fail2ban (ban SSH après 5 échecs, 1 h)"
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.d/alterra-sshd.local <<'JAIL'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Pare-feu ALTERRA (Postgres/Redis/MinIO/Vite/API fermés depuis Internet ; SSH et autres stacks intacts)"
cp "$REPO/infra/systemd/alterra-firewall.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now alterra-firewall.service
iptables -S ALTERRA-INPUT

echo "==> X11Forwarding désactivé"
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
sshd -t && systemctl reload ssh

cat <<'NEXT'

À FAIRE ENSUITE (manuel) :
  1. Ajouter ta clé publique dans ~/.ssh/authorized_keys, TESTER une connexion par clé dans un 2e terminal,
     PUIS mettre "PasswordAuthentication no" dans /etc/ssh/sshd_config et recharger ssh.
  2. GitHub : révoquer le jeton de ~/.git-credentials et l'ancienne clé SSH (id_ed25519), en créer de nouveaux.
NEXT
