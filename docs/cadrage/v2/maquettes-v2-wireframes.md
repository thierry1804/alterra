# Wireframes V2 — NFC, workflows, cartographie

**Statut Figma :** `NOT_CREATED` (wireframes textuels designer-ready)  
**UC :** `UC-CAD-V2`, `UC-FE-PWA-NFC-*`, `UC-BE-WF`, `UC-FE-ADM-GEO`, `UC-FE-ADM-MAP`

---

## 1. Scan NFC présence (CDE)

**Route cible :** `/nfc`  
**API :** `POST /presence/sync` (Task 31)

```
┌─────────────────────────────────────┐
│ Présence · Matin          [Sync 0]  │
├─────────────────────────────────────┤
│                                     │
│         ┌───────────────┐           │
│         │  Approchez    │           │
│         │  le badge NFC │           │
│         │  (animation)  │           │
│         └───────────────┘           │
│                                     │
│ Dernier scan : Rakoto · 07:12       │
│ Parcelle : Bloc A-12 (auto GPS?)    │
├─────────────────────────────────────┤
│ [Mode manuel — dégradé]             │
└─────────────────────────────────────┘
```

| État | UI |
|------|-----|
| Lecture | Pulse anneau + instruction |
| OK | Flash vert + bip + nom MOC 2s |
| Badge inconnu | Rouge « Badge non enregistré » + log |
| NFC indisponible | Lien mode manuel (MANUAL source) |

---

## 2. Gestion équipes CDS (Task 29)

**Route :** `/teams`

```
┌─────────────────────────────────────┐
│ Équipes · Site MNK        [+ Nouveau]│
├─────────────────────────────────────┤
│ MNK-1 · Chef: Jean        [Modifier] │
│   12 MOC · Chef: cde.mnk1@…         │
│ MNK-2 · Chef: —           [Modifier] │
│   8 MOC                             │
└─────────────────────────────────────┘
```

Formulaire : nom équipe, chef (autocomplete users CDE), membres (multi-select MOC).

---

## 3. Demandes workflow (CDE/CDS)

**Routes :** `/requests/new-activity`, `/requests/new-worker`, `/clarifications`

### Demande activité

| Champ | Type |
|-------|------|
| Libellé proposé | text |
| Unité | select |
| Tarif proposé | number Ar |
| Justification | textarea |

Statuts : `PENDING` → `APPROVED` / `REJECTED` (Admin).

### File Admin (Task 35)

Onglets : Activités | MOC | Clarifications · tri ancienneté · drawer détail.

---

## 4. Zones / Parcelles Admin (Task 28)

**Route :** `/zones`

```
┌──────────┬──────────────────────────────────────────┐
│ SIDEBAR  │ Zones & parcelles · Site [MNK ▼]         │
│          ├──────────────────────────────────────────┤
│          │ ▼ Zone Nord (45 ha)           [+ Parcelle] │
│          │    · Parcelle A-01  12.5 ha   [Edit]     │
│          │    · Parcelle A-02   8.0 ha   [Edit]     │
│          │ ▶ Zone Sud (32 ha)                       │
│          │ [+ Nouvelle zone]                          │
└──────────┴──────────────────────────────────────────┘
```

Éditeur polygone : textarea GeoJSON + lien « Voir sur carte » (Task 36).

Exemple GeoJSON :

```json
{
  "type": "Polygon",
  "coordinates": [[[47.52, -18.91], [47.53, -18.91], [47.53, -18.90], [47.52, -18.90], [47.52, -18.91]]]
}
```

---

## 5. Cartographie Admin (Task 36)

**Route :** `/map`

- Tuiles OSM / MapTiler
- Marqueurs sites (geoLat/geoLng)
- Couches toggle : Zones (polygones bleu), Parcelles (vert)
- Popup : nom, surface, lien fiche zone

---

## 6. Bio offline (Task 32)

- Sync templates chiffrés PIN
- Lazy load face-api TinyFace
- Seuil match 0.6 · sync résultat `POST /biometric/check-offline`

---

## Frames Figma attendus (post-atelier)

| Frame | Variantes |
|-------|-----------|
| `PWA/NFC-scan` | idle, success, unknown badge, no NFC |
| `PWA/Teams-CDS` | list, edit |
| `PWA/Request-activity` | form, submitted |
| `Admin/Zones` | hierarchy, geo editor |
| `Admin/Map` | layers on/off |

---

*Task 27 Step 2 — compléter liens Figma après atelier*
