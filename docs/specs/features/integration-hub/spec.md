# Feature Specification: Integration hub

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `integration-hub`
**Branch**: `feat/integration-hub`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_INTEGRATION_HUB` (tenant feature, default off) · the plugin loads only when
`GAUZY_INTEGRATION_HUB_ENABLED` is exactly `true` · `FEATURE_APP_INTEGRATION` keeps gating the integrations gallery and
each integration's own pages · webhook subscriptions keep the `WEBHOOKS_*` permissions

---

## 1. Overview

Today the platform's REST API is documented as an OpenAPI document with GraphQL beside it, cursor pagination, field
selection, bulk routes, idempotency keys and request throttling set per deployment; the MCP server offers hundreds of
tools. Outbound webhook subscriptions deliver signed events with retries, a circuit breaker, redelivery and an endpoint
policy, but only through the API, and many domains publish no events. Built-in integrations (issue trackers, time
trackers, freelance platforms, automation platforms) are cards in a gallery on the Integrations menu, each with its own
connect page, sign-in flow and sync code; the four issue-tracker integrations already keep sync runs, conflicts and
project mappings, each in its own records, and receive their own webhooks. File storage providers are chosen per tenant
on the File storage settings page. This feature generalises what those integrations and the webhook engine already do
and gives integrations **one place** on the existing Integrations menu: an **API catalogue** with documentation, SDKs
and usage limits, an **event catalogue** that covers every domain, **webhooks with screens, logs and replay**,
**inbound endpoints**, **connected accounts** that any feature can use to call an outside service on a user's or
organization's behalf, the existing gallery as a **connector catalogue** where each connector states what it can do,
**shared sync records** (jobs, runs, mappings, per-record issues, conflict rules and resync) that the existing
integrations report into, one **integration call log**, and **storage and backup targets** on the File storage page.
Clients: the Angular app, the MCP server and the SDKs.

**Advanced capabilities.** Every delivery can be **replayed** from a **signed-payload inspector**, failed ones
wait in a **dead-letter queue** with bulk replay after a fix, and endpoints have a **test mode** fed with sample events; a
**connector kit** gives each connector a manifest and a **contract test suite** that also runs as a health check from
the screen; each connection carries a **health score** and warns before its sign-in expires; and an assistant turns a
plain-language request into a **draft subscription or sync job** for a person to review. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `WEBHOOKS_CREATE`, **when** they open Integrations → Webhooks, pick the events
  "invoice paid" and "employee created" from the catalogue, add a filter "organization is Acme EU" and save, **then** a
  test delivery with the sample payload is offered, and real deliveries appear in the subscription's log with status,
  time and the answer.
- **Given** a subscription whose endpoint was down for two hours, **when** the administrator opens the dead-letter tab,
  fixes the address and chooses **Replay all**, **then** the 37 dead deliveries are sent again in their original order with
  the original payloads, each marked as a replay. `(advanced)`
- **Given** a developer, **when** they open the API catalogue, **then** they see the documented groups of every loaded
  plugin, download the OpenAPI document of one group, find the SDKs and the MCP endpoint, and read their own usage
  against the tenant's limits.
- **Given** an employee, **when** they connect their account at an outside service through Settings → Connected accounts,
  **then** they sign in at the service, grant the scopes shown, and the account appears with its scopes and expiry;
  their mail connection and file picker use it.
- **Given** a manager with `INTEGRATION_SYNC_MANAGE` on a connected issue tracker, **when** they open its sync jobs,
  **then** they see each entity's direction, schedule, last run with counts, and the open issues, including the runs and
  conflicts the integration recorded before; **when** they resolve a conflict by keeping the platform's value and choose
  **Resync** on that task, **then** the task is pushed again.
- **Given** an outside system that posts orders to an inbound endpoint with a signature, **when** a delivery arrives
  twice, **then** it is processed once, the second is logged as duplicate, and both appear in the call log.
- **Given** an administrator with `INTEGRATION_STORAGE_TARGET_MANAGE`, **when** they add an object storage target for
  backups and exports on the File storage settings page and verify it, **then** scheduled exports and backups are
  written there and the target shows the last write.
- **Given** a manager who asks the assistant "tell our chat tool whenever a deal over 10,000 is won", **then** a draft
  subscription with the event, the filter and a destination appears for review, nothing active until they save it.
  `(advanced)`

### 2.2 Edge cases & failures

- **Given** a user without the needed permission, **then** the hub routes answer `403`; with the feature off they answer
  `404` and the existing webhook routes, integrations gallery and integration pages behave as today.
- **Given** a subscription address that resolves to a private network, **then** saving is refused by the endpoint policy.
- **Given** an endpoint failing for 24 hours, **then** the subscription is disabled as today, its owner is told, and
  new events are kept as dead deliveries for 7 days for replay.
- **Given** an inbound delivery with a bad signature, a body over 1 MB, a source outside the allow-list or a replayed
  delivery key, **then** it is refused and logged with the reason; nothing is processed.
- **Given** a connected account whose refresh is refused by the service, **then** it turns expired, consumers stop using
  it, and its owner is asked to reconnect; tokens are never shown to anyone.
- **Given** a tenant over its API limit, **then** calls answer `429` with the limit, the remaining count and the reset
  time; the limit of one client never blocks another.
- **Given** a sync run interrupted by a restart, **then** it resumes from its cursor and never creates a record twice.
- **Given** a storage target whose credentials stop working, **then** writes fail with the error, the next write falls
  back to the default target only where the purpose allows it, and administrators are told.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads this feature only when `GAUZY_INTEGRATION_HUB_ENABLED` is exactly `true` and gates every new
  route, GraphQL field, menu entry and MCP tool with `FEATURE_INTEGRATION_HUB`; off, they answer `404`.
- **FR-2** The system keeps the webhook subscription and delivery routes, the integration gallery, each integration's
  connect and settings pages and routes (answering the same shapes once its runs, conflicts and mappings live in the
  shared sync records), tenant key pairs, file storage settings and the API call log working as today.
- **FR-3** The system only adds routes, fields and values to existing contracts; nothing is renamed or removed.

### 3.2 API catalogue and documentation

- **FR-4** The system shows an API catalogue: every documented group of the loaded plugins with its routes, permissions,
  request and response shapes and examples, searchable, with links to the reference of each route.
- **FR-5** The system serves the OpenAPI document of the whole API and of each group, regenerated when plugins change,
  with deprecations and their dates.
- **FR-6** The system lists every registered record type with its REST path, GraphQL fields, supported filters, bulk
  routes and whether custom fields are included, so custom record types appear without extra setup.
- **FR-7** A user can try a read route from the catalogue with their own session in the browser; writes are offered only
  in test mode tenants or with a confirmation.
- **FR-8** The system lists the official SDKs with their versions and the MCP endpoint with its tool groups and sign-in
  method, and refuses a build in which an MCP tool calls a route that does not exist.

### 3.3 API limits and usage

- **FR-9** A user with `INTEGRATION_API_LIMITS_MANAGE` can set tenant-level limits per minute and per day for all API
  clients together and per client kind (user sessions, tenant keys, personal tokens, applications, agents), within the
  deployment's maximum; no tenant limit applies until one is set, so only the deployment's throttling holds, as today.
- **FR-10** The system answers `429` past a tenant limit an administrator set with the limit, the remaining count and the
  reset time in headers, counts per client so one client's burst does not block another, and exempts provider callbacks
  and inbound endpoints; the deployment's existing throttling keeps counting as it does today.
- **FR-11** The system shows usage per client, route group and status code per hour for 90 days and per day for 13 months.
- **FR-12** The system warns the tenant administrators at 80 % and 100 % of a daily limit, once per day each.

### 3.4 Event catalogue

- **FR-13** The system lists every event that loaded plugins publish with its name, description, payload schema, version,
  sample and the permission a subscriber needs to receive it.
- **FR-14** The system publishes created, updated and deleted events for registered record types that publish none
  today (employees, time logs, timesheets, time-off requests, expenses, candidates, contacts, projects, teams), carrying
  ids and changed field names.
- **FR-15** The system versions event payloads: today's payloads are the first version and every existing subscription
  stays pinned to it; a newer version reaches only subscriptions whose owner picks it; every version stays available as
  long as a subscription is pinned to it, and the catalogue marks older versions as superseded.
- **FR-16** The system includes payment and provider events in the catalogue when `payment-gateways` publishes them, so
  payment authorised, captured, failed, refunded and disputed reach subscriptions like any other event.

### 3.5 Outbound webhooks

- **FR-17** A user with `WEBHOOKS_CREATE` can create a subscription from the screen: name, address, events or patterns from
  the catalogue, conditions on the payload, static headers, payload version, record snapshot or ids only, and a rate
  per minute.
- **FR-18** The system signs every delivery with the subscription's secret, sends the event id, time, version and
  signature headers, and shows the receiving side how to verify them.
- **FR-19** A user with `WEBHOOKS_EDIT` can pause a subscription with a reason (a disable chosen by a person) and resume
  it (enable), rotate its secret with an overlap window and send a test event; paused subscriptions keep their events
  for 7 days.
- **FR-20** The system shows each subscription's deliveries with event, status, attempts, answer code, duration and the
  first 4 KB of the answer, filtered by status, event and time.
- **FR-21** The system retries failed deliveries on the existing schedule, marks them dead after the last attempt, and
  disables a subscription after the existing threshold, telling its owner.
- **FR-22** A subscription can be limited to its owner's reach (option "Only what the owner may read"): it then receives
  events only for the organizations its owner can read and only events whose permission the owner holds, and loses
  events when its owner loses the permission. The option is off for subscriptions that exist and for those created
  through the existing webhook routes, which keep today's delivery scope; the hub's screen offers it switched on for the
  subscriptions created there.
- **FR-23** The system honours a subscription's rate by spacing deliveries, never dropping them.
- **FR-24** The system keeps deliveries as it does today, without a time limit, until an administrator sets a retention
  (7 to 180 days, 30 suggested); with one set, older deliveries are removed and counts per subscription and outcome are
  kept beyond.

### 3.6 Inbound endpoints

- **FR-25** A user with `INTEGRATION_INBOUND_ENDPOINT_MANAGE` can create an inbound endpoint with its own address, a
  handler (an automation flow trigger, a connector or a record intake a plugin declares), a signature check, an optional
  source allow-list and a delivery-key header for deduplication.
- **FR-26** The system refuses unsigned calls when a secret is set, bodies over 1 MB, sources outside the allow-list and
  repeated delivery keys, answering at once and processing accepted calls in the background.
- **FR-27** The system logs each inbound delivery with headers (secrets redacted), body, verdict, handler result and
  error, and lets a user with `INTEGRATION_INBOUND_ENDPOINT_MANAGE` reprocess a failed one. The webhook receivers the
  integrations, chat, the Inbox and payments already have keep their own addresses and checks and log into the same
  call log.
- **FR-28** The system rotates an endpoint's address or secret on request and keeps the old one valid for an overlap
  window (default 24 hours).

### 3.7 Integration call log

- **FR-29** A user with `INTEGRATION_LOG_VIEW` can search one log of requests to and from outside services: webhook
  deliveries, inbound deliveries, connector calls, provider callbacks and sign-in exchanges, with direction, status,
  duration, the record concerned and the error.
- **FR-30** The system stores request and answer headers and bodies up to 16 KB each with credentials, tokens and card
  or bank data removed, and links each entry to its connection and record.
- **FR-31** The system keeps log entries 30 days (setting 7 to 365) and lets a user export a filtered set.

### 3.8 Sign-in applications and connected accounts

- **FR-32** A user with `INTEGRATION_OAUTH_APP_MANAGE` can register an outside sign-in application by its published
  configuration or by hand, with the access it asks for, its client credentials and whether users, organizations or both
  connect to it; connectors declare theirs so most need no setup.
- **FR-33** A user with `INTEGRATION_CONNECTED_ACCOUNT_CONNECT` can connect an account: they are sent to the service,
  grant the scopes, and the account is kept with its scopes, the outside account name and expiry.
- **FR-34** The system refreshes tokens before they expire, marks an account expired when refresh is refused, notifies
  its owner, and revokes the grant at the service when the account is removed.
- **FR-35** The system lets features use an account only through its owner's consent recorded per feature (mail,
  calendar, files, a connector), shows the owner which features use it, and never returns tokens through any API.
- **FR-36** The system lists the existing integrations' connections as connected accounts of the organization with
  their status, without moving their data; their connect flows keep their pages and use the same single-use sign-in
  state as connected accounts.
- **FR-37** The system stops an account's use at once when its owner is deactivated, and moves organization accounts to
  another administrator on request.

### 3.9 Connector catalogue

- **FR-38** The system shows one connector catalogue, the existing gallery of the Integrations menu extended: built-in
  integrations, the Ever Platform connection, payment adapters and connectors of loaded plugins with category, what each
  can sync (entities and directions), its webhooks, sign-in kind, plan, documentation and whether it is connected,
  keeping the gallery's free, paid and coming-soon marks. The older gallery address keeps opening the existing gallery;
  it opens the catalogue instead only when an administrator chooses so (organization setting, off by default).
- **FR-39** The system lets a connector declare in a manifest its entities, directions, settings schema, sign-in,
  events in and out and field mappings, and renders its settings form from the schema.
- **FR-40** The system lets plugins declare extension points used by connectors (record writers, search results,
  automation triggers and actions, export fields), listed in the catalogue for developers.
- **FR-41** A user with `INTEGRATION_CONNECTOR_MANAGE` can connect, configure, pause and disconnect a connector per
  organization; disconnecting keeps its mapped records and history.

### 3.10 Sync jobs

- **FR-42** A user with `INTEGRATION_SYNC_MANAGE` can see and edit a connection's sync jobs, which are the connection's
  existing per-entity sync settings (their on and off switch stays the one switch): entity, direction, schedule (from
  every 5 minutes to daily, or on events), field mapping, value mappings, conflict rule (platform wins, outside wins,
  newest wins, ask) and pause.
- **FR-43** The system records every run with trigger, start, end, counts per entity and outcome, and the error; the
  existing integrations (the four issue trackers and Ever Works) report their runs through the same record and their
  earlier runs are listed with them.
- **FR-44** The system records per-record issues (failed write, conflict) with both values, and lets a user retry, resolve
  by choosing a side or ignore each, or in bulk; the conflicts the existing integrations record are the same issues.
- **FR-45** A user who can edit a record can resync it with one connection from the record, and see its outside
  references and last sync time.
- **FR-46** The system resumes an interrupted run from its cursor, never creates a record twice (by the existing
  integration map), and runs one job of a connection at a time.
- **FR-47** The system backs off when an outside service answers "too many requests", honours its retry time, and
  pauses a job of a connector of the kit after 10 failed runs in a row, telling its owner; the existing integrations'
  sync jobs are paused that way only when the organization turns on "Pause failing syncs" (off by default) and
  otherwise keep running as today.

### 3.11 Shipped connectors and services

- **FR-48** The system offers an address-book connector that pulls and pushes contacts and their people with an outside
  contact service through a connected account, each direction switchable per account.
- **FR-49** The system offers a file picker that lets a user attach files from an outside file store through their
  connected account, copying the chosen files into platform storage.
- **FR-50** The system lets an administrator choose a geocoding adapter per tenant for address suggestions and map
  coordinates; the deployment's existing address lookup is the first adapter and keeps working unconfigured.
- **FR-51** The system provides calendar and mail features with connected accounts and sync jobs, so their outside
  sync runs on this feature's accounts, runs and issues.

### 3.12 Storage and backup targets

- **FR-52** A user with `INTEGRATION_STORAGE_TARGET_MANAGE` can add storage targets of the supported provider kinds
  (local, object storage, image services) on the File storage settings page, verify them with a test write, and set the
  default target per purpose: files, exports, backups, scheduled reports, audit stream.
- **FR-53** The system shows the tenant's current file storage setting on the same page as the files target and keeps
  it working unchanged.
- **FR-54** The system writes exports, backups and scheduled report files to the purpose's target with a retention per
  target, records each write, and tells administrators when a write fails.
- **FR-55** The system lets access control stream audit events to a storage target or a webhook subscription.

### 3.13 Real time for API clients

- **FR-56** The system lets API clients with tenant keys, personal tokens or applications subscribe to the real-time
  channel for the same events and permissions as webhooks, and documents the subscription in the catalogue.
- **FR-57** The system offers event streams over GraphQL subscriptions for the catalogue's events where a plugin streams
  them, with the same filters as subscriptions.

### 3.14 Replay, inspection and test mode `(advanced)`

- **FR-58** A user with `WEBHOOK_DELIVERIES_RETRY` can replay one delivery or all matching a filter (subscription,
  event, status, time) after a preview of the count, in original order, with the original payload, each marked a replay.
- **FR-59** The system shows a delivery's exact request (headers, body, signature) and verifies any pasted signature and
  body against the subscription's secret, naming the mismatch (secret, time window, body).
- **FR-60** The system keeps dead deliveries in a dead-letter list per subscription for 7 days after disabling, with
  counts, and offers to replay them in order when the subscription is resumed; resuming without choosing replay sends
  only new events, as enabling does today.
- **FR-61** A subscription or inbound endpoint in test mode receives sample and test events only, never live data.

### 3.15 Connector kit and health `(advanced)`

- **FR-62** The system validates a connector's manifest at load and refuses to list a connector whose manifest is invalid,
  naming the problem.
- **FR-63** The system ships a contract test suite per manifest (sign-in, read, write, webhook verification, rate
  handling, mapping round trip) that runs in the connector's build and, against a sandbox account, from the connector page
  as a health check with each check's result.
- **FR-64** The system scores each connection, subscription and inbound endpoint daily from success rate, latency,
  failures and sign-in expiry, shows the score with its causes, and warns owners 14 and 3 days before a sign-in expires.

### 3.16 Assistant `(advanced)`

- **FR-65** A user with the matching manage permission can describe an integration need in plain language and receive a
  draft subscription, inbound endpoint or sync job with the events, filters and mappings chosen and why; nothing is
  active until a person saves it.
- **FR-66** The system explains a failing delivery or run from its log (answer codes, timing, payload differences) and
  proposes a fix, without changing anything.

### 3.17 MCP, events and reports

- **FR-67** The system exposes every capability through REST with GraphQL reads; creating routes take idempotency keys.
- **FR-68** The system publishes events for subscriptions paused and disabled, deliveries dead, accounts expiring and
  revoked, runs completed and failed, issues opened, and storage writes failed; payloads carry ids only.
- **FR-69** The system offers MCP tools to list the event catalogue, manage subscriptions (preview first), list and replay
  deliveries (preview), manage inbound endpoints, list connectors, run health checks, list and run sync jobs, list
  issues and requests, read API usage and draft from text, under the caller's permissions.
- **FR-70** The system registers these report definitions:

  | Report | Answers |
  |---|---|
  | Webhook deliveries | deliveries per subscription and event by outcome, attempts and latency percentiles |
  | Inbound deliveries | accepted, refused and failed calls per endpoint and reason |
  | Sync activity | runs, records per entity and outcome, open issues per connection |
  | API usage | requests per client kind, client, route group and status; limit hits |
  | Connected accounts | accounts per app, status, consumers and expiry dates |
  | Integration health | scores and causes per connection, subscription and endpoint over time |

- **FR-71** The system keeps the outbound webhooks of the automation-platform integrations in their own subscriptions,
  with their pages, routes, payloads, headers, retries and failure handling unchanged, and lists them and their
  deliveries beside the platform's subscriptions on the Webhooks tab and in the call log, read-only there.
- **FR-72** The system lists an integration whose connector manifest names a tenant feature in the connector catalogue,
  the gallery and the Integrations page only for tenants with that feature on; integrations without one, every existing
  integration included, are listed as today.

## 4. Non-Functional Requirements

- **Performance**: an event reaches its first delivery attempt within 5 s P95 of the commit (60 s without a queue);
  500 deliveries per second per worker; inbound endpoints answer within 200 ms P95; logs and catalogue lists under
  300 ms P95 at 50 million log rows per tenant; limit checks add under 2 ms per request.
- **Volume**: 1,000 subscriptions and 200 inbound endpoints per tenant; 10 million deliveries per tenant per month.
- **Reliability**: at-least-once delivery deduplicated by event and subscription; inbound deduplicated by delivery key;
  runs resume from cursors; token refresh retried with back-off.
- **Security & privacy**: secrets and tokens encrypted with the platform key, never returned; endpoint policy against
  private networks; signatures on every delivery; redaction in logs. Leaves the platform: event payloads to subscribed
  addresses, records to connected services as configured, files to storage targets.
- **Observability**: lag, attempt and failure rates, dead counts, refresh failures, limit hits, run durations.
- **Accessibility and localisation**: keyboard operable lists and editors; labels per language.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted, with or without a queue; OpenAPI
  additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Event type | A named, versioned event a plugin publishes, with schema, sample and required permission |
| Webhook subscription, delivery | An outside address receiving chosen events; one signed attempt-tracked send of one event |
| Dead letter | A delivery that exhausted its attempts, kept for replay |
| Inbound endpoint, inbound delivery | An address outside systems post to, with its handler; one received call |
| Call log entry | One request to or from an outside service, redacted |
| Sign-in application, connected account | An outside sign-in application; one user's or organization's grant with its tokens |
| Connector, manifest | An integration as a plugin; its declared capabilities, settings and mappings |
| Sync job, run, issue | A connection's per-entity sync setting with its schedule and rules; one execution; one record that failed or conflicted |
| Sync mapping, value map | An outside project, team or board tied to a platform record; how outside values (statuses, types) map to ours |
| Storage target | A place files, exports, backups, reports or audit events are written to |
| API limit, usage | Tenant-level request ceilings; counted requests per client and route group |
| Health score | A daily score with causes for a connection, subscription or endpoint |

## 6. Out of Scope

- API keys, their scopes, expiry and per-key rates, OAuth applications signing in to the platform, request logs per key:
  `access-control-and-security`.
- Payment provider adapters and their callbacks: `payment-gateways`. Shop and marketplace connectors:
  `commerce-connectors`. Installing apps from the marketplace: the Ever Platform spec `app-installs-and-licensing`.
- Flows, the call-webhook step and the incoming-webhook trigger: `automation-and-notifications` (they use FR-25 and FR-18).
- Text message gateway settings and mail transports: `email-and-communications`. Calendar sync rules:
  `calendar-and-scheduling`. Drive sync and network access: `drive`. Running and restoring backups:
  `platform-administration`.

## 7. Acceptance Criteria

- [ ] **AC-1** A subscription created on screen from catalogue events with a filter receives signed deliveries; the log
      shows status, attempts, duration and answers (FR-17, FR-18).
- [ ] **AC-2** Employee, time log, timesheet, time-off, expense and candidate changes produce catalogue events (FR-14).
- [ ] **AC-3** A paused subscription keeps its events; a disabled one keeps dead deliveries 7 days; replay sends them in
      order with original payloads (advanced: replay; FR-19, FR-60).
- [ ] **AC-4** The inspector verifies a pasted signature and names a wrong secret or an old time stamp (advanced; FR-18, FR-59).
- [ ] **AC-5** An inbound endpoint refuses bad signatures, large bodies, foreign sources and repeated keys; accepted calls
      reach their handler once (FR-26, FR-27).
- [ ] **AC-6** A connected account is granted, refreshed, expires on refusal with a notice, and revokes on removal; no API
      returns its tokens (FR-33, FR-34).
- [ ] **AC-7** Sync jobs of an existing integration show its runs and issues, earlier ones included, and its own routes
      answer as before; a conflict resolved by choosing a side and a record resync push the chosen value; an
      interrupted run resumes without duplicates (FR-43, FR-44).
- [ ] **AC-8** The API catalogue lists groups, record types, SDKs and the MCP endpoint; the build fails on an MCP tool
      that calls a missing route (FR-8).
- [ ] **AC-9** Tenant limits answer `429` with headers; usage shows per client and route group (FR-10–FR-12).
- [ ] **AC-10** Storage targets added on the File storage page verify, receive exports and backups, and report failed
      writes (FR-52–FR-55).
- [ ] **AC-11** A connector's contract suite runs in its build and as a health check; scores and expiry warnings appear
      (advanced: connector kit, health; FR-63, FR-64).
- [ ] **AC-12** A plain-language request becomes a draft that is inactive until saved (advanced: assistant; FR-65).
- [ ] **AC-13** The six reports of FR-70 return correct figures on seeded data.
- [ ] **AC-14** Feature off: `404` on new routes; webhook routes, gallery and integrations behave as before; works on
      PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-1, FR-2).
- [ ] **AC-15** Feature on, with no setting changed: existing subscriptions receive the same events with the same payloads
      as before, no delivery is removed, enabling a subscription sends no old events, no tenant API limit applies, the
      gallery address opens the gallery, existing integrations' syncs are never paused automatically, and the
      automation-platform webhooks deliver exactly as before (FR-13, FR-15).
- [ ] **AC-16** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Record events for core types without events are published by the hub for registered record types; types that publish
  their own keep them. Default applied.
- Dead deliveries are kept 7 days after a subscription is disabled. Default applied.
- The address-book connector is the first shipped connector on the kit; calendar sync uses the kit from
  `calendar-and-scheduling`. Default applied.
- Inbound endpoints become the second source of automation's incoming-webhook trigger. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new `integration-hub` plugin pair; core webhook, integration and event modules gain additive
      columns and seams, and the integration framework gains the shared sync records the existing integrations use.
- [x] II Tenant/organization scoping — subscriptions, endpoints, accounts, jobs, targets and logs are scoped.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on three dialects.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_INTEGRATION_HUB`; existing routes and pages stay.
- [x] V Contracts and API first — contracts, REST, GraphQL reads and catalogue routes before screens.
- [x] VI Permissions, privacy, security — permission keys, encrypted secrets and tokens, endpoint policy, signatures,
      redaction; data leaving listed in §4.
- [x] VII Real-time through the event bus — events through the outbox; API clients use the platform channel.
- [x] VIII i18n and accessibility — labels per language; keyboard operable editors.
- [x] IX Tests accompany the change — per requirement, contract kit, both ORMs and dialects.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`realtime-channel`](../realtime-channel/spec.md), [`chat-incoming-webhooks`](../chat-incoming-webhooks/spec.md),
  [`task-automations`](../task-automations/spec.md) (reports of existing integrations)
- Works with: [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`access-control-and-security`](../access-control-and-security/spec.md),
  [`email-and-communications`](../email-and-communications/spec.md), [`payment-gateways`](../payment-gateways/spec.md)
- Code: `packages/core/src/lib/{webhook,event-outbox,integration,integration-tenant,integration-setting,integration-map,
  integration-entity-setting,operation,rule,api,api-call-log,throttler,core/file-storage}`,
  `packages/plugins/integration-{jira,asana,linear,trello,ever-works}`, `packages/mcp-server`,
  `apps/gauzy/src/app/pages/integrations`, `apps/gauzy/src/app/pages/settings/file-storage`
