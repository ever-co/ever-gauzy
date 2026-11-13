# Feature Specification: Chat

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `chat`
**Branch**: `feat/chat`
**Status**: `Draft`
**Created**: 2026-11-07
**Last updated**: 2026-11-07
**Owner**: platform maintainers
**Feature flag**: `GAUZY_CHAT_ENABLED` (default off) + `FeatureEnum.FEATURE_CHAT` toggle per tenant

---

## 1. Overview

Employees of an organization can talk to each other inside the platform: in **channels**
(public or private, organized in sidebar categories), in **direct messages** (one-to-one
or small groups) and in **threads** under any message. Messages support formatting,
@mentions of employees and channels, reactions, pinning, file attachments and link
previews, and **task cards**: typing a task reference or pasting a task link shows the
task inline, and a task can be sent to a conversation or created from a message. Unread
and mention counts are tracked per member per conversation, mentions land in the Inbox,
and every change is pushed over the real-time channel. The same API serves the Angular
app, Ever Teams (web, mobile, desktop), the MCP server and the SDKs.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an organization with chat enabled, **when** an employee opens Chat for the
  first time, **then** they see the default `#general` channel (every employee is a
  member and cannot leave it), the channels they belong to grouped by category, their
  direct messages, and an Unreads view.
- **Given** an employee in `#engineering`, **when** they type a message and press Enter,
  **then** the message appears for every member immediately, is persisted, and the
  conversation moves to the top of the list for members who sort by activity.
- **Given** a message, **when** another employee replies in a thread, **then** the reply
  appears under the message as a thread summary ("3 replies · last reply 2 min ago"), the
  root author and thread followers get an unread thread, and nobody else's channel unread
  count changes.
- **Given** an employee types `@Anna`, **when** they pick her from the suggestions and
  send, **then** Anna's mention count for the conversation increments, she gets an Inbox
  entry that opens the message, and the mention renders as a chip even if Anna later
  changes her display name.
- **Given** a message containing a task reference (for example `GZ-142` where `GZ` is a
  project's key) or a task URL, **when** it is rendered, **then** members who may view
  the task see a card with its title, status, priority, assignees and due date, and can
  change status or assignee from the card; members who may not view the task see plain text.
- **Given** a task page, **when** an employee chooses "Send to chat" and picks a
  conversation, **then** a message with the task card is posted there in their name.
- **Given** a message, **when** an employee chooses "Create task from message", **then**
  a task is created in the chosen project with the message text as description and a link
  back to the message, and the message shows the task card.
- **Given** an employee with unread messages in three conversations, **when** they open
  the Unreads view, **then** they see those conversations newest first and can mark all as
  read, with undo for a short time.
- **Given** an employee drags an image into the composer, **when** they send, **then** the
  image is stored through the platform's file storage, shown inline, and listed in the
  conversation's Files pane.
- **Given** a message with a public web link, **when** it is rendered, **then** a preview
  card (title, description, image) is shown, fetched by the platform, never by the client.
- **Given** two employees, **when** one starts a direct message with the other, **then**
  a private conversation exists for exactly those two (reused if it already exists) and
  the recipient sees it in their list.

### 2.2 Edge cases & failures

- **Given** a private channel, **when** a member is removed, **then** they stop
  receiving its events immediately, cannot read its history, and their unread state for it
  is deleted.
- **Given** a message author, **when** they delete a message that has thread replies,
  **then** the message shows as "deleted" and the thread remains readable.
- **Given** a network drop while sending, **when** the client retries the same send with
  the same idempotency key, **then** exactly one message exists.
- **Given** a message longer than the limit, **when** sent, **then** the platform rejects
  it with a validation error naming the limit.
- **Given** an employee who is not a member of a conversation, **when** they request its
  messages by id, **then** they receive "not found" (never a hint that it exists).
- **Given** a link to a private network address, **when** a preview is requested,
  **then** no preview is fetched and no error is shown to the user.
- **Given** the real-time channel is unavailable, **when** an employee uses chat, **then**
  messages still send and the client refreshes on a documented polling interval.
- **Given** a suspended or deleted employee, **when** another member opens the mention
  picker, **then** that employee is not offered.

## 3. Functional Requirements

### Conversations

- **FR-1** The platform MUST support conversation kinds `channel` (public or private),
  `direct` (two members) and `group` (three or more members), each scoped to one tenant
  and organization.
- **FR-2** The platform MUST create a default public channel per organization when chat is
  first enabled, with every employee as a member; members MUST NOT be able to leave it.
- **FR-3** Employees with the chat-manage permission MUST be able to create categories,
  order channels within them, rename, archive and unarchive channels, and change a channel
  between public and private; a channel's creator MUST be able to manage their own channel.
- **FR-4** Any employee MUST be able to join a public channel, leave a channel they joined
  (except the default one), browse public channels, create a channel, and start a direct
  or group message with employees of the same organization.
- **FR-5** Every employee MUST be able to pin or favourite conversations for themselves
  and set a per-conversation notify level (`all`, `mentions`, `muted`).

### Messages

- **FR-6** A message MUST hold formatted text (a documented markdown subset) up to
  4,000 characters, zero or more attachments, zero or more mentions, an optional reply
  reference (quote) and an optional thread root.
- **FR-7** Authors MUST be able to edit their own messages (keeping an "edited" marker and
  the edit time) and delete them; employees with the chat-manage permission MUST be able
  to delete any message.
- **FR-8** Sending MUST be idempotent per client-supplied key for 24 hours.
- **FR-9** Members MUST be able to react to a message with an emoji (one reaction per
  member per emoji), pin and unpin messages, and list a conversation's pins and files.
- **FR-10** Mentions MUST be stored as stable tokens referencing employee or conversation
  ids, so renaming never breaks old messages; the platform MUST support `@employee`,
  `@channel`, `@here` and `#channel`.
- **FR-11** Threads MUST be the reply model: a reply belongs to one root message; a reply
  MAY also be posted to the conversation; members MUST be able to follow or unfollow a
  thread and see their followed threads with unread reply counts.

### Tasks in chat

- **FR-12** The platform MUST detect task references (`<PROJECT-KEY>-<number>`) and task
  links in message text and return the referenced task ids with the message, filtered by
  the reader's permission to view each task.
- **FR-13** The platform MUST provide an action that posts a task card message to a
  conversation ("send task to chat") and an action that creates a task from a message,
  linking the task and the message both ways.
- **FR-14** Changes made from a task card MUST go through the task service with the same
  permissions and events as changes made on the task page.

### Unread state and notifications

- **FR-15** The platform MUST keep, per member per conversation, an unread count, a
  mention count and the last read message; counts MUST be maintained inside the message
  write and exposed in one call for all of a member's conversations.
- **FR-16** Members MUST be able to mark a conversation read, mark unread from a message,
  mark all read, and undo a mark-all-read for a short period.
- **FR-17** An `@employee` mention in a channel, a direct message and a thread reply to a
  followed thread MUST create an Inbox entry for the recipient (subject to their
  preferences). Reading the conversation MUST mark the mention and direct-message entries
  read; a followed-thread reply's entry MUST be marked read when the member reads that
  thread, not when they read the conversation (a mention in a thread-only reply is filed
  against the conversation and still clears with it, see plan §14.3).
- **FR-18** Every message, edit, deletion, reaction, pin, read-state change, thread change
  and conversation change MUST be published on the real-time channel to the right audience.

### Files, previews, search

- **FR-19** Attachments MUST use the platform's file storage providers and existing
  upload limits; images MUST expose width and height for layout.
- **FR-20** Link previews MUST be fetched server-side with public-address-only, size and
  redirect limits, and cached.
- **FR-21** Members MUST be able to search messages across their conversations by text,
  with optional conversation, author and has-file filters, newest first, paginated.

### Permissions and limits

- **FR-22** Reading a conversation, its messages, files and pins MUST require membership;
  non-members MUST receive "not found".
- **FR-23** New permissions `CHAT_VIEW`, `CHAT_SEND`, `CHAT_MANAGE` MUST gate the
  endpoints; default roles grant view and send to employees and manage to admins and
  managers.
- **FR-24** The platform MUST NOT expose chat to users who are not employees of the
  organization (external clients, candidates).
- **FR-25** Chat MUST be fully usable through the REST API and the SDKs, and readable
  through MCP tools, without any UI.

## 4. Non-Functional Requirements

- **Performance**: P95 under 300 ms for listing the newest 50 messages of a conversation
  with 1,000,000 messages; conversation list with unread state for 500 conversations
  under 300 ms; message send under 200 ms excluding attachment upload.
- **Reliability**: no duplicate messages across retries; counters never drift (recomputed
  by a repair job if a mismatch is detected).
- **Security & privacy**: membership-scoped reads; sanitised text; previews only for
  public hosts; attachments behind signed URLs; mention tokens never leak employee data to
  non-members; message bodies excluded from logs.
- **Observability**: activity-log entries for channel management; metrics for messages
  per minute, preview fetches, search latency.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; migrations additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `ChatConversation` | A channel, direct or group conversation of an organization, with kind, name, topic, category, archived state |
| `ChatCategory`   | A named, ordered sidebar section for channels |
| `ChatMember`     | An employee's membership in a conversation with role, notify level, favourite flag, last read position and counters |
| `ChatMessage`    | A message with text, author, attachments, mentions, reply reference, thread root, pin state, edit/delete markers |
| `ChatReaction`   | One member's emoji reaction to one message |
| `ChatThreadFollow` | A member following a thread, with unread reply count |
| `TaskReference`  | A link between a message and a task (typed reference, sent card, or created-from-message) |
| `LinkPreview`    | Cached metadata of a public URL |

## 6. Out of Scope

- Voice or video calls (meetings exist separately).
- Guest or external-user access and shared channels across organizations.
- Scheduled messages, reminders, read receipts, message translation.
- Custom emoji and stickers (may follow).
- Outgoing webhooks and slash commands (the incoming-webhooks feature covers bots posting in).
- Email delivery of chat messages (inbox preferences decide what reaches email).

## 7. Acceptance Criteria

- [ ] An organization enabling the flag gets a default channel with every employee.
- [ ] Two employees exchange messages, a thread reply and a reaction; each sees the
      other's actions live; unread and mention counts match on reload.
- [ ] A mention creates an Inbox entry that opens the message; reading the conversation
      clears it.
- [ ] A task reference renders a card for members who may view the task and plain text for
      others; changing status from the card changes the task.
- [ ] "Send to chat" from a task and "Create task from message" link both ways.
- [ ] Non-members get "not found" for private conversations; removed members stop
      receiving events.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `GAUZY_CHAT_ENABLED`;
      nothing changes while the flag is off.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: message body format — markdown subset (portable across Angular, React, mobile) vs the rich-text HTML used by task descriptions; the plan proposes markdown with a documented subset]`
- `[NEEDS CLARIFICATION: whether chat membership follows organization teams automatically (a channel per team on enable) or stays manual]`

## 9. Constitution Gates

- [x] I Plugin-first — `packages/plugins/chat` (+ `chat-ui`, consumed by Ever Teams through the API).
- [x] II Tenant/organization scoping — every entity extends the tenant/organization base.
- [x] III Both ORMs, additive migrations.
- [x] IV Default-off flag; nothing removed — `GAUZY_CHAT_ENABLED` + feature toggle.
- [x] V Contracts and API first — contracts land before UI; SDK and MCP consume them.
- [x] VI Permissions, privacy, security — new permissions, membership-scoped reads, safe previews.
- [x] VII Real-time through the event bus — all writes publish to the real-time channel.
- [x] VIII i18n and accessibility — UI strings in every locale; keyboard-operable composer.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Architecture: [`../../architecture/collaboration-suite.md`](../../architecture/collaboration-suite.md)
- Depends on: [`../realtime-channel/spec.md`](../realtime-channel/spec.md), [`../inbox/spec.md`](../inbox/spec.md)
- Follow-ups: [`../chat-incoming-webhooks/spec.md`](../chat-incoming-webhooks/spec.md), [`../mcp-collaboration-tools/spec.md`](../mcp-collaboration-tools/spec.md)
