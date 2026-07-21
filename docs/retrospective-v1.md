# Rétrospective V1 — consommation marge et leçons apprises

**Use case :** `UC-MARGE-V1`  
**Périmètre :** contingence ~7 j-h hors firm 50 j-h (risques documentés backlog)  
**Date clôture :** ___/___/2026 (fin hypercare ou fin Sprint 6)

---

## 1. Objectif

Documenter la consommation réelle de la marge imprévus V1 et les décisions d'arbitrage PO, alimentant la planification V2.

---

## 2. Budget marge V1 (référence plan)

| Risque couvert | Réserve planifiée | Consommé | Reste | Commentaire |
|----------------|-------------------|----------|-------|-------------|
| AXIAN API instabilité | 2,5 j-h | | | |
| Format MVola | 1,0 j-h | | | |
| UX saisie en lot | 1,0 j-h | | | |
| Volumétrie | 0,5 j-h | | | |
| Imprévus généraux | 1,0 j-h | | | |
| **Total** | **6,0 j-h** | | | |

> Ajuster les lignes selon les incidents réels — une ligne par ticket hypercare consommant de la marge.

---

## 3. Incidents consommant la marge

| ID hypercare | Date | Sujet | j-h consommés | Catégorie marge | Décision PO |
|--------------|------|-------|---------------|-----------------|-------------|
| | | | | AXIAN / MVola / UX / Vol / Général | Accepté / Reporté V2 |

---

## 4. Hypercare — synthèse (Task 25)

| Indicateur | S1 | S2 | S3 | Total |
|------------|----|----|-----|-------|
| Incidents P1 | | | | |
| Incidents P2 | | | | |
| Hotfix prod | | | | |
| UX mineurs | | | | |

Détail : [docs/ops/incident-register.md](ops/incident-register.md)

---

## 5. Ce qui a bien fonctionné

-

---

## 6. Ce qui doit changer (V2 ou process)

-

---

## 7. Report explicite V2

| Sujet | Raison report | Estimation V2 |
|-------|---------------|---------------|
| NFC présence | Won't V1 | |
| Biométrie offline | Won't V1 | |
| Workflows demandes | Won't V1 | |

Référence : [docs/cadrage/backlog-moscow.md](cadrage/backlog-moscow.md)

---

## 8. Recommandations maintenance post-hypercare

- Fréquence backup test restore :
- Fenêtre MEP :
- Contact astreinte remplacé par :
- KPIs de suivi mensuel :

---

## 9. Signatures clôture V1

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Référent ALTERRA | | | |
| Chef de projet NextA | | | |
| Product Owner | | | |

---

*Task 26 — MARGE-V1 · à compléter en fin Sprint 6 / hypercare*
