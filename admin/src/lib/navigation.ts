import type { AuthUser } from "./auth-store";
import {
  Activity,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Map,
  MapPinned,
  ScrollText,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: AuthUser["role"][];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    path: "/",
    icon: LayoutDashboard,
    roles: ["ADMIN", "CHEF_SERVICE"],
  },
  {
    label: "Sites",
    path: "/sites",
    icon: Map,
    roles: ["ADMIN"],
  },
  {
    label: "Zones",
    path: "/zones",
    icon: MapPinned,
    roles: ["ADMIN"],
  },
  {
    label: "Activités",
    path: "/activities",
    icon: Activity,
    roles: ["ADMIN"],
  },
  {
    label: "MOC",
    path: "/workers",
    icon: UsersRound,
    roles: ["ADMIN"],
  },
  {
    label: "Utilisateurs",
    path: "/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    label: "Pointages",
    path: "/pointages",
    icon: ClipboardList,
    roles: ["ADMIN", "CHEF_SERVICE"],
  },
  {
    label: "Paiements",
    path: "/payments",
    icon: CreditCard,
    roles: ["ADMIN"],
  },
  {
    label: "Rapports",
    path: "/reports",
    icon: FileText,
    roles: ["ADMIN"],
  },
  {
    label: "Audit",
    path: "/audit",
    icon: ScrollText,
    roles: ["ADMIN"],
  },
];

export function navItemsForRole(role: AuthUser["role"] | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
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
