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
import { canAccess, type Access } from "../../lib/permissions";
import type { AuthUser } from "../../lib/session";

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

interface NavEntry extends NavItem {
  access: Access;
  primary: boolean;
}

const PRIMARY_SLOTS = 4;
const FIELD_ENTRY_SCOPES: Access["scopes"] = ["EQUIPE", "TOUS"];

export const ACCESS = {
  fieldEntry: { all: ["pointage:saisie"], scopes: FIELD_ENTRY_SCOPES },
  presence: { all: ["presence:saisie"], scopes: FIELD_ENTRY_SCOPES },
  myPointages: { all: ["pointage:lecture"], scopes: FIELD_ENTRY_SCOPES },
  validation: { all: ["pointage:valider_site"] },
  dailyClose: { all: ["rapport:generation"] },
  requests: { all: ["demande:creer"] },
  teams: { all: ["equipe:lecture"] },
  clarifications: { all: ["precision:lecture"] },
} satisfies Record<string, Access>;

const NAV_ENTRIES: NavEntry[] = [
  {
    to: "/validation",
    label: "Validation",
    Icon: IconValidation,
    access: ACCESS.validation,
    primary: true,
  },
  {
    to: "/daily-close",
    label: "Clôture",
    Icon: IconCloture,
    access: ACCESS.dailyClose,
    primary: true,
  },
  {
    to: "/",
    label: "Saisie",
    Icon: IconSaisie,
    alsoActiveOn: ["/batch"],
    access: ACCESS.fieldEntry,
    primary: true,
  },
  { to: "/nfc", label: "Présence", Icon: IconPresence, access: ACCESS.presence, primary: true },
  {
    to: "/my-pointages",
    label: "Pointages",
    Icon: IconMyPointages,
    access: ACCESS.myPointages,
    primary: true,
  },
  {
    to: "/clarifications",
    label: "Messages",
    Icon: IconPrecisions,
    access: ACCESS.clarifications,
    primary: true,
  },
  {
    to: "/teams",
    label: "Équipes",
    Icon: IconEquipes,
    access: { ...ACCESS.teams, scopes: ["SITE", "TOUS"] },
    primary: true,
  },
  {
    to: "/teams",
    label: "Mon équipe",
    Icon: IconEquipes,
    access: { ...ACCESS.teams, scopes: ["EQUIPE"] },
    primary: false,
  },
  {
    to: "/activity-requests",
    label: "Demandes d'activité",
    Icon: IconActivites,
    access: ACCESS.requests,
    primary: false,
  },
  {
    to: "/worker-requests",
    label: "Demandes de travailleur",
    Icon: IconTravailleurs,
    access: ACCESS.requests,
    primary: false,
  },
  { to: "/sync", label: "Synchronisation", Icon: IconSync, access: {}, primary: false },
  { to: "/notifications", label: "Notifications", Icon: IconBell, access: {}, primary: false },
];

function accessibleEntries(user: AuthUser | null | undefined): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => canAccess(user, entry.access));
}

function toItem({ to, label, Icon, alsoActiveOn }: NavEntry): NavItem {
  return { to, label, Icon, alsoActiveOn };
}

export function navForUser(user: AuthUser | null | undefined): RoleNav {
  const entries = accessibleEntries(user);
  const primary = entries.filter((entry) => entry.primary).slice(0, PRIMARY_SLOTS);
  const more = entries.filter((entry) => !primary.includes(entry));
  return { primary: primary.map(toItem), more: more.map(toItem) };
}

export function homePathFor(user: AuthUser | null | undefined): string {
  return accessibleEntries(user)[0]?.to ?? "/sync";
}

export function isActivePath(pathname: string, to: string, alsoActiveOn: string[] = []): boolean {
  if (alsoActiveOn.some((path) => isActivePath(pathname, path))) return true;
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}
