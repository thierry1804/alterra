import { PaymentReconciliationStatus, PaymentStatus, Prisma } from "@prisma/client";
import xlsx from "node-xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";
import { reconcileMvolaReleve, weekKey } from "../services/payments/mvola-reconciliation.service.js";

const SITE_MNK = { id: "site-mnk", shortCode: "MNK" };

function worker(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "worker-1",
    firstName: "Jean B.",
    lastName: "Ramaharavo",
    matricule: "MOC-MNK-L84",
    mvolaNumber: "0341234567",
    legacyMocId: 84,
    site: SITE_MNK,
    ...overrides,
  };
}

function payment(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "payment-1",
    periodIso: "S26",
    bordereau: 93,
    amount: new Prisma.Decimal("698800"),
    worker: worker({}),
    ...overrides,
  };
}

function buildReleve(dataRows: unknown[][]): Buffer {
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

function salaryRow(reference: string, phone: string, description: string, montant: string) {
  return [
    "2026-07-15 10:00:00",
    reference,
    "'0382019280",
    `'${phone}`,
    "Transfert d'argent",
    description,
    montant,
  ];
}

function feeRow(reference: string, parentReference: string, montant: string) {
  return [
    "2026-07-15 10:00:05",
    reference,
    "'0341234567",
    "MVola",
    `Frais de transfert réf ${parentReference}`,
    "",
    montant,
  ];
}

describe("reconcileMvolaReleve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.payment.findMany).mockImplementation(({ where }: { where: unknown }) => {
      const w = where as { status?: string; mvolaReference?: unknown };
      if (w.status === PaymentStatus.EXPORTED) {
        return Promise.resolve([payment({})] as never);
      }
      return Promise.resolve([] as never);
    });
    vi.mocked(prisma.payment.update).mockResolvedValue({} as never);
  });

  it("confirme une ligne dont la clé et le montant correspondent", async () => {
    const buffer = buildReleve([
      salaryRow(
        "3117400001",
        "0341234567",
        "ramaharavo jean b fauchage s26 93 mnk act07 84",
        "- 698800.00",
      ),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.confirme).toBe(1);
    expect(result.confirmes).toEqual([
      {
        paymentId: "payment-1",
        worker: "Jean B. Ramaharavo (MOC-MNK-L84)",
        reference: "3117400001",
        montant: "698800",
      },
    ]);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1" },
        data: expect.objectContaining({
          status: PaymentStatus.PAID,
          reconciliationStatus: PaymentReconciliationStatus.CONFIRME,
          mvolaReference: "3117400001",
        }),
      }),
    );
  });

  it("classe en ECART_MONTANT sans corriger le montant automatiquement", async () => {
    const buffer = buildReleve([
      salaryRow(
        "3117400002",
        "0341234567",
        "ramaharavo jean b fauchage s26 93 mnk act07 84",
        "- 500000.00",
      ),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.ecartMontant).toBe(1);
    expect(result.confirme).toBe(0);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reconciliationStatus: PaymentReconciliationStatus.ECART_MONTANT,
        }),
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.PAID }) }),
    );
  });

  it("classe en ORPHELIN une ligne sans Payment correspondant", async () => {
    const buffer = buildReleve([
      salaryRow(
        "3117400003",
        "0349999999",
        "inconnu robert fauchage s26 99 mnk act07 999",
        "- 100000.00",
      ),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.orphelin).toBe(1);
    expect(result.orphelins[0].reference).toBe("3117400003");
    expect(result.nonConfirme).toBe(1);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1" },
        data: { reconciliationStatus: PaymentReconciliationStatus.NON_CONFIRME },
      }),
    );
  });

  it("retombe sur la clé de secours (téléphone) sans matricule", async () => {
    vi.mocked(prisma.payment.findMany).mockImplementation(({ where }: { where: unknown }) => {
      const w = where as { status?: string };
      if (w.status === PaymentStatus.EXPORTED) {
        return Promise.resolve([payment({ worker: worker({ legacyMocId: null }) })] as never);
      }
      return Promise.resolve([] as never);
    });

    const buffer = buildReleve([
      salaryRow(
        "3117400004",
        "0341234567",
        "bakolinirina marie fauchage s26 93 mnk act07",
        "- 698800.00",
      ),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.confirme).toBe(1);
  });

  it("rattache les frais de transfert au paiement confirmé", async () => {
    const buffer = buildReleve([
      salaryRow(
        "3117400005",
        "0341234567",
        "ramaharavo jean b fauchage s26 93 mnk act07 84",
        "- 698800.00",
      ),
      feeRow("3117400006", "3117400005", "- 1900.00"),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.confirme).toBe(1);
    expect(result.fraisRattaches).toBe(1);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { transferFee: 1900 } }),
    );
  });

  it("marque NON_CONFIRME un Payment EXPORTED de la même semaine resté sans écho", async () => {
    vi.mocked(prisma.payment.findMany).mockImplementation(({ where }: { where: unknown }) => {
      const w = where as { status?: string };
      if (w.status === PaymentStatus.EXPORTED) {
        return Promise.resolve([
          payment({ id: "payment-1" }),
          payment({
            id: "payment-2",
            worker: worker({ legacyMocId: 85, mvolaNumber: "0349999998" }),
          }),
        ] as never);
      }
      return Promise.resolve([] as never);
    });

    const buffer = buildReleve([
      salaryRow(
        "3117400007",
        "0341234567",
        "ramaharavo jean b fauchage s26 93 mnk act07 84",
        "- 698800.00",
      ),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.confirme).toBe(1);
    expect(result.nonConfirme).toBe(1);
    expect(result.nonConfirmes).toEqual([
      {
        paymentId: "payment-2",
        worker: "Jean B. Ramaharavo (MOC-MNK-L84)",
        periodIso: "S26",
        bordereau: 93,
        montant: "698800",
      },
    ]);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-2" },
        data: { reconciliationStatus: PaymentReconciliationStatus.NON_CONFIRME },
      }),
    );
  });

  it("ne marque pas NON_CONFIRME un paiement de la même semaine mais d'une autre année", async () => {
    vi.mocked(prisma.payment.findMany).mockImplementation(({ where }: { where: unknown }) => {
      const w = where as { status?: string };
      if (w.status === PaymentStatus.EXPORTED) {
        return Promise.resolve([
          payment({ id: "payment-2026", referenceYear: 2026 }),
          payment({
            id: "payment-2027",
            referenceYear: 2027,
            bordereau: 94,
            worker: worker({ legacyMocId: 85, mvolaNumber: "0349999998" }),
          }),
          payment({
            id: "payment-2026-b",
            referenceYear: 2026,
            bordereau: 95,
            worker: worker({ legacyMocId: 86, mvolaNumber: "0348888888" }),
          }),
        ] as never);
      }
      return Promise.resolve([] as never);
    });

    // Relevé de juillet 2026 : ne confirme que le paiement 2026 n° 93
    const buffer = buildReleve([
      salaryRow("3117400010", "0341234567", "ramaharavo jean b fauchage s26 93 mnk act07 84", "- 698800.00"),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.confirme).toBe(1);
    expect(result.nonConfirmes.map((n) => n.paymentId)).toEqual(["payment-2026-b"]);
    expect(prisma.payment.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "payment-2027" } }));
  });

  it("n'écrit rien en mode aperçu (dryRun)", async () => {
    vi.mocked(prisma.payment.findMany).mockImplementation(({ where }: { where: unknown }) => {
      const w = where as { status?: string };
      return Promise.resolve((w.status === PaymentStatus.EXPORTED ? [payment({})] : []) as never);
    });
    const buffer = buildReleve([
      salaryRow("3117400011", "0341234567", "ramaharavo jean b fauchage s26 93 mnk act07 84", "- 698800.00"),
    ]);

    const result = await reconcileMvolaReleve(buffer, { dryRun: true });

    expect(result.confirme).toBe(1);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("compte comme déjà traité une référence déjà rapprochée", async () => {
    vi.mocked(prisma.payment.findMany).mockImplementation(({ where }: { where: unknown }) => {
      const w = where as { status?: string; mvolaReference?: unknown };
      if (w.status === PaymentStatus.EXPORTED) return Promise.resolve([] as never);
      if (w.mvolaReference) {
        return Promise.resolve([{ id: "payment-1", mvolaReference: "3117400001" }] as never);
      }
      return Promise.resolve([] as never);
    });

    const buffer = buildReleve([
      salaryRow(
        "3117400001",
        "0341234567",
        "ramaharavo jean b fauchage s26 93 mnk act07 84",
        "- 698800.00",
      ),
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.dejaTraite).toBe(1);
    expect(result.dejaTraites).toEqual([{ paymentId: "payment-1", reference: "3117400001" }]);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("compte les dépenses internes et les lignes ignorées sans les rapprocher", async () => {
    const buffer = buildReleve([
      salaryRow("3117400008", "0341112222", "manga pmt controle systeme de frein", "- 450000.00"),
      [
        "2026-07-20 08:00:00",
        "3117400009",
        "'0300000000",
        "'0382019280",
        "Transfert d'argent",
        "paiement lohasaha madagasco",
        "+ 5000000.00",
      ],
    ]);

    const result = await reconcileMvolaReleve(buffer);

    expect(result.internal).toBe(1);
    expect(result.ignored).toBe(1);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});

describe("weekKey", () => {
  it("prend l'année de la date d'exécution", () => {
    expect(weekKey(26, new Date("2026-07-15T10:00:00"))).toBe("2026:26");
  });

  it("rattache une semaine 50 et plus payée en janvier à l'année précédente", () => {
    expect(weekKey(52, new Date("2027-01-04T10:00:00"))).toBe("2026:52");
  });

  it("rattache une semaine 1 payée en décembre à l'année suivante", () => {
    expect(weekKey(1, new Date("2026-12-30T10:00:00"))).toBe("2027:1");
  });

  it("laisse l'année inconnue quand la date est illisible", () => {
    expect(weekKey(26, new Date("pas une date"))).toBe("?:26");
  });
});
