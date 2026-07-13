# Sprint 1 smoke checklist (Ticket 109)

Operator record for verifying the load-unpacked extension before Ticket 199.
Automated gates are filled from the implementing machine; browser steps need a
fresh Chrome 114+ profile.

## Automated gates

Recorded **2026-07-13** on the Sprint 1 gate remediation branch
(`agent/sprint-1-gate-113-115`):

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `npm run lint`          | pass                                                   |
| `npm test`              | pass (27 files / 121 tests)                            |
| `npm run build`         | pass (`dist/` emitted)                                 |
| `npm run package:check` | pass (stub: MV3 `dist/manifest.json` only; **no ZIP**) |

Notes:

- Axe colour-contrast is **disabled** under JSDOM; token AA ratios are asserted
  in `src/sidepanel/a11y.test.ts` (see `docs/accessibility.md`).
- Packaging ZIP allow/deny remains Ticket 404.

## Browser smoke (fresh Chrome profile)

Load **`dist/`** via `chrome://extensions` → Developer mode → Load unpacked.

| #   | Step                                                                                                             | Pass? | Notes                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| 1   | Unsupported URL (`chrome://extensions`): phase “Unsupported tab”; Allow/Start hidden                             | ☑    | 2026-07-13: `State: Unsupported tab`; Access “Not available”; chrome:// copy; only Refresh.    |
| 2   | HTTPS page without grant: “Allow this site” visible; Start audit hidden/disabled appropriately                   | ☑    | 2026-07-13 milroys: Permission required; Allow+Refresh only; needs-access placeholders.        |
| 3   | Deny permission prompt: status explains denial; no findings invented                                             | ☑    | 2026-07-13 solarcapture.io: “Permission was not granted.”; Allow+Refresh; needs-access glance. |
| 4   | Grant origin: Start audit available; collect produces findings + local session                                   | ☑    | See interim evidence below (whiskipedia).                                                      |
| 5   | Close and reopen side panel: session/findings still available for the same audit flow                            | ☐     |                                                                                                |
| 6   | Open report: edit Markdown, preview strips images/raw HTML, autosave status updates                              | ☐     |                                                                                                |
| 7   | Start a second audit while typing (or mid-debounce): prior Markdown does not overwrite the new session           | ☐     |                                                                                                |
| 8   | Navigate the audited tab during collection: `navigation-race` (or equivalent) capture error, not a false finding | ☐     |                                                                                                |
| 9   | Keyboard: Tab order, focus rings, findings `<summary>` toggle, report focus return                               | ☐     |                                                                                                |

Operator: **\*\***\_\_\_\_**\*\*** Date: **\_\_\_\_** Chrome version: **\_\_\_\_**

### Interim evidence (2026-07-13) — not a full Ticket 109 close

Operator paste against **https://whiskipedia.com/** after loading rebuilt `dist/` from
`fix/checkselection-undefined-crash` (includes checkSelection crash fix +
JSON-LD `@id` reference inventory fix):

- Access granted for `https://whiskipedia.com`; Start audit available.
- Collect saved: `Audit saved for https://whiskipedia.com/ · 11 checks run, 0 skipped`.
- Glance populated (title, canonical, meta robots, headings, links/images, landmarks).
- Network / robots slots stay unavailable; indexability stays `unknown` with the
  honest “DOM meta robots alone is insufficient” copy (Sprint 2 not claimed).
- Findings: **0** after the duplicate-`@id` false-positive fix (earlier run had
  two `jsonld-duplicate-id` warnings that counted publisher `{ "@id": … }`
  references as definitions).
- Second public page (same session walk): **https://milroysofsoho.com/** —
  pre-grant UI as above; after grant, saved audit `11 checks run, 0 skipped`,
  findings `title-duplicate` + `images-empty-alt-advisory`, indexability
  unknown. Supports Ticket 199’s “two public pages” once full 109 closes.

Remaining rows 5–9 still need a deliberate pass (ideally fresh profile)
before Ticket 109 / 199 can close.

## Attach to Ticket 199

Copy this completed table (or link this file + operator initials) into
`tickets/199-sprint-1-review.md` Notes when running the go/no-go demonstration.
