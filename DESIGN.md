# ALTERRA — Design System

## Theme

Light institutionnel. Structure zinc neutre + **encre de marque ALTERRA** (slate-navy) portée avec sobriété, accents sémantiques (emerald succès, red erreur, amber alerte). Pas de gradients décoratifs.

Identité : dérivée du **logo ALTERRA** (vert reforestation, arbre corail, points bleus = communauté). L'app se lit comme un registre de terrain — vert de marque en encre principale, données de registre en chiffres monospace tabulaires, filet corail en signature, avatars « communauté » bleus pour les travailleurs. Logo : `pwa/public/brand/alterra-logo.png`.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#ffffff` | Page background |
| `--color-surface` | `#fafafa` (zinc-50) | Sidebar, nav, panels |
| `--color-foreground` | `#18181b` (zinc-900) | Primary text |
| `--color-muted` | `#52525b` (zinc-600) | Secondary text |
| `--color-border` | `#e4e4e7` (zinc-200) | Borders |
| `--color-primary` | `#18181b` (zinc-900) | Primary actions |
| `--color-focus-ring` | `#a1a1aa` (zinc-400) | Focus indicators |

Semantic: emerald (OK/bio/en ligne), red (KO/erreur/hors ligne), amber (alerte/en attente).

### Marque ALTERRA (dérivée du logo)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand` | `#0e6f48` | Vert de marque (foncé, AA) : boutons primaires, onglet actif, montants Ariary |
| `--color-brand-hover` | `#0a5638` | Hover bouton primaire |
| `--color-brand-vivid` | `#189060` | Vert vif du logo — décoratif (icônes, `theme_color`, aplats sans texte) |
| `--color-brand-tint` | `#e7f3ec` | Fond sélection |
| `--color-brand-ring` | `#7cb79b` | Focus ring de marque |
| `--color-earth` | `#e45430` | Corail (l'arbre du logo) — filet 2px sous le bandeau. **Usage hairline uniquement.** |
| `--color-people-bg` / `-fg` | `#e7eff9` / `#2f6199` | Bleu « communauté » (les points du logo = personnes) : avatars travailleurs |
| `--font-mono` | `ui-monospace, …` | Données de registre : matricules, quantités, montants |

Le vert de marque (`#0e6f48`) est volontairement plus foncé que le vert vif du logo pour garantir le contraste AA sur texte/boutons ; le vert vif reste réservé au décor. Corail : accent arbre/reforestation, jamais en aplat ni en fond.

Utilitaires PWA : `.alterra-eyebrow` (micro-libellé de section), `.alterra-num` (chiffres monospace tabulaires), `.alterra-rule` (filet latérite du bandeau).

## Typography

- **Family**: `ui-sans-serif, system-ui, sans-serif` pour la prose ; `--font-mono` (`.alterra-num`) pour les données de registre (matricules, quantités, montants Ariary) en `tabular-nums`
- **Scale** (fixed rem, product register):
  - Body: `text-sm` (14px)
  - Labels: `text-sm font-medium`
  - Page titles PWA: `text-lg font-semibold`
  - Page titles admin: `text-xl font-semibold`
  - KPI values: `text-2xl font-semibold`
- **Line length**: prose ≤ 75ch ; tables denser OK

## Components

### Button
- Variants: `default` (zinc-900 fill), `outline`, `ghost`, `destructive`
- PWA min height: `min-h-11` (44px touch target)
- Admin: shadcn Button (`h-8` sm, `h-9` default)

### Badge
- Semantic variants: success, warning, danger, default
- Status pointage, bio, demandes

### Card
- Simple border `border-zinc-200`, radius `rounded-lg`, no heavy shadow
- KPI highlight: `border-amber-300` when alert threshold

### Navigation
- Admin: sidebar 248px, grouped sections, collapse to icons
- PWA : **mobile-first, barre d'onglets en bas** (thumb zone). 4 destinations primaires par rôle + onglet « Plus » ; icônes + libellés, `min-h-touch`, `env(safe-area-inset-bottom)`.
  - Destinations secondaires + identité utilisateur + **Déconnexion** dans une **bottom-sheet** (« Plus »), jamais dans le bandeau.
  - Config par rôle : [`nav-config.ts`](pwa/src/components/nav/nav-config.ts) ; composants [`BottomNav`](pwa/src/components/nav/BottomNav.tsx) / [`MoreSheet`](pwa/src/components/nav/MoreSheet.tsx) ; icônes SVG inline [`icons.tsx`](pwa/src/components/icons.tsx) (aucune dépendance).

## Layout

- Admin: sidebar + header 48px + main padding 24px
- PWA : header collant (logo + identité + barre sync) + main défilant + barre d'onglets fixe en bas. `--bottom-nav-h` réserve l'espace ; les barres d'action d'écran (ex. « Enregistrer le lot ») se posent au-dessus de la barre d'onglets.
- Safe area: `env(safe-area-inset-bottom)` sur la barre d'onglets et les bottom-sheets

## Exceptions

**BiometricCapture** — full-screen dark mode (`bg-zinc-950`) intentional for camera focus. Not a design inconsistency; documented capture context.

## Motion

150–200ms transitions on hover/focus only. No page-load choreography. Spinner on async only.

## Shared Tokens

CSS variables defined in [`design/tokens.css`](design/tokens.css), imported by both apps.
