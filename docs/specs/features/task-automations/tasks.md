# Task Breakdown: Task automations

**Feature ID**: `task-automations`
**Plan**: `./plan.md`
**Status**: `In progress`
**Last updated**: 2026-11-11

---

## Phase 1 — Platform (PR 1)

- [ ] **T1**. Spec, plan, tasks (this folder)
- [ ] **T2**. Contracts: `task-automation.model.ts` (triggers, conditions, actions, outcomes, rule, run, dry run, templates, events `task_automation.task_changed` / `task_link.closed`), `PermissionsEnum.TASK_AUTOMATION_MANAGE`, default role grants (super admin, admin, manager)
- [ ] **T3**. Plugin scaffold `packages/plugins/task-automations` (package, project, tsconfig, jest, eslint), `isTaskAutomationsEnabled`, path mapping, `.env.sample`
- [ ] **T4**. Entities + MikroORM repositories; migrations `1791000007310` (tables) and `1791000007320` (role grants), Postgres / MySQL / SQLite, idempotent
- [ ] **T5**. Engine (pure): triggers, conditions, action planning, status categories, loop guard, templates, change capture — unit specs for each
- [ ] **T6**. Rule service: CRUD, validation of every referenced id against the organization, limits, reorder
- [ ] **T7**. Runner + engine services: idempotent run claim, scope, rate limit, conditions on the re-read task, actions through `TaskUpdateCommand` in the system actor's context, notices, history pruning
- [ ] **T8**. Capture (CQRS `ActivityLogEvent` → outbox) and consumer (`subscriber:task-automations`); activity attribution subscriber
- [ ] **T9**. Due-date schedule: scheduler (worker), queue worker + sweep (API), advisory lock, in-process fallback without a queue
- [ ] **T10**. REST controller + DTOs; dry run; run history
- [ ] **T11**. GraphQL reads; `graphql-field-binding-check.mjs` entry
- [ ] **T12**. Registration: `apps/api/src/plugins.ts` (`TaskAutomationsPlugin`), `apps/worker/src/plugins.ts` (`TaskAutomationsSchedulePlugin`), their specs
- [ ] **T13**. Bot threads answered; merged into develop

## Phase 2 — Gauzy app (PR 2)

- [ ] **T14**. `@gauzy/plugin-task-automations-ui`: Settings → Automations (list, on/off, create from template or blank, edit trigger / conditions / actions, order, dry run, run history), hidden when the routes answer 404; i18n

## Phase 3 — Ever Teams (PR 3, ever-teams)

- [ ] **T15**. Settings → Automations behind `NEXT_PUBLIC_TASK_AUTOMATIONS_ENABLED` (default off), hidden on 404; strings in all 13 locales; spec in `docs/specs/features/task-automations/`

## Follow-ups

- [ ] **T16**. An integration that reports `task_link.closed` (GitHub pull requests, Linear / Asana / Trello attachments) so the link-closed template fires
- [ ] **T17**. Read-only view of the rules for members (open question in the spec)
