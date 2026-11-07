# @gauzy/plugin-chat

Chat between the employees of an organization: channels (public or private,
grouped in categories), direct and group messages, threads, reactions, pins,
@mentions, attachments and task cards. Spec: `docs/specs/features/chat/`.

**Off by default.** The plugin is loaded only when `GAUZY_CHAT_ENABLED=true`
(exactly), and its routes answer only for tenants whose `FEATURE_CHAT` toggle is
on. With the plugin off, no route answers. The chat tables are created by the
plugin's migrations the first time the plugin loads — for every tenant, whatever
its `FEATURE_CHAT` toggle says — and stay, with their data, when the plugin is
turned off again (a migration is never undone by a flag). (The chat permissions
sit in the platform's default role grants, like every plugin permission, so a
tenant has them the day the plugin is turned on; with the plugin off they guard
nothing.)
The `FEATURE_CHAT` catalogue row is seeded by the plugin's own migration
(`1791000006300`) on an existing installation, so Settings → Features shows the
toggle.

## What it is built on

- **Reactions** are the platform's `Reaction` rows (`entity = ChatMessage`),
  written through chat routes that check membership.
- **Mentions** go through the platform's mention service (a MENTION
  notification, filed in the Inbox); a direct or group message and a reply in a
  followed thread create a MESSAGE notification. Reading a conversation marks
  them read.
- **Real time**: every write appends content-free, addressed facts to the event
  outbox (`chat_message.created`, `chat_message.updated`,
  `chat_message.deleted`, `chat_conversation.changed`,
  `chat_member.state_changed`, `chat_thread.changed`) and answers the same
  facts, so the sender applies them at once and subscribers get the rest. The
  events are best effort: a write succeeds even when its event could not be
  appended (logged), and category writes publish none — a client refreshes
  through the read routes when it needs certainty (and on every reconnect).
- **Unread counts are counters**: `chat_member.readCount` / `mentionCount` are
  written in the message transaction; `unread = conversation.messageCount −
  readCount`. One call (`GET /chat/states`) answers every badge.
- **Attachments** are document ids uploaded through the Docs plugin (`POST
  /plugins/docs/documents/upload`).

## Tables

`chat_category`, `chat_conversation`, `chat_member`, `chat_message`,
`chat_thread_follow`, `chat_task_reference` (migration `1791000006100`,
PostgreSQL / MySQL / SQLite, idempotent) and the role grants (`1791000006200`:
`CHAT_VIEW` and `CHAT_SEND` for the SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE and
DATA_ENTRY roles, `CHAT_MANAGE` for SUPER_ADMIN, ADMIN and MANAGER; a grant a
tenant switched off by hand stays off).

## Routes (`/api/chat`, `CHAT_VIEW`; writes `CHAT_SEND`; 404 for a conversation the caller is not in)

| Route | What |
| --- | --- |
| `GET /categories` · `POST` · `PATCH /:id` · `DELETE /:id` | sidebar categories (`CHAT_MANAGE`) |
| `GET /people` | the active employees of my organization with name and picture (what chat shows and suggests) |
| `GET /conversations` | mine, with my state and the categories (creates the organization's `#general` on first use) |
| `GET /conversations/browse` | public channels I am not in |
| `POST /conversations` | create a channel |
| `POST /direct { employeeIds }` | find or create a direct / group conversation |
| `GET /states` | my state of every conversation + followed threads with unread replies |
| `GET /conversations/:id` · `PATCH` · `POST /:id/archive` · `/:id/unarchive` | detail and settings (managers) |
| `POST /conversations/:id/join` · `/:id/leave` | membership of channels and groups |
| `GET /conversations/:id/members` · `POST` · `DELETE /:employeeId` | members (managers add / remove) |
| `PATCH /conversations/:id/state` | my notify level (`all` / `mentions` / `muted`) and favourite flag |
| `POST /conversations/:id/read { messageId? }` | mark read up to a message (default: all) |
| `GET /conversations/:id/messages?before=&after=&around=&limit=` | messages, newest by default |
| `GET /conversations/:id/pins` | pinned messages |
| `POST /conversations/:id/messages` | send: `{ body, nonce?, replyToId?, threadRootId?, alsoInConversation?, attachmentIds?, mentionEmployeeIds?, taskId? }` |
| `GET /messages/:id/thread` · `POST /:id/follow` · `/:id/unfollow` · `POST /:id/thread/read` | threads (read marks a followed thread's replies read) |
| `PATCH /messages/:id` · `DELETE` · `POST /:id/pin` · `/:id/unpin` · `/:id/unread` | one message |
| `POST /messages/:id/create-task { projectId?, title?, assigneeEmployeeIds? }` | a task from a message (`ORG_TASK_ADD` too): its first line as the title unless given, the text as the description (HTML); the message keeps a `created` reference — a 500 that names the task id means the task exists but could not be linked |
| `POST` / `DELETE /messages/:id/reactions/:emoji` | reactions |
| `GET /threads` · `POST /read-all` · `POST /read-restore { snapshotId }` | followed threads; mark all read with a one-minute undo |
| `GET /search?q=&conversationId=&limit=&skip=` | the messages of my conversations that match, best first (the search plugin's `chat_message` index — a private declaration the generic `/search` routes leave out — filtered to the memberships I have not left) |

Mention tokens in a body: `<@employeeId>`, `<#conversationId>`, `<!channel>`,
`<!here>` — rename-safe, rendered as chips by the clients. A task typed as
`KEY-number` (the project's key, a former key, or the key derived from its name)
or linked by id (`/task/<id>`, `/tasks/<id>`, `/tasks/view/<id>`, `?taskId=`) is resolved when the
message is sent or edited and kept as a `mention` task reference; "send to chat"
(`taskId`) is a `sent` reference; the clients render all of them as task cards. Sends are idempotent
per `nonce`, with no time limit: reusing a `nonce` answers the message the sender
created with it (deleted or not) and sends nothing new, so a `nonce` must be
unique for the sender across conversations.

## Enabling

```env
GAUZY_CHAT_ENABLED=true
FEATURE_CHAT=true            # or switch the feature on per tenant in Settings → Features
```

## Not yet in this plugin (next slices)

Link previews, incoming webhooks, GraphQL twins, the Ever Teams client
(in progress).
