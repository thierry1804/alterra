#!/usr/bin/env node
/**
 * Génère les PDF guides depuis les sources Markdown (Task 24 DOC).
 * Usage: npm run docs:guides
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guidesDir = path.join(root, "docs/guides");
const guides = ["guide-admin", "guide-cds", "guide-cde"];

for (const name of guides) {
  const input = path.join(guidesDir, `${name}.md`);
  console.log(`→ ${name}.pdf`);
  execFileSync("npx", ["--yes", "md-to-pdf", input], { cwd: guidesDir, stdio: "inherit" });
}

console.log("PDF guides générés dans docs/guides/");
