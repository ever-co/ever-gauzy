# @gauzy/plugin-chat

Chat between the employees of an organization: channels (public or private, grouped in categories), direct and
group messages, threads, reactions, pins, @mentions, attachments and task cards. Spec:
`docs/specs/features/chat/`.

**Off by default.** The plugin is loaded only when `GAUZY_CHAT_ENABLED=true` (exactly), and its routes answer only
for tenants whose `FEATURE_CHAT` toggle is on. Off, nothing changes: no route, no table, no role grant.

## What it is built on

- **Reactions** are the platform's `Reaction` rows (`entity = ChatMessage`), written through chat routes that check
  membership.
- **Mentions** go through the platform's mention service (a MENTION notification, filed in the Inbox); a direct or
  group message and a reply in a followed thread create a MESSAGE notification. Reading a conversation marks them
  read.
- **Real time**: every write appends content-free, addressed facts to the event outbox (`chat_message.created`,
  `chat_message.updated`, `chat_message.deleted`, `chat_conversation.changed`, `chat_member.state_changed`,
  `chat_thread.changed`) and answers the same facts, so the sender applies them at once and subscribers get the rest.
- **Unread counts are counters**: `chat_member.readCount` / `mentionCount` are written in the message transaction;
  `unread = conversation.messageCount − readCount`. One call (`GET /chat/states`) answers every badge.
- **Attachments** are document ids uploaded through the Docs plugin (`POST /plugins/docs/documents/upload`).

## Tables

`chat_category`, `chat_conversation`, `chat_member`, `chat_message`, `chat_thread_follow`, `chat_task_reference`
(migration `1791000006100`, PostgreSQL / MySQL / SQLite, idempotent) and the role grants (`1791000006200`:
`CHAT_VIEW`, `CHAT_SEND` for everyone who works in the organization, `CHAT_MANAGE` for administrators and managers).

## Routes (`/api/chat`, `CHAT_VIEW`; writes `CHAT_SEND`; 404 for a conversation the caller is not in)

| Route | What |
| --- | --- |
| `GET /categories` · `POST` · `PATCH /:id` · `DELETE /:id` | sidebar categories (`CHAT_MANAGE`) |
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
| `GET /messages/:id/thread` · `POST /:id/follow` · `/:id/unfollow` | threads |
| `PATCH /messages/:id` · `DELETE` · `POST /:id/pin` · `/:id/unpin` · `/:id/unread` | one message |
| `POST` / `DELETE /messages/:id/reactions/:emoji` | reactions |
| `GET /threads` · `POST /read-all` · `POST /read-restore { snapshotId }` | followed threads; mark all read with a one-minute undo |

Mention tokens in a body: `<@employeeId>`, `<#conversationId>`, `<!channel>`, `<!here>` — rename-safe, rendered
as chips by the clients. Sends are idempotent per `nonce` for a day.

## Enabling

```
GAUZY_CHAT_ENABLED=true
FEATURE_CHAT=true            # or switch the feature on per tenant in Settings → Features
```

## Not yet in this plugin (next slices)

Link previews, search, task references typed as `KEY-number`, "create task from message", incoming webhooks, the
Angular UI (`@gauzy/plugin-chat-ui`), GraphQL twins, the Ever Teams client.
