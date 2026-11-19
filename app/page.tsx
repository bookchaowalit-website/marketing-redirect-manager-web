"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { CODES, CODE_NAMES, STARTER_RULES, STORAGE_KEY, addRule as addTo, errorField, findRule, generateShortPath, removeRule, restoreRule, parseRules, type Code, type Rule } from "@/lib/redirects";
import { createLocalStore } from "@/lib/local-store";

// Browser-only rule stack; the server render and first paint use the starter rules.
const store = createLocalStore(STORAGE_KEY, STARTER_RULES, parseRules);
const TONE: Record<Code, Tone> = { "301": "green", "302": "amber", "307": "grey" };
const SHORT: Record<Code, string> = { "301": "Permanent", "302": "Temporary", "307": "Keeps method" };
type Filter = "All" | Code;
type FieldError = { field: "from" | "to"; message: string } | null;
// index / beforeId / afterId: where it sat in the stored stack when removed. nextShown / prevShown: the rows shown
// around it, for focus after Escape.
type RemovedEntry = { rule: Rule; index: number; beforeId?: string; afterId?: string; nextShown?: string; prevShown?: string };
type RemovedBatch = { items: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (items: RemovedEntry[]) => (items.length === 1 ? `Removed ${items[0].rule.from}` : `Removed ${items.length} rules`);

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const rules = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [code, setCode] = useState<Code>("301");
  const [error, setError] = useState<FieldError>(null);
  const [test, setTest] = useState("/old-blog");
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const focusRowsNext = useRef<string[] | null>(null);
  const wasComposing = useRef(false);

  const needle = query.trim().toLowerCase();
  const visible = rules.filter((rule) => (filter === "All" || rule.code === filter) && (!needle || `${rule.from} ${rule.to}`.toLowerCase().includes(needle)));
  const countOf = (value: Filter) => (value === "All" ? rules.length : rules.filter((rule) => rule.code === value).length);
  const match = findRule(rules, test);
  const title = filter === "All" ? "All rules" : `${filter} · ${CODE_NAMES[filter]}`;

  useEffect(() => {
    if (composing) fromRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  // A removal made from the keyboard moves focus to Undo (the focused Remove button has just gone).
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // When the toast closes after Undo or Escape, focus goes back near the removed row once the list has re-rendered:
  // the first of these rows still shown, else New rule (or the composer's From field when it is open).
  useEffect(() => {
    const ids = focusRowsNext.current;
    if (removed || !ids) return;
    focusRowsNext.current = null;
    const shown = [...document.querySelectorAll<HTMLElement>(".as-row[data-rule]")];
    const row = ids.map((id) => shown.find((entry) => entry.dataset.rule === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".as-danger") ?? newRef.current ?? fromRef.current)?.focus();
  }, [removed, rules]);
  // While the toast shows, reserve its height (plus its 24px offset and a gap) at the bottom of the page and in
  // scroll-padding, so the footer links and anything focused behind it can scroll clear of it.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The Undo toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  function closeComposer() {
    setComposing(false);
    setFrom("");
    setTo("");
    setCode("301");
    setError(null);
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = addTo(rules, { from, to, code }, createId());
    if (result.error !== undefined) {
      const field = errorField({ from, to }, result.error);
      setError({ field, message: result.error });
      (field === "from" ? fromRef : toRef).current?.focus();
      return;
    }
    store.set(result.rules);
    if (filter !== "All" && filter !== code) setFilter(code);
    setQuery("");
    setAnnouncement(`Added ${from.trim()} to ${to.trim()}.`);
    closeComposer();
  }

  function generatePath() {
    const path = generateShortPath(rules);
    if (path === null) {
      setError({ field: "from", message: "Could not find a free short path; try again." });
      return;
    }
    setFrom(path);
    setError(null);
  }

  function remove(rule: Rule, viaKeyboard: boolean) {
    const current = store.getSnapshot();
    const index = current.findIndex((item) => item.id === rule.id);
    if (index < 0) return;
    store.set(removeRule(current, rule.id));
    const shownAt = visible.findIndex((item) => item.id === rule.id);
    const entry: RemovedEntry = {
      rule: current[index],
      index,
      beforeId: current[index + 1]?.id,
      afterId: index > 0 ? current[index - 1].id : undefined,
      nextShown: visible[shownAt + 1]?.id,
      prevShown: shownAt > 0 ? visible[shownAt - 1].id : undefined,
    };
    const items = [...(removedRef.current?.items ?? []), entry];
    setRemoved({ items, viaKeyboard });
    setAnnouncement(`${removedLabel(items)}. Undo is available for a few seconds.`);
  }

  function closeToast(focusIds?: string[]) {
    const last = removedRef.current?.items.at(-1);
    // Dismissed: the row after the removed one, else the one before it.
    focusRowsNext.current = focusIds ?? [last?.nextShown, last?.prevShown].filter((id): id is string => Boolean(id));
    setRemoved(null);
    setToastFocused(false);
  }

  function undo() {
    const items = removedRef.current?.items;
    if (!items?.length) return;
    // Latest removal first, so each rule goes back next to the rules it sat between at the time.
    const next = items.reduceRight((list, { rule, index, beforeId, afterId }) => restoreRule(list, rule, index, { beforeId, afterId }), store.getSnapshot());
    store.set(next);
    // A path re-added meanwhile keeps the new rule: say which ones could not come back.
    const back = items.filter(({ rule }) => next.some((item) => item.id === rule.id));
    const blocked = items.filter(({ rule }) => !next.some((item) => item.id === rule.id));
    const restored = back.length === 0 ? "" : back.length === 1 ? `Restored ${back[0].rule.from}.` : `Restored ${back.length} rules.`;
    const kept = blocked.length === 0 ? "" : `${blocked.map(({ rule }) => rule.from).join(", ")} ${blocked.length === 1 ? "is" : "are"} already in use, so the newer ${blocked.length === 1 ? "rule stays" : "rules stay"}.`;
    setAnnouncement([restored, kept].filter(Boolean).join(" "));
    // Undone: back to the restored row (the latest one, where the user was last).
    closeToast(back.length ? [back[back.length - 1].rule.id] : undefined);
  }

  function restoreExamples() {
    // Read the saved list first: another tab may have added rules since this one drew "No rules yet",
    // and writing the examples over them would lose those rules with no Undo.
    let restored = false;
    store.update((current) => {
      if (current.length > 0) return current;
      restored = true;
      return STARTER_RULES;
    });
    // The example rules are 301 and 302: show them all, whatever list was picked.
    setFilter("All");
    setAnnouncement(restored ? "Restored the example rules." : "Rules were added in another tab, so the example rules were not restored.");
  }

  const lists: { value: Filter; tone?: Tone; label: string }[] = [
    { value: "All", label: "All rules" },
    ...CODES.map((value) => ({ value, tone: TONE[value], label: `${value} ${SHORT[value]}` })),
  ];
  const fieldError = (field: "from" | "to") => (error?.field === field ? error.message : "");

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Redirect Manager" tagline="Write and test path redirects" />

      <div className="as-body">
        <aside className="as-side" aria-label="Lists">
          <h2>Status codes</h2>
          <ul className="as-lists">
            {lists.map(({ value, tone, label }) => (
              <ListButton key={value} label={label} count={countOf(value)} tone={tone} current={filter === value} onSelect={() => setFilter(value)} />
            ))}
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{title}</h1>
              <p aria-live="polite">{visible.length} {visible.length === 1 ? "rule" : "rules"}{needle ? ` matching “${query.trim()}”` : ""}</p>
            </div>
            <div className="as-tools">
              <label className="as-search">
                <span className="as-sr">Search rules</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search paths" />
              </label>
              {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />New rule</button>}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={add} aria-label="New rule" noValidate>
              <div className="rm-from">
                <label className="as-field">From path
                  <input ref={fromRef} value={from} onChange={(event) => { setFrom(event.target.value); if (error?.field === "from") setError(null); }} placeholder="/old-address" spellCheck={false} autoComplete="off" aria-invalid={fieldError("from") ? true : undefined} aria-describedby={fieldError("from") ? "from-error" : "from-hint"} />
                </label>
                <button type="button" className="as-plain" onClick={generatePath}>Generate short path</button>
              </div>
              {fieldError("from") ? <p id="from-error" className="rm-error" role="alert">{fieldError("from")}</p> : <p id="from-hint" className="rm-hint">Starts with /. Or generate a short /s/ path.</p>}
              <label className="as-field">To destination
                <input ref={toRef} value={to} onChange={(event) => { setTo(event.target.value); if (error?.field === "to") setError(null); }} placeholder="/new-address or https://…" spellCheck={false} autoComplete="off" aria-invalid={fieldError("to") ? true : undefined} aria-describedby={fieldError("to") ? "to-error" : undefined} />
              </label>
              {fieldError("to") ? <p id="to-error" className="rm-error" role="alert">{fieldError("to")}</p> : null}
              <div className="as-composer-foot">
                <div className="as-segmented-wrap">
                  <span id="code-label">Status</span>
                  <div className="as-segmented" role="group" aria-labelledby="code-label">
                    {CODES.map((value) => (
                      <button key={value} type="button" aria-pressed={code === value} onClick={() => setCode(value)}>{value}</button>
                    ))}
                  </div>
                </div>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={closeComposer}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!from.trim() || !to.trim()}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {visible.length ? (
            <ul className="as-list" aria-label={title}>
              {visible.map((rule) => (
                <li className="as-row" key={rule.id} data-rule={rule.id}>
                  <div>
                    <h3><span className="rm-path">{rule.from}</span> <span className="rm-arrow" aria-label="to">→</span> <span className="rm-path">{rule.to}</span></h3>
                    <p>{CODE_NAMES[rule.code]} redirect</p>
                  </div>
                  <Pill tone={TONE[rule.code]}>{rule.code}</Pill>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${rule.from}`} onClick={(event) => remove(rule, event.detail === 0)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {needle ? (
                <>
                  <strong>Nothing matches</strong>
                  No rule in {filter === "All" ? "the stack" : `the ${filter} list`} mentions “{query.trim()}”.
                  <div className="rm-empty-actions"><button type="button" className="as-plain" onClick={() => setQuery("")}>Clear search</button></div>
                </>
              ) : rules.length === 0 ? (
                <>
                  <strong>No rules yet</strong>
                  Press New rule to add the first one, or bring back the two example rules.
                  <div className="rm-empty-actions"><button type="button" className="as-plain" onClick={restoreExamples}>Restore example rules</button></div>
                </>
              ) : (
                <><strong>No {filter} rules</strong>Press New rule and pick {filter} as the status to add one.</>
              )}
            </div>
          )}

          <section className="rm-check" aria-labelledby="check-heading">
            <h2 id="check-heading">Check a path</h2>
            <label className="as-field">Request path
              <input value={test} onChange={(event) => setTest(event.target.value)} spellCheck={false} autoComplete="off" placeholder="/old-blog" aria-describedby="check-result" />
            </label>
            <p id="check-result" className="rm-result" aria-live="polite" data-found={match ? "true" : "false"}>
              {match ? (
                <><Pill tone={TONE[match.code]}>{match.code}</Pill> Goes to <span className="rm-path">{match.to}</span></>
              ) : test.trim() ? (
                <><Pill tone="grey">No rule</Pill> No rule matches {test.trim()} exactly.</>
              ) : (
                <>Type a path to see where it goes.</>
              )}
            </p>
          </section>

          <p className="as-note">Saved in this browser only; nothing is published. These are exact-match example rules, not a CDN or server configuration: no wildcards, regex or query strings.</p>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.items)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.items.length === 1 ? "Undo remove" : `Undo remove of ${removed.items.length} rules`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/marketing-redirect-manager-web" />
    </div>
  );
}
