<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-inbox",
      "## Switch",
      "## Tables (migrations for PostgreSQL, MySQL and SQLite)",
      "## API (`/api/inbox/items`, `INBOX_VIEW`)",
      "## Feeding the Inbox from another plugin",
      "## Real time (G-P3-6)",
      "## Tests"
    ]
  }
}
-->

# @gauzy/plugin-inbox

The Gauzy **Inbox** brings together everything addressed to a user:
questions, approvals, escalations and notices, and later email. Each user has
their own read, archive and snooze state. It is a general Gauzy feature and
works without Ever Works. The Ever Works integration _feeds_ the Inbox and
acts on its replies through a source-handler registry, so this plugin never
depends on the integration.

Plan: `04-inbox-and-email.md` §2–4 (G-P3-1) of the Gauzy ↔ Ever Works
integration plan (`ever-co/homelab`, `docs/superpowers/specs/`).

## Switch

**Off by default.** The API loads the plugin only when
`GAUZY_INBOX_ENABLED=true` (exactly). When it is off, the plugin is not loaded
at all: no route, no table (its migrations are not registered) and no role
grant. Any other value also keeps it off, and is logged once.

Mailboxes, inbound email and the email provider plugins are a second
plugin of this package, `InboxEmailPlugin`, off unless
`GAUZY_INBOX_EMAIL_ENABLED=true` as well: see [EMAIL.md](./EMAIL.md).

## Tables (migrations for PostgreSQL, MySQL and SQLite)

- **`inbox_item`:** `kind` (QUESTION, APPROVAL, ESCALATION, NOTICE, EMAIL),
  `source` (EVER_WORKS, EMAIL, GAUZY, SYSTEM, or a handler's own), `status`
  (OPEN, ANSWERED, RESOLVED, CANCELLED), `title`, `body`, `bodyFormat`,
  `options` (JSON), `requireReason`, `response` (JSON), `priority`, `dueAt`,
  the links (`entity` + `entityId`, `taskId`, `projectId`, `agentEmployeeId`;
  `mailboxId` / `emailId` for P4), `externalSource` + `externalId` (unique per
  tenant) and `metadata` (JSON).
- **`inbox_item_recipient`:** `inboxItemId` and `userId` (unique together),
  `isRead` / `readAt`, the base `isArchived` / `archivedAt`, `snoozedUntil`
  and `deliveredAt`.

The migrations are idempotent. A re-run issues no DDL, and it repairs an index
or key that a failed run left out. On PostgreSQL they are serialised with an
advisory lock, and `down` drops the tables. A third migration grants the
permissions to the existing roles of every tenant:

- `SUPER_ADMIN` and `ADMIN` get `INBOX_VIEW`, `INBOX_MAILBOX_MANAGE` and
  `INBOX_MAILBOX_READ_ALL`;
- `MANAGER` and `EMPLOYEE` get `INBOX_VIEW`.

New tenants get the same grants from `DEFAULT_ROLE_PERMISSIONS`.

The entity columns without an explicit `type` are typed `?: Date` / `?: ID`,
not `| null`: under this package's `strictNullChecks` a `| null` union is
emitted as design type `Object`, which TypeORM refuses at boot.

## API (`/api/inbox/items`, `INBOX_VIEW`)

The recipient is always the caller, taken from the credential and never from
a parameter. Answers are `Cache-Control: no-store`.

- **`GET /items`**
  `?tab=all|decisions|email|snoozed|archived&kind=&source=&mailboxId=&unread=`
  `&q=&projectId=&taskId=&agentEmployeeId=&cursor=&limit=`: my items, newest
  first, each with my state. A snoozed item stays hidden from the other tabs
  until its time; `snoozed` lists them meanwhile.
- **`GET /items/counts`:** `{ unread, decisionsOpen, byMailbox }` (for the
  header badge).
- **`GET /items/:id`:** one of my items with my state. A holder of
  `INBOX_MAILBOX_READ_ALL` may also read the EMAIL items of a mailbox (P4) of
  the organizations they are an active member of, never another user's
  personal items.
- **`POST /items/:id/reply`:** `{ text?, optionId? }` for a question, an
  approval or an escalation. The reply goes to the item's source handler
  **synchronously**, so the source's own refusal (for example "already decided
  in Ever Works") reaches the user. The reply is claimed once: two overlapping
  replies dispatch once. When the source refuses, the item is `OPEN` again;
  once the source took it, it stays answered. A source may return the answer
  it holds (another answer won there), which is recorded instead.
- **`PATCH /items/:id/state`:** `{ isRead?, isArchived?, snoozedUntil? }`: my
  state only. The source handler is told about it on a best-effort basis.
- **`POST /items/mark-all-read`:** `{ tab? }`. Each item's source handler is
  told, as for one item (in the background, best effort).

The Notifications tab of the UI reads `/employee-notification` directly. The
mailbox, email and provider routes (P4) are described in `EMAIL.md`.

### GraphQL (served only with the plugin)

Every route has a GraphQL twin (plan 04 §3). The twins call the same service
methods, with the same DTO rules, guards and `INBOX_VIEW` permission (plus the
`FEATURE_GRAPHQL` gate every resolver carries); no argument names a user or a
recipient, so the recipient is always the caller.

| GraphQL                             | REST                        |
| ----------------------------------- | --------------------------- |
| `inboxItems(filter, cursor, limit)` | `GET /items`                |
| `inboxItemCounts`                   | `GET /items/counts`         |
| `inboxItem(id)`                     | `GET /items/:id`            |
| `markInboxItem(id, input)`          | `PATCH /items/:id/state`    |
| `replyInboxItem(id, input)`         | `POST /items/:id/reply`     |
| `markAllInboxItemsRead(tab)`        | `POST /items/mark-all-read` |

Enumerated values (`kind`, `status`, `tab`, …) are the REST strings. A reply
reaches the item's source synchronously, as over REST, so a refusal ("already
decided") is the mutation's error. The mailbox, message and provider twins
are listed in `EMAIL.md`. With the plugin off, the schema has none of these
fields (and the committed schema snapshot, composed from the
default plugin list, does not carry them).

## Feeding the Inbox from another plugin

`@gauzy/contracts` exports the interfaces (`IInboxSourceHandler`,
`IInboxItemWriter`) and two injection tokens. When the Inbox is loaded, its
module is global and provides both tokens. When the Inbox is off they are
absent, so inject them optionally:

```ts
constructor(
	@Optional() @Inject(INBOX_SOURCE_HANDLER_REGISTRY)
	private readonly registry?: IInboxSourceHandlerRegistry,
	@Optional() @Inject(INBOX_ITEM_WRITER)
	private readonly inbox?: IInboxItemWriter
) {}

onModuleInit() {
	this.registry?.register({
		source: 'EVER_WORKS',
		onReply: async (item, reply, actor) =>
			({ routed: await this.send(item, reply, actor) }),
		onStateChange: async (item, recipient, change) =>
			this.mirror(item, recipient, change)
	});
}

// Idempotent on (tenantId, externalSource, externalId).
await this.inbox?.upsertExternal({
	tenantId, kind, source: 'EVER_WORKS',
	externalSource: 'ever_works', externalId, title, recipients
});
```

- Recipients that are not users of the tenant are left out and reported.
- A re-delivery changes only the fields it states: a field left out keeps its
  value, so an answered item stays answered.
- The organization of an item must be one of its tenant's (`400` otherwise).
- Platform notices use `create({ …, source: 'SYSTEM', recipients })`. Items
  from `GAUZY` and `SYSTEM` need no handler: their replies stay in Gauzy.
- EMAIL items (P4) also state `mailboxId` and `emailId`.

The writer (`create`, `upsertExternal`), the recipient model and the
source-handler registry are the stable surface other plugins build on (the Ever
Works integration, the P4 inbound-email pipeline): change them additively.

## Real time (G-P3-6)

When an item is created for at least one user, the plugin appends
`inbox_item.created` to the platform outbox and declares it with the
subscription catalogue (`InboxRealtime`). The payload is the item's `id`,
`kind`, `source`, `status`, `priority`, `organizationId`, `mailboxId` and
`recipientUserIds` — never its title, body or answer, because the outbox row
is also listed by `GET /events/outbox` and can reach a tenant's webhooks. A
client that hears about an item reads it through `GET /api/inbox/items/:id`.

The event is **addressed**: the kernel delivers an event whose payload names
`recipientUserIds` only to subscriptions of those users (`Subscription.events`
and every tenant-topic stream), never to another user of the tenant who holds
the stream's permission. Subscribe with
`subscription { events(names: ["inbox_item.created"]) { eventId data } }`
(`EVENT_OUTBOX_VIEW`). A typed field for holders of `INBOX_VIEW` is a follow-up:
the schema snapshot and its gates are composed with the flag off. The header
badge keeps its 60-second count poll. Nothing here can fail an Inbox write: a
failed append is logged, and a process without an outbox or a subscription
surface (the worker) skips it.

## Tests

```sh
node --experimental-vm-modules node_modules/jest/bin/jest.js \
	-c packages/plugins/inbox/jest.config.ts --runInBand
```

- The switch and the registry.
- The GraphQL mirror: its SDL composes onto the core root types, each root
  field has its resolver method, the guards and `INBOX_VIEW`, the delegation
  to the routes' service methods, and the routes' DTO rules.
- The entity metadata: every column has a type both ORMs map.
- On a real SQLite database: the migrations (up, up again, down), the role
  grants, recipient-scoped reads with tabs, filters, search and pages, the
  counts, replies (local; through a handler; released when the source refuses;
  kept when only the bookkeeping failed; one dispatch for two overlapping
  replies; refused for a source that is not connected), recipient state,
  mark-all-read, source writes (idempotent, a re-delivery changes only what it
  states, overlapping deliveries create the item once, recipients limited to
  the tenant, the organization checked against the tenant), and the mailbox
  readers' scope.
