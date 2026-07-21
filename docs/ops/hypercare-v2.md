# Hypercare V2 — support post-recette extensions terrain (2 semaines)

**Use case :** `UC-OPS-HC-V2`  
**Durée :** J+1 à J+14 après bascule V2 sur site pilote  
**Objectif :** stabiliser NFC, bio offline et workflows sans régression V1

Documents liés :

- Recette V2 : [docs/qa/recette-v2.md](../qa/recette-v2.md)
- Hypercare V1 : [hypercare-v1.md](hypercare-v1.md)
- Runbook : [docs/runbook.md](../runbook.md)

---

## 1. Périmètre

| Inclus | Exclus |
|--------|--------|
| Bugs P1/P2 modules V2 (NFC, bio cache, workflows, map, daily) | Nouvelles fonctionnalités hors backlog V2 |
| Hotfix staging/prod pilote | Déploiement sites non pilotes |
| Ajustements UX mineurs workflows | Refonte complète PWA |
| 2 bilans hebdomadaires (fin S1, fin S2) | Formation multi-sites |

---

## 2. Astreinte

| Semaine | Focus |
|---------|-------|
| S1 | NFC compatibilité appareils, sync présence, bio offline |
| S2 | Workflows demandes bout-en-bout, clôture journalière, carto admin |

Canaux identiques à l'hypercare V1 (téléphone astreinte, email support, canal projet).

---

## 3. Indicateurs de sortie

- [ ] Taux sync présence NFC > 95 % sur site pilote (ou mode manuel documenté)
- [ ] Contrôles bio offline utilisables après sync matinale
- [ ] Délai moyen traitement demandes Admin < 48 h ouvrées
- [ ] Suite E2E V2 verte en CI
- [ ] Bilan hypercare V2 signé → passage maintenance standard

---

## 4. Commandes de vérification

```bash
npm test -w backend
npm run test:e2e
npm run build -w admin && npm run build -w pwa
```
