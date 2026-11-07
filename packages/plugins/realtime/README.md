# @gauzy/plugin-realtime

The real-time channel of the platform: every signed-in employee can open one push stream and learn, within
a second, that a task, a comment, a document or their notifications changed, that someone mentioned them,
that a colleague is online or typing. Spec: `docs/specs/features/realtime-channel/`.

**Off by default.** The plugin is loaded only when `GAUZY_REALTIME_ENABLED=true` (exactly). Off, nothing
changes: no route, no GraphQL field, no outbox row, no role grant.

## What it is built on

Nothing new is invented for transport:

- **Change hints** are rows on the platform **event outbox** (`event_outbox`), appended after each domain
  write from the facts the domains already publish in process (`TaskEvent`, `DocumentEvent`, `CommentEvent`,
  `CreateMentionEvent`, `EmployeeCreateNotificationEvent`). A hint is content-free: `entity`, `entityId`,
  `action`, the parent record, the project — never the record itself. A client refetches what it may read.
- **Streaming** is the platform's GraphQL subscription surface over `graphql-ws`. The plugin declares its
  events with the subscription catalogue and adds one typed field, `Subscription.collaborationEvents`, that
  every employee may open with `REALTIME_SUBSCRIBE` (the kernel's `Subscription.events` stays reserved for
  `EVENT_OUTBOX_VIEW` holders).
- **Signals** (`presence.changed`, `typing.signalled`) are published straight to the pub/sub, never stored.
- **Catch-up** after a reconnect is `GET /api/realtime/events?after=<epoch ms>`: the same outbox rows,
  scoped to the caller.

Multi-replica deployments set `GRAPHQL_PUBSUB_ENGINE` (a Redis-backed engine) so a subscriber on one API
replica sees the events of another; a single instance uses the in-process engine.

## Events

| Name | Durable | Audience | Payload |
| --- | --- | --- | --- |
| `task.created` / `task.updated` / `task.deleted` | yes | organization | `{ entity: 'Task', entityId, action, projectId, organizationId, actorUserId }` |
| `comment.created` / `comment.updated` / `comment.deleted` | yes | organization | `{ entity: 'Comment', entityId, action, parent: { entity, entityId }, parentCommentId }` |
| `mention.created` | yes | the mentioned employee's user | `{ entity, entityId, parent, mentionedEmployeeId }` |
| `employee_notification.created` | yes | the receiver's user | `{ entity, entityId, type, receiverEmployeeId }` |
| `document.updated` | yes | organization | `{ entity: 'Document', entityId, action }` |
| `presence.changed` | no | organization | `{ employeeId, userId, status, at }` |
| `typing.signalled` | no | the named users | `{ conversationId, threadRootId, employeeId, userId, at }` |

Repeated `*.updated` hints of one aggregate within one second are folded into one.

## Routes (all need `REALTIME_SUBSCRIBE`)

| Route | What |
| --- | --- |
| `GET /api/realtime/status` | whether this process serves subscriptions; the selectable names |
| `GET /api/realtime/events?after=&limit=` | catch-up: events since `after` (epoch ms), oldest first, `cursor` to continue from, `resync: true` when `after` is older than what is retained |
| `POST /api/realtime/presence { status }` | `active` / `idle` / `away` / `offline`; persisted on the employee, published to the organization |
| `POST /api/realtime/typing { conversationId, threadRootId?, recipientUserIds }` | ephemeral, at most 50 recipients, rate-limited |

## Subscribing

```graphql
subscription {
	collaborationEvents(names: ["task.*", "comment.*", "mention.created", "presence.changed"]) {
		eventId
		eventName
		occurredAt
		aggregate { type id }
		sequence
		data
	}
}
```

Over `graphql-ws`, with the user's JWT in the `connection_init` payload (`authorization: Bearer …`,
`tenant-id`, `organization-id`), exactly as for every platform subscription. On reconnect call
`GET /api/realtime/events?after=<last occurredAt in ms>` and apply the answer by `eventId`; on
`resync: true` refetch through the read APIs.

## Enabling

```
GAUZY_REALTIME_ENABLED=true
```

The plugin's migration grants `REALTIME_SUBSCRIBE` to SUPER_ADMIN, ADMIN, MANAGER and EMPLOYEE of every
tenant the first time the plugin loads; new tenants get it from the default role permissions.

## For other plugins

Inject `RealtimeHintsService` (optional) and call `appendHint({ name, aggregateType, aggregateId, tenantId,
organizationId, hint })` after your write; declare your names with the subscription catalogue if they are
not in the collaboration catalogue. Inject `RealtimeSignalsService` for ephemeral signals.
