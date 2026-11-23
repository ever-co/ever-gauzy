# Feature Specification: Chat messaging

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `chat-messaging`
**Branch**: `feat/chat-messaging`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: the existing chat flags, `GAUZY_CHAT_ENABLED` (deployment, exactly `true`) and the tenant feature `FEATURE_CHAT` (both default off). The AI-assisted parts (§3.12) also need `GAUZY_CHAT_AI_ENABLED` (exactly `true`, default off), an AI provider configured for the tenant and the organization's chat AI setting.

---

## 1. Overview

The platform already has team chat ([`chat`](../chat/spec.md)): public and private channels in categories, direct and group messages, one-level threads with follow and "also send to the conversation", rename-safe mentions, reactions, pins, files stored through the Documents hub, server-side link previews behind the egress guard, task cards editable in the message, "send task to chat", "create task from message", unread and mention counters with one call for every badge and a one-minute undo of "mark all read", typing and presence over the [real-time channel](../realtime-channel/spec.md), notifications filed in the [Inbox](../inbox/spec.md), and read tools for AI clients ([`mcp-collaboration-tools`](../mcp-collaboration-tools/spec.md)). This feature **extends the existing chat** for the Angular app, Ever Teams (same API; its screens in the Ever Teams spec `workspace-collaboration-clients`), the MCP server and the SDKs with: an "everyone" and an announcement channel type, unique channel names, channel deletion and manager succession, structured system events, personal sidebar sections and filters, quoting, forwarding, edit history, synced drafts, an outbox for unsent messages, polls, saved messages, read receipts, reminders, scheduled messages, a people directory, custom statuses, voice clips, a search screen with filters, an activity view with bundled reaction notices, notification levels with "mute until", email and push through the platform's delivery channels, and the Angular screens still missing (search, preview icons, presence everywhere). Nothing existing is removed or changes meaning.

**Advanced capabilities.** A person returning to a busy channel gets a **summary** whose every line links to the messages it came from; from any record they can ask **what they missed about it** across all their conversations; messages are **translated inline** with the original kept one tap away; the Unreads view can rank by **relevance to their work** (assigned tasks, projects they tracked time on, records they follow, their manager and reports) with the reason shown; presence can say **"tracking time on Project X"** or **"in a meeting until 14:30"** from the timer and the calendar; writing to someone outside their working hours offers **delivery at their next start of day**; voice clips get **searchable transcripts**. All AI parts read only what the person may read at that moment and send nothing to a provider unless switched on.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee who belongs to two organizations, **when** they open the organization switcher, **then** each organization shows its unread and mention counts, and switching opens the conversation they last had open there, in the browser and in Ever Teams alike.
- **Given** a manager who creates the channel "Release" with five people, **when** it is saved, **then** they are its manager, the channel shows "Anna created this channel" and "Anna added Ben, Chen and 3 others" as system lines in each reader's language, and nobody gets a notification for those lines.
- **Given** an organization that requires unique channel names and an employee who tries to create "release" while "Release" exists, **when** they save, **then** the system refuses with "a channel with this name exists" and offers to open it.
- **Given** the channel "Announcements" set to announcement-only, **when** an employee who is not a manager opens it, **then** they can read, react and reply in threads, and the composer says posting is limited to managers.
- **Given** a message, **when** an employee chooses Reply, **then** their message carries a quote of the original (author, time, first lines); when the original is later edited or deleted the quote still reads as it was sent and says "edited" or "deleted".
- **Given** a message with two files, **when** an employee forwards it to a channel and a person with a comment, **then** both receive a copy with the files and a "forwarded from #design" line, which only readers of #design can follow.
- **Given** an author who corrects a message twice, **when** a reader opens "edited", **then** the earlier versions are listed with their times.
- **Given** a half-written reply in the browser, **when** the employee opens the same conversation on their phone, **then** the draft is there; sending it on the phone clears it in the browser.
- **Given** a train with no connection, **when** an employee sends three messages, **then** they show as "sending", go out in order once the connection returns, and none is sent twice.
- **Given** an employee who creates a poll "Offsite date?" with three options, multiple choice, anonymous, closing Friday 17:00, **when** colleagues vote, **then** counts update live, nobody (managers included) can see who voted, and on Friday at 17:00 the poll closes and shows final results.
- **Given** a long technical answer, **when** an employee saves it and sets a reminder "tomorrow at the start of my day" with a note, **then** the next morning they get an Inbox entry and a push with the note, and the item sits under Saved.
- **Given** a message written at 18:00 for the whole team, **when** the author schedules it for "next working day 09:00", **then** it is skipped over Saturday, Sunday and the official holiday on Monday, and is sent on Tuesday at 09:00 in the author's name.
- **Given** an employee who searches "invoice template from:Ben has:file", **when** results come back, **then** only messages of their conversations from Ben with files are listed with highlighted snippets, and choosing one opens it in its conversation at its place.
- **Given** a direct message in a group of 12, **when** the author opens "read by", **then** they see which members have read it so far and which have not, except members who hide their read position.
- **Given** an employee with a custom status "At the dentist" clearing after 1 hour and "do not disturb" on, **when** a colleague mentions them, **then** the colleague sees the status, and the employee gets no push until the status ends; the mention waits in Activity.
- **Given** an employee back from leave with 340 unread messages in #platform, **when** they choose "What changed since my last visit", **then** they get topics, decisions, questions addressed to them and action items, each with links to the source messages, built only from messages they may read. `(advanced)`
- **Given** a deal page, **when** the owner chooses "What did I miss in chat?", **then** they get a summary of the messages that mention the deal in any of their conversations since their last visit, with links. `(advanced)`
- **Given** a message in Portuguese, **when** a reader whose language is English chooses Translate, **then** the English text shows under the original, which stays visible. `(advanced)`
- **Given** an employee writing at 23:10 to a colleague whose working day starts at 08:30 in another time zone, **when** they press send, **then** the composer offers "deliver at 08:30 their time" and shows when that is for the author. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a person removed from a channel, **when** their reminder on a message of it is due or their scheduled message for it comes up, **then** the reminder is skipped silently and the scheduled message fails with "no longer a member", which the author sees with a retry option.
- **Given** two people voting in the same second on a single-choice poll from two devices, **when** both requests arrive, **then** each person holds exactly one ballot, the last change wins, and the tally counts each once.
- **Given** a poll closed by its author, **when** a late vote arrives, **then** it is refused with "the poll is closed" and the client shows the final result.
- **Given** two edits of one message from two tabs, **when** both are saved, **then** the later one wins and the earlier one is kept in the history; no edit is lost silently.
- **Given** a forward to a conversation the sender cannot post in (archived, announcement-only, not a member), **when** sent with others, **then** the others succeed and that one is reported failed with its reason.
- **Given** a scheduled message whose conversation was archived, **when** its time comes, **then** it is not sent, is marked failed with the reason, and the author is told once.
- **Given** a search for a message posted one second ago, **when** the index has not caught up, **then** the result appears within five seconds; the conversation's own history shows it at once.
- **Given** an anonymous poll, **when** anyone asks for "read by" on it or its voters through the API, **then** the answer is refused.
- **Given** an organization that makes conversations with deactivated people read-only (FR-119) and a direct conversation whose other member was deactivated, **when** someone tries to send through the API, **then** it is refused with `CHAT_RECIPIENT_INACTIVE`, and every client shows the conversation read-only.
- **Given** a deleted channel within its 30-day restore window, **when** a member opens a permalink to one of its messages, **then** they get "not found"; when a manager restores it, the link works again.
- **Given** an AI provider that is down or over its limit, **when** someone asks for a summary or a translation, **then** they get "not available right now", no partial text is shown as final, and chat keeps working.
- **Given** a message with a spoiler, **when** its push, email, teaser or search snippet is produced, **then** the spoiler text is replaced by "spoiler".

## 3. Functional Requirements

### 3.1 Scope and what stays

- **FR-1** The system keeps every behaviour, route, field, permission, event and GraphQL read of the existing chat ([`chat`](../chat/spec.md) FR-1–FR-25), of incoming webhooks and of the real-time channel unchanged; this spec only adds.
- **FR-2** The system serves every route this spec adds only where the chat plugin is loaded and `FEATURE_CHAT` is on for the tenant, and answers `404` otherwise, as the existing routes do.
- **FR-3** The system offers the AI-assisted behaviour of §3.12 only with `GAUZY_CHAT_AI_ENABLED` exactly `true`, an AI provider configured for the tenant and the organization's chat AI setting on; without them the controls are absent and no message text leaves the platform.
- **FR-4** The system closes the Angular gaps of the existing chat: message search, the icon of link previews and presence in every list and card, and offers each capability of this spec in the Angular chat; Ever Teams consumes the same routes.

### 3.2 Organizations, navigation and the conversation list

- **FR-5** The system treats each organization as the chat workspace (its channels, people and direct conversations) and shows, in the organization switcher, unread and mention counts per organization the person belongs to, answered in one call.
- **FR-6** The system remembers per person and organization the last open conversation or thread and opens it on return in every client.
- **FR-7** The Angular chat offers a navigation rail with Home, Direct messages, Activity, Threads, Saved, Scheduled, People and Search, each with its count; at phone width the rail becomes a bottom bar and the panes open as full screens.
- **FR-8** The conversation list separates favourites, the person's own sections, channels by category, and direct and group conversations, with an icon per kind and visibility (public, private, everyone, announcement, with guests) and markers for drafts, mentions and muted conversations.
- **FR-9** A person can create their own sidebar sections (names unique per person, case-insensitive), place conversations in them (one section per conversation and person), order sections, and sort each by name or recent activity; the organization's categories stay the default grouping for everything not placed. A person's own sections list above the organization's categories, and a conversation they placed in one of theirs shows only there for them.
- **FR-10** A person can sort the list by name, recent activity or unread first, hide conversations without activity for 30 days and show only unread; these filters never hide favourites, their own sections or a conversation holding a mention, and the setting says so.
- **FR-11** The system registers chat commands in the platform's command palette: go to a conversation or person, start a direct message, create a channel, set status, search messages, open Activity, Threads or Saved, each shown only when the person may use it.
- **FR-12** The chat header search box shows conversations, people and the five best messages as the person types and opens the search page with the query.

### 3.3 Channels and membership

- **FR-13** A channel can have the visibility "everyone": every active employee of the organization is a member, new employees become members when hired, and nobody can leave or be removed; the existing default channel is an everyone channel.
- **FR-14** A channel manager can make a channel announcement-only: every member reads, reacts and replies in threads (unless the manager switches thread replies off), and only managers and the people the manager lists post at the top level.
- **FR-15** An organization can require unique channel names (setting, default off: names may repeat, as today); when it does, the system trims channel names, compares them case-insensitively and keeps them unique among the open channels of the organization, a clash is refused with `CHAT_CHANNEL_NAME_TAKEN` and the existing channel's id when the caller may see it, and channels that already share a name keep it.
- **FR-16** Creating a channel accepts its first members in the same request; the creator becomes its manager; the system writes one "created" system event and one combined "added" event naming up to three people and the number of others.
- **FR-17** The system lets an organization limit who may create public and private channels (setting of `chat-administration-and-clients`) and shows the create action in every client only to people the server would allow.
- **FR-18** The system applies these membership rules: any member of a public channel may add employees of the organization; in a private channel managers add, or every member when the channel allows it; anyone joins a public channel by themselves, never a private one; managers remove others; anyone removes themselves except from everyone channels; members are never added to or removed from a direct conversation.
- **FR-19** A channel can have several managers; a manager can promote and demote members; a user with `CHAT_MANAGE` can do the same without being a member, which is recorded. An organization can switch on manager succession (setting, default off: a channel left without a manager stays so and is managed by holders of `CHAT_MANAGE`, as today); then, when the last manager leaves, is removed or is deactivated, the longest-standing member becomes manager and a system event names them.
- **FR-20** An archived channel stays in the person's list marked archived, as today, and a person can hide archived conversations with the list filters of FR-10; Browse shows archived channels only when the person asks to include them; an archived channel reads as before, refuses posts, reactions and votes (as today it refuses writes), now with the code `CHAT_CONVERSATION_ARCHIVED`, and comes back unchanged when unarchived; a private channel whose last member leaves is archived automatically.
- **FR-21** A channel manager or a user with `CHAT_MANAGE` can delete a channel (never an everyone channel) after typing its name: it disappears for everyone at once, a user with `CHAT_MANAGE` can restore it for 30 days, and then the system purges it with its messages, threads, reactions, pins, polls, reminders, scheduled messages and file links (the files follow `drive` trash rules); a legal hold (the platform's holds of `access-control-and-security`, placed from the chat administration pages of `chat-administration-and-clients`) blocks the purge.
- **FR-22** The channel panel shows name, topic, a description up to 2,000 characters in the message format, visibility, creator, creation date, member count and linked record, editable by managers, and tabs Members, Files, Links, Pins and Threads (threads started in the channel, each opening the thread).
- **FR-23** Joining and leaving work from the list, Browse, a link, the composer gate and the channel panel with the same confirmation everywhere, and write "joined" and "left" system events (not for everyone channels).
- **FR-24** A channel can be linked to one business record (type and id) by a manager or by a feature; its header shows the record's card and the record page lists its linked channels; a team or department can opt in to "keep a channel", which creates it and keeps its membership in step with the team or department (memberships marked synced), so channels follow teams only where an organization asks for it.
- **FR-25** Every person has a notes conversation with only themselves, listed first among direct messages, never notified and never counted as unread.
- **FR-26** Conversation lists update live in every client on create, change, archive, delete, restore, join, leave and manager change.
- **FR-27** The system offers a People page and a profile card on every name: picture, name, job title, department, teams, local time, presence, status, time off, the contact details the viewer may see, shared conversations and files, and a "message" action.
- **FR-28** The member list shows managers, guests and presence; a person allowed to add members picks several at once and can add all members of a team or department in one step; every client offers add and remove only to people the server would allow.

### 3.4 Messages and composer

- **FR-29** The message body stays the documented Markdown subset of the existing chat, at most 4,000 characters, extended with strikethrough, spoilers, numbered lists, code blocks with a language for highlighting, and tables up to 20 columns and 100 rows; text the subset does not know renders as text.
- **FR-30** The composer offers a formatting toolbar and a shortcut for each element, links typed and pasted web addresses, shows what will be sent exactly as readers see it, and keeps Enter to send and Shift+Enter for a new line, which a person can swap.
- **FR-31** The system writes structured system events for created, renamed, visibility changed, archived, unarchived, joined, left, added, removed, manager changed, pinned and poll closed, each with its actors so clients render it in the reader's language; system events never notify, never count as unread and never move a conversation's last activity.
- **FR-32** The system keeps `@employee`, `@channel`, `@here` and `#channel` mentions and adds `@team`, which notifies the members of an organization team who are members of the conversation; a channel can limit `@channel` and `@here` to its managers.
- **FR-33** Before sending, the composer warns without blocking when a mentioned person is not a member (offering "add them" to people allowed to add, or "mention only"), is on approved time off today, or is outside their working hours.
- **FR-34** A person mentioned in a thread reply, or who replies, follows that thread.
- **FR-35** The emoji picker offers search, categories, skin tones, the person's recently used emoji (kept on the server) and the organization's custom emoji, which also work inline through `:name:`; plain-text copies of a message carry custom emoji as `:name:`.
- **FR-36** An animated image sent as a file plays in the stream; a deployment can register a GIF search source through `integration-hub`, fetched through the platform's egress guard; with none, no picker is shown; a message holding only media reads "sent a picture", "sent a file" or "sent a GIF" in lists, notifications and search.
- **FR-37** A person can send up to 20 files with one caption in one action, all or nothing; the files show as one group above the caption, and a retry of the send with the same key answers the same message.
- **FR-38** The Angular composer shows a sent message at once as "sending", reconciles it with the server's answer, offers retry or discard on failure, keeps unsent messages across a reload and sends them in order on reconnect with their original key; a send waits for its files still uploading.
- **FR-39** The system keeps each earlier body of an edited message with its time and shows "edited" with the history to members; an organization can set an edit window (default none) and hide the history (default shown); clearing all text of a message without files asks to delete it instead.
- **FR-40** An author can delete their own messages one by one or as a selection of up to 50; a channel manager can delete app and agent messages in their channel; a user with `CHAT_MANAGE` can delete any message, as today; whether deleted bodies are kept follows the retention and legal holds of `chat-administration-and-clients`.
- **FR-41** A person can reply to a specific message of the same conversation; the reply shows a quote taken when it was sent (author, time, first 200 characters, file names) which stays readable when the original is edited or deleted, jumps to the original when it still exists, and notifies the quoted author under their preferences.
- **FR-42** A person can forward a message with its files and cards to up to 10 conversations they may post in, with an optional comment; each copy says "forwarded" and, to readers who may read the source, where from and by whom; a forwarded reply carries its quote inline; files are linked to the new message so its readers can open them; each target succeeds or fails on its own.
- **FR-43** Every message has a permalink that opens it highlighted in its conversation or thread for members and answers "not found" to anyone else; a person can copy a message's text or its link.
- **FR-44** The hover toolbar, the context menu and a long press offer reply, reply in thread, forward, react, copy text, copy link, pin, save, remind, mark unread, edit, delete, create task and the record actions of `chat-agents-and-record-actions` (with `FEATURE_CHAT_RECORD_CARDS` on), each only when the person may use it.
- **FR-45** The message list shows day separators, a "new" line at the person's read position, consecutive messages of one author within 5 minutes grouped, file groups kept together, and times in the person's 12- or 24-hour choice.
- **FR-46** A person can jump to a permalink, a search hit, a pin, a date or the latest message; the window loaded around the target never splits a message's file group.
- **FR-47** The system keeps a person's unsent text per conversation and thread on the server (the newest 50, for 30 days), shows it in every client and device with a draft marker, and removes it when sent or cleared; a client that keeps drafts on the device today keeps doing so, so no draft it holds is lost through the server's limits.
- **FR-48** The typing signal keeps working in conversations and threads in every client.
- **FR-49** A person can send a message silently (no push or email to anyone; unread counts still move) and choose whether, outside the recipients' working hours, the composer suggests a silent send, sends silently by default or does nothing (default: suggests).
- **FR-50** The system shows a time-off badge on people with approved time off today in lists, mentions, profiles and direct messages, updated live, unless the organization turns it off.
- **FR-51** Link previews keep their server-side fetch; the Angular chat also shows the site icon served by the platform; each person chooses card, compact line or no preview; the author can remove a preview from their message; links on the organization's block list (`chat-administration-and-clients`) never get a preview and never cause a fetch.
- **FR-52** Links to the platform's own records, pages and meeting rooms show the record or call cards of `chat-agents-and-record-actions` and `chat-administration-and-clients` instead of a fetched preview; cards of records other than tasks need `FEATURE_CHAT_RECORD_CARDS`, and without it such a link shows as today.
- **FR-53** The stream shows pictures inline in reserved boxes and as a gallery from two pictures, a lightbox with zoom, keyboard navigation and download, inline players for video and audio files, and a card with type, size and preview for other files.
- **FR-54** In place of the composer the system shows why a person cannot post (archived, announcement-only, not a member with a join action for public channels, direct conversation with a deactivated person where the organization made those read-only (FR-119), guest limits), and the server refuses the same cases with a reason code.
- **FR-55** The send button carries a schedule menu; Enter, the button and a held send take the same path.
- **FR-56** At phone width the Angular composer offers a compact row: attach, camera, mention, emoji, poll, record, voice clip and schedule.
- **FR-57** A person can drop files anywhere on a conversation or thread pane and paste them from the clipboard.
- **FR-58** The system hides spoiler text in pushes, emails, list teasers and search snippets, and highlights matched words inside text, mentions, links and code alike.
- **FR-59** Each message shows its reactions with counts, the names on hover, and a dialog listing who reacted with what.
- **FR-60** The browser tab title and the installed app's badge show the person's unread count.
- **FR-61** A person can set chat appearance kept on the server: density (comfortable or compact), time format, link preview style, pictures shown or collapsed, and the number of pictures before a gallery.
- **FR-62** The chat offers keyboard shortcuts for search, jump to conversation, next unread, mark read, edit the last own message, react, reply in thread and close a pane, listed in a shortcut panel opened by `?`.
- **FR-63** The Angular chat shows when the connection is lost, keeps the composer usable (FR-38), shows how old the shown data is while live delivery falls back to polling, and reads what changed on reconnect.

### 3.5 Threads

- **FR-64** Threads keep the existing behaviour (one level, follow, "also send to the conversation", thread read state) in every client.
- **FR-65** The root author, every person who replies or is mentioned in a thread, and both members of a direct conversation follow its threads automatically; anyone can unfollow.
- **FR-66** A person who may read a public channel but is not a member can open its threads from a link or a search hit and join the channel from the thread's composer gate.
- **FR-67** The Threads page has two tabs, threads I follow (with unread replies) and all threads of my conversations, filterable by conversation and by the root's text, with "unread only" on the first tab, filtered on the server and paged without gaps.
- **FR-68** The root shows reply count, last reply time and the faces of the last repliers, updated live; the unread thread badge counts followed threads with replies from others, a file group counting once and system events never.
- **FR-69** A thread opens beside the conversation on wide screens and as a full screen at phone width, from Threads, Activity, a push, a search hit or a link.
- **FR-70** Notifications of thread replies name the thread by the first words of its root and the conversation, and open the thread.

### 3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages

- **FR-71** Reactions keep working and accept the organization's custom emoji; each person's quick reactions are their eight most used emoji over 90 days unless they pick their own.
- **FR-72** The author of a message sees reactions to it in Activity as one entry per message listing who reacted with what, not pushed unless they choose it; when the last reaction is removed the entry goes.
- **FR-73** Chat uses the organization's custom emoji of the platform's custom emoji module; a user with `CHAT_MANAGE` can add one (square picture up to 256 KB, name unique in the organization, search words) and archive any, and a person can archive the ones they added; archived emoji still render in old messages.
- **FR-74** A member who may post can post a poll: a question, 2 to 20 options, single choice or multiple with a maximum, named or anonymous votes, results shown live or after closing, and an optional closing time; polls use the platform's poll module with chat messages as their host.
- **FR-75** The system lets only members vote, keeps one ballot per person that they can change while the poll is open, never shows who voted on an anonymous poll to anyone (administrators included) except each voter their own ballot, refuses votes on a closed poll, lets the author or a channel manager close it early, and closes it within a minute of its closing time.
- **FR-76** The poll shows counts, percentages and the number of voters, voters per option when named, and offers its author a CSV export of the results.
- **FR-77** Pins keep working; the conversation header shows the latest pin; an organization can cap the pins of a conversation (setting, default no cap, as today); pinning writes a system event; a channel can limit pinning to managers (default: every member, as today).
- **FR-78** A person can save a message (a platform favourite on the message), see saved messages newest first with text search and a conversation filter, and remove them; a saved message they can no longer read is hidden.
- **FR-79** In direct and group conversations and channels up to 50 members (setting), a member can see who has read a message and who has not, from the members' read positions; a person can hide their read position, and then cannot see others'; read receipts are never offered on anonymous polls.
- **FR-80** Marking unread from a message and the read position across devices keep the existing behaviour in every client.
- **FR-81** A person can set a reminder on a message they can read, at a preset (in 20 minutes, 1 hour, 3 hours, tomorrow at the start of my day, next week) or a chosen time in the future, with a note of up to 200 characters, and edit, snooze or delete it before or after it fires; a reminder on a message is one of the platform's reminders on records, listed with the person's other reminders, and is offered where those reminders are on.
- **FR-82** A due reminder becomes an unread Inbox entry and a push (under preferences) with the note or a snippet; the system checks access to the message when it fires and skips it silently when lost; a reminder fires late rather than never, and exactly once.
- **FR-83** A member who may post can schedule a message (text, files, mentions, cards) to a conversation or thread at a future time, with presets including the next working day of the author's working schedule, official holidays and time off; list, edit, reschedule, send now or delete it; it is sent in the author's name.
- **FR-84** At send time the system checks the author's membership and the conversation's state; a scheduled message that cannot go is marked failed with the reason, the author is told once and can reschedule it; a scheduled message is sent exactly once.
- **FR-85** A conversation with scheduled messages of the person shows a banner with their count, and the Scheduled page lists all of them with their state.
- **FR-86** The Saved page combines saved messages and reminders on messages (due, upcoming) with counts; its badge counts fired reminders whose notification is still unread.
- **FR-87** The system purges sent scheduled messages 30 days after they were sent (fired reminders follow the retention of the platform's reminders), and deletes a person's pending reminders on messages, scheduled messages and drafts when they lose access to chat.

### 3.7 Files and media

- **FR-88** Files in chat stay Documents hub files (source chat); where `drive` is on, they gain its resumable upload up to the drive limit and its type, size and quota checks before any byte is stored, with progress shown.
- **FR-89** The system corrects picture orientation at upload, strips picture metadata when the organization asks for it, makes a thumbnail and a placeholder colour, and reserves each picture's box from its known size.
- **FR-90** A person can record a voice clip of up to 5 minutes in the composer, listen to it before sending, and send it as an audio file with its length and a waveform.
- **FR-91** A person can open a file in the platform's preview (pictures, video, audio, PDF, text and code, office formats as the Documents hub shows them) from the stream and the Files tab.
- **FR-92** The Files tab lists a conversation's files newest first with a type filter (pictures, documents, media, other), name search and paging, and shows a just-sent file at once.
- **FR-93** A person can attach a message's file to a record they may change (through the record's files panel of `drive`) and save it to a folder of their own; the message keeps its file.
- **FR-94** A person can share a file they can read from the drive into a conversation; members who cannot read the file see its name and can ask for access; a sharer with manage level can grant the conversation's members view on it after a confirmation.
- **FR-95** A person can download one file, or several selected files or a message's file group as one zip built through `drive`, each file checked against their access.

### 3.8 Search

- **FR-96** The Angular chat offers a search page with tabs Messages, Files, Links and Polls over the existing search route, each hit showing conversation, author, time and a highlighted snippet.
- **FR-97** A person can filter by author, conversation, conversation kind, mentions of me, has file, has link, has poll, has record card, pinned, saved, in a thread and date range, combine filters, see them as removable chips and clear them all.
- **FR-98** The system makes a new or edited message searchable within 5 seconds and removes a deleted one within 5 seconds.
- **FR-99** The system records every link of a message when it is sent and finds links by address, site and preview title, grouped by site, including links that never got a preview.
- **FR-100** Choosing a hit opens the message in its conversation or thread at its place, highlighted, with the messages around it.
- **FR-101** Chat messages are part of the platform's global search with the same membership filter, and every hit is re-checked against the reader's membership.
- **FR-102** People and conversation pickers rank matches by start of name, then start of a word, then any part, recent contacts first.
- **FR-103** The Activity view filtered to mentions lists every message that mentions the person, their teams, `@channel` or `@here` in their conversations, newest first.

### 3.9 Activity, unread and notifications

- **FR-104** The Activity view lists mentions, replies to the person's messages, quotes of them, bundled reactions, followed-thread replies and fired reminders, with an unread filter and mark all read; opening an entry marks it read; every entry except bundled reactions is one of the person's platform notifications, so it is read or unread alike in Activity, the notification list and the Inbox (where the Inbox is on).
- **FR-105** Unread and mention counts keep the existing counters and single call, and add totals per organization for the switcher; muted conversations and system events never count; a file group counts once.
- **FR-106** Every client sets the existing notification level (all, mentions, muted) from the conversation header and the list, and a person can mute until a time (1 hour, 8 hours, tomorrow, a week, a chosen date) after which the earlier level returns.
- **FR-107** The system delivers chat notifications through the Inbox delivery channels and the person's notification preferences (the platform's notification settings, which `automation-and-notifications` widens): in-app, web push, mobile push of `email-and-communications`, and email as each person's preferences say today (at once, in a digest or off); a person can instead choose email for direct messages and mentions only while still unread after a delay (30 minutes unless they set another), and then nothing is emailed for a message already read.
- **FR-108** A push names the author and the conversation (or "in thread …"), carries a snippet without spoilers or a label for files, polls and cards, uses distinct titles for replies, mentions and other messages with that priority, is never sent to its author, and replaces the earlier push of the same conversation on the device.
- **FR-109** The system sends no push while the person is active in a client (as today), no push or email during the do-not-disturb hours of their notification preferences (as today) or while their status is do not disturb (and, for a person who chose the unread wait of FR-107, no email while they are active), except a message its sender marks urgent when the person allows urgent messages from that sender.
- **FR-110** A person can turn notification sounds on or off and choose one; the sound plays for direct messages and mentions while a chat tab is open but not focused.
- **FR-111** Opening a push, an email link or an Activity entry opens the conversation, thread or message it concerns.
- **FR-112** The system clears read bundled reaction entries of Activity after 90 days; every other Activity entry is one of the person's platform notifications and is kept as the platform keeps notifications today.

### 3.10 Presence and status

- **FR-113** Presence keeps the existing states merged across devices and shows in every list, card, member list and direct message of every client.
- **FR-114** A person can set availability (automatic, away, do not disturb, appear offline) and a custom status with an emoji and up to 100 characters that clears after 30 minutes, 1 hour, 4 hours, today, this week, a chosen time or never; others see it in lists, cards, mentions and the composer. Availability and status belong to the person, not to chat: every part of the platform that shows presence shows them.
- **FR-115** The system delivers the new facts of this spec (polls, reminders, drafts, statuses, read positions, deletions and restores) live and only to the people they concern; nothing about a person is broadcast to a whole organization except presence and status.

### 3.11 Direct and group conversations

- **FR-116** Direct and group conversations keep the existing behaviour and stable key; a member of a group conversation can name it, and can turn it into a private channel with its history, which writes a system event.
- **FR-117** The direct message list is ordered by last activity and shows a teaser (last text, or "sent a file", "poll"), a draft marker and unread counts; the teaser follows when the last message is deleted.
- **FR-118** A direct conversation's header shows the person or people, presence, status, local time and time off, and opens the profile with the files shared between them.
- **FR-119** A direct conversation whose other members are all deactivated shows a banner in every client; an organization can make such conversations read-only (setting, default off: they stay writable, as today), and then the server refuses sends to them (FR-54).

### 3.12 Advanced capabilities

- **FR-120** A person can ask for a summary of a conversation since their read position or over a chosen period: the system answers topics, decisions, questions addressed to them and action items, each item linking to its source messages, built only from messages they may read at that moment, marked as AI-generated, kept at most 24 hours. `(advanced)`
- **FR-121** From a record page or the command palette a person can ask what they missed about that record: the system summarises, with links, the messages of their conversations that carry the record's card, key or link since they last opened it. `(advanced)`
- **FR-122** A reader can translate a message into their language and see the translation under the original, which stays shown; an organization can turn on automatic translation of messages not in the reader's language; translations are kept per message and language and dropped when the message is edited. `(advanced)`
- **FR-123** The Unreads view can sort by relevance: mentions first, then messages from the person's manager and direct reports, messages about tasks assigned to them, projects they tracked time on in the last 14 days and records they follow, then conversations they write in most; each conversation shows why it ranks where it does, and the ranking uses platform data only. `(advanced)`
- **FR-124** With the person's consent, presence can show "tracking time on <project>" from the running timer (to members of that project only), "in a meeting until <time>" from their calendar and "on time off until <date>"; a person can choose do not disturb during calendar meetings. `(advanced)`
- **FR-125** When a person writes to someone outside that person's working hours (working schedule, time zone, time off), the composer offers to deliver at the recipient's next start of day as a scheduled message (FR-83) and shows when that is for the author. `(advanced)`
- **FR-126** Voice clips get a transcript shown under the player and made searchable, produced with the tenant's speech provider. `(advanced)`

### 3.13 MCP tools and reports

- **FR-127** The MCP chat tools gain, under the existing scopes: search with the filters of FR-97, get a message with its context, list threads, list saved messages and reminders, create and vote in polls, save a message, set a reminder and schedule a message (write scope, answering a preview unless confirmed), and summaries and translation where FR-3 allows; results mark user text as data.
- **FR-128** The system registers report definitions: poll results, most used reactions per person, and messages and active members per conversation and day (counts only, never bodies).

### 3.14 Defaults

- **FR-129** With no organization setting or person's choice of this spec changed, existing chat behaves as today: channel names may repeat, a channel left without a manager stays so, direct conversations with deactivated people stay writable, pins are not capped, every member pins and uses `@channel` and `@here`, archived conversations stay in the list, and chat emails follow each person's existing email choice.

## 4. Non-Functional Requirements

- **Performance**: search P95 < 400 ms over 10 million messages per tenant; index lag P95 < 5 s; Activity, Saved, Threads and Scheduled pages P95 < 300 ms at 10,000 entries per person; a vote or reaction P95 < 200 ms; read receipts of a message P95 < 200 ms at 50 members; existing budgets of the chat spec kept; first summary line within 3 s with a working provider.
- **Data volume**: 10 million messages per tenant, 10,000 members per channel, 1,000 open reminders and 500 scheduled messages per person, 100 pins per conversation, 20 options per poll.
- **Concurrency**: one ballot per person and poll, one draft per person and place, one reminder delivery and one scheduled send enforced by unique keys and row claims; concurrent edits keep every earlier body in the history.
- **Reliability**: reminders, scheduled messages and poll closing run on per-item claims that survive restarts and run late rather than never; unsent client messages are retried with their original key; no message is sent twice.
- **Security & privacy**: membership checked on every new read and write; anonymous ballots stored without a readable link to the voter; read receipts respect the two-way privacy choice; what leaves the platform: push payloads (author, conversation, snippet) to the push services, emails to the mail provider, message text to the tenant's AI provider only for §3.12 when switched on, voice clips to the speech provider for FR-126, GIF search words to the registered GIF source, link fetches as today.
- **Auditability**: channel deletion, restore, manager changes by `CHAT_MANAGE`, custom emoji changes and visibility changes in the activity log; edit history kept with the message.
- **Accessibility and localisation**: keyboard operable lists, composer, polls, menus and dialogs; labelled controls and live regions for new messages; system events, dates and plurals in every shipped locale; right-to-left text shown correctly.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; multi-tenant cloud and self-hosted; additive OpenAPI and GraphQL changes; works without the realtime plugin (polling; no presence or status), without the Inbox (notices stay in the platform's notification list), without the platform reminders (no Remind action) and without `drive` (today's uploads).

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `ChatConversation` (existing) | A channel, direct or group conversation; gains everyone and announcement modes, description, linked record, deleted state and posting rules |
| `ChatMember` (existing) | A person's membership; gains synced flag, mute-until and the person's own section |
| `ChatCategory` (existing) | A section of the conversation list: the organization's, or (new) a person's own |
| `ChatMessage` (existing) | A message; gains quote snapshot, forward origin, silent and urgent marks, poll and system event data |
| `ChatMessageRevision` | An earlier body of an edited message with its time |
| `ChatSystemEvent` | The structured data of a system message (type, actors, targets) |
| `ChatDraft` | A person's unsent text for one conversation or thread |
| Reminder (platform) | A person's reminder on a message, with note, time and state, kept with the platform's reminders on records |
| `ChatScheduledMessage` | A message (of a person or a bot) to be sent later once or repeatedly, with its state and failure reason |
| `ChatMessageLink` | A link found in a message, for link search |
| Chat preferences (platform) | A person's chat choices kept with their user preferences: appearance, sort and filters, sounds, quick reactions, nudge, read position privacy, last open place; notification choices kept with their notification preferences |
| Availability and status (platform) | A person's availability and custom status with its end, part of their platform presence |
| Notification (platform) | A mention, reply, quote, thread reply or fired reminder addressed to a person, with its read state |
| `ChatReactionNotice` | The bundled reactions to one of a person's messages |
| `ChatTranslation` | A message translated into one language |
| `ChatDigest` | A conversation or record summary with its source links, kept briefly |
| Poll, vote (platform) | The platform's poll module, hosted by a chat message |
| Custom emoji (platform) | The organization's custom emoji |
| Favourite (platform) | A saved message is a favourite on a chat message |

## 6. Out of Scope

- Bots, AI agents in conversations, record cards beyond tasks, record actions, notifications from business records, outgoing webhooks and recurring bot posts: `chat-agents-and-record-actions` (record cards beyond tasks and record actions behind its `FEATURE_CHAT_RECORD_CARDS`).
- Organization chat settings, roles and rules, guests, retention, legal holds, compliance export, import, calls and quick calls, the installable app, share in and out, push and offline capabilities of clients: `chat-administration-and-clients`.
- Meeting rooms and their media: `meetings`. Long-form discussions: `discussions`. The notification engine, preferences, quiet hours and reminders on records: `automation-and-notifications`. Mobile push transport: `email-and-communications`. File storage, previews and zips: `drive`.
- Ever Teams chat screens: the Ever Teams spec `workspace-collaboration-clients`.

## 7. Acceptance Criteria

- [ ] **AC-1** With the chat flags off nothing changes; with them on, every existing chat acceptance criterion still passes (FR-1, FR-2).
- [ ] **AC-2** The switcher shows counts per organization and returns to the last open conversation in the Angular app and through the API (FR-5, FR-6).
- [ ] **AC-3** Personal sections, sort and filters work and never hide a favourite or a mention (FR-9, FR-10).
- [ ] **AC-4** An everyone channel includes a newly hired employee; an announcement channel refuses a non-manager's top-level post and accepts their thread reply (FR-13, FR-14).
- [ ] **AC-5** A duplicate channel name is refused; deleting a channel hides it, restore brings it back, purge after 30 days removes polls, reminders and scheduled messages too, and a legal hold blocks the purge (FR-15, FR-21).
- [ ] **AC-6** Manager succession names the new manager in a system event shown in two locales (FR-19, FR-31).
- [ ] **AC-7** Quote, forward to three targets with one failing, edit history and bulk delete behave as specified (FR-39–FR-42).
- [ ] **AC-8** A draft typed in the Angular app appears through the API on another session; an offline send goes out once on reconnect (FR-38, FR-47).
- [ ] **AC-9** An anonymous multiple-choice poll with a closing time: one ballot per person under concurrent votes, no voter list for anyone, closes on time, results exported (FR-74–FR-76).
- [ ] **AC-10** Saved messages, read receipts with the two-way privacy choice, and the Saved page work (FR-78, FR-79, FR-86).
- [ ] **AC-11** A reminder fires once with an Inbox entry and push, and is skipped after losing access; a scheduled message skips weekend and holiday, fails with a reason after removal, and is retried (FR-81–FR-85).
- [ ] **AC-12** Search with author, has-file and date filters finds a message within 5 seconds of sending and opens it in context; link search finds a link without a preview (FR-96–FR-100).
- [ ] **AC-13** Activity bundles reactions per message; mute until restores the earlier level; a person who chose the unread wait is emailed for a direct message unread after 30 minutes and not for a read one, and a person who chose nothing is emailed as today; do not disturb holds pushes (FR-104–FR-109).
- [ ] **AC-14** Custom status clears at its time; presence and status show in Angular lists and cards (FR-113, FR-114).
- [ ] **AC-15** A group conversation becomes a private channel with its history; a direct conversation with a deactivated person refuses sends where the organization's setting asks for it and accepts them by default (FR-116, FR-119).
- [ ] **AC-16** Summary and record summary answer with working links only to readable messages; with the AI switch off the controls are absent and no request reaches a provider (FR-3, FR-120, FR-121).
- [ ] **AC-17** Translation shows under the original and is dropped on edit (FR-122).
- [ ] **AC-18** Relevance sort orders a mention, a message about an assigned task and an idle channel as specified, with reasons (FR-123).
- [ ] **AC-19** Presence shows "tracking time on" only to project members, and "deliver at their start of day" schedules correctly across time zones (FR-124, FR-125).
- [ ] **AC-20** A voice clip records, plays and, with the speech provider, is found by a word of its transcript (FR-90, FR-126).
- [ ] **AC-21** The new MCP tools answer like the REST routes for the same user and preview before scheduling (FR-127).
- [ ] **AC-22** The report definitions of FR-128 return counts matching the chat's own records.
- [ ] **AC-23** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-24** With the chat flags on and no setting of this spec changed, a second channel named like an existing one is created, the last manager leaving names no successor, a direct conversation with a deactivated person accepts a message, a 101st pin is accepted, an archived channel stays in the list, and a mention is emailed as the person's existing preference says (FR-129).
- [ ] **AC-25** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-2).

## 8. Open Questions

- Message body format (open in the chat spec): applied default, the Markdown subset stays the stored format and grows as FR-29 says; the composer gives it a toolbar.
- Channels following teams (open in the chat spec): applied default, opt-in per team or department (FR-24), never automatic.
- Read receipts: applied default, offered up to 50 members, each person may hide their own (two-way).
- Email for unread direct messages and mentions: applied default, each person's existing email choice stays; the unread wait (30 minutes when chosen) is a choice in their preferences.
- Custom emoji shared with `discussions`: applied default, `CHAT_MANAGE` or the discussions manage permission may add them.
- Relevance ranking (FR-123) is rule-based on platform data; an AI refinement is left out. Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/chat` and `chat-ui`; polls, custom emoji and favourites are the platform's shared modules.
- [x] II Tenant/organization scoping — every new row carries tenant and organization; membership checked on every read.
- [x] III Both ORMs, additive migrations — new tables and columns only, three dialects.
- [x] IV Default-off flag; nothing removed — chat flags and `GAUZY_CHAT_AI_ENABLED` off; existing behaviour kept.
- [x] V Contracts and API first — every capability is a REST route with contracts before UI; GraphQL read twins where chat has them.
- [x] VI Permissions, privacy, security — membership, anonymous ballots, two-way receipts, listed outbound data.
- [x] VII Real-time through the event bus — outbox facts and the platform channel; no private push.
- [x] VIII i18n and accessibility — system events translated, keyboard operable.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on existing behaviour:

| Requirement | Existing behaviour it extends |
| --- | --- |
| FR-1, FR-2, FR-64, FR-80, FR-105, FR-116 | [`docs/specs/features/chat/spec.md`](../chat/spec.md) FR-1–FR-25 (conversations, messages, threads, unread counters, read-all undo, direct keys) |
| FR-9 | the organization's sidebar categories of chat, which gain personal ones |
| FR-6, FR-35, FR-61 | the platform's user preferences (`uiPreferences`) and time format |
| FR-13, FR-25 | the default channel of chat FR-2 and the direct key of chat FR-1 |
| FR-31 | the `system` message kind the chat already stores and renders |
| FR-32, FR-34 | rename-safe mention tokens of chat FR-10 and the platform's mention service |
| FR-37, FR-88–FR-95 | chat attachments as Documents hub files (chat FR-19) and [`../drive/spec.md`](../drive/spec.md) FR-5, FR-64, FR-70 |
| FR-51 | the server-side link previews and egress guard of chat FR-20 |
| FR-48, FR-113, FR-114, FR-115 | typing, presence and addressed events of [`docs/specs/features/realtime-channel/spec.md`](../realtime-channel/spec.md); the presence gains availability and status |
| FR-96–FR-101 | chat search route of chat FR-21 and the search plugin |
| FR-104, FR-107, FR-109 | [`docs/specs/features/inbox/spec.md`](../inbox/spec.md) FR-1, FR-10, FR-11 and its email and push delivery, the platform notifications and their do-not-disturb window and unread wait |
| FR-81, FR-82, FR-86 | the platform's reminders on records of `automation-and-notifications` |
| FR-127 | [`docs/specs/features/mcp-collaboration-tools/spec.md`](../mcp-collaboration-tools/spec.md) FR-1, FR-2 (scopes, assisted mark) |

- Contracts used: [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md) (preferences, quiet hours, bundling, reminders), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md) (legal holds), [`../ai-agents-and-assistants/spec.md`](../ai-agents-and-assistants/spec.md) (runs and usage of AI calls), [`../email-and-communications/spec.md`](../email-and-communications/spec.md) (mobile push), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md) (palette, global search), [`../discussions/spec.md`](../discussions/spec.md) (poll and custom emoji modules), [`../calendar-and-scheduling/spec.md`](../calendar-and-scheduling/spec.md) (meetings in status), [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md) (report definitions).
- Siblings: `chat-agents-and-record-actions`, `chat-administration-and-clients`; client: the Ever Teams spec `workspace-collaboration-clients`.
- Code: `packages/plugins/chat/`, `packages/plugins/chat-ui/`, `packages/plugins/realtime/`, `packages/plugins/inbox/`, `packages/plugins/search/`, `packages/core/src/lib/{mention,reaction,favorite}/`.
