# Feature Specification: Platform administration

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `platform-administration`
**Branch**: `feat/platform-administration`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_ADMIN_CONSOLE` (default off)

---

## 1. Overview

Two people run a Gauzy deployment and neither has a console today. The **installation operator** (a user named in
`EVER_OPERATOR_USER_IDS`, or the super admin of a single-tenant installation) cannot see which scheduled jobs ran or
failed, what workers and queues do, which errors users hit, how big the database is or whether a backup exists,
although the scheduler already writes a run ledger and a dead-letter store and the API answers health probes. The
**tenant administrator** has invitations, settings pages, feature switches, 13 interface languages and an onboarding
page, but no first-run wizard beyond creating an organization, no checklists or tours, no way to change a
translation, no backup to restore and no say over usage statistics. This feature adds the **administration
console**: for the operator a job and queue monitor, an error log, system health with history, database storage,
installation backups, retention, update notices, a profiler and a catalogue of safe operations; for the tenant
administrator a setup wizard, invitation and user pages, onboarding checklists and tours, navigation and home
settings, a settings hub, translation overrides and translated values, tenant backups with restore, statistics
choices and demo-mode controls. Surfaces: the Gauzy app (Settings → Administration), the REST API and SDKs, MCP tools.

**Advanced capabilities.** Health is kept as **history with thresholds and alerts**, not a snapshot read on open. A
**restore preview** shows per organization what a backup would bring back before anything is restored, and **restore
drills** restore the latest backup into a throw-away tenant on a schedule and report whether it was complete. An
**administrator assistant** explains a failed job or a recurring error from the ledger, the error and the owning
plugin's hints, and proposes a fix a person confirms. **Configuration snapshots** capture a tenant's configuration,
show a diff between two snapshots or environments and promote chosen changes. Persona answers **configure the
tenant** instead of only being counted, and an **adoption view** shows which features people use, computed inside the
installation.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a new tenant whose creator just signed up, **when** they open the app, **then** the setup wizard opens on its first unfinished step (language, country, time zone, currency), lets them skip any step, and after "consulting firm, 12 people, billing by the hour" proposes features and checklists; applying shows the home page with a "Get started" checklist of six steps, two already ticked.
- **Given** an administrator with `ORG_INVITE_EDIT`, **when** they paste 40 addresses with a role, **then** 38 invitations are sent, two existing members are reported "already a member", and each invitation shows as pending with its expiry, resendable and revocable.
- **Given** an employee, **when** they start the timer for the first time, **then** the checklist step "Start the timer" ticks itself from the time-log event and the checklist shows 4 of 6.
- **Given** a tenant administrator, **when** they author the tour "Raise your first invoice" on the anchors the invoice page offers and publish it to the role Accountant, **then** an accountant sees it once, can leave and resume it, and the administrator sees how many finished it.
- **Given** a tenant administrator, **when** they change the label "Clients" to "Customers" in German and English, **then** pages, menus and emails of that tenant show it after the next page load, other tenants are unchanged, and "reset to shipped text" restores the original.
- **Given** the operator on the jobs monitor, **when** they pause "invoice reminders" and run "outbox dispatch" now, **then** the pause holds on every process and the manual run appears in the ledger within seconds with their name.
- **Given** a dead letter of the inbox delivery queue, **when** the operator replays it, **then** the same payload is queued again, the row shows "replayed" with their name, and a second replay is refused.
- **Given** "500 on GET /api/invoices" 37 times in an hour, **when** the operator opens the error log, **then** it is one group with count, first and last seen, trace identifiers, number of tenants affected and the stack; resolved, it reopens on an occurrence in a later release.
- **Given** the threshold "outbox backlog above 5,000 for 10 minutes", **when** the backlog stays high, **then** the operator gets an inbox item and an email, the series turns red, and the alert closes itself when the backlog falls.
- **Given** a nightly tenant backup kept 7 times, **when** the administrator opens "Restore preview" for organization "Acme UK" from last Tuesday, **then** they see per record type the records that would be added back, changed back or removed, with samples, and nothing changes until they restore.
- **Given** a monthly restore drill, **when** it runs, **then** the latest backup is restored into a temporary tenant nobody can sign in to, compared with the manifest, removed, and the report says "complete, 412,331 records, 6 min".
- **Given** a failed run of "subscription billing", **when** the operator asks the assistant why, **then** it answers with the cause from the ledger and the error group, the records involved and a proposed step, and changes nothing by itself.
- **Given** stage and production installations, **when** the administrator compares a configuration snapshot of stage with production, **then** they see added, changed and removed items per area and promote three of them, each previewed and recorded.

### 2.2 Edge cases & failures

- **Given** a tenant administrator who is not the operator, **when** they call a jobs, workers, errors, health, storage or installation-backup route, **then** `403`; with the feature off every console route answers `404` and today's settings pages behave as before.
- **Given** a multi-tenant installation without `EVER_OPERATOR_USER_IDS`, **then** installation pages say no operator is named and nobody can act there, as global settings already behave.
- **Given** two operators changing the same job at once, **then** the second change is refused with `409` naming the version it read.
- **Given** a job paused while a run is in flight, **then** that run finishes, no further tick starts, and skipped ticks are recorded as "paused", not as overlaps.
- **Given** a worker silent for 2 minutes, **then** it is shown as lost with its last jobs, and its running ledger rows are closed as interrupted by the existing staleness rule.
- **Given** a restore while users are signed in, **then** the tenant goes read-only with a banner, a safety backup is taken first, and a failure half-way restores the safety backup and is reported.
- **Given** an unreachable backup target, **then** the run fails with the target's error, previous copies are kept, the administrator is notified, and no partial backup counts as a copy.
- **Given** a backup taken on PostgreSQL, **when** restored into a tenant of a SQLite installation, **then** it succeeds (tenant backups are logical); an installation database backup restores only into the same dialect and says so first.
- **Given** a translation override that drops the placeholder `{{ count }}`, **then** saving is refused naming it.
- **Given** a tour whose anchor a later release removed, **then** the step is skipped, the tour continues, and the editor marks "anchor missing".
- **Given** a tenant that declined usage statistics, **then** nothing of that tenant leaves the installation even when the operator keeps the anonymous report on.
- **Given** the demo installation with the operator's demo protections and outbound capture on, **when** a visitor changes the demo administrator's password or email, **then** it is refused as protected, and outbound email is captured, not sent; with them off the demo behaves as today.
- **Given** a profiler session left on, **then** it stops by itself after 15 minutes.

## 3. Functional Requirements

### 3.1 Console and scope

| ID | Requirement |
| --- | --- |
| **FR-1** | The system MUST offer an administration console under Settings with two scopes: installation pages, open only to the installation operator (the existing operator rule of global settings) holding the page's permission, and tenant pages, open to holders of the page's permission in the tenant. |
| **FR-2** | The system MUST show on the console home the state of each area (setup, onboarding, jobs, errors, health, backups, telemetry, translations) as a card with its count of open problems and a link. |
| **FR-3** | The system MUST record every change made in the console (who, when, before, after, scope) in the platform audit and refuse a change made with a stale version with `409`. |
| **FR-4** | The system MUST push changes of console state (job runs, alerts, backup progress, checklist progress) to open pages through the platform real-time channel. |
| **FR-5** | The system MUST, with the feature off, load no console route, menu entry or job, and keep the existing pages (invitations, features, file storage, monitoring, usage statistics, what's new, danger zone) working as today; the shell additions (tours, "Get started" card, help panel, empty-state panels, announcement bar, menu counts, navigation layers, translation overrides, plan and trial header) appear only for tenants with the feature on, and the jobs of this feature act only on those tenants' data. |

### 3.2 Setup wizard

| ID | Requirement |
| --- | --- |
| **FR-6** | The system MUST open the setup wizard for a tenant administrator of a tenant whose wizard is neither completed nor dismissed, on the first unfinished step, and allow skipping each step and the whole wizard. |
| **FR-7** | The system MUST offer core steps: language and region (language, country, time zone, currency, date and number formats), first organization (handed to the organization setup assistant of `organization-setup`), team (invitations), data (links to import and to sample data), usage statistics choice, and the persona questions. |
| **FR-8** | The system MUST let each plugin contribute steps with an order, a completion test and a "not applicable" test, and show contributed steps only when their feature is on. |
| **FR-9** | The system MUST save each step as soon as it is applied, resume after sign-out or failure, apply a step at most once however often it is submitted, and report a failing step with its reason while keeping the applied ones. |
| **FR-10** | The system MUST ask persona questions (industry, size, how the tenant earns: hourly, fixed price, subscriptions, goods; what it wants to do first: track time, invoice, sell, make, support customers) and store the answers on the tenant, visible and editable by its administrators. |
| **FR-11** | The system MUST turn persona answers into a proposal (features to switch on, checklists to assign, navigation preset) shown as a preview and applied only on confirmation. *(advanced)* |
| **FR-12** | The system MUST, on a fresh self-hosted installation with no tenant, run an installation step for the operator: public address, outbound email check, file storage check, tenant registration open or closed, and the anonymous statistics choice. |
| **FR-13** | The system MUST seed, when a tenant is created and when a feature is switched on, the reference records each plugin declares (statuses, types, priorities, groups, default roles and role bundles, templates), only those missing, in the background with a result per plugin. |
| **FR-14** | A user with `ADMIN_SETUP_RUN` can re-open the wizard, see each step as done, skipped, missing or not applicable, and re-run the seeding of missing reference records with a preview of what would be added. |

### 3.3 Invitations and user administration

| ID | Requirement |
| --- | --- |
| **FR-15** | The system MUST keep the existing invitations (email, role, organization, projects and teams, expiry, accept, reject, resend, revoke) and show them on one invitations page with status filters (pending, accepted, rejected, expired, revoked). |
| **FR-16** | A user with `ORG_INVITE_EDIT` can invite in bulk by pasting addresses or uploading a file, with one role, access profile and organization per batch, through the existing invitation flow and page; the system MUST report per address: sent, already a member, invalid, already invited (resend offered). |
| **FR-17** | A user with `ORG_INVITE_EDIT` can add an existing user of the tenant to an organization without an invitation, and set the default invitation expiry per organization (existing setting, default 7 days). |
| **FR-18** | The system MUST mark lapsed invitations expired daily and remind the inviter of invitations pending for more than half their life once. |
| **FR-19** | The system MUST extend the existing users page with sign-in status, last sign-in, roles, organizations, user type and invitation origin, filters and bulk actions (deactivate, end sessions, force a password change, change role) that call the user and sign-in policy actions owned by `access-control-and-security`; there is one users page. |
| **FR-20** | The system MUST show per invitation and per user who invited whom and when, and count accepted invitations per inviter for the adoption view. |

### 3.4 Onboarding checklists, tours, hints and help

| ID | Requirement |
| --- | --- |
| **FR-21** | The system MUST show a "Get started" checklist per user built from the checklists assigned to their roles, each step one of: create a record of a type, change a setting, open a page, start a tour, read or watch a help item, run a report. |
| **FR-22** | The system MUST tick creation, update and report steps automatically from platform events and keep a manual tick for the others; progress is per user, or per tenant for steps marked shared. |
| **FR-23** | A user with `ADMIN_ONBOARDING_MANAGE` can assign, reorder, hide and add steps to the checklists plugins ship, restrict a checklist to roles, and reset a user's progress. |
| **FR-24** | A user with `ADMIN_ONBOARDING_MANAGE` can author a tour as ordered steps (title, text, position, anchor, "next on click", condition to continue) on the named anchors pages declare, chain tours, and publish a tour to roles or to everyone. |
| **FR-25** | The system MUST show a published tour once per user unless restarted, remember the step reached, skip a step whose anchor is missing and mark it in the editor. |
| **FR-26** | The system MUST let a tour on a record type end by keeping the record the user created during it, or by discarding it. |
| **FR-27** | The system MUST compute an activation level per organization from its first records (first contact, project, invoice, time log, and the milestones plugins declare) and show the next hint on the home page until the level is complete or the hints are dismissed. |
| **FR-28** | The system MUST show an empty-state panel on lists that have no record yet, offering: create one, import, start the related tour, and add sample data through `organization-setup`. |
| **FR-29** | The system MUST offer a help panel on every page with help items registered for that page (documentation links, articles of the internal knowledge base, tours, videos), a search over all help items, and the existing Help and About pages. |
| **FR-30** | A user with `ADMIN_ONBOARDING_MANAGE` can add the tenant's own help items to a page (link or knowledge-base article). |
| **FR-31** | The system MUST report checklist and tour completion per step, role and organization. |

### 3.5 Navigation, home and counts

| ID | Requirement |
| --- | --- |
| **FR-32** | A user with `ADMIN_NAVIGATION_MANAGE` can arrange the main menu for the tenant and per role or access profile: reorder and rename entries, group them, add separators and links (an internal route or an address, same or new window, icon), and restore the shipped arrangement. Which areas and pages a tenant, role or profile may reach at all is decided by the page gates of `access-control-and-security`; this arrangement never shows a gated entry. |
| **FR-33** | The system MUST layer navigation as shipped, tenant, role or access profile, and user; each user can pin, reorder and hide entries for themselves within what their layers show, and an entry hidden by permission, feature or page gate is never shown. |
| **FR-34** | A user with `ADMIN_NAVIGATION_MANAGE` can edit the header menus (help and user menus): add, hide and reorder items, and restore defaults. |
| **FR-35** | The system MUST keep the app switcher listing the Ever apps of the deployment and let the tenant add its own app links to it. |
| **FR-36** | A user with `ADMIN_NAVIGATION_MANAGE` can set the default landing page per role and access profile and a home page of tiles (shortcut to a list, a create form, a report, a dashboard or an address, optionally with a count); a landing page the user may not reach falls back to the next layer. |
| **FR-37** | The system MUST show counts on menu entries that plugins declare (for example open tasks assigned to me, drafts awaiting my approval, tickets waiting), computed per user, cached for 60 s and refreshed by real-time events. |
| **FR-38** | The system MUST show an announcement bar from a broadcast marked "banner", to its audience, until its end date or until each user dismisses it. |
| **FR-39** | The system MUST return, at session start, in one call, what the client needs to render: enabled features, tenant and organization settings for display, user preferences, navigation layers, counts and pending announcements. |

### 3.6 Settings hub and installation configuration

| ID | Requirement |
| --- | --- |
| **FR-40** | The system MUST offer one settings hub listing every settings page of the core and of enabled plugins, grouped by area, searchable by name and by the settings each page holds, filtered by the user's permissions. |
| **FR-41** | The system MUST show tenant features and deployment switches on one page, the existing features page: tenant and organization features (editable as today) and a section of the deployment switches that gate code paths (read-only, with their value and where it comes from). |
| **FR-42** | The system MUST offer the operator an installation settings page listing effective non-secret configuration (limits, upload sizes, rate limits, registration, public address, demo mode, queue mode) with the source of each value (environment, global setting, default), editable where the platform reads it from global settings. |
| **FR-43** | The system MUST never show a secret value on any console page; secrets show as "set" or "not set". |
| **FR-44** | The system MUST keep the existing monitoring page (error tracking and product analytics connection settings, global and tenant) and link it from the error log and the telemetry page. |
| **FR-45** | The system MUST keep tenant and organization settings pages and list in the hub the settings each plugin contributes as its own section. |
| **FR-46** | The system MUST, for the hosted cloud installation only, show the tenant's plan, trial days left and a link to billing in the header and on the hub; self-hosted installations show none of it. |

### 3.7 Translations

| ID | Requirement |
| --- | --- |
| **FR-47** | A user with `ADMIN_TRANSLATIONS_MANAGE` can enable and disable interface languages for the tenant among those shipped, set the default language, and see per language the share of keys translated. |
| **FR-48** | A user with `ADMIN_TRANSLATIONS_MANAGE` can override the text of any interface key per language for the tenant, search keys by key or text, filter by area, plugin and "overridden", and reset an override to the shipped text. |
| **FR-49** | The system MUST refuse an override that removes or adds a placeholder of the shipped text, or contains markup outside the allowed inline set, naming the problem. |
| **FR-50** | The system MUST apply overrides to the Angular app, the React UI plugins, emails rendered from templates and print templates of the tenant, within one page load after saving, without a release. |
| **FR-51** | A user with `ADMIN_TRANSLATIONS_MANAGE` can export overrides and missing keys of a language as a file and import a translated file with a preview of new, changed and refused rows. |
| **FR-52** | The system MUST let each plugin mark text fields of its records as translatable; a user with the record's edit permission can enter a value per enabled language, and lists, forms, prints and the API show the value in the reader's language, falling back to the default language. |
| **FR-53** | The system MUST keep the existing product translations working and expose them through the same translated-values mechanism. |
| **FR-54** | A user can propose a translation for a key from the page where it appears; proposals wait for review by `ADMIN_TRANSLATIONS_MANAGE` (accept, change, reject) and accepted ones become overrides. |
| **FR-55** | The system MUST suggest translations for missing keys and translatable values with the tenant's configured AI provider, marked as suggestions until a person accepts them; without a provider the button is hidden. *(advanced)* |

### 3.8 Usage telemetry controls

| ID | Requirement |
| --- | --- |
| **FR-56** | The system MUST keep the installation's anonymous usage report (on unless the deployment switch is `false`, operator page with preview, last payload and send now) and add the per-tenant choice to it. |
| **FR-57** | A user with `ADMIN_TELEMETRY_MANAGE` can choose for the tenant: share anonymous usage with the installation report (default on), send product-analytics events to the configured analytics services (this choice is the tenant's existing analytics setting of the monitoring page, so its default is what that setting resolves to today: a tenant that sends events today keeps sending them), and share persona answers (default off); the wizard asks the same once. |
| **FR-58** | The system MUST record usage milestones inside the installation (first record of each type, first use of each feature, plugin-declared events such as a ticket created or a pay run confirmed) as counters per tenant and organization, without personal data, named as the installation's usage report names them. These counters live in the platform's one usage meter, which other features count in as well (AI tokens and cost, agent and credential budgets). |
| **FR-59** | The system MUST send no event, counter or persona answer of a tenant out of the installation unless that tenant's choice allows it (the installation's usage report leaves out a tenant that does not share), and MUST list on the telemetry page exactly what is sent, with the usage report's own preview. |
| **FR-60** | The system MUST give administrators an adoption view: features used per organization and week, active users per feature, checklist completion and invitation acceptance, computed from the counters. *(advanced)* |
| **FR-61** | The system MUST stop collecting a tenant's analytics events within one minute of the tenant opting out and delete the tenant's stored counters on request. |
| **FR-62** | The system MUST let the operator turn the installation report off and see why nothing is sent (switch off, no tenant allows it, network blocked). |

### 3.9 Scheduled jobs, workers and queues

| ID | Requirement |
| --- | --- |
| **FR-63** | The system MUST list every registered scheduled job of every running process (id, name, owner plugin, description, schedule, queue or inline, enabled, paused, running now, last run, next run, last outcome, success rate over 14 days). |
| **FR-64** | The system MUST show a job's ledger (attempt, trigger, status, start, duration, node, error, counters) newest first with filters by status, trigger and date, and a chart of runs and durations per day. |
| **FR-65** | A user with `ADMIN_JOBS_MANAGE` can pause and resume a job, which takes effect on every process within one tick; paused ticks are recorded as skipped with the reason "paused". |
| **FR-66** | A user with `ADMIN_JOBS_MANAGE` can override a job's schedule with another schedule expression or interval, validated before saving, and clear the override; the job's declared schedule stays visible. |
| **FR-67** | A user with `ADMIN_JOBS_MANAGE` can run a job now; the run is recorded with the trigger "manual" and the operator's name, and is refused with `409` while another run of the job is live. |
| **FR-68** | The system MUST show workers (node, process, start time, version, last heartbeat, jobs running, queues served) and mark a worker lost after 2 minutes without a heartbeat. |
| **FR-69** | The system MUST show each queue's waiting, active, delayed, completed and failed counts, its oldest waiting job age and throughput per minute, when the deployment runs queues, and say "inline mode" otherwise. |
| **FR-70** | The system MUST list dead letters (queue, job, attempts, failure, payload size) with filters, show the payload to the operator, replay one or a selection (each at most once), and discard with a required reason, as the existing store defines. |
| **FR-71** | The system MUST show the event outbox backlog, failed rows and consumer lag per consumer, and webhook deliveries failing per endpoint, linking to their existing pages. |
| **FR-72** | The system MUST show users the progress of their own long operations (imports, exports, backups, bulk actions, reports) in a panel with stage, percentage, cancel where the operation allows it and retry for a failed one; every long operation of the platform, the console's catalogue operations, backups and restores included, is one of the platform's operations and appears there. |

### 3.10 Error log

| ID | Requirement |
| --- | --- |
| **FR-73** | The system MUST record every server error answered with status 500 or above, every failed job run and every exhausted delivery as an error occurrence with time, trace identifier, route or job, tenant, organization, user, release and a bounded stack. |
| **FR-74** | The system MUST group occurrences by fingerprint (error type, normalised message, top frames) and show per group the count, first and last seen, releases, tenants affected (count) and a chart per hour. |
| **FR-75** | A user with `ADMIN_ERRORS_VIEW` (operator) can mark a group seen, resolved or ignored; a resolved group reopens when it occurs in a later release; an ignored group stops alerting. |
| **FR-76** | The system MUST show a tenant administrator the errors of their own tenant without stacks, and never show one tenant's errors to another. |
| **FR-77** | The system MUST link an occurrence to the record it concerns when the route names one, and to the job run or delivery that failed. |
| **FR-78** | The system MUST strip secrets, tokens and request bodies from stored occurrences and keep only the first 4 KB of a stack. |

### 3.11 System health and storage

| ID | Requirement |
| --- | --- |
| **FR-79** | The system MUST show a health page: database, cache, queue store and file storage reachability with latency; real-time channel; scheduler state and failing jobs; workers and queues; outbox and webhook backlog; outgoing email failures and pending count; error groups of the last 24 h; last successful backup; users, active sessions, failed sign-ins and last active users; release of API, worker and web app. |
| **FR-80** | The system MUST sample the health signals every 5 minutes and keep 30 days of history, shown as series per signal. *(advanced)* |
| **FR-81** | A user with `ADMIN_HEALTH_MANAGE` (operator) can set thresholds per signal (value, duration, severity) and recipients; the system MUST open an alert when a threshold is passed for its duration, notify by inbox and email, and close it when the signal recovers. *(advanced)* |
| **FR-82** | The system MUST ship default thresholds: a job failing three runs in a row, a worker lost, outbox backlog above 5,000 for 10 minutes, no successful backup for 36 hours, free disk under 10 %, error rate above 5 per minute. *(advanced)* |
| **FR-83** | The system MUST show database storage: total size and the largest tables with rows, data and index size, per dialect (PostgreSQL, MySQL, SQLite). |
| **FR-84** | A user with `ADMIN_OPERATIONS_RUN` (operator) can start a maintenance pass on a table (statistics refresh and space reclaim as the dialect allows) as a background operation, one at a time, refused during a backup. |
| **FR-85** | The system MUST keep the public liveness and readiness probes unchanged and add no dependency to the liveness probe. |
| **FR-86** | The system MUST show storage use of files per tenant (count and size by storage provider) when the provider reports it. |

### 3.12 Backups and restore

| ID | Requirement |
| --- | --- |
| **FR-87** | A user with `ADMIN_BACKUPS_MANAGE` can define the tenant's backup policy: schedule (default daily at 02:00 in the tenant's time zone), copies kept (default 7), target (a storage or backup target from `integration-hub`, default the tenant's file storage), encryption with a tenant key (default on), and what is included (data, files; default both). |
| **FR-88** | The system MUST take a tenant backup as a logical, dialect-independent archive of every record of the tenant and, when chosen, its files, with a manifest of counts and checksums per record type, and refuse to count a backup whose manifest does not verify. |
| **FR-89** | The system MUST keep the newest copies up to the policy, delete older ones from the target, and keep a backup protected by a person (pinned) until it is unpinned. |
| **FR-90** | A user with `ADMIN_BACKUPS_MANAGE` can start a backup now, see running and past backups with size, duration and result, and download one (a link valid 24 h, emailed for large archives). |
| **FR-91** | A user with `ADMIN_RESTORE_RUN` can restore a backup into a new tenant (a copy for inspection), or into the same tenant: the system MUST take a safety backup, put the tenant in read-only mode with a banner, restore, verify against the manifest, and on failure restore the safety backup and report. |
| **FR-92** | The system MUST refuse a restore of a backup made by a newer release than the installation, and migrate a backup made by an older release forward during the restore. |
| **FR-93** | The system MUST show, before restoring, a restore preview for the whole tenant or one organization: per record type the records the backup would add back, change back or remove, with samples and a downloadable list. *(advanced)* |
| **FR-94** | A user with `ADMIN_RESTORE_RUN` can restore one organization from a backup into the same tenant, limited to that organization's records, after the preview. *(advanced)* |
| **FR-95** | The system MUST run restore drills on a schedule (default monthly): restore the latest backup into a temporary tenant nobody can sign in to, compare counts and checksums, remove the temporary tenant, and keep a drill report with duration and differences. *(advanced)* |
| **FR-96** | The system MUST offer the operator installation database backups where the deployment allows them: a consistent file copy for SQLite, and a configured dump command for PostgreSQL and MySQL behind a deployment switch; otherwise the page shows the last backup reported by the outside backup system through a signed status endpoint. |
| **FR-97** | The system MUST notify the policy's recipients of a failed backup or drill, and show the age of the last good backup on the health page and the console home. |

### 3.13 Retention, update notices, operations, profiler and demo mode

| ID | Requirement |
| --- | --- |
| **FR-98** | The system MUST declare each log kind (job ledger, discarded dead letters, error occurrences, health samples, call logs, delivered outbox rows, idempotency keys, expired invitations, operation runs, profiler sessions) with a shipped default to the platform's one retention model of `access-control-and-security`, where the tenant administrator changes it within the operator's bounds; the operator sets installation defaults for logs without a tenant here; purging runs daily with a report, and without that feature the shipped defaults apply. A shipped default equals what the platform keeps today: kinds purged today keep their current period, and kinds nothing purges today (expired invitations, call logs, delivered outbox rows, discarded dead letters) ship as "keep" until an administrator sets a period. |
| **FR-99** | The system MUST check weekly, unless switched off by the operator, whether a newer release exists, tell the operator in the console and inbox, and show users the existing "What's new" entries of their release once. |
| **FR-100** | A user with `ADMIN_OPERATIONS_RUN` (operator) can run operations from a catalogue (clear caches, rebuild search indexes, re-seed missing reference records of a tenant, re-send pending outbox rows, recompute counts, verify a backup), each with a description, a preview of its scope, a confirmation, progress and a result. |
| **FR-101** | The system MUST NOT offer arbitrary code or write queries from the console; a read-only diagnostic query page MAY be enabled by the deployment switch `GAUZY_ADMIN_QUERY_CONSOLE_ENABLED` (self-hosted only), running in a read-only transaction with a 10 s timeout and 1,000-row cap, every query audited. |
| **FR-102** | A user with `ADMIN_OPERATIONS_RUN` (operator) can start a profiler session (at most 15 minutes) that records, for chosen routes or jobs, duration, query count and time, the slowest queries with their plan, and proposes missing indexes; sessions stop by themselves. |
| **FR-103** | The system MUST list the plugins loaded by each process with version, source and enabled state, read from the plugin registry. |
| **FR-104** | The system MUST, in demo mode, keep the sign-in helper with the demo accounts and their protection from deletion as today, and, when the operator switches on the demo protections (installation setting, default off), also protect them from password, email, second-factor and role changes. |
| **FR-105** | The system MUST, in demo mode with the operator's outbound capture switched on (installation setting, default off, so the demo sends as today), capture outgoing email, text messages and webhook calls in a log visible to the operator instead of sending them, and show a banner with the next reset time. |
| **FR-106** | The system MUST, when the operator schedules it (default off, so an existing reset arrangement stays in charge), reset a demo installation on a schedule from its seed, with the reset recorded as an operation. |
| **FR-107** | The system MUST keep hiding in demo mode what is hidden today (the danger zone), never offer restore into the same tenant there, and hide raw export there only when the operator's demo protections are on. |

### 3.14 Configuration snapshots, assistant, API and compatibility

| ID | Requirement |
| --- | --- |
| **FR-108** | A user with `ADMIN_CONFIG_SNAPSHOTS_MANAGE` can take a configuration snapshot of the tenant: settings, features, roles and permissions, navigation, translation overrides, checklists and tours, and what each plugin declares as configuration (custom fields, workflows, numbering series, templates, automation rules), without business records or secrets. *(advanced)* |
| **FR-109** | The system MUST show the difference between two snapshots, or between a snapshot and the tenant now, per area and item (added, changed, removed), and export a snapshot as a signed file. *(advanced)* |
| **FR-110** | A user with `ADMIN_CONFIG_SNAPSHOTS_MANAGE` can promote chosen items of a snapshot (or of a file from another installation) into the tenant after a preview; each item is applied through its owner's normal validation, failures are listed without stopping the others, and a snapshot is taken before applying. *(advanced)* |
| **FR-111** | The system MUST take a configuration snapshot automatically before each wizard proposal, translation import and promotion, kept 30 days. *(advanced)* |
| **FR-112** | The system MUST offer an administrator assistant that explains a failed job run, a dead letter, an error group, an alert or a failed backup from the ledger, the error, recent changes and the hints the owning plugin registers, and proposes next steps or a catalogue operation that a person confirms. *(advanced)* |
| **FR-113** | The system MUST give the assistant only read access plus the operations the asking user may run, require confirmation for each operation, and mark its actions as agent actions in the audit. *(advanced)* |
| **FR-114** | The system MUST expose every console action through the REST API with idempotency keys on creating and running calls, cursor pagination on lists, and previews for restore, promotion, re-seeding and operations. |
| **FR-115** | The system MUST offer MCP tools to read jobs, runs, dead letters, errors, health and alerts, backups and drills, onboarding progress and translations, and to run, replay, back up, preview a restore and promote with `preview: true` by default. |
| **FR-116** | The system MUST publish console events (job failed, alert opened and closed, backup finished or failed, drill finished, wizard completed, checklist completed, error group new or reopened) for automation rules, webhooks and the real-time channel. |
| **FR-117** | The system MUST work on PostgreSQL, MySQL and SQLite with both ORMs, in multi-tenant cloud and self-hosted single tenant, with and without a queue store. |

### 3.15 Reports

All reports are report definitions: filterable, groupable, exportable, schedulable and clonable.

| Requirement | Report | Answers | Filters and grouping |
| --- | --- | --- | --- |
| **FR-118** | Job runs | Which jobs ran, failed or were skipped, how long did they take? | dates, job, plugin, status, trigger, node; by job or day |
| **FR-119** | Errors | Which errors happen most, since when, in which release? | dates, group, status, release, route or job |
| **FR-120** | Health history | How did each health signal and alert develop? | dates, signal, severity |
| **FR-121** | Database storage | Which tables use the most space and how fast do they grow? | date, table; top N |
| **FR-122** | Backups and drills | Which backups and drills ran, with size, duration and result? | dates, tenant (operator), kind, result |
| **FR-123** | Onboarding and adoption | How far are users in checklists and tours, which features are used? | dates, organization, role, checklist, feature |
| **FR-124** | Translations | How complete is each language, how many overrides and pending proposals? | language, area, plugin |

## 4. Non-Functional Requirements

- **Performance**: console home under 500 ms at the 95th percentile; jobs list under 300 ms with 200 jobs and 5 million
  ledger rows (served from a per-job summary maintained on each run); error log list under 300 ms with 10 million
  occurrences; health sample collection under 2 s per process; session-start call under 250 ms; translation overrides
  add under 20 ms to a page load (cached per tenant and language, invalidated on save).
- **Backups**: a tenant of 5 million records and 20 GB of files backs up within 60 minutes with streaming (constant
  memory under 512 MB); restore of the same within 90 minutes; a drill of a 1-million-record tenant within 20 minutes.
- **Data volume and concurrency**: one backup or restore per tenant at a time, one maintenance pass per installation
  at a time; console writes carry versions (`409` on conflict); manual runs refused while a run is live.
- **Reliability**: a console that cannot reach the queue store still shows the ledger; heartbeats and samples are
  best effort and never block a job; an alert is sent at least once and at most once per opening.
- **Security & privacy**: installation pages for the operator only; error stacks and dead-letter payloads only to the
  operator; secrets never shown or exported; backups encrypted at rest with a per-tenant key kept outside the backup;
  telemetry leaves the installation only with consent and only in the documented shape; persona answers are tenant
  data, exportable and erasable.
- **Observability and audit**: every console change audited with before and after; operations, backups, restores,
  drills and profiler sessions kept as runs with results.
- **Accessibility and localization**: keyboard-operable console, labelled charts with table alternatives, tour steps
  readable by screen readers and dismissible with Escape; all strings in every shipped locale; times in the viewer's
  time zone.
- **Compatibility**: PostgreSQL, MySQL and SQLite; both ORMs; additive API and SDK changes.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Installation operator | The person who runs the server, as the existing global-settings rule defines |
| `JobExecution`, `JobDeadLetter` (existing) | One attempt of a scheduled job; one job that exhausted its attempts |
| `AdminJobSummary` | Per job: last run, next run, success rate, maintained on each run |
| `AdminJobControl` | Operator's pause and schedule override of a job |
| `AdminJobRunRequest` | A request to run a job now, picked up by the process that holds it |
| `AdminWorkerHeartbeat` | A process's latest report: jobs, queues, version, time |
| `AdminErrorGroup`, `AdminErrorOccurrence` | A fingerprinted kind of error and each time it happened |
| `AdminHealthSample`, `AdminHealthThreshold`, `AdminHealthAlert` | A measured signal at a time; a rule on a signal; an opened alert |
| Backup policy, `AdminBackup`, `AdminRestore`, `AdminRestoreDrill` | Backup settings of a tenant; one archive with its manifest; one restore; one drill and its report |
| `AdminSetupState`, persona | Wizard progress and the answers that describe a tenant |
| `AdminChecklist`, `AdminChecklistProgress` | A list of onboarding steps for roles; a user's progress through it |
| `AdminTour`, `AdminTourProgress` | Steps on page anchors; a user's place in a tour |
| Navigation layout | Menu and home arrangement of a tenant, role, access profile or user (never deciding access) |
| `AdminTranslationOverride`, `AdminTranslationProposal` | Tenant text for an interface key; a proposed text awaiting review |
| `TranslatedValue` | A record field's text in one language |
| Telemetry choices, usage counter | A tenant's statistics settings; a counted milestone in the platform's usage meter |
| Retention kind | A log kind declared with its default period to the platform retention model |
| Operation, `AdminProfilerSession` | One catalogue operation run as a platform operation; one profiling window |
| `AdminConfigSnapshot` | A captured configuration of a tenant |
| `AdminAssistantFinding` | An explanation and proposed step for a failure |

## 6. Out of Scope

- Sign-in policies, sessions, impersonation, deactivation rules, role bundles, page gates, retention policies and the
  audit trail itself: `access-control-and-security` (this spec surfaces its actions on the users page and arranges
  menus within its gates); security contact publication: `access-control-and-security`.
- Storage and backup targets, connected accounts and their credentials: `integration-hub`.
- The organization setup assistant, industry templates and sample data of an organization: `organization-setup`.
- Recycle bin, archiving of business records, mapped import and export: `data-import-export`.
- User-defined scheduled flows and reminders: `automation-and-notifications`.
- Report and dashboard engine: `report-builder-and-dashboards` (this spec registers definitions).
- Installing, updating and paying for marketplace apps: the Ever Platform spec `app-installs-and-licensing`.
- Saved views and pinned views of lists: `record-views-and-search`.

## 7. Acceptance Criteria

- [ ] **AC-1** A new tenant sees the wizard, skips two steps, resumes after sign-out; the persona proposal switches on features only after confirmation; a contributed step appears only with its feature on (FR-6, FR-8, FR-9, FR-11).
- [ ] **AC-2** A bulk invitation of mixed addresses reports each address; lapsed invitations turn expired; users-page bulk actions call the access-control actions and are audited (FR-16, FR-18, FR-19).
- [ ] **AC-3** A checklist step ticks itself from an event; a tour on named anchors resumes and skips a missing anchor; completion appears in the onboarding report (FR-22, FR-24, FR-25).
- [ ] **AC-4** Navigation layers (tenant, role, user) combine as specified; restore defaults works; counts update in real time; a banner broadcast shows and is dismissible (FR-33, FR-37).
- [ ] **AC-5** A translation override shows in the app, an email and a print of that tenant only; a missing placeholder is refused; a translated record value shows in the reader's language with fallback (FR-47, FR-49).
- [ ] **AC-6** A tenant that opts out sends nothing; the preview matches what is sent; the adoption view shows counters (advanced, adoption) (FR-59, FR-62).
- [ ] **AC-7** The jobs monitor lists jobs of API and worker; pause, schedule override and run now take effect and are in the ledger; a dead letter replays once; a lost worker is shown (FR-65–FR-67, FR-70).
- [ ] **AC-8** A server error and a failed job form groups; resolve and reopen on a later release behave; a tenant administrator sees only their tenant's errors, without stacks (FR-73, FR-75, FR-76, FR-119).
- [ ] **AC-9** Health history is sampled, a default threshold opens and closes an alert with notifications (advanced, health); database storage lists tables on all three dialects (FR-80–FR-82).
- [ ] **AC-10** A tenant backup verifies against its manifest, rotates copies and restores into a new tenant on another dialect; a failed same-tenant restore rolls back to the safety backup (FR-88, FR-91, FR-93).
- [ ] **AC-11** A restore preview for one organization lists differences, a single-organization restore changes only that organization, and a drill produces its report (advanced, restore) (FR-93, FR-94).
- [ ] **AC-12** The assistant explains a seeded failed job and proposes an operation that runs only after confirmation (advanced, assistant) (FR-112, FR-113).
- [ ] **AC-13** A configuration snapshot diff between two tenants is correct and a promotion applies chosen items after a prior snapshot (advanced, snapshots) (FR-109–FR-111).
- [ ] **AC-14** Demo mode with the operator's switches on protects the demo accounts, captures email and resets on schedule; with them off it behaves as today (FR-104–FR-106).
- [ ] **AC-15** The seven reports of §3.15 return figures that agree with the ledger, error and backup records.
- [ ] **AC-16** Non-operator `403`, flag off `404`, stale version `409`, run-now while running `409` (FR-5, FR-67).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs.
- [ ] Behind `FEATURE_ADMIN_CONSOLE`; nothing changes while the flag is off.
- [ ] All functional requirements have a passing test.
- [ ] **AC-17** With the feature on and nothing configured, no existing record is purged (expired invitations stay listed), a tenant that sends product-analytics events today keeps sending them, and the demo installation sends email and allows the same changes as today; with the feature off the header, menu, home page and settings pages are unchanged (FR-98).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-5).

## 8. Open Questions

- Installation database backups for PostgreSQL and MySQL rely on a configured dump command behind a deployment
  switch (applied); managed clusters keep their own backups and report status through the signed endpoint.
- The read-only query page is off and self-hosted only (applied).
- Tenant usage sharing defaults to on, persona sharing to off, and analytics events keep the default of the tenant's
  existing analytics setting, so a tenant that sends events today keeps sending them (FR-57) (applied).
- Restore into the same tenant replaces all its records; per-organization restore is the finer tool (applied).
- Update checks ask the Ever Platform release feed weekly (applied); air-gapped installations switch it off.
- Shop floor and other domain roles are seeded through the reference-record contributions of FR-13 (applied); each
  domain spec names its own roles.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `admin-console` with its UI plugin; core ledger, dead letters, health, invitations, settings and statistics are reused through their services and three optional seams.
- [x] II Tenant/organization scoping — tenant pages on tenant data; installation records carry no tenant and are readable only by the operator.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_ADMIN_CONSOLE`; existing pages and probes unchanged.
- [x] V Contracts and API first; backwards compatible — REST and contracts before UI; additive only.
- [x] VI Permissions, privacy, security — separate keys, operator rule, secrets never shown, telemetry by consent.
- [x] VII Real-time through the event bus — console events on the outbox and the real-time channel.
- [x] VIII i18n and accessibility — strings in every locale; overrides extend, never replace, the shipped catalogues.
- [x] IX Tests accompany the change — ledger, controls, grouping, backup round trips, layering, overrides.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Related features: [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md),
  [`../organization-setup/spec.md`](../organization-setup/spec.md),
  [`../data-import-export/spec.md`](../data-import-export/spec.md),
  [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md),
  [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md), `integration-hub`
- Existing code: `packages/core/src/lib/job-execution`, `job-dead-letter`, `health`, `invite`, `language`, `feature`,
  `tenant/tenant-setting` (`global-setting-writer.ts`), `export-import`, `event-outbox`, `broadcast`;
  `packages/scheduler` (`scheduler-run-recorder.interface.ts`); `apps/worker/src/app/scheduler-ledger.bootstrap.ts`;
  plugins `ever-stats`, `ever-stats-ui`, `ever-instance`, `changelog`, `onboarding-ui`;
  `apps/gauzy/src/app/pages/settings/*`; `packages/ui-core/theme/src/lib/components/app-switcher`
