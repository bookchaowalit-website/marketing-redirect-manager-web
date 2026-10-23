# Forwarding Desk (redirect manager) — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `redirect-manager`, evidence Live→Prototype)
> on 2026-10-23.

## What it is

A client-side list of redirect rules (path → destination with a 301/302/307 code) and an exact-match tester, saved in
the visitor's browser.

## Who it is for

A portfolio visitor, or someone sketching which old paths should forward where before writing real config.

## What works today

1. Two starter rules; add a rule with a path, a destination and a status code. The form refuses empty fields, a path
   without a leading `/`, a second rule for the same path and a rule that points a path at itself, and says why.
2. "Check a path" shows the matching rule (exact match, surrounding spaces ignored) or "No route found".
3. "Generate short path" fills the FROM field with a free `/s/<6 characters>` path (base 36, never one already in the
   stack), so a rule can act as a short link. This replaced `marketing-url-shortener-web` on 2026-10-23. It only
   writes a rule here; nothing serves `/s/...` and nothing redirects.
4. Remove any rule. The stack is saved in `localStorage` and restored on reload; corrupt saved data is ignored and
   the starter rules are used.
5. `/api/mcp` answers JSON-RPC with `get_starter_rules` and `test_path` (exact match against the starter rules or
   rules the caller sends). It is stateless and cannot see a visitor's saved rules.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No regex or wildcard rules, no bulk import/export, no chain detection, no click analytics, no domains, no QR codes.
- Nothing is published or enforced: no server, CDN or hosting config is written ("Nothing is published").
- No accounts or sync; no analytics beyond Vercel Analytics and Speed Insights on this page itself.

## Live URL and deploy state

- Live: https://redirect-manager.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-redirect-manager-frontend` is deployed only by CLI. Last production deployment:
  2026-10-23 (CLI, commit b1c02bf, the Next 16.4.2 CVE patch). Its Git link names the old repository
  (`bookchaowalit/bookchaowalit-redirect-manager-frontend`), so a push to `main` does not deploy: the live site lags
  `main` (no Sentry, no duplicate/loop checks, old template MCP route) until the owner reconnects Vercel Git to this
  repository (owner action D9).
- `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project (Sentry project `marketing-redirect-manager-web`, org
  `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
- Absorbed `marketing-url-shortener-web` on 2026-10-23 (owner approval): its short-code logic is the generated short
  path above, its Vercel project is paused and its repository is archived. The MCP route has no short-path tool.
