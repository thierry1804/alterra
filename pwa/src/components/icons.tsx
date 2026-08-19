import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconActivite(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 9.5h17" />
      <path d="m9 14.5 2 2 3.5-3.5" />
    </Base>
  );
}

export function IconSaisie(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h5M8 12.5h8M8 16h4" />
    </Base>
  );
}

export function IconPresence(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.4 16c.5-1.5 1.7-2.2 3.1-2.2s2.6.7 3.1 2.2" />
      <path d="M14.5 10h4M14.5 13.2h4" />
    </Base>
  );
}

export function IconValidation(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.3L15.5 9.7" />
    </Base>
  );
}

export function IconCloture(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.2v2.6" />
    </Base>
  );
}

export function IconPrecisions(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9.5L5.5 19.5V15.5H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      <path d="M7.5 9h9M7.5 12h5.5" />
    </Base>
  );
}

export function IconEquipes(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M16 6.2a3 3 0 0 1 0 5.8" />
      <path d="M17.5 14.7c1.8.5 3.1 1.9 3.6 4.3" />
    </Base>
  );
}

export function IconActivites(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </Base>
  );
}

export function IconTravailleurs(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M4 19c.7-3.3 3-5.1 6-5.1.8 0 1.6.1 2.3.4" />
      <path d="M17.5 14.5v5M15 17h5" />
    </Base>
  );
}

export function IconSync(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2L20 9.2" />
      <path d="M20 4.2v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2L4 14.8" />
      <path d="M4 19.8v-5h5" />
    </Base>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </Base>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 6 6 6-6 6" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Base>
  );
}

export function IconBio(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="11" r="2.2" />
      <path d="M8.5 16.2c.6-1.5 1.9-2.3 3.5-2.3s2.9.8 3.5 2.3" />
    </Base>
  );
}

export function IconAdd(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12 20 4l-4 16-4.5-6.5L4.5 12Z" />
      <path d="m11.5 13.5 4.5-9.5" />
    </Base>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 8 6 12l4 4" />
      <path d="M6 12h9" />
    </Base>
  );
}
