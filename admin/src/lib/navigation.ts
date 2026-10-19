import type { AuthUser } from "./auth-store";
import {
  Activity,
  ClipboardList,
  CreditCard,
  FileStack,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  Map,
  MapPinned,
  Ruler,
  ScrollText,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: AuthUser["role"][];
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
    roles: ["ADMIN", "CHEF_SERVICE"],
    section: "Pilotage",
  },
  {
    label: "Demandes",
    path: "/requests",
    icon: Inbox,
    roles: ["ADMIN"],
    section: "Opérations",
    badge: "requests",
  },
  {
    label: "Pointages",
    path: "/pointages",
    icon: ClipboardList,
    roles: ["ADMIN", "CHEF_SERVICE"],
    section: "Opérations",
    badge: "pointages",
  },
  {
    label: "Paiements",
    path: "/payments",
    icon: CreditCard,
    roles: ["ADMIN"],
    section: "Opérations",
    badge: "payments",
  },
  {
    label: "Factures",
    path: "/invoices",
    icon: FileStack,
    roles: ["ADMIN"],
    section: "Opérations",
  },
  {
    label: "Rapports",
    path: "/reports",
    icon: FileText,
    roles: ["ADMIN"],
    section: "Opérations",
  },
  {
    label: "Travailleurs",
    path: "/workers",
    icon: UsersRound,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Sites",
    path: "/sites",
    icon: Map,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Zones",
    path: "/zones",
    icon: MapPinned,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Carte",
    path: "/map",
    icon: Layers,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Activités",
    path: "/activities",
    icon: Activity,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Unités",
    path: "/units",
    icon: Ruler,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Utilisateurs",
    path: "/users",
    icon: Users,
    roles: ["ADMIN"],
    section: "Administration",
  },
  {
    label: "Audit",
    path: "/audit",
    icon: ScrollText,
    roles: ["ADMIN"],
    section: "Administration",
  },
  {
    label: "Paramètres",
    path: "/settings",
    icon: Settings,
    roles: ["ADMIN"],
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

export function navItemsForRole(role: AuthUser["role"] | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function navItemsBySection(
  role: AuthUser["role"] | undefined,
): globalThis.Map<string, NavItem[]> {
  const items = navItemsForRole(role);
  const grouped = new globalThis.Map<string, NavItem[]>();

  items.forEach((item) => {
    const section = item.section ?? "Navigation";
    const current = grouped.get(section) ?? [];
    current.push(item);
    grouped.set(section, current);
  });

  return grouped;
}

export function roleLabel(role: AuthUser["role"]): string {
  switch (role) {
    case "ADMIN":
      return "Administrateur";
    case "CHEF_SERVICE":
      return "Chef de service";
    case "CHEF_EQUIPE":
      return "Chef d'équipe";
    default:
      return role;
  }
}
