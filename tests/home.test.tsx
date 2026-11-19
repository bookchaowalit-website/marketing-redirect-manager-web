// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
// detail 0 = keyboard (Enter/Space) click, 1 = pointer click.
const press = (el: Element, detail = 1) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
const escape = () => act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
const THIRD = { id: "3", from: "/third", to: "/3", code: "307" };
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

  it("consecutive removes restore together with one Undo, each in its place", () => {
    vi.useFakeTimers();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...STARTER_RULES, THIRD]));
    mount();
    const before = rows();
    expect(before).toHaveLength(3);
    press(button("Remove /go/github"));
    act(() => { vi.advanceTimersByTime(4000); });
    press(button("Remove /old-blog"));
    expect(rows()).toHaveLength(1);
    expect($(".as-toast span")?.textContent).toBe("Removed 2 rules");
    expect(button("Undo").getAttribute("aria-label")).toBe("Undo remove of 2 rules");
    // The second removal restarted the 6 s window.
    act(() => { vi.advanceTimersByTime(4000); });
    press(button("Undo"));
    expect(rows()).toEqual(before);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toHaveLength(3);
    expect($('[role="status"]')?.textContent).toBe("Restored 2 rules.");
    expect($(".as-toast")).toBeNull();
  });

  it("keyboard remove focuses Undo; Undo focuses the restored rule, Escape the next one", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...STARTER_RULES, THIRD]));
    mount();
    press(button("Remove /old-blog"), 0);
    expect(document.activeElement).toBe(button("Undo remove"));
    press(button("Undo remove"), 0);
    expect(document.activeElement).toBe(button("Remove /old-blog"));
    press(button("Remove /go/github"), 0);
    escape();
    expect($(".as-toast")).toBeNull();
    expect(document.activeElement).toBe(button("Remove /third"));
    // The last row: the one before it.
    press(button("Remove /third"), 0);
    escape();
    expect(document.activeElement).toBe(button("Remove /old-blog"));
    // Nothing left to land on: New rule.
    press(button("Remove /old-blog"), 0);
    escape();
    expect(document.activeElement).toBe(button("New rule"));
  });

  it("a pointer remove leaves focus alone and the toast reserves its height while it shows", () => {
    vi.useFakeTimers();
    mount();
    press(button("Remove /old-blog"));
    expect(document.activeElement).not.toBe(button("Undo remove"));
    expect(document.documentElement.style.getPropertyValue("--as-toast-space")).toMatch(/px$/);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(document.documentElement.style.getPropertyValue("--as-toast-space")).toBe("");
  });

  it("says when Undo cannot bring a rule back because its path was re-added", () => {
    mount();
    press(button("Remove /old-blog"));
    press(button("New rule"));
    type(field("From path"), "/old-blog");
    type(field("To destination"), "/elsewhere");
    submit();
    press(button("Undo remove"));
    expect($('[role="status"]')?.textContent).toBe("/old-blog is already in use, so the newer rule stays.");
    // The toast closes, so the reason is also shown on screen, not only announced.
    expect($(".rm-notice")?.textContent).toBe("/old-blog is already in use, so the newer rule stays.");
    expect(rows().filter((row) => row?.startsWith("/old-blog"))).toEqual(["/old-blog → /elsewhere"]);
  });

  it("Restore example rules keeps rules another tab saved since the empty list was drawn", () => {
    window.localStorage.setItem(STORAGE_KEY, "[]");
    mount();
    // Another tab adds a rule; this tab has not received the storage event yet.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([THIRD]));
    // Skipping must not write the list back: a rule saved between a read and a write would be lost.
    const write = vi.spyOn(window.localStorage, "setItem");
    press(button("Restore example rules"));
    expect(write.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([]);
    write.mockRestore();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([THIRD]);
    expect(rows()).toEqual(["/third → /3"]);
    expect($('[role="status"]')?.textContent).toBe("Rules were added in another tab, so the example rules were not restored.");
  });

  it("lets a long path in an error message wrap instead of widening the form", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/\.rm-error \{[^}]*overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.as-list\.as-empty \{ overflow-wrap: anywhere; \}/);
  });

  it("offers the example rules back when the stack is empty, and clears a search that matches nothing", () => {
    window.localStorage.setItem(STORAGE_KEY, "[]");
    mount();
    expect($(".as-empty")?.textContent).toContain("No rules yet");
    press(button("Restore example rules"));
    expect(rows()).toHaveLength(STARTER_RULES.length);
    // From an empty 307 list too: the view switches to All rules so both examples show.
    window.localStorage.setItem(STORAGE_KEY, "[]");
    act(() => { window.dispatchEvent(new StorageEvent("storage")); });
    press(button("307"));
    press(button("Restore example rules"));
    expect($("h1")?.textContent).toBe("All rules");
    expect(rows()).toHaveLength(STARTER_RULES.length);
    // The pressed button has gone with the empty card: focus moves to the list heading.
    expect(document.activeElement).toBe($("h1"));
    type(host.querySelector('input[type="search"]') as HTMLInputElement, "zzz");
    expect($(".as-empty")?.textContent).toContain("Nothing matches");
    press(button("Clear search"));
    expect(document.activeElement).toBe(host.querySelector('input[type="search"]'));
    expect(rows()).toHaveLength(2);
  });
});
