# Ticket 305: User-Agent Profiles and Audit Disclosures

**Sprint:** 3 — Bounded Comparisons and Site Checks  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

User-agent switching is a requested essential, but browser-wide spoofing is
risky and an ordinary fetch header is not equivalent to a browser navigation.
The product must expose only behaviour it can describe accurately.

## Goal

Provide clear user-agent profile selection and evidence disclosures for the
features that can actually honour it.

## Acceptance criteria

- [ ] Define built-in profiles (browser default, Googlebot-style, custom) with
  exact UA strings, scope, and method recorded in every affected result.
- [ ] If Ticket 304 ships debugger support, use profiles only in its dedicated
  experiment tab after explicit consent; otherwise offer profiles only for
  clearly-labelled network probes or defer the switcher.
- [ ] UI states when a profile changes an HTTP fetch only, a dedicated rendered
  tab, or nothing; it never implies that the active browser tab was changed when
  it was not.
- [ ] Custom strings are length-limited, local-only, and never automatically
  applied to background browsing.
- [ ] Unit/manual tests prove the reported profile matches the method and that
  cancellation restores the default state.

## Out of scope

- Global browser UA spoofing.
- Pretending to be a search engine crawler in normal browsing.

## Dependencies

- **Blocks:** 399, 402
- **Blocked by:** 301, 304
- **External:** outcome of Ticket 304

