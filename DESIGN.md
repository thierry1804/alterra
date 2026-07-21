# ALTERRA — Design System

## Theme

Light institutionnel. Palette zinc neutre, accents sémantiques (emerald succès, red erreur, amber alerte). Pas de gradients décoratifs.

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

## Typography

- **Family**: `ui-sans-serif, system-ui, sans-serif` — une seule famille
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
- PWA: horizontal scroll nav, `min-h-11` tabs

## Layout

- Admin: sidebar + header 48px + main padding 24px
- PWA: header + nav + sync bar + main (full height flex column)
- Safe area: `env(safe-area-inset-bottom)` on PWA body

## Exceptions

**BiometricCapture** — full-screen dark mode (`bg-zinc-950`) intentional for camera focus. Not a design inconsistency; documented capture context.

## Motion

150–200ms transitions on hover/focus only. No page-load choreography. Spinner on async only.

## Shared Tokens

CSS variables defined in [`design/tokens.css`](design/tokens.css), imported by both apps.
