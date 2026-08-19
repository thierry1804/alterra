# Guides utilisateur ALTERRA

Sources Markdown versionnées dans ce dossier. Les PDF sont générés pour diffusion terrain (impression, envoi email).

## Fichiers

| Rôle | Source | PDF |
|------|--------|-----|
| Administrateur | `guide-admin.md` | `guide-admin.pdf` |
| Chef de service | `guide-cds.md` | `guide-cds.pdf` |
| Chef d'équipe | `guide-cde.md` | `guide-cde.pdf` |
| Formation pilote | `formation-pilote.md` | — (facultatif) |

## Guides techniques

| Sujet | Source |
|-------|--------|
| Démarrage Docker (dev / stack complète / app complète) | `demarrage-docker.md` |

## Régénérer les PDF

```bash
npm run docs:guides
```

Prérequis : Node 22+, dépendance `@md-to-pdf/cli` (installée à la volée).

Les encarts `[Capture]` marquent les emplacements screenshots à compléter lors des prochaines sessions formation (remplacer par `![légende](assets/xxx.png)` dans le Markdown).
