# Feature Specification: Integration — Jira Cloud

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `integration-jira`
**Branch**: `feat/integration-jira-parity` (platform), `feat/integration-jira-ui` (Angular), Ever Teams `feat/integration-jira`
**Status**: `platform in review`
**Created**: 2026-11-11
**Last updated**: 2026-11-11
**Owner**: platform maintainers
**Feature flag**: `JIRA_ENABLED` (platform, default off; exactly `true` loads the sync, as `LINEAR_ENABLED`); `NEXT_PUBLIC_INTEGRATION_JIRA_ENABLED` (Ever Teams, default off)

---

## 1. Overview

Organizations bring their work from Jira Cloud into the platform and keep it in sync, the
same way they do with Linear, Asana and Trello
([`../integrations-asana-linear-trello/spec.md`](../integrations-asana-linear-trello/spec.md)).

- **Connect:** a manager connects a Jira Cloud site.
- **Map:** they map Jira projects to platform projects. Each mapping has a status map (what each Jira status, or
  status category, becomes on the platform) and the issue types it brings in.
- **Import:** an import (streamed, resumable, reported) brings the issues in: summary, description, status,
  priority, assignee, labels, due date, sub-tasks, issue links, comments and attachments.
- **Sync:** changes then keep flowing both ways. Jira's webhooks deliver Jira's changes, and the platform's task
  changes move the issue's fields and its status, through the transition that leads where the task's status maps.
- **Conflicts:** a field changed on both sides is a conflict a manager resolves, exactly as with the other three
  providers.

The integration predates this feature as a Jira Connect app descriptor (lifecycle and webhook stubs). Those routes
keep answering as before, whether or not the sync is on.

## 2. User Scenarios

### 2.1 Primary scenarios

1. **Connect a site.**
   - A manager opens Integrations → Jira and chooses Connect.
   - They are sent to Atlassian, approve the app's access, and come back to the Jira page, connected.
   - When their account reaches several Jira sites, the page asks which site the connection works with. Nothing
     syncs until one is chosen.
2. **Map a project.** The manager picks a Jira project and a platform project, then:
   - picks the direction (in, out, both);
   - adjusts the status map. Each status category (to do, in progress, done) maps to a task status, and any Jira
     status can be mapped on its own;
   - optionally limits the issue types brought in.
3. **Import.** "Import now" brings every issue of the mapped project in (or only those changed since the last
   import). Each issue becomes a task once; a later import updates it. A run shows its counts and a report: pages
   read, comments, links, conflicts, and the issues it could not apply, each named by its key.
4. **Keep in sync.** A change in Jira reaches the task within moments through the site's webhook; without a
   public address the scheduled import picks it up every interval. A change on the platform (a status moved on
   the board, a renamed task) is sent to the issue when the mapping sends changes out.
5. **Resolve a conflict.** A field changed on both sides since they last agreed:
   - Jira's value is applied and the task's is kept in a conflict record.
   - The manager keeps Jira's value, or restores the task's (which is then sent to Jira when the mapping sends
     changes out).
6. **Disconnect.** The connection, its mappings and its webhook go. The tasks stay.

### 2.2 Edge cases & failures

- **Token stops working.** The connection's token expires or is revoked: the sync tries one renewal. When Atlassian
  refuses it, the connection waits for a person, and the person who connected and the organization's integration
  managers are told in their Inbox. Imports and webhooks of that connection pause until someone connects again.
- **Several sites.** A token that reaches several sites never picks one by itself.
- **Site of a mapped connection.** A connection with mappings keeps its site: it cannot be moved, and a reconnect
  keeps it (a reconnect whose token no longer reaches it saves nothing and says so). A mapping names its Jira
  project by an id only its site knows.
- **Unknown status.** A Jira status the map does not name follows its status category.
- **No reachable status.** When no transition the issue can take now reaches a status the task's status maps to,
  the issue's status is left as it is. The other fields are still sent.
- **Hidden e-mail.** An assignee whose e-mail Jira hides (their privacy settings) leaves the task's members as
  they were. An issue with no assignee leaves the task with none.
- **Retried delivery.** A webhook delivery Jira retries is applied once. A delivery whose apply failed is applied
  when Jira retries it.
- **Webhook expiry.** Jira expires a webhook 30 days after its registration or last refresh. The platform refreshes
  it before then, and registers it again when Jira no longer knows it.
- **Run stopped early.** A run stopped early (the safety cap, an error) continues where it stopped on the next
  import. An issue that could not be applied is read again next time.
- **Description round trip.** A description sent to Jira and read back is the same text in Jira's form; it never
  counts as a change on both sides.
- **Untrusted content.** Rich text from Jira never carries markup the task store does not allow (scripts, event
  handlers, `javascript:` links).

## 3. Functional Requirements

- **FR-1**: Connect with Jira Cloud OAuth 2.0 (3LO), bound to a single-use state; the token pair is stored with
  the connection, renewed before it expires, and rotated on every renewal.
- **FR-2**: The sites the token reaches are listed; one site is the connection's (chosen at once when there is one,
  by a person otherwise, and changeable).
- **FR-3**: Mappings of a Jira project to a platform project: direction, status map (by category and by status),
  issue types, switch; one mapping per Jira project of a connection; a project sends its tasks to one Jira project
  at most; a mapping that synced keeps its platform project.
- **FR-4**: Import every issue, or those changed since the last import, page by page; resumable; a report per run.
- **FR-5**: Fields: summary → title; description (rich text) → description; status → status by the map; priority →
  priority by name; assignee → member by e-mail; labels → tags; due date → due date (a calendar day); parent →
  parent task; issue links → linked tasks (blocks, clones, duplicates, relates to); comments → comments
  (attributed by e-mail, else named); attachments → links.
- **FR-6**: Webhooks: one dynamic webhook per connection for its inbound projects, verified on every delivery, each
  delivery applied once, refreshed before it expires, removed on disconnect.
- **FR-7**: Outbound: a task change edits the issue's fields and moves its status by the transition that reaches the
  mapped status; a new task of an outbound project creates its issue (of the mapping's first issue type, else the
  project's Task); nothing the sync writes inbound is sent back.
- **FR-8**: Sync conflicts recorded, listed and resolved as for the other providers.
- **FR-9**: Scheduled import every `JIRA_IMPORT_INTERVAL_MINUTES` (every fourth interval with webhooks), in the worker.
- **FR-10**: Inbox notice of a refused token to the person who connected and the integration managers.
- **FR-11**: The Connect descriptor routes keep answering, whatever `JIRA_ENABLED` says.
- **FR-12**: Angular and Ever Teams settings: connect, site choice, mappings with the status map editor, runs and
  their reports, conflicts, disconnect; hidden when the routes are not there.

## 4. Non-Functional Requirements

- Works on PostgreSQL, MySQL and SQLite with both ORMs; additive, plugin-owned, idempotent migrations.
- Off by default; off, nothing is loaded (no route, no table, no outbound request).
- Tokens never leave the server; every webhook delivery is authenticated before it is read.
- An import holds no database connection across a call to Jira; one apply at a time per issue across processes.

## 5. Key Entities & Domain Concepts

- **Connection**: the organization's connected Jira site (an integration tenant with its settings).
- **Project mapping**: Jira project ↔ platform project, with its status map and issue types.
- **Sync run**: one import or webhook application, its counts and report.
- **Sync conflict** and **issue baseline**: as for the other providers.

## 6. Out of Scope

- Jira Server / Data Center, and Jira Service Management request types.
- Sprints, boards, versions and work logs.
- Outbound comments, labels and attachments.
- Removing a platform link when the Jira link is removed.

## 7. Acceptance Criteria

- [ ] Connects (one site and several), maps, imports, re-imports without duplicates, against a test site.
- [ ] A Jira change arrives by webhook; a platform status change moves the issue by a transition.
- [ ] Conflicts are recorded and resolvable; descriptions round-trip without false conflicts.
- [ ] A refused token pauses the connection and files an Inbox notice.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `JIRA_ENABLED`.
- [x] Every functional requirement has a passing test with Jira mocked (the manual run against a live site is
      outstanding).

## 8. Open Questions

- None open. The conflict policy is the one the other providers use: the provider wins for mapped fields, and the
  task's value is kept in the record.

## 9. Constitution Gates

- [x] I Plugin-first — the sync is a plugin of `@gauzy/plugin-integration-jira` (+ `integration-jira-ui`), copying the two-way sync engine.
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive migrations (plugin-owned).
- [x] IV Default-off flags; nothing removed (the Connect routes stay).
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security — integration permissions, server-side tokens, verified webhooks, sanitized rich text.
- [x] VII Real-time — sync writes go through the platform's task commands.
- [x] VIII i18n and accessibility — settings UI strings in every locale.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Sibling: [`../integrations-asana-linear-trello/spec.md`](../integrations-asana-linear-trello/spec.md)
- Depends on: [`../inbox/spec.md`](../inbox/spec.md) (attention items)
- Consumers: Ever Teams `integrations-settings`
