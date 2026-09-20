/**
 * Réinitialise les mots de passe de TOUS les comptes en base et révoque toutes les sessions.
 *   - admin@alterra.mg reçoit son propre mot de passe (RESET_ADMIN_PASSWORD, sinon généré, 20 caractères)
 *   - tous les autres comptes reçoivent un même mot de passe (RESET_USER_PASSWORD, sinon généré, 16 caractères)
 * Les mots de passe ne sont écrits nulle part dans le code : hachés (argon2id) en base, affichés une seule fois ici.
 * Le mot de passe admin est aussi écrit dans ~/.alterra-admin-credentials (chmod 600).
 *
 * Usage : npm run db:reset-passwords -w backend
 */
import { randomInt } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const ADMIN_EMAIL = "admin@alterra.mg";
// Sans caractères ambigus (0/O, 1/l/I) : ces mots de passe sont saisis à la main sur téléphone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const prisma = new PrismaClient();

function generate(length: number): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

function passwordFrom(envKey: string, length: number): string {
  const provided = process.env[envKey];
  if (!provided) return generate(length);
  if (provided.length < 12) throw new Error(`${envKey} doit faire au moins 12 caractères`);
  return provided;
}

async function main() {
  const adminPassword = passwordFrom("RESET_ADMIN_PASSWORD", 20);
  const userPassword = passwordFrom("RESET_USER_PASSWORD", 16);

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true },
  });
  if (!users.some((u) => u.email === ADMIN_EMAIL)) throw new Error(`Compte ${ADMIN_EMAIL} introuvable`);

  const expected = new Map<string, string>();
  for (const user of users) {
    const password = user.email === ADMIN_EMAIL ? adminPassword : userPassword;
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
    });
    expected.set(user.id, password);
  }

  // Relecture : chaque hachage stocké doit bien correspondre au mot de passe attendu.
  const stored = await prisma.user.findMany({
    where: { id: { in: users.map((u) => u.id) } },
    select: { id: true, passwordHash: true },
  });
  let verified = 0;
  for (const row of stored) {
    if (await argon2.verify(row.passwordHash, expected.get(row.id)!)) verified++;
  }
  if (verified !== users.length) throw new Error(`Vérification échouée : ${verified}/${users.length} hachages corrects`);

  const revoked = await prisma.refreshToken.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { action: "UPDATE", entityType: "User", after: { passwordsReset: users.length, sessionsRevoked: revoked.count } },
  });

  const file = join(homedir(), ".alterra-admin-credentials");
  writeFileSync(file, `${ADMIN_EMAIL}\n${adminPassword}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);

  console.log("%d comptes mis à jour et vérifiés — %d sessions révoquées", users.length, revoked.count);
  console.log("Admin (%s) : %s", ADMIN_EMAIL, adminPassword);
  console.log("Autres comptes (%d) : %s", users.length - 1, userPassword);
  console.log("Le mot de passe admin est aussi dans %s (chmod 600).", file);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
