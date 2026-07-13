# Audit data contract

Versioned local audit records for SEO Audit Workbench (Tickets 102 + 107).
Runtime validation uses Zod; JSON Schema is derived for future exports
(Ticket 402).

## Versions

| Version                                             | Meaning                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| `AUDIT_SCHEMA_VERSION` (`src/lib/schemas/audit.ts`) | Shape of each persisted `AuditSession` record. |
| IndexedDB `DB_VERSION` (`src/lib/storage/db.ts`)    | Object-store layout (stores/indexes).          |
| `DOM_EVIDENCE_SCHEMA_VERSION` (`dom-evidence.ts`)   | Sprint 1 DOM field/payload shapes.             |

Bump `AUDIT_SCHEMA_VERSION` when adding/removing/renaming session fields. Bump
`DB_VERSION` only when creating stores or indexes. Record migrations run on
read: validate → accept, migrate (when a migrator exists), or **quarantine**.

Current session version is **3**. Schema versions **1** and **2** are migrated
in place on load (`migrateAuditSessionToCurrent`): version-1 snapshots receive
documented `captureLimits` defaults and retain the historical DOM-evidence
marker, while historical sessions receive a clear note that check selection was
not recorded before Ticket 210. New captures use DOM evidence version **2** and
validate every persisted DOM source at collection and session-save boundaries.
`SessionRepository.save` additionally refuses DOM evidence that omits or
downgrades `domEvidenceSchemaVersion`; only the migration path may retain the
historical marker for reads.

## DOM capture limits (Ticket 107)

Documented in `src/lib/schemas/dom-limits.ts` and attached to each new
`PageSnapshot.captureLimits`:

| Cap                                | Default   |
| ---------------------------------- | --------- |
| `maxStringChars`                   | 2 000     |
| `maxUrlChars` (document/base URLs) | 8 192     |
| `maxMetaItems` (OG/Twitter)        | 40        |
| `maxAlternateItems`                | 50        |
| `maxJsonLdChars`                   | 50 000    |
| `maxJsonLdScripts`                 | 25        |
| `maxHeadingSamplesPerLevel`        | 5         |
| `maxSnapshotChars`                 | 400 000   |
| `maxSessionChars`                  | 1 500 000 |

When a cap is hit, the field records `limits: { truncated, reason, omittedCount? }`
and a `capture.limits` evidence row summarises which sources were clipped.
JSON-LD that is incomplete because of the character budget uses
`parseStatus: "truncated"` and must not emit `jsonld-malformed`.

Document and base URLs use `maxUrlChars`, not `maxStringChars`. The collector
emits the exact browser `document.URL` / `document.baseURI` so navigation-race
checks compare identity before any clipping. The extension process then bounds
those strings for persistence; when clipped, `document.URL` evidence includes
`bounds: { documentUrl? , baseUri? }` with `truncated`, `reason`, and
`originalLength`. New session writes must declare
`captureLimits.domEvidenceSchemaVersion = 2` and cannot omit or downgrade that
marker to bypass source-specific validation (Ticket 114). Migrated historical
sessions keep version `1` and remain readable without re-validating old payloads.

Ticket 208 evaluates only complete `parseStatus: "ok"` JSON-LD source text.
Its derived inventory is bounded to 200 object nodes and depth 20, and its
`@type`/`@id` values reuse `maxStringChars` (2,000). A limited inventory remains
an explicitly partial observation; truncated source remains unevaluated.

Duplicate title, description, robots, viewport, and canonical values are capped
at `maxMetaItems`; Open Graph and Twitter entries use that same cap. Canonical
and hreflang `href`, resolved URL, and `hreflang` strings use `maxStringChars`.
The retained prefix, original `count`, and `limits.omittedCount` make these
partial captures explicit rather than suggesting complete coverage.

## Core types

### `Evidence`

Browser-captured fact. Compact `value` only — **do not** store full HTML
bodies, cookies, request bodies, or credentials by default. Sprint 1 DOM field
shapes validate via `parseDomFacts` / `FieldStateSchema` before save.

### `Finding`

Derived rule result: `severity`, `category`, `affectedUrl`, `description`,
`evidenceIds`, `recommendation`, `sourceRef`, plus stable `ruleId` and
`capturedAt`. Never created from a missing permission alone.

### `CaptureError`

Unavailable or failed capture (`permission-denied`, `navigation-race`,
`dom-evidence-invalid`, fetch failure, etc.). Shown in the UI as an
explanation, never as a pass/fail finding.

### `PageSnapshot`

One capture of a URL plus its evidence list and optional `captureLimits`.

### `AuditSession`

Session envelope: `tabUrl`, `finalUrl`, `captureTime`, `extensionVersion`,
`featureAvailability`, snapshots, findings, capture errors, and
`reportMarkdown` (Ticket 105), and `checkSelection` (Ticket 210). The latter
records every check that ran plus every skipped check and its reason, so partial
audits and later exports cannot overstate coverage. Preview HTML is never persisted.

## Storage API

`SessionRepository` (`src/lib/storage/session-repository.ts`):

- `save` / `get` / `list` / `delete`
- Invalid or schema-mismatched rows move to the `quarantine` store with a
  human-readable `reason` so the side panel can explain them without crashing.
- Version-1 and version-2 sessions are rewritten to version 3 on successful `get`.

## Network evidence (Ticket 206)

Outbound HTTP(S) uses `safeFetch` (`src/lib/network/`). Results are always
`source: extension-fetch` and must never be stored or shown as browser
navigation. Navigation observation helpers return `unavailable` until Ticket
201 attaches listeners (or the user reloads). Bodies are omitted unless a
caller sets `includeBody` under the byte cap. See `docs/network.md`.

## Privacy invariants

- Local IndexedDB only; no remote sync in this programme.
- Feature availability records what could not run (`'unavailable'`) without
  inventing negative SEO conclusions from absent data.
- Extension fetches omit credentials/cookies; do not persist arbitrary response
  bodies by default.
