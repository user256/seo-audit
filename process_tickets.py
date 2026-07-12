#!/usr/bin/env python3
"""Process completed tickets.

Reads tickets/overview.md, finds tickets marked `- [x] ...`, and:
- Removes those bullets from overview.md.
- If every ticket under a sprint heading is `- [x]`, removes the whole sprint
  section from overview.md and appends it to tickets/completed/overview.md.
- Appends partial-completion bullets under their sprint heading in
  tickets/completed/overview.md.
- Moves matching ticket files (tickets/{id}-*.md) into tickets/completed/.

Defaults to a dry run. Pass --apply to actually modify files. Pass --push to
also commit and push (only honoured with --apply).

Usage:
    python process_tickets.py                  # dry run, show what would change
    python process_tickets.py --apply          # rewrite files and move tickets
    python process_tickets.py --apply --push   # also git add/commit/push
    python process_tickets.py --json           # machine-readable output
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TICKETS_DIR = ROOT / "tickets"
COMPLETED_DIR = TICKETS_DIR / "completed"
OVERVIEW = TICKETS_DIR / "overview.md"
COMPLETED_OVERVIEW = COMPLETED_DIR / "overview.md"

TICKET_LINE_RE = re.compile(
    r'^(?P<indent>\s*)-\s*\[(?P<box>[ xX])\]\s*'
    r'\[(?P<label>[^\]]+)\]\((?P<href>[^)]+)\)\s*$'
)
DEFAULT_SPRINT_PATTERN = r'^#\s+Sprint\s+\d+\b'
TOP_HEADING_RE = re.compile(r'^#\s+')

PROTECTED_BRANCHES = {"main", "master", "trunk", "production", "prod"}


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def ticket_id_from_href(href: str) -> str | None:
    name = href.rsplit('/', 1)[-1]
    m = re.match(r'^(\d+)-.+\.md$', name)
    return m.group(1) if m else None


def split_top_sections(text: str) -> list[tuple[str | None, list[str]]]:
    sections: list[tuple[str | None, list[str]]] = []
    heading: str | None = None
    body: list[str] = []
    for line in text.splitlines(keepends=True):
        if TOP_HEADING_RE.match(line):
            if heading is not None or body:
                sections.append((heading, body))
            heading = line
            body = []
        else:
            body.append(line)
    if heading is not None or body:
        sections.append((heading, body))
    return sections


def render_sections(sections: list[tuple[str | None, list[str]]]) -> str:
    out: list[str] = []
    for heading, body in sections:
        if heading is not None:
            out.append(heading)
        out.extend(body)
    return ''.join(out)


def is_sprint_heading(heading: str | None, sprint_re: re.Pattern[str]) -> bool:
    return heading is not None and bool(sprint_re.match(heading))


def classify_ticket_lines(
    body: list[str],
) -> tuple[list[str], list[str], list[tuple[str, str]], int]:
    """Return (kept_lines, completed_lines, completed_id_title_pairs, total)."""
    kept: list[str] = []
    completed: list[str] = []
    completed_pairs: list[tuple[str, str]] = []
    total = 0
    for line in body:
        m = TICKET_LINE_RE.match(line.rstrip('\n'))
        if m:
            total += 1
            if m.group('box').lower() == 'x':
                tid = ticket_id_from_href(m.group('href'))
                title = m.group('label')
                if tid:
                    completed_pairs.append((tid, title))
                completed.append(line)
            else:
                kept.append(line)
        else:
            kept.append(line)
    return kept, completed, completed_pairs, total


def collect_todo_ids(body: list[str]) -> list[str]:
    ids: list[str] = []
    for line in body:
        m = TICKET_LINE_RE.match(line.rstrip('\n'))
        if m and m.group('box').lower() != 'x':
            tid = ticket_id_from_href(m.group('href'))
            if tid:
                ids.append(tid)
    return ids


# ---------------------------------------------------------------------------
# Section mutation
# ---------------------------------------------------------------------------


def append_bullets_under_tickets_marker(
    body: list[str], lines: list[str]
) -> list[str]:
    body = list(body)
    for i, ln in enumerate(body):
        if ln.strip() == '**Tickets:**':
            j = i + 1
            while j < len(body) and TICKET_LINE_RE.match(body[j].rstrip('\n')):
                j += 1
            body[j:j] = lines
            return body
    if body and not body[-1].endswith('\n'):
        body[-1] = body[-1] + '\n'
    body.extend(['\n', '**Tickets:**\n', *lines])
    return body


def upsert_partial_completion(
    completed_sections: list[tuple[str | None, list[str]]],
    heading: str,
    completed_lines: list[str],
) -> None:
    for i, (h, body) in enumerate(completed_sections):
        if h == heading:
            completed_sections[i] = (
                h,
                append_bullets_under_tickets_marker(body, completed_lines),
            )
            return
    new_body = ['\n', '**Tickets:**\n', *completed_lines, '\n']
    completed_sections.append((heading, new_body))


def upsert_closed_sprint(
    completed_sections: list[tuple[str | None, list[str]]],
    heading: str,
    full_body: list[str],
) -> None:
    prior_ticket_lines: list[str] = []
    prior_index: int | None = None
    for i, (h, body) in enumerate(completed_sections):
        if h == heading:
            prior_index = i
            prior_ticket_lines = [
                ln for ln in body if TICKET_LINE_RE.match(ln.rstrip('\n'))
            ]
            break

    body = list(full_body)
    if prior_ticket_lines:
        for i, ln in enumerate(body):
            if ln.strip() == '**Tickets:**':
                body[i + 1:i + 1] = prior_ticket_lines
                break

    if not any('**Status:** Closed' in ln for ln in body):
        for i, ln in enumerate(body):
            if ln.strip():
                body[i:i] = ['**Status:** Closed\n', '\n']
                break
        else:
            body.insert(0, '**Status:** Closed\n')

    if prior_index is not None:
        completed_sections[prior_index] = (heading, body)
    else:
        completed_sections.append((heading, body))


# ---------------------------------------------------------------------------
# File operations
# ---------------------------------------------------------------------------


def atomic_write_text(path: Path, content: str) -> None:
    """Write atomically: tmp file in the same dir, then os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        prefix=f'.{path.name}.', suffix='.tmp', dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            fh.write(content)
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def find_ticket_files(ids: list[str]) -> tuple[list[Path], list[str]]:
    """Return (files_to_move, missing_ids) without moving anything."""
    found: list[Path] = []
    missing: list[str] = []
    for tid in ids:
        matches = [f for f in TICKETS_DIR.glob(f'{tid}-*.md') if f.is_file()]
        if not matches:
            missing.append(tid)
            continue
        found.extend(matches)
    return found, missing


def move_ticket_files(files: list[Path]) -> list[str]:
    moved: list[str] = []
    for src in files:
        dest = COMPLETED_DIR / src.name
        shutil.move(str(src), str(dest))
        moved.append(src.name)
    return moved


# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------


def is_git_repo(path: Path) -> bool:
    try:
        r = subprocess.run(
            ['git', 'rev-parse', '--is-inside-work-tree'],
            cwd=path, capture_output=True, text=True,
        )
        return r.returncode == 0 and r.stdout.strip() == 'true'
    except FileNotFoundError:
        return False


def current_branch(path: Path) -> str | None:
    try:
        r = subprocess.run(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            cwd=path, capture_output=True, text=True, check=True,
        )
        return r.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def build_commit_message(pairs: list[tuple[str, str]]) -> str:
    """`tickets: close 101, 102 (core workflow, structured output)`"""
    if not pairs:
        return 'tickets: (no closures)'
    ids = ', '.join(tid for tid, _ in pairs)
    # Use just the first few words of each title to keep the subject short.
    short_titles = []
    for _, title in pairs:
        words = title.split()
        short_titles.append(' '.join(words[:4]) if words else '')
    titles = ', '.join(t for t in short_titles if t)
    subject = f'tickets: close {ids}'
    if titles:
        subject = f'{subject} ({titles})'
    # Hard cap subject at 72 chars to stay readable in `git log --oneline`.
    if len(subject) > 72:
        subject = subject[:69] + '...'
    return subject


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


@dataclass
class Plan:
    completed_pairs: list[tuple[str, str]] = field(default_factory=list)
    todo_ids: list[str] = field(default_factory=list)
    files_to_move: list[Path] = field(default_factory=list)
    missing_ticket_files: list[str] = field(default_factory=list)
    new_overview_text: str = ''
    new_completed_text: str = ''


def build_plan(sprint_re: re.Pattern[str]) -> Plan:
    sections = split_top_sections(OVERVIEW.read_text(encoding='utf-8'))
    completed_text = (
        COMPLETED_OVERVIEW.read_text(encoding='utf-8')
        if COMPLETED_OVERVIEW.exists()
        else ''
    )
    completed_sections = split_top_sections(completed_text)

    plan = Plan()
    new_sections: list[tuple[str | None, list[str]]] = []

    for heading, body in sections:
        if not is_sprint_heading(heading, sprint_re):
            new_sections.append((heading, body))
            plan.todo_ids.extend(collect_todo_ids(body))
            continue

        kept, done_lines, done_pairs, total = classify_ticket_lines(body)
        plan.completed_pairs.extend(done_pairs)

        if total > 0 and len(done_pairs) == total:
            upsert_closed_sprint(completed_sections, heading, body)
            continue

        if done_pairs:
            upsert_partial_completion(completed_sections, heading, done_lines)
            new_sections.append((heading, kept))
            plan.todo_ids.extend(collect_todo_ids(kept))
        else:
            new_sections.append((heading, body))
            plan.todo_ids.extend(collect_todo_ids(body))

    plan.new_overview_text = render_sections(new_sections)
    plan.new_completed_text = render_sections(completed_sections)

    completed_ids = [tid for tid, _ in plan.completed_pairs]
    plan.files_to_move, plan.missing_ticket_files = find_ticket_files(completed_ids)

    return plan


def print_human_summary(plan: Plan, applied: bool) -> None:
    prefix = '' if applied else '[dry run] '
    closed = ', '.join(tid for tid, _ in plan.completed_pairs) or '(none)'
    remaining = ', '.join(plan.todo_ids) or '(none)'
    print(f'{prefix}closed:    {closed}')
    print(f'{prefix}remaining: {remaining}')
    if plan.files_to_move:
        names = ', '.join(p.name for p in plan.files_to_move)
        verb = 'moved' if applied else 'would move'
        print(f'{prefix}{verb}: {names} -> {COMPLETED_DIR.name}/')
    if plan.missing_ticket_files:
        print(
            f'{prefix}note: no ticket file found for: '
            f'{", ".join(plan.missing_ticket_files)}',
            file=sys.stderr,
        )


def print_json_summary(plan: Plan, applied: bool) -> None:
    payload = {
        'applied': applied,
        'closed': [tid for tid, _ in plan.completed_pairs],
        'remaining': plan.todo_ids,
        'moved_files': [p.name for p in plan.files_to_move],
        'missing_ticket_files': plan.missing_ticket_files,
    }
    print(json.dumps(payload, indent=2))


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        '--apply', action='store_true',
        help='actually modify files (default is a dry run)',
    )
    p.add_argument(
        '--push', action='store_true',
        help='also git add/commit/push (requires --apply, refuses protected branches)',
    )
    p.add_argument(
        '--allow-main', action='store_true',
        help=f'allow --push from {", ".join(sorted(PROTECTED_BRANCHES))} (default: refuse)',
    )
    p.add_argument(
        '--json', action='store_true',
        help='emit a JSON summary instead of the human-readable one',
    )
    p.add_argument(
        '--sprint-pattern', default=DEFAULT_SPRINT_PATTERN,
        help=f'regex for sprint headings (default: {DEFAULT_SPRINT_PATTERN!r})',
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    if not OVERVIEW.exists():
        print(f'error: {OVERVIEW} not found', file=sys.stderr)
        return 1

    if args.push and not args.apply:
        print('error: --push requires --apply', file=sys.stderr)
        return 2

    try:
        sprint_re = re.compile(args.sprint_pattern)
    except re.error as e:
        print(f'error: invalid --sprint-pattern: {e}', file=sys.stderr)
        return 2

    plan = build_plan(sprint_re)

    if not args.apply:
        if args.json:
            print_json_summary(plan, applied=False)
        else:
            print_human_summary(plan, applied=False)
            print('\n(dry run — pass --apply to make these changes)',
                  file=sys.stderr)
        return 0

    # Apply.
    COMPLETED_DIR.mkdir(parents=True, exist_ok=True)
    atomic_write_text(OVERVIEW, plan.new_overview_text)
    atomic_write_text(COMPLETED_OVERVIEW, plan.new_completed_text)
    move_ticket_files(plan.files_to_move)

    if args.json:
        print_json_summary(plan, applied=True)
    else:
        print_human_summary(plan, applied=True)

    if not args.push:
        return 0

    if not is_git_repo(ROOT):
        print('(not a git repo — skipping git add/commit/push)', file=sys.stderr)
        return 0

    if not plan.completed_pairs:
        print('(no tickets completed — skipping git add/commit/push)',
              file=sys.stderr)
        return 0

    branch = current_branch(ROOT)
    if branch in PROTECTED_BRANCHES and not args.allow_main:
        print(
            f'refusing to push from protected branch {branch!r} '
            f'without --allow-main',
            file=sys.stderr,
        )
        return 3

    commit_msg = build_commit_message(plan.completed_pairs)
    try:
        subprocess.run(['git', 'add', '.'], cwd=ROOT, check=True)
        subprocess.run(['git', 'commit', '-m', commit_msg], cwd=ROOT, check=True)
        subprocess.run(['git', 'push'], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as e:
        print(f'git step failed (exit {e.returncode})', file=sys.stderr)
        return e.returncode

    return 0


if __name__ == '__main__':
    sys.exit(main())
