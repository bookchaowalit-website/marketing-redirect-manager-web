import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the starter stack, the default match and the local-only notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("somewhere useful.");
    expect(html).toContain("/go/github");
    expect(html).toContain("ROUTE FOUND");
    expect(html).toContain("Nothing is published.");
    expect(html).toMatch(/Rules are\s+exact-match examples/);
  });

  it("offers a generated short path for the FROM field", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Generate short path");
    expect(html).toContain('aria-describedby="from-hint"');
  });
});
