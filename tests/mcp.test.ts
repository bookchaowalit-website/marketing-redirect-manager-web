import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";

function rpc(body: unknown) {
  return POST(new Request("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body) }));
}
const call = (id: number, name: string, args?: Record<string, unknown>) =>
  rpc({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }).then((res) => res.json());

describe("MCP route", () => {
  it("echoes the JSON-RPC request id", async () => {
    expect((await (await rpc({ jsonrpc: "2.0", id: 7, method: "tools/list" })).json()).id).toBe(7);
  });

  it("lists the real tools", async () => {
    const { result } = await (await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })).json();
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(["get_starter_rules", "test_path"]);
  });

  it("get_starter_rules returns the starter stack", async () => {
    const { result } = await call(2, "get_starter_rules");
    expect(result.rules.map((r: { from: string }) => r.from)).toEqual(["/old-blog", "/go/github"]);
  });

  it("test_path matches exactly against the starter rules or the given rules", async () => {
    expect((await call(3, "test_path", { path: "/old-blog" })).result).toMatchObject({ matched: true, rule: { to: "/writing", code: "301" } });
    expect((await call(4, "test_path", { path: "/old-blog/x" })).result).toEqual({ matched: false });
    const rules = [{ id: "a", from: "/x", to: "/y", code: "307" }];
    expect((await call(5, "test_path", { path: "/x", rules })).result.rule.code).toBe("307");
  });

  it("rejects bad arguments, unknown tools and unknown methods", async () => {
    expect((await call(6, "test_path", {})).error.code).toBe(-32602);
    expect((await call(7, "test_path", { path: "/x", rules: [{ from: 1 }] })).error.code).toBe(-32602);
    const unknown = await call(8, "publish_rules");
    expect(unknown.error.code).toBe(-32602);
    expect(unknown.id).toBe(8);
    expect((await (await rpc({ jsonrpc: "2.0", id: 9, method: "nope" })).json()).error.code).toBe(-32601);
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
    expect((await res.json()).error.code).toBe(-32700);
  });
});
