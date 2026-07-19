# Ticket 116: `collect-dom` Session Test Times Out Intermittently Under Parallel Load

**Sprint:** 1 — Inspect One Page
**Status:** Not started
**Owner:** unassigned
**Estimate:** S

---

## Context

Found while running the full suite repeatedly to verify Ticket 215. The suite is
green most of the time, but `src/lib/collect-dom.test.ts` intermittently fails:

```
FAIL  src/lib/collect-dom.test.ts > collectDomForActiveTab > saves a session when access is granted
Error: Test timed out in 5000ms.
 ❯ src/lib/collect-dom.test.ts:67:3
```

Observed **4 failing runs out of 10 consecutive full-suite runs** on an
otherwise unchanged tree — a ~40% red rate. The blast radius varies between runs
(1 to 4 failures), and three distinct cases in the same file have been seen to
fail this way:

- `saves a session when access is granted` (most frequent)
- `runs and records exactly the selected subset of checks`
- `saves a valid documentUrl longer than maxStringChars without dom-evidence-invalid`

Run `src/lib/collect-dom.test.ts` on its own and it passes 11/11 every time,
taking ~728ms for the slowest case.

The failing runs report very high environment setup totals (`environment 61.73s`
and `135.25s` versus ~12s on clean runs), so this reads as the default 5s
`testTimeout` being exceeded because of worker contention during JSDOM
environment setup plus `fake-indexeddb` seeding — not a product defect. The test
is already the slowest in the file by a wide margin.

This is pre-existing and unrelated to Ticket 215 (whose diff touches only
`src/lib/dashboard/hydrate-crawl-signals.ts`). It matters because CI runs the
same suite on every push, so roughly **two pushes in five** go red for no real
reason — and a suite that cries wolf is a suite people stop reading. It also
directly undermines the "lint/tests green" evidence that Tickets 109/199 and the
other gate tickets are meant to record.

## Goal

The full test suite passes deterministically, without the `collect-dom` session
tests failing on timing under parallel load.

## Acceptance criteria

- [ ] The root cause is identified as either (a) genuinely slow setup that needs
      a longer timeout, or (b) avoidable per-test work that can be hoisted or
      stubbed — and the fix matches whichever it is, rather than only raising
      the timeout to mask it.
- [ ] `src/lib/collect-dom.test.ts` no longer depends on the default 5s timeout
      being enough under a loaded worker pool.
- [ ] The full suite (`npm test`) passes **10 consecutive runs** on a developer
      machine with no failures.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass.

## Out of scope

- Rewriting the `fake-indexeddb` harness or the session-store test strategy
  generally — only the timing fragility of these cases.
- Reducing overall suite runtime as a performance goal in its own right.
- Any change to `collectDomForActiveTab` product behaviour; the tests pass in
  isolation, so the code under test is not implicated.

## Dependencies

- **Blocks:** 404 (release packaging should not certify quality gates that go
  red intermittently); makes every other ticket's "tests green" claim noisier
- **Blocked by:** —
- **External:** —

## Approach (optional)

First measure: instrument where the ~728ms goes in the isolated case. If it is
dominated by fixed setup, hoist it into `beforeAll` or share it across cases. If
it is irreducible, set an explicit per-test or per-file timeout with a comment
explaining the measured budget, so the number is justified rather than guessed.
Check whether `vitest`'s pool size is worth capping in CI as well.

## Browser / evidence notes (if applicable)

- **Permissions / APIs touched:** none.
- **Fixture coverage:** existing `collect-dom.test.ts` cases; no new fixture.

## Notes / decisions log

- 2026-07-19 — Filed while verifying Ticket 215. Failure captured verbatim
  above; reproduced 4/10 full-suite runs, 0/several isolated runs. Deliberately
  filed rather than absorbed into 215, whose diff is unrelated.
- 2026-07-19 — Rate revised upward from an initial 3/8 estimate after further
  runs; the failing-case set is wider than first recorded (three cases, not
  one). Treat ~40% as the working figure, not a rare blip.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch.
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
