# Ticket 105: Markdown Report Editor and Safe Preview

**Sprint:** 1 — Inspect One Page  
**Status:** Not started  
**Owner:** unassigned  
**Estimate:** M

## Context

Users need to annotate findings in a portable report. The Notes reference
demonstrates the right interaction model: Markdown source in a textarea,
formatting helpers, debounced local saves, word count, and a separate safe
preview—not a WYSIWYG document model.

## Goal

Provide a local-first Markdown report editor attached to an audit session.

## Acceptance criteria

- [ ] The editor supports Markdown source, word count, debounced autosave, and
  toolbar/shortcut helpers for headings, bold, italic, inline/block code,
  lists, links, and tables while preserving selection.
- [ ] Source/preview toggle renders Markdown with a pinned local renderer and
  sanitises it with a pinned local DOM sanitizer before insertion into the DOM.
- [ ] Preview links open in a new tab with `rel="noopener noreferrer"`; scripts,
  forms, styles, event attributes, unsafe URL schemes, and arbitrary HTML do
  not survive sanitisation.
- [ ] Markdown is the only persisted report representation; preview HTML is
  regenerated on demand.
- [ ] Unit tests cover formatting selection, autosave debounce, empty preview,
  and hostile Markdown/HTML payloads.

## Out of scope

- Collaborative editing or cloud notes sync.
- Rich-text editing, attachments, or embedded remote images.
- Markdown export (Ticket 402).

## Dependencies

- **Blocks:** 402
- **Blocked by:** 102, 104
- **External:** vendored, version-pinned Markdown renderer and DOM sanitizer

## Approach

Follow the Notes editor pattern, but package dependencies locally and prohibit
remote font/library loading under the extension CSP. Store report text on the
session object and mark it dirty independently of captured audit data.

