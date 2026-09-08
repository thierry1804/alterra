import { describe, expect, it } from "vitest";
import {
  normalizeImportLabel,
  suggestColumnMapping,
} from "../services/import/suggest-column-mapping.js";

describe("suggestColumnMapping", () => {
  it("normalizeImportLabel lowercases, strips accents and spaces/punct", () => {
    expect(normalizeImportLabel("  Prénom ")).toBe("prenom");
    expect(normalizeImportLabel("Numéro MVola")).toBe("numeromvola");
    expect(normalizeImportLabel("Code site (ex. MNK)")).toBe("codesiteexmnk");
  });

  it("maps exact aliases to column letters", () => {
    const mapping = suggestColumnMapping([
      { column: "A", label: "Prénom" },
      { column: "B", label: "Nom" },
      { column: "C", label: "Numéro MVola" },
      { column: "D", label: "Code site" },
    ]);
    expect(mapping.firstName).toBe("A");
    expect(mapping.lastName).toBe("B");
    expect(mapping.mvolaNumber).toBe("C");
    expect(mapping.siteShortCode).toBe("D");
  });

  it("fuzzy-maps close labels (substring / high similarity)", () => {
    const mapping = suggestColumnMapping([
      { column: "A", label: "Prenom du MOC" },
      { column: "B", label: "Nom de famille" },
      { column: "C", label: "Tel Mvola" },
      { column: "D", label: "CodeSite" },
    ]);
    expect(mapping.firstName).toBe("A");
    expect(mapping.lastName).toBe("B");
    expect(mapping.mvolaNumber).toBe("C");
    expect(mapping.siteShortCode).toBe("D");
  });

  it("never assigns the same column to two fields", () => {
    const mapping = suggestColumnMapping([{ column: "A", label: "Nom" }]);
    const values = Object.values(mapping);
    expect(new Set(values).size).toBe(values.length);
  });

  it("returns empty object when labels are unrelated", () => {
    const mapping = suggestColumnMapping([
      { column: "A", label: "Couleur préférée" },
      { column: "B", label: "XYZ" },
    ]);
    expect(mapping).toEqual({});
  });
});
