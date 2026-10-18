/** Saisie terrain en fr-MG : la virgule est le séparateur décimal usuel — on la normalise en point. */
export function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}
