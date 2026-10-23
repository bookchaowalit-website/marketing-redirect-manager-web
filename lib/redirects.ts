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

// Short paths (merged from marketing-url-shortener-web on 2026-10-23): a generated /s/<code> FROM path.
export const SHORT_PREFIX = "/s/";
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 20;

// One character per draw, so the code is always CODE_LENGTH long.
export function makeCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[Math.min(ALPHABET.length - 1, Math.floor(random() * ALPHABET.length))];
  return code;
}

/** A short path not yet in the stack, or null when MAX_ATTEMPTS draws all collide. */
export function generateShortPath(rules: Rule[], random: () => number = Math.random): string | null {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const path = `${SHORT_PREFIX}${makeCode(random)}`;
    if (!findRule(rules, path)) return path;
  }
  return null;
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
