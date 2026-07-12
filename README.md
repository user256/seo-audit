# SEO Audit Workbench

A Manifest V3 Chrome extension that inspects the page currently open in the
browser and collects reproducible technical-SEO findings from a side panel. It
is an **interactive inspector, not a site crawler**: every conclusion is traced
back to captured browser evidence, audits are stored locally, and nothing is
sent to a third party.

See [`mini-seo-tech-audit-extension-spec.md`](./mini-seo-tech-audit-extension-spec.md)
for the product concept and [`tickets/overview.md`](./tickets/overview.md) for the
roadmap.

---

## What's in here

```
.
├── README.md              ← you are here
├── mini-seo-tech-audit-extension-spec.md  ← product concept / feature scope
├── private.md             ← local-only notes (gitignored)
├── process_tickets.py     ← closes completed tickets and updates the roadmap
├── tickets/
│   ├── overview.md        ← the roadmap. start here.
│   ├── TICKET_TEMPLATE.md ← copy this when filing a new ticket
│   ├── {id}-{slug}.md     ← one file per ticket
│   └── completed/         ← closed tickets land here automatically
├── src/                   ← extension source (created by Ticket 100/101)
│   ├── manifest.json      ← MV3 manifest
│   ├── background/        ← service worker
│   ├── sidepanel/         ← side-panel UI
│   ├── content/           ← injected page collectors
│   └── lib/               ← schemas, storage, rules, parsers
├── docs/                  ← architecture, rules, privacy/permissions
└── dist/                  ← built, loadable extension (gitignored)
```

The extension code does not exist yet — the repository currently holds the spec
and the ticket workflow. **Ticket 100** stands up the toolchain and **Ticket
101** creates the extension shell.

---

## Status

Sprint 1 (“Inspect One Page”) is active. Toolchain bootstrap (Ticket 100) is in
place; next pick is **Ticket 101 (Extension Shell and Permission Boundary)**.
Track progress in [`tickets/overview.md`](./tickets/overview.md).

---

## Getting started

```bash
npm install
npm run build      # produces dist/
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` directory.
4. Pin the toolbar action and click it to open the side panel.

For live development:

```bash
npm run dev        # rebuilds on change; reload the extension in chrome://extensions
```

> Chrome 114+ is required for the Side Panel API.

## Tests and quality gates

```bash
npm run lint            # ESLint + Prettier
npm test                # unit tests (Vitest) with coverage
npm run build           # type-check + bundle
npm run package:check   # verify the packaged ZIP contents (Ticket 404)
```

These are the gates every ticket must keep green, and CI runs them on every push.

---

## Design principles (working agreements)

These come from [`tickets/overview.md`](./tickets/overview.md) and shape every
ticket:

- A **finding** is always a structured record: severity, category, affected URL,
  description, evidence, recommendation, and a source/best-practice reference.
- Browser-captured **facts** and derived **rules** are stored separately. A
  missing permission or failed fetch is a `CaptureError`, never a pass/fail
  finding.
- **Local-first.** Audits are stored in the browser (IndexedDB). No audit URL,
  page body, or report is sent to a third party in this programme. No telemetry.
- **Least privilege.** Page/network access is requested per-origin at the user's
  action, not declared as blanket `<all_urls>` host access.
- **Honest about limits.** “JavaScript off” and Googlebot-style rendering are
  _comparison experiments_, not a promise to reproduce Google Search. Every
  feature that reloads a page, changes a setting, or attaches a debugger requires
  a user action and an explanation first.

---

## The ticket workflow

Work proceeds as a sequence of **sprints**, each a hundred-block of tickets
(`1xx`, `2xx`, …). `N99` is the sprint review/go-no-go gate.

1. **Read [`tickets/overview.md`](./tickets/overview.md)** for the active sprint
   and recommended next pick.
2. **Pick a ticket**, e.g. [`tickets/100-toolchain-and-ci-bootstrap.md`](./tickets/100-toolchain-and-ci-bootstrap.md).
   Tickets follow [`tickets/TICKET_TEMPLATE.md`](./tickets/TICKET_TEMPLATE.md):
   Context, Goal, Acceptance criteria, Out of scope, Dependencies.
3. **Do the work**, appending decisions to the ticket's “Notes / decisions log”.
4. **Close it:** flip the bullet in `overview.md` from `- [ ]` to `- [x]`.
5. **Run `python process_tickets.py --apply`** to move the file into
   `tickets/completed/` and rewrite the overview files.

### Filing a new ticket

1. Take the next free ID in the sprint's range.
2. Copy `tickets/TICKET_TEMPLATE.md` to `tickets/{id}-{short-slug}.md`.
3. Add the `- [ ] [Ticket {id}: …](./{id}-{slug}.md)` bullet under the right
   sprint in `overview.md` (the exact `- [ ] [label](href)` format is what
   `process_tickets.py` parses — keep it).

### Conventions

- **One ticket, one outcome.** Two goals means two tickets.
- **Out-of-scope is mandatory** — the best defence against scope creep.
- **Follow-up work gets a new ticket**, never silently absorbed.
- **Commits reference ticket IDs:** `tickets: close 101 (extension shell)` or
  `wip 103: add DOM collector`.
- **`main` is always loadable.** WIP lives on branches.

---

## process_tickets.py — quick reference

```bash
python process_tickets.py            # preview changes (dry run, default)
python process_tickets.py --apply    # move files and rewrite the overview
python process_tickets.py --apply --push   # also commit and push
```

See `python process_tickets.py --help` for full options.

---

## Local notes

`private.md` is gitignored — machine-specific paths, the exact commands you run,
environment quirks. Do not put secrets there; real secrets go in `.env` (also
gitignored). `private.md` documents the _shape_ of `.env`, not its values.
