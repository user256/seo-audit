# Ticket {ID}: {Short title}

**Sprint:** {Sprint number and theme, e.g. "1 — Foundation"}
**Status:** {Not started | In progress | Blocked | In review | Done}
**Owner:** {Name or @handle, or "unassigned"}
**Estimate:** {Rough size — S / M / L, or hours/days. Be honest.}

---

## Context

Why this audit capability is needed and which evidence, user flow, or risk it
affects. State the Chrome/MV3 constraint when relevant. Link prior tickets,
fixtures, or decisions.

## Goal

A single sentence describing the outcome. If you need more than one sentence, this is probably two tickets.

> Example: *"The active-page collector captures canonical and robots-meta facts
> into a validated session without treating inaccessible data as a pass."*

## Acceptance criteria

Concrete, checkable conditions. Each one should be something a reviewer can verify by running the code or reading the diff — not a vibe.

- [ ] {Specific browser behaviour and its permission/scope boundary}
- [ ] {Evidence captured, its limits, and the structured result/finding it supports}
- [ ] {Exact test command and fixture/manual test that proves the behaviour}
- [ ] {Docs updated — rules, privacy/permissions, architecture, or roadmap}

## Out of scope

What this ticket explicitly does **not** do. This is as important as the goal — it stops scope creep mid-implementation.

- {Thing that might look like it belongs here but doesn't}
- {Future work this enables but doesn't deliver}

## Dependencies

- **Blocks:** {tickets that can't start until this is done, or "none"}
- **Blocked by:** {tickets that must finish first, or "none"}
- **External:** {APIs, credentials, datasets, model access, decisions from outside the team}

## Approach (optional)

Sketch of how you plan to implement it. Keep it short — this is a working note, not a design doc. If the approach needs a full design doc, link it.

## Browser / evidence notes (if applicable)

Fill in any that apply, delete the rest:

- **Permissions / APIs touched:** {manifest and Chrome API changes}
- **Network behaviour:** {origins, methods, caps, authentication/cookie policy}
- **Evidence contract:** {schema fields, source, size limits, retention}
- **Fixture coverage:** {files and edge cases}
- **User disclosure / restore path:** {for reloads, settings, debugger, or UA changes}

## Notes / decisions log

Append-only. Record decisions made during implementation, especially ones that change the original plan. Useful for the review ticket at the end of the sprint.

- {date} — {decision or finding}

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
