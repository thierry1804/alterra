# Registre incidents — Hypercare V1

Copier les lignes du tableau au fil des incidents. Une ligne = un ticket.

| ID | Date/heure | Site | Sévérité | Rôle | Symptôme | Contournement | Correctif | Statut | Clôture |
|----|------------|------|----------|------|----------|---------------|-----------|--------|---------|
| HC-001 | | | P1/P2/P3 | CDE/CDS/Admin | | | | Ouvert / En cours / Résolu | |
| HC-002 | | | | | | | | | |
| HC-003 | | | | | | | | | |

## Légende statuts

- **Ouvert** : signalé, non qualifié
- **En cours** : dev ou ops actif
- **Résolu** : fix déployé ou contournement validé métier
- **Reporté V2** : hors hypercare, backlog extension

## Champs recommandés (notes sous la ligne)

- Version déployée (`TAG` git SHA)
- TraceId API si erreur 500
- Appareil CDE (modèle Android, version Chrome)
- Lien PR / commit hotfix

---

*Template Task 25 — à archiver en fin hypercare dans `docs/retrospective-v1.md`*
