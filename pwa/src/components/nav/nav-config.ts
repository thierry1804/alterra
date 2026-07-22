import type { ComponentType, SVGProps } from "react";
import {
  IconActivite,
  IconActivites,
  IconCloture,
  IconEquipes,
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
}

export interface RoleNav {
  /** Destinations shown directly in the bottom bar. */
  primary: NavItem[];
  /** Destinations shown in the "Plus" sheet. */
  more: NavItem[];
}

const SYNC: NavItem = { to: "/sync", label: "Synchronisation", Icon: IconSync };

const CDE_NAV: RoleNav = {
  primary: [
    { to: "/", label: "Activité", Icon: IconActivite },
    { to: "/batch", label: "Saisie", Icon: IconSaisie },
    { to: "/nfc", label: "Présence", Icon: IconPresence },
    { to: "/teams", label: "Équipes", Icon: IconEquipes },
  ],
  more: [{ to: "/clarifications", label: "Précisions", Icon: IconPrecisions }, SYNC],
};

const CDS_NAV: RoleNav = {
  primary: [
    { to: "/validation", label: "Validation", Icon: IconValidation },
    { to: "/daily-close", label: "Clôture", Icon: IconCloture },
    { to: "/clarifications", label: "Précisions", Icon: IconPrecisions },
    { to: "/teams", label: "Équipes", Icon: IconEquipes },
  ],
  more: [
    { to: "/activity-requests", label: "Activités", Icon: IconActivites },
    { to: "/worker-requests", label: "Travailleurs", Icon: IconTravailleurs },
    SYNC,
  ],
};

export function navForRole(role?: string): RoleNav {
  if (role === "CHEF_EQUIPE") return CDE_NAV;
  return CDS_NAV;
}

export function isActivePath(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}
