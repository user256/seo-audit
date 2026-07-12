# Audit data contract

Versioned local audit records for SEO Audit Workbench (Tickets 102, 107 + 110).
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

Current session version is **2**. Schema version **1** sessions from Tickets
102–106 are migrated in place on load (`migrateAuditSessionV1ToV2`): snapshots
receive documented `captureLimits` defaults and remain readable historical
records rather than being quarantined solely because Ticket 107 landed. Their
DOM evidence remains version 1 historical data. New captures use DOM evidence
version **2** and validate every persisted DOM source at both collection and
session-save boundaries.

## DOM capture limits (Tickets 107 + 110)

Documented in `src/lib/schemas/dom-limits.ts` and attached to each new
`PageSnapshot.captureLimits`:

| Cap                         | Default   |
| --------------------------- | --------- |
| `maxStringChars`            | 2 000     |
| `maxMetaItems` (OG/Twitter) | 40        |
| `maxAlternateItems`         | 50        |
| `maxJsonLdChars`            | 50 000    |
| `maxJsonLdScripts`          | 25        |
| `maxHeadingSamplesPerLevel` | 5         |
| `maxLinkInventory`          | 200       |
| `maxImageInventory`         | 100       |
| `maxSnapshotChars`          | 400 000   |
| `maxSessionChars`           | 1 500 000 |

When a cap is hit, the field records `limits: { truncated, reason, omittedCount? }`
and a `capture.limits` evidence row summarises which sources were clipped.
JSON-LD that is incomplete because of the character budget uses
`parseStatus: "truncated"` and must not emit `jsonld-malformed`.

Duplicate title, description, robots, viewport, and canonical values are capped
at `maxMetaItems`; Open Graph and Twitter entries use that same cap. Canonical
and hreflang `href`, resolved URL, and `hreflang` strings use `maxStringChars`.
The retained prefix, original `count`, and `limits.omittedCount` make these
partial captures explicit rather than suggesting complete coverage.

## Core types

### `Evidence`

Browser-captured fact. Compact `value` only — **do not** store full HTML
bodies, cookies, request bodies, or credentials by default. Sprint 1 DOM field
shapes use discriminated source-specific schemas: title/meta/robots/canonical,
hreflang, Open Graph/Twitter, language/viewport, headings, links, images,
HTML5 landmarks, JSON-LD, document URL, and capture-limit evidence. They
validate via `parseDomFacts` before transformation and via `PageSnapshotSchema`
when a new session is saved. A malformed value becomes a readable
`dom-evidence-invalid` capture error; it is never stored as a valid fact.

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
`reportMarkdown` (Ticket 105). Preview HTML is never persisted.

## Storage API

`SessionRepository` (`src/lib/storage/session-repository.ts`):

- `save` / `get` / `list` / `delete`
- Invalid or schema-mismatched rows move to the `quarantine` store with a
  human-readable `reason` so the side panel can explain them without crashing.
- Version-1 sessions are rewritten to version 2 on successful `get`.

## Privacy invariants

- Local IndexedDB only; no remote sync in this programme.
- Feature availability records what could not run (`'unavailable'`) without
  inventing negative SEO conclusions from absent data.
