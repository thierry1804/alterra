#!/usr/bin/env bash
# Rotation des secrets applicatifs (après compromission, ou avant toute exposition publique).
# À lancer par l'administrateur : ./infra/scripts/rotate-secrets.sh
#  - régénère JWT_SECRET, JWT_REFRESH_SECRET, MFA_ENCRYPTION_KEY (aléatoires, 256 bits) dans backend/.env
#  - révoque toutes les sessions (refresh tokens) ; les jetons d'accès existants deviennent invalides
#  - change le mot de passe de admin@alterra.mg (écrit dans ~/.alterra-admin-credentials, chmod 600)
#  - restreint les permissions du log de dev, puis redémarre le service
# Les valeurs des secrets ne sont jamais affichées.
set -euo pipefail
umask 077
cd "$(dirname "$0")/../../backend"

echo "==> Vérification MFA (la clé MFA ne peut changer que si personne n'utilise le MFA)"
MFA_USERS=$(node -e "require('dotenv').config();const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count({where:{mfaSecret:{not:null}}}).then(n=>{console.log(n);return p.\$disconnect()})")
if [ "$MFA_USERS" != "0" ]; then
  echo "ABANDON : $MFA_USERS utilisateur(s) ont le MFA activé — changer MFA_ENCRYPTION_KEY les déconnecterait du MFA."
  exit 1
fi

echo "==> Nouveaux secrets dans backend/.env"
python3 - "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" <<'PY'
import re, sys
jwt, jwtr, mfa = sys.argv[1:4]
s = open(".env").read()
for key, val in (("JWT_SECRET", jwt), ("JWT_REFRESH_SECRET", jwtr), ("MFA_ENCRYPTION_KEY", mfa)):
    s, n = re.subn(rf"^{key}=.*$", f'{key}="{val}"', s, flags=re.M)
    if n != 1:
        s += f'\n{key}="{val}"\n'
if not re.search(r"^TRUST_PROXY_HOPS=", s, re.M):
    s += "\nTRUST_PROXY_HOPS=2\n"
open(".env", "w").write(s)
PY
chmod 600 .env

echo "==> Sessions révoquées + nouveau mot de passe admin"
ADMIN_PW="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
ADMIN_PW="$ADMIN_PW" node -e "
require('dotenv').config();
const argon2=require('argon2');const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const hash=await argon2.hash(process.env.ADMIN_PW,{type:argon2.argon2id});
  await p.user.update({where:{email:'admin@alterra.mg'},data:{passwordHash:hash}});
  const r=await p.refreshToken.updateMany({where:{revokedAt:null},data:{revokedAt:new Date()}});
  console.log('sessions révoquées :',r.count);
  await p.\$disconnect();
})()"
printf 'admin@alterra.mg\n%s\n' "$ADMIN_PW" > "$HOME/.alterra-admin-credentials"
chmod 600 "$HOME/.alterra-admin-credentials"

echo "==> Permissions du log de dev (il contient d'anciens jetons, désormais invalides)"
sudo chmod 640 /home/debian/alterra-dev.log

echo "==> Redémarrage"
sudo systemctl restart alterra-dev.service
echo "Terminé. Mot de passe admin : cat ~/.alterra-admin-credentials"
