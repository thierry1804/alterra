import { prisma } from "../../lib/prisma.js";

export const PARCELLE_REQUIRED_MESSAGE =
  "Choisissez la zone et la parcelle (ou la pépinière) avant de valider l'activité";

export function createParcelleChecker() {
  const parcelleSites = new Map<string, string | null>();
  const siteHasParcelles = new Map<string, boolean>();

  async function parcelleSite(parcelleId: string): Promise<string | null> {
    if (!parcelleSites.has(parcelleId)) {
      const parcelle = await prisma.parcelle.findUnique({
        where: { id: parcelleId },
        select: { zone: { select: { siteId: true } } },
      });
      parcelleSites.set(parcelleId, parcelle?.zone.siteId ?? null);
    }
    return parcelleSites.get(parcelleId) ?? null;
  }

  async function hasParcelles(siteId: string): Promise<boolean> {
    if (!siteHasParcelles.has(siteId)) {
      const count = await prisma.parcelle.count({ where: { zone: { siteId } } });
      siteHasParcelles.set(siteId, count > 0);
    }
    return siteHasParcelles.get(siteId) ?? false;
  }

  return {
    async check(
      parcelleId: string | null | undefined,
      workerSiteId: string,
    ): Promise<string | null> {
      if (!parcelleId) {
        return (await hasParcelles(workerSiteId)) ? PARCELLE_REQUIRED_MESSAGE : null;
      }
      const siteId = await parcelleSite(parcelleId);
      if (!siteId) return "Parcelle introuvable";
      if (siteId !== workerSiteId) return "Cette parcelle n'appartient pas au site du travailleur";
      return null;
    },
  };
}
