"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { CODES, CODE_NAMES, STARTER_RULES, STORAGE_KEY, addRule as addTo, errorField, findRule, generateShortPath, removeRule, restoreRule, parseRules, type Code, type Rule } from "@/lib/redirects";
import { createLocalStore } from "@/lib/local-store";

// Browser-only rule stack; the server render and first paint use the starter rules.
const store = createLocalStore(STORAGE_KEY, STARTER_RULES, parseRules);
const TONE: Record<Code, Tone> = { "301": "green", "302": "amber", "307": "grey" };
const SHORT: Record<Code, string> = { "301": "Permanent", "302": "Temporary", "307": "Keeps method" };
type Filter = "All" | Code;
type FieldError = { field: "from" | "to"; message: string } | null;

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
  const [removed, setRemoved] = useState<{ rule: Rule; index: number } | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
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
  // The Undo toast closes 6 s after the latest removal, but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => setRemoved(null), 6000);
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

  function remove(rule: Rule) {
    const index = rules.findIndex((item) => item.id === rule.id);
    store.update((current) => removeRule(current, rule.id));
    setRemoved({ rule, index });
    setAnnouncement(`Removed ${rule.from}. Undo is available for a few seconds.`);
  }

  function undo() {
    if (!removed) return;
    store.update((current) => restoreRule(current, removed.rule, removed.index));
    setAnnouncement(`Restored ${removed.rule.from}.`);
    setRemoved(null);
    setToastFocused(false);
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
                <li className="as-row" key={rule.id}>
                  <div>
                    <h3><span className="rm-path">{rule.from}</span> <span className="rm-arrow" aria-label="to">→</span> <span className="rm-path">{rule.to}</span></h3>
                    <p>{CODE_NAMES[rule.code]} redirect</p>
                  </div>
                  <Pill tone={TONE[rule.code]}>{rule.code}</Pill>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${rule.from}`} onClick={() => remove(rule)}>Remove</button>
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
                  <div className="rm-empty-actions"><button type="button" className="as-plain" onClick={() => store.set(STARTER_RULES)}>Restore example rules</button></div>
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
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") { setRemoved(null); setToastFocused(false); } }}
        >
          <span>Removed {removed.rule.from}</span>
          <button type="button" className="as-plain" onClick={undo} aria-label="Undo remove">Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/marketing-redirect-manager-web" />
    </div>
  );
}
