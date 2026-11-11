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
  notification level, join / leave, archive for managers, pinned messages),
  the messages newest page first (older on scroll, newer live — see below),
  and the composer: Enter sends, Shift+Enter breaks the line, `@` suggests
  people (the body carries rename-safe `<@employeeId>` tokens), `:` and two
  letters suggest emoji (a complete `:name:` becomes its emoji as it is typed;
  the body stores the emoji itself).
  Showing the latest loaded message marks the conversation read up to it
  (never past what is shown); "mark unread from here" is explicit. The unsent
  text of each conversation and thread is kept while the page lives. A message offers reply in thread, reactions, pin,
  edit and delete (own messages, or managers), and shows its task cards, its
  files and a card for each web link (made from the link alone: nothing is
  fetched from the linked site).
- **Files**: the paperclip, a drop on the composer or a paste attaches files
  (for users with `DOCS_CREATE`). Each is stored at once through the Docs
  plugin (`POST /api/plugins/docs/documents/upload`) as the sender's private
  FILE document (`source: CHAT`, kept out of the knowledge base and of the AI
  classification) and goes out with the message as `attachmentIds`; a message
  of files alone carries their names as its text (the API needs a body).
  Messages show pictures inline and other files as links, read through the
  conversation's files (`GET /api/chat/conversations/:id/files`, members
  only), which the header's Files pane lists too.
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

Link previews with the page's title, text and picture (the API has no
`GET /chat/link-preview` yet: a preview must be fetched by the platform, never
by the reader's browser), send-to-chat from a task and create-task-from-message,
categories management, channel settings, presence and typing.

## Tests

`chat-ui.helpers.spec.ts` (mention tokens, previews, suggestions, titles,
sorting, grouping, merging, labels), `chat-ui.plugin.spec.ts` (routes,
nav entry and badge following the availability), `services/chat-live.spec.ts`
(the hints, when the channel is live or falls back, reconnects, retries, the
poll periods), `chat-emoji.spec.ts`, `chat-links.spec.ts`,
`chat-attachments.spec.ts`, `services/chat-files.store.spec.ts` and
`components/message-composer/message-composer.component.spec.ts` (emoji
suggestions and replacement, uploads and what a message with files sends).
