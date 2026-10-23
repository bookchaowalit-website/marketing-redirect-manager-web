import { describe, expect, it } from "vitest";
import { SHORT_PREFIX, STARTER_RULES, addRule, generateShortPath, makeCode } from "@/lib/redirects";

// Ported from marketing-url-shortener-web (merged here on 2026-10-23): a generated path is a rule's FROM path.
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("makeCode", () => {
  it("always returns six base-36 characters, even at the edges of random()", () => {
    expect(makeCode(() => 0)).toBe("000000");
    expect(makeCode(() => 0.999999)).toBe("zzzzzz");
    expect(makeCode()).toMatch(/^[0-9a-z]{6}$/);
  });
});

describe("generateShortPath", () => {
  it("returns a /s/ path that addRule accepts", () => {
    const path = generateShortPath(STARTER_RULES, () => 0);
    expect(path).toBe(`${SHORT_PREFIX}000000`);
    expect(addRule(STARTER_RULES, { from: path!, to: "https://example.com/long", code: "302" }, "g").rules?.[0].from).toBe(path);
  });

  it("skips a path that is already in the stack", () => {
    const rules = [...STARTER_RULES, { id: "t", from: "/s/000000", to: "/x", code: "302" as const }];
    expect(generateShortPath(rules, sequence([0, 0, 0, 0, 0, 0, 0.5]))).not.toBe("/s/000000");
  });

  it("gives up with null instead of looping forever when every draw collides", () => {
    const rules = [{ id: "t", from: "/s/000000", to: "/x", code: "302" as const }];
    expect(generateShortPath(rules, () => 0)).toBeNull();
  });
});
