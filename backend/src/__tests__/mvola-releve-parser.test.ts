import xlsx from "node-xlsx";
import { describe, expect, it } from "vitest";
import {
  normalizeMvolaAmount,
  normalizeMvolaPhone,
  parseMvolaReleveWorkbook,
} from "../services/payments/mvola-releve-parser.service.js";

function buildReleveFixture(dataRows: unknown[][]): Buffer {
  const sheetData: unknown[][] = [
    ["RELEVE DE TRANSACTIONS MVOLA"],
    ["COMPTE : 0382019280 - LOHASAHA MADAGASCO ALTERRA"],
    ["PERIODE : 01/07/2026 - 31/07/2026"],
    ["SOLDE INITIAL : 429452908"],
    ["SOLDE FINAL : 592181001"],
    [],
    [
      "DATE - HEURE",
      "REFERENCE",
      "INITIATEUR",
      "DESTINATAIRE",
      "TYPE - TRANSACTION",
      "DESCRIPTION",
      "MONTANT",
    ],
    ...dataRows,
  ];

  return xlsx.build([{ name: "Sheet1", data: sheetData, options: {} }]);
}

describe("parseMvolaReleveWorkbook", () => {
  it("saute l'en-tête de compte et lit les lignes à partir de la ligne 8", () => {
    const buffer = buildReleveFixture([
      [
        "2026-07-15 10:00:00",
        "3117400001",
        "'0382019280",
        "'0341234567",
        "Transfert d'argent",
        "ramaharavo jean b fauchage s26 93 abm act07 84",
        "- 698800.00",
      ],
      [
        "2026-07-15 10:01:00",
        "3117400012",
        "'0341234567",
        "MVola",
        "Frais de transfert réf 3117400001",
        "",
        "- 1900.00",
      ],
    ]);

    const rows = parseMvolaReleveWorkbook(buffer);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      reference: "3117400001",
      initiateur: "'0382019280",
      type: "Transfert d'argent",
      description: "ramaharavo jean b fauchage s26 93 abm act07 84",
      montant: "- 698800.00",
    });
    expect(rows[1]).toMatchObject({
      type: "Frais de transfert réf 3117400001",
      description: null,
    });
  });

  it("ignore les lignes complètement vides", () => {
    const buffer = buildReleveFixture([
      ["2026-07-15 10:00:00", "3117400001", "'0382019280", "'0341234567", "Depot", "", "100"],
      [],
    ]);

    expect(parseMvolaReleveWorkbook(buffer)).toHaveLength(1);
  });

  it("rejette un classeur sans les colonnes attendues", () => {
    const buffer = xlsx.build([
      { name: "Sheet1", data: [["Autre chose"], [], [], [], [], [], ["A", "B"]], options: {} },
    ]);

    expect(() => parseMvolaReleveWorkbook(buffer)).toThrow();
  });
});

describe("normalizeMvolaPhone", () => {
  it("retire l'apostrophe texte Excel", () => {
    expect(normalizeMvolaPhone("'0341234567")).toBe("0341234567");
  });
});

describe("normalizeMvolaAmount", () => {
  it("conserve le signe et retire les espaces", () => {
    expect(normalizeMvolaAmount("- 450000.00")).toBe(-450000);
    expect(normalizeMvolaAmount("+ 12500.00")).toBe(12500);
  });
});
