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
  written through chat routes that check membership. The platform's generic
  `/reaction` routes leave them out (refused, or read as not found).
- **Mentions** go through the platform's mention service (a MENTION
  notification, filed in the Inbox); a direct or group message and a reply in a
  followed thread create a MESSAGE notification. Reading a conversation marks
  them read, except a reply that lives in a thread only: reading that thread
  marks it read.
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
  /plugins/docs/documents/upload`): a message carries only files its sender
  uploaded, and each one is linked to the message (`DocumentLink { entity:
  ChatMessage }`), so the documents' side shows where a file was shared and the
  conversation's files pane (`GET /conversations/:id/files`) lists what its
  messages carry, newest first. A deleted message's links go with it.

## Tables

`chat_category`, `chat_conversation`, `chat_member`, `chat_message`,
`chat_thread_follow`, `chat_task_reference` (migration `1791000006100`,
PostgreSQL / MySQL / SQLite, idempotent) and the role grants (`1791000006200`:
`CHAT_VIEW` and `CHAT_SEND` for the SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE and
DATA_ENTRY roles, `CHAT_MANAGE` for SUPER_ADMIN, ADMIN and MANAGER; a grant a
tenant switched off by hand stays off). A direct or group conversation is
unique per organization by its `directKey` (unique index `tenantId`,
`organizationId`, `directKey`; migration `1791000006600` replaced the
per-tenant one). Incoming webhooks (`1791000006730`): `chat_webhook`,
`chat_webhook_interaction`, and `chat_message.webhookId` / `appIconUrl` /
`blocks` with a unique (`webhookId`, `nonce`).

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
| `GET /conversations/:id/files?limit=&skip=` | the files the conversation's messages carry (a document the message itself names, still there), newest first, with the message and its author |
| `POST /conversations/:id/messages` | send: `{ body, nonce?, replyToId?, threadRootId?, alsoInConversation?, attachmentIds?, mentionEmployeeIds?, taskId? }` |
| `GET /messages/:id/thread` · `POST /:id/follow` · `/:id/unfollow` · `POST /:id/thread/read` | threads (read marks a followed thread's replies read) |
| `PATCH /messages/:id` · `DELETE` · `POST /:id/pin` · `/:id/unpin` · `/:id/unread` | one message |
| `POST /messages/:id/create-task { projectId?, organizationTeamId?, title?, assigneeEmployeeIds? }` | a task from a message (`ORG_TASK_ADD` too), in the team named (a team of the conversation's organization, so its lists show the task): its first line as the title unless given, the text as the description (HTML); the message keeps a `created` reference — a 500 that names the task id means the task exists but could not be linked |
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

## GraphQL (served only with the plugin)

The read routes have GraphQL twins (`graphql/chat.schema.ts`, `ChatResolver`; the chat spec T17), registered by the
plugin's `extensions` and named in the field-binding gate (`tools/scripts/graphql-field-binding-check.mjs`):
`chatPeople`, `chatCategories`, `chatConversations`, `chatBrowseConversations`, `chatStates`, `chatConversation(id)`,
`chatConversationMembers(id)`, `chatMessages(conversationId, query)`, `chatPins(conversationId)`, `chatThreads`,
`chatThread(messageId, query)`. Each reaches the service method its route reaches, as the caller, behind the same
guards (`CHAT_VIEW`, the tenant's `FEATURE_CHAT`, and the GraphQL capability `FEATURE_GRAPHQL`); the page query is
validated with the route's DTO. Enumerated values are strings holding the REST values. The writes stay REST.

## Enabling

```env
GAUZY_CHAT_ENABLED=true
FEATURE_CHAT=true            # or switch the feature on per tenant in Settings → Features
GAUZY_CHAT_WEBHOOKS_ENABLED=true   # optional: incoming webhooks
```

## Incoming webhooks (`GAUZY_CHAT_WEBHOOKS_ENABLED=true`)

Automation posts into a channel through a per-channel URL (`docs/specs/features/chat-incoming-webhooks/`). Off unless
the flag is exactly `true` (and chat is on): every route below answers 404.

- **Manage** (a manager of the channel, its creator or `CHAT_MANAGE`; writes need `CHAT_SEND`):
  `GET|POST /api/chat/conversations/:id/webhooks`, `PATCH|DELETE /api/chat/webhooks/:id` (`DELETE` revokes; the row
  stays), `POST /api/chat/webhooks/:id/secret` (a new signing secret). Channels only, at most ten active per channel.
  The create answer holds the URL and the signing secret, shown that once: the URL secret is stored as its SHA-256,
  the signing secret encrypted (`ENCRYPTION_KEY`). Creating, changing and revoking are written to the activity log.
- **Post**: `POST /api/chat/hooks/:secret`, public, a JSON body (or a form body with a `payload` field) in the widely
  used chat-bot shape: `text`, `blocks` (header, section with text and fields, divider, context, actions with
  buttons; any other type shows as its text), legacy `attachments`. Everything is plain text (HTML dropped);
  `username`, `icon_url` and `channel` are ignored. A `nonce` (or `Idempotency-Key`) makes a retry post once.
  Answers `200 ok`, `404 no_webhook`, `410 channel_is_archived`, `422 invalid_payload | payload_too_large (64 KiB; over 128 KiB the API's body parser answers 413 before reading it) |
  too_many_blocks (50) | invalid_blocks | no_text`, `429 rate_limited` with `Retry-After` (per webhook 60/min and 20
  per 10 s, per organization 600/min and 100 per 10 s; `GAUZY_CHAT_WEBHOOK_*` in `.env.sample`).
- **The message**: `kind: app`, no employee author, `webhookId`, `appName`, `appIconUrl`, `blocks`; counted and
  streamed like a member's message; its mentions move the mention badges (no inbox notification yet: the platform's
  notification writes need a signed-in author). `<!channel>` / `<!here>` count only when the webhook may broadcast.
- **Buttons**: `POST /api/chat/messages/:id/interactions` `{ actionId, blockId? }` (members; 404 otherwise) posts a
  signed callback to the webhook's interaction URL: `X-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">` (the
  platform's outgoing-webhook signature; verify within 300 s), `Idempotency-Key` = `X-Interaction-Id` = the
  `interactionId`, the same on the three retries (2 s, 10 s, 30 s), each signed afresh. The body names the actor
  (employee id and name only), the message, the action id and its stored value. A 2xx JSON reply with `text` /
  `blocks` / `attachments` replaces the message once (`"replace_original": false` leaves it). The interaction URL
  must be `https:` on a public host; it is resolved when saved and at every attempt through the plugin's egress
  guard (`src/lib/egress`), no redirect followed. `GET /api/chat/interactions/:id` answers the clicker the state.

## Not yet in this plugin (next slices)

The Ever Teams client (in progress); incoming webhooks: a later-reply URL, mentions inside blocks.
