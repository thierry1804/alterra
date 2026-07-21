# Recette V1 — checklist 2 jours (référent ALTERRA)

Recette fonctionnelle de clôture V1 avec un référent métier et un représentant de chaque rôle.

## Participants

- Référent ALTERRA (métier)
- Admin système
- 1 CDS
- 1 CDE terrain
- Support technique (optionnel J2)

## Environnement

- Recette sur environnement de préproduction ou staging miroir prod.
- Données seed remplacées par un jeu minimal site pilote (≤ 30 MOC, 3 activités).
- Comptes dédiés recette (pas de mots de passe prod).

## Jour 1 — Parcours métier

### Admin

- [ ] Connexion + MFA si activée
- [ ] CRUD site / activité / MOC (création + désactivation)
- [ ] Consultation pointages du jour
- [ ] Génération bordereau MVola (semaine courante)
- [ ] Export CSV et simulation import retour
- [ ] Rapport PDF hebdomadaire (job async + téléchargement)

### CDE (PWA)

- [ ] Login + PIN
- [ ] Sync référentiel
- [ ] Choix activité + saisie lot (quantités, montant prévisionnel)
- [ ] Photo activité si applicable
- [ ] Sync pointages (en ligne)
- [ ] Mode offline : 1 lot + resync

### CDS (PWA)

- [ ] Login + PIN
- [ ] Liste MOC à valider (filtre équipe)
- [ ] Validation individuelle + groupe
- [ ] Biométrie mock / manuelle selon config
- [ ] Verrouillage semaine après validation

## Jour 2 — Exploitation et robustesse

### Ops

- [ ] `deploy.sh` ou procédure staging documentée
- [ ] Smoke test post-déploiement
- [ ] Backup base + restauration test
- [ ] Import Excel initial (sites, activités, MOC)

### Qualité

- [ ] Suite E2E Playwright verte (`npm run test:e2e`)
- [ ] Tests backend CI verts
- [ ] Revue des anomalies J1 corrigées ou planifiées

### Clôture recette

- [ ] PV recette signé (OK / OK avec réserves / KO)
- [ ] Liste anomalies classées P1–P3
- [ ] Go / No-go MEP V1

## Grille de sévérité

| Niveau | Définition | Délai cible |
|--------|------------|-------------|
| P1 | Bloquant métier ou perte de données | J+1 |
| P2 | Contournement possible, UX dégradée | J+3 |
| P3 | Cosmétique, doc | J+5 |

## Livrables

- Procédure offline pilote : `docs/qa/offline-pilot.md`
- Rapport anomalies : `.superpowers/sdd/task-23-report.md` (section recette)
- Décision go MEP : note dans `docs/deploy/production.md` ou ticket projet
