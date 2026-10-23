import { describe, expect, it } from "vitest";
import { STARTER_RULES, addRule, findRule, parseRules, removeRule } from "@/lib/redirects";

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
