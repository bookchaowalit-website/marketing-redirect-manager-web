// Pure logic for the local redirect rule desk. The page and the MCP route both use it.

export const CODES = ["301", "302", "307"] as const;
export type Code = (typeof CODES)[number];
export type Rule = { id: string; from: string; to: string; code: Code };
export type AddResult = { rules: Rule[]; error?: undefined } | { rules?: undefined; error: string };

export const STORAGE_KEY = "redirect-manager-v1";

export const STARTER_RULES: Rule[] = [
  { id: "1", from: "/old-blog", to: "/writing", code: "301" },
  { id: "2", from: "/go/github", to: "https://github.com/bookchaowalit", code: "302" },
];

export function isCode(value: unknown): value is Code {
  return CODES.includes(value as Code);
}

/** Exact path match only: no wildcards, regex or query handling. */
export function findRule(rules: Rule[], path: string): Rule | undefined {
  const wanted = path.trim();
  return rules.find((rule) => rule.from === wanted);
}

export function addRule(rules: Rule[], input: { from: string; to: string; code: Code }, id: string): AddResult {
  const from = input.from.trim();
  const to = input.to.trim();
  if (!from || !to) return { error: "Fill in both the path and the destination." };
  if (!from.startsWith("/")) return { error: "The path must start with /." };
  if (from === to) return { error: "A rule cannot send a path to itself." };
  if (findRule(rules, from)) return { error: `A rule for ${from} is already in the stack.` };
  return { rules: [{ id, from, to, code: input.code }, ...rules] };
}

export function removeRule(rules: Rule[], id: string): Rule[] {
  return rules.filter((item) => item.id !== id);
}

function isRule(value: unknown): value is Rule {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.from === "string" && typeof item.to === "string" && isCode(item.code);
}

// Saved state comes from the visitor's browser: anything that is not a list of rules is ignored.
export function parseRules(raw: string): Rule[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isRule) ? value : null;
  } catch {
    return null;
  }
}
