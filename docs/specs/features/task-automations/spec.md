# Feature Specification: Task automations

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `task-automations`
**Branch**: `feat/task-automations`
**Status**: `Draft`
**Created**: 2026-11-11
**Last updated**: 2026-11-14
**Owner**: platform maintainers
**Feature flag**: `GAUZY_TASK_AUTOMATIONS_ENABLED` (default off; only the exact value `true` turns it on)

---

## 1. Overview

A manager describes once how tasks should move, and the platform keeps to it: "when every sub-task is
done, close the parent", "when a task is assigned, move it to In progress", "when the due date passes
and the task is still open, tell the assignees". An **automation rule** belongs to an organization and
may be narrowed to one project or one team. It is a **trigger** (what happened), **conditions** (what
must be true of the task) and **actions** (what to change), and it can be switched on and off, ordered,
tried on a task without changing it, and audited: each rule keeps the history of its recent runs, and
every change it makes appears in the task's activity as made "by automation `<name>`".

Rules run in the background, after the change that set them off, never inside the request of the
person who made it: saving a task is not slower because an organization has automations, and a rule
that fails never fails the save.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a manager on Settings → Automations, **when** they pick the template "Close the parent when
  all sub-tasks are done" and save it, **then** the rule is listed, switched on, with them as its
  creator; and **when** the last open sub-task of a task is moved to a done status, **then** within a
  few seconds the parent moves to the project's first done status, and the parent's activity shows
  "Updated Task … by automation Close the parent when all sub-tasks are done".
- **Given** the template "Reopen the parent when a sub-task reopens", **when** a done sub-task of a
  done parent is moved back to an open status, **then** the parent moves to the project's first
  in-progress status.
- **Given** a rule "When status becomes Ready for review, set the priority to High and add the label
  Review", **when** a task moves to Ready for review, **then** its priority is High and it carries the
  label; a task that moves to any other status is left alone.
- **Given** the template "When a task is assigned, move it to In progress", **when** someone is added as
  an assignee of a to-do task, **then** the task moves to the first in-progress status; a task that is
  already in progress or done is left alone (the template's condition "status is to-do").
- **Given** the template "When the due date passes, notify the assignees", **when** the due date of an
  open task passes, **then** each assignee receives one Inbox notice "`<task>` is overdue" linking to the
  task (or, with the Inbox off, a platform notification) — once per task and due date, however often the
  check runs; a done task is not reported.
- **Given** a rule scoped to the project "Website", **when** a task of another project changes, **then**
  the rule does not run for it.
- **Given** a manager who wants to know what a rule would do, **when** they open the rule, choose
  **Test** and pick a task, **then** they see whether the trigger applies to that task, each condition
  with passed / failed, and each action with the value it would change from and to — and nothing is
  changed.
- **Given** a rule that ran, **when** the manager opens its history, **then** they see its last runs
  newest first: when, which task, the outcome (applied, nothing to change, conditions not met, skipped
  by the loop guard or the rate limit, failed) and what was changed or why it failed.
- **Given** several rules, **when** the manager drags one above another, **then** the new order is
  kept and rules for the same change run in that order, each seeing the task as the rules before it
  left it.
- **Given** a rule that is switched off, **when** its trigger happens, **then** it does not run and its
  history does not grow.
- **Given** the template "When a linked pull request or issue closes, set the status" and an organization that
  connected the GitHub integration, **when** a pull request of a repository of that installation is merged or closed
  and a task of the organization is linked to it — the task has a link to the pull request's address, or the pull
  request's title or branch names the task by its reference (`WEB-42: fix the footer`, `feature/WEB-42-footer`) —
  **then** within a few seconds the open task moves to the project's first done status, as the rule. **When** a GitHub
  issue closes, **then** the task that mirrors it (the issue sync) and the tasks with a link to it move the same way.

### 2.2 Edge cases & failures

- **Given** two rules that would undo each other (A: "status becomes Done → set In progress", B: "status
  becomes In progress → set Done"), **when** a task moves to Done, **then** A runs once, B runs once on
  A's change, and nothing runs on B's change (the loop guard): the task does not ping-pong, and the
  history of the rule that was held back says "skipped by the loop guard".
- **Given** a rule that would change a task more than 20 times in 10 minutes, **when** the limit is
  reached, **then** further runs for that task are skipped with "rate limited" until the window moves
  on.
- **Given** an action that would set what the task already has (status already Done), **when** the rule
  runs, **then** nothing is written and the run says "nothing to change".
- **Given** a rule whose status, label, priority or assignee no longer exists (deleted, or not of the
  task's organization), **when** it runs, **then** that action is reported as failed with the reason and
  the rule's other actions still run.
- **Given** the same task change delivered twice (a retry after a crash), **when** it is processed again,
  **then** no rule runs twice for it.
- **Given** a person without the manage permission, **when** they open the automation routes, **then**
  they are refused (`403`); with the feature off every automation route answers `404` and the apps hide
  the page.
- **Given** a rule for another organization, **when** a manager names its id, **then** they receive
  "not found".
- **Given** the template "When a linked pull request or issue closes, set the status", **when** no
  connected integration reports closed links, **then** the template is offered with the note that it
  needs such an integration, and the rule simply never fires until one does.
- **Given** a pull request linked to a task, **when** GitHub delivers its close twice (a redelivery), or it is reopened
  and closed again, **then** the rule runs once for that task and pull request. **When** the pull request names a
  reference no task of the organization holds, is linked only to another organization's or tenant's task, or no
  organization connected its installation, **then** nothing is reported. A pull request closed without merging is
  reported too, saying so (`merged: false`).
- **Given** a link rule with "Merged pull requests only", **when** a linked pull request is closed without merging,
  **then** the rule does not run; **when** that pull request is reopened and merged, **then** the rule runs once for the
  task, and a redelivery of the merge runs nothing. **When** a linked issue closes, **then** the rule runs as without
  the option. A link rule without the option runs once on the pull request's first close, merged or not, as before —
  not again on a merge that follows a reopen.

## 3. Functional Requirements

### Rules

- **FR-1** A person with `TASK_AUTOMATION_MANAGE` MUST be able to list, create, edit, switch on and off,
  reorder and delete the automation rules of their organization; every route MUST refuse others with
  `403`, and a rule of another organization or tenant MUST answer `404`.
- **FR-2** A rule MUST carry a name (1–120 characters), an optional description, an optional scope (one
  project or one team of the organization), whether it is on, its position, its creator and creation
  time, one trigger, 0–10 conditions and 1–10 actions. An organization MUST hold at most 100 rules.
- **FR-3** Built-in templates MUST be offered: close the parent when all sub-tasks are done; reopen the
  parent when a sub-task reopens; when the status becomes X set the assignee / label / priority; when a
  task is assigned move it to In progress; when the due date passes and the task is open notify the
  assignees; when a linked pull request or issue closes set the status. A rule created from a template
  MUST be an ordinary rule afterwards (editable, its template key kept for display only).
- **FR-4** Saving a rule MUST validate it: the trigger, condition and action types are known; the
  statuses, priorities, labels, assignees, project and team it names belong to the organization; an
  action that names nothing to set is refused (`400` with the reason).

### Triggers, conditions, actions

- **FR-5** Triggers: a task is created; a task's status changes (optionally only to, or from, given
  statuses); someone is added as an assignee; every sub-task of a task is done (the rule acts on the
  parent); a done sub-task is reopened (the rule acts on the parent); the due date of an open task
  passes; a linked pull request or issue of the task closes (when an integration reports it: GitHub, FR-18).
- **FR-6** Conditions, all of which must hold for the task the rule acts on: its status is / is not one
  of; it is open / done; its priority is one of; it has / has none of the labels; it is assigned /
  unassigned; one of the given people is an assignee; it is / is not a sub-task; its title contains a
  text.
- **FR-7** Actions, applied in their order: set the status (a given status, or the first to-do,
  in-progress or done status of the task's project, else of its organization); set the priority; add
  assignees or replace them; add labels; remove labels; notify the assignees (an Inbox notice when the
  Inbox is on, otherwise a platform notification), with an optional message.
- **FR-8** Changes MUST be applied through the platform's own task update (so notifications,
  subscriptions, integrations and real-time hints behave as for a person's change) and MUST be recorded
  in the task's activity with the system as actor and "by automation `<name>`" in the description.

### Running

- **FR-9** Rules MUST run in the background after the change that triggered them, never inside the
  triggering request; a failing rule MUST NOT fail or slow the change. Time-based triggers (the due date)
  MUST be checked on a schedule (every 15 minutes) by one process at a time.
- **FR-10** One change MUST run each matching rule at most once, however often it is delivered; the due
  date trigger MUST run at most once per rule, task and due date.
- **FR-11** Rules MUST run in their position order; each MUST see the task as the earlier rules left it.
  Only rules that are on, of the task's organization, and whose scope contains the task (its project,
  or one of its teams) run. Runs on one task MUST NOT overlap (a due-date run and a change's run, or two
  sub-tasks' runs on their parent): each reads, decides and writes the task alone.
- **FR-12** Loop guard: a change made by an automation MAY set off other rules once; a change made by
  those MUST set off nothing; a rule MUST never run on a change it caused itself.
- **FR-13** Rate limit: automations MUST change one task at most 20 times in any 10 minutes; runs beyond
  are skipped and recorded as rate limited.
- **FR-14** Each rule MUST keep its runs — when, task, trigger, outcome, what changed or why not — and
  answer its last 50 newest first; at most 200 runs per rule are kept once they are a day old (a younger
  run is kept whatever the count: it is what stops the same change or due date from running the rule
  twice).
- **FR-15** A dry run (`POST /task-automations/:id/test` with a task id) MUST answer whether the trigger
  applies, each condition's result and each action's planned change, and MUST write nothing (no task
  change, no run, no notification).
- **FR-16** The rule's changes MUST be made with the permissions of a system actor of the rule's
  organization: never as the rule's creator, never across organizations.

### Closed links

- **FR-18** The GitHub integration MUST report a closed pull request (merged or not) and a closed issue as a closed
  link of each task of an organization that connected the delivery's installation and is linked to it: a pull request
  by a link of the task to its address (`/pull/<n>` or `/issues/<n>`: one numbering) or by the task's upper-case
  reference in its title or branch name; an issue by the task that mirrors it through that integration and by a link
  of the task to its address. A report names the task, its tenant and organization, the provider, the kind
  (`pull_request` / `issue`), the item's address and GitHub id, and for a pull request whether it was merged. Only
  tasks read back in the organization are reported; never another organization's or tenant's.
- **FR-19** A closed link MUST become `task_link.closed` at most once per task and link (provider, kind and the
  provider's id of the item), however often its close is delivered or the item is closed again after a reopen; only
  for a task of the organization the report names, and only while the organization has a rule of that trigger on. The
  claim and the event MUST commit together: a close is never lost to a stop between them, and a delivery whose event
  could not be appended is reported again when it is delivered again.
- **FR-20** The Linear, Asana and Trello integrations report no closed link: an attachment as their APIs return it
  is a title, an address and a few file facts, with no state of what it links to (no documented open, closed or merged
  field), so there is nothing to tell a close by. A change of the item itself (its status) still reaches the platform
  as the task's change, which the status triggers read. Their attachments are kept as links of the task, so one that
  points at a GitHub pull request or issue is reported by the GitHub integration (FR-18) when the organization
  connected that repository's installation.
- **FR-21** A link-closed trigger MAY be set to "merged pull requests only" (`mergedOnly`, default `false`; any other
  value than true or false is refused with `400`): such a rule MUST NOT run for a pull request closed without merging,
  MUST run once when the pull request is merged — also when the merge follows a close without merging and a reopen —
  and MUST run for an issue's close as without the option. A close without merging MUST NOT use up the once-per-link
  report the later merge needs: a merged pull request's merge is claimed beside its close, and a merge whose close was
  reported before becomes `task_link.closed` once more, marked `closedBefore: true`, which only the merged-only rules
  run on. Rules saved without the option, and the event's existing fields, MUST behave as before.

### Compatibility

- **FR-17** With the flag off nothing of the feature is loaded: no route, no GraphQL field, no table, no
  outbox row, no schedule, no role grant. Turning it on adds tables and grants `TASK_AUTOMATION_MANAGE`
  to the existing super-admin, admin and manager roles; turning it off again leaves the data inert. The
  default roles of a tenant created later list the permission whatever the flag (as they list the Chat
  ones), so a tenant created while the feature is off has it once the feature is turned on; while off it
  opens nothing.

## 4. Non-Functional Requirements

- **Performance**: a task save with automations on adds one outbox append and nothing when the
  organization has no rule for that kind of change; a rule's run completes within 2 s P95 after the
  dispatch pass picks the change up (the pass runs at once after a commit where a queue exists, at most a
  minute later otherwise).
- **Reliability**: at-least-once delivery through the event outbox, deduplicated per rule and event; the
  due-date check catches up on what it missed in the last 24 h after a downtime.
- **Security & privacy**: tenant and organization scoped everywhere; rules act as a system actor of the
  organization; dry runs read only what the manager may read.
- **Observability**: the run history per rule; logs for failed runs and refused events.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; additive migrations.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `TaskAutomationRule` | A named trigger + conditions + actions of one organization, optionally scoped to a project or team, on or off, with a position and a creator |
| `TaskAutomationRun` | One evaluation of one rule for one task and one change (or due date): outcome, depth, what changed |
| Trigger | What happened to a task: created, status changed, assigned, all sub-tasks done, sub-task reopened, due date passed, link closed |
| Condition | A test on the task the rule acts on (status, priority, labels, assignees, parent, title) |
| Action | A change to that task (status, priority, assignees, labels) or a notice to its assignees |
| Template | A built-in starting point for a rule |
| Depth | How many automation hops led to a change: 0 for a person's, 1 for a rule's, 2 for a rule set off by a rule (never evaluated) |

## 6. Out of Scope

- Rules across organizations, or acting on tasks other than the task itself or its parent.
- Webhook or email actions, creating tasks, recurring tasks, custom code.
- Triggers on comments, time logs or sprints.
- Closed links from Linear, Asana and Trello on their own (FR-20); a pull request linked to a task by a commit message
  or the pull request's description (only its title, its branch and the task's links count); telling an issue closed as
  completed from one closed as not planned (FR-21 leaves an issue's close as it was).

## 7. Acceptance Criteria

- [ ] Each template creates a working rule; each trigger, condition and action has a passing test.
- [x] A closed GitHub pull request or issue linked to a task fires the link-closed template once per task and link,
      never across tenants or organizations (T16).
- [x] A link rule set to "merged pull requests only" skips a pull request closed without merging and runs on its merge,
      also after a reopen; rules without the option run as before (T18).
- [ ] A change is processed once per rule however often it is delivered; the due-date notice goes out
      once per task and due date.
- [ ] The loop guard and the rate limit hold; a rule never runs on its own change.
- [ ] Activity entries of automated changes name the rule and the system actor.
- [ ] Dry runs write nothing; run history shows the last runs with outcomes.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `GAUZY_TASK_AUTOMATIONS_ENABLED`.
- [ ] Settings → Automations in the Gauzy app and in Ever Teams, hidden when the routes answer 404.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether members without the manage permission should see (read-only) the rules
  that act on their tasks (proposed: later, through the task's activity which already names the rule)]`

## 9. Constitution Gates

- [x] I Plugin-first — a new plugin `packages/plugins/task-automations` (+ `task-automations-ui`).
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive tri-dialect migrations.
- [x] IV Default-off flag; nothing removed.
- [x] V Contracts and API first (`packages/contracts`, REST + GraphQL reads).
- [x] VI Permissions, privacy, security — `TASK_AUTOMATION_MANAGE`, system actor per organization.
- [x] VII Real-time through the event bus — triggers ride the event outbox; changes go through the task update.
- [x] VIII i18n and accessibility — settings UI strings in every locale.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`../inbox/spec.md`](../inbox/spec.md) (notices), [`../realtime-channel/spec.md`](../realtime-channel/spec.md)
  (event outbox dispatch), [`../task-views-and-bulk-actions/spec.md`](../task-views-and-bulk-actions/spec.md)
- Consumers: Ever Teams `docs/specs/features/task-automations/`
