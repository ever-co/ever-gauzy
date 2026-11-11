# @gauzy/plugin-realtime

The real-time channel of the platform: every signed-in employee can open one
push stream and learn, within a second, that a task, a comment, a document or
their notifications changed, that someone mentioned them, that a colleague is
online or typing. Spec: `docs/specs/features/realtime-channel/`.

**Off by default.** The plugin is loaded only when `GAUZY_REALTIME_ENABLED=true`
(exactly). Off, nothing changes: no route, no GraphQL field, no outbox row, no
role grant.

## What it is built on

Nothing new is invented for transport:

- **Change hints** are rows on the platform **event outbox** (`event_outbox`),
  appended after each domain write from the facts the domains already publish in
  process (`TaskEvent`, `DocumentEvent`, `CommentEvent`, `CreateMentionEvent`,
  `EmployeeCreateNotificationEvent`). A hint is content-free: `entity`,
  `entityId`, `action`, the parent record, the project — never the record
  itself. A client refetches what it may read.
- **Streaming** is the platform's GraphQL subscription surface over
  `graphql-ws`. The plugin declares its events with the subscription catalogue
  and adds one typed field, `Subscription.collaborationEvents`, that every
  employee may open with `REALTIME_SUBSCRIBE` (the kernel's
  `Subscription.events` stays reserved for `EVENT_OUTBOX_VIEW` holders).
- **Signals** (`presence.changed`, `typing.signalled`) are published straight to
  the pub/sub, never stored. Presence is kept per connection (each tab or
  device reports under its own `connectionId`) in the plugin's
  `realtime_presence` table and merged per employee (`active`, then `idle`,
  then `away`, `offline` when no connection is left), so closing one of two
  tabs leaves the other's state;
  `presence.changed` is published only when the merge changes, on a report or
  when a connection lapses (no report for 150 s, settled by a sweep every 30 s).
- **Catch-up** after a reconnect is `GET /api/realtime/events?after=<epoch
  ms>&afterId=<eventId>`: the same outbox rows, scoped to the caller, walked by
  an exact (time, id) cursor. The cursor it answers never passes the settle
  horizon (10 s behind now), so a row that commits after a later-stamped one was
  answered is still ahead of it; `resync` is answered only when a retention
  removed rows after the cursor (the `realtime_replay_watermark` table).

### How fast an event arrives

A commit that appended wakes the dispatch worker right away instead of waiting
for the per-minute tick (`GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT=false` turns
that off):

- **With a queue**: the API's queue worker runs the passes; the per-minute tick
  stays as the safety net.
- **No queue** (`REDIS_ENABLED` not `true`): the API runs the same worker
  in-process (`EventOutboxInlineDispatchModule`), woken by each commit and by a
  15 s sweep. Before, nothing dispatched at all in this mode.
  `EVENT_OUTBOX_INLINE_DISPATCH=false` turns it off.

With Redis on, subscription events travel through Redis pub/sub between every
API and worker process (`RedisGraphqlPubSubEngine`), so a pass run in one
process reaches a socket held by another. `GRAPHQL_PUBSUB_REDIS=false` keeps the
in-process engine; `GRAPHQL_PUBSUB_CHANNEL_PREFIX` names the channels (by
default derived from the database and `API_BASE_URL`, so installations that
share one Redis stay apart).

`GET /api/realtime/status` reports this as `delivery: { dispatch, shared,
singleProcess, prompt }`. A client may stop polling only when `prompt` is true:
dispatched right after the write, and reaching the socket whichever process
dispatched it — the pub/sub is shared (Redis), or there is one API process
(SQLite, or `GAUZY_API_SINGLE_PROCESS=true`). Several API replicas need Redis.

## Events

| Name | Durable | Audience | Payload |
| --- | --- | --- | --- |
| `task.created` / `task.updated` / `task.deleted` | yes | the organization's task readers (`ALL_ORG_VIEW` or `ORG_TASK_VIEW`) | `{ entity: 'Task', entityId, action, projectId, organizationId, actorUserId }` |
| `comment.created` / `comment.updated` / `comment.deleted` | yes | the readers of the record whose comments changed | `{ entity: 'Comment', entityId, action, parent: { entity, entityId }, parentCommentId }` |
| `mention.created` | yes | the mentioned employee's user | `{ entity, entityId, parent, mentionedEmployeeId }` |
| `employee_notification.created` | yes | the receiver's user | `{ entity, entityId, type, receiverEmployeeId }` |
| `document.updated` | yes | the page's readers (Docs visibility, team space, shares) | `{ entity: 'Document', entityId, action }` |
| `presence.changed` | no | organization | `{ employeeId, userId, status, at }` |
| `typing.signalled` | no | the named users | `{ conversationId, threadRootId, employeeId, userId, at }` |

The subscription and the catch-up also offer the events the chat and inbox
plugins declare when they are loaded (`chat_message.*`, `chat_conversation.*`,
`chat_member.*`, `chat_thread.*`, `inbox_item.*`): the collaboration
families, and nothing of another family.

**Who receives an event is decided when it is handed over**, live and in the
catch-up alike, in the subscriber's request context (`RealtimeAudience`): an
addressed event goes to its recipients only, and then every event must pass the
audience checks of its name — the read rule of the page, task or comment thread
it names (the hints themselves are organization-wide on the outbox), and the
checks other plugins register with `SubscriptionCatalogue.restrictAudience` (the
chat plugin: current conversation membership, so a member who left or was
removed no longer replays the conversation). A check runs once per batch — a
catch-up page, or a live event — never once per row.

Repeated `*.updated` hints of one aggregate within one second are folded: the
first is appended at once, the latest of the rest when the second closes. A fact
without its organization (a partial save result) produces no organization-wide
hint.

## Routes (all need `REALTIME_SUBSCRIBE`)

| Route | What |
| --- | --- |
| `GET /api/realtime/status` | whether this process serves subscriptions; the selectable names |
| `GET /api/realtime/events?after=&afterId=&limit=` | catch-up (below) |
| `POST /api/realtime/presence {status, connectionId?}` | presence (below) |
| `POST /api/realtime/typing { conversationId, threadRootId?, recipientUserIds }` | ephemeral, at most 50 recipients, rate-limited |

**Catch-up** answers the events after the cursor (`after` + `afterId` = the
previous answer's `cursor` + `cursorId`), oldest first, and the position to
continue from: the position walked to (possibly a row addressed to someone
else), never past the settle horizon — 10 s behind now, and on Postgres also
behind the oldest open database transaction (for at most 5 minutes). The
events may run past that position and are answered again next time.
`hasMore` says more follows now; it is `false` once the answer reached the
horizon even when newer events exist (they arrive by the stream, and by the
next catch-up once the horizon passed them). `resync: true` says a retention
removed rows after the cursor: refetch through the read APIs.

**Presence** is `active` / `idle` / `away` / `offline` of one connection
(`offline` ends it). The answer is the employee's merged presence. The employee
row keeps only `lastSeenAt` and `isIdle` (`true` for idle, away and offline
alike), for clients that poll; the four states live in the plugin's table and
the events. It is published to the organization when it changed — at most
once per employee per 5 s, the window's latest state when it closes — with the
employee's `revision` (higher for every change: apply a
`presence.changed` only when its revision is higher than the last applied).
Without `connectionId`, every tab of the employee shares one connection that
never lapses (the last report wins).

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

Over `graphql-ws`, with the user's JWT in the `connection_init` payload
(`authorization: Bearer …`, `tenant-id`, `organization-id`), exactly as for
every platform subscription. Keep as the resume position the `cursor` and
`cursorId` of the last catch-up answer — **not** the newest event applied: the
stream delivers neither in commit order nor at once (the outbox dispatcher runs
right after each commit and every minute, and retries), so a streamed event is
no proof that the events
stamped before it have arrived. On every reconnect (and, while connected, every
minute or so, to keep the position fresh) call `GET
/api/realtime/events?after=&afterId=`, apply the answer by `eventId` (events
repeat: an answer may run past its cursor, and the stream delivers them too),
repeat while `hasMore`, and on `resync: true` refetch through the read APIs.
Events also arrive out of order (stream and catch-up interleave): treat each
as a hint to refetch the record it names, rather than applying the counters it
carries over newer ones (a presence change carries a `revision` for that). A
client with no cursor yet starts from the answer's `cursor` (the settle
horizon).

Presence: give each tab or device a random `connectionId` (a UUID; at most 64
letters, digits, `-` or `_` are accepted) and send its status on every change
and at least every minute unchanged (a connection not heard from for 150 s
lapses), and `offline` when the page closes (a `keepalive` request).

## Enabling

```env
GAUZY_REALTIME_ENABLED=true
```

The plugin's migration grants `REALTIME_SUBSCRIBE` to SUPER_ADMIN, ADMIN,
MANAGER and EMPLOYEE of every tenant the first time the plugin loads; new
tenants get it from the default role permissions.

### Outbox retention (off by default)

```env
GAUZY_REALTIME_RETENTION_ENABLED=true
```

Once an hour, the dispatched collaboration events older than 24 hours and
beyond the newest 1,000 of each organization (and of the tenant-wide events)
are removed from the event outbox, at most 500 per organization per pass, and
the replay watermark moves with them in the same transaction: a client whose
catch-up cursor falls behind it is answered `resync`. Pending, failed and dead
rows, other domains' events, rows without a tenant, the newest row of each
aggregate (its numbering continues from it) and rows a consumer has not
acknowledged (a dead delivery is replayed from its outbox row) are never
removed. A delivery whose outbox row was removed is not replayable: the replay
answers not found.

A replay and a pass that meet on one row do not lose it: the replay holds the
row (`FOR UPDATE`) while it resets the delivery and re-queues the row, so either
the delete lands first and the replay answers not found with the delivery
untouched, or the delete waits and then keeps the row the replay re-queued. Both
orders run on PostgreSQL, with the replay on TypeORM and on MikroORM, in
`realtime-retention.replay-lock.postgres.spec.ts`:
`REALTIME_TEST_POSTGRES_URL=postgres://… yarn nx run plugin-realtime:test-postgres`
(a disposable database; without the URL the suite is skipped).

It deletes rows, so it is a separate switch: on production, turn it on only
after checking the database's backups. On a large outbox, also run `EXPLAIN`
on the pass's scope query (a `GROUP BY` of `event_outbox` by tenant and
organization) first, and add a composite index on `tenantId`,
`organizationId`, `eventName` and `createdAt` if it is slow.

## For other plugins

Inject `RealtimeHintsService` (optional) and call `appendHint({ name,
aggregateType, aggregateId, tenantId, organizationId, hint })` after your write;
declare your names with the subscription catalogue if they are not in the
collaboration catalogue. Inject `RealtimeSignalsService` for ephemeral signals.
