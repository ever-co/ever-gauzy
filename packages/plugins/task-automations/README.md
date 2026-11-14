# @gauzy/plugin-task-automations

Task automations for the Ever Gauzy Platform: rules of an organization — optionally narrowed to a project or a team —
made of a **trigger**, **conditions** and **actions**, run in the background after the task change that set them off
(or on a schedule for due dates), with a dry run and a run history per rule.

Spec, plan and tasks: [`docs/specs/features/task-automations`](../../../docs/specs/features/task-automations/).

## Switch

Off unless `GAUZY_TASK_AUTOMATIONS_ENABLED=true` (exactly), on the API and the worker alike. Off, nothing is loaded:
no route, no GraphQL field, no table, no outbox row, no schedule, no role grant.

## What it does

- **Triggers**: a task is created; its status changes (optionally to / from given statuses); someone is added as an
  assignee; every sub-task of a task is done (acts on the parent); a done sub-task is reopened (acts on the parent);
  the due date of an open task passes (checked every 15 minutes, for due dates of the last 24 hours that passed after the
  rule was created: after a longer downtime, due dates older than a day are not reported); a linked pull request or
  issue closes (`task_link.closed`: the GitHub integration reports a closed pull request, merged or not, linked to a
  task by a task link to its address or by the task's reference in its title or branch, and a closed issue the task
  mirrors or links to; optionally only a merged pull request — "merged only"; see "Closed links" below).
- **Conditions** (all must hold): status is / is not / of category; open / done; priority; labels; assigned /
  unassigned / assignee; sub-task or not; title contains.
- **Actions** (in order): set the status (a status, or the first to-do / in-progress / done status of the task's
  project); set the priority; add or replace assignees; add or remove labels; notify the assignees (Inbox notice, or a
  platform notification without the Inbox).
- **Templates**: close the parent when all sub-tasks are done; reopen the parent when a sub-task reopens; when the
  status changes set the assignee / label / priority; when assigned move to In progress; when the due date passes
  notify the assignees; when a linked pull request or issue closes set the status.

## How it runs

1. Every task create, update and assignee change publishes the platform's `ActivityLogEvent` with the values before
   and after. `TaskAutomationChangeCapture` turns the ones a switched-on rule could fire on into
   `task_automation.task_changed` on the event outbox (partition `task-automation:<taskId>`). The append is best effort
   after the task's commit, like the real-time hints: if it fails, the task is saved and that change runs no rule; the
   API logs `A task change was not handed to the automations: …` (watch for it).
2. The outbox dispatch pass hands the event to `subscriber:task-automations` once; the engine runs the organization's
   matching rules in their order. Each run is claimed by `(ruleId, eventKey)`: a redelivered change skips the rules
   that already finished for it, runs those that had not, and waits for one still marked running (taking it over once
   its 5-minute lease ran out).
3. Actions go through `TaskUpdateCommand` inside a request context of a system actor of the rule's organization (no
   user, no employee, no permission), so notifications, subscriptions, integrations and real-time hints follow, and the
   activity row says "by automation `<name>`" with the system as actor.
4. Loop guard: a rule's change may set off other rules once; their changes set off nothing; a rule never runs on its own
   change. Rate limit: at most 20 automated changes per task in 10 minutes.
5. One run of a task at a time, across the processes (a lock per task over the read, the checks, the write and the
   recorded outcome); a run that finds its task busy is put back and tried again.

## Closed links

An integration publishes the platform's `TaskLinkClosedEvent` (task, tenant, organization, provider, kind, address,
the provider's id of the item, and for a pull request whether it merged). `TaskAutomationLinkClosedCapture` appends it
as `task_link.closed` in the task's partition when the task is of the named organization and the organization has a
`LINK_CLOSED` rule on, once per task and link: the close is claimed in `task_automation_link_closure` in the same
transaction the event is appended in, so a redelivery, another API instance or the same pull request closed again after
a reopen appends nothing, and a failed append leaves no claim (GitHub's redelivery reports it again); the API logs
`A closed link was not handed to the automations: …`.

A `LINK_CLOSED` trigger with `mergedOnly: true` fires for a pull request only when it was merged; an issue's close fires
as without it. A merged pull request's merge is claimed too, beside its close (kind `pull_request.merged` in the same
table): a pull request closed without merging, reopened and then merged is appended once more on its merge, with
`closedBefore: true`, and only the `mergedOnly` rules run on that event (the others ran on the close). Rules saved
without the option keep `triggerConfig` empty and run as before (spec FR-21).

The GitHub integration (`GithubTaskLinkService`) handles `pull_request.closed` and `issues.closed`; the GitHub App must
send the **Pull requests** and **Issues** events. Linear, Asana and Trello report nothing of their own: their
attachments carry no state (spec FR-20), and one that points at a GitHub pull request is reported by the GitHub
integration when the organization connected that repository's installation.

The worker hosts `TaskAutomationsSchedulePlugin` (the due-date schedule only); the API hosts `TaskAutomationsPlugin`
(everything else, including the consumer of the schedule's queue). Without a queue root the API sweeps on its own timer;
with one (`REDIS_ENABLED=true`) the sweep comes from the worker's schedule, so keep the worker's scheduler on.

## API

`TASK_AUTOMATION_MANAGE` (granted to super admins, admins and managers) on every route of `/api/task-automations`:
`GET /templates`, `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /order`, `DELETE /:id`, `POST /:id/test`,
`GET /:id/runs`. GraphQL: `taskAutomationRules`, `taskAutomationRule`, `taskAutomationRuns`, `taskAutomationTemplates`.

## Tests

```bash
NODE_OPTIONS=--experimental-vm-modules node node_modules/jest/bin/jest.js -c packages/plugins/task-automations/jest.config.ts
```
