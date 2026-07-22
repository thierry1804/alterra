import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";
import type { WeeklyReportViewModel } from "./weekly-data.service.js";
import type { DailyReportViewModel } from "./daily-data.service.js";

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "../../templates");

const compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  const cached = compiledTemplates.get(name);
  if (cached) return cached;

  const source = readFileSync(join(templatesDir, name), "utf-8");
  const compiled = Handlebars.compile(source);
  compiledTemplates.set(name, compiled);
  return compiled;
}

export function renderWeeklyReportHtml(data: WeeklyReportViewModel): string {
  return loadTemplate("weekly-report.hbs")(data);
}

export function renderWeeklyInvoiceHtml(data: WeeklyReportViewModel): string {
  return loadTemplate("weekly-invoice.hbs")(data);
}

export function renderDailyReportHtml(data: DailyReportViewModel): string {
  return loadTemplate("daily-report.hbs")(data);
}

/** Rendu HTML → PDF via Puppeteer (mockable en test via PDF_RENDERER=mock). */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  if (process.env.PDF_RENDERER === "mock" || process.env.NODE_ENV === "test") {
    return Buffer.from(`%PDF-MOCK\n${html.length}`, "utf-8");
  }

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
