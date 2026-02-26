# MEMORY — Staff Manager

> Read in Phase 0 of every new session or after a context summary.
> Two sections: **Active plan** (current in-progress state) and **Lessons/Patterns** (accumulated knowledge).

---

## Active plan — Structural requirements revision

### Context
Stakeholders clarified and re-engineered some core project components. A structural requirements
revision is in progress: `docs/requirements.md` is being updated section by section, followed by
implementation of each approved block. Working on `main`.

### Steps — progress

| Step | Description | Status |
|------|-------------|--------|
| C | Guided review of `docs/requirements.md`: section-by-section comparison, user approval per change | 🔄 in progress — Block 1 done, remaining blocks to define |
| D | Rebuild `docs/implementation-checklist.md` based on updated `requirements.md` | 🔄 partial — Block 1 ✅, remaining blocks to plan |

> **Rule**: do not advance to the next step without explicit confirmation. C and D depend on
> order — the checklist cannot be rebuilt before `requirements.md` is updated.

---

## Lessons / Patterns

### Worktree setup (Block 1 — 2026-02-26)
- **Turbopack rejects symlinked node_modules**: in a worktree, do not use `ln -s` to share
  `node_modules`. Run `npm install` directly in the worktree.
- **Dev server on a separate port**: the worktree must run on a different port (`PORT=3001`).
  Update `playwright.config.ts` `baseURL` accordingly. Revert to 3000 before merging to main.
- **`.env.local` not shared**: each worktree has its own `.env.local`. Copy from main at
  initial setup (`cp ../staff-manager/.env.local .env.local`).

### Migration pitfalls (Block 1 — 2026-02-26)
- **DROP CONSTRAINT before data migration**: run `ALTER TABLE DROP CONSTRAINT` BEFORE `UPDATE`
  on the constrained column. Updating a value that violates the old constraint before dropping
  it causes an error.
- **`auth.identities.email` is a generated column**: do not update `email` directly on
  `auth.identities`. Update only `identity_data = jsonb_set(identity_data, '{email}', '"new@email"')`
  with `WHERE identity_data->>'email' = 'old@email'`.
- **Unapplied migration = process error**: discovering in Phase 5 that a migration was not
  applied is a process violation. Every migration must be applied immediately after writing
  (Phase 2), verified with SELECT, and logged in `docs/migrations-log.md`.

### Supabase SELECT on non-existent columns (Block 1 — 2026-02-26)
- TypeScript does not validate column names in Supabase `.select()` (it does not use generated
  DB types). Selecting a non-existent column (e.g. `importo` instead of `importo_lordo`) causes
  a silent `fetchError` at runtime → 404. Always verify actual column names via
  `information_schema.columns` before adding a new `.select()`.
