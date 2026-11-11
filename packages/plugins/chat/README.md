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
  messages carry, newest first, with a picture's `width` / `height` (read from its
  header by the Docs upload, `metadata.upload.image`; null when unknown). A deleted
  message's links go with it. A message of files only has an empty body; the names
  of its files (`attachmentNames`, one per line) are what notifications and the
  search index read.
- **Draft uploads** (`chat_attachment_draft`): a chat composer's Docs upload
  (`Document { kind: FILE, source: CHAT }`, stored by the upload route) is recorded
  as a draft of its uploader the moment it is stored (an insert listener on the
  data source, so every client is covered). A send or an edit that attaches it
  consumes the draft. `DELETE /attachments/:documentId` discards one; drafts older
  than `GAUZY_CHAT_DRAFT_UPLOAD_TTL_HOURS` (24) are swept every 30 minutes in the
  API processes (`GAUZY_CHAT_DRAFT_SWEEP_ENABLED=false` turns the sweep off). A
  draft is purged — the document row, and its stored file and thumbnail once no
  other document row names them — only while it is still the untouched upload
  (private, outside the documents tree, its uploader's) and nothing carries it (no
  document link, no message naming it); otherwise it stays an ordinary upload.
- **Typing**: `POST /conversations/:id/typing { threadRootId? }` tells the other
  members through the real-time channel's `typing.signalled` signal (same envelope
  as the realtime plugin's, `expiresInMs` 6000); nothing is stored, one signal per
  member and place every 2.5 s at most.

## Tables

`chat_category`, `chat_conversation`, `chat_member`, `chat_message`,
`chat_thread_follow`, `chat_task_reference` (migration `1791000006100`,
PostgreSQL / MySQL / SQLite, idempotent) and the role grants (`1791000006200`:
`CHAT_VIEW` and `CHAT_SEND` for the SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE and
DATA_ENTRY roles, `CHAT_MANAGE` for SUPER_ADMIN, ADMIN and MANAGER; a grant a
tenant switched off by hand stays off). A direct or group conversation is
unique per organization by its `directKey` (unique index `tenantId`,
`organizationId`, `directKey`; migration `1791000006600` replaced the
per-tenant one). `chat_attachment_draft` (migration `1791000007310`) holds the
draft uploads; `chat_message.attachmentNames` (`1791000007320`) the names of a
message's files.

## Routes (`/api/chat`, `CHAT_VIEW`; writes `CHAT_SEND`; 404 for a conversation the caller is not in)

| Route | What |
| --- | --- |
| `GET /categories` · `POST` · `PATCH /:id` · `DELETE /:id` | sidebar categories (`CHAT_MANAGE`) |
| `POST /categories/reorder { categoryIds, channels?: [{ categoryId, conversationIds }] }` | the order of the categories and of the channels within them, in one transaction (`CHAT_MANAGE`); moved channels are told to their members |
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
| `POST /conversations/:id/messages` | send: `{ body?, nonce?, replyToId?, threadRootId?, alsoInConversation?, attachmentIds?, mentionEmployeeIds?, taskId? }` (the body may be empty with an attachment) |
| `POST /conversations/:id/typing { threadRootId? }` | I am typing (members only; ephemeral, rate-limited) |
| `DELETE /attachments/:documentId` | discard a file I uploaded and will not send (a draft upload) |
| `GET /messages/:id/thread` · `POST /:id/follow` · `/:id/unfollow` · `POST /:id/thread/read` | threads (read marks a followed thread's replies read) |
| `PATCH /messages/:id` · `DELETE` · `POST /:id/pin` · `/:id/unpin` · `/:id/unread` | one message |
| `POST /messages/:id/create-task { projectId?, organizationTeamId?, title?, assigneeEmployeeIds? }` | a task from a message (`ORG_TASK_ADD` too), in the team named (a team of the conversation's organization, so its lists show the task): its first line as the title unless given, the text as the description (HTML); the message keeps a `created` reference — a 500 that names the task id means the task exists but could not be linked |
| `PATCH /messages/:id/tasks/:taskId { status?, taskStatusId?, priority?, taskPriorityId?, assigneeEmployeeIds? }` | change a task from its card: the task page's update (`TaskUpdateCommand`, `ORG_TASK_EDIT` and task view, the same activity log), for a task the message shows; every conversation showing it hears `chat_message.updated` |
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
```

## Not yet in this plugin (next slices)

Link previews and incoming webhooks (their own lanes).
