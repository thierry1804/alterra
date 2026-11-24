import { describe, expect, it } from "vitest";
import type { AccessRole, PermissionGroup } from "./access";
import {
  applyPatch,
  countChanges,
  describeChanges,
  editDraft,
  inverseChanges,
  needsExplicitConfirmation,
  normalizePatch,
  toChanges,
} from "./access-draft";

function role(overrides: Partial<AccessRole> = {}): AccessRole {
  return {
    id: "r1",
    name: "Finance",
    description: "Compta",
    isSystem: false,
    scope: "SITE",
    mfaRequired: true,
    groupIds: ["g1", "g2"],
    permissions: [],
    userCount: 3,
    version: "v1",
    ...overrides,
  };
}

const groups: PermissionGroup[] = [
  {
    id: "g1",
    name: "Badges — gestion",
    description: null,
    isSystem: true,
    permissions: ["badge:ecriture"],
    roleCount: 1,
  },
  {
    id: "g2",
    name: "Pointages — lecture",
    description: null,
    isSystem: true,
    permissions: ["pointage:lecture"],
    roleCount: 1,
  },
  {
    id: "g3",
    name: "Factures — lecture",
    description: null,
    isSystem: true,
    permissions: ["facture:lecture"],
    roleCount: 0,
  },
];

describe("normalizePatch", () => {
  it("retire les champs revenus à leur valeur d'origine", () => {
    const base = role();
    expect(normalizePatch(base, { scope: "SITE", mfaRequired: false, name: "Finance" })).toEqual({
      mfaRequired: false,
    });
    expect(normalizePatch(base, { groupIds: ["g2", "g1"] })).toEqual({});
    expect(normalizePatch(base, { description: null })).toEqual({ description: null });
  });
});

describe("editDraft", () => {
  it("garde la version du premier changement et fusionne les éditions", () => {
    const base = role();
    let draft = editDraft({}, base, { scope: "TOUS" });
    draft = editDraft(draft, { ...base, version: "v2" }, { mfaRequired: false });
    expect(draft.r1).toEqual({ patch: { scope: "TOUS", mfaRequired: false }, version: "v1" });
  });

  it("retire le rôle du brouillon quand tout est annulé à la main", () => {
    const base = role();
    let draft = editDraft({}, base, { scope: "TOUS" });
    draft = editDraft(draft, base, { scope: "SITE" });
    expect(draft).toEqual({});
  });

  it("calcule une édition de groupes à partir de l'état déjà modifié", () => {
    const base = role();
    let draft = editDraft({}, base, (current) => ({ groupIds: [...current.groupIds, "g3"] }));
    draft = editDraft(draft, base, (current) => ({
      groupIds: current.groupIds.filter((id) => id !== "g1"),
    }));
    expect(draft.r1.patch.groupIds).toEqual(["g2", "g3"]);
  });
});

describe("applyPatch", () => {
  it("recalcule les permissions quand les groupes changent", () => {
    const next = applyPatch(role(), { groupIds: ["g1", "g3"] }, groups);
    expect(next.permissions).toEqual(["badge:ecriture", "facture:lecture"]);
  });

  it("efface la description quand le brouillon la vide", () => {
    expect(applyPatch(role(), { description: null }).description).toBeNull();
  });
});

describe("countChanges / describeChanges", () => {
  it("compte un champ ou un groupe ajouté ou retiré pour une modification", () => {
    const base = role();
    const draft = editDraft({}, base, {
      scope: "TOUS",
      mfaRequired: false,
      groupIds: ["g2", "g3"],
    });
    expect(countChanges(draft, [base])).toBe(4); // portée, MFA, +g3, -g1
  });

  it("décrit les changements en français", () => {
    const lines = describeChanges(
      role(),
      { scope: "TOUS", mfaRequired: false, groupIds: ["g2", "g3"] },
      groups,
    );
    expect(lines.map((line) => line.text)).toEqual([
      "Portée : Son site → Tous les sites",
      "MFA : exigée → non exigée",
      "Factures — lecture",
      "Badges — gestion",
    ]);
    expect(lines.map((line) => line.kind)).toEqual(["field", "field", "added", "removed"]);
  });
});

describe("needsExplicitConfirmation", () => {
  it("exige une confirmation pour un rôle système ou un retrait du MFA", () => {
    expect(needsExplicitConfirmation(role({ isSystem: true }), { description: "x" })).toBe(true);
    expect(needsExplicitConfirmation(role(), { mfaRequired: false })).toBe(true);
    expect(needsExplicitConfirmation(role(), { scope: "EQUIPE" })).toBe(false);
    expect(needsExplicitConfirmation(role({ mfaRequired: false }), { mfaRequired: true })).toBe(
      false,
    );
  });
});

describe("payloads", () => {
  it("envoie la version attendue avec chaque modification", () => {
    const draft = editDraft({}, role(), { scope: "TOUS" });
    expect(toChanges(draft)).toEqual([{ roleId: "r1", expectedVersion: "v1", scope: "TOUS" }]);
  });

  it("construit l'annulation à partir de l'avant/après renvoyé par le serveur", () => {
    const before = role();
    const after = role({ scope: "TOUS", mfaRequired: false, groupIds: ["g2"], version: "v2" });
    expect(inverseChanges([before], [after])).toEqual([
      {
        roleId: "r1",
        expectedVersion: "v2",
        scope: "SITE",
        mfaRequired: true,
        groupIds: ["g1", "g2"],
      },
    ]);
  });
});
