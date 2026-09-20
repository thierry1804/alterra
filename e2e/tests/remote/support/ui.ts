import { expect, type Locator, type Page } from "@playwright/test";

/** Attend la fin du chargement d'un tableau Admin (au moins une ligne autre que « Chargement… »). */
export async function waitTableReady(page: Page): Promise<void> {
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.locator("tbody").getByText("Chargement…")).toHaveCount(0);
}

/**
 * Trouve une ligne de tableau paginé côté client (boutons Précédent/Suivant).
 * Rejoue le balayage quelques fois : juste après une création, la liste est rechargée en arrière-plan.
 */
export async function findRow(page: Page, text: string | RegExp, maxPages = 40): Promise<Locator> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await waitTableReady(page);
    const previous = page.getByRole("button", { name: "Précédent" });
    while ((await previous.isVisible().catch(() => false)) && (await previous.isEnabled())) await previous.click();
    const next = page.getByRole("button", { name: "Suivant" });
    for (let i = 0; i < maxPages; i++) {
      const row = page.getByRole("row").filter({ hasText: text });
      if ((await row.count()) > 0) return row.first();
      if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
      await next.click();
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(`Ligne « ${String(text)} » introuvable dans le tableau`);
}

/** Toast Radix : le texte apparaît aussi dans une région live « Notification … » — on vise le texte exact. */
export async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

export function heading(page: Page, name: string | RegExp): Locator {
  return page.getByRole("heading", { name }).first();
}

/** Compte les requêtes sortantes vers l'API correspondant au motif (contrôle « aucun appel réseau »). */
export function countRequests(page: Page, match: (url: string, method: string) => boolean): { count: () => number } {
  let n = 0;
  page.on("request", (req) => {
    if (match(req.url(), req.method())) n++;
  });
  return { count: () => n };
}
