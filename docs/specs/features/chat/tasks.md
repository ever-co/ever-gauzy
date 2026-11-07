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
- [ ] **T14**. Task references: `KEY-number` + link detection (project keys from the task-views lane; links by task id until then), send-to-chat (`taskId`), create-task-from-message
- [ ] **T15**. Files pane through `DocumentLink { entity: ChatMessage }`; attachment ownership check
- [ ] **T16**. Search definition in the search plugin; `/chat/search` with membership filter
- [ ] **T17**. GraphQL twins (gated schema) for the read routes; field-binding check entry

## Phase 4 — Verification and docs

- [ ] **T18**. CI/typecheck green; enable on dev; two users exchange messages, threads, reactions live; non-member 404
- [x] **T19**. Plugin README; `docs/specs/README.md` status

**Status 2026-11-07:** phase 1 in ever-gauzy #11683 (ready for review; 38 bot findings answered — organization boundary, membership/key rules, counters, undo handle, platform wiring). Phase 2 (T14–T17) follows after merge; T18 is the dev-environment check. A membership-checked typing route delegating to the real-time signals is planned for phase 2.
