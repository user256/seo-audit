# Audit data contract

Versioned local audit records for SEO Audit Workbench (Ticket 102). Runtime
validation uses Zod; JSON Schema is derived for future exports (Ticket 402).

## Versions

| Version                                             | Meaning                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| `AUDIT_SCHEMA_VERSION` (`src/lib/schemas/audit.ts`) | Shape of each persisted `AuditSession` record. |
| IndexedDB `DB_VERSION` (`src/lib/storage/db.ts`)    | Object-store layout (stores/indexes).          |

Bump `AUDIT_SCHEMA_VERSION` when adding/removing/renaming session fields. Bump
`DB_VERSION` only when creating stores or indexes. Record migrations run on
read: validate → accept, migrate (when a migrator exists), or **quarantine**.

## Core types

### `Evidence`

Browser-captured fact. Compact `value` only — **do not** store full HTML
bodies, cookies, request bodies, or credentials by default.

### `Finding`

Derived rule result: `severity`, `category`, `affectedUrl`, `description`,
`evidenceIds`, `recommendation`, `sourceRef`, plus stable `ruleId` and
`capturedAt`. Never created from a missing permission alone.

### `CaptureError`

Unavailable or failed capture (`permission-denied`, fetch failure, etc.).
Shown in the UI as an explanation, never as a pass/fail finding.

### `PageSnapshot`

One capture of a URL plus its evidence list.

### `AuditSession`

Session envelope: `tabUrl`, `finalUrl`, `captureTime`, `extensionVersion`,
`featureAvailability`, snapshots, findings, and capture errors.

## Storage API

`SessionRepository` (`src/lib/storage/session-repository.ts`):

- `save` / `get` / `list` / `delete`
- Invalid or schema-mismatched rows move to the `quarantine` store with a
  human-readable `reason` so the side panel can explain them without crashing.

## Privacy invariants

- Local IndexedDB only; no remote sync in this programme.
- Feature availability records what could not run (`'unavailable'`) without
  inventing negative SEO conclusions from absent data.
