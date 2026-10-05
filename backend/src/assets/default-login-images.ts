import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Images par défaut de l'écran de connexion (fond + coins), utilisées tant qu'aucune n'est
 * personnalisée depuis l'Admin. Lues depuis le disque (pas de base64 embarqué : ce sont de vraies
 * photos, pas une petite icône) — le dossier doit donc être copié à côté du JS compilé en prod.
 */
const loginAssetsDir = join(dirname(fileURLToPath(import.meta.url)), "login");

export const DEFAULT_LOGIN_IMAGES = {
  loginBackground: { file: "agroecology-scaled1.jpg", contentType: "image/jpeg" },
  loginBranch: { file: "branch-1.png", contentType: "image/png" },
  loginLeaf: { file: "leaf.png", contentType: "image/png" },
} as const;

export type LoginImageSlot = keyof typeof DEFAULT_LOGIN_IMAGES;

export function readDefaultLoginImage(slot: LoginImageSlot): Buffer {
  return readFileSync(join(loginAssetsDir, DEFAULT_LOGIN_IMAGES[slot].file));
}
