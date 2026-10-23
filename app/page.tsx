"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { CODES, STARTER_RULES, STORAGE_KEY, addRule as addTo, findRule, generateShortPath, isCode, parseRules, removeRule, type Code } from "@/lib/redirects";
import { createLocalStore } from "@/lib/local-store";

// Browser-only rule stack; the server render and first paint use the starter rules.
const store = createLocalStore(STORAGE_KEY, STARTER_RULES, parseRules);
const CODE_LABELS: Record<Code, string> = { "301": "301 / permanent", "302": "302 / temporary", "307": "307 / preserve method" };

export default function Home() {
  const rules = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [code, setCode] = useState<Code>("301");
  const [test, setTest] = useState("/old-blog");
  const [error, setError] = useState("");
  const match = findRule(rules, test);

  function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = addTo(rules, { from, to, code }, crypto.randomUUID());
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }
    store.set(result.rules);
    setError("");
    setFrom("");
    setTo("");
  }

  function generatePath() {
    const path = generateShortPath(rules);
    if (path === null) {
      setError("Could not find a free short path; try again.");
      return;
    }
    setFrom(path);
    setError("");
  }

  return (
    <main className="forward-shell">
      <div className="forward-sheet">
        <header className="forward-masthead">
          <div className="forward-brand">
            <span className="forward-mark" aria-hidden="true">FD</span>
            <span>FORWARDING DESK</span>
          </div>
          <div className="forward-station">
            <span>STATION 02</span>
            <span>LOCAL SORT</span>
          </div>
        </header>

        <section className="forward-hero">
          <div>
            <h1>
              Send the old address
              <br />
              <em>somewhere useful.</em>
            </h1>
            <p>
              Keep a clean set of path rules, test one address against the stack,
              and know exactly where the next request lands.
            </p>
          </div>
          <div className="forward-stamp" aria-label="Local only">
            <span>LOCAL</span>
            <strong>NO<br />SERVER</strong>
          </div>
        </section>

        <section className="forward-ledger">
          <div className="forward-compose">
            <div className="forward-section-head">
              <span className="forward-index">A / WRITE</span>
              <span>{rules.length.toString().padStart(2, "0")} rules in stack</span>
            </div>
            <h2>Write a forwarding label</h2>
            <form className="forward-form" onSubmit={addRule}>
              <div className="forward-from">
                <label>
                  <span>FROM PATH</span>
                  <input
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    placeholder="/old-address"
                    spellCheck={false}
                    aria-describedby="from-hint"
                  />
                </label>
                <button className="forward-generate" type="button" onClick={generatePath}>
                  Generate short path
                </button>
                <span id="from-hint" className="forward-hint">Or let the desk issue a /s/ code.</span>
              </div>
              <label>
                <span>TO DESTINATION</span>
                <input
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="/new-address"
                  spellCheck={false}
                />
              </label>
              <label className="forward-code">
                <span>STATUS</span>
                <select value={code} onChange={(event) => isCode(event.target.value) && setCode(event.target.value)}>
                  {CODES.map((value) => <option key={value} value={value}>{CODE_LABELS[value]}</option>)}
                </select>
              </label>
              <button className="forward-submit" type="submit">Add to stack</button>
            </form>
            {error ? <p className="forward-note" role="alert">{error}</p> : null}
            <p className="forward-note">Stored in this browser only. Nothing is published.</p>
          </div>

          <aside className="forward-test">
            <div className="forward-section-head">
              <span className="forward-index">B / TEST</span>
              <span>Exact match</span>
            </div>
            <h2>Check a path</h2>
            <label className="forward-test-input">
              <span>REQUEST PATH</span>
              <input value={test} onChange={(event) => setTest(event.target.value)} spellCheck={false} />
            </label>
            <div className={"forward-result " + (match ? "is-found" : "is-empty")}>
              <span className="forward-result-label">{match ? "ROUTE FOUND" : "NO ROUTE FOUND"}</span>
              {match ? (
                <strong>{match.code} <span>to</span> {match.to}</strong>
              ) : (
                <strong>Try a path from the stack.</strong>
              )}
            </div>
          </aside>
        </section>

        <section className="forward-stack" aria-labelledby="stack-title">
          <div className="forward-section-head">
            <span className="forward-index">C / SORT</span>
            <span>{rules.length} local records</span>
          </div>
          <h2 id="stack-title">The forwarding stack</h2>
          <ul className="forward-rules">
            {rules.map((rule, index) => (
              <li key={rule.id} className="forward-rule">
                <span className="forward-rule-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="forward-rule-code">{rule.code}</span>
                <span className="forward-rule-path">{rule.from}</span>
                <span className="forward-rule-arrow">to</span>
                <span className="forward-rule-path forward-rule-destination">{rule.to}</span>
                <button
                  className="forward-delete"
                  type="button"
                  aria-label={"Remove " + rule.from}
                  onClick={() => store.update((current) => removeRule(current, rule.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="forward-honesty">
            A working portfolio desk, not a CDN or server configuration. Rules are
            exact-match examples and stay local to this page.
          </p>
        </section>

        <footer className="forward-footer">
          <span>BOOK / DEV TOOLS</span>
          <span>WRITE · TEST · SORT</span>
        </footer>
      </div>
    </main>
  );
}
