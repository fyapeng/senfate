import { describe, expect, it } from "vitest";
import { THEORY_FUNCTIONS, validateTheoryFunctions } from "./theory";

describe("theory function system", () => {
  it("is complete and acyclic", () => {
    expect(() => validateTheoryFunctions(THEORY_FUNCTIONS)).not.toThrow();
    expect(THEORY_FUNCTIONS).toHaveLength(20);
  });

  it("requires normal form and kinship before topics", () => {
    expect(THEORY_FUNCTIONS.find((item) => item.id === "semantic.topics")?.dependsOn).toEqual([
      "resolution.normal-form",
      "semantic.kinship",
    ]);
  });
});
