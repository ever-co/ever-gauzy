# Implementation Plan: Real-time channel

> Translates an approved `spec.md` into architecture and tech choices. The plan owns
> implementation details; the spec owns behaviour.

**Feature ID**: `realtime-channel`
**Spec**: `./spec.md`
**Tasks**: `./tasks.md`
**Status**: `Approved`
**Last updated**: 2026-11-07

---

## 1. Architecture Summary

```mermaid
flowchart LR
    W[Domain write<br/>task · comment · mention · notification · document] --> B[In-process buses<br/>RxJS EventBus · CQRS EventBus]
    B --> H[realtime plugin<br/>RealtimeChangeHints]
    H --> O[(event_outbox<br/>sequence · partitionKey · recipientUserIds)]
    O --> C[Outbox consumer] --> P[GraphqlPubSub<br/>topic eventName:tenantId]
    S[REST POST /realtime/presence · /typing] --> P
    P --> F[Subscription.collaborationEvents<br/>tenantScopedTopicStream]
    F --> CL[Clients over graphql-ws]
    CL -. catch-up .-> R[GET /realtime/events?after=&afterId=]
    R --> O
```

Nothing new is invented for transport: the plugin **declares** collaboration events with the
existing subscription catalogue, **appends** content-free change hints to the existing event
outbox after each domain write (the Inbox plugin's pattern), **publishes** ephemeral presence
and typing signals straight to the pub/sub, and exposes one typed subscription field that
employees may open with a dedicated permission (the kernel's `Subscription.events` stays
reserved for `EVENT_OUTBOX_VIEW` holders). Catch-up after a reconnect is a REST listing of the
same outbox rows, filtered to the collaboration catalogue and the caller's addressing.

## 2. Tech Choices

| Concern | Choice | Rationale |
| ------- | ------ | --------- |
| Package | new `packages/plugins/realtime` (`@gauzy/plugin-realtime`), loaded only when `GAUZY_REALTIME_ENABLED` is exactly `true` | Principle I; same loading contract as the Inbox plugin (`isInboxEnabled`) |
| Durable events | `EventOutboxService.append(manager, {...})` after the domain write, from bus subscribers | Zero changes to domain transactions; replay and catch-up walk the rows by (`createdAt`, `id`), which never move once appended |
| Streaming | `declareStreamedEvents(catalogue, consumer, ...names)` + `tenantScopedTopicStream(pubSub, names, …)` in a plugin resolver | The plugin-facing surface core already exports |
| Ephemeral signals | `GraphqlPubSub.publish(name, tenantId, envelope)` without an outbox row | Lost on disconnect by design (spec §1) |
| Permission | new `PermissionsEnum.REALTIME_SUBSCRIBE`, default for SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE; seeded for existing tenants by a plugin migration | Employees must not need `EVENT_OUTBOX_VIEW` |
| Presence persistence | existing `Employee.lastSeenAt/isIdle` through `EmployeeService.updatePresence`; no new table | Spec FR-7 merges per employee; a table is unnecessary for v1 |
| Multi-replica | deployment sets `GRAPHQL_PUBSUB_ENGINE` (Redis) | Existing seam; spec FR-13 |
| Comment events | add `CommentEvent` (RxJS `BaseEntityEvent<Comment>`) published by `CommentService` create/update/delete | The only domain without an in-process event today (additive core change) |

## 3. Data Model

### New or changed entities

None. Presence stays on `Employee`; hints and signals carry ids only.

### Migrations

- `packages/plugins/realtime/src/lib/database/migrations/1791000005100-SeedRealtimeRolePermissions.ts`
  — plugin-owned, tri-dialect, idempotent; grants `REALTIME_SUBSCRIBE` to SUPER_ADMIN, ADMIN,
  MANAGER, EMPLOYEE of every tenant (copy of the Inbox seed with the new grant table). Runs only
  where the plugin loads.

### Contracts (`@gauzy/contracts`)

- `packages/contracts/src/lib/realtime.model.ts`:
  - `RealtimeEventName` constants: `task.created`, `task.updated`, `task.deleted`,
    `comment.created`, `comment.updated`, `comment.deleted`, `mention.created`,
    `employee_notification.created`, `document.updated`, `presence.changed`,
    `typing.signalled`; `REALTIME_STREAMED_EVENTS` (the durable ones) and
    `REALTIME_SIGNAL_EVENTS` (the ephemeral ones).
  - `IRealtimeChangeHint { entity: BaseEntityEnum | string; entityId: ID; action: 'created'|'updated'|'deleted'; organizationId?: ID; actorUserId?: ID; recipientUserIds?: ID[]; parent?: { entity: string; entityId: ID } }`
  - `IRealtimePresenceInput { status: 'active'|'idle'|'away' }`, `IRealtimePresence { employeeId, userId, status, at }`
  - `IRealtimeTypingInput { conversationId: ID; threadRootId?: ID; recipientUserIds: ID[] }`
  - `IRealtimeCatchUpQuery { after?: number; afterId?: string; limit?: number }`, `IRealtimeCatchUp { events, cursor, cursorId, hasMore, resync }`, `IRealtimeEventEnvelope` (mirror of the kernel `EventEnvelope`).
- `PermissionsEnum.REALTIME_SUBSCRIBE = 'REALTIME_SUBSCRIBE'` + `default-role-permissions.ts` rows (new tenants).

## 4. API Surface

| Method | Endpoint | Permission | Description | Status |
| ------ | -------- | ---------- | ----------- | ------ |
| `POST` | `/api/realtime/presence` | employee (`@Permissions()`), `REALTIME_SUBSCRIBE` | Records presence (`EmployeeService.updatePresence`) and publishes `presence.changed` to the organization | New |
| `POST` | `/api/realtime/typing` | `REALTIME_SUBSCRIBE` | Publishes `typing.signalled` addressed to `recipientUserIds` (rate-limited 5/s per user) | New |
| `GET` | `/api/realtime/events?after=&afterId=&limit=` | `REALTIME_SUBSCRIBE` | Catch-up: outbox rows of the collaboration catalogue for the caller's tenant/organization after the exact (`after` ms, `afterId`) cursor (≤ 500 a page, `hasMore` when cut), read once and bounded, addressed rows only when the caller is a recipient; answers `cursor`/`cursorId` to continue from and `resync: true` when the cursor predates the oldest row the caller's scope retains | New |
| `GET` | `/api/realtime/status` | `REALTIME_SUBSCRIBE` | Whether subscriptions are served in this process, the catalogue names, limits | New |
| GraphQL | `Subscription.collaborationEvents(names: [String!]!, aggregateId: ID): EventEnvelope!` | `REALTIME_SUBSCRIBE` (+ `FEATURE_GRAPHQL`) | Streams the selected collaboration events of the caller's tenant/organization, addressed ones only to the caller | New |

DTOs: `RealtimePresenceDTO`, `RealtimeTypingDTO`, `RealtimeCatchUpQueryDTO` (class-validator, whitelist).
Errors: `400` unknown event name; `403` missing permission; `429` typing rate limit.

## 5. Events, Real-Time and Notifications

| Event | Emitted when | Payload (content-free) | Audience |
| ----- | ------------ | ---------------------- | -------- |
| `task.created/updated/deleted` | `TaskEvent` on the RxJS bus | `{ entity: 'Task', entityId, action, projectId?, organizationId }` | organization |
| `comment.created/updated/deleted` | new `CommentEvent` | `{ entity: 'Comment', entityId, action, parent: { entity, entityId } }` | organization |
| `mention.created` | `CreateMentionEvent` (CQRS) | `{ entity, entityId, mentionedEmployeeId }` | addressed: mentioned employee's user |
| `employee_notification.created` | `EmployeeNotificationCreatedEvent` (CQRS, after the row is saved) | `{ notificationId, type, entity, entityId }` | addressed: receiver's user |
| `document.updated` | `DocumentEvent` (RxJS, docs plugin) — subscribed by constructor name to avoid a hard dependency | `{ entity: 'Document', entityId, action }` | organization |
| `presence.changed` | `POST /realtime/presence` | `{ employeeId, userId, status, at }` | organization (ephemeral) |
| `typing.signalled` | `POST /realtime/typing` | `{ conversationId, threadRootId?, employeeId, userId }` | addressed (ephemeral) |

Chat and Inbox lanes add their own events (`chat_message.created`, `inbox_item.created` exists) by
calling the same `declareStreamedEvents` and `append`; the plugin exports `RealtimeHints` so a
plugin can append a hint without re-implementing the addressing rules.

## 6. UI Surface

None in this lane. Clients: Angular service (`chat-ui` lane) and Ever Teams `realtime-client`
lane open `graphql-ws` against the existing subscription endpoint with the user's JWT in
`connection_init` (`authorization`, `tenant-id`, `organization-id`), subscribe to
`collaborationEvents`, and call `GET /realtime/events` on reconnect.

## 7. MCP Tools, SDKs and Integrations

- No MCP tools. OpenAPI gains the three REST routes (SDK regeneration at release).

## 8. Background Jobs

None. Outbox dispatch and retention are the existing worker's.

## 9. Security & Permissions

- `REALTIME_SUBSCRIBE` on every route and the subscription field; `FEATURE_GRAPHQL` guard on the field.
- Addressed payloads carry `recipientUserIds`; the topic stream admits them only for a recipient
  (`tenantScopedTopicStream` default `recipientsOf`); catch-up applies the same rule in SQL.
- Typing input validated (UUIDs, ≤ 50 recipients) and rate-limited; no message text ever travels.
- Presence status is an enum; `away`/`idle` map to `isIdle = true` for persistence.

## 10. Observability

- Counters (Nest `Logger` + the existing metrics seam where present): hints appended per name,
  signals published, catch-up calls, resync answers.

## 11. Phased Rollout

1. Contracts + permission + plugin skeleton + catalogue + hints + migration (flag off): PR 1.
2. Presence/typing routes + `collaborationEvents` field + catch-up + tests: PR 1 (same lane) or PR 2.
3. Enable on dev (`GAUZY_REALTIME_ENABLED=true`), verify with a graphql-ws client script.
4. Default stays off; chat-ui and Ever Teams lanes consume it.

## 12. Constitution Reconciliation

- I Plugin-first: new plugin; core gains only `CommentEvent` (+ contracts).
- II Scoping: every hint carries tenant (outbox) and organization; topics are per tenant.
- III ORMs/migrations: one additive seed migration, tri-dialect; no entity.
- IV Flag: `GAUZY_REALTIME_ENABLED` exact `true`; nothing removed; polling untouched.
- V Contracts first: `realtime.model.ts` lands first.
- VI Security: permission, addressing, validation, rate limit.
- VII Event bus: this is the channel.
- VIII i18n: n/a (no UI).
- IX Tests: specs per service and the resolver.
- X Behaviour-first spec: unchanged.
- XI Vendor-neutral docs.

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| GraphQL snapshot / field-binding gate fails for the gated plugin SDL | high | CI red | add the schema file to `GATED_PLUGIN_SCHEMAS` in `tools/scripts/graphql-field-binding-check.mjs`, keep a plain `gql` template |
| Outbox retention shorter than the spec's 24 h window | medium | more resyncs | catch-up answers `resync` honestly; retention knob documented |
| `document.updated` subscription by constructor name misses a renamed class | low | no doc hints | spec test asserts the name; chat/docs lanes may switch to a direct import |
| Hint storms on bulk task updates | medium | load | coalesce per aggregate per second (trailing edge, so the last edit is announced) in `RealtimeHintsService` |
| Multi-replica without Redis engine | medium | missed events across replicas | status route reports the engine; runbook note |

## 14. References

- Spec: `./spec.md` · Tasks: `./tasks.md` · Architecture: `../../architecture/collaboration-suite.md`
- Kernel: `packages/core/src/lib/graphql/subscriptions/`, `packages/core/src/lib/event-outbox/`, `packages/plugins/inbox/src/lib/realtime/inbox-realtime.ts`
