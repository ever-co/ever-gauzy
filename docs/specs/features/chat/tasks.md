# Task Breakdown: Chat

**Feature ID**: `chat`
**Plan**: `./plan.md`
**Status**: `Ready`
**Last updated**: 2026-11-07

---

## Phase 1 — Contracts, entities, permissions (PR 1)

- [x] **T1**. `packages/contracts/src/lib/chat.model.ts`: enums (kind, visibility, member role, notify level, message kind, task reference kind), interfaces, inputs, pages, `CHAT_EVENT_NAMES`; `BaseEntityEnum.ChatConversation/ChatMessage`; `ReactionEntityEnum.ChatMessage`; `PermissionsEnum.CHAT_VIEW/SEND/MANAGE`; `FeatureEnum.FEATURE_CHAT` + default feature catalogue entry
- [x] **T2**. Plugin package `packages/plugins/chat/` (scaffold from the inbox plugin), `chat-enabled.ts`, path alias, API dependency, `plugins.ts` registration, `.env.sample`
- [x] **T3**. Entities (MultiORM + MikroORM repositories): `ChatCategory`, `ChatConversation`, `ChatMember`, `ChatMessage`, `ChatThreadFollow`, `ChatTaskReference`
- [x] **T4**. Migrations `1791000006100…6600` (tables, indexes, unique keys) + `…6700` permission seed; `chat-migrations.ts`
- [x] **T5**. Default role permissions for new tenants

## Phase 2 — Services and routes (PR 1)

- [x] **T6**. `ChatConversationService`: list mine (states, counts), browse, create channel, find-or-create direct/group (`directKey`), get, update, archive, join/leave, members add/remove, member state, default channel on enable
- [x] **T7**. `ChatMessageService`: send (nonce, mentions tokens + ids, attachments, task refs, counters in one transaction), edit, delete (tombstone), pin/unpin, mark read / mark unread from, read-all + restore snapshot
- [x] **T8**. Reactions through `ReactionService` with membership check
- [x] **T9**. Inbox/notification hooks: mention → `MentionService`; DM and followed-thread reply → `publishNotificationEvent(MESSAGE)`; reading a conversation marks them read
- [x] **T10**. `ChatRealtime`: outbox events declared and appended (addressed)
- [x] **T11**. Controllers + DTOs for every route in plan §4 (phase-1 subset), Swagger, `no-store`
- [x] **T12**. Specs: counters math, direct key, mention token parsing, membership rules

## Phase 3 — Threads, task cards, search (PR 2)

- [x] **T13**. Threads: reply writes, `replyCount`, follows, `/threads`, unread replies
- [x] **T14**. Task references: `KEY-number` + link detection (project keys from the task-views lane; links by task id until then), send-to-chat (`taskId`), create-task-from-message (ever-gauzy `feat/chat-task-references`: `mention` references resolved on send / edit through core's `resolveReferences`, `POST /chat/messages/:id/create-task`)
- [x] **T15**. Files pane through `DocumentLink { entity: ChatMessage }`; attachment ownership check (ever-gauzy `feat/chat-files`: the sender's own FILE documents only, linked in the send transaction, `GET /chat/conversations/:id/files`)
- [x] **T16**. Search definition in the search plugin; `/chat/search` with membership filter (ever-gauzy `feat/chat-search`: `CHAT_MESSAGE_INDEX` shipped by the search plugin, `GET /chat/search` filtered to the caller's memberships)
- [x] **T17**. GraphQL twins (gated schema) for the read routes; field-binding check entry

## Phase 5 — Angular UI (lane G4, `packages/plugins/chat-ui`, PR 3)

- [x] **T20**. Plugin package scaffolded from inbox-ui; registration (plugin-ui config, build lists, tsconfig path, app dependency, Dockerfile, API copy list)
- [x] **T21**. `ChatUiService` (every phase-1 route), `ChatPeopleService` (employees once per organization), `ChatAvailabilityService` (nav entry + header badge follow `/chat/states`)
- [x] **T22**. Helpers + specs: mention tokens ↔ chips, Markdown body through `marked` + the sanitizer, `@` query and suggestions, titles, sorting, grouping, merging
- [x] **T23**. Page: conversation list (Unreads, Threads, favourites, channels by category, direct), conversation view (header actions, pins, older on scroll, newer polled every 5 s, read on view, mark unread from here), composer (Enter sends, `@` suggestions, edit mode), message actions (reply, react, pin, edit, delete) and task cards, thread pane (follow, also-send), Unreads view with mark-all-read + undo, Threads view, dialogs (new channel, new message, browse)
- [ ] **T24**. In-cluster PR build green; bot threads answered; two users exchange messages live on dev
- [x] **T25**. Phase 2 UI: live channel through the realtime subscriptions (drop the polls), attachments, link previews, emoji autocomplete, send-to-chat from a task, create-task-from-message, categories and channel settings (ever-gauzy #11788: one `collaborationEvents` subscription for the chat families over the shared `RealtimeSocketService`, events refetched through REST, polls as the fallback until it is live with prompt delivery and once a minute while live, catch-up after a reconnect; attachments through the Docs upload + Files pane; `:` emoji autocomplete; link cards made from the link alone — #11792: create task from message, task cards with key/title/status, "Send to chat" in the task page's new `task-view-actions` extension slot, conversation settings with members, channel categories). Not built, no platform route: link previews with title/description/picture (`GET /chat/link-preview`, `chat_link_preview`); changing a task from its card (FR-14) and a category reorder route followed in T29 / T33

## Phase 6 — Spec gaps (FR-14, typing, files only, draft uploads, reorder, image sizes)

- [x] **T29**. FR-14 task cards: `PATCH /chat/messages/:id/tasks/:taskId` (status, priority, assignees) through `TaskUpdateCommand` — the task page's service, permission (`ORG_TASK_EDIT`) and activity log — for a task the message shows; `chat_message.updated` to every conversation showing it (ever-gauzy #11800)
- [x] **T30**. Typing: `POST /chat/conversations/:id/typing { threadRootId? }`, members only, the realtime channel's `typing.signalled` addressed to the other members, `expiresInMs`, one signal per member and place every 2.5 s, route throttle (#11800)
- [x] **T31**. Messages of files only: empty body with an attachment (send, edit); `chat_message.attachmentNames` (migration `1791000007320`) for notifications, inbox titles and the search index (#11800)
- [x] **T32**. Draft uploads: `chat_attachment_draft` (migration `1791000007310`), recorded on a chat composer's Docs upload, consumed by the send / edit, `DELETE /chat/attachments/:documentId`, 24 h sweep that purges untouched, unattached drafts and frees their stored bytes (#11800)
- [x] **T33**. `POST /chat/categories/reorder`: categories and the channels within them in one transaction (#11800)
- [x] **T34**. Picture `width` / `height` read at the Docs upload (`metadata.upload.image`) and served by `GET /chat/conversations/:id/files` (#11800)
- [x] **T35**. Angular `chat-ui`: editable task cards, typing line, files-only send (the file-names body dropped), draft discard, one reorder call, reserved picture space (ever-gauzy #11835)

## Phase 4 — Verification and docs

- [ ] **T18**. CI/typecheck green; enable on dev; two users exchange messages, threads, reactions live; non-member 404
- [x] **T19**. Plugin README; `docs/specs/README.md` status

**Status 2026-11-07:** phase 1 MERGED (ever-gauzy #11683, plus #11686 so the realtime plugin offers the chat events). The Angular UI (phase 5, T20–T23) is in ever-gauzy #11687 (draft; in-cluster build pending). Phase 2 (T14–T17) and the phase-2 UI (T25) follow; T18 / T24 are the dev-environment checks. A membership-checked typing route delegating to the real-time signals is planned for phase 2.

## Follow-ups (from the plan's §14)

- [x] **T26**. Scope `directKey` to the organization: lookup and unique index (`tenantId`, `organizationId`, `directKey`), migration `1791000006600` (plan §14.1)
- [x] **T27**. Generic `/reaction` reads and updates exclude or refuse `ChatMessage` (plan §14.2)
- [x] **T28**. The conversation read leaves thread-only replies to the thread read (plan §14.3)
- [x] **T29**. Link previews, server (spec FR-20, plan §15): `GET /chat/link-preview?url=` behind `GAUZY_CHAT_LINK_PREVIEWS_ENABLED` (default off), the `chat_link_preview` cache (migration `1791000006710`), the SSRF-guarded fetch on the plugin's reusable egress guard (`egress/egress-guard.ts`), the `<head>` parser, the TTL refresh and the `chat-link-preview` queue worker (ever-gauzy #11796). The Angular link cards show the preview as text (site, title, description; no remote picture or icon, so the reader's browser loads nothing from the linked site). Ever Teams renders it in its chat T16
- [x] **T30**. Link preview pictures: `GET /chat/link-preview/image?url=` behind `GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED` (default off, needs the previews on) serves the picture a ready preview of the tenant names, fetched through the egress guard (PNG/JPEG/GIF/WebP/AVIF by their bytes, never SVG, at most 1 MiB), cached per process (256 pictures / 32 MiB, a day; failures ten minutes), on the previews' fetch budget; the Angular link cards show it from a `blob:` URL (ever-gauzy #11807)
