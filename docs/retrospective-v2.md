# Rétrospective V2 — consommation marge et leçons apprises

**Use case :** `UC-MARGE-V2`  
**Périmètre :** contingence **1,5 j-h** sur total V2 **22,5 j-h** (risques NFC, bio offline, UX workflows)  
**Date clôture :** ___/___/2026 (fin hypercare V2 ou fin Sprint 9)

---

## 1. Objectif

Documenter la consommation réelle de la marge imprévus V2 et les décisions d'arbitrage PO, clôturant le backlog extensions terrain.

Documents liés :

- Hypercare V2 : [docs/ops/hypercare-v2.md](ops/hypercare-v2.md)
- Recette V2 : [docs/qa/recette-v2.md](qa/recette-v2.md)
- Registre incidents : [docs/ops/incident-register.md](ops/incident-register.md)
- Rétrospective V1 : [docs/retrospective-v1.md](retrospective-v1.md)

---

## 2. Budget marge V2 (référence plan)

| Risque couvert | Réserve planifiée | Consommé | Reste | Commentaire |
|----------------|-------------------|----------|-------|-------------|
| NFC — compatibilité appareils | 0,5 j-h | | | Web NFC, mode manuel dégradé |
| Bio offline — performance / cache | 0,5 j-h | | | Templates chiffrés, face-api, sync |
| UX workflows (demandes terrain) | 0,5 j-h | | | PWA CDS + file Admin |
| **Total** | **1,5 j-h** | | | |

> Ajuster les lignes selon les incidents réels — une ligne par ticket hypercare consommant de la marge.

---

## 3. Incidents consommant la marge

| ID hypercare | Date | Sujet | j-h consommés | Catégorie marge | Décision PO |
|--------------|------|-------|---------------|-----------------|-------------|
| | | | | NFC / Bio offline / UX workflows | Accepté / Reporté maintenance |

---

## 4. Hypercare V2 — synthèse

| Indicateur | S1 | S2 | Total |
|------------|----|----|-------|
| Incidents P1 | | | |
| Incidents P2 | | | |
| Hotfix prod / staging pilote | | | |
| UX mineurs workflows | | | |
| Échecs sync NFC / présence | | | |
| Contrôles bio offline en échec | | | |

Détail : [docs/ops/incident-register.md](ops/incident-register.md)

---

## 5. Livrables V2 réalisés (référence implémentation)

| Module | Périmètre livré | Statut backlog |
|--------|-----------------|----------------|
| NFC présence | Scan Web NFC, mode manuel, sync badges | Tasks 30–31 |
| Bio offline | Cache templates, matcher local, queue sync | Task 32 |
| Workflows | Demandes activité/MOC/précisions, Admin | Tasks 33–35 |
| Cartographie | Leaflet zones/parcelles | Task 36 |
| Clôture journalière | PDF daily + email Admin | Task 37 |
| QA V2 | E2E Playwright + recette 2 jours | Task 38 |

---

## 6. Ce qui a bien fonctionné

-

---

## 7. Ce qui doit changer (maintenance ou V3)

-

---

## 8. Consommation vs estimation initiale V2

| Poste | Estimé (j-h) | Réel (j-h) | Écart | Commentaire |
|-------|--------------|------------|-------|-------------|
| Développement firm V2 | 22,5 | | | Hors marge |
| Marge imprévus | 1,5 | | | Ce document |
| **Total projet V2** | **24,0** | | | |

---

## 9. Recommandations maintenance post-hypercare V2

- Fréquence test E2E V2 en CI :
- Matrice appareils NFC pilote validée :
- Seuil acceptable échec bio offline :
- Délai traitement demandes Admin :
- KPIs de suivi mensuel :

---

## 10. Signatures clôture V2

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Référent ALTERRA | | | |
| Chef de projet NextA | | | |
| Product Owner | | | |

---

*Task 39 — MARGE-V2 · à compléter en fin Sprint 9 / hypercare V2*
