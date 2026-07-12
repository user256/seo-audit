# Project rules — SEO Audit Workbench

Operating rules for this repo specifically. They override default behaviour and
apply in every session/instance working here. See also the global
`~/.claude/CLAUDE.md` for cross-project abilities.

## What this project is

A Manifest V3 Chrome extension that inspects the active browser tab and records
reproducible technical-SEO findings locally. Interactive inspector, **not** a
crawler. Read `mini-seo-tech-audit-extension-spec.md` for scope and
`tickets/overview.md` for the roadmap before starting work.

## Product invariants (do not violate without a ticket)

These are load-bearing promises, not preferences:

- **Least privilege.** Request page/network access per-origin at the user's
  action. Never add `<all_urls>` or a blanket host permission to the baseline
  manifest.
- **Local-first, no exfiltration.** Audits live in the browser (IndexedDB). No
  audit URL, page body, or report leaves the machine. No telemetry, no remote
  analytics, no remote scripts/fonts under the extension CSP.
- **Facts vs. rules stay separate.** A missing permission or failed fetch is a
  `CaptureError`, never a pass/fail finding. Don't turn absent data into a
  negative result.
- **Honest about limits.** Rendering / "JS off" / Googlebot-style features are
  disclosed comparison experiments, never claims of crawler parity. Anything
  that reloads a page, changes a setting, or attaches a debugger needs a user
  action and an up-front explanation, and must restore state on completion/error.

## Git & version-control workflow

### 1. Push on every completed major ticket/feature

When a ticket is **logically complete** (implemented + verified — lint/tests
green and load-unpacked smoke-checked), commit and push. Don't let finished work
sit only on the dev box. Small follow-ups can batch; a finished feature is a push.

- Branch first if on `main` (`main` is always loadable).
- **Commit messages: a single summary line, no `Co-Authored-By` or "Generated
  with" trailer** (per the global rules). Reference ticket IDs, e.g.
  `tickets: close 101 (extension shell)` or `wip 103: add DOM collector`.
- **Before pushing, check for tracked secrets.** `.env`, `private.md`, and
  `tools.md` must stay untracked (they're gitignored). If any secret file is
  tracked, untrack + rotate it and confirm with the user before pushing.

### 2. Ask about merging when a branch is complete

Once a feature branch is mergeable, proactively ask whether to merge it. Don't
leave a finished branch unmerged and unmentioned.

### 3. Don't test against a stale build

The extension analogue of "prod drift": `chrome://extensions` keeps running the
**last built `dist/`**, not your edited source. After changing source, rebuild
(`npm run build` / `npm run dev`) **and reload the unpacked extension** before
concluding a change works — a source edit that isn't in `dist/` is not "done".
Before release, the packaged ZIP (Ticket 404) must be rebuilt from source, not
from a hand-patched `dist/`. Verify the change is actually in the reloaded
extension (check the built output or a known marker), then ask the user to test.

### 4. Ship a test with every change

New extension behaviour ships with at least one test on the existing harness
(Vitest + mocked Chrome APIs + `fake-indexeddb`), unless the change is non-code.
Keep the lint/test/build gates green and let CI run them on every push.

## See also

- `tickets/` — sprint roadmap, ticket template, closure conventions
  (`process_tickets.py`).
- `docs/` — architecture, rule catalogue, privacy/permissions rationale.
- Global `~/.claude/CLAUDE.md` — cross-project abilities + cross-instance notes.
