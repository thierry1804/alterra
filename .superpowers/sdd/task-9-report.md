# Task 9 Report — Module FE-ADMIN-0 : Setup Admin

**Date :** 21 juillet 2026  
**Branche :** `feat/backlog-implementation`  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Vite + React + Tailwind + shadcn/ui (Button, Input, Table, Dialog, Toast) | ✅ |
| 2 | Router + guards vues par rôle (`RoleGuard`, `GuestRoute`) | ✅ |
| 3 | Layout sidebar rétractable 248px + header | ✅ |
| 4 | Login MFA + intercepteur axios refresh token | ✅ |
| 5 | `npm run lint -w admin && npm run build -w admin` | ✅ PASS |

---

## Composants UI (shadcn-style)

| Composant | Fichier |
| --------- | ------- |
| Button | `components/ui/button.tsx` |
| Input | `components/ui/input.tsx` |
| Table | `components/ui/table.tsx` |
| Dialog | `components/ui/dialog.tsx` |
| Toast / Toaster | `hooks/use-toast.ts`, `components/ui/toaster.tsx` |

Dépendances ajoutées : `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-toast`, `lucide-react`.

---

## Layout & navigation

| Fichier | Rôle |
| ------- | ---- |
| `AppLayout.tsx` | Shell principal (sidebar + header + outlet) |
| `Sidebar.tsx` | Navigation filtrée par rôle, repli 248px → 56px |
| `RoleGuard.tsx` | Restriction routes par rôle |
| `ProtectedRoute.tsx` | Auth guard + `GuestRoute` pour `/login` |
| `navigation.ts` | Items nav ADMIN / CHEF_SERVICE |

---

## Routes

| Path | Rôles | Page |
| ---- | ----- | ---- |
| `/login` | invité | Login (+ MFA) |
| `/` | ADMIN, CHEF_SERVICE | Dashboard |
| `/pointages` | ADMIN, CHEF_SERVICE | Placeholder |
| `/sites`, `/activities`, `/workers`, `/users`, `/payments`, `/reports`, `/audit` | ADMIN | Placeholder |
| `/forbidden` | — | Accès refusé |

---

## Auth

- **Login** : formulaire shadcn, gestion `MFA_REQUIRED` / `INVALID_MFA_CODE`
- **Refresh interceptor** : file unique, skip `/auth/login|refresh|logout`, redirect `/login` si échec
- **Dashboard** : liste sites via TanStack Query + composant Table

---

## Vérification

```
npm run lint -w admin   → PASS
npm run build -w admin  → PASS (tsc + vite)
```
