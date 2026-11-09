# Feature Specification: Real-time channel

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `realtime-channel`
**Branch**: `feat/realtime-channel`
**Status**: `Draft`
**Created**: 2026-11-07
**Last updated**: 2026-11-08
**Owner**: platform maintainers
**Feature flag**: `GAUZY_REALTIME_ENABLED` (default off)

---

## 1. Overview

Clients of the platform (the Angular app, Ever Teams on web, mobile and desktop, the
desktop timer apps) today learn about changes by polling. The real-time channel gives
every signed-in user one authenticated push connection per client session, over which the
platform delivers **replayable events** (new chat messages, inbox entries, "something
changed" hints for tasks, comments, documents and projects) and **ephemeral signals**
(presence, typing) with sub-second latency. Replayable events can be caught up after a
reconnect; signals are delivered live only and are never replayed (a reconnecting client
re-reads presence through HTTP). HTTP stays authoritative for data; the channel
tells clients what happened so they can patch or refetch. When the channel is disabled or
unreachable, every feature keeps working with its documented polling.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a signed-in employee with the web app open, **when** a colleague posts a
  message in a channel they belong to, **then** the message appears in their open
  conversation within one second without a reload, and the unread badge of that
  conversation updates.
- **Given** an employee with two browser tabs open, **when** they read a conversation in
  one tab, **then** the unread state clears in the other tab within one second.
- **Given** an employee mentioned in a task comment, **when** the comment is saved,
  **then** their inbox badge increments immediately and the inbox list shows the entry
  without polling.
- **Given** a team page that shows who is online, **when** a member starts or stops
  working (timer, activity) or goes idle, **then** their presence indicator changes
  within a few seconds for everyone viewing the team.
- **Given** a client whose connection dropped for two minutes, **when** it reconnects
  with its cursor (the time and id of the last event it applied), **then** it receives
  every replayable event it missed, in order, re-reads presence, and resumes without a
  full reload.
- **Given** a client whose connection dropped for longer than the replay window,
  **when** it reconnects, **then** it is told to resynchronise and refetches its data
  through HTTP.
- **Given** a deployment with the flag off, **when** a client tries to subscribe,
  **then** the subscription is refused (the collaboration field and the `/realtime`
  routes do not exist) and the client falls back to polling with no error shown to the
  user.

### 2.2 Edge cases & failures

- **Given** a user whose session is revoked or whose membership in an organization is
  removed, **when** that happens, **then** every open connection of that user for that
  organization is closed within fifteen seconds and no further events are delivered.
- **Given** a user with twenty open connections, **when** they open a twenty-first,
  **then** the oldest idle connection is closed and the new one is accepted.
- **Given** a slow client that cannot keep up with its event queue, **when** the
  server-side buffer for that connection fills, **then** the connection is closed with a
  "replay from cursor" status and the client reconnects with its cursor.
- **Given** an event meant for the members of a private channel, **when** it is
  published, **then** no user outside that channel receives it, even if subscribed to
  the same organization.
- **Given** an operator who turns the flag off (`GAUZY_REALTIME_ENABLED`, a deployment
  setting) and restarts the API, **when** the new processes start, **then** open
  connections end with the old processes and clients fall back to polling without
  user-visible errors. There is no per-tenant or per-organization switch in this release,
  and nothing closes one tenant's connections while the others stay open (plan §15.7).

## 3. Functional Requirements

- **FR-1** The platform MUST accept one push connection per client session,
  authenticated with the same credentials as the REST API (bearer token or session), and
  MUST reject anonymous connections.
- **FR-2** Every replayable event MUST carry a stable event id, a topic (its name) and
  its position in one cursor order per organization: append time, then event id.
  Clients MUST be able to reconnect with the last cursor the catch-up answered them and
  receive all later events of their scope in that order (a streamed event is no resume
  position: the stream delivers neither in commit order nor at once, plan §15.6). (The outbox's per-aggregate
  `sequence` orders one aggregate's events only and is not a reconnect cursor.)
- **FR-3** The platform MUST keep a replay window of at least the newest 1,000 events per
  organization or the last 24 hours, whichever is larger, and MUST answer a reconnect
  outside the window with a resynchronise instruction. (Today nothing prunes the event
  outbox, so the window is everything retained; a future retention job must keep both
  bounds.)
- **FR-4** Events MUST be delivered only to users who are allowed to read the underlying
  resource (organization members for organization-wide hints; conversation members for
  chat events; the recipient only for inbox events).
- **FR-5** The platform MUST deliver chat message, chat state, thread, reaction, inbox,
  presence and typing events with payloads sufficient for the client to update its view
  without an extra request.
- **FR-6** The platform MUST deliver coarse change hints (`entity`, `entityId`,
  `action`) for tasks, comments, documents, pages, projects and organization membership so
  clients can refetch only what changed.
- **FR-7** Clients MUST be able to send presence (`active`, `idle`, `away`) and typing
  signals; the platform MUST merge presence across a user's connections and publish one
  presence state per employee to the organization. (Met for clients that name their
  connection, plan §15.2; a client that names none shares one connection per employee,
  last report wins.)
- **FR-8** The platform MUST re-check a connection's authorization at least every fifteen
  seconds and immediately on session revocation, organization removal or suspension.
- **FR-9** The platform MUST publish events after the originating write is committed,
  never before, and in commit order per organization.
- **FR-10** The platform MUST expose health counters (connections, events per minute,
  replay misses, closed-for-backpressure) for operators.
- **FR-11** Every feature that uses the channel MUST keep a documented polling fallback
  when the flag is off or the connection is unavailable.
- **FR-12** The platform MUST NOT send any event or payload to a client for a tenant or
  organization the user does not belong to.
- **FR-13** The channel MUST work when several API instances run behind a load balancer:
  an event written on one instance reaches clients connected to another.

## 4. Non-Functional Requirements

- **Performance**: P95 end-to-end delivery (write committed → client receives) under
  1 s with 5,000 concurrent connections per API instance; presence fan-out coalesced to at
  most one message per employee per 5 s.
- **Reliability**: no event loss within the replay window; at-least-once delivery with
  idempotent client application (events carry stable ids).
- **Security & privacy**: same authentication as REST; per-recipient audience checks;
  payloads never include data the recipient could not read through REST; no PII in
  operator metrics.
- **Observability**: connection open/close, replay served, resync forced and
  backpressure closes are logged with tenant/organization ids; counters exported.
- **Compatibility**: PostgreSQL (multi-instance via a shared bus), SQLite (single
  instance, in-memory bus), MySQL; both ORMs; works behind the existing ingress with
  WebSocket upgrade; the desktop apps and mobile can use a short-lived connection ticket
  where cookies are unavailable.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `RealtimeEvent`  | An organization-scoped, numbered, topic-tagged record of something that happened, with its audience and payload |
| `RealtimeConnection` | One authenticated push connection of a user's client session, with its cursor and presence signals |
| `PresenceState`  | The merged, published presence of an employee (`online`, `idle`, `away`, `offline`, optional custom status) |
| `Audience`       | Who may receive an event: organization, a set of users, or everyone except some users |
| `ChangeHint`     | A content-free event naming an entity type, id and action so clients refetch |

## 6. Out of Scope

- Collaborative document editing transport (CRDT sync); the docs-collaboration feature defines it
  separately and may reuse this channel's authentication.
- Web Push / mobile push delivery (the inbox feature covers push).
- Cross-organization or cross-tenant broadcast.
- Guaranteed ordering across organizations.

## 7. Acceptance Criteria

- [ ] A client receives a chat message posted by another user within 1 s on a two-instance
      deployment.
- [ ] A reconnect with a cursor inside the window replays every missed event in order; a
      reconnect outside the window receives a resynchronise instruction.
- [ ] A user removed from a private channel stops receiving that channel's events
      immediately; a user removed from the organization has every connection closed
      within 15 s.
- [ ] With `GAUZY_REALTIME_ENABLED` off, connections are refused and clients show no
      errors; chat and inbox still update through polling.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; migrations are additive.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether the desktop timer apps adopt the channel in the first release or stay on their current polling]`
- Resolved 2026-11-07: the channel is built on the platform's existing **event outbox** (addressed events, read back by the REST catch-up `GET /api/realtime/events?after=&afterId=`) and its **GraphQL subscription transport** (graphql-ws), through the plugin's own field `Subscription.collaborationEvents` (permission `REALTIME_SUBSCRIBE`; the kernel's `Subscription.events` stays reserved to `EVENT_OUTBOX_VIEW` holders), extended with presence and typing signals. No second transport is introduced; the plan names the pieces and its §15 lists what is not met yet.

## 9. Constitution Gates

- [x] I Plugin-first — a `packages/plugins/realtime` plugin adds presence, typing and the collaboration event catalogue; the outbox and subscription kernel stay in core.
- [x] II Tenant/organization scoping — every event and connection is organization-scoped.
- [x] III Both ORMs, additive migrations — presence table only, additive.
- [x] IV Default-off flag; nothing removed — `GAUZY_REALTIME_ENABLED`; polling stays.
- [x] V Contracts and API first — event contracts in `@gauzy/contracts`; HTTP stays authoritative.
- [x] VI Permissions, privacy, security — per-audience delivery, authorization re-checks.
- [x] VII Real-time through the event bus — this feature *is* the platform push channel.
- [ ] VIII i18n and accessibility — no UI in this feature (connection status strings in clients).
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Architecture: [`../../architecture/collaboration-suite.md`](../../architecture/collaboration-suite.md)
- ADR: [`../../decisions/001-collaboration-api-lives-in-plugins.md`](../../decisions/001-collaboration-api-lives-in-plugins.md)
- Consumers: [`../chat/spec.md`](../chat/spec.md), [`../inbox/spec.md`](../inbox/spec.md), [`../docs-collaboration/spec.md`](../docs-collaboration/spec.md)
