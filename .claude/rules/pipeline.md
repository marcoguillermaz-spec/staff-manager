# Workflow Requirements

CRITICAL: these are non-negotiable process constraints. They apply to EVERY development task — feature blocks, bug fixes, refactoring, minor features — even when the full plan is provided in a single prompt. Always execute one phase at a time and stop at the indicated gates. Do not proceed to the next phase without explicit confirmation.

---

## Mandatory Development Pipeline

**Phase 0 — Session orientation** *(only at the start of each new session or after a context summary)*
- Read `.claude/CLAUDE.local.md` (always, even if previously read — forces system injection of active local overrides). If the file does not exist, continue.
- Check `MEMORY.md`: read the **Active plan** section (if present) to re-align on in-progress sessions, then **Lessons/Patterns** for patterns relevant to the current block.
- If context was compressed (summary): read `docs/implementation-checklist.md` to re-align on current state.
- Do not re-read files already in the current context — use the already-acquired line reference.

**Phase 1 — Requirements**
- Read `docs/implementation-checklist.md` to verify current state and block dependencies.
- Read **only the relevant section** of `docs/requirements.md` for the current block — not the entire file.
- Check `docs/refactoring-backlog.md`: if there are entries that intersect the current block, include them in the work plan or flag them explicitly.
- Summarize the block's requirements concisely.
- **Dependency scan** (mandatory when the block touches existing routes, components, or pages — cannot be skipped): before declaring the file list, grep/glob for ALL usages of affected entities. Minimum checks:
  1. Every route being moved/repurposed/removed → `grep href="/route"` across all `.tsx`/`.ts`
  2. Every component being modified → find all import consumers
  3. Every redirect being added → check breadcrumbs and CTAs in pages that link to the old route
  4. Check `e2e/` for spec files referencing affected routes or selectors
  - Use a Task agent (Explore) if the scan requires >3 independent queries.
  - An incomplete dependency scan = incomplete file list = rework discovered in Phase 2. This is a process error.
- For broad codebase searches (>3 independent Glob/Grep queries): delegate to a Task agent (Explore) to protect the main context.
- If anything is ambiguous: use AskUserQuestion BEFORE writing code.
- Expected output: feature summary, **complete** file list verified by dependency scan, open questions.
- *** STOP — present requirements summary and file list. Wait for explicit confirmation before proceeding. ***

**Phase 1.5 — Design review** *(blocks introducing new patterns, DB schema changes, or touching >5 files)*
- Present a design outline: data flow, data structures involved, main trade-offs.
- State any discarded alternatives and rationale.
- For simple blocks (≤3 files, no migration, no new patterns): skip this phase, stating so explicitly.
- *** STOP — wait for design confirmation before writing code. ***

**Phase 2 — Implementation**
- Write the code. Follow the project's Coding Conventions.
- Do not add unrequested features. No unrequested refactoring.
- **After every new migration** (`supabase/migrations/NNN_*.sql`): apply **immediately** to the remote DB via Management API (`curl` with `SUPABASE_ACCESS_TOKEN` from `.env.local`) + verify with a SELECT query + add a row to `docs/migrations-log.md`. **Do not wait for tests to discover missing migrations** — finding them in later phases is a process error.
- **PostgREST join syntax** (`table!relation`, `!inner`): verify FK existence before using it. If FK absent → two-step query (separate fetches + in-memory merge). Verification query: `SELECT conname FROM pg_constraint WHERE conrelid='tablename'::regclass AND contype='f';`
- **DROP CONSTRAINT before UPDATE** (migrations): if a column has a CHECK constraint and the UPDATE sets a value not allowed by the current constraint (e.g. renaming an enum value), the UPDATE fails. Pattern inside a single migration: (1) `ALTER TABLE t DROP CONSTRAINT c;` (2) `UPDATE t SET col = new_val WHERE ...;` (3) `ALTER TABLE t ADD CONSTRAINT c CHECK (...);` — all three statements in the same migration file so they run atomically.
- **Security checklist** (before intermediate commit): for every new/modified API route verify: (1) auth check before any operation, (2) input validated (Zod), (3) no sensitive data exposed in response, (4) RLS not implicitly bypassed.
- Expected output: list of created/modified files with paths.

**Phase 3 — Build + unit tests**
- Run `npx tsc --noEmit` and `npm run build`. Must complete without errors.
- Run `npx vitest run`. All tests must pass.
- Expected output: summary line only (e.g. `✓ 106/106`). Do NOT paste full output — reduces token consumption.
- If something fails: paste only the error lines, fix, and re-run. Do not proceed with open errors.
- After green build + tests: **make an intermediate commit** (`git add … && git commit`).

**Phase 3b — API integration tests** *(only if the block creates or modifies API routes)*
- Write core tests in `__tests__/api/<route-name>.test.ts` with vitest:
  - Happy path: expected status code + key fields in response body
  - Auth: no token → 401
  - Authz: unauthorized role → 403
  - Validation: invalid payload or missing required field → 400
  - Business rules: application constraint violation → correct error code
  - DB state: after write, verify expected record with service role
- Focus on core cases — do not exhaust every combination, cover critical paths.
- Run `npx vitest run __tests__/api/` — all green.
- Output: summary line only. Do not proceed with open errors.

**Phase 4 — UAT definition**
- Identify only **core** coverage scenarios: happy path, main edge case, post-operation DB check. Avoid redundant or purely cosmetic UI scenarios.
- List Playwright scenarios (S1, S2, …) with: action, input data, expected outcome.
- *** STOP — present scenario list and wait for explicit confirmation before writing the e2e spec. ***

**Phase 5 — Playwright e2e**
- Write `e2e/<block>.spec.ts` based on approved scenarios.
- Run `npx playwright test e2e/<block>.spec.ts`.
- **Before writing CSS selectors**: read the target component file (Read tool) and derive classes from real JSX — never assume from memory. Distinguish shared classes (e.g. `px-5 py-4` on both header and rows) from unique ones (e.g. `space-y-2` on rows only).
- Expected output: summary line only (e.g. `9 passed (45s)`).
- If something fails: paste only the failing scenario with error, fix, and re-run. Do not proceed with red tests.
- Selectors: use explicit CSS class selectors (e.g. `span.text-green-300`) — never `getByText()` for status values (captures partial matches from raw DB Timeline entries).

**Phase 5.5 — Manual smoke test** *(before the formal checklist)*
- Run 3-5 quick steps in the browser with the appropriate test account to verify the main flow.
- Goal: catch obvious issues (blocked UI, wrong redirect, data not saved) before presenting Phase 6.
- Output: "smoke test OK" or list the problem and fix it before proceeding.

**Phase 6 — Outcome checklist**
Present this checklist filled with actual results:

```
## Block checklist — [Block Name]

### Build & Test
- [ ] tsc --noEmit: 0 errors
- [ ] npm run build: success
- [ ] Vitest unit: N/N passed
- [ ] Vitest API: N/N passed *(if Phase 3b executed)*
- [ ] Playwright e2e: N/N passed *(⏸ suspended if CLAUDE.local.md active)*

### Implemented features
- [ ] [feature 1]: [outcome]

### Manual verification
Steps to verify manually with the appropriate test account:
1. [step]

### SQL verification queries
SELECT …;

### Created / modified files
- path/to/file.ts — description
```

**Phase 7 — Human confirmation**
- *** STOP — do not declare the block complete, do not update any documents, do not move to the next block until the user responds with explicit confirmation. ***

**Phase 8 — Block closure**
Only after explicit confirmation:
1. Update `docs/implementation-checklist.md`: mark block ✅, add a Log row with date, files, test results, relevant notes.
2. Update `CLAUDE.md` **only if** the block introduces non-obvious patterns, modifies RBAC, or adds a new coding convention. Do not update for simple file additions — Claude infers structure from code.
3. Update `README.md` (Project Structure + test counts).
4. Update `MEMORY.md` **only if** new lessons emerged that are not already documented. Avoid duplications.
   - If MEMORY.md exceeds ~150 active lines: extract the topic into a separate file and replace with a link.
5. If structural or design issues emerged: open `docs/refactoring-backlog.md`, check for duplicates, add new entries ordered by topic.
6. Commit: `docs/implementation-checklist.md` + `README.md` + `docs/refactoring-backlog.md` if modified + `docs/migrations-log.md` if modified. Commit `CLAUDE.md` and `MEMORY.md` separately if updated — never mixed into the code commit.
7. Run `git push` immediately after the commit.
8. Run `/compact` to free the current session's context.

---

## Pipeline for Structural Requirements Changes

Activate when stakeholders introduce changes to the functional scope that impact already-implemented blocks or the project structure. This pipeline **precedes** the standard development pipeline and is its prerequisite.

**Phase R1 — Requirements update**
- Compare the change with the relevant section of the current `docs/requirements.md`.
- Propose updated text section by section.
- *** STOP — wait for explicit approval of each section before writing anything. ***

**Phase R2 — Impact analysis**
- Identify all already-implemented blocks impacted by the change.
- For each block: list affected files, logic to update, tests to revise.
- Check `docs/refactoring-backlog.md`: can existing entries be deprecated, integrated, or updated in light of the change?
- Expected output: impact matrix (block → file → change type) + refactoring-backlog delta.

**Phase R3 — Intervention plan**
- Update `docs/implementation-checklist.md` with the new plan.
- Update `docs/refactoring-backlog.md` (deprecate obsolete entries, add emerging issues).
- *** STOP — present the full plan and wait for explicit confirmation before touching any code file. ***

**Phase R4 — Execution**
- Read `docs/implementation-checklist.md` — the plan for each block is already defined and approved, ready to use.
- Proceed block by block following the standard pipeline (Phases 0–8).
- Update `MEMORY.md` Active plan section after each completed step.

---

## Cross-Cutting Rules

- **Tool permissions**: the user has explicitly authorized autonomous execution of all commands (Bash, curl, npx, tsc, vitest, playwright, git) **except** the explicit STOP gates. Proceed without asking for confirmation for any technical command required by the pipeline.
- **Dependency scan is mandatory**: whenever a block touches existing routes, components, or pages, always grep for all usages before producing the file list (Phase 1). Do not rely on memory or partial exploration. The user must never need to ask for a deeper analysis — it is your responsibility to deliver a complete file list from the start.
- **Hard gates**: "STOP" instructions are hard stops. Do not treat them as suggestions.
- **Even if the plan is pre-written**: still execute phase by phase with the gates. A pre-written plan replaces only Phase 1, it does not compress subsequent phases.
- **Do not re-read files already in context**: use the already-acquired line reference.
- **Explore agent for broad searches**: if a search requires >3 independent Glob/Grep queries, delegate to `Task subagent_type=Explore` to protect the main context from verbosity.
- **Concise output**: always report only the build/test summary line. Paste details only on error.
- **Keep MEMORY.md compact**: stay under ~150 active lines. Beyond that: extract topics into separate files and link.
- **Immediate migration**: every `supabase/migrations/*.sql` must be applied to the remote DB immediately after writing (Management API + SELECT verification + `docs/migrations-log.md` entry). Never leave a written migration unapplied before tests.
- **FK check before PostgREST joins**: `SELECT conname FROM pg_constraint WHERE conrelid='tablename'::regclass AND contype='f'`. If FK absent: two-step query.
- **Locators from real JSX**: before writing every e2e locator, read the component (Read tool). Identify unique classes for each target element — never assume from memory.
- **Playwright UAT**: CSS class selectors (e.g. `span.text-green-300`) for status badges. Never `getByText()` for status values.
