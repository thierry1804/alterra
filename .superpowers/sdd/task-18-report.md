# Task 18 Report — Module FE-PWA-SYNC : Moteur de synchronisation

**Date :** 21 juillet 2026  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Queue idempotente clientUuid, ping 60s, batch ≤100 | ✅ |
| 2 | Retry backoff exponentiel, serveur autoritaire (ConflictResolver) | ✅ |
| 3 | Indicateur permanent SyncStatusBar | ✅ |
| 4 | Forcer sync + journal récent (page Sync) | ✅ |
| 5 | build PWA | ✅ PASS |

---

## Fichiers

| Fichier | Rôle |
| ------- | ---- |
| `sync/SyncManager.ts` | Orchestration, état, log persisté, forceSync |
| `sync/ConflictResolver.ts` | Application résultats serveur, recovery |
| `sync/sync-types.ts` | Types partagés |
| `components/sync/SyncStatusBar.tsx` | Barre statut globale |
| `hooks/useSyncState.ts` | Abonnement React à l'état sync |
| `pages/Sync.tsx` | Détail, rejetés, journal |

## Comportement

- Sync auto toutes les **60 s** + événement `online`
- Backoff **1s → 5 min**, suspension auto après 6 échecs
- **RG-15** : created/already_exists → local supprimé ; rejected → conservé avec motif
- Queue Dexie `syncQueue` en miroir des pointages locaux
