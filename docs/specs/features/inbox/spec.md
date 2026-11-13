# Feature Specification: Inbox

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `inbox`
**Branch**: `feat/inbox`
**Status**: `Draft`
**Created**: 2026-11-07
**Last updated**: 2026-11-08
**Owner**: platform maintainers
**Feature flag**: `GAUZY_INBOX_ENABLED` (default off)

---

## 1. Overview

The platform already has two feeds: **employee notifications** (assignments and
mentions today; types exist for comments, invitations, messages, broadcasts and payments)
with read state and one on/off setting per type, and the flag-gated **Inbox** (questions,
approvals, escalations, notices and email addressed to a person, with read, archive and
snooze state, a header bell, and seams through which other plugins file items). This
feature makes the Inbox the **one** place where everything that needs a person's
attention lands, with enough context to act on it (what happened, by whom, on which task,
comment, document, page, conversation, decision or integration item): notifications are
filed as inbox items as they are created, followers of a record are told about changes,
items can be triaged (read, unread, archive, snooze until a time, done), grouped by
source, filtered (all, unread, mentions, assigned, decisions, by source) and paginated. Each employee chooses, per notification kind, which **channels** deliver it:
in-app, email (immediate or digest) and push (web push now, mobile push later). New
entries are pushed live over the real-time channel; the same API serves the Angular app,
Ever Teams, the desktop apps, the MCP server and the SDKs.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee assigned to a task, **when** the assignment is saved, **then** an
  unread Inbox entry "Maria assigned you *Fix invoice totals*" appears for them within a
  second, their unread badge increments, and opening the entry opens the task.
- **Given** an employee mentioned in a comment, a chat message, a document page or a
  page comment, **when** the mention is saved, **then** one entry appears for them naming
  the source, and opening it goes to the exact comment, message or page block.
- **Given** an employee who follows a task, **when** its status changes or someone
  comments on it, **then** they get an entry (if their preferences allow it) grouped under
  that task with the other entries about it.
- **Given** an employee with forty entries, **when** they open the Inbox, **then** they see
  entries newest first, grouped by day, with filters All / Unread / Mentions / Assigned
  and a source filter (Tasks, Chat, Docs, Integrations, People); scrolling loads more.
- **Given** an entry, **when** the employee snoozes it until tomorrow 09:00, **then** it
  leaves the list and comes back unread at that time.
- **Given** a thread of five comments mentioning the same employee, **when** they read
  the task, **then** all five entries are marked read.
- **Given** an employee who prefers email for assignments, **when** they are assigned a
  task, **then** they receive one email with the task title, who assigned it and a link,
  in their language, in addition to the in-app entry.
- **Given** an employee who enabled the daily digest, **when** the digest time comes,
  **then** they receive one email summarising their unread entries of the day, and no
  immediate emails for digest-only kinds.
- **Given** an employee with web push enabled on their laptop, **when** they are
  mentioned while the app is not focused, **then** a browser notification opens the entry
  on click; when the app is focused, only the in-app badge and toast appear.

### 2.2 Edge cases & failures

- **Given** an entry whose target was deleted (comment removed, task deleted), **when**
  the Inbox loads, **then** the entry is hidden or shows "no longer available", never an
  error page.
- **Given** an employee who edits a comment and adds a new mention, **when** saved,
  **then** only the newly mentioned employees get entries; already-notified ones do not.
- **Given** the same employee mentioned twice in one page within ten minutes, **when**
  the second mention is saved, **then** no second entry is created.
- **Given** an employee who leaves the organization, **when** that happens, **then** no
  further entries are created for them and their push subscriptions are removed.
- **Given** a push subscription that fails five times, **when** the fifth failure happens,
  **then** the subscription is dropped silently.
- **Given** email is not configured for the tenant, **when** an employee selects email
  delivery, **then** the setting is saved but the UI shows that email is not available.

## 3. Functional Requirements

### Entries

- **FR-1** The platform MUST create an Inbox entry for these kinds: task assigned,
  task unassigned, task status changed (followed tasks), task due soon, comment on a
  followed task, mention in a comment, mention in a task description, mention in a chat
  message, direct message received, reply in a followed thread, mention in a page,
  mention in a page comment, page shared with me, invitation, broadcast, payment, rate
  change request, integration item (an item synced from a third-party system that is
  assigned or mentions the employee).
- **FR-2** Every entry MUST carry: kind, actor (employee or system), target entity type
  and id, a secondary target where needed (comment id, message id, page block id), a short
  subject, the time, and state (`unread`, `read`, `archived`, `snoozed until`, `done`).
- **FR-3** Entries MUST be listed newest first with cursor pagination, filterable by state,
  kind group (all, mentions, assigned) and source (tasks, chat, docs, integrations, people),
  and MUST include the actor's name and avatar and the target's title in one call.
- **FR-4** The platform MUST deduplicate entries: one entry per recipient per target per
  kind within ten minutes for mentions; editing a comment MUST notify only newly
  mentioned employees.
- **FR-5** Entries MUST be marked read when the recipient opens them, when they read the
  conversation (chat kinds), or on explicit mark-read; mark-all-read MUST be undoable
  for a short period.
- **FR-6** The platform MUST support snooze (hide until a time, then return unread),
  archive and done, individually and in bulk.
- **FR-7** Entries whose target is deleted or no longer visible to the recipient MUST be
  excluded from lists.
- **FR-8** The platform MUST expose an unread count and an unread-mentions count per
  employee in one cheap call, and MUST push both over the real-time channel when they change.

### Following

- **FR-9** Employees MUST automatically follow tasks they create, are assigned to, or
  comment on, and MUST be able to follow or unfollow any task they can view; the existing
  subscription mechanism is reused.

### Preferences and channels

- **FR-10** For every kind, an employee MUST be able to choose delivery channels:
  in-app (always on), email (`immediate`, `digest`, `off`) and push (`on`, `off`), with
  organization-wide defaults set by an admin. (Not met yet for receivers who switched a
  legacy notification type off: no entry is created, see plan §10.2.)
- **FR-11** Employees MUST be able to set a do-not-disturb window during which no push or
  immediate email is sent (entries still appear in-app).
- **FR-12** Email delivery MUST use the platform's email templates in the recipient's
  language and MUST link to the target; the daily digest MUST be one email per employee
  per day at their chosen hour.
- **FR-13** Web push MUST use standard browser push with per-device subscriptions
  (register, list, remove), payload encryption, and automatic removal after repeated
  failures; the platform MUST NOT push to a device when the employee has an active,
  focused session on the same account.

### API and clients

- **FR-14** The Inbox MUST be fully usable through REST and the SDKs and readable through
  MCP tools.
- **FR-15** Existing employee-notification and inbox endpoints MUST keep working
  unchanged; clients that read employee notifications today MUST see the same entries
  (filed items mirror read state both ways, including the notification rows a
  deduplicated entry stands for, see plan §10.3).
- **FR-16** Decisions already in the Inbox (questions, approvals, escalations) MUST keep
  their reply flow and appear in the same list, filterable as "Decisions".

## 4. Non-Functional Requirements

- **Performance**: list of the newest 50 entries with actors and targets under 200 ms
  P95 at 1,000,000 entries per tenant; unread counts under 50 ms.
- **Reliability**: entry creation is part of the originating write's transaction or an
  at-least-once outbox; no lost entries on crashes; digests never sent twice. (Entries are
  filed right after the notification row exists, and a recovery sweep with a durable
  checkpoint files any the process did not live to file, see plan §10.1.)
- **Security & privacy**: an employee reads only their own entries; targets are checked
  against the recipient's permissions at read time; email and push contain only the
  subject and a link.
- **Observability**: counters for entries created per kind, emails and pushes sent and
  failed; digest job runs logged.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; additive migrations on the
  existing employee-notification tables.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `InboxItem` + `InboxItemRecipient` (existing) | The unified entry: kind (now also `notification`), source, actor, target and secondary target, per-recipient read/archive/snooze/done state |
| `EmployeeNotification` (existing) | The platform's notification record; every new one is filed as an inbox item, and its own API keeps working |
| `NotificationPreference` | Per employee per kind: email mode, push on/off; plus do-not-disturb window and digest hour (extends the existing per-type settings) |
| `PushSubscription` | One browser or device subscription of an employee |
| `Follow` (existing subscription) | An employee following a task (or later a page or conversation) |
| `Digest`          | The daily email summarising unread entries |

## 6. Out of Scope

- Mobile native push (needs store builds; the API is prepared for it).
- Shared or team inboxes (email conversations are a separate feature).
- Notification rules or automations beyond per-kind preferences.
- SMS or third-party messenger delivery.

## 7. Acceptance Criteria

- [ ] Assignment, comment mention, chat mention, page mention and followed-task status
      change each create exactly one correctly targeted entry; opening each lands on the
      right task, comment, message or block.
- [ ] Filters, cursor pagination, snooze with return, archive, done and undoable
      mark-all-read work and are reflected live in a second client.
- [ ] Email immediate and digest modes send the expected emails in the recipient's
      language; push reaches an unfocused browser and is suppressed for a focused one.
- [ ] Existing bell/panel clients keep working against the unchanged endpoints.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `GAUZY_INBOX_ENABLED`.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether "done" is a distinct state or an alias of archive; the plan proposes a distinct state so done items can be reviewed separately]`
- `[NEEDS CLARIFICATION: default digest hour (proposed 08:00 in the employee's time zone)]`

## 9. Constitution Gates

- [x] I Plugin-first — `packages/plugins/inbox` for triage, preferences, push and digest; the entry entity stays in core (shared).
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive migrations (new columns and tables only).
- [x] IV Default-off flag; nothing removed — existing endpoints unchanged.
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security — own entries only; encrypted push.
- [x] VII Real-time through the event bus.
- [x] VIII i18n and accessibility — email templates and UI in every locale.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Architecture: [`../../architecture/collaboration-suite.md`](../../architecture/collaboration-suite.md)
- Depends on: [`../realtime-channel/spec.md`](../realtime-channel/spec.md)
- Producers: [`../chat/spec.md`](../chat/spec.md), [`../docs-collaboration/spec.md`](../docs-collaboration/spec.md), [`../integrations-asana-linear-trello/spec.md`](../integrations-asana-linear-trello/spec.md)
