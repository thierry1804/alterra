# ALTERRA — Brief et handoff Chef de Projet

**Onboarding pour le pilotage du projet de digitalisation du pointage et du paiement des MOC**

Version 1.0 — 28 avril 2026
Préparé par : Thierry — NextA
Destinataire : Chef de Projet en cours de nomination

---

## 1. Vue exécutive en une page

**Client** : ALTERRA, opérateur malgache de reforestation et d'agroforesterie basé à Antananarivo, opérant sur 5 sites (Manankazo, Antsampanana, Anjozorobe, Mangatsa, Ambondromamy).

**Besoin** : digitaliser le pointage à la tâche et le paiement hebdomadaire d'environ 600 Mains-d'Œuvre Communautaires (MOC) actifs simultanément, jusqu'à 1 000 individus par campagne (juillet à juin), avec contrôle biométrique via l'API AXIAN et paiement par fichier Excel MVola Bulk Transfer.

**Solution proposée** : deux plateformes web complémentaires. Une **Web App Admin** desktop pour l'Administrateur central au siège. Une **PWA Terrain** offline-first partagée entre 5 Chefs de Service (validation hebdomadaire au camp de base) et 15 Chefs d'Équipe (pointage quotidien sur le terrain avec ~40 MOC chacun).

**Stack technique** : Node.js 20 + NestJS + Prisma + PostgreSQL 16 côté backend, React + Vite + PWA offline-first côté frontends, Docker Compose sur VPS Linux dédié ALTERRA. Aucun service tiers de type BaaS — souveraineté totale des données.

**Livraison en deux phases** :

- **V1** — cœur fonctionnel (50 j-h sur 12 semaines) : pointage à la tâche, validation hebdomadaire avec biométrie en ligne, génération Excel MVola.
- **V2** — extensions terrain (21 j-h sur 5 semaines additionnelles) : NFC pour pointage de présence, biométrie offline, workflows de demandes, hiérarchie Zone/Parcelle, cartographie, clôture quotidienne.

**Total** : 71 j-h sur 17 semaines calendaires avec une équipe de 2 développeurs fullstack en parallèle.

**Trois risques élevés à surveiller en priorité** : (i) l'API biométrique AXIAN est encore en développement sans documentation, (ii) le Web NFC API n'est disponible que sur Chrome Android — impose une flotte matérielle, (iii) le stockage biométrique local en V2 nécessite une analyse RGPD préalable.

**Objectif final** : rapprocher le paiement de la fin de journée de travail avec traçabilité biométrique, tout en supprimant le papier et en réduisant les erreurs administratives.

---

## 2. Contexte projet et enjeux

### 2.1 Le client ALTERRA

ALTERRA est un opérateur de reforestation et d'agroforesterie établi à Madagascar. Sur 2023-2024, ses chiffres clés étaient : 203 000 plants reforestés sur 185 hectares à Manankazo, 27 000 pousses natives sur 33 hectares, 213 000 pousses en agroforesterie sur 181 hectares, 150 hectares de bambou à Antsampanana. Environ 800 familles ont été impactées financièrement.

Les cinq sites ont chacun une activité dominante :

| Site         | Activité                       | Code MVola |
| ------------ | ------------------------------ | ---------- |
| Manankazo    | Reforestation à grande échelle | MNK        |
| Antsampanana | Agroforesterie & bambou        | ANT        |
| Anjozorobe   | Conservation forêt naturelle   | ANJ        |
| Mangatsa     | Production fruitière           | MGT        |
| Ambondromamy | Production fruitière           | AMB        |

### 2.2 Le problème métier

Aujourd'hui, ALTERRA gère ses MOC de manière essentiellement papier. Ce mode de fonctionnement pose plusieurs problèmes :

- **Latence de paiement** : le cycle papier → agrégation → contrôle → paiement prend souvent plusieurs jours après la fin de semaine, ce qui pénalise les MOC dépendants de leur revenu hebdomadaire.
- **Traçabilité limitée** : difficile de reconstituer précisément qui a fait quoi, quand, où.
- **Risque de fraude** : partage de cartes SIM, MOC fantômes, quantités surestimées — sans contrôle biométrique, l'identification est difficile.
- **Erreurs administratives** : calculs manuels des montants, ressaisie du fichier MVola.
- **Reporting fastidieux** : consolidation manuelle des rapports des 5 sites.

### 2.3 Le rôle du groupe AXIAN

AXIAN, groupe télécom malgache, possède Telma (opérateur mobile) et MVola (service de mobile money). Deux dépendances critiques du projet reposent sur AXIAN :

- L'**API biométrique** interne au groupe, qui compare une photo prise sur le terrain à la photo KYC associée au numéro MVola (enregistrée lors de l'ouverture de la carte SIM).
- Le service **MVola Bulk Transfer** pour effectuer les paiements en lot via fichier Excel.

Les relations avec AXIAN sont un point critique du projet — voir §7 sur les risques.

### 2.4 Impact attendu

- Réduction du délai de paiement de plusieurs jours à un cycle hebdomadaire fiable (voire quotidien en V2).
- Traçabilité biométrique de chaque paiement.
- Éradication des « MOC fantômes » et paiements en doublon.
- Consolidation automatique des rapports des 5 sites.
- Base de données centralisée pour analyse et suivi de campagne.

---

## 3. Périmètre et livrables

### 3.1 Périmètre V1 (cœur, 12 semaines, 50 j-h)

- Authentification et gestion des comptes (Admin, Chef de Service, Chef d'Équipe).
- CRUD référentiels : sites, activités avec tarifs unitaires versionnés, MOC avec import Excel.
- PWA Chef d'Équipe : sélection activité du jour, saisie en lot des quantités pour ~40 MOC, offline complet, synchronisation idempotente.
- PWA Chef de Service : validation hebdomadaire avec contrôle biométrique en ligne (API AXIAN), génération PDF rapport + facture avec signature électronique.
- Web App Admin : tableau de bord, gestion référentiels, consultation et correction des pointages, génération du bordereau consolidé, export Excel MVola Bulk Transfer, import statuts de retour, audit log.
- Déploiement sur VPS Linux Docker Compose avec backup quotidien.
- Formation sur 1 site pilote, hypercare 3 semaines.

### 3.2 Périmètre V2 (extensions terrain, 5 semaines, 21 j-h)

- **NFC** : pointage de présence via scan de badges NFC par le Chef d'Équipe (arrivée matin).
- **Biométrie offline** : cache local chiffré des templates KYC, comparaison locale par face-api.js embarqué.
- **Workflows de demandes** : demandes de précisions (CDS → CDE), demandes d'activité et de MOC (CDS → Admin).
- **Composition d'équipes côté PWA** : le Chef de Service crée et modifie les équipes directement dans la PWA.
- **Gestion d'équipe locale** par le Chef d'Équipe : ajout/retrait de MOC depuis la base existante.
- **Hiérarchie géographique** Site → Zone → Parcelle avec migration du modèle de données.
- **Cartographie Leaflet** côté Web Admin avec marqueurs sites et polygones zones/parcelles.
- **Clôture quotidienne** avec rapport journalier PDF, permettant un cycle de paiement quotidien optionnel.

### 3.3 Non inclus (à chiffrer en sus si requis)

- Coûts d'infrastructure récurrents (VPS, services tiers SMS/email/backup) — à la charge d'ALTERRA.
- Stabilisation de l'API AXIAN si livrée après V2 (3 à 5 j supplémentaires).
- Maintenance évolutive après l'hypercare (forfait mensuel séparé).
- Nettoyage de données existantes mal structurées (atelier séparé).
- Matériel terrain (smartphones Android avec NFC, badges NFC) et forfaits data — à la charge d'ALTERRA.
- Analyse RGPD approfondie sur le stockage biométrique local V2 — recommandée mais séparée.

### 3.4 Deliverables projet

**Livrables produits pendant le projet**

- Code source (monorepo Git) avec licence à définir avec ALTERRA.
- Environnements dev / staging / production sur VPS.
- Documentation technique (README, ADR, OpenAPI).
- Documentation utilisateur (guides PDF par rôle).
- Documentation d'exploitation (runbook, procédures backup/restore, playbook MEP).
- Formation sur site pilote (1 j Admin/CDS, 1 j CDE terrain).

**Livrables déjà produits en amont**

- ALTERRA — Spécifications fonctionnelles et techniques v3 (synthèse)
- ALTERRA — Spécification fonctionnelle détaillée (35 pages)
- ALTERRA — Spécification technique détaillée (40 pages)
- ALTERRA — Backlog détaillé (Excel + Markdown, 71 j-h par sprints)
- ALTERRA — Chiffrage et macroplanning
- ALTERRA — Brief Chef de Projet (ce document)
- ALTERRA — Brief Développeur

---

## 4. Organisation projet

### 4.1 Rôles et responsabilités

| Rôle                             | Responsabilités clés                                                                            | Charge    | Localisation  |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | --------- | ------------- |
| **Chef de Projet (vous)**        | Pilotage global, gouvernance, arbitrages, interface ALTERRA, gestion des risques, communication | 30 % ETP  | Antananarivo  |
| **Tech Lead**                    | Architecture, revues de code, décisions techniques structurantes, appui aux devs                | 20 % ETP  | Antananarivo  |
| **Développeur senior fullstack** | Backend NestJS + PWA React + partie Admin                                                       | 100 % ETP | Antananarivo  |
| **Développeur fullstack**        | Frontend Admin + partie PWA + tests                                                             | 100 % ETP | Antananarivo  |
| **PO / Rédacteur spec**          | Rédaction user stories, priorisation, recette avec ALTERRA                                      | 30 % ETP  | Antananarivo  |
| **Référent métier ALTERRA**      | Réponses métier, disponibilité pour ateliers, recette                                           | 0,5 j/sem | ALTERRA siège |
| **DevOps** (partagé)             | Déploiement, monitoring, sécurité infra                                                         | 10 % ETP  | Antananarivo  |

**Effectif projet** : environ 3 ETP en pic (sprints de développement), 2 ETP en moyenne sur les 17 semaines.

### 4.2 Instances de gouvernance

| Instance                | Fréquence                      | Durée  | Participants                             | Objectif                                |
| ----------------------- | ------------------------------ | ------ | ---------------------------------------- | --------------------------------------- |
| Daily standup équipe    | Quotidien                      | 15 min | Équipe tech + PO                         | Synchro rapide, points bloquants        |
| Sprint Planning         | Bi-hebdomadaire (début sprint) | 2 h    | Équipe complète                          | Engagement backlog du sprint            |
| Sprint Review           | Bi-hebdomadaire (fin sprint)   | 1 h    | Équipe + ALTERRA (référent)              | Démonstration incréments                |
| Rétrospective           | Bi-hebdomadaire                | 1 h    | Équipe tech + PO                         | Amélioration continue                   |
| Comité de pilotage      | Mensuel                        | 1,5 h  | CP + Direction ALTERRA + Direction NextA | Décisions stratégiques, budget, risques |
| Point client (référent) | Hebdomadaire                   | 45 min | CP + PO + Référent ALTERRA               | Suivi opérationnel, demandes, feedback  |

### 4.3 RACI simplifié

| Sujet                                 | Responsable        | Autorité                  | Consulté              | Informé |
| ------------------------------------- | ------------------ | ------------------------- | --------------------- | ------- |
| Décisions produit                     | PO                 | Direction ALTERRA         | CP, Tech Lead         | Équipe  |
| Décisions techniques structurantes    | Tech Lead          | CP                        | Devs                  | ALTERRA |
| Décisions ordinaires (implémentation) | Devs               | Tech Lead                 | –                     | –       |
| Priorisation sprint                   | PO                 | CP                        | Équipe tech, ALTERRA  | –       |
| Arbitrage périmètre                   | CP                 | Direction NextA           | PO, Direction ALTERRA | Équipe  |
| Escalation risques                    | CP                 | Direction NextA + ALTERRA | Tech Lead             | Équipe  |
| Recette                               | ALTERRA (référent) | Direction ALTERRA         | PO, CP                | Équipe  |
| MEP production                        | CP                 | Direction ALTERRA         | Tech Lead, DevOps     | Équipe  |

---

## 5. Planning et jalons

### 5.1 Macroplanning 17 semaines

Le détail sprint par sprint est dans le fichier `ALTERRA - Chiffrage et macroplanning.xlsx` (onglet Macroplanning). Ci-dessous une vue consolidée :

| Semaines | Phase     | Focus                                            | Livrable clé                                              |
| -------- | --------- | ------------------------------------------------ | --------------------------------------------------------- |
| S1-S2    | Sprint 1  | Cadrage + Socle technique                        | Spec figée, maquettes Figma, backend démarrable           |
| S3-S4    | Sprint 2  | API métier V1 + Admin start                      | API sandbox utilisable, tableau de bord Admin fonctionnel |
| S5-S6    | Sprint 3  | Admin complet + PWA setup                        | Web Admin utilisable, PWA installable                     |
| S7-S8    | Sprint 4  | PWA complète + Biométrie + PDF                   | Démo bout en bout du cycle hebdomadaire                   |
| S9-S10   | Sprint 5  | Données + Déploiement + Tests + Formation        | Environnement de production, formation dispensée          |
| S11-S12  | Sprint 6  | Hypercare V1                                     | V1 en production stable                                   |
| **S12**  | **Jalon** | **Recette V1 réussie**                           | **Décision GO V2 par ALTERRA**                            |
| S13-S14  | Sprint 7  | Cadrage V2 + Zone/Parcelle + Équipes + NFC start | Nouvelle hiérarchie géo, PWA NFC démarrée                 |
| S15-S16  | Sprint 8  | NFC + Bio offline + Workflows + Cartographie     | Extensions terrain fonctionnelles                         |
| S17      | Sprint 9  | Clôture quotidienne + Tests V2 + Hypercare V2    | V2 en production stable                                   |

### 5.2 Jalons clés

- **J-1 (fin S1)** : spec validée par ALTERRA + maquettes Figma présentées.
- **J-2 (fin S4)** : sandbox API accessible pour tests internes.
- **J-3 (fin S6)** : démonstration Web Admin à ALTERRA.
- **J-4 (fin S8)** : démonstration cycle complet fin de sprint (pointage → validation → bordereau).
- **J-5 (fin S10)** : formation ALTERRA sur site pilote.
- **J-6 (S12)** : recette V1 signée par ALTERRA.
- **J-7 (S12)** : décision d'engager la V2 (avenant ou report).
- **J-8 (fin S16)** : démonstration V2.
- **J-9 (S17)** : recette V2 signée.

### 5.3 Dépendances critiques externes

| Dépendance                                           | Échéance requise    | Impact si retard                                        |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| Confirmation contractuelle AXIAN sur API biométrique | Fin Sprint 3 (S6)   | Bascule en mode manuel de secours, revue périmètre V1   |
| Obtention échantillon fichier MVola Bulk Transfer    | Fin Sprint 2 (S4)   | Retard du module Excel, hypothèses à valider en aveugle |
| Fourniture données initiales par ALTERRA (Excel)     | Début Sprint 5 (S9) | Retard mise en production                               |
| Provisioning VPS                                     | Début Sprint 5 (S9) | Retard mise en production                               |
| Achat flotte smartphones Android NFC pour V2         | Fin Sprint 6 (S12)  | Report démarrage V2                                     |
| Achat badges NFC                                     | Fin Sprint 7 (S14)  | Blocage tests V2                                        |

---

## 6. Budget

### 6.1 Charges de prestation

| Poste                 | Charge (j-h) | Semaines |
| --------------------- | ------------ | -------- |
| V1 baseline           | 44           | 12       |
| V1 marge prudentielle | 6            | –        |
| **Total V1**          | **50**       | **12**   |
| V2 baseline           | 19,5         | 5        |
| V2 marge prudentielle | 1,5          | –        |
| **Total V2**          | **21**       | **5**    |
| **Total V1 + V2**     | **71**       | **17**   |

Le TJM est à saisir dans le fichier `ALTERRA - Chiffrage et macroplanning.xlsx` cellule Synthèse!C10. Le budget total est calculé automatiquement.

### 6.2 Charges complémentaires (récurrentes, à la charge d'ALTERRA)

Extrait du fichier chiffrage — onglet « Charges complémentaires » :

| Poste                                              | Mensuel USD  | Annuel USD    |
| -------------------------------------------------- | ------------ | ------------- |
| VPS hébergement (4 vCPU / 8 GB / 80 GB SSD)        | 50           | 600           |
| Domaine + DNS (SSL Let's Encrypt gratuit)          | 2            | 24            |
| Stockage backup externalisé Backblaze B2           | 3            | 36            |
| SMS OTP Telma                                      | 10           | 120           |
| Email transactionnel Mailgun                       | 10           | 120           |
| Monitoring externe UptimeRobot + Healthchecks.io   | 0            | 0             |
| API biométrique AXIAN (placeholder à confirmer)    | 50           | 600           |
| Tuiles cartographiques V2                          | 0            | 0             |
| Badges NFC (coût unique ~500 USD pour 1000 badges) | –            | 500           |
| **Total infra + ops**                              | **~125 USD** | **~1500 USD** |

### 6.3 Postes à chiffrer séparément si activés

- Maintenance évolutive post-hypercare : forfait 1 j/mois recommandé.
- Stabilisation AXIAN si API livrée après V2 : 3-5 j.
- Analyse RGPD sur biométrie locale V2 : audit juridique 2-3 j.
- Déploiement multi-sites au-delà du pilote : ~3 j par site supplémentaire.

---

## 7. Risques et mitigations

### 7.1 Risques élevés (à surveiller en priorité)

| Risque                                        | Impact                                          | Probabilité | Mitigation                                                                                                                                                                       | Owner          |
| --------------------------------------------- | ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **API AXIAN en dev sans doc**                 | Retard livraison biométrie, bascule mode manuel | Élevée      | Adapter pattern avec 3 implémentations interchangeables (Mock/Manual/AXIAN). Engagement AXIAN à formaliser dès S1. Mode manuel de secours toujours disponible.                   | CP + Tech Lead |
| **Web NFC API compatibilité limitée**         | Impose flotte Android Chrome uniquement         | Élevée      | Documenter contrainte matérielle dès Sprint 1. Fallback saisie manuelle ID badge. Tests sur appareils cibles avant achat en masse.                                               | CP + ALTERRA   |
| **Cache biométrique local — conformité RGPD** | Risque juridique                                | Élevée      | Chiffrement WebCrypto AES-256, durée limitée, effacement à révocation. Analyse RGPD par cabinet spécialisé recommandée avant MEP V2. Information explicite des MOC à l'embauche. | CP + ALTERRA   |

### 7.2 Risques moyens

| Risque                                                | Impact                                 | Mitigation                                                                                                      |
| ----------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Saisie en lot 40 MOC — UX critique                    | Adoption CDE compromise si UX mauvaise | Maquette dédiée Sprint 1. Prototype testé avec un CDE réel avant fin Sprint 4. Itération possible en hypercare. |
| Format MVola Bulk Transfer non spécifié               | Rework sur module Excel                | Demande d'échantillon dès Sprint 1. Couche d'export configurable.                                               |
| Adoption Chef d'Équipe (changement papier → digital)  | Résistance au changement               | UX simple, formation 1 demi-journée par site, présence terrain pendant semaine 1, manuel illustré en malagasy.  |
| Dérive de scope V2 en cours de projet                 | Dépassement budget/délai               | Spec V2 figée à signature avenant. Change requests chiffrées séparément. Pilote 1 site avant généralisation.    |
| Performance face-api.js sur Android bas de gamme (V2) | Biométrie offline lente                | Benchmark early Sprint 8 sur appareils cibles. Modèle TinyFace en fallback.                                     |

### 7.3 Risques faibles surveillés

- Volumétrie réelle différente des hypothèses (hypothèses validées, marge sur indexation prévue).
- Performance offline sur smartphones bas de gamme (tests planifiés, cible réaliste).

### 7.4 Registre des risques

Un registre des risques Excel doit être maintenu tout au long du projet par le CP. Une mise à jour hebdomadaire est recommandée. Escalade en comité de pilotage mensuel pour tout risque nouveau ou en élévation.

---

## 8. Décisions prises et à trancher

### 8.1 Décisions déjà prises (à ne pas remettre en cause sans motif fort)

- **Stack technique** : NestJS + Prisma + PostgreSQL + React + PWA. Choix validé pour souveraineté, maîtrise, écosystème.
- **Monolithe modulaire** vs microservices : monolithe pour simplifier opérations à cette échelle.
- **Adapter pattern biométrie** : trois providers interchangeables (Mock, Manual, AXIAN).
- **MVola par Excel manuel** : pas d'appel API vers MVola (souhait ALTERRA).
- **Livraison en deux phases V1 + V2** : V1 ferme, V2 en avenant après recette V1.
- **Souveraineté totale** : aucun BaaS, hébergement VPS dédié ALTERRA.
- **Pas de stockage KYC en V1** ; cache local chiffré uniquement en V2.

### 8.2 Décisions à trancher au démarrage

| Sujet                                                       | Impact                  | Deadline              | Owner           |
| ----------------------------------------------------------- | ----------------------- | --------------------- | --------------- |
| Choix du monorepo vs polyrepo                               | Structure code          | Sprint 1              | Tech Lead       |
| Cycle de paiement V2 : hebdomadaire, quotidien, ou les deux | UX Admin + endpoints    | Sprint 7 (cadrage V2) | ALTERRA + PO    |
| Nombre exact de Chefs d'Équipe par site (retour terrain)    | Volumétrie utilisateurs | Sprint 1              | ALTERRA         |
| Hébergement VPS : OVH Europe, OVH Madagascar, Telma Hosting | Latence, souveraineté   | Sprint 4              | ALTERRA + CP    |
| Politique de mots de passe (durée, complexité)              | Sécurité                | Sprint 2              | ALTERRA + CP    |
| Format exact fichier retour MVola                           | Import statuts          | Sprint 2              | ALTERRA + MVola |
| Utilisation ou non de MFA TOTP pour Admin                   | Sécurité                | Sprint 2              | ALTERRA + CP    |

### 8.3 Décisions dépendantes d'événements externes

- Périmètre biométrie V1 : dépend de la disponibilité de l'API AXIAN.
- Périmètre paiement quotidien V2 : dépend du souhait opérationnel d'ALTERRA en cours de V1.

---

## 9. Documents de référence

Tous les documents sont dans le dossier de travail projet :

| Document                                                 | Format     | Usage                                           |
| -------------------------------------------------------- | ---------- | ----------------------------------------------- |
| ALTERRA — Spécifications fonctionnelles et techniques v3 | docx + md  | Vue synthétique projet                          |
| ALTERRA — Spécification fonctionnelle détaillée          | docx + md  | Comportement attendu, référence pour la recette |
| ALTERRA — Spécification technique détaillée              | docx + md  | Architecture, stack, modèle de données, API     |
| ALTERRA — Backlog détaillé                               | xlsx + md  | User stories par sprint                         |
| ALTERRA — Chiffrage et macroplanning                     | xlsx       | Budget, planning, risques chiffrés              |
| ALTERRA — Brief Chef de Projet                           | docx + md  | Ce document                                     |
| ALTERRA — Brief Développeur                              | docx + md  | Handoff équipe technique                        |
| Modèle de données schéma d'architecture                  | Diagrammes | Vues techniques                                 |

---

## 10. Premiers 30 jours du CP

### Semaine 1

- Lire l'ensemble des documents de référence (env. 2 j).
- Rencontrer le référent ALTERRA et la direction (1/2 j).
- Rencontrer l'équipe technique (Tech Lead + devs) et faire le tour du repo (1/2 j).
- Vérifier la fourniture de tous les accès : email projet, dépôt Git, VPS staging, outils (Jira/Linear, Slack/Teams), Figma.
- Confirmer l'organisation des instances de gouvernance dans les agendas (voir §4.2).
- Ouvrir un canal de communication direct avec ALTERRA (Slack, WhatsApp, ou canal dédié).

### Semaine 2

- Participer à l'atelier métier ALTERRA (Sprint 1). Prendre des notes de terrain.
- Valider les user stories du Sprint 1 avec le PO.
- Formaliser l'engagement contractuel avec AXIAN pour l'API biométrique (courrier ou réunion).
- Initier la demande d'échantillon fichier MVola Bulk Transfer.
- Ouvrir et publier le registre des risques.
- Préparer et animer le premier Sprint Review.

### Semaines 3-4

- Piloter le Sprint 2 (API métier + Admin start).
- Faire un état d'avancement au COPIL mensuel #1.
- Vérifier avancement des dépendances externes (AXIAN, MVola, VPS, données initiales).
- Anticiper la fourniture du VPS pour le Sprint 5 (délai de provisioning souvent sous-estimé).
- Réaliser la première rétrospective terrain avec l'équipe.

### Livrables attendus fin M+1

- Registre des risques à jour.
- Compte-rendu du COPIL #1 partagé aux parties prenantes.
- Confirmation par écrit du statut des dépendances externes (AXIAN, MVola, VPS).
- Éventuellement plan d'action correctif si dérives détectées.

---

## 11. Contacts clés

| Rôle                    | Nom         | Email | Téléphone | Disponibilité |
| ----------------------- | ----------- | ----- | --------- | ------------- |
| Direction ALTERRA       | À compléter |       |           |               |
| Référent métier ALTERRA | À compléter |       |           | 0,5 j/sem     |
| Direction NextA         | À compléter |       |           |               |
| Tech Lead               | À compléter |       |           | 20 % ETP      |
| PO                      | À compléter |       |           | 30 % ETP      |
| Dev senior              | À compléter |       |           | 100 % ETP     |
| Dev junior/mid          | À compléter |       |           | 100 % ETP     |
| Contact AXIAN biométrie | À compléter |       |           |               |
| Support MVola           | À compléter |       |           |               |
| Hébergeur VPS           | À compléter |       |           |               |

**Astreinte** : à définir au démarrage — pas d'astreinte prévue hors hypercare.

---

## 12. Success criteria du projet

Le projet sera considéré réussi si à la fin de l'hypercare V1 (fin S12) :

- ALTERRA a signé la recette V1 sans réserve bloquante.
- Le cycle hebdomadaire complet (pointage → validation → paiement MVola → statuts retour) tourne en production sur 1 site pilote.
- Le taux de sync des pointages depuis les PWA est > 99 %.
- Le taux d'erreur du fichier MVola exporté est < 1 %.
- Aucune donnée de pointage n'a été perdue depuis la mise en production.
- L'ensemble des utilisateurs formés utilisent la plateforme au quotidien sans support de 1er niveau régulier.

Et à la fin de l'hypercare V2 (fin S17), pour les fonctionnalités additionnelles :

- Le pointage de présence NFC fonctionne de manière fiable sur la flotte cible.
- La biométrie offline est utilisée quotidiennement par les CDS.
- Les workflows de demandes sont adoptés (au moins 3 demandes traitées par mois).
- La cartographie est consultée régulièrement par l'Admin.

---

_Fin du document — v1.0 du 28 avril 2026_
