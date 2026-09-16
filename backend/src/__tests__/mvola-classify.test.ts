import { describe, expect, it } from "vitest";
import { classifyMvolaRow, type MvolaRawRow } from "../services/payments/mvola-classify.service.js";

function row(overrides: Partial<MvolaRawRow>): MvolaRawRow {
  return {
    dateHeure: "2026-07-15 10:00:00",
    reference: "3117400001",
    initiateur: "'0382019280",
    destinataire: "'0341234567",
    type: "Transfert d'argent",
    description: null,
    montant: "- 100000.00",
    ...overrides,
  };
}

describe("classifyMvolaRow", () => {
  it("classe un virement salaire conforme avec matricule", () => {
    expect(
      classifyMvolaRow(
        row({
          description: "ramaharavo jean b fauchage s26 93 abm act07 84",
          montant: "- 698800.00",
        }),
      ),
    ).toBe("SALARY");
  });

  it("classe un virement salaire conforme sans matricule", () => {
    expect(
      classifyMvolaRow(
        row({
          description: "bakolinirina marie fauchage s27 2 mnk act07",
          montant: "- 50000.00",
        }),
      ),
    ).toBe("SALARY");
  });

  it("classe un virement salaire conforme sans code activité (Activity.code absent en base)", () => {
    expect(
      classifyMvolaRow(
        row({
          description: "ramaharavo jean b trouaison s38 3 mnk 84",
          montant: "- 750.00",
        }),
      ),
    ).toBe("SALARY");
  });

  it("classe une dépense interne au libellé non conforme", () => {
    expect(
      classifyMvolaRow(
        row({
          description: "manga pmt controle systeme de frein",
          montant: "- 450000.00",
        }),
      ),
    ).toBe("INTERNAL");
  });

  it("ignore un virement entrant (signe positif)", () => {
    expect(
      classifyMvolaRow(
        row({
          description: "paiement lohasaha madagasco",
          montant: "+ 100000000.00",
        }),
      ),
    ).toBe("IGNORED");
  });

  it("classe une ligne de frais rattachée à sa transaction mère", () => {
    expect(
      classifyMvolaRow(
        row({
          type: "Frais de transfert réf 3117400012",
          initiateur: "'0341234567",
          destinataire: "MVola",
          description: null,
          montant: "- 1900.00",
        }),
      ),
    ).toBe("FEE");
  });

  it("ignore un type de transaction hors virement sortant", () => {
    expect(
      classifyMvolaRow(
        row({
          type: "Paiement",
          description: "utility",
          montant: "+ 12500.00",
        }),
      ),
    ).toBe("IGNORED");
  });

  it("ignore un virement sortant qui n'émane pas du compte ALTERRA", () => {
    expect(
      classifyMvolaRow(
        row({
          initiateur: "'0341112222",
          description: "ramaharavo jean b fauchage s26 93 abm act07 84",
          montant: "- 698800.00",
        }),
      ),
    ).toBe("IGNORED");
  });
});
