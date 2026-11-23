# Task Breakdown: Chat agents, bots and record actions

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `chat-agents-and-record-actions`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything new stays behind `FEATURE_CHAT_RECORD_CARDS` / `FEATURE_CHAT_AGENTS` (and the AI switch for agents): the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it; what `FEATURE_CHAT` serves today keeps working unchanged.
- Paths are relative to the repository root; `chat/` means `packages/plugins/chat/src/lib/`, `chatui/` means
  `packages/plugins/chat-ui/src/lib/`. Each new service or controller ships with a `.spec.ts` beside it.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/chat-agents.model.ts` (plan §3), `ChatMessageKindEnum` values `bot`, `agent` in `packages/contracts/src/lib/chat.model.ts`, port tokens; exported from `packages/contracts/src/index.ts`. Test: `chat-agents.model.spec.ts` (existing enum values unchanged).
- [ ] **T2**. Feature and permissions as chat plugin contributions: `chat/chat.features.ts` (`FEATURE_CHAT_RECORD_CARDS` and `FEATURE_CHAT_AGENTS`, both `defaultEnabled: false`, depending on `FEATURE_CHAT`) and `chat/chat.permissions.ts` (`CHAT_APPS_MANAGE` `defaultFor` super admin and admin, `CHAT_AGENTS_USE` `defaultFor` every default role holding `CHAT_VIEW`), registered through `@GauzyCorePlugin` in `chat/chat.plugin.ts`. Test: `chat/chat.features.spec.ts`: contributions listed in the catalogue; feature off for an existing tenant; grants for a new tenant.
- [ ] **T3**. Core record card registry `packages/core/src/lib/record-card-registry/` (`record-card.registry.ts` with `registerRecordCardTypes`, readers, field formats, key patterns, editable fields in `record-card.types.ts`, `index.ts`) built on the search plugin's index registrations (label, read permission, title template, display fields taken from `packages/plugins/search/src/lib/registry/search-index.registry.ts`), exported from `packages/core/src/index.ts`; tasks registered from the existing resolver in `record-card-registry/task-record-card.registration.ts`. Test: `record-card.registry.spec.ts`: duplicate key refused; a registration without a search definition is refused; task registration resolves like `chat/chat-task-references.ts`.
- [ ] **T4**. Entity changes (`chat/entities/chat-message.entity.ts`, `chat/entities/chat-webhook.entity.ts`, `chat/entities/chat-scheduled-message.entity.ts`) and the twelve new entities of plan §3 in `chat/entities/` (`chat-bot.entity.ts`, `chat-slash-command.entity.ts`, `chat-private-reply.entity.ts`, `chat-response-address.entity.ts`, `chat-agent-binding.entity.ts`, `chat-prompt.entity.ts`, `chat-card-setting.entity.ts`, `chat-record-reference.entity.ts`, `chat-message-action.entity.ts`, `chat-message-action-run.entity.ts`, `chat-post-buffer.entity.ts`, `chat-source-mute.entity.ts`) with MikroORM repositories in `chat/entities/chat.repositories.ts`, added to `CHAT_ENTITIES` in `chat/chat.module.ts`. Test: registration spec on both ORMs.
- [ ] **T5**. Migrations `chat/database/migrations/1791000067500-AddChatAgentColumns.ts` and `chat/database/migrations/1791000067510-CreateChatAgentTables.ts`, registered in `CHAT_MIGRATIONS` (`chat/database/chat-migrations.ts`); the agent, version, skill, run, run step, tool call, dry-run plan, confirmation, budget and usage tables are those of `ai-agents-and-assistants` T4, nothing of them built here. Test: SQLite up twice is a no-op; dialect spec for MySQL and PostgreSQL. Migration timestamps: `1791000067500` to `1791000067599` (`packages/plugins/chat`).
- [ ] **T6** (parallel). Migration `chat/database/migrations/1791000067520-BackfillChatRecordReferences.ts`. Test: batches, re-run copies nothing twice.
- [ ] **T7** (parallel). Permission reload for existing tenants: the platform's contribution reload (`packages/core/src/lib/role-permission/role-permission.service.ts`, missing grants only) inserts the missing `CHAT_APPS_MANAGE` and `CHAT_AGENTS_USE` grants per `defaultFor` of `chat/chat.permissions.ts` (no seed migration). Test: `chat/chat.permissions.spec.ts`: an existing tenant gains the grants once; a second boot inserts nothing.
- [ ] **T49**. Task reference reads and catch-up (plan §3 Catch-up, §8): the generic card, "Discussed in" and timeline readers take task references from `chat_task_reference` and add only the `action` and `notice` task rows of `chat_record_reference`; `chat.record-reference.catch-up` copies task references missing from `chat_record_reference` (insert-if-absent on its unique key) and deletes its task rows of kind `mention` whose `chat_task_reference` row is gone, as an operation when `FEATURE_CHAT_RECORD_CARDS` is switched on for a tenant and nightly for tenants with the feature on. Files: `chat/jobs/chat-record-reference-catch-up.job.ts`, `chat/services/chat-record-reference.service.ts`. Test: `chat/jobs/chat-record-reference-catch-up.job.spec.ts`: with the feature on, a task reference written to `chat_task_reference` alone (a previous-code replica) is listed under "Discussed in" at once and copied by the next run; a mention a previous-code edit removes from `chat_task_reference` leaves "Discussed in" at once and its `chat_record_reference` row at the next run; a rerun copies nothing twice.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Cards: `chat/services/chat-card.service.ts` (batch resolve per viewer, placeholders, id-only identity), `GET /cards`, `/card-types`, card settings routes in `chat/controllers/chat-card.controller.ts` (DTOs in `chat/dto/chat-agents.dto.ts`), the composer's record picker over `GET /api/search`; `chat_record_reference` writes on send, edit and send-to-chat in `chat/services/chat-record-reference.service.ts` called from `chat/services/chat-message.service.ts`; task references are written to `chat_task_reference` exactly as today and to `chat_record_reference` in the same transaction; `chat/chat-task-references.ts`, the task card service (`chat/services/chat-task-card.service.ts`) and the GraphQL `taskReferences` field keep reading `chat_task_reference`; the new routes answer `404` with `FEATURE_CHAT_RECORD_CARDS` off. Test: unreadable record placeholder, recreated number is another card, task routes answer as before, both tables hold the same task references.
- [ ] **T9**. Card registrations (parallel per plugin): invoices (`packages/core/src/lib/invoice/invoice.record-card.ts`), contacts and deals (`packages/core/src/lib/organization-contact/organization-contact.record-card.ts`, `packages/core/src/lib/deal/deal.record-card.ts`), projects (`packages/core/src/lib/organization-project/organization-project.record-card.ts`), Documents hub pages (`packages/plugins/docs/src/lib/docs.record-card.ts`), employees (`packages/core/src/lib/employee/employee.record-card.ts`) — each in its owning package's registration file. Test: one rendering spec per type with viewer rights.
- [ ] **T10**. Card edits, transitions and decisions: `PATCH /messages/:id/records/:entity/:entityId`, `transition` through `WORKFLOW_TRANSITIONS`, `decision` through `RECORD_DECISIONS` and the time-off and expense handlers (inert when unbound). Files: `chat/controllers/chat-record-card.controller.ts`, `chat/services/chat-card-actions.service.ts`. Test: decision recorded with channel chat; refused transition reason.
- [ ] **T11**. Send to chat and discussed in for registered pages (`POST /records/:entity/:entityId/send`, `GET /records/:entity/:entityId/discussions`); timeline items for `record-views-and-search` (contributed through its timeline port). Files: `chat/controllers/chat-record.controller.ts`, `chat/services/chat-record-discussions.service.ts`, `chat/services/chat-record-timeline.provider.ts`. Test: count of unreadable messages, readable ones listed.
- [ ] **T12**. Card refresh consumer on record facts (`chat.cards.refresh`). Files: `chat/services/chat-card-refresh.consumer.ts`. Test: a status change emits one hint per conversation; a status change of a task whose reference exists only in `chat_task_reference` (written by a previous-code replica, before the catch-up) emits its hint too.
- [ ] **T13**. Incoming webhook gaps in `chat/webhooks/chat-webhook-payload.ts`, `chat/webhooks/chat-app-message.writer.ts`, `chat/webhooks/chat-webhook.service.ts`: thread root and thread key, override, mentions in blocks with Inbox items only with `FEATURE_CHAT_AGENTS` on, files job (`chat.webhook.files` in `chat/webhooks/chat-webhook-files.worker.ts`), address rotation with overlap (`POST /webhooks/:id/rotate` in `chat/controllers/chat-webhook.controller.ts`). Test: `invalid_thread`, override off ignored, rotation window, files typed by content.
- [ ] **T14**. Bots: `chat/services/chat-bot.service.ts` (agent employee provisioning through `EmployeeService.createAgentEmployee`, or binding an existing agent employee such as an Ever Works agent; name, handle, picture, description, state and responsible person written to its `employee_agent_profile` with `source = 'chat'`; platform bot per organization), routes in `chat/controllers/chat-bot.controller.ts`. Test: handle uniqueness, an existing agent employee becomes a bot without a second employee, deletion keeps messages as former bot.
- [ ] **T15**. Bot tokens on the platform: token routes over the core `user_api_token` service (`packages/core/src/lib/auth/user-api-token/user-api-token.service.ts`) for the bot's agent user, scopes and rate limit in its `access_credential_policy` row (`USER_API_TOKEN`) where `access-control-and-security` is loaded, rotation by a new token and a 24 h `expiresAt` on the old one; `/api/chat/bot/v1` authenticated by the platform's API-token strategy with a scope check. Files: `chat/services/chat-bot-token.service.ts`, `chat/controllers/chat-bot-token.controller.ts`, `chat/guards/chat-bot-token-scope.guard.ts`. Test: revoked 401, out-of-scope 403, rotated overlap; the token shows in the platform's key list.
- [ ] **T16**. Bot API controller `chat/controllers/chat-bot-api.controller.ts` (FR-7) over the existing message service with `kind: bot`. Test: post in thread, inactive direct skipped, not-member 404.
- [ ] **T17**. Buttons, forms, private replies, response addresses: extend `chat/webhooks/chat-interaction.service.ts` for bot addresses and plugin handlers; private reply routes (`chat/services/chat-private-reply.service.ts`, `chat/controllers/chat-private-reply.controller.ts`); response addresses (`chat/services/chat-response-address.service.ts`); `chat.private_reply.purge` (`chat/services/chat-private-reply-purge.scheduler.ts`). Test: form values called back once; response address uses and expiry.
- [ ] **T18**. Slash commands: registry service, list per conversation, invoke with signed call or plugin handler, 3-second acknowledgement. Files: `chat/services/chat-slash-command.service.ts`, `chat/controllers/chat-slash-command.controller.ts`. Test: allowed conversations only; late answer through response address.
- [ ] **T19**. Message actions: definitions, field types, defaults from the message, run with declared fields only, back-link card. Files: `chat/services/chat-message-action.service.ts`, `chat/controllers/chat-message-action.controller.ts`. Test: extra field ignored, disabled refused, created record linked both ways.
- [ ] **T20**. Chat poster: `chat/services/chat-bot-post.service.ts` bound to `CHAT_POSTER`; record threads, source fields, source mutes, loop guard. Test: second change goes to the record thread; muted source skipped; posting failure never fails the caller.
- [ ] **T21**. Team and department channels setting (`teamChannels`, `departmentChannels` in `chat/chat.settings.ts`) and sync (reusing the membership sync of `chat-messaging` T17). Files: `chat/services/chat-team-channels.service.ts`. Test: transfer moves membership; deleted team archives the channel.
- [ ] **T22**. Outgoing: `chat_reaction.*` and `chat_member.joined|left` facts (`chat/realtime/chat-outbox-append.ts`), catalogue declarations with content enrichment rules (`chat/events/chat-event-catalogue.ts`), chat-scoped event subscriptions through `WEBHOOK_SUBSCRIPTIONS` (`chat/services/chat-event-subscription.service.ts`, `chat/controllers/chat-event-subscription.controller.ts`), stored as core outgoing webhook subscriptions (`packages/core/src/lib/webhook/webhook-subscription.service.ts`) where `integration-hub` is not loaded. Test: no content without opt-in; direct conversations never delivered; the fallback delivers with HMAC and retries.
- [ ] **T23**. Recurring and one-time bot posts as `chat_scheduled_message` rows with `botId` (card, saved view and flow columns of plan §3), rule evaluation through the core recurrence module with time zone and official holidays, next-five preview, sent by `chat.scheduled.sweep` of `chat-messaging`; a schedule-triggered flow where the organization builds it in the automation engine. Files: `chat/services/chat-bot-schedule.service.ts`, `chat/controllers/chat-bot-post.controller.ts`. Test: holiday skip, once per time with two workers.
- [ ] **T24**. Agent bindings: `chat/services/chat-agent.service.ts` and `chat/controllers/chat-agent.controller.ts` (bot → `ai_agent` with an optional version pin, mention scope), instruction variables and preview over the agent's instructions, shared instructions as `ai_skill` rows, personal and shared prompts (`chat/services/chat-prompt.service.ts`, `chat/controllers/chat-prompt.controller.ts`); the tools catalogue with write marking is the agent's. Test: binding to an agent whose write tool lacks "may change records" is refused by the agent's validation; variables filled for a chosen person.
- [ ] **T25**. Agent runs: `chat-agent-runs` worker (`chat/agents/chat-agent-runs.worker.ts`), context builder (`chat/agents/chat-agent-context.builder.ts`: thread, window, linked record, files through the Documents hub extraction, one-minute file wait), delegated run token from `AccessTokenService` narrowed with the OAuth-app scope rules (`chat/agents/chat-agent-run-token.ts`), `AI_AGENT_RUNNER`, an `ai_run` per answer (`origin = chat`, conversation and message ids) with its steps, tool calls and usage, `chat_message.agentRunId`, streaming signal, stop and new-topic routes (`chat/controllers/chat-agent-run.controller.ts`), deadline; recovery of stale runs by `ai-agents-and-assistants`; the audience check of plan §9 (`chat/agents/chat-agent-audience.ts`) with `chat_message.agentSourceRefs` and its read check in `chat/services/chat-message.service.ts` and `chat/services/chat-search.service.ts`. Test: context excludes unreadable messages; in a channel where another member may not read the invoice the invoker asked about, the answer arrives as the invoker's private reply and the channel shows nothing of it, while an answer from items every member may read is posted; a member added afterwards who may not read one of that answer's items sees the note in the message list, the GraphQL `chatMessages` query and search, and a member who may read them sees the answer; a member of the conversation at posting time who then loses access to the invoice sees the note; after the invoice is deleted, every reader (that member, the member added afterwards, a member who could read the invoice and the invoker) sees the note that a record the answer used is no longer available, in the message list, the GraphQL `chatMessages` query and search; restart marks failed; stop ends the run; usage rows match the provider's answer.
- [ ] **T26**. Knowledge with citations through the documents hub knowledge index (`packages/plugins/docs/src/lib/knowledge/retrieval`, `vector-store`, `chat-tools`) filtered by the invoker, and the agent's knowledge bases of `ai-agents-and-assistants` where loaded. Files: `chat/agents/chat-agent-knowledge.ts`. Test: unreadable file never cited.
- [ ] **T27**. Limits, usage and audit for runs through the agent's limits and the `ai_budget` checks of `ai-agents-and-assistants`; the refusal answered once to the person in chat. Files: `chat/agents/chat-agent-limits.ts`. Test: limit refusal with reset time; audit events per run.
- [ ] **T28**. Mentions of agents in any thread, the allowed-in-all-public option. Files: `chat/agents/chat-agent-mentions.ts`, `chat/chat-mentions.ts`. Test: answer in thread; private conversation not readable.
- [ ] **T29**. Plans and undo: previews captured as an `ai_dry_run_plan` with `ai_confirmation` rows for the approvers (Inbox decision items), plan card rendering them, approve, change, cancel, expiry (the confirmation expiry of `ai-agents-and-assistants`), record-version check, reverse calls. Files: `chat/agents/chat-agent-plan.service.ts`, `chat/controllers/chat-agent-plan.controller.ts`. Test: no write before approval, single-use approval, changed record refused, undo window.
- [ ] **T30**. Slash actions from MCP tools: forms from tool input schemas, preview, post to person or conversation, hidden tools excluded. Files: `chat/services/chat-tool-command.service.ts`, `chat/controllers/chat-tool-command.controller.ts`, tool list read from `packages/mcp-server/src/lib/config/tools-registry.ts`. Test: write tool preview then confirm; hidden tool absent.
- [ ] **T31**. Channel subscriptions as automations: for tasks a `task_automation` rule (trigger on task change through `TaskAutomationChangeCapture`, conditions in the rule, new action `POST_TO_CHAT` in `packages/plugins/task-automations/src/lib/engine/actions.ts` calling `CHAT_POSTER`), for other records and saved views an `automation_flow` with the "post to chat" action; posts within the window upserted into `chat_post_buffer` and flushed by `chat.subscription.flush`; the channel's subscription list reads the automations whose action targets it. Files: `chat/services/chat-subscription.service.ts`, `chat/controllers/chat-subscription.controller.ts`, `chat/services/chat-subscription-flush.scheduler.ts`. Test: 14 changes in a window post once; disabled automation posts nothing; no `entity_subscription` row is written for a conversation.
- [ ] **T32**. GraphQL read twins for bots, agents, commands, actions, subscriptions, runs. Files: `chat/graphql/chat-apps.resolver.ts`, `chat/graphql/chat.schema.ts`. Test: resolver spec mirrors REST.
- [ ] **T46**. Apps overview `GET /apps` (`CHAT_APPS_MANAGE`): bots, agents, incoming webhooks, slash commands, message actions, recurring posts, record subscriptions and the notification engine's chat destinations with owner, conversations, state, last use and recent errors; webhooks listed with `FEATURE_CHAT_RECORD_CARDS` on, the other kinds only with `FEATURE_CHAT_AGENTS` on. Files: `chat/services/chat-apps-overview.service.ts`, `chat/controllers/chat-apps.controller.ts`. Test: `chat/services/chat-apps-overview.service.spec.ts`: each kind listed with its last use and recent errors; a kind whose feature is off is absent (FR-3).
- [ ] **T47**. Bots as participants, behind `FEATURE_CHAT_AGENTS`: a bot is added to channels by people allowed to add members, is the other member of direct conversations, receives no push and no email, shows a "bot" badge (and "former bot" after deletion), search filters messages by bots, apps and people, and a channel manager deletes bot and agent messages in their channel. Files: `chat/services/chat-access.service.ts`, `chat/services/chat-notifier.service.ts`, `chat/services/chat-search.service.ts`, `chatui/components/message-item/message-item.component.ts`. Test: `chat/services/chat-notifier.service.spec.ts` (no push or email to a bot), search spec filtering by author kind, access spec where a channel manager deletes a bot message and a member cannot (FR-5, FR-13).
- [ ] **T48**. Built-in message actions offered when their plugins are loaded: create task (existing), create ticket (`helpdesk-tickets`), log on a contact or deal (`crm-engagement`), expense from an attached receipt (`expenses-and-travel`), save a thread as a page (`documents-and-wiki`), create an event (`calendar-and-scheduling`); per-organization switches `actions.builtIn` in `chat/chat.settings.ts`; behind `FEATURE_CHAT_RECORD_CARDS`. Files: `chat/services/chat-built-in-actions.ts`. Test: `chat/services/chat-built-in-actions.spec.ts`: an action whose plugin is absent is not offered; a switched-off action is refused with `CHAT_ACTION_DISABLED` (FR-43).

## Phase 3 — UI surfaces

- [ ] **T33**. Generic `record-card` component and record picker in the composer; `task-card` keeps its behaviour inside it. Files: `chatui/components/record-card/record-card.component.ts`, `chatui/components/record-picker/record-picker.component.ts`, `chatui/components/task-card/task-card.component.ts`, `chatui/components/message-composer/message-composer.component.ts`. Test: rendering per field format; placeholder.
- [ ] **T34**. Card actions UI: edit fields, transitions, decisions with comment; "Send to chat" and "Discussed in" in record pages through extension slots (`PAGE_EXTENSION_SLOTS`, registered in `chatui/chat-ui.plugin.ts`). Files: `chatui/components/record-card-actions/record-card-actions.component.ts`, `chatui/components/send-to-chat-button/send-to-chat-button.component.ts`, `chatui/components/discussed-in-panel/discussed-in-panel.component.ts`. Test: decision buttons follow rights.
- [ ] **T35**. Apps page with tabs, bot editor (agent profile fields) and the token dialog of the platform's API tokens, card field settings. Files: `chatui/components/chat-apps-page/chat-apps-page.component.ts`, `chatui/components/bot-editor/bot-editor.component.ts`, `chatui/dialogs/bot-token-dialog.component.ts`, `chatui/components/card-settings/card-settings.component.ts`, `chatui/services/chat-apps.service.ts`. Test: token shown once.
- [ ] **T36**. Slash list, command forms, bot form dialog, private reply style, "from <source>" label and mute. Files: `chatui/components/slash-list/slash-list.component.ts`, `chatui/dialogs/command-form-dialog.component.ts`, `chatui/dialogs/bot-form-dialog.component.ts`, `chatui/components/message-item/message-item.component.ts`. Test: keyboard navigation of the slash list.
- [ ] **T37**. Message actions editor and run form. Files: `chatui/components/message-actions-editor/message-actions-editor.component.ts`, `chatui/dialogs/message-action-run-dialog.component.ts`. Test: defaults from the message filled.
- [ ] **T38**. Agents tab linking to the agent editor and run log of `ai-agents-and-assistants` (run log filtered to chat), sandbox test in a conversation; agent messages with progress lines and stop; plan card with approve, change, cancel and undo. Files: `chatui/components/chat-agents-tab/chat-agents-tab.component.ts`, `chatui/components/agent-message/agent-message.component.ts`, `chatui/components/plan-card/plan-card.component.ts`. Test: plan card states; screen-reader labels.
- [ ] **T39**. Subscription dialog (creates the automation) and bot post scheduler with next-five preview. Files: `chatui/dialogs/subscription-dialog.component.ts`, `chatui/components/bot-post-scheduler/bot-post-scheduler.component.ts`. Test: preview matches the server's.
- [ ] **T40**. i18n keys in `packages/plugins/chat-ui/src/i18n/*.json` for every new string. Test: key parity spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T41**. MCP tools of plan §7 in `packages/mcp-server/src/lib/tools/collaboration/chat.ts` and the tool metadata convention (`writes`, `previewable`, `reverse`, `hiddenFromAgents`) in `packages/mcp-server/src/lib/tools/collaboration/collaboration-tool.ts`, set on the chat and task tools (`packages/mcp-server/src/lib/tools/tasks.ts`). Test: tool specs mirror REST; metadata present on the chat and task tools.
- [ ] **T42**. Report definitions of FR-67 registered with the report registry when loaded. Files: `chat/reports/chat-report-definitions.ts`. Test: figures equal the run and post records.
- [ ] **T43**. OpenAPI regenerated with the bot API tag (`packages/core/src/lib/bootstrap/swagger.ts`); SDK regeneration noted; bot API page in the API catalogue; `packages/plugins/chat/README.md` and `packages/plugins/chat-ui/README.md` updated; docs site pages for bots, agents, cards and actions. Test: OpenAPI diff is additive; docs build.
- [ ] **T44**. Flags-off guarantee (FR-68, AC-20): with `FEATURE_CHAT_RECORD_CARDS` and `FEATURE_CHAT_AGENTS` off, an e2e run over the existing chat suites shows links and keys of other records as text, today's message menu entries only, no chat panel on record pages, webhook mentions without Inbox items and `chat_task_reference` written. Files: `apps/gauzy-e2e/tests/chat-flags-off.spec.ts`. Test: the existing chat and webhook specs pass unchanged; flag-off e2e spec.
- [ ] **T45**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `AUTOMATION_CHAT`, `WORKFLOW_CHAT`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and what stays | T8, T41, T44 |
| FR-2 | §3.1 Scope and what stays | T2, T8, T44 |
| FR-3 | §3.1 Scope and what stays | T35, T46 |
| FR-4 | §3.2 Bots | T14 |
| FR-5 | §3.2 Bots | T14, T16, T47 |
| FR-6 | §3.2 Bots | T15, T35 |
| FR-7 | §3.2 Bots | T16 |
| FR-8 | §3.2 Bots | T14, T20 |
| FR-9 | §3.2 Bots | T17 |
| FR-10 | §3.2 Bots | T17, T36 |
| FR-11 | §3.2 Bots | T18 |
| FR-12 | §3.2 Bots | T14, T15, T17 |
| FR-13 | §3.2 Bots | T47 |
| FR-14 | §3.3 Agents in conversations | T24 |
| FR-15 | §3.3 Agents in conversations | T24, T25 |
| FR-16 | §3.3 Agents in conversations | T24 |
| FR-17 | §3.3 Agents in conversations | T24, T41 |
| FR-18 | §3.3 Agents in conversations | T25, T26 |
| FR-19 | §3.3 Agents in conversations | T26 |
| FR-20 | §3.3 Agents in conversations | T25 |
| FR-21 | §3.3 Agents in conversations | T28 |
| FR-22 | §3.3 Agents in conversations | T25 |
| FR-23 | §3.3 Agents in conversations | T25, T38 |
| FR-24 | §3.3 Agents in conversations | T29, T38 |
| FR-25 | §3.3 Agents in conversations | T29, T38, T41 |
| FR-26 | §3.3 Agents in conversations | T25 |
| FR-27 | §3.3 Agents in conversations | T24 |
| FR-28 | §3.3 Agents in conversations | T27 |
| FR-29 | §3.3 Agents in conversations | T25, T27, T38 |
| FR-30 | §3.3 Agents in conversations | T24, T25 |
| FR-31 | §3.3 Agents in conversations | T38 |
| FR-32 | §3.4 Record cards | T3, T9 |
| FR-33 | §3.4 Record cards | T8, T33 |
| FR-34 | §3.4 Record cards | T8, T9, T12, T33 |
| FR-35 | §3.4 Record cards | T3, T10, T34 |
| FR-36 | §3.4 Record cards | T8, T35 |
| FR-37–FR-38 | §3.4 Record cards | T10, T34 |
| FR-39–FR-40 | §3.4 Record cards | T11, T49 |
| FR-41–FR-42 | §3.5 Actions from a message | T19, T37 |
| FR-43 | §3.5 Actions from a message | T48 |
| FR-44 | §3.5 Actions from a message | T30 |
| FR-45 | §3.6 Notifications from business records into channels | T20, T45 |
| FR-46–FR-47 | §3.6 Notifications from business records into channels | T20 |
| FR-48 | §3.6 Notifications from business records into channels | T31, T39 |
| FR-49–FR-50 | §3.6 Notifications from business records into channels | T20 |
| FR-51 | §3.6 Notifications from business records into channels | T20, T22 |
| FR-52 | §3.7 Work context | T21 |
| FR-53 | §3.7 Work context | T22 |
| FR-54–FR-57 | §3.8 Incoming webhooks | T13 |
| FR-58 | §3.8 Incoming webhooks | T17, T18 |
| FR-59–FR-61 | §3.9 Outgoing chat events | T22 |
| FR-62–FR-63 | §3.10 Recurring bot posts | T23 |
| FR-64 | §3.11 Background work, API and tools | T12, T13, T23, T25, T31 |
| FR-65 | §3.11 Background work, API and tools | T32, T43 |
| FR-66 | §3.11 Background work, API and tools | T41 |
| FR-67 | §3.12 Reports | T42 |
| FR-68 | §3.12 Reports | T44 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- `FEATURE_CHAT_RECORD_CARDS`, `FEATURE_CHAT_AGENTS` and `GAUZY_CHAT_AI_ENABLED` stay off by default; enabling them in dev shows each phase end to end.
- Existing task card, send-to-chat, create-from-message, incoming webhook and MCP chat tests pass unchanged.
- Constitution gates in `spec.md` §9 confirmed; every acceptance criterion of `spec.md` §7 demonstrated.
