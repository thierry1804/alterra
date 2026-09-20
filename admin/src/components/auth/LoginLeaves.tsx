import type { CSSProperties } from "react";

const LEAF = "M0 0C16-24 56-30 96 0C56 30 16 24 0 0Z";
const RIB = "M6 0H82";

const FILL = {
  vivid: "var(--color-brand-vivid)",
  brand: "var(--color-brand)",
  ring: "var(--color-brand-ring)",
} as const;

// Feuilles réparties le long d'une tige courbe (repère 400 × 400, coin bas-gauche vers coin haut-droit).
const LEAVES: { x: number; y: number; r: number; s: number; tone: keyof typeof FILL }[] = [
  { x: 31, y: 352, r: -3, s: 1.05, tone: "vivid" },
  { x: 97, y: 259, r: -104, s: 0.97, tone: "brand" },
  { x: 97, y: 259, r: 6, s: 0.6, tone: "ring" },
  { x: 168, y: 183, r: 12, s: 0.88, tone: "ring" },
  { x: 257, y: 123, r: -87, s: 0.8, tone: "vivid" },
  { x: 257, y: 123, r: 23, s: 0.5, tone: "ring" },
  { x: 318, y: 74, r: 10, s: 0.72, tone: "brand" },
  { x: 375, y: 21, r: -95, s: 0.63, tone: "ring" },
  { x: 375, y: 21, r: 15, s: 0.39, tone: "ring" },
  { x: 410, y: -10, r: -41, s: 0.5, tone: "brand" },
];

function Branch({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 400 400" className="absolute" style={style} focusable="false">
      <path
        d="M-10 410C70 300 120 205 215 150C300 100 340 50 410 -10"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />
      {LEAVES.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.s})`} opacity="0.9">
          <path d={LEAF} fill={FILL[leaf.tone]} />
          <path d={RIB} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        </g>
      ))}
    </svg>
  );
}

/** Feuilles vectorielles décoratives dans deux coins de l'écran de connexion (derrière les cartes). */
export default function LoginLeaves() {
  const size = "clamp(200px, 32vw, 420px)";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Branch style={{ width: size, height: size, left: "-1.5rem", top: "-1.5rem" }} />
      <Branch style={{ width: size, height: size, right: "-1.5rem", bottom: "-1.5rem", transform: "rotate(180deg)" }} />
    </div>
  );
}
