# Task Breakdown: Tasks — saved views, bulk actions, keyboard preferences

**Feature ID**: `task-views-and-bulk-actions`
**Plan**: `./plan.md`
**Status**: `In review`
**Last updated**: 2026-11-07

---

## Phase 1 — Platform (lane G6, PR 1)

- [x] **T1**. Contracts: view visibility / version / manual order and `expectedVersion`; bulk changes, items, outcome; references; built-in view keys; project `taskKey` / `taskKeyHistory`; `keyboard` UI preference
- [x] **T2**. `TaskView` columns, personal views hidden from others, version check on update, `PUT /task-views/:id/order`
- [x] **T3**. `POST /tasks/bulk-update` (≤ 100 tasks, per-task results with previous values, the single update command per task)
- [x] **T4**. Project keys: entity and DTO fields, uniqueness within the organization, history on rename; `POST /tasks/resolve-references` (key, former keys, derived key)
- [x] **T5**. `GET /tasks/built-in/:key` in the caller's time zone
- [x] **T6**. `GAUZY_TASK_VIEWS_ENABLED` flag and guard; `.env.sample`
- [x] **T7**. Migration `1791000004700` (five columns, one index; Postgres, SQLite, MySQL; idempotent)
- [x] **T8**. Specs: references, built-in windows, bulk normalization and undo data
- [ ] **T9**. In-cluster PR build green; bot threads answered; manual check on dev (personal view hidden, 409 on a stale save, bulk update + undo, `API-42` resolves)

## Phase 2

- [x] **T10**. Server-side grouping counts and cursor pagination for a view's tasks; filter tree contract; invalid filters reported
- [ ] **T11**. Generated keys for existing projects on enable (owner's call; proposed: first letters, deduplicated, editable)
- [x] **T12**. GraphQL twins of the new routes
- [ ] **T13**. Ever Teams lane `tasks-keyboard-and-views` (shortcut registry over `uiPreferences.keyboard`, bulk toolbar, saved views pages, palette groups)

**Status 2026-11-07:** phase 1 in ever-gauzy [#11688](https://github.com/ever-co/ever-gauzy/pull/11688) (ready for review; in-cluster build + bot threads next).

## Follow-ups (from the plan's §7)

- [ ] **T14**. One transaction per task in the bulk update (or best-effort post-save steps) so a result is accurate (plan §7.1)
- [ ] **T15**. Reserve former and derived project keys within the organization (plan §7.2)
- [ ] **T16**. Keep a moved task's former references and resolve them (plan §7.3)
