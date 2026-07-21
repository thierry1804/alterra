# ALTERRA — Product Context

## Register

product

## Platform

web — admin (Vite/React) + PWA terrain (Vite/React, offline-first)

## Purpose

Plateforme institutionnelle de suivi terrain pour programmes de travail communautaire à Madagascar : pointage journalier, validation hebdomadaire, contrôle biométrique, paiements Mvola, clôture et reporting.

## Target Users

| Rôle | Surface | Contexte |
|------|---------|----------|
| ADMIN | Admin web | Configuration référentiels, paiements, audit |
| CHEF_SERVICE | Admin + PWA | Validation, clôture, supervision équipes |
| CHEF_EQUIPE | PWA terrain | Saisie présence, lot, NFC, sync offline |

## Brand Personality

Institutionnel, sobre, rassurant. Programme public/ONG — pas startup SaaS. Confiance aux moments à enjeu (clôture journalière, rejet pointage, paiement bloqué bio).

## Anti-References

- Dashboards génériques shadcn/zinc sans identité ALTERRA
- Jargon technique visible (UUID, batch, clientUuid, idempotence)
- Eyebrows décoratifs, KPI cards vides, motion gratuite
- Ton startup ou marketing dans les outils internes

## Strategic Design Principles

1. **Français métier** — libellés compréhensibles par chefs d'équipe peu technophiles
2. **Terrain d'abord** — mobile, connexion intermittente, touch targets 44px minimum
3. **Confiance explicite** — feedback clair sur sync, validation, erreurs et actions irréversibles
4. **Cohérence admin/PWA** — même vocabulaire visuel, pas deux produits distincts
5. **Densité utile** — information métier visible, pas de décoration

## Accessibility

- Contraste WCAG AA minimum (4.5:1 texte body)
- Focus visible sur tous les contrôles interactifs
- Alt text descriptif sur images métier (bio, photos)
- Pas de `window.prompt` ni actions piégées clavier
