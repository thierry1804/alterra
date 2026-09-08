# ALTERRA — Spécification fonctionnelle détaillée

**Gestion du pointage, du contrôle biométrique et du paiement des MOC sur 5 sites**

Document de référence pour l'équipe de développement.
Préparé par : Thierry — NextA. 28 avril 2026 — v1.0.

---

## 1. Introduction

### 1.1 Objet du document

Ce document décrit de manière exhaustive le comportement fonctionnel attendu de la plateforme ALTERRA. Il sert de référence à l'équipe de développement pour comprendre ce que le système doit faire, pour qui, dans quelles conditions, et selon quelles règles.

Il complète la spécification technique (choix d'implémentation, contrats d'API, modèle de données) et le backlog opérationnel (découpage en user stories et sprints). Les trois documents sont à lire ensemble.

### 1.2 Portée fonctionnelle

Le périmètre couvert est celui de la v3.0 des specs générales, à savoir la gestion de bout en bout du pointage à la tâche et du paiement des Mains-d'Œuvre Communautaires (MOC) sur les cinq sites ALTERRA, en deux livraisons :

- **V1 (cœur, 12 semaines)** : authentification, référentiels, pointage à la tâche hors ligne, validation hebdomadaire avec contrôle biométrique en ligne, génération du fichier Excel MVola, rapports et facturation hebdomadaires.
- **V2 (extensions terrain, 5 semaines)** : pointage de présence par NFC, biométrie hors ligne, composition d'équipes côté PWA, workflows de demandes, hiérarchie Zone/Parcelle, cartographie, clôture quotidienne.

### 1.3 Documents de référence

| Référence        | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| ALTERRA-SPEC-v3  | Spécifications fonctionnelles et techniques v3 (synthétique)  |
| ALTERRA-SPECTECH | Spécification technique détaillée (endpoints, DTOs, sécurité) |
| ALTERRA-BACKLOG  | Backlog par module / épique / sprint                          |
| ALTERRA-CHIFF    | Chiffrage et macroplanning V1 + V2                            |

### 1.4 Terminologie

| Terme                  | Définition                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| MOC                    | Main-d'Œuvre Communautaire — travailleur saisonnier ALTERRA rémunéré à la tâche.                            |
| Campagne               | Cycle annuel de juillet à juin. Une campagne = une saison d'activités reforestation.                        |
| Activité               | Type de travail rémunéré avec unité de mesure et tarif unitaire (ex : trouaison au trou, défrichage au m²). |
| Pointage               | Enregistrement d'une tâche réalisée par un MOC (activité, quantité, jour). Base du calcul de rémunération.  |
| Présence NFC           | Enregistrement d'arrivée sur site via scan de badge NFC. Distinct du pointage de tâche.                     |
| Validation biométrique | Contrôle d'identité par comparaison photo/KYC via API AXIAN. Prérequis au paiement.                         |
| Bulk Transfer          | Format MVola pour paiement en lot via fichier Excel importé manuellement par le marchand.                   |
| PMT                    | Abréviation « Paiement » utilisée dans la description des transferts MVola.                                 |
| Parcelle               | Plus petite unité opérationnelle géographique (V2). Regroupée en Zones, rattachées à un Site.               |
| clientUuid             | Identifiant unique généré côté PWA pour un pointage, garantissant l'idempotence de la synchronisation.      |

---

## 2. Acteurs et personas

### 2.1 Vue synthétique

| Rôle                 | Contexte                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Administrateur       | 1 utilisateur au siège ALTERRA. Environnement connecté. Utilise la Web App Admin.                                              |
| Chef de Service      | 5 utilisateurs (1 par site). Mobile ou tablette au camp de base. Connexion semi-disponible. Utilise la PWA en mode validation. |
| Chef d'Équipe        | 15 utilisateurs (3 par site). Smartphone Android sur le terrain, offline critique. Utilise la PWA en mode pointage.            |
| MOC (acteur système) | Environ 600 travailleurs actifs simultanément. Non utilisateurs directs. Bénéficiaires du paiement.                            |

### 2.2 Persona — Administrateur

**Contexte.** L'Administrateur travaille au siège ALTERRA, sur un poste de travail avec connexion Internet stable. Il connaît le fonctionnement global des campagnes, les règles de paiement, et le contexte MVola. Il gère typiquement une campagne par an de manière centralisée.

**Responsabilités**

- Maintient à jour les référentiels (sites, activités, tarifs, MOC, comptes).
- Traite les demandes remontées par les Chefs de Service (V2).
- Consolide les rapports hebdomadaires reçus des 5 sites.
- Génère et transmet le fichier Excel MVola de paiement.
- Importe les statuts de retour MVola et traite les échecs.
- Consulte le tableau de bord, cartographie, journal d'audit.
- Corrige les pointages en cas d'erreur avérée, avec justification.

**Contraintes et attentes**

- Doit pouvoir travailler efficacement en fin de semaine / début de semaine suivante (fenêtre de paiement).
- A besoin d'une visibilité complète sur les données (aucune limitation de site).
- Trace toutes ses actions dans l'audit log.

### 2.3 Persona — Chef de Service

**Contexte.** Le Chef de Service est le responsable opérationnel d'un site. Il connaît les MOC nominativement, supervise les Chefs d'Équipe, valide le travail réalisé, et est le premier point de contrôle du paiement. Il travaille au camp de base, avec une connexion parfois disponible (Wi-Fi ou 3G/4G intermittent) mais pas garantie.

**Responsabilités**

- Compose les équipes (V2) : création, nommage, affectation Chef d'Équipe, ajout membres.
- Enregistre initialement les MOC avec leur photo biométrique (V1 par formulaire simple, V2 en soumettant une demande à valider par l'Admin).
- Convoque les MOC le vendredi, prend leur photo pour contrôle biométrique.
- Valide ou rejette les pointages remontés par les Chefs d'Équipe.
- Demande des précisions au Chef d'Équipe en cas de doute (V2).
- Corrige les quantités avec motif si erreur.
- Clôture la semaine (V1) ou la journée (V2), signe le rapport et la facture.
- Demande la création d'activités ou de nouveaux MOC à l'Admin (V2).

**Contraintes et attentes**

- Ne voit et n'agit que sur son site.
- Peut être hors ligne quelques heures ; sync automatique au retour.
- A besoin d'une UX claire malgré le volume (120 MOC à revoir chaque vendredi).

### 2.4 Persona — Chef d'Équipe

**Contexte.** Le Chef d'Équipe est sur le terrain, avec son équipe d'environ 40 MOC. Il connaît chaque MOC personnellement. Il n'a pas de connexion Internet pendant sa journée de travail. Il utilise son propre smartphone Android équipé de NFC (V2).

**Responsabilités**

- Ouvre la PWA le matin (au camp) et sélectionne l'activité du jour.
- Scanne les badges NFC des MOC à leur arrivée (V2).
- Enregistre la quantité réalisée par MOC au fil de la journée.
- Prend une photo de zone ou de MOC en cas de besoin.
- Gère localement l'équipe : ajout ou retrait de membres depuis la base existante (V2).
- Répond aux demandes de précisions du Chef de Service (V2).
- Synchronise au retour de connexion (auto ou manuel).

**Contraintes et attentes**

- Ne voit que sa propre équipe (isolation par équipe).
- A besoin d'une UX très rapide : 40 MOC à saisir en quelques minutes.
- Ne doit jamais perdre de données, même en cas de crash de l'app ou de batterie faible.
- Doit pouvoir travailler sans instruction écrite (icônes claires, gros boutons).

---

## 3. Cas d'usage détaillés

Chaque cas d'usage est numéroté (UC-XX), identifie son acteur principal, ses pré-conditions, son flux nominal, ses flux alternatifs et ses post-conditions. Les cas marqués (V2) sont livrés en phase 2.

### 3.1 Authentification et gestion des comptes

#### UC-01 — S'authentifier

| Champ            | Contenu                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acteur           | Tous                                                                                                                                                                           |
| Objectif         | Accéder à la plateforme avec les droits associés à son rôle.                                                                                                                   |
| Pré-conditions   | Compte actif dans le système, avec email + mot de passe (Admin, CDS) ou identifiant + OTP SMS (CDE).                                                                           |
| Déclencheur      | Ouverture de la Web App Admin ou de la PWA.                                                                                                                                    |
| Flux nominal     | 1. L'utilisateur saisit ses identifiants. 2. Le système vérifie (Argon2id). 3. Émission JWT (access 15 min) + refresh (7 j). 4. Redirection vers l'écran d'accueil selon rôle. |
| Flux alternatifs | 1a. Identifiants incorrects → erreur générique, 10 tentatives max/IP/5 min. 1b. Compte désactivé → message explicite. 1c. Refresh expiré → retour login.                       |
| Post-conditions  | Utilisateur authentifié. Entrée audit log. Token stocké en mémoire (Admin) ou IndexedDB chiffré (PWA).                                                                         |
| Exceptions       | Rupture réseau après saisie : PWA affiche « mode hors ligne », accès permis si token cache valide.                                                                             |

#### UC-02 — Réinitialiser un mot de passe

| Champ            | Contenu                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Admin (initie) ou CDS                                                                                                                                                                  |
| Objectif         | Restaurer l'accès à un compte dont le mot de passe est perdu.                                                                                                                          |
| Pré-conditions   | Un utilisateur ne parvient pas à se connecter.                                                                                                                                         |
| Déclencheur      | Clic sur « Mot de passe oublié » ou action Admin.                                                                                                                                      |
| Flux nominal     | 1. Saisie email. 2. Envoi lien réinitialisation Mailgun (15 min TTL). 3. Clic sur le lien, saisie nouveau mot de passe. 4. Hachage + enregistrement. 5. Invalidation sessions actives. |
| Flux alternatifs | 1a. Email inconnu → message générique, pas de leak.                                                                                                                                    |
| Post-conditions  | Mot de passe modifié, audit log mis à jour.                                                                                                                                            |

### 3.2 Gestion des référentiels (Admin)

#### UC-03 — Créer un site

| Champ            | Contenu                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Admin                                                                                                                                                          |
| Pré-conditions   | Admin connecté.                                                                                                                                                |
| Flux nominal     | 1. Saisie nom, code court (3 lettres), localisation, coordonnées GPS optionnelles. 2. Vérification unicité shortCode. 3. Création avec statut actif. 4. Audit. |
| Flux alternatifs | 1a. Code court déjà utilisé → erreur, formulaire non validé.                                                                                                   |
| Post-conditions  | Site créé, affectable à des CDS et référencé par des activités.                                                                                                |

#### UC-04 — Créer une activité

| Champ           | Contenu                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                                                                                                                                                  |
| Flux nominal    | 1. Saisie libellé (ex : trouaison), unité (trou, m², plant, kg), tarif unitaire en Ariary, période de validité, scope. 2. Enregistrement avec validFrom. 3. Si tarif existait, ancien fermé (validTo = veille), nouveau prend le relais. 4. Audit des deux opérations. |
| Post-conditions | Activité disponible à compter de validFrom. Pointages historiques conservent l'ancien tarif (RG-04).                                                                                                                                                                   |

#### UC-05 — Créer un MOC

| Champ            | Contenu                                                                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Admin (V1) ou CDS via demande (V2)                                                                                                                                                                                                                                                 |
| Flux nominal     | 1. Saisie formulaire complet : matricule, prénom, nom, date de naissance, situation matrimoniale, nb enfants, CIN, MVola, photo, site + équipe, date d'embauche. 2. Vérification unicité matricule + MVola. 3. Création avec statut ACTIVE. 4. Photo stockée dans MinIO. 5. Audit. |
| Flux alternatifs | 1a. Doublon matricule/MVola → erreur. 1b. Photo manquante → autorisée avec badge « à compléter ».                                                                                                                                                                                  |
| Post-conditions  | MOC pointable dès le lendemain.                                                                                                                                                                                                                                                    |

#### UC-06 — Importer une liste de MOC

| Champ           | Contenu                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acteur          | Admin                                                                                                                                                                                                                          |
| Pré-conditions  | Fichier Excel au format attendu (template téléchargeable).                                                                                                                                                                     |
| Flux nominal    | 1. Upload. 2. Parse ligne par ligne, validation des données obligatoires. 3. Preview : lignes valides en vert, erreurs en rouge avec motif. 4. Admin valide les correctes ou corrige le fichier. 5. Création transactionnelle. |
| Post-conditions | MOC créés listés. Rapport d'import archivé.                                                                                                                                                                                    |

#### UC-07 — Composer une équipe

| Champ            | Contenu                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef de Service (V2) ou Admin                                                                                                                         |
| Flux nominal     | 1. Saisie nom. 2. Sélection Chef d'Équipe parmi comptes du site. 3. Ajout MOC un par un (autocomplétion). 4. Validation. 5. Affectation MOC → équipe. |
| Flux alternatifs | 1a. MOC déjà dans une autre équipe → confirmation de réaffectation.                                                                                   |
| Post-conditions  | Équipe créée, visible par le Chef d'Équipe à sa prochaine connexion.                                                                                  |

### 3.3 Pointage à la tâche (Chef d'Équipe)

#### UC-08 — Sélectionner l'activité du jour

| Champ            | Contenu                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef d'Équipe                                                                                                               |
| Pré-conditions   | Authentifié. Référentiel activités en cache local.                                                                          |
| Déclencheur      | Ouverture PWA en début de journée.                                                                                          |
| Flux nominal     | 1. Affichage liste activités disponibles (globales + site). 2. Sélection. 3. Activité + tarif au jour J mémorisés en local. |
| Flux alternatifs | 1a. Pas de connexion ni cache → erreur invitant à se connecter avec du réseau.                                              |
| Post-conditions  | Activité du jour fixée, affichée en en-tête de saisie.                                                                      |

#### UC-09 — Saisir en lot les quantités

| Champ            | Contenu                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef d'Équipe                                                                                                                                                                                                                                           |
| Pré-conditions   | Activité du jour sélectionnée. Liste MOC en cache.                                                                                                                                                                                                      |
| Flux nominal     | 1. Liste MOC avec photo + nom. 2. Saisie quantité par MOC (clavier numérique). 3. Quantité par défaut applicable (« Tous = 50 »). 4. Total prévisionnel affiché. 5. Enregistrement : chaque pointage en IndexedDB avec clientUuid, statut PENDING_SYNC. |
| Flux alternatifs | 1a. Recherche par nom (filtre instantané). 1b. MOC absent → quantité laissée vide, aucun pointage créé.                                                                                                                                                 |
| Post-conditions  | Pointages enregistrés localement, indicateur sync incrémenté.                                                                                                                                                                                           |

#### UC-10 — Ajouter une photo à un pointage

| Champ            | Contenu                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acteur           | Chef d'Équipe                                                                                                                                          |
| Flux nominal     | 1. Ouverture caméra native (API Web). 2. Prise de vue. 3. Compression auto (1 Mo max, qualité 75 %). 4. Stockage blob IndexedDB référencé au pointage. |
| Flux alternatifs | 1a. Refus permission caméra → bouton désactivé + message.                                                                                              |
| Post-conditions  | Photo associée au pointage, uploadée à MinIO lors de la sync.                                                                                          |

#### UC-11 — Synchroniser les pointages

| Champ            | Contenu                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef d'Équipe (auto ou manuel)                                                                                                                                                                                                          |
| Pré-conditions   | Pointages PENDING_SYNC en IndexedDB. Connexion disponible.                                                                                                                                                                              |
| Déclencheur      | Auto (60 s) OU bouton « Forcer la synchronisation ».                                                                                                                                                                                    |
| Flux nominal     | 1. Préparation batch (≤ 100). 2. POST /pointages/sync. 3. Idempotence via clientUuid : `created` / `already_exists` / `rejected`. 4. Update IndexedDB → SYNCED. 5. Upload photos via URLs pré-signées MinIO. 6. Boucle batchs suivants. |
| Flux alternatifs | 1a. Erreur réseau → retry backoff exponentiel (max 5 min). 1b. Ligne rejetée → motif affiché, retry après correction.                                                                                                                   |
| Post-conditions  | Tous les pointages confirmés serveur, indicateur sync à 0.                                                                                                                                                                              |

#### UC-12 — Pointer une présence par NFC (V2)

| Champ            | Contenu                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef d'Équipe                                                                                                                                                                                                                     |
| Pré-conditions   | Mode NFC activé. Smartphone supporte Web NFC. Mapping badge ↔ MOC en cache.                                                                                                                                                       |
| Flux nominal     | 1. Activation lecteur NFC. 2. MOC approche son badge. 3. Lecture ID tag. 4. Résolution badge → MOC via cache. 5. Enregistrement PresenceRecord avec horodatage + clientUuid. 6. Feedback visuel + son. 7. Passage au MOC suivant. |
| Flux alternatifs | 1a. Badge inconnu → alerte rouge, aucune présence enregistrée. 1b. Badge déjà scanné aujourd'hui → alerte orange, choix doublon/ignorer.                                                                                          |
| Post-conditions  | PresenceRecord créé en attente de sync.                                                                                                                                                                                           |

### 3.4 Validation hebdomadaire (Chef de Service)

#### UC-13 — Consulter les pointages de la semaine

| Champ           | Contenu                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Chef de Service                                                                                                                                                                                                                 |
| Pré-conditions  | Pointages synchronisés depuis les PWA CDE.                                                                                                                                                                                      |
| Flux nominal    | 1. Sélection semaine (défaut : semaine courante). 2. Chargement pointages du site. 3. Affichage groupé par équipe : par MOC → nb pointages, montant prévisionnel, statut. 4. Filtres : équipe, statut, Parcelle (V2), activité. |
| Post-conditions | Vue exhaustive des données à valider.                                                                                                                                                                                           |

#### UC-14 — Effectuer un contrôle biométrique

| Champ            | Contenu                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acteur           | Chef de Service                                                                                                                                                                                                                                                                                                                      |
| Pré-conditions   | MOC présent physiquement. Connexion AXIAN (V1) ou cache biométrique chargé (V2).                                                                                                                                                                                                                                                     |
| Flux nominal     | 1. Ouverture caméra plein écran. 2. Prise photo MOC. 3. Envoi API AXIAN avec workerId + mvolaNumber (V1). Ou comparaison locale template chiffré (V2). 4. Résultat en secondes : OK (score ≥ seuil), DOUBT (0.5 ≤ score < seuil), KO (score < 0.5). 5. Pastille visuelle : vert/orange/rouge. 6. V1 : photo non stockée après envoi. |
| Flux alternatifs | 1a. API AXIAN indisponible → mode manuel avec traçabilité. 1b. DOUBT → nouvelle photo possible.                                                                                                                                                                                                                                      |
| Post-conditions  | BiometricCheck en base avec le résultat.                                                                                                                                                                                                                                                                                             |

#### UC-15 — Valider les pointages d'un MOC

| Champ            | Contenu                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Acteur           | Chef de Service                                                                              |
| Pré-conditions   | Contrôle biométrique OK. Pointages PENDING pour la semaine.                                  |
| Flux nominal     | 1. Passage tous les pointages du MOC → VALIDATED. 2. Enregistrement validatedById. 3. Audit. |
| Flux alternatifs | 1a. DOUBT → confirmation motivée. 1b. KO → validation refusée, escalade Admin.               |
| Post-conditions  | Pointages validés, comptabilisables dans le bordereau.                                       |

#### UC-16 — Valider en lot par filtre (V2)

| Champ            | Contenu                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef de Service                                                                                                                           |
| Pré-conditions   | Filtres appliqués (semaine, zone, parcelle, équipe). Contrôles bio OK.                                                                    |
| Flux nominal     | 1. Affichage nombre concerné. 2. Confirmation explicite si > 50 pointages. 3. Passage en VALIDATED en une transaction. 4. Audit détaillé. |
| Flux alternatifs | 1a. MOC sans bio OK → pointages exclus automatiquement.                                                                                   |
| Post-conditions  | Ensemble sélectionné validé.                                                                                                              |

#### UC-17 — Rejeter un pointage

| Champ           | Contenu                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Acteur          | Chef de Service                                                                                       |
| Flux nominal    | 1. Saisie motif obligatoire (texte libre). 2. Pointage → REJECTED. 3. Notification CDE via badge PWA. |
| Post-conditions | Pointage non comptabilisable. CDE peut créer un pointage corrigé.                                     |

#### UC-18 — Demander des précisions (V2)

| Champ           | Contenu                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Acteur          | Chef de Service                                                                                               |
| Flux nominal    | 1. Saisie question + demande photo optionnelle. 2. ClarificationRequest en OPEN. 3. Notification push au CDE. |
| Post-conditions | Pointage en NEEDS_CLARIFICATION.                                                                              |

#### UC-19 — Répondre à une demande de précisions (V2)

| Champ           | Contenu                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Chef d'Équipe                                                                                                                    |
| Flux nominal    | 1. Ouverture demande. 2. Saisie réponse (texte, photo). 3. Envoi. 4. ClarificationRequest → ANSWERED. 5. Notification email CDS. |
| Post-conditions | Demande contient la réponse, CDS peut valider ou rejeter.                                                                        |

#### UC-20 — Soumettre une demande d'activité (V2)

| Champ           | Contenu                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Chef de Service                                                                                                     |
| Flux nominal    | 1. Saisie libellé, unité, tarif proposé, justification. 2. ActivityRequest en PENDING. 3. Notification email Admin. |
| Post-conditions | Admin voit dans sa file, décidera (UC-21).                                                                          |

#### UC-21 — Traiter une demande terrain (V2)

| Champ           | Contenu                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                                                               |
| Flux nominal    | 1. Affichage demandes triées par ancienneté. 2. Détail, contexte, justification. 3. Actions : Accepter (crée entité), Refuser (motif), Complément. 4. Notification email demandeur. |
| Post-conditions | Demande en APPROVED, REJECTED ou reste PENDING avec commentaire.                                                                                                                    |

### 3.5 Clôture, rapport et facture

#### UC-22 — Clôturer la semaine

| Champ            | Contenu                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Chef de Service                                                                                                                                                                                                                                   |
| Pré-conditions   | Toutes les validations faites (ou ignorées avec motif).                                                                                                                                                                                           |
| Flux nominal     | 1. Vérification absence PENDING sans motif. 2. Génération rapport hebdo PDF (par jour, activité, MOC). 3. Génération facture PDF. 4. Stockage MinIO. 5. Signature électronique avec horodatage. 6. Notification email Admin avec liens sécurisés. |
| Flux alternatifs | 1a. PENDING sans motif → confirmation explicite.                                                                                                                                                                                                  |
| Post-conditions  | Semaine clôturée, Admin reçoit rapport + facture.                                                                                                                                                                                                 |

#### UC-23 — Clôturer la journée (V2)

| Champ           | Contenu                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Acteur          | Chef de Service                                                                                 |
| Flux nominal    | 1. Vérification analogue UC-22 sur journée. 2. Rapport journalier court. 3. Notification Admin. |
| Post-conditions | Journée clôturée, paiement quotidien possible.                                                  |

### 3.6 Génération et paiement MVola (Admin)

#### UC-24 — Générer le bordereau de paiement

| Champ           | Contenu                                                                                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                                                                                                                                                       |
| Pré-conditions  | Pointages VALIDATED pour la période.                                                                                                                                                                                                                                        |
| Flux nominal    | 1. Choix période (semaine ISO ou jour V2). 2. Sélection pointages VALIDATED tous sites. 3. Agrégation par MOC : somme(quantité × tarif snapshoté). 4. Création lignes Payment en PENDING. 5. Affichage bordereau : prénom, nom, site, MVola, montant, statut bio (OUI/NON). |
| Post-conditions | Bordereau prêt à ajuster et exporter.                                                                                                                                                                                                                                       |

#### UC-25 — Modifier manuellement une ligne de paiement

| Champ           | Contenu                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                |
| Flux nominal    | 1. Saisie nouveau montant + motif obligatoire. 2. Enregistrement avec ancien/nouveau dans audit log. |
| Post-conditions | Ligne modifiée, badge « corrigé ».                                                                   |

#### UC-26 — Générer le fichier Excel MVola

| Champ           | Contenu                                                                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                                                                                                                                                             |
| Pré-conditions  | Bordereau finalisé.                                                                                                                                                                                                                                                               |
| Flux nominal    | 1. Génération .xlsx 5 colonnes : Numéro téléphone, Description (« Prénom Paiement Site »), Période (Sxx/Dxxx), Montant en Ariary, Bio Validée (OUI/NON). 2. Descriptions tronquées si > limite MVola. 3. Fichier téléchargeable + archivé MinIO. 4. Payment concernés → EXPORTED. |
| Post-conditions | Admin dispose du .xlsx pour soumission MVola.                                                                                                                                                                                                                                     |

#### UC-27 — Importer les statuts retour MVola

| Champ            | Contenu                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur           | Admin                                                                                                                                                       |
| Pré-conditions   | Fichier retour récupéré depuis portail MVola.                                                                                                               |
| Flux nominal     | 1. Upload. 2. Parse + matching par numéro MVola + montant. 3. Update Payment → PAID / FAILED avec motif. 4. Rapport d'import : PAID vs FAILED, taux succès. |
| Flux alternatifs | 1a. Fichier non conforme → erreur avec position. 1b. Lignes non matchées → listées séparément.                                                              |
| Post-conditions  | Statuts à jour, tableau de bord reflète les paiements réels.                                                                                                |

### 3.7 Consultation et administration

#### UC-28 — Consulter le tableau de bord Admin

| Champ           | Contenu                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                                                                                                                  |
| Flux nominal    | 1. KPIs : MOC actifs par site, pointages semaine, paiements en attente, montant total. 2. Graphes : présence par site, évolution effectifs, montants payés. 3. Alertes : CDS non sync 24 h, écarts bio non résolus, pointages anciens. |
| Post-conditions | Aperçu global avec drill-down sur KPI.                                                                                                                                                                                                 |

#### UC-29 — Consulter la cartographie (V2)

| Champ           | Contenu                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                                                                           |
| Flux nominal    | 1. Carte Leaflet centrée Madagascar. 2. Marqueurs sites avec compteurs (effectif, activité du jour). 3. Couches Sites/Zones/Parcelles activables. 4. Click marqueur/polygone → détails latéral. |
| Post-conditions | Navigation carte avec zoom par site.                                                                                                                                                            |

#### UC-30 — Consulter le journal d'audit

| Champ           | Contenu                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                                               |
| Flux nominal    | 1. Affichage paginé des dernières entrées. 2. Filtres : utilisateur, action, type d'entité, période. 3. Détail : état avant / après, IP, timestamp. |
| Post-conditions | Origine de l'action identifiée.                                                                                                                     |

#### UC-31 — Exporter une liste en CSV / Excel / PDF

| Champ           | Contenu                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Acteur          | Admin                                                                                                                        |
| Flux nominal    | 1. Choix format. 2. Génération serveur (job BullMQ si volumineux). 3. Téléchargement direct ou notification email si tardif. |
| Post-conditions | Fichier disponible.                                                                                                          |

---

## 4. Règles métier

| ID    | Titre                                    | Description                                                                                                                                                                       |
| ----- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RG-01 | Calcul du montant d'un pointage          | Montant = quantité × tarif_unitaire_snapshot. Le tarif est figé au moment de l'enregistrement du pointage, jamais recalculé rétroactivement.                                      |
| RG-02 | Idempotence sync                         | Chaque pointage porte un clientUuid généré côté PWA. Le serveur impose l'unicité : une retransmission ne crée jamais de doublon.                                                  |
| RG-03 | Statut biométrique préalable au paiement | Un MOC ne peut pas figurer dans un bordereau sans un BiometricCheck OK pour la période. Exception : validation manuelle CDS en mode dégradé.                                      |
| RG-04 | Versioning des tarifs d'activité         | Un tarif est valide entre validFrom et validTo. Les pointages historiques utilisent le tarif en vigueur à leur date. Modifier un tarif ne recalcule PAS les pointages antérieurs. |
| RG-05 | Isolation par site (Chef de Service)     | Un CDS ne peut lire ni modifier les données d'un site auquel il n'est pas affecté. Filtrage API ET Prisma (double barrière).                                                      |
| RG-06 | Isolation par équipe (Chef d'Équipe)     | Un CDE ne peut pointer que les MOC de son équipe. Il ne voit pas les pointages des autres équipes du même site.                                                                   |
| RG-07 | Correction de pointage traçable          | Toute modification par l'Admin nécessite un motif et est journalisée. La version antérieure est conservée dans l'audit log.                                                       |
| RG-08 | Détection d'anomalie quantité            | Une quantité > 3 σ de la moyenne pour une activité déclenche une alerte visuelle Admin. N'empêche pas la validation mais requiert une revue.                                      |
| RG-09 | Description MVola tronquée               | Si la description « Prénom Paiement Code site » dépasse la limite MVola (~30 caractères), le prénom est tronqué en préservant les 3 lettres du code site à la fin.                |
| RG-10 | Format période paiement                  | Format ISO court : Sxx pour semaine (S01 à S53), Dxxx pour jour (D001 à D366) selon cycle retenu.                                                                                 |
| RG-11 | Politique mot de passe                   | Minimum 10 caractères, hashé Argon2id. Vérification contre dictionnaire de mots de passe compromis. Renouvellement recommandé tous les 12 mois.                                   |
| RG-12 | Durée de conservation des données        | Opérationnelles : 5 ans. Audit log : 24 mois. Photos pointage : 12 mois post-clôture campagne. Templates biométriques locaux V2 : 7 jours, paramétrable.                          |
| RG-13 | Droit à l'effacement                     | Sur demande d'un MOC, données anonymisées (nom → « MOC-XXXX »). Pointages restent comptables mais dissociés de l'identité.                                                        |
| RG-14 | Cycle campagne                           | Une campagne = 1er juillet au 30 juin. Données accessibles au-delà mais archivées visuellement. Nouvelle campagne = répartition possible des équipes et MOC.                      |
| RG-15 | Résolution des conflits offline          | Modifications simultanées serveur / client : le serveur est autoritaire. Un pointage modifié par Admin pendant que CDE est offline sera écrasé côté PWA au retour.                |
| RG-16 | Verrouillage PWA par PIN                 | Après 30 min d'inactivité, PWA verrouillée. PIN 4 chiffres pour rouvrir. Données locales chiffrées accessibles uniquement après déverrouillage.                                   |
| RG-17 | Compression des photos                   | Toute photo capturée : 1 Mo max, qualité 75 %, JPEG. Métadonnées EXIF supprimées (privacy). Résolution max 1920×1080.                                                             |
| RG-18 | Rate limiting authentification           | 10 tentatives par IP toutes les 5 min. 5 tentatives par compte avant lockout progressif (5 min → 15 min → 1 h).                                                                   |
| RG-19 | Notification échec paiement              | Un Payment en FAILED déclenche alerte dashboard Admin. Motif affiché. Action manuelle requise (correction, régénération).                                                         |
| RG-20 | Backup et rétention                      | pg_dump quotidien 02h00 (Antananarivo) vers Backblaze B2. Rétention 30 j en glissant. Restauration testée mensuellement.                                                          |

---

## 5. Description des écrans

### 5.1 Web App Admin

#### 5.1.1 Écran de connexion

| Champ       | Contenu                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| Utilisateur | Admin (CDS pour mode dégradé desktop)                                                         |
| Objectif    | Authentifier un utilisateur                                                                   |
| Composants  | Logo, champ email, mot de passe, bouton Se connecter, lien Mot de passe oublié, champ OTP MFA |
| Actions     | Saisir email, mot de passe, valider, demander réinitialisation                                |
| Cas limites | Erreur générique 401, lockout après 10 tentatives, MFA obligatoire si activé                  |

#### 5.1.2 Tableau de bord

| Champ       | Contenu                                                                                 |
| ----------- | --------------------------------------------------------------------------------------- |
| Utilisateur | Admin uniquement                                                                        |
| Objectif    | Vue synthétique de l'état des opérations                                                |
| Composants  | 4 KPI cards en haut, graphe présence 7 j, graphe évolution effectifs 30 j, bloc alertes |
| Actions     | Click KPI → drill-down. Click alerte → écran correspondant                              |
| Données     | Refresh 60 s. Période : semaine courante                                                |

#### 5.1.3 Liste des MOC

| Champ       | Contenu                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Utilisateur | Admin (tous MOC), CDS (MOC de son site)                                                                                                                             |
| Objectif    | Consulter, filtrer, créer, modifier                                                                                                                                 |
| Composants  | Recherche, filtres (site/équipe/statut), tableau paginé, actions (Nouveau, Importer, Export), colonnes : photo, nom, prénom, matricule, MVola, site, équipe, statut |
| Cas limites | 600-1000 MOC : pagination cursor-based, taille 50                                                                                                                   |

#### 5.1.4 Fiche MOC

| Champ       | Contenu                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| Utilisateur | Admin, CDS (lecture)                                                      |
| Composants  | Panneau info + onglets Pointages / Paiements / Contrôles bio / Historique |
| Actions     | Modification en place (Admin), rappel MVola, marquage inactif             |

#### 5.1.5 Liste des pointages

| Champ       | Contenu                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| Utilisateur | Admin (tous)                                                                   |
| Composants  | Filtres avancés, tableau paginé, badge statut coloré, photo miniature, actions |
| Actions     | Correction avec motif obligatoire, export                                      |

#### 5.1.6 Module Paiements

| Champ       | Contenu                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Utilisateur | Admin uniquement                                                                                      |
| Composants  | Sélecteur période, bouton Générer, tableau bordereau (5 colonnes MVola + statut bio), badge par ligne |
| Actions     | Génération auto, modification manuelle avec motif, download, import retour                            |
| Cas limites | Bordereau ~600 lignes : tri, filtre, pagination                                                       |

#### 5.1.7 Cartographie (V2)

| Champ       | Contenu                                                                           |
| ----------- | --------------------------------------------------------------------------------- |
| Utilisateur | Admin                                                                             |
| Composants  | Carte Leaflet, marqueurs sites, couches Zones/Parcelles activables, popup latéral |
| Actions     | Zoom, filtre par activité, click marqueur                                         |

#### 5.1.8 File des demandes (V2)

| Champ       | Contenu                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Utilisateur | Admin                                                                                             |
| Composants  | Onglets par type, tri par ancienneté, détail dans drawer, actions Accepter / Refuser / Complément |
| Actions     | Décision avec motif si refus, modification paramètres à l'acceptation                             |

#### 5.1.9 Audit log

| Champ       | Contenu                                                      |
| ----------- | ------------------------------------------------------------ |
| Utilisateur | Admin                                                        |
| Composants  | Tableau paginé, filtres, drawer détail avec diff avant/après |

### 5.2 PWA Terrain

#### 5.2.1 Écran de connexion PWA

| Champ       | Contenu                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| Utilisateur | CDE, CDS                                                                  |
| Composants  | Logo, champ email/identifiant, mot de passe. Alternative OTP SMS pour CDE |
| Cas limites | Mode offline : vérification token cache, sinon message clair              |

#### 5.2.2 Écran d'accueil Chef d'Équipe

| Champ      | Contenu                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Composants | Bandeau statut connexion + sync, bouton Pointage tâche (grand), bouton Pointage NFC présence (V2), bouton Mon équipe, indicateur en attente |

#### 5.2.3 Sélection activité du jour

| Champ      | Contenu                                                                               |
| ---------- | ------------------------------------------------------------------------------------- |
| Composants | Liste activités disponibles (photo/icône + libellé + unité + tarif), sélection unique |

#### 5.2.4 Saisie en lot (écran cœur)

| Champ       | Contenu                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composants  | En-tête activité + tarif. Barre recherche. Liste MOC avec photo miniature (48×48), nom, matricule, champ numérique, suggestion défaut. Total prévisionnel en bas fixe |
| Cas limites | ~40 lignes : scroll fluide, pas de perte de saisie                                                                                                                    |

#### 5.2.5 Écran Chef de Service — Validation

| Champ      | Contenu                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composants | Filtres (semaine, équipe), liste MOC groupée, indicateur bio (vert/orange/rouge/gris), bouton Contrôle biométrique, actions par MOC (Valider, Rejeter, Précisions V2) |

#### 5.2.6 Écran contrôle biométrique

| Champ      | Contenu                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Composants | Vue caméra plein écran avec repère facial, bouton capture, prévisualisation. Après envoi : pastille résultat + score |

#### 5.2.7 Écran de synchronisation

| Champ      | Contenu                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Composants | Compteur pointages/présences/photos en attente, dernière sync réussie, bouton Forcer, log récent |

---

## 6. Workflows d'état

### 6.1 Pointage

```
[PENDING]  ── validation Chef Service ──>  [VALIDATED]
[PENDING]  ── rejet Chef Service ────>     [REJECTED]
[PENDING]  ── demande précisions V2 ─>     [NEEDS_CLARIFICATION]
[NEEDS_CLARIFICATION] ── réponse OK ─>     [VALIDATED]
[NEEDS_CLARIFICATION] ── réponse KO ─>     [REJECTED]
[VALIDATED]  ── inclus dans bordereau paiement (implicite)
[REJECTED]   ── état terminal
```

Notes : un pointage REJECTED n'est jamais rappelé dans un bordereau. Un pointage VALIDATED peut être corrigé par l'Admin mais reste VALIDATED (l'audit trace la modification).

### 6.2 Payment (paiement individuel MOC)

```
[PENDING]   ── Admin valide bordereau + export ──>  [EXPORTED]
[EXPORTED]  ── import fichier retour MVola OK ──>   [PAID]
[EXPORTED]  ── import fichier retour MVola KO ──>   [FAILED]
[FAILED]    ── Admin corrige et régénère ────>      [PENDING] (nouvel export)
[PAID]      ── état terminal
```

### 6.3 BiometricCheck

```
── création via UC-14, résultat AXIAN : {OK, DOUBT, KO, UNAVAILABLE}
[OK]     : autorise validation en un clic
[DOUBT]  : autorise validation avec confirmation motivée
[KO]     : bloque validation, escalade Admin
[UNAVAILABLE] : bascule en mode manuel (validation CDS à ses risques)
```

### 6.4 ActivityRequest (V2)

```
[PENDING]   ── Admin accepte ──>  [APPROVED] (Activity créée)
[PENDING]   ── Admin refuse ──>   [REJECTED] (avec motif)
[PENDING]   ── Admin demande complément ──>  reste [PENDING] avec commentaire
```

### 6.5 WorkerRequest (V2)

Mêmes états que ActivityRequest. À l'acceptation, un Worker est créé avec les données proposées.

### 6.6 ClarificationRequest (V2)

```
[OPEN]       ── Chef d'Équipe répond ──>    [ANSWERED]
[ANSWERED]   ── Chef de Service clôture ──> [CLOSED]
```

### 6.7 PWA sync (pointage individuel)

```
[LOCAL_PENDING]  (créé en IndexedDB avec clientUuid)
        │
        └─ sync auto ou manuelle ─>  [SYNC_IN_FLIGHT]
                                     │
                                     ├─ 201/200 ─>  [SYNCED]
                                     ├─ 409 (déjà) ─>  [SYNCED]
                                     └─ erreur ─>  [SYNC_FAILED] (retry backoff)
```

---

## 7. Rapports et exports

### 7.1 Rapport hebdomadaire PDF

Généré à la clôture de la semaine par le CDS (UC-22). Stocké dans MinIO, transmis par email à l'Admin.

**Structure**

1. Page de garde : logo ALTERRA, nom du site, semaine ISO, date de génération, nom du CDS.
2. Résumé exécutif : nombre de MOC ayant travaillé, nombre de pointages, montant total, taux de bio OK.
3. Vue par jour : tableau lundi à dimanche avec activités et quantités agrégées.
4. Vue par MOC : photo, nom, matricule, MVola, pointages détaillés, montant total, statut biométrique.
5. Anomalies : liste des pointages rejetés ou en clarification.
6. Signature électronique : nom du CDS, horodatage, hash intégrité.

### 7.2 Facture hebdomadaire PDF

Générée en même temps. Format plus court, adapté à l'archivage comptable.

**Structure**

1. Numéro de facture unique.
2. Entête ALTERRA (siège), destinataire (site).
3. Récapitulatif par activité : nb pointages, quantité totale, montant.
4. Total à payer HT.
5. Liste résumée des MOC (nom, montant).
6. Signature électronique du CDS.

### 7.3 Rapport journalier PDF (V2)

Version raccourcie du rapport hebdomadaire, généré à la clôture d'une journée (UC-23). Permet un paiement quotidien.

### 7.4 Fichier Excel MVola Bulk Transfer

| Élément                      | Format                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Nom fichier                  | `ALTERRA_MVola_{periodIso}_{yyyyMMdd_HHmm}.xlsx` (ex : `ALTERRA_MVola_S18_20260428_0920.xlsx`) |
| Feuille                      | Une seule, nommée « Paiements ».                                                               |
| Ligne 1                      | Header (Numéro téléphone, Description, Période, Montant, Bio Validée).                         |
| Lignes 2+                    | Une ligne par MOC avec paiement à effectuer.                                                   |
| Colonne A — Numéro téléphone | Format texte, 10 chiffres (034XXXXXXX).                                                        |
| Colonne B — Description      | « Prénom Paiement Code_site », tronqué si nécessaire (RG-09).                                  |
| Colonne C — Période          | Sxx ou Dxxx (RG-10).                                                                           |
| Colonne D — Montant          | Nombre entier en Ariary, sans séparateur.                                                      |
| Colonne E — Bio Validée      | OUI / NON / N/A.                                                                               |

### 7.5 Exports référentiels

- Liste MOC : CSV / Excel / PDF avec colonnes complètes.
- Liste pointages filtrée : idem.
- Liste paiements avec statut : idem, utile pour rapprochement comptable.
- Journal d'audit filtré : CSV et PDF.

---

## 8. Notifications

Le système émet des notifications selon des événements précis. Canaux : email transactionnel (Mailgun), SMS (Telma), push in-app PWA (via SW + IndexedDB), alertes visuelles dashboard Admin.

| Événement                     | Canal             | Destinataire       | Contenu type                                                                                |
| ----------------------------- | ----------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Clôture semaine par CDS       | Email             | Admin              | Semaine S18 site MNK clôturée. Rapport et facture joints. Montant total : XXX Ar.           |
| Demande d'activité (V2)       | Email             | Admin              | Nouvelle demande d'activité de [CDS]. Cliquez pour traiter.                                 |
| Demande MOC (V2)              | Email             | Admin              | Nouvelle demande MOC de [CDS]. Cliquez pour traiter.                                        |
| Demande précisions (V2)       | Push PWA          | Chef d'Équipe      | Le CDS demande des précisions sur un pointage. Ouvrez la PWA.                               |
| Réponse à précisions          | Email             | Chef de Service    | Le CDE a répondu à votre demande de précisions.                                             |
| Approbation demande (V2)      | Email + PWA       | Chef de Service    | Votre demande [type] a été [acceptée/refusée]. [Motif si refus].                            |
| Réinitialisation mot de passe | Email             | Utilisateur        | Cliquez sur le lien pour réinitialiser votre mot de passe. Valide 15 min.                   |
| OTP connexion CDE             | SMS               | Chef d'Équipe      | Code ALTERRA : XXXXXX (valide 5 minutes).                                                   |
| Écart biométrique KO          | Email             | Admin              | Un contrôle biométrique KO a bloqué le paiement de [MOC]. Traiter dans le module Pointages. |
| Échec paiement MVola          | Email + Dashboard | Admin              | Le fichier retour indique X échecs. Voir dashboard.                                         |
| Rapport mensuel               | Email             | Liste configurable | Rapport mensuel joint. Chiffres clés dans le corps.                                         |
| Pas de sync depuis 24 h       | Alerte Dashboard  | Admin              | [CDS X] n'a pas synchronisé depuis 24 h.                                                    |

### 8.1 Configuration

- Listes de destinataires (rapport mensuel) paramétrables dans Admin > Paramètres > Notifications.
- Templates email stockés dans le code (i18n possible, français par défaut).
- SMS OTP limités par Telma. Prévoir 1 SMS par connexion CDE (env. 15 × 5 j = 75 SMS/semaine).

---

## 9. Gestion des erreurs

Codes d'erreur métier structurés (préfixe module + code HTTP). Messages utilisateur clairs et actionnables. Détails techniques loggés serveur, jamais affichés.

| Code             | Situation                                 | Comportement attendu                                                                                                       |
| ---------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AUTH-401         | Identifiants incorrects                   | « Identifiants incorrects. Vérifiez votre email et mot de passe. » Générique, pas de leak.                                 |
| AUTH-403         | Accès refusé (rôle insuffisant)           | « Vous n'avez pas les permissions pour cette action. » + log audit.                                                        |
| AUTH-429         | Trop de tentatives                        | « Trop de tentatives. Réessayez dans X minutes. » Avec compte à rebours.                                                   |
| SYNC-409         | Pointage déjà existant (clientUuid)       | Traité silencieusement côté PWA (marqué SYNCED). Pas d'alerte.                                                             |
| SYNC-422         | Pointage rejeté (validation métier)       | Le pointage remonte marqué avec le motif. Utilisateur corrige et re-sync.                                                  |
| BIO-503          | API AXIAN indisponible                    | « Le service biométrique est temporairement indisponible. Vous pouvez valider manuellement à vos risques (mode dégradé). » |
| BIO-KO           | Contrôle biométrique KO                   | « Identité non confirmée. La validation est bloquée. Contactez l'Administrateur. »                                         |
| PAY-CONFLICT     | Bordereau déjà exporté pour cette période | « Un bordereau existe déjà pour cette période. Voulez-vous générer un correctif ? »                                        |
| NFC-UNSUPPORTED  | Navigateur ne supporte pas Web NFC        | « Cette fonctionnalité nécessite un navigateur récent sur Android. » + désactivation.                                      |
| NFC-DENIED       | Permission NFC refusée                    | « Autorisez l'accès NFC dans les paramètres. » + lien aide.                                                                |
| CAM-DENIED       | Permission caméra refusée                 | « Autorisez l'accès à la caméra pour prendre des photos. » + lien aide.                                                    |
| STORAGE-FULL     | IndexedDB pleine                          | « Espace de stockage local plein. Synchronisez pour libérer. »                                                             |
| NETWORK-DOWN     | Perte de connexion en cours d'appel       | Bandeau discret « Mode hors ligne ». Actions restent possibles, remontent en file.                                         |
| IMPORT-BADFORMAT | Fichier import mal formé                  | Détail ligne par ligne : « Ligne X : colonne Y invalide (raison). »                                                        |
| SERVER-500       | Erreur serveur inattendue                 | « Une erreur inattendue est survenue. L'équipe a été notifiée. » + trace-id.                                               |

### 9.1 Principes généraux

- Toujours proposer une action (retry, contact, correction).
- Ne jamais exposer d'informations techniques sensibles (IDs internes, structures).
- Loguer avec trace-id unique pour permettre le support.
- En mode offline, tomber en douceur : la PWA continue de fonctionner localement.

---

## 10. Critères d'acceptation globaux

### 10.1 Fonctionnels

- Un CDE peut créer 40 pointages en moins de 5 minutes.
- Un CDS peut valider une semaine complète (120 MOC) en moins de 90 minutes, contrôle biométrique inclus.
- Un Admin peut générer et exporter un fichier MVola pour 600 MOC en moins de 30 secondes.
- Aucune donnée n'est perdue en cas de rupture réseau pendant la saisie ou la sync.
- Un pointage rejeté peut être corrigé et re-soumis par le CDE.
- Toutes les corrections manuelles sont tracées avec motif obligatoire.

### 10.2 Non fonctionnels

- Temps de réponse API < 200 ms au P95 pour endpoints lecture, < 500 ms écriture.
- Temps de démarrage PWA < 2 secondes après premier chargement (SW actif).
- Temps de sync d'un batch de 40 pointages < 5 secondes avec connexion 3G.
- Disponibilité serveur > 99 % (hors maintenance planifiée).
- RPO < 24 h (backup quotidien).
- RTO < 4 h (restauration testée).

### 10.3 Sécurité

- Aucun secret dans le code source (env vars uniquement).
- Toutes les communications en TLS 1.3.
- Aucune donnée biométrique n'est stockée en clair (V2).
- Chaque compte a un audit trail exhaustif.

### 10.4 UX

- PWA installable en 3 taps depuis le navigateur.
- Toutes les actions critiques ont un feedback en moins de 200 ms.
- Aucun texte de moins de 14 px sur mobile.
- Contraste minimum WCAG AA (4.5:1 pour texte normal).
- Boutons d'action principaux 44×44 px minimum.

### 10.5 Recette

Recette sur un site pilote (1 site, 3 équipes, 120 MOC) avant généralisation. Vérifications :

- Cycle hebdomadaire complet du lundi au lundi suivant (pointage → validation → paiement).
- Un cas d'échec biométrique et sa remontée.
- Un import MVola avec 10 % d'échecs et leur traitement.
- Un test offline de 8 h avec synchronisation ensuite.
- Une correction Admin d'un pointage validé.

---

_Fin du document — v1.0 du 28 avril 2026_
