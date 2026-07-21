# Recette V2 — checklist 2 jours (extensions terrain)

Recette fonctionnelle de clôture V2 : NFC, biométrie offline, workflows demandes, cartographie, clôture journalière.

Documents liés :

- Hypercare V2 : [docs/ops/hypercare-v2.md](../ops/hypercare-v2.md)
- Tests E2E : `npm run test:e2e`
- Pilote offline : [offline-pilot.md](offline-pilot.md)

## Participants

- Référent ALTERRA (métier)
- Admin système
- 1 CDS site pilote
- 1 CDE terrain (Chrome Android si NFC réel)
- Support technique

## Environnement

- Staging miroir prod avec modules V2 activés
- Jeu de données site pilote (≤ 30 MOC, zones/parcelles optionnelles)
- Comptes dédiés recette (`*@alterra.test`)

## Jour 1 — Extensions terrain

### Admin

- [ ] File demandes (`/requests`) — activités, MOC, précisions
- [ ] Décision Accepter / Refuser / Complément sur demande test
- [ ] Cartographie (`/map`) — marqueurs, couches zones/parcelles
- [ ] Réception email rapport journalier (clôture CDS)

### CDE (PWA)

- [ ] Présence NFC ou mode manuel dégradé
- [ ] Sync présence (`/nfc` → journal du jour)
- [ ] Réponse demande de précisions (`/clarifications`)

### CDS (PWA)

- [ ] Demande activité + demande MOC
- [ ] Demande précisions depuis validation
- [ ] Clôture journalière (`/daily-close`) avec signature
- [ ] Biométrie offline (cache templates + contrôle sans réseau)

## Jour 2 — Robustesse et régression V1

### Qualité automatisée

- [ ] `npm test -w backend` vert
- [ ] `npm run test:e2e` vert (NFC manuel, bio offline, workflows, offline-day)
- [ ] Build admin + PWA OK

### Exploitation

- [ ] Smoke post-déploiement staging V2
- [ ] Vérification jobs PDF daily + weekly
- [ ] Anomalies J1 traitées ou planifiées

## Critères de sortie recette V2

- [ ] Parcours NFC/bio/workflows validés sur site pilote ou simulateur
- [ ] Aucun bloquant P1 ouvert
- [ ] Go hypercare V2 signé (voir recette signatures)
