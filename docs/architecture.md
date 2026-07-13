# Architecture — SEO Audit Workbench

This document records the stack and layout ratified in Ticket 100. Later tickets
extend behaviour; they should not re-litigate these defaults without a Notes log
entry on the relevant ticket.

## Chosen stack

| Concern             | Choice                                                            | Why                                                                                |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Language            | TypeScript (`strict: true`)                                       | Catch contract mistakes at compile time; matches Zod schemas in 102.               |
| Bundler             | Vite 6 + `@crxjs/vite-plugin`                                     | Manifest-aware MV3 build, HMR in `dev`, static self-contained `dist/`.             |
| Schema / validation | Zod (runtime) → JSON Schema via `zod-to-json-schema` (Ticket 402) | TypeScript-native validation; see `docs/data-contract.md` and `docs/rules.md`.     |
| Tests               | Vitest + `fake-indexeddb` + shared `chrome` stub + axe-core       | Unit tests without a real browser; IndexedDB/Chrome mockable; a11y fixture checks. |
| Lint / format       | ESLint (typescript-eslint flat config) + Prettier                 | Single agreed style; `npm run lint` fails on violations.                           |
| CI                  | GitHub Actions (`lint` → `test` → `build` → `package:check`)      | Clean-checkout gate on every push/PR.                                              |

## Directory layout

```
.
├── manifest.config.ts     ← CRXJS defineManifest (source of truth for MV3)
├── vite.config.ts
├── vitest.config.ts
├── eslint.config.js
├── scripts/
│   └── package-check.mjs  ← stub today; Ticket 404 hardens ZIP allow/deny
├── src/
│   ├── background/        ← service worker
│   ├── sidepanel/         ← side-panel HTML/CSS/TS
│   ├── content/           ← page collectors (Ticket 103+)
│   ├── lib/               ← schemas, storage, rules, parsers
│   └── test/              ← chrome stub + vitest setup
├── docs/                  ← architecture, rules, privacy
└── dist/                  ← loadable unpacked extension (gitignored)
```

## Reproducible build / no-remote-code constraints

These are load-bearing for Ticket 404 packaging and the product privacy promise:

1. **Static, self-contained `dist/`.** The built extension must not fetch remote
   scripts, stylesheets, or fonts. Everything ships inside the package. Load
   **`dist/`** via Chrome “Load unpacked” — there is no ZIP artefact until
   Ticket 404.
2. **Pinned dependencies.** `package-lock.json` is committed; CI uses `npm ci`.
3. **No network at build for runtime assets.** Bundled vendor code (Markdown
   renderer, DOM sanitizer in Ticket 105) is installed from npm and emitted into
   `dist/`, never loaded from a CDN at runtime.
4. **`package:check`.** Today a stub that asserts `dist/manifest.json` is MV3.
   Ticket 404 expands it to ZIP contents allow/deny lists and version stamping.
5. **Host access policy (Ticket 212).** Required HTTP(S) `host_permissions`
   (`http://*/*`, `https://*/*`) so multi-host Sprint 2 fetches avoid a
   per-origin Allow NUX. Unsupported schemes (`chrome://`, `file://`, …) stay
   blocked in `evaluateUrl`. Safe-fetch caps (Ticket 206) still apply — broad
   host access is not unbounded crawling.

## Permission boundary (Ticket 212)

| Surface          | Behaviour                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Toolbar action   | Opens the side panel (`openPanelOnActionClick`).                                                |
| Side panel       | Shows active tab URL, access state, Start audit / ping / refresh.                               |
| Host access      | Declared required `host_permissions` for HTTP(S); no per-origin Allow prompt on the audit path. |
| Unsupported URLs | `chrome://`, `file://`, extension pages, etc. are explained; collect stays hidden.              |
| Content ping     | `chrome.scripting.executeScript` injects a no-op ping and returns `location.href`.              |

## npm scripts (contract for later tickets)

| Script                  | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Vite + CRXJS watch / HMR                           |
| `npm run build`         | `tsc --noEmit` then production bundle into `dist/` |
| `npm run lint`          | ESLint + Prettier check                            |
| `npm test`              | Vitest with coverage                               |
| `npm run test:watch`    | Vitest watch mode                                  |
| `npm run package:check` | Packaging gate (stub until 404)                    |
