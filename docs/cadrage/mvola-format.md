# ALTERRA — Format Excel MVola Bulk Transfer

**Statut :** Spécification documentaire — **échantillon réel à valider avec ALTERRA**  
**Date :** 21 juillet 2026  
**UC associés :** `UC-BE-PAY-EXP`, `UC-BE-PAY-IMP`, `UC-FE-ADM-PAY-EXP`, `UC-FE-ADM-PAY-IMP`  
**Condition Sprint 1 :** Obtenir un échantillon fichier MVola (export + retour) auprès d'ALTERRA

---

## 1. Contexte

ALTERRA ne paie **jamais par API MVola**. Le flux V1 est :

1. Admin génère bordereau dans ALTERRA (pointages VALIDATED agrégés).
2. Admin exporte fichier `.xlsx` format Bulk Transfer.
3. Admin soumet manuellement via portail/application marchand MVola.
4. Admin récupère fichier retour et l'importe dans ALTERRA pour mettre à jour statuts PAID/FAILED.

---

## 2. Fichier `basedocs/modele.xlsx`

| Élément | Constat |
|---------|---------|
| Présence | Oui, fichier existant |
| Contenu réel | **Backlog / chiffrage projet** (feuilles « Backlog », « Charges Complémentaires », « Macro-Planning ») |
| Colonnes observées | Use Case, User Story, Acteur, Tâche, Description, Estimations UI/BE |
| Conclusion | **Ce fichier n'est PAS un template MVola Bulk Transfer** |

**Action requise :** Demander à ALTERRA un échantillon réel de :
- Fichier soumis au portail MVola (export)
- Fichier retour après traitement (import statuts)

---

## 3. Format export ALTERRA → MVola (spec V1)

Source : Spec fonctionnelle détaillée §7.4, Spec v3 §8.2, RG-09, RG-10.

### 3.1 Métadonnées fichier

| Élément | Valeur |
|---------|--------|
| Extension | `.xlsx` (Excel 2007+) |
| Nom fichier | `ALTERRA_MVola_{periodIso}_{yyyyMMdd_HHmm}.xlsx` |
| Exemple | `ALTERRA_MVola_S18_20260428_0920.xlsx` |
| Feuille unique | Nom : `Paiements` |
| Encodage texte | UTF-8 via Excel ; colonne téléphone en **format texte** |
| Archivage | Copie stockée MinIO à chaque export |

### 3.2 Structure colonnes (ligne 1 = header)

| Col | Header exact | Type | Obligatoire | Description | Exemple |
|-----|--------------|------|-------------|-------------|---------|
| A | `Numéro téléphone` | Texte | Oui | 10 chiffres, préfixe 034 | `0341234567` |
| B | `Description` | Texte | Oui | « Prénom Paiement Code_site » | `Rakoto Paiement MNK` |
| C | `Période` | Texte | Oui | Semaine ISO `Sxx` ou jour `Dxxx` | `S18` ou `D138` |
| D | `Montant` | Entier | Oui | Ariary, sans séparateur décimal | `125000` |
| E | `Bio Validée` | Enum | Oui | `OUI` uniquement en export bulk ; `NON` / `N/A` = interne ALTERRA, jamais exportées | `OUI` |

### 3.3 Règles par colonne

#### Colonne A — Numéro téléphone

- Format : 10 chiffres commençant par `034` (MVola Madagascar)
- Source : champ `Worker.mvolaNumber`
- Validation export : rejeter lignes sans numéro ou format invalide
- Excel : cellule format `@` (texte) pour éviter perte zéros initiaux

#### Colonne B — Description

- Pattern : `{Prénom} Paiement {CodeSite}`
- Code site : 3 lettres (`shortCode` du Site, ex. MNK, ANJ)
- Limite : ~30 caractères (RG-09) — **limite exacte à confirmer avec échantillon MVola**
- Troncature : si dépassement, tronquer prénom en préservant ` Paiement XXX` (3 lettres site en fin)
- Exemple tronqué : `Rak Paiement MNK` si « Rakoto Paiement MNK » trop long

#### Colonne C — Période

- V1 recommandé : semaine ISO `S01` à `S53` (RG-10)
- V2 option : jour `D001` à `D366` si clôture quotidienne
- Source : période du bordereau généré

#### Colonne D — Montant

- Devise : Ariary malgache (MGA)
- Format : entier positif, pas de séparateur milliers dans cellule
- Source : somme agrégée pointages VALIDATED par MOC (RG-01)
- Arrondi : entier (pas de décimales)

#### Colonne E — Bio Validée

| Valeur | Condition | Export bulk MVola |
|--------|-----------|-------------------|
| `OUI` | BiometricCheck **OK** pour la période | **Incluse** — seule valeur autorisée en export |
| `NON` | Bio KO, DOUBT ou absente | **Exclue** — ligne absente du fichier export (RG-03) |
| `N/A` | Statut interne uniquement (mode dégradé Admin) | **Exclue** — jamais incluse en export bulk |

> **RG-03 (strict) :** seules les lignes avec `Bio Validée = OUI` (BiometricCheck OK) entrent dans le bordereau exportable et le fichier MVola bulk. **DOUBT**, **KO**, **absence de bio** et **N/A** bloquent validation paiement et export — aucun chemin d'export dégradé.

#### Mode dégradé (hors export bulk)

Lorsque AXIAN est indisponible (BIO-503) ou cas exceptionnel validé métier :

1. **Admin** déclenche une validation manuelle par ligne (override), jamais le CDS en bulk.
2. **Audit trail obligatoire** : who / when / motif / provider UNAVAILABLE.
3. La ligne reste **hors export MVola bulk** ; paiement traité manuellement (virement unitaire, correction hors fichier, ou report semaine suivante après bio OK).
4. Le statut interne peut être marqué `N/A` pour traçabilité, mais cette valeur **n'apparaît jamais** dans un fichier `.xlsx` Bulk Transfer.

### 3.4 Exemple contenu (lignes 2+)

| Numéro téléphone | Description | Période | Montant | Bio Validée |
|------------------|-------------|---------|---------|-------------|
| 0341234567 | Rakoto Paiement MNK | S18 | 125000 | OUI |
| 0349876543 | Rasoa Paiement MNK | S18 | 98500 | OUI |

> Les lignes DOUBT, KO, absentes ou en mode dégradé (`N/A` interne) sont **listées dans l'UI Admin** pour suivi mais **exclues** du fichier exporté.

---

## 4. Format import retour MVola → ALTERRA

**Statut :** Hypothèse — structure exacte **à valider avec échantillon ALTERRA**

### 4.1 Comportement attendu (UC-27)

| Étape | Description |
|-------|-------------|
| 1 | Admin upload fichier `.xlsx` retour portail MVola |
| 2 | Parse colonnes identifiées |
| 3 | Match ligne ALTERRA par **numéro MVola + montant** |
| 4 | Update Payment → `PAID` ou `FAILED` |
| 5 | Rapport : compteurs PAID/FAILED/non matchés |

### 4.2 Colonnes retour supposées (à confirmer)

| Colonne supposée | Usage matching |
|------------------|----------------|
| Numéro téléphone / MSISDN | Clé primaire match |
| Montant | Clé secondaire match (évite homonymes) |
| Statut transaction | SUCCESS → PAID · FAILED/REJECTED → FAILED |
| Motif échec | Stocké pour affichage Admin (RG-19) |
| Référence MVola | Traçabilité optionnelle |

### 4.3 Règles import

| Règle | Description |
|-------|-------------|
| Fichier non conforme | Erreur IMPORT-BADFORMAT avec détail ligne/colonne |
| Ligne non matchée | Listée séparément ; statut inchangé |
| Doublon match | Alerte Admin ; pas d'écrasement silencieux |
| Idempotence | Ré-import même fichier → pas de double update |

---

## 5. Mapping données ALTERRA → export

```
Payment (PENDING)
  └── Worker.mvolaNumber     → Col A
  └── Worker.firstName       → Col B (partie prénom)
  └── Site.shortCode         → Col B (partie code)
  └── Payment.periodIso      → Col C
  └── Payment.amount         → Col D
  └── BiometricCheck.result  → Col E (`OUI` si OK uniquement ; lignes DOUBT/KO/absentes/N/A exclues de l'export)
```

### Statuts Payment (workflow)

```
PENDING → (export) → EXPORTED → (import retour) → PAID | FAILED
```

---

## 6. Validations pré-export (Admin UI)

| Check | Comportement |
|-------|--------------|
| MVola manquant | Bloquer ligne ou exclure avec warning |
| Montant = 0 | Exclure automatiquement |
| Bio DOUBT / KO / absente | **Bloquer** validation et export ; message « N lignes sans bio OK — bio requise avant paiement » |
| Mode dégradé Admin | Override manuel ligne par ligne avec audit ; **jamais** inclus dans export bulk MVola ; paiement hors fichier |
| Période déjà EXPORTED | Dialog correctif (PAY-CONFLICT) |

---

## 7. Performance

| Critère | Cible |
|---------|-------|
| Génération 600 lignes | < 30 secondes (critère acceptation global §10.1) |
| Librairie | exceljs (backend) |
| Taille fichier estimée | < 500 Ko |

---

## 8. Risques et mitigations

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| Format MVola non documenté officiellement | Moyen | Échantillon Sprint 1 ; couche export configurable (mapping colonnes en config) |
| Limite description inconnue | Moyen | RG-09 troncature ; paramètre `MVOLA_DESC_MAX_LEN` configurable |
| Retour MVola format variable | Moyen | Parser configurable ; tests avec échantillon réel |
| `modele.xlsx` incorrect | Faible | Documenté ici ; demande explicité à ALTERRA |

**Provision marge :** 1 j-h prévu dans `UC-MARGE-V1` si écart format.

---

## 9. Checklist validation ALTERRA

- [ ] Fournir 1 fichier export Bulk Transfer réel (anonymisé si besoin)
- [ ] Fournir 1 fichier retour correspondant
- [ ] Confirmer headers exacts (casse, accents, ordre colonnes)
- [ ] Confirmer limite caractères Description
- [ ] Confirmer format numéro (034 obligatoire ?)
- [ ] Confirmer codes site 3 lettres utilisés historiquement
- [ ] Confirmer si colonne Bio requise par MVola ou interne ALTERRA uniquement

---

## 10. Références

- `basedocs/ALTERRA - Spécification fonctionnelle détaillée.md` §7.4
- `basedocs/ALTERRA - Specs fonctionnelles et techniques.md` §8.2
- `basedocs/ALTERRA - Brief Chef de Projet.md` (condition échantillon S1)
- `basedocs/modele.xlsx` — **backlog projet, pas template MVola**

---

*Échantillon MVola : **EN ATTENTE VALIDATION ALTERRA***
