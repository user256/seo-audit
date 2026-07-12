# Ticket 100: Toolchain and CI Bootstrap

**Sprint:** 1 — Inspect One Page
**Status:** Done
**Owner:** unassigned
**Estimate:** M

## Context

Every Sprint 1 ticket already assumes a working toolchain: 101 runs
`npm run lint`, `npm test`, and `npm run build`; 102 tests IndexedDB round trips
against a fake implementation; 105 vendors a pinned Markdown renderer and DOM
sanitizer under the extension CSP; 404 emits a versioned ZIP and runs
`npm run package:check` in CI. None of that exists yet — the repository has a
spec and a ticket workflow but no `package.json`, build, test runner, linter, or
CI. Standing this up once, deliberately, prevents each later ticket from
inventing its own incompatible tooling.

This ticket also ratifies the core stack decisions (language, bundler, schema
validation, test runner) so downstream tickets can reference them instead of
re-litigating them. See **Approach** for the recommended defaults.

## Goal

Establish a reproducible TypeScript build, test, and lint toolchain that produces
a loadable MV3 extension skeleton and runs green in CI.

## Acceptance criteria

- [x] `package.json` defines pinned dev dependencies and the scripts every later
  ticket references: `dev`, `build`, `lint`, `test`, `test:watch`, and
  `package:check` (the last may be a stub that 404 completes).
- [x] `npm install && npm run build` on a clean checkout produces a `dist/`
  directory that loads as an unpacked MV3 extension in Chrome with no console
  errors (a placeholder manifest + empty side panel is sufficient here; 101
  builds the real shell).
- [x] TypeScript is configured `strict`, ESLint + Prettier run over `src/` and
  agree with each other, and `npm run lint` fails on a deliberately introduced
  violation.
- [x] The test runner executes an example unit test with Chrome APIs and
  IndexedDB mockable (e.g. a stub `chrome` global and `fake-indexeddb`), and
  `npm test` reports coverage.
- [x] CI runs `lint`, `test`, and `build` on a clean checkout on every push/PR
  and is green; the workflow file is committed.
- [x] `docs/architecture.md` records the chosen stack, the directory layout, and
  the reproducible-build / no-remote-code constraints that 404 will enforce.

## Out of scope

- The real extension shell, permission flow, or side-panel UI (Ticket 101).
- Data schemas and the session repository (Ticket 102).
- Final release packaging and the full `package:check` allow/deny list
  (Ticket 404) — a stub script that later hardens is acceptable here.
- Choosing production runtime libraries beyond what the skeleton needs to build.

## Dependencies

- **Blocks:** 101–106 (and, transitively, all later tickets)
- **Blocked by:** none
- **External:** Node LTS, a CI runner, a local Chrome for the load test

## Approach

Recommended default stack to ratify (swap individual pieces only with a recorded
reason in the Notes log):

- **Language:** TypeScript, `strict: true`.
- **Bundler:** Vite with an MV3 plugin (e.g. `@crxjs/vite-plugin`) for manifest
  handling and dev reload. If the plugin's maintenance state is a concern, fall
  back to an esbuild build script driven from Node — either way the output must
  be a static, self-contained `dist/` with no remote code, so it satisfies 404.
- **Schema/validation:** Zod for TypeScript-native runtime validation of the
  102 contracts, with JSON Schema generated from it for the 402 export contract.
- **Tests:** Vitest + `fake-indexeddb`, plus a lightweight `chrome` API stub
  shared across tests.
- **Lint/format:** ESLint (typescript-eslint) + Prettier, single config.

Keep the manifest, service worker, side-panel page, and `src/` layout minimal —
just enough to prove the pipeline end to end. The point is a green, reproducible
loop, not features.

## Browser / evidence notes

- **Permissions / APIs touched:** placeholder `manifest.json` only (real
  permissions land in 101). No host permissions requested here.
- **Network behaviour:** none — the skeleton makes no network requests.
- **Fixture coverage:** one example unit test proving the `chrome` stub and
  `fake-indexeddb` wiring work.
- **User disclosure / restore path:** n/a.

## Notes / decisions log

- 2026-07-12 — Filed as the true first pick for Sprint 1: 101 and everything
  after it call npm scripts that do not exist until this ticket lands.
- 2026-07-12 — Ratified stack: TypeScript strict, Vite 6 + `@crxjs/vite-plugin`
  2.7.0, Zod (present for 102), Vitest + fake-indexeddb + chrome stub, ESLint
  flat config + Prettier, GitHub Actions CI. `package:check` is a dist/manifest
  stub pending Ticket 404.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
