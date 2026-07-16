# Operator gate runbook — one sitting to unblock Sprints 1–3

**Why this exists (2026-07-16):** every implementation ticket through Sprint 3
is merged, but the programme cannot legitimately enter Sprint 4 because four
gate tickets are waiting on *manual browser checks only an operator can run*:
**109 → 199** (Sprint 1), **299** (Sprint 2), and **399** (Sprint 3). This file
consolidates all outstanding manual steps so one person can clear them in a
single session instead of chasing four ticket files.

## Setup (once)

1. `npm run build` from a clean `main` checkout; note the commit hash.
2. Create a **fresh Chrome 114+ profile**.
3. `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.
4. Keep this file open; initial/date each block as you go, then paste results
   into the ticket named in that block.

---

## Block A — Sprint 1 smoke, remaining rows (Ticket 109)

Run rows **5–9** of [`sprint-1-smoke.md`](./sprint-1-smoke.md) (rows 1–4 have
recorded evidence):

- [ ] 5. Close and reopen the side panel: session/findings still available.
- [ ] 6. Report editor: edit Markdown, preview strips images/raw HTML,
  autosave status updates.
- [ ] 7. Start a second audit while typing/mid-debounce: prior Markdown does
  not overwrite the new session.
- [ ] 8. Navigate the audited tab during collection: capture error
  (`navigation-race` or equivalent), not a false finding.
- [ ] 9. Keyboard pass: tab order, focus rings, findings `<summary>` toggle,
  report focus return.

Record in `docs/sprint-1-smoke.md`, then tick the two open boxes in Ticket 109.

## Block B — Sprint 1 go/no-go (Ticket 199)

- [ ] Demonstrate the journey on **two public pages** and **one unsupported
  URL** (`chrome://…`), including a permission-denial and collector-failure
  path. (Whiskipedia + Milroys interim evidence exists; a fresh pass on the
  current build is what the ticket needs.)
- [ ] Inspect IndexedDB (DevTools → Application → Storage): confirm no
  credentials, cookies, form values, or persisted preview HTML.
- [ ] Record Go/No-Go in Ticket 199; file defects as new tickets.

## Block C — Sprint 2 go/no-go (Ticket 299)

- [ ] Run the crawl/index flow against three public sites: one **normal**, one
  **robots-blocked** page, one **redirected** URL.
- [ ] Confirm every capture error is presented as unavailable data, never as a
  passed check.
- [ ] Confirm parser limits and raw-evidence retention match
  `docs/network.md` / the privacy agreement.
- [ ] **Ticket 214 addendum:** open the panel on a public site and confirm the
  page does **not** reload while robots/sitemap slots fill in silently.
- [ ] Record Go/No-Go in Ticket 299.

## Block D — Sprint 3 review (Ticket 399)

The repository review is already recorded in the ticket; the operator half is:

- [ ] Run the Ticket 303 manual matrix: comparison tab closes on success,
  cancellation, load failure, and panel closure.
- [ ] Read the pre-run and result disclosures for 301 (URL variants), 302
  (soft-404), 303 (CSS-off), 305 (UA profiles) in the side panel; flag any
  copy that overclaims.
- [ ] Confirm or change the provisional keep/defer calls (301 keep, 302 keep,
  303 keep CSS-off only, 304 defer, 305 keep network-probe-only).
- [ ] Record keep/defer/remove + Go/No-Go in Ticket 399; file follow-ups.

---

## After the sitting

1. Tick the acceptance boxes and set **Status: Done** in 109, 199, 299, 399
   (or file remediation tickets and record No-Go).
2. Update `tickets/overview.md` checkboxes and the programme status table.
3. Commit as `tickets: record operator gates (109/199/299/399)`.
4. Sprint 4 (401 → 402/403 → 404 → 499) is then legitimately unblocked.
