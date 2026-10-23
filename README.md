# Forwarding Desk (redirect manager)

A local notebook of redirect rules: two starter rules, a form to add one (path, destination, status 301/302/307), an
exact-match "check a path" box, a "Generate short path" button (a free `/s/<code>` FROM path, merged from the old
URL shortener) and a removable rule stack. Rules are kept in this browser's `localStorage`. Nothing
is published and nothing redirects.

Live: https://redirect-manager.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No real redirects: no server, CDN, Vercel or `_redirects` config is written.
- Exact path match only: no wildcards, regex, query strings or chain detection.
- No bulk import/export, analytics, domains, account or sync. Clearing site data resets the stack.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: rule logic, local store, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/redirects.ts`: starter rules plus `findRule` (exact match), `addRule` (refuses empty fields, paths without a
  leading `/`, duplicates and self-redirects), `removeRule` and `parseRules` (validates saved state).
- `lib/local-store.ts`: `localStorage` store read through `useSyncExternalStore` (no setState in an effect; falls back
  to memory when storage is blocked). This repository owns its copy.
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint with `get_starter_rules` and `test_path`.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
