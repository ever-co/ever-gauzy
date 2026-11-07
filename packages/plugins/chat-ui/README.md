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
  the messages newest page first (older on scroll, newer every 5 s while the
  tab is visible), and the composer: Enter sends, Shift+Enter breaks the line,
  `@` suggests people (the body carries rename-safe `<@employeeId>` tokens).
  Showing the latest loaded message marks the conversation read up to it
  (never past what is shown); "mark unread from here" is explicit. The unsent
  text of each conversation and thread is kept while the page lives. A message offers reply in thread, reactions, pin,
  edit and delete (own messages, or managers), and shows its task cards.
- **A thread** (right, `?thread=<rootMessageId>`): the root, the replies
  (a page at a time, newer ones every 5 s), follow / unfollow, and a composer
  with "also send to the conversation"; showing the replies marks the thread read.
- **Unreads**: the conversations holding something unread, newest first, with
  "Mark all as read" and a one-minute Undo (the API's snapshot).
- **Threads**: the followed threads with their unread replies.
- **The header badge**: how many conversations and threads hold something
  unread, read every 60 s and at once after a write on the page.

Bodies render the API's Markdown subset through `marked` and Angular's HTML
sanitizer, images left out; mention tokens become chips. Names and pictures
come from the chat's own people route (`GET /api/chat/people`, open to every
chat user), read once per organization. The page and the badge follow the
signed-in user and the selected organization: a switch drops everything shown
and asks again.

## Not yet in this plugin

The live channel (the realtime plugin's subscriptions; the page polls until
then), attachments, link previews, emoji autocomplete, send-to-chat from a
task and create-task-from-message, categories management, channel settings,
presence and typing.

## Tests

`chat-ui.helpers.spec.ts` (mention tokens, previews, suggestions, titles,
sorting, grouping, merging, labels) and `chat-ui.plugin.spec.ts` (routes,
nav entry and badge following the availability).
