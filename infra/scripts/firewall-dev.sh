#!/usr/bin/env bash
# Pare-feu du VPS de dev ALTERRA : ferme depuis Internet les ports qui ne doivent être joignables
# qu'en local (le tunnel Cloudflare se connecte en loopback). Idempotent — relançable à volonté.
#
# Ne touche NI à SSH (22), NI aux ports d'autres stacks (80/443 toa, 3020 vetbook…).
# Installation : voir infra/systemd/alterra-firewall.service
set -euo pipefail

EXT_IFACE="${EXT_IFACE:-$(ip -4 route get 1.1.1.1 | grep -oP 'dev \K\S+')}"
# Processus hôte (Vite admin/pwa, API) : filtrés dans INPUT.
HOST_PORTS="3010,5173,5174"
# Conteneurs Docker publiés en 0.0.0.0 (Postgres, Redis, MinIO API/console) : filtrés dans DOCKER-USER
# (le trafic DNAT-é traverse FORWARD, pas INPUT).
DOCKER_PORTS="5433 6380 9002 9003"

# IPs bannies manuellement (brute-force SSH récurrent, cf. journalctl -g "Failed password") :
# bloquées sur tout port, toute interface. Ajouter/retirer une IP ici, le script est idempotent.
BANNED_IPS="109.160.32.39 195.178.110.30 109.160.32.108 45.148.10.152 193.47.62.69 45.148.10.151 109.160.32.30 45.148.10.141 45.148.10.157 109.160.32.68 121.242.232.216"

for ipt in iptables ip6tables; do
  # --- INPUT : chaîne dédiée, recréée à chaque exécution -------------------------------------
  "$ipt" -N ALTERRA-INPUT 2>/dev/null || "$ipt" -F ALTERRA-INPUT
  "$ipt" -A ALTERRA-INPUT -i lo -j RETURN
  for ip in $BANNED_IPS; do
    [[ "$ip" == *:* && "$ipt" == "iptables" ]] && continue
    [[ "$ip" != *:* && "$ipt" == "ip6tables" ]] && continue
    "$ipt" -A ALTERRA-INPUT -s "$ip" -j DROP
  done
  "$ipt" -A ALTERRA-INPUT -p tcp -m multiport --dports "$HOST_PORTS,${DOCKER_PORTS// /,}" -j DROP
  "$ipt" -C INPUT -j ALTERRA-INPUT 2>/dev/null || "$ipt" -I INPUT 1 -j ALTERRA-INPUT
done

# --- DOCKER-USER (IPv4) : conserve la règle RETURN finale de Docker ---------------------------
iptables -N ALTERRA-DOCKER 2>/dev/null || iptables -F ALTERRA-DOCKER
for port in $DOCKER_PORTS; do
  iptables -A ALTERRA-DOCKER -i "$EXT_IFACE" -p tcp -m conntrack --ctorigdstport "$port" -j DROP
done
iptables -A ALTERRA-DOCKER -j RETURN
iptables -C DOCKER-USER -j ALTERRA-DOCKER 2>/dev/null || iptables -I DOCKER-USER 1 -j ALTERRA-DOCKER

echo "Firewall ALTERRA appliqué (interface externe : ${EXT_IFACE})"
