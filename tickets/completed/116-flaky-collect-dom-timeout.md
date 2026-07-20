# Ticket 116: `collect-dom` Session Test Times Out Intermittently Under Parallel Load

**Sprint:** 1 — Inspect One Page
**Status:** Done
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

- [x] The root cause is identified as either (a) genuinely slow setup that needs
      a longer timeout, or (b) avoidable per-test work that can be hoisted or
      stubbed — and the fix matches whichever it is, rather than only raising
      the timeout to mask it. **Determined to be (a), by measurement — see the
      decisions log.**
- [x] `src/lib/collect-dom.test.ts` no longer depends on the default 5s timeout
      being enough under a loaded worker pool.
- [x] The full suite (`npm test`) passes **10 consecutive runs** on a developer
      machine with no failures.
- [x] `npm run lint`, `npm test`, and `npm run build` pass.

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
- 2026-07-20 — **Root cause is (a), established by measurement, not assumed.**
  Instrumented the slow path with a throwaway probe: `document.write` 13.7ms +
  `collectDomFactsInPage` 24.9ms + `SessionRepository` construction 0.1ms +
  fake-indexeddb open/list 8.1ms = **~47ms of a ~374ms test**. The remaining
  ~85% is the check catalogue, schema validation, and IDB writes that are the
  actual subject of the test. There is no meaningful per-test work to hoist,
  stub, or share — so option (b) was ruled out rather than skipped.
- 2026-07-20 — Confirmed the trigger is CPU oversubscription, not a hang. Each
  test file gets its own jsdom environment, so a full run drives load to ~19 on
  a 12-core box; failing runs showed environment setup totals of 61s and 135s
  versus ~12s on clean runs. The three flaky cases are precisely the three
  slowest (374 / 144 / 113ms) — the ones that actually persist a session.
- 2026-07-20 — **Tried capping worker count first and rejected it.**
  `--maxWorkers=4` gave 22.9 / 26.1 / 24.8s versus 12.5 / 21.9 / 25.6s at the
  default: no faster and no more stable, because this box carries sustained
  external load regardless of vitest's pool size. Reducing parallelism would
  have cost wall-clock for no reliability gain.
- 2026-07-20 — Fix: explicit `testTimeout` / `hookTimeout` of 15s in
  `vitest.config.ts`, with the measurements recorded in a comment so the number
  is justified rather than folklore. ~40x headroom over the worst measured case,
  still fast enough to surface a genuinely hung test.
- 2026-07-20 — Added `src/test/vitest-config.test.ts` asserting the explicit
  timeouts remain configured, so a future revert to the 5s default fails loudly
  instead of quietly restoring the flake.
- 2026-07-20 — Verified: **10/10 consecutive full-suite runs green (412 tests)**
  at load average 33 — roughly double the load that produced the original
  failures, so the margin is demonstrated under worse conditions than the bug
  needed.
- 2026-07-20 — Note for whoever reads the original ~40% figure: that rate was
  measured during a back-to-back run loop which was itself generating the load.
  Normal single-run usage would have seen it less often, but CI runners are
  typically smaller and more contended than this box, so the risk there was real
  rather than theoretical.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch.
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
