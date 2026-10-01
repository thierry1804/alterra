/**
 * Remet la base de démonstration dans son état d'avant une séance de démo ou de répétition.
 * Supprime UNIQUEMENT ce que la démo a créé :
 *   - les objets préfixés « DEMO- » : sites, catégories et sous-activités, MOC (matricule DEMO-), utilisateurs (demo.*@) ;
 *   - depuis la date --since : les pointages saisis par cde.amb2, les paiements et contrôles biométriques des MOC-AMB-*,
 * Le journal d'audit est en ajout seul (déclencheur PostgreSQL) : ses lignes ne sont jamais supprimées. L'historique des
 * exports de l'écran Paiements, lu dans l'audit, conserve donc les exports de la démo.
 * Les données réelles antérieures à --since ne sont jamais touchées. Sans --do, affiche seulement ce qui serait supprimé.
 *
 * Usage : npm run db:cleanup-demo -w backend -- --since=2026-09-24          (aperçu)
 *         npm run db:cleanup-demo -w backend -- --since=2026-09-24 --do     (suppression, transaction unique)
 * Une sauvegarde JSON des identifiants supprimés est écrite dans le dossier courant.
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const doIt = process.argv.includes("--do");
const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.slice("--since=".length);
if (!sinceArg || Number.isNaN(Date.parse(sinceArg))) {
  console.error("Indiquez la date de début de la démo : --since=AAAA-MM-JJ");
  process.exit(1);
}
const since = new Date(sinceArg);

async function main() {
  const cde = await prisma.user.findFirst({ where: { email: "cde.amb2@alterra.test" }, select: { id: true } });
  const users = await prisma.user.findMany({ where: { email: { startsWith: "demo." } }, select: { id: true } });
  const workers = await prisma.worker.findMany({ where: { matricule: { startsWith: "DEMO-" } }, select: { id: true } });
  const workerIds = workers.map((w) => w.id);
  const pointages = await prisma.pointage.findMany({
    where: { OR: [...(cde ? [{ enteredById: cde.id, createdAt: { gte: since } }] : []), { workerId: { in: workerIds } }] },
    select: { id: true },
  });
  const payments = await prisma.payment.findMany({
    where: { OR: [{ createdAt: { gte: since }, worker: { matricule: { startsWith: "MOC-AMB-" } } }, { workerId: { in: workerIds } }] },
    select: { id: true },
  });
  const bios = await prisma.biometricCheck.findMany({
    where: { OR: [{ performedAt: { gte: since }, worker: { matricule: { startsWith: "MOC-AMB-" } } }, { workerId: { in: workerIds } }] },
    select: { id: true },
  });
  const categories = await prisma.activityCategory.findMany({ where: { label: { startsWith: "DEMO-" } }, select: { id: true } });
  const subActivities = await prisma.activitySubActivity.findMany({
    where: { OR: [{ categoryId: { in: categories.map((c) => c.id) } }, { label: { startsWith: "DEMO-" } }] },
    select: { id: true },
  });
  const sites = await prisma.site.findMany({ where: { name: { startsWith: "DEMO-" } }, select: { id: true } });

  console.log(doIt ? "SUPPRESSION" : "APERÇU (ajouter --do pour supprimer)", {
    depuis: since.toISOString(),
    utilisateurs: users.length,
    moc: workerIds.length,
    pointages: pointages.length,
    paiements: payments.length,
    controlesBio: bios.length,
    categories: categories.length,
    sousActivites: subActivities.length,
    sites: sites.length,
  });
  if (!doIt) return;

  const backup = `cleanup-demo-backup-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify({ users, workerIds, pointages, payments, bios, categories, subActivities, sites }, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), { mode: 0o600 });

  await prisma.$transaction(async (tx) => {
    const pointageIds = pointages.map((p) => p.id);
    await tx.clarificationRequest.deleteMany({ where: { pointageId: { in: pointageIds } } });
    await tx.pointage.deleteMany({ where: { id: { in: pointageIds } } });
    await tx.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });
    await tx.biometricCheck.deleteMany({ where: { id: { in: bios.map((b) => b.id) } } });
    await tx.badge.deleteMany({ where: { workerId: { in: workerIds } } });
    await tx.biometricTemplate.deleteMany({ where: { workerId: { in: workerIds } } });
    await tx.presenceRecord.deleteMany({ where: { workerId: { in: workerIds } } });
    await tx.worker.deleteMany({ where: { id: { in: workerIds } } });
    const userIds = users.map((u) => u.id);
    await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.passwordReset.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.activitySubActivity.deleteMany({ where: { id: { in: subActivities.map((s) => s.id) } } });
    await tx.activityCategory.deleteMany({ where: { id: { in: categories.map((c) => c.id) } } });
    await tx.team.deleteMany({ where: { siteId: { in: sites.map((s) => s.id) } } });
    await tx.site.deleteMany({ where: { id: { in: sites.map((s) => s.id) } } });
  });
  console.log(`Terminé. Sauvegarde des identifiants supprimés : ${backup}`);
}

main()
  .catch((e) => {
    console.error("ÉCHEC, transaction annulée :", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
