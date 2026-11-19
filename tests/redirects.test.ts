import { describe, expect, it } from "vitest";
import { STARTER_RULES, addRule, errorField, findRule, parseRules, removeRule, restoreRule } from "@/lib/redirects";

describe("findRule", () => {
  it("finds an exact path match", () => {
    expect(findRule(STARTER_RULES, "/old-blog")?.to).toBe("/writing");
    expect(findRule(STARTER_RULES, "/old-blog/post")).toBeUndefined();
    expect(findRule(STARTER_RULES, "/OLD-BLOG")).toBeUndefined();
  });

  it("ignores spaces typed around the request path", () => {
    expect(findRule(STARTER_RULES, " /go/github ")?.code).toBe("302");
  });
});

describe("addRule", () => {
  it("adds a trimmed rule at the top of the stack", () => {
    const result = addRule(STARTER_RULES, { from: " /a ", to: " /b ", code: "307" }, "x");
    expect(result.rules?.[0]).toEqual({ id: "x", from: "/a", to: "/b", code: "307" });
    expect(result.rules).toHaveLength(STARTER_RULES.length + 1);
  });

  it("refuses empty fields", () => {
    expect(addRule(STARTER_RULES, { from: " ", to: "/b", code: "301" }, "x").error).toBeTruthy();
  });

  it("refuses a path that is not a path", () => {
    expect(addRule(STARTER_RULES, { from: "old-blog", to: "/b", code: "301" }, "x").error).toMatch(/start with \//);
  });

  it("refuses a second rule for the same path, which the exact-match test could never reach", () => {
    expect(addRule(STARTER_RULES, { from: "/old-blog", to: "/elsewhere", code: "301" }, "x").error).toMatch(/already/);
  });

  it("refuses a rule that redirects a path to itself", () => {
    expect(addRule(STARTER_RULES, { from: "/loop", to: "/loop", code: "301" }, "x").error).toMatch(/itself/);
  });
});

describe("removeRule", () => {
  it("removes only the matching id", () => {
    expect(removeRule(STARTER_RULES, "1").map((r) => r.id)).toEqual(["2"]);
  });
});

describe("parseRules", () => {
  it("reads saved rules back, including an empty stack", () => {
    expect(parseRules(JSON.stringify(STARTER_RULES))).toEqual(STARTER_RULES);
    expect(parseRules("[]")).toEqual([]);
  });

  it("rejects corrupt or wrongly shaped storage instead of crashing the page", () => {
    expect(parseRules("nope")).toBeNull();
    expect(parseRules("{}")).toBeNull();
    expect(parseRules(JSON.stringify([{ id: "1", from: "/a", to: "/b", code: "404" }]))).toBeNull();
    expect(parseRules(JSON.stringify([{ id: "1", from: "/a", code: "301" }]))).toBeNull();
  });
});

describe("errorField and restoreRule", () => {
  it("puts each error under the field it is about", () => {
    expect(errorField({ from: "", to: "/x" }, "Fill in both the path and the destination.")).toBe("from");
    expect(errorField({ from: "/a", to: " " }, "Fill in both the path and the destination.")).toBe("to");
    expect(errorField({ from: "a", to: "/x" }, "The path must start with /.")).toBe("from");
  });
  it("restores a removed rule at its old place unless its path is back already", () => {
    const [first, second] = STARTER_RULES;
    expect(restoreRule([second], first, 0)).toEqual([first, second]);
    expect(restoreRule([second], first, 9)).toEqual([second, first]);
    expect(restoreRule([{ ...first, id: "new" }], first, 0)).toEqual([{ ...first, id: "new" }]);
  });
  it("restores next to the rules it sat between, so rules added meanwhile cannot shift it", () => {
    const [a, b] = STARTER_RULES;
    const c = { id: "3", from: "/c", to: "/cc", code: "307" as const };
    const d = { id: "4", from: "/d", to: "/dd", code: "301" as const };
    // B removed from [A, B, C], then D added at the top: B goes back between A and C, not at index 1.
    expect(restoreRule([d, a, c], b, 1, { beforeId: "3", afterId: "1" })).toEqual([d, a, b, c]);
    // Its next neighbour gone too: after the one before it.
    expect(restoreRule([d, a], b, 1, { beforeId: "3", afterId: "1" })).toEqual([d, a, b]);
    // Already back: unchanged.
    expect(restoreRule([a, b], b, 1, { afterId: "1" })).toEqual([a, b]);
  });
});
