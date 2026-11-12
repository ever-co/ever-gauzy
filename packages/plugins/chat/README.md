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
per-tenant one). The link preview cache, `chat_link_preview` (migration
`1791000006710`), is described under
[Link previews](#link-previews-off-unless-gauzy_chat_link_previews_enabledtrue).
Incoming webhooks (`1791000006730`): `chat_webhook`,
`chat_webhook_interaction`, and `chat_message.webhookId` / `appIconUrl` /
`blocks` with a unique (`webhookId`, `nonce`);
`chat_webhook_interaction.idempotencyKey` (`1791000008300`) with a unique
(`tenantId`, `messageId`, `actorUserId`, `idempotencyKey`) where a key is set.
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
| `PATCH /messages/:id/tasks/:taskId { status?, taskStatusId?, priority?, taskPriorityId?, assigneeEmployeeIds? }` | change a task from its card: the task page's update (`TaskUpdateCommand`, `ORG_TASK_EDIT` and task view, the same activity log), by a member of the conversation, for a task the message shows; a status or priority of the task's organization (or a shared one), active employees as assignees; every conversation showing it hears `chat_message.updated` |
| `POST` / `DELETE /messages/:id/reactions/:emoji` | reactions |
| `GET /threads` · `POST /read-all` · `POST /read-restore { snapshotId }` | followed threads; mark all read with a one-minute undo |
| `GET /link-preview?url=` | the preview of a link (below); 404 unless `GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true` |
| `GET /link-preview/image?url=` | the picture of a link's ready preview, served by the platform; 404 unless `GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED=true` |
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

## Link previews (off unless `GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true`)

`GET /link-preview?url=` (`CHAT_VIEW`, rate-limited per user) answers the
preview of a link posted in chat, the chat spec FR-20. The server fetches it,
never the browser, and caches it per tenant in `chat_link_preview` (migration
`1791000006710`: `urlHash` = SHA-256 of the normalized link, unique with
`tenantId`; `url`, `status`, `data` as JSON text, `fetchedAt`). The answer is
`IChatLinkPreview` of `@gauzy/contracts`:

| `status` | Means | The client |
| --- | --- | --- |
| `ready` | `title`, `description`, `siteName`, `image`, `imageAlt`, `imageWidth`, `imageHeight`, `icon` as the page states them (each optional) | renders a card; every string is plain text, `image` and `icon` are `https:` URLs |
| `pending` | the server is fetching it | asks again in about two seconds, a few times |
| `unavailable` | no preview: not a public address, not fetched, not HTML, or nothing to show | shows the link only |

A value that is not an `http(s)` link (or carries credentials, or is longer than
2,048 characters) answers 400; with previews off the route answers 404.

**The egress guard** (`egress/egress-guard.ts`, exported for the plugin's other
outbound requests: `guardedRequest`, `resolveAllowedAddresses`, `pinnedLookup`,
`readLimitedBody`, `isPublicAddress`, `isRefusedHostname`): `http` and `https`
only, the ports 80, 443, 8080 and 8443, no credentials. A host named
`localhost`, a single label, or under an internal or special-use suffix
(`.local`, `.internal`, `.home.arpa`, `.svc`, `.test`, ...) is refused before it
is resolved. Every address a host resolves to must be public; one that is not
refuses the host. That covers loopback, the private ranges, link-local (with the
metadata service at `169.254.169.254`), carrier-grade NAT, multicast and the
documentation and benchmarking ranges. For IPv6 only global unicast passes, and
IPv4-mapped, NAT64 and 6to4 addresses are judged by the IPv4 address they carry.
The connection is made to exactly the addresses judged, so a second lookup (DNS
rebinding) never happens. Every redirect (at most 3) is judged again the same
way. One fetch takes at most 5 s, reads at most 512 KB (compressed and
decompressed both counted), stops at the end of `<head>` and reads only an HTML
answer. It sends no cookie, no credential, no referrer, only a generic user
agent. Only the `<head>` is parsed: Open Graph, then the Twitter card, then
`<title>`, the description and the icon link. Scripts, styles and comments are
dropped first. Strings are decoded and stripped of markup, control and
bidirectional characters, then cut to their limits. Image and icon URLs are kept
only when `https:` and not on an internal host. Nothing of the page but these
fields is stored.

**Refresh**: a `ready` preview is served for a day, and after that it is still
served while it is fetched again. An `unavailable` one is fetched again after an
hour, and a `pending` one after two minutes (a fetch that never reported back).
A refresh that meets a site that is slow, down or busy (a timeout, a connection
error, a 5xx or a 429) keeps the good preview and tries again after an hour. A
page that is gone (4xx), or a host that now resolves to a private address,
takes it away. **Budget**: one person starts at most 60 fetches a minute (asks
the cache cannot answer), whether or not the platform's rate limiter is on, and
is answered 429 beyond that. The cache's answers cost nothing.
**Where the fetch runs**: with a queue root (`REDIS_ENABLED=true`) it is a job
on the `chat-link-preview` queue, one per tenant and link at a time (the job
id), taken by `ChatLinkPreviewWorker` in the API processes, and the first ask
answers `pending`. Without one it runs in the process that was asked, at most 4
at a time, and the route waits for it.

**Pictures** (`GET /link-preview/image?url=`, chat T30; off unless
`GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED=true` as well): the picture a `ready`
preview of the tenant names, fetched through the same guard and served by the
platform, so a client shows it without the reader's browser loading it from the
linked site. The route takes the link, never the picture's address, so it fetches
nothing a preview did not name. Only PNG, JPEG, GIF, WebP or AVIF is served, by
the bytes (never SVG), at most 1 MiB, with `X-Content-Type-Options: nosniff`, a
`sandbox` CSP and `Cache-Control: no-store`. Pictures are kept in
memory per process (256 pictures, 32 MiB, a day each; a picture that could not
be fetched is not asked for again for ten minutes) and spend from the same
budget. 204 for a link with no ready preview, no picture, or one that could not
be fetched; 404 only while the pictures are off.

On, the API makes outbound requests to whatever sites the links posted in chat
point at, on someone's ask. Off, it makes none.

## Enabling

```env
GAUZY_CHAT_ENABLED=true
FEATURE_CHAT=true            # or switch the feature on per tenant in Settings → Features
GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true   # optional: link previews (outbound requests to the linked sites)
GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED=true   # optional, with the previews: their pictures, served by the platform
GAUZY_CHAT_WEBHOOKS_ENABLED=true   # optional: incoming webhooks
```

## Incoming webhooks (`GAUZY_CHAT_WEBHOOKS_ENABLED=true`)

Automation posts into a channel through a per-channel URL (`docs/specs/features/chat-incoming-webhooks/`). Off unless
the flag is exactly `true` (and chat is on): every route below answers 404.

- **Manage** (a manager of the channel, its creator or `CHAT_MANAGE`; writes need `CHAT_SEND`):
  `GET|POST /api/chat/conversations/:id/webhooks`, `PATCH|DELETE /api/chat/webhooks/:id` (`DELETE` revokes; the row
  stays), `POST /api/chat/webhooks/:id/secret` (a new signing secret). Channels only, at most ten active per channel.
  The create answer holds the URL and the signing secret, shown that once: the URL secret is stored as its SHA-256,
  the signing secret encrypted with a key from `ENCRYPTION_KEY` (or, when it is unset, derived from a `JWT_SECRET`
  that is not a published default). With neither, a webhook without an interaction URL is still created but its
  answer has no signing secret, and an interaction URL is refused (400) until a key is set; `POST …/secret` then
  makes one. Creating, changing and revoking are written to the activity log.
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
- **A click is one interaction**: a client sends an `Idempotency-Key` header with the click (a new UUID per click, the
  same on each retry of it; at most 64 printable characters, the receive route's rule; compared case-sensitively,
  `utf8mb4_bin` on MySQL). A repeat of the key by the same
  person on the same message — a double click, a retry after a lost answer, two requests racing (the unique index
  decides, on every dialect and with either ORM) — answers that click as it is now (`replayed: true`, the message when
  the reply replaced it, no events) and calls the app no second time; the same key for another button is refused
  (`409 IDEMPOTENCY_KEY_REUSED`), a key that cannot be stored too (`400`). The key is a header, as on the receive
  route and the platform's other retry-safe writes, so the body stays the click and a proxy forwards it verbatim; it is
  kept on the interaction row (not in the platform's `@Idempotent()` response store) so a repeat reads the click as it
  is now, not the first answer. Without a key every request is a click, as before.

## Not yet in this plugin (next slices)

The Ever Teams client (in progress); incoming webhooks: a later-reply URL, mentions inside blocks.
