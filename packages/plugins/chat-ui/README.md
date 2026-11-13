<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-chat-ui",
      "## Switch",
      "## What it shows",
      "## Not yet in this plugin",
      "## Tests"
    ]
  }
}
-->

# @gauzy/plugin-chat-ui

The Angular side of the Gauzy **chat**
([`@gauzy/plugin-chat`](../chat/README.md)): one page for the conversations
of the organization, plus an unread badge in the header.

Spec: `docs/specs/features/chat/` (`spec.md`, `plan.md` §6).

## Switch

The UI has no switch of its own. It follows the API:

- The nav entry (before Tasks) and the header badge appear only after the API
  has answered `GET /api/chat/states` for the signed-in user. The API serves
  that route only where `@gauzy/plugin-chat` is loaded and `FEATURE_CHAT` is
  on for the tenant. Where it does not, the app looks exactly as before. A
  temporary failure (5xx, network) is retried with a growing delay; 404, 401
  and 403 are final.
- The route `/pages/chat` (permission `CHAT_VIEW`) is always registered.
  Opened on an installation without the chat, the page only says that the
  chat is off: it asks the API first and makes no other request.

## What it shows

- **The list** (left): Unreads and Threads, favourites, the channels by
  category, the direct and group messages, with unread and mention counts;
  New channel, New message and Browse channels open dialogs.
- **A conversation** (middle): its header (title, topic, members, favourite,
  notification level, join / leave, archive for managers, pinned messages,
  files, settings),
  the messages newest page first (older on scroll, newer live — see below),
  and the composer: Enter sends, Shift+Enter breaks the line, `@` suggests
  people (the body carries rename-safe `<@employeeId>` tokens), `:` and two
  letters suggest emoji (a complete `:name:` becomes its emoji as it is typed;
  the body stores the emoji itself).
  Showing the latest loaded message marks the conversation read up to it
  (never past what is shown); "mark unread from here" is explicit. The unsent
  text of each conversation and thread is kept while the page lives. A message offers reply in thread, reactions, pin,
  edit and delete (own messages, or managers) and "Create task from message"
  (users with `ORG_TASK_ADD`), and shows its task cards (key, title and status
  where the reader may see the task, read through `GET /api/tasks?where[id]=…`,
  which records no visit, unlike `GET /api/tasks/:id`). A reader with
  `ORG_TASK_EDIT` (or `ALL_ORG_EDIT`) who may write in the conversation changes
  a card's status (the statuses of the task's project), priority and assignees
  in place (`PATCH /api/chat/messages/:id/tasks/:taskId`: the task page's
  update and activity log); the platform's refusal shows on the card, and the
  cards of every conversation showing the task read it again when its message
  is told it changed. The message also shows its
  files and a card for each web link: the site and the path, and, once the
  platform has a preview of the page (`GET /api/chat/link-preview`, which the
  platform fetches; on only with `GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true`), the
  page's site name, title and description as text, and its picture when the
  platform serves it (`GET /api/chat/link-preview/image`, on only with
  `GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED=true`; shown from a `blob:` URL of
  the platform's answer). Nothing is loaded from the linked site by the
  reader's browser: not the page, not its picture, not its icon. A pending preview, or one a failure that may pass held up (no
  connection, 429, 5xx), is asked again after 2, 4 and 6 seconds, and a 404
  (previews off) stops the asks for the session.
- **Files**: the paperclip, a drop on the composer or a paste attaches files
  (for users with `DOCS_CREATE`). Each is stored at once through the Docs
  plugin (`POST /api/plugins/docs/documents/upload`) as the sender's private
  FILE document (`source: CHAT`, kept out of the knowledge base and of the AI
  classification) and goes out with the message as `attachmentIds`; a message
  of files alone goes with no text (the platform records the files' names, and
  the thread list reads `📎 names`), and an edit of a message that keeps its
  files may empty its text. A stored file taken off the composer, or left in it
  when the person moves to another place, is discarded
  (`DELETE /api/chat/attachments/:documentId`, best effort; the platform's 24 h
  sweep takes the rest, and a file a send took is never discarded). A picture
  whose size the platform read at the upload reserves its box (fitted into
  320 × 240) before it loads. Messages show pictures inline and other files
  as links, read through the
  conversation's files (`GET /api/chat/conversations/:id/files`, members
  only), which the header's Files pane lists too.
- **Create task from message**: title (the message's first line to start
  with), project (optional, the organization's projects) and assignees
  (optional; the platform assigns the creator too). The task's description is
  the message (`POST /api/chat/messages/:id/create-task`), and the message
  shows the task's card.
- **Send to chat** on a task's page (`/pages/tasks/view/:id`, users with
  `CHAT_SEND` where the chat is served): a button in the page's actions (the
  `task-view-actions` extension slot, `PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS`)
  opens a picker of my conversations (favourites first, then the latest) with
  an optional note, and posts the task's card there in my name (`taskId` on the
  send; without a note the text is the task's key and title).
- **Conversation settings** (the gear, or the member count): for a channel its
  name, topic, public or private and sidebar category; for a direct or group
  conversation its topic; and the members, which a manager (`CHAT_MANAGE`, the
  conversation's manager, or its creator) adds and removes (not in a direct
  conversation or the default channel). Every member sees them.
- **Channel categories** (`CHAT_MANAGE`, under Browse channels): add, rename,
  move up or down (one call saves the whole order in one transaction,
  `POST /api/chat/categories/reorder`), delete (the channels stay,
  uncategorized).
- **Typing**: while the person types (at most every 3 s, never in edit mode)
  the conversation's other members are told (`POST
  /api/chat/conversations/:id/typing`, with the thread when it is one); a place
  that refuses is not asked again, a platform without the route not at all. "Anna
  is typing…" shows under the conversation and under a thread from the live
  channel's `typing.signalled` (asked on the same subscription where the
  platform offers it), each typist for the few seconds the signal asks, ended
  by their message; a polite live region, its dots still under reduced motion.
- **A thread** (right, `?thread=<rootMessageId>`): the root, the replies
  (a page at a time, newer ones live), follow / unfollow, and a composer
  with "also send to the conversation"; showing the replies marks the thread read.
- **Unreads**: the conversations holding something unread, newest first, with
  "Mark all as read" and a one-minute Undo (the API's snapshot).
- **Threads**: the followed threads with their unread replies.
- **The header badge**: how many conversations and threads hold something
  unread, read at once after a write on the page and when a chat event moves a
  count, and every 60 s.

**Live.** Where the API runs the realtime plugin (`GAUZY_REALTIME_ENABLED=true`)
and `GET /api/realtime/status` offers the chat events, the tab opens one
subscription, `collaborationEvents(names: ["chat_message.*",
"chat_conversation.*", "chat_member.*", "chat_thread.*"])`, over the shared
socket (`RealtimeSocketService` of `@gauzy/ui-core/core`). The events are
hints: a message created fetches the newer messages, a message changed or
deleted (an edit, a reaction, a pin, a thread reply) is read again, and the
lists and the badge read the states again. Polling stays the fallback: as
before (messages and replies every 5 s, lists every 30 s, badge every 60 s)
until the subscription has run on a connected socket with prompt delivery
(`delivery.prompt` of the status), while the socket reconnects, after the
subscription failed (`RealtimeSocketUnavailableError`, a GraphQL error; it is
opened again after a growing wait), and wherever there is no realtime channel;
once a minute as a safety net while live. Events of a gap are not replayed, so
a reconnect, and showing the tab again, reads the open conversation, the open
thread and the lists again.

Bodies render the API's Markdown subset through `marked` and Angular's HTML
sanitizer, images left out; mention tokens become chips. Names and pictures
come from the chat's own people route (`GET /api/chat/people`, open to every
chat user), read once per organization. The page and the badge follow the
signed-in user and the selected organization: a switch drops everything shown
and asks again.

## Not yet in this plugin

The icon of a link preview (the platform serves pictures only), search
(`GET /chat/search` exists), presence.

## Tests

`chat-ui.helpers.spec.ts` (mention tokens, previews, suggestions, titles,
sorting, grouping, merging, labels), `chat-ui.plugin.spec.ts` (routes,
nav entry and badge following the availability), `services/chat-live.spec.ts`
(the hints, when the channel is live or falls back, reconnects, retries, the
poll periods), `chat-emoji.spec.ts`, `chat-links.spec.ts`,
`chat-link-previews.service.spec.ts`, `link-cards.component.spec.ts`,
`chat-attachments.spec.ts`, `services/chat-files.store.spec.ts` and
`components/message-composer/message-composer.component.spec.ts` (emoji
suggestions and replacement, uploads and what a message with files sends),
`chat-catch-up.spec.ts`, `chat-tasks.spec.ts`, `chat-categories.spec.ts`,
`chat-ui.extensions.spec.ts` (the task-page extension) and
`dialogs/chat-settings-dialogs.component.spec.ts` (what the settings save,
members, categories).
