import type { AuthUser } from "./auth-store";
import { canAccess, type Access } from "./permissions";
import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  CreditCard,
  FileStack,
  FileText,
  IdCard,
  Inbox,
  Layers,
  LayoutDashboard,
  Map,
  MapPinned,
  Ruler,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  access: Access;
  section?: string;
  /** Compteur affiché dans le menu (ce qui attend un geste). */
  badge?: "requests" | "pointages" | "payments";
}

export const NAV_SECTIONS = ["Pilotage", "Opérations", "Référentiels", "Administration"] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    path: "/",
    icon: LayoutDashboard,
    access: { all: ["tableau_bord:lecture"] },
    section: "Pilotage",
  },
  {
    label: "Demandes",
    path: "/requests",
    icon: Inbox,
    access: { all: ["demande:decider"] },
    section: "Opérations",
    badge: "requests",
  },
  {
    label: "Pointages",
    path: "/pointages",
    icon: ClipboardList,
    access: { any: ["pointage:valider_site", "pointage:correction"] },
    section: "Opérations",
    badge: "pointages",
  },
  {
    label: "Validation technique",
    path: "/validation-technique",
    icon: ClipboardCheck,
    access: { all: ["pointage:valider_technique"] },
    section: "Opérations",
  },
  {
    label: "Badges NFC",
    path: "/badges",
    icon: IdCard,
    access: { all: ["badge:ecriture"] },
    section: "Opérations",
  },
  {
    label: "Bordereaux",
    path: "/bordereaux",
    icon: FileCheck,
    access: { all: ["bordereau:lecture"] },
    section: "Opérations",
  },
  {
    label: "Paiements",
    path: "/payments",
    icon: CreditCard,
    access: { all: ["paiement:lecture"] },
    section: "Opérations",
    badge: "payments",
  },
  {
    label: "Factures",
    path: "/invoices",
    icon: FileStack,
    access: { all: ["facture:lecture"] },
    section: "Opérations",
  },
  {
    label: "Rapports",
    path: "/reports",
    icon: FileText,
    access: { all: ["rapport:analyse"] },
    section: "Opérations",
  },
  {
    label: "Travailleurs",
    path: "/workers",
    icon: UsersRound,
    access: { all: ["travailleur:ecriture"] },
    section: "Référentiels",
  },
  {
    label: "Sites",
    path: "/sites",
    icon: Map,
    access: { all: ["site:ecriture"] },
    section: "Référentiels",
  },
  {
    label: "Zones",
    path: "/zones",
    icon: MapPinned,
    access: { all: ["zone:ecriture"] },
    section: "Référentiels",
  },
  {
    label: "Carte",
    path: "/map",
    icon: Layers,
    access: { all: ["carte:lecture"] },
    section: "Référentiels",
  },
  {
    label: "Activités",
    path: "/activities",
    icon: Activity,
    access: { all: ["activite:ecriture"] },
    section: "Référentiels",
  },
  {
    label: "Unités",
    path: "/units",
    icon: Ruler,
    access: { all: ["activite:ecriture"] },
    section: "Référentiels",
  },
  {
    label: "Utilisateurs",
    path: "/users",
    icon: Users,
    access: { all: ["utilisateur:lecture"] },
    section: "Administration",
  },
  {
    label: "Audit",
    path: "/audit",
    icon: ScrollText,
    access: { all: ["audit:lecture"] },
    section: "Administration",
  },
  {
    label: "Rôles et groupes",
    path: "/access",
    icon: ShieldCheck,
    access: { all: ["role:gerer"] },
    section: "Administration",
  },
  {
    label: "Paramètres",
    path: "/settings",
    icon: Settings,
    access: { all: ["parametres:ecriture"] },
    section: "Administration",
  },
];

/** Fil d'Ariane : section puis page, d'après le chemin courant. */
export function navTrail(pathname: string): { section: string; label: string } | null {
  const item = NAV_ITEMS.find((candidate) =>
    candidate.path === "/" ? pathname === "/" : pathname.startsWith(candidate.path),
  );
  return item ? { section: item.section ?? "Navigation", label: item.label } : null;
}

export function navItemsForUser(user: AuthUser | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccess(user, item.access));
}

export function accessForPath(path: string): Access | undefined {
  return NAV_ITEMS.find((item) => item.path === path)?.access;
}

export function navItemsBySection(
  user: AuthUser | null | undefined,
): globalThis.Map<string, NavItem[]> {
  const grouped = new globalThis.Map<string, NavItem[]>();

  navItemsForUser(user).forEach((item) => {
    const section = item.section ?? "Navigation";
    const current = grouped.get(section) ?? [];
    current.push(item);
    grouped.set(section, current);
  });

  return grouped;
}
