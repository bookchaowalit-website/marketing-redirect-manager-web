// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { STARTER_RULES, STORAGE_KEY } from "@/lib/redirects";

// Mounted tests for the Redirect Manager on the App shell: lists, composer, field errors, remove + undo, checker, empty states.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = (selector: string) => host.querySelector(selector) as HTMLElement | null;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent?.trim())?.startsWith(text)) as HTMLButtonElement;
const press = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
const mount = () => act(() => root.render(<Home />));
const type = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const field = (label: string) => [...host.querySelectorAll("label")].find((l) => l.textContent?.startsWith(label))?.querySelector("input") as HTMLInputElement;
const submit = () => act(() => { ($("form.as-composer") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });

beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("redirect manager", () => {
  it("server-renders the starter rules, the checker and the hub link", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("All rules");
    expect(html).toContain("/go/github");
    expect(html).toContain("Goes to");
    expect(html).toContain("nothing is published");
    expect(html).toContain('href="https://bookchaowalit.com/"');
  });

  it("lists rules by status code and checks a path", () => {
    mount();
    expect(rows()).toEqual(["/old-blog → /writing", "/go/github → https://github.com/bookchaowalit"]);
    expect($("#check-result")?.textContent).toBe("301 Goes to /writing");
    press(button("302"));
    expect($("h1")?.textContent).toBe("302 · Temporary");
    expect(rows()).toEqual(["/go/github → https://github.com/bookchaowalit"]);
    press(button("307"));
    expect($(".as-empty")?.textContent).toContain("No 307 rules");
    type(field("Request path"), "/nope");
    expect($("#check-result")?.textContent).toBe("No rule No rule matches /nope exactly.");
    type(field("Request path"), " ");
    expect($("#check-result")?.textContent).toBe("Type a path to see where it goes.");
  });

  it("adds a rule from the composer and switches to its list", () => {
    mount();
    press(button("307"));
    press(button("New rule"));
    expect(document.activeElement).toBe(field("From path"));
    expect(button("Add").disabled).toBe(true);
    type(field("From path"), "/a");
    type(field("To destination"), "/b");
    press([...host.querySelectorAll(".as-segmented button")].find((b) => b.textContent === "302") as HTMLButtonElement);
    submit();
    expect($("h1")?.textContent).toBe("302 · Temporary");
    expect(rows()[0]).toBe("/a → /b");
    expect($("form.as-composer")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toHaveLength(3);
  });

  it("shows a validation error in red under the field it is about", () => {
    mount();
    press(button("New rule"));
    type(field("From path"), "old");
    type(field("To destination"), "/new");
    submit();
    expect($("#from-error")?.textContent).toBe("The path must start with /.");
    expect(field("From path").getAttribute("aria-invalid")).toBe("true");
    expect(field("From path").getAttribute("aria-describedby")).toBe("from-error");
    type(field("From path"), "/old");
    expect($("#from-error")).toBeNull();
    press(button("Generate short path"));
    expect(field("From path").value).toMatch(/^\/s\/[0-9a-z]{6}$/);
    press(button("Cancel"));
    expect($("form.as-composer")).toBeNull();
  });

  it("removes with an Undo toast that puts the rule back in place", () => {
    vi.useFakeTimers();
    mount();
    press(button("Remove /old-blog"));
    expect(rows()).toHaveLength(1);
    expect($(".as-toast")?.textContent).toBe("Removed /old-blogUndo");
    press(button("Undo remove"));
    expect(rows()[0]).toBe("/old-blog → /writing");
    press(button("Remove /go/github"));
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });

  it("offers the example rules back when the stack is empty, and clears a search that matches nothing", () => {
    window.localStorage.setItem(STORAGE_KEY, "[]");
    mount();
    expect($(".as-empty")?.textContent).toContain("No rules yet");
    press(button("Restore example rules"));
    expect(rows()).toHaveLength(STARTER_RULES.length);
    type(host.querySelector('input[type="search"]') as HTMLInputElement, "zzz");
    expect($(".as-empty")?.textContent).toContain("Nothing matches");
    press(button("Clear search"));
    expect(rows()).toHaveLength(2);
  });
});
