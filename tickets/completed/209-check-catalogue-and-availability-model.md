# Ticket 209: Check Catalogue and Availability Model

**Sprint:** 2 — Crawl and Index Signals
**Status:** Complete
**Owner:** agent/ticket-209-check-catalogue
**Estimate:** M

## Context

Today rules are a flat array run wholesale: `Rule` is only `{ id, run }`
([src/lib/rules/types.ts](../src/lib/rules/types.ts)) and “Start audit” executes
all of `PAGE_RULES` at once. As Sprint 2 adds robots, header, sitemap, hreflang,
and structured-data checks — and Sprint 3 adds opt-in network/experiment probes —
the UI needs to know, per check: what it is, what evidence/permissions it needs,
what it costs, and whether it can run right now. That metadata does not exist,
and without it a selection wizard (Ticket 210) and honest disabled-states are
impossible. This is the enabling primitive, not the UI.

## Goal

Give every check declarative metadata and a resolver that reports which checks
are runnable under the current access and captured-evidence state.

## Acceptance criteria

- [x] Extend the check descriptor with `label`, `description`, `category`,
  `requiredSources` (evidence sources it consumes), `cost` (`dom` | `network` |
  `experiment`), `optIn` (boolean, default false), and a stable `sourceRef`,
  without breaking existing `Finding`/`ruleId` output.
- [x] A single `CHECK_CATALOGUE` is the one registry the audit runner and UI both
  read; the existing `PAGE_RULES` are migrated into it with no change to emitted
  findings (golden tests stay green).
- [x] An `availability(ctx)` resolver returns `available` / `needs-access` /
  `unavailable` per check with a reason, reusing the same access + evidence state
  the dashboard already models — never inventing a pass for an absent source.
- [x] The audit runner accepts an optional set of check IDs; passing none runs
  the full default (non-opt-in) set, preserving today’s one-click behaviour.
- [x] Unit tests cover catalogue completeness (every rule is registered),
  availability for granted/ungranted and present/absent evidence, and that a
  selected-subset run emits exactly the expected findings.

## Out of scope

- Any selection UI (Ticket 210 consumes this).
- Implementing the Sprint 2/3 checks themselves — this only models them.
- Changing severity policy or the finding schema.

## Dependencies

- **Blocks:** 210
- **Blocked by:** 104 (findings engine / rules exist)
- **External:** none

## Approach

Keep it a data refactor. Wrap each existing `Rule` with metadata rather than
rewriting rule logic. The availability resolver should derive from the same
`RuleContext` / evidence map the runner already builds, so “can this run” and
“did this run” never disagree.

## Notes / decisions log

- 2026-07-12 — Filed as the enabling primitive under the dashboard→wizard
  direction. Split from the wizard (210) per one-ticket-one-outcome so the
  data model is testable without any UI.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
