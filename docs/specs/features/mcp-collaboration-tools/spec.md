# Feature Specification: MCP tools for chat, docs and inbox

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `mcp-collaboration-tools`
**Branch**: `feat/mcp-collaboration-tools`
**Status**: `In Progress` (ever-gauzy #11722)
**Created**: 2026-11-07
**Last updated**: 2026-11-08
**Owner**: platform maintainers
**Feature flag**: MCP server tool groups (`GAUZY_MCP_TOOLS_CHAT`, `GAUZY_MCP_TOOLS_DOCS`, `GAUZY_MCP_TOOLS_INBOX`, default off)

---

## 1. Overview

The platform's MCP server already lets AI clients work with tasks, projects, timers and
comments under the signed-in user's permissions. This feature adds tool groups for the
collaboration suite so an AI client can read a user's conversations and inbox, search
messages, read and write pages as Markdown without clobbering formatting, and post
messages or inbox-safe actions only with explicit scopes. Tool descriptions and returned
content are data, never instructions.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an AI client connected with the chat-read scope, **when** it asks "what did
  the design channel decide about the onboarding flow?", **then** it can list the user's
  conversations, search messages for "onboarding", read the matching thread and answer
  with links to the messages.
- **Given** a client with the docs-write scope, **when** it updates a page by sending the
  whole page as Markdown with one paragraph changed, **then** only that paragraph changes
  on the page; headings, callouts, comments and formatting elsewhere stay intact, and
  editors with the page open see the change live.
- **Given** a client with the inbox-read scope, **when** it asks "what needs my attention
  today?", **then** it lists the user's unread inbox entries grouped by source with links.
- **Given** a client with the chat-write scope, **when** it is asked to post a summary to
  `#standup`, **then** it posts in the user's name with an "assisted" marker, and the
  message is visible to the user before any further action.
- **Given** a client without the chat scope, **when** it calls a chat tool, **then** it
  receives "not found" for the tool, not a permission error that reveals the tool exists.

### 2.2 Edge cases & failures

- **Given** a page larger than the tool limit, **when** read, **then** the tool returns a
  truncated Markdown with a continuation cursor.
- **Given** a Markdown update with a version the page has moved past, **when** applied,
  **then** the tool answers with a conflict and the current version.
- **Given** a conversation the user cannot see, **when** requested by id, **then** the
  tool returns "not found".
- **Given** tool output containing text like "ignore previous instructions", **when**
  returned, **then** it is returned verbatim as content, flagged as user-authored data.

## 3. Functional Requirements

- **FR-1** Tool groups `chat`, `docs`, `inbox` MUST be individually enabled per
  deployment and gated per session by scopes (`chat:read`, `chat:write`, `docs:read`,
  `docs:write`, `inbox:read`, `inbox:write`).
- **FR-2** Chat tools MUST include: list conversations (with unread counts), list
  messages (cursor paging, newest first), get thread, search messages, post message
  (write scope), mark conversation read (write scope).
- **FR-3** Docs tools MUST include: list pages (tree, by space or project), get page
  (Markdown + metadata + revision), create page, update page from Markdown with
  compare-and-set on the page's revision and block-level merge, search pages. An update
  MUST keep the formatting and comments of every block whose text did not change, and
  MUST be refused with a conflict rather than drop or move the comments of a block it
  cannot identify (one of identical blocks that were added, removed or moved so that
  which is which is a guess); a block the text only moved keeps its formatting and
  comments. (The Docs merge tells identical blocks apart by the unique blocks around
  them and answers 409 `DOCS_MARKDOWN_AMBIGUOUS` with the `blockIds` concerned when a
  commented one's place would be a guess; a block whose text changed is rebuilt from its
  Markdown and loses its block id. See the Docs collaboration plan §4, "Markdown merge".)
- **FR-4** Inbox tools MUST include: list entries (filters, cursor), get unread counts,
  mark read / snooze / archive (write scope).
- **FR-5** Every tool MUST run under the signed-in user's tenant, organization and
  permissions; tools MUST answer "not found" for anything outside the user's access.
- **FR-6** Tool results MUST mark user-authored text as data and MUST never include
  secrets, tokens or other users' private data.
- **FR-7** Tool calls MUST be logged (tool name, user, duration, outcome) without
  message or page bodies.
- **FR-8** Existing MCP tools and transports MUST keep working unchanged.

## 4. Non-Functional Requirements

- **Performance**: tool calls under 500 ms P95 excluding search over large histories.
- **Reliability**: idempotent writes by client-supplied key where applicable.
- **Security & privacy**: scopes enforced per session; rate limits per user; input
  validation on every tool.
- **Observability**: tool metrics by name and outcome.
- **Compatibility**: all MCP transports already supported by the server.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `ToolScope`      | A named permission an MCP session holds for a tool group |
| `AssistedMessage` | A chat message posted through an AI client in the user's name, marked as assisted |

## 6. Out of Scope

- A built-in assistant UI (the AI chat plugin covers that).
- Admin or settings tools.

## 7. Acceptance Criteria

- [ ] Each tool group appears only when enabled and scoped; unscoped calls get "not found".
- [ ] A Markdown update changes only edited blocks and respects the version check.
- [ ] Chat and inbox reads match the REST API for the same user.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether assisted messages need an explicit per-message approval step in clients that support it (proposed: yes when the client supports approval, otherwise allowed under chat:write)]`

## 9. Constitution Gates

- [x] I Plugin-first — tools live in `packages/mcp-server` next to the existing groups and call plugin APIs.
- [x] II Tenant/organization scoping.
- [ ] III Both ORMs — no schema change.
- [x] IV Default-off tool groups; nothing removed.
- [x] V Contracts and API first — tools call the same REST contracts.
- [x] VI Permissions, privacy, security — scopes, not-found semantics, no secrets.
- [ ] VII Real-time — not applicable.
- [ ] VIII i18n — tool descriptions in English only (MCP convention).
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Depends on: [`../chat/spec.md`](../chat/spec.md), [`../docs-collaboration/spec.md`](../docs-collaboration/spec.md) (the page revision of its phase 1 and the Markdown export / update routes of its phase 2, both merged into `develop`: tasks T8, T12, T13), [`../inbox/spec.md`](../inbox/spec.md)
