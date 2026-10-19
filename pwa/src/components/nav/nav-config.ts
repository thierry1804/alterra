import type { ComponentType, SVGProps } from "react";
import {
  IconBell,
  IconActivites,
  IconCloture,
  IconEquipes,
  IconMyPointages,
  IconPresence,
  IconPrecisions,
  IconSaisie,
  IconSync,
  IconTravailleurs,
  IconValidation,
} from "../icons";

export interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Autres chemins qui activent aussi cet onglet (ex. étape 2 de la saisie). */
  alsoActiveOn?: string[];
}

export interface RoleNav {
  /** Destinations shown directly in the bottom bar. */
  primary: NavItem[];
  /** Destinations shown in the "Plus" sheet. */
  more: NavItem[];
}

const SYNC: NavItem = { to: "/sync", label: "Synchronisation", Icon: IconSync };
const NOTIFICATIONS: NavItem = { to: "/notifications", label: "Notifications", Icon: IconBell };

const CDE_NAV: RoleNav = {
  primary: [
    { to: "/", label: "Saisie", Icon: IconSaisie, alsoActiveOn: ["/batch"] },
    { to: "/nfc", label: "Présence", Icon: IconPresence },
    { to: "/my-pointages", label: "Pointages", Icon: IconMyPointages },
    { to: "/clarifications", label: "Messages", Icon: IconPrecisions },
  ],
  more: [{ to: "/teams", label: "Mon équipe", Icon: IconEquipes }, SYNC, NOTIFICATIONS],
};

const CDS_NAV: RoleNav = {
  primary: [
    { to: "/validation", label: "Validation", Icon: IconValidation },
    { to: "/daily-close", label: "Clôture", Icon: IconCloture },
    { to: "/clarifications", label: "Messages", Icon: IconPrecisions },
    { to: "/teams", label: "Équipes", Icon: IconEquipes },
  ],
  more: [
    { to: "/activity-requests", label: "Demandes d'activité", Icon: IconActivites },
    { to: "/worker-requests", label: "Demandes de travailleur", Icon: IconTravailleurs },
    SYNC,
    NOTIFICATIONS,
  ],
};

export function navForRole(role?: string): RoleNav {
  if (role === "CHEF_EQUIPE") return CDE_NAV;
  return CDS_NAV;
}

export function isActivePath(pathname: string, to: string, alsoActiveOn: string[] = []): boolean {
  if (alsoActiveOn.some((path) => isActivePath(pathname, path))) return true;
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}
