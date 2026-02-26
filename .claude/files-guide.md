# Claude Code — Files Guide

Reference guide for understanding each Claude Code file: official purpose, loading behaviour,
and how this project uses them.

---

## Overview

Claude Code reads a set of files to build its context before responding. Some are auto-loaded
at every session start; others are read on-demand or only when explicitly referenced.

```
Automatically loaded at session start
─────────────────────────────────────
CLAUDE.md                      ← project context (official, committed)
CLAUDE.local.md                ← personal overrides (official, gitignored)
.claude/rules/pipeline.md      ← workflow rules (official, committed)
.claude/settings.json          ← shared config (official, committed)
.claude/settings.local.json    ← personal config (official, gitignored)

Loaded on demand
─────────────────────────────────────
MEMORY.md                      ← session memory (project convention — NOT auto-loaded)
docs/requirements.md           ← product spec (read in Phase 1)
docs/implementation-checklist.md ← progress tracker (read in Phase 1)
docs/refactoring-backlog.md    ← tech debt (read in Phase 1)
docs/migrations-log.md         ← migration history (read/written in Phase 2)
```

---

## CLAUDE.md — Project context

**Official Anthropic feature**: yes — auto-loaded at every session start.

**What it is**: the "orientation brief" Claude reads before starting any task. It holds project
truths that cannot be inferred from the code alone: non-obvious architectural decisions, RBAC
rules, business workflow summaries, known gotchas, coding conventions.

**CLAUDE.md hierarchy** (all auto-loaded, in precedence order):

| Location | Scope | Committed? |
|---|---|---|
| `~/.claude/CLAUDE.md` | All projects on this machine (personal) | No |
| `CLAUDE.md` (project root) | This project, all team members | Yes |
| `CLAUDE.local.md` (project root) | This project, personal only | No (auto-gitignored) |
| `subdir/CLAUDE.md` | That subdirectory only | Yes |

Each more-specific file takes precedence over broader ones.

**What belongs here**:
- Tech stack and non-obvious architecture choices
- RBAC roles and access rules
- Business workflows (state machines, document flow)
- Known gotchas that would cause bugs if forgotten
- Coding conventions that differ from defaults
- Pointers to other reference documents

**What does NOT belong here** (official Anthropic guidance):
- File-by-file codebase descriptions → Claude reads code with Glob/Read
- Things Claude can infer from reading the code
- Information that changes every block → use MEMORY.md
- Long explanations or tutorials
- Standard language conventions Claude already knows

**Anthropic's test for each line**: *"Would removing this cause Claude to make mistakes?"*
If no → cut it. Bloated CLAUDE.md files cause Claude to ignore actual instructions.

**When to update**: event-driven. Update only when a block introduces a non-obvious pattern,
changes RBAC, or adds a new coding convention. Not every block requires a CLAUDE.md update.

---

## .claude/rules/ — Modular rule files

**Official Anthropic feature**: yes — all `.md` files in this directory are auto-loaded
at session start, with the same priority as CLAUDE.md.

**What it is**: a way to split a large CLAUDE.md into focused, well-organised files.
Each file in `.claude/rules/` can cover a specific topic (workflow, API conventions, testing rules).

**Advanced feature**: rules files support YAML frontmatter with a `paths` field for
path-specific rules (e.g. a rule that applies only to `e2e/*.spec.ts` files).

**This project uses it for**: `pipeline.md` — the mandatory development pipeline (Phases 0–8,
R1–R4, cross-cutting rules). Separated from CLAUDE.md because it is long and specialised.

**When to update**: only when the workflow itself changes — a phase is added, a rule is refined,
or a process error reveals a gap. Not routine.

---

## CLAUDE.local.md — Personal/temporary overrides

**Official Anthropic feature**: yes — auto-loaded at session start. Auto-gitignored by
Claude Code (no need to add manually to `.gitignore`, though adding explicitly is harmless).

**What it is**: a personal override file for instructions that should NOT be shared with the team.
Useful for: temporary suspensions (e.g. "skip Phase 4 and 5 during requirements revision"),
personal preferences, machine-specific instructions.

**Current content in this project**: Phase 4 (UAT) and Phase 5 (Playwright e2e) are suspended
during the requirements revision cycle. Remove this file when the revision is complete.

**What belongs here**:
- Temporary instructions active only during a specific phase of work
- Personal preferences that differ from team defaults
- Machine-specific settings (e.g. a different local port)

**What does NOT belong here**: permanent rules (put those in `pipeline.md` or `CLAUDE.md`).

---

## MEMORY.md — Session memory

**Important distinction**: Claude Code has an official auto-memory system stored in
`~/.claude/projects/<project>/memory/`. That is separate from this project's `MEMORY.md`.

**This project's MEMORY.md** (at the repo root) is a **project convention**:
- It is **NOT auto-loaded** by Claude Code
- Claude reads it explicitly in **Phase 0** of the pipeline ("Check MEMORY.md")
- It is committed and shared with the team (it tracks project-level learnings, not personal state)

**Why it exists**: bridges sessions. After a context reset, Claude re-reads MEMORY.md in
Phase 0 to re-align without you re-explaining the situation.

**Two sections**:

| Section | What goes in it | When updated |
|---|---|---|
| **Active plan** | Current step, status, next action, open questions | Phase 8 (close step) or mid-block |
| **Lessons/Patterns** | Concrete findings from past blocks — bugs discovered, pitfalls, workarounds | Phase 8 (only if new, not already in CLAUDE.md) |

**Rules**:
- Keep under ~150 active lines. Beyond that: extract a topic into a separate file and link it.
- No duplication with CLAUDE.md. If a lesson becomes a stable project truth → move it to CLAUDE.md.
- Lessons must be specific: observation + root cause + fix. Not generic advice.

---

## .claude/settings.json and .claude/settings.local.json

**Official Anthropic feature**: yes — both auto-loaded at session start.

**What they configure**: tool permissions (which commands run without a prompt), environment
variables, model selection, sandbox mode, and more.

| File | Scope | Committed? | Purpose |
|---|---|---|---|
| `.claude/settings.json` | Project, all team members | Yes | Shared team configuration |
| `.claude/settings.local.json` | Project, personal only | No (gitignored) | Personal permission overrides |
| `~/.claude/settings.json` | All projects on this machine | No | Personal global preferences |

**Precedence** (highest to lowest): managed (org-wide) → command-line → local → project → user.

**This project's `.claude/settings.local.json`**: `Bash(*)` + all tool names pre-authorised,
so Claude does not ask for permission at every pipeline command (tsc, vitest, playwright, git).

---

## Quick reference — "Where does this information go?"

| Information type | File |
|---|---|
| Tech stack, RBAC, state machines, known patterns | `CLAUDE.md` |
| Development pipeline, phase gates, cross-cutting rules | `.claude/rules/pipeline.md` |
| Temporary suspension or personal override | `CLAUDE.local.md` |
| Tool permission settings | `.claude/settings.local.json` |
| Current work in progress, session state | `MEMORY.md` → Active plan |
| Bug or pattern discovered during implementation | `MEMORY.md` → Lessons/Patterns |
| DB migration applied | `docs/migrations-log.md` |
| Product specification | `docs/requirements.md` |
| Block progress and test results | `docs/implementation-checklist.md` |
| Tech debt and deferred improvements | `docs/refactoring-backlog.md` |

---

## Quick reference — "When does Claude read this?"

| File | When | How |
|---|---|---|
| `CLAUDE.md` | Every session | Automatic |
| `CLAUDE.local.md` | Every session | Automatic (gitignored) |
| `.claude/rules/pipeline.md` | Every session | Automatic (rules dir) |
| `.claude/settings.local.json` | Every session | Automatic (gitignored) |
| `MEMORY.md` | Phase 0 | Explicit read in pipeline |
| `docs/requirements.md` | Phase 1 | Explicit read in pipeline |
| `docs/implementation-checklist.md` | Phase 1 | Explicit read in pipeline |
| `docs/refactoring-backlog.md` | Phase 1 | Explicit read in pipeline |
| `docs/migrations-log.md` | Phase 2 | Explicit write after migration |
| `subdir/CLAUDE.md` | When reading files in that subdir | On-demand by Claude Code |
