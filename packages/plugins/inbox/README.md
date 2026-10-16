# @gauzy/plugin-inbox

The Gauzy **Inbox** brings together everything addressed to a user: questions, approvals, escalations and notices, and later
email. Each user has their own read, archive and snooze state. It is a general Gauzy feature and works without Ever Works.
The Ever Works integration _feeds_ the Inbox and acts on its replies through a source-handler registry, so this plugin never
depends on the integration.

Plan: `ever-co/homelab` `docs/superpowers/specs/2026-10-15-gauzy-ever-works-integration/04-inbox-and-email.md` §2–4 (G-P3-1).

## Switch

**Off by default.** The API loads the plugin only when `GAUZY_INBOX_ENABLED=true` (exactly). When it is off, the plugin is
not loaded at all: no route, no table (its migrations are not registered) and no role grant. Any other value also keeps it
off, and is logged once.

## Tables (migrations for PostgreSQL, MySQL and SQLite)

| Table                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inbox_item`           | `kind` (QUESTION, APPROVAL, ESCALATION, NOTICE, EMAIL), `source` (EVER_WORKS, EMAIL, GAUZY, SYSTEM, or a handler's own), `status` (OPEN, ANSWERED, RESOLVED, CANCELLED), `title`, `body`, `bodyFormat`, `options` (JSON), `requireReason`, `response` (JSON), `priority`, `dueAt`, the links (`entity` + `entityId`, `taskId`, `projectId`, `agentEmployeeId`; `mailboxId` / `emailId` for P4), `externalSource` + `externalId` (unique per tenant), `metadata` (JSON) |
| `inbox_item_recipient` | `inboxItemId`, `userId` (unique together), `isRead` / `readAt`, the base `isArchived` / `archivedAt`, `snoozedUntil`, `deliveredAt`                                                                                                                                                                                                                                                                                                                                    |

The migrations are idempotent. A re-run issues no DDL, and it repairs an index or key that a failed run left out. On
PostgreSQL they are serialised with an advisory lock, and `down` drops the tables. A third migration grants the permissions
to the existing roles of every tenant:

- `SUPER_ADMIN` and `ADMIN` get `INBOX_VIEW`, `INBOX_MAILBOX_MANAGE` and `INBOX_MAILBOX_READ_ALL`;
- `MANAGER` and `EMPLOYEE` get `INBOX_VIEW`.

New tenants get the same grants from `DEFAULT_ROLE_PERMISSIONS`.

## API (`/api/inbox/items`, `INBOX_VIEW`)

The recipient is always the caller, taken from the credential and never from a parameter.

| Method | Path                   | What                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/items`               | `?tab=all\|decisions\|email\|archived&kind=&source=&mailboxId=&unread=&q=&projectId=&taskId=&agentEmployeeId=&cursor=&limit=`: my items, newest first, each with my state. Snoozed items stay hidden until their time.                                                                                                                               |
| GET    | `/items/counts`        | `{ unread, decisionsOpen, byMailbox }` (for the header badge)                                                                                                                                                                                                                                                                                        |
| GET    | `/items/:id`           | One of my items with my state. A holder of `INBOX_MAILBOX_READ_ALL` may also read the mailbox items (P4) of the organizations they are a member of, never another user's personal items.                                                                                                                                                             |
| POST   | `/items/:id/reply`     | `{ text?, optionId? }` for a question, an approval or an escalation. The reply goes to the item's source handler **synchronously**, so the source's own refusal (for example "already decided in Ever Works") reaches the user. The reply is claimed once: two overlapping replies dispatch once. When the source refuses, the item is `OPEN` again. |
| PATCH  | `/items/:id/state`     | `{ isRead?, isArchived?, snoozedUntil? }`: my state only. The source handler is told about it on a best-effort basis.                                                                                                                                                                                                                                |
| POST   | `/items/mark-all-read` | `{ tab? }`                                                                                                                                                                                                                                                                                                                                           |

The Notifications tab of the UI reads `/employee-notification` directly. A GraphQL mirror of the read routes, and the
mailbox, email and provider routes (P4), come later.

## Feeding the Inbox from another plugin

`@gauzy/contracts` exports the interfaces (`IInboxSourceHandler`, `IInboxItemWriter`) and two injection tokens. When the
Inbox is loaded, its module is global and provides both tokens. When the Inbox is off they are absent, so inject them
optionally:

```ts
constructor(
	@Optional() @Inject(INBOX_SOURCE_HANDLER_REGISTRY) private readonly registry?: IInboxSourceHandlerRegistry,
	@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter
) {}

onModuleInit() {
	this.registry?.register({
		source: 'EVER_WORKS',
		onReply: async (item, reply, actor) => ({ routed: await this.sendToEverWorks(item, reply, actor) }),
		onStateChange: async (item, recipient, change) => this.mirrorState(item, recipient, change)
	});
}

// Idempotent on (tenantId, externalSource, externalId); recipients that are not users of the tenant are left out.
// A re-delivery changes only the fields it states: a field left out keeps its value (an answered item stays answered).
await this.inbox?.upsertExternal({ tenantId, kind, source: 'EVER_WORKS', externalSource: 'ever_works', externalId, title, recipients });
```

Platform notices use `create({ …, source: 'SYSTEM', recipients })`. Items from `GAUZY` and `SYSTEM` need no handler:
their replies stay in Gauzy.

The organization of an item must be one of its tenant's (`400` otherwise). EMAIL items (P4) also state `mailboxId` and
`emailId`. This writer (`create`, `upsertExternal`), the recipient model and the source-handler registry are the stable
surface other plugins build on (the Ever Works integration, the P4 inbound-email pipeline): change them additively.

## Tests

`node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/plugins/inbox/jest.config.ts --runInBand`

- The switch and the registry.
- The entity metadata: every column has a type both ORMs map (a `| null` design type is emitted as `Object` under
  `strictNullChecks`, which TypeORM refuses at boot).
- On a real SQLite database: the migrations (up, up again, down), the role grants, recipient-scoped reads with tabs,
  filters, search and pages, the counts, replies (local; through a handler; released when the source refuses; one dispatch
  for two overlapping replies; refused for a source that is not connected), recipient state, mark-all-read, and source
  writes (idempotent, a re-delivery changes only what it states, overlapping deliveries create the item once,
  recipients limited to the tenant, the organization checked against the tenant).
