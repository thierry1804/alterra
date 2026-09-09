import type { AuthUser } from "./auth-store";
import {
  Activity,
  ClipboardList,
  CreditCard,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  Map,
  MapPinned,
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
}

export const NAV_SECTIONS = [
  "Vue d'ensemble",
  "Référentiels",
  "Opérations",
  "Finance",
  "Système",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    path: "/",
    icon: LayoutDashboard,
    roles: ["ADMIN", "CHEF_SERVICE"],
    section: "Vue d'ensemble",
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
    label: "Travailleurs",
    path: "/workers",
    icon: UsersRound,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Utilisateurs",
    path: "/users",
    icon: Users,
    roles: ["ADMIN"],
    section: "Référentiels",
  },
  {
    label: "Demandes",
    path: "/requests",
    icon: Inbox,
    roles: ["ADMIN"],
    section: "Opérations",
  },
  {
    label: "Pointages",
    path: "/pointages",
    icon: ClipboardList,
    roles: ["ADMIN", "CHEF_SERVICE"],
    section: "Opérations",
  },
  {
    label: "Paiements",
    path: "/payments",
    icon: CreditCard,
    roles: ["ADMIN"],
    section: "Finance",
  },
  {
    label: "Rapports",
    path: "/reports",
    icon: FileText,
    roles: ["ADMIN"],
    section: "Finance",
  },
  {
    label: "Audit",
    path: "/audit",
    icon: ScrollText,
    roles: ["ADMIN"],
    section: "Système",
  },
  {
    label: "Paramètres",
    path: "/settings",
    icon: Settings,
    roles: ["ADMIN"],
    section: "Système",
  },
];

export function navItemsForRole(role: AuthUser["role"] | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function navItemsBySection(role: AuthUser["role"] | undefined): globalThis.Map<string, NavItem[]> {
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
