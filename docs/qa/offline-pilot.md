# Test offline terrain — site pilote (1 journée)

Procédure manuelle pour valider le parcours CDE sans réseau sur un site réel, complémentaire aux tests E2E automatisés (`e2e/tests/offline-day.spec.ts`).

## Prérequis

- PWA installée sur l’appareil pilote (Chrome Android ou équivalent).
- Compte CDE actif avec équipe et MOC assignés.
- PIN local configuré.
- Référentiel synchronisé une fois en ligne avant la journée.

## Matériel conseillé

- 1 smartphone Android (CDE terrain).
- 1 poste Admin (CDS / support) pour contrôle fin de journée.
- Carnet papier de secours (matricule, quantité, activité) si blocage critique.

## Déroulé J0 (préparation)

1. Connexion CDE en ligne → vérifier « Activité du jour » et liste MOC.
2. Choisir activité + date → saisir un lot test → sync OK.
3. Activer mode avion 2 min → saisir un second lot → vérifier statut « Hors ligne » et file d’attente sync.
4. Désactiver mode avion → « Forcer la synchronisation » → statut « En ligne », pending = 0.

## Déroulé J1 (journée pilote)

| Heure | Action | Critère succès |
|-------|--------|----------------|
| 07:00 | Sync matin en 4G/Wi-Fi | Référentiel à jour, pas d’erreur |
| 07:15 | Basculer offline (mode avion) | Bandeau « Hors ligne » visible |
| 07:30–16:00 | Saisie lots normale | Lots enregistrés localement, pas de perte |
| 16:30 | Retour réseau | Sync auto ou manuelle réussie |
| 17:00 | Contrôle Admin | Pointages visibles, montants cohérents |

## Points de contrôle

- Aucune perte de lot après redémarrage navigateur.
- Photos compressées présentes si activité photo requise.
- Conflits éventuels résolus via écran Sync (pas de doublon silencieux).
- CDS peut valider la semaine après sync CDE.

## Incidents à tracer

Noter dans le rapport pilote : heure, appareil, version PWA, message d’erreur, capture écran, action corrective.

## Critère de passage

- 100 % des lots saisis offline synchronisés avant 18h.
- 0 blocage empêchant la saisie terrain > 15 min.
- Validation CDS possible le lendemain sans correction manuelle Admin.
