import { NextResponse } from "next/server";
import { STARTER_RULES, findRule, parseRules, type Rule } from "@/lib/redirects";

// Stateless JSON-RPC MCP endpoint over the same exact-match logic the page uses. Rules a visitor adds live only in
// their browser's localStorage, so tools work on the starter rules or on rules the caller sends. Nothing redirects.

type RpcRequest = { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const rulesSchema = {
  type: "array",
  items: {
    type: "object",
    properties: { id: { type: "string" }, from: { type: "string" }, to: { type: "string" }, code: { type: "string", enum: ["301", "302", "307"] } },
    required: ["id", "from", "to", "code"],
  },
};

const TOOLS = [
  { name: "get_starter_rules", description: "The starter redirect rules the page begins with", inputSchema: { type: "object", properties: {} } },
  {
    name: "test_path",
    description: "Exact-match a request path against the given rules (or the starter rules); no wildcards or regex",
    inputSchema: { type: "object", properties: { path: { type: "string" }, rules: rulesSchema }, required: ["path"] },
  },
];

class RpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function readRules(value: unknown): Rule[] {
  if (value === undefined) return STARTER_RULES;
  const rules = parseRules(JSON.stringify(value));
  if (!rules) throw new RpcError(-32602, "rules must be a list of {id, from, to, code: 301|302|307}");
  return rules;
}

function callTool(name: string | undefined, args: Record<string, unknown> = {}) {
  switch (name) {
    case "get_starter_rules":
      return { rules: STARTER_RULES };
    case "test_path": {
      if (typeof args.path !== "string") throw new RpcError(-32602, "path must be a string");
      const rule = findRule(readRules(args.rules), args.path);
      return rule ? { matched: true, rule } : { matched: false };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
  }
}

export async function POST(request: Request) {
  let id: RpcRequest["id"] = null;
  try {
    const body = (await request.json()) as RpcRequest;
    id = body.id ?? null;
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "Forwarding Desk redirect rules", version: "1.0.0" } };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = callTool(body.params?.name, body.params?.arguments);
        break;
      default:
        throw new RpcError(-32601, `Unknown method: ${String(body.method)}`);
    }
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    const code = error instanceof RpcError ? error.code : -32700;
    const message = error instanceof RpcError ? error.message : "Parse error";
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
  }
}
