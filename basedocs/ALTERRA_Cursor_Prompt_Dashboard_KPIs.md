# Cursor Prompt — Dashboard KPIs ALTERRA

## Contexte

Tu travailles sur le projet **ALTERRA**, une plateforme de gestion du personnel de chantier.

**Stack :**

- Backend : Node.js 20 + Express 4 + Prisma 5 + PostgreSQL 16 + Zod
- Frontend Admin : React 18 + Vite + TanStack Query v5 + Recharts 2 + shadcn/ui + TailwindCSS
- Auth : JWT (RBAC, rôles `ADMIN` / `CHEF_DE_SITE`)

**Modèle de données existant (extrait) :**

```prisma
model Worker {
  id          String     @id @default(cuid())
  firstName   String
  lastName    String
  cinNumber   String     @unique
  dailyRate   Decimal    @db.Decimal(10, 2)
  isActive    Boolean    @default(true)
  siteId      String
  site        Site       @relation(fields: [siteId], references: [id])
  pointages   Pointage[]
  payments    Payment[]
}

model Pointage {
  workerId  String
  siteId    String
  date      DateTime       @db.Date
  status    PointageStatus // PRESENT | ABSENT | DEMI_JOURNEE
}

model Payment {
  workerId   String
  weekStart  DateTime      @db.Date
  weekEnd    DateTime      @db.Date
  daysWorked Decimal
  amount     Decimal
  status     PaymentStatus // PENDING | VERIFIED | PAID | DISPUTE
  mvolaVerified Boolean?
}

model Site {
  id           String
  name         String
  isActive     Boolean
  chefDeSiteId String
  workers      Worker[]
}
```

---

## Tâche 1 — Migration Prisma : ajout du champ `gender` sur `Worker`

Ajoute un champ `gender` au modèle `Worker` :

```prisma
enum Gender {
  HOMME
  FEMME
  NON_SPECIFIE
}

model Worker {
  // ... champs existants
  gender Gender @default(NON_SPECIFIE)
}
```

Génère et applique la migration :

```bash
npx prisma migrate dev --name add_worker_gender
```

Met à jour le schéma Zod de validation côté backend pour inclure `gender` (optionnel à la création, valeur par défaut `NON_SPECIFIE`).

Met à jour le formulaire de création/édition de travailleur côté frontend Admin pour inclure un champ `gender` (select : Homme / Femme / Non spécifié).

---

## Tâche 2 — Backend : étendre `GET /api/v1/dashboard/kpis`

L'endpoint existant retourne des données basiques. Remplace-le par une version complète qui retourne **toutes les données nécessaires au dashboard** en une seule requête.

**Requête :** `GET /api/v1/dashboard/kpis?siteId=<optionnel>&weekStart=<YYYY-MM-DD>`

**Réponse attendue (TypeScript) :**

```typescript
type DashboardKpis = {
  // — Effectifs
  workforce: {
    totalActive: number; // Travailleurs actifs au total
    byGender: {
      homme: number;
      femme: number;
      nonSpecifie: number;
      parityRatio: number; // femme / (homme + femme) * 100, arrondi 1 décimale
    };
  };

  // — Présence (semaine sélectionnée)
  attendance: {
    globalRate: number; // % présents (PRESENT + 0.5*DEMI_JOURNEE) / total attendus
    presentCount: number;
    absentCount: number;
    halfDayCount: number;
    pendingSync: number; // Travailleurs actifs sans pointage saisi aujourd'hui
    bySite: Array<{
      siteId: string;
      siteName: string;
      presentRate: number;
      presentCount: number;
      totalWorkers: number;
    }>;
    worstSite: {
      // Site avec le taux de présence le plus bas
      siteId: string;
      siteName: string;
      presentRate: number;
    } | null;
  };

  // — Paiements
  payroll: {
    currentWeekAmount: number; // Masse salariale semaine sélectionnée
    currentMonthAmount: number; // Masse salariale mois en cours
    byStatus: {
      pending: number; // Montant total PENDING
      paid: number; // Montant total PAID
      dispute: number; // Montant total DISPUTE — alerte si > 0
    };
    disputeCount: number; // Nombre de paiements en litige
  };

  // — Sync (fiabilité terrain)
  sync: {
    pendingPointages: number; // Pointages non encore reçus (syncedAt IS NULL)
    lastSyncByChef: Array<{
      chefId: string;
      chefName: string;
      siteId: string;
      siteName: string;
      lastSyncAt: string | null; // ISO datetime, null si jamais synchronisé
    }>;
  };
};
```

**Implémentation :** utilise des requêtes Prisma agrégées (`groupBy`, `aggregate`, `count`) pour minimiser les aller-retours base de données. Toutes les agrégations doivent se faire en SQL via Prisma, pas en JavaScript.

---

## Tâche 3 — Backend : `GET /api/v1/dashboard/presence-chart`

Existant — complète ou crée si absent :

```
GET /api/v1/dashboard/presence-chart?siteId=<optionnel>&weeks=4
```

Retourne pour chaque semaine et chaque site :

```typescript
Array<{
  weekLabel: string; // ex: "S22", "S23"
  weekStart: string; // ISO date
  sites: Array<{
    siteId: string;
    siteName: string;
    presentRate: number; // %
  }>;
}>;
```

---

## Tâche 4 — Backend : `GET /api/v1/dashboard/payroll-chart`

```
GET /api/v1/dashboard/payroll-chart?months=3
```

Retourne :

```typescript
Array<{
  monthLabel: string; // ex: "Avr 2026"
  monthStart: string; // ISO date
  totalPaid: number;
  totalPending: number;
}>;
```

---

## Tâche 5 — Frontend Admin : page `/dashboard`

Crée ou remplace la page dashboard à `src/pages/DashboardPage.tsx`.

### Structure de la page

```
┌─────────────────────────────────────────────────────────────┐
│  Filtres : [Sélecteur de site ▼]  [Semaine ◀ ▶]             │
├───────────┬───────────┬───────────┬────────────┬────────────┤
│ Effectif  │ Présence  │ Masse sal.│ Litiges    │ Sync       │
│ total     │ globale   │ semaine   │ paiements  │ en attente │
│ actif     │  XX %     │  XX MGA   │  ⚠ N       │  N items   │
├───────────┴──────────┴──────────┴────────────┴────────────┤
│  Parité Homme / Femme        │  Présence par site (today)  │
│  [Donut chart]               │  [BarChart horizontal]      │
│  Homme XX% | Femme XX%       │  Site A ████ 87%            │
│                              │  Site B ███  74%  ⚠          │
├──────────────────────────────┴─────────────────────────────┤
│  Histogramme présence — 4 semaines glissantes               │
│  [BarChart groupé par site]                                 │
├─────────────────────────────────────────────────────────────┤
│  Courbe masse salariale — 3 derniers mois                   │
│  [LineChart avec area]                                      │
├─────────────────────────────────────────────────────────────┤
│  Dernière sync par Chef de Site                             │
│  [Table : Chef | Site | Dernière sync | Statut]             │
└─────────────────────────────────────────────────────────────┘
```

### Règles d'implémentation

**KPI Cards** : utilise le composant `Card` de shadcn/ui. La card "Litiges" affiche une bordure rouge et une icône d'alerte si `disputeCount > 0`. La card "Sync en attente" affiche une bordure orange si `pendingPointages > 5`.

**Donut chart parité** : utilise `PieChart` + `Pie` de Recharts. Couleurs : Homme `#3B82F6`, Femme `#EC4899`, Non spécifié `#9CA3AF`. Affiche le ratio H/F en texte centré dans le donut.

**Présence par site (aujourd'hui)** : `BarChart` horizontal (`layout="vertical"`). Barre rouge si `presentRate < 70%`, orange si `< 85%`, verte sinon.

**Histogramme 4 semaines** : `BarChart` groupé (une barre par site, une couleur par site). Source : `GET /dashboard/presence-chart`.

**Courbe masse salariale** : `AreaChart` avec deux séries `totalPaid` (vert) et `totalPending` (orange). Source : `GET /dashboard/payroll-chart`.

**Table sync** : utilise `TanStack Table`. Colonne "Dernière sync" affiche le temps relatif (ex : "il y a 2h") + badge rouge si > 24h sans sync.

**Data fetching** : toutes les requêtes passent par TanStack Query. `staleTime: 5 * 60 * 1000` (5 min). Bouton "Rafraîchir" qui appelle `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`.

**Skeleton loading** : pendant le chargement, affiche des `Skeleton` shadcn/ui à la place de chaque section.

---

## Tâche 6 — Tests

Ajoute des tests Vitest pour :

- `GET /api/v1/dashboard/kpis` : vérifie que `parityRatio` est correct avec des fixtures (3 hommes, 1 femme → 25.0), et que `disputeCount` remonte bien
- `GET /api/v1/dashboard/presence-chart` : vérifie le format de retour sur 2 semaines de données
- Composant `DashboardPage` (React Testing Library) : vérifie que la card "Litiges" a la classe de bordure rouge quand `disputeCount > 0`

---

## Contraintes transversales

- Tous les montants sont en **MGA (Ariary malgache)** — utilise `Intl.NumberFormat('fr-MG', { style: 'currency', currency: 'MGA' })` pour l'affichage
- Les endpoints dashboard sont **ADMIN only** — middleware `requireRole(['ADMIN'])` obligatoire
- Le filtre `siteId` est optionnel : si absent, les KPIs agrègent **tous les sites**
- N'utilise pas `localStorage` — tout l'état de filtre est dans l'URL via `useSearchParams`
- Les graphiques doivent être **responsives** (`<ResponsiveContainer width="100%" height={300}>`)
