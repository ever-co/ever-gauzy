# Task Breakdown: Helpdesk tickets

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `helpdesk-tickets`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `hd/` = `packages/plugins/helpdesk/src/lib/`, `ui/` = `packages/plugins/helpdesk-ui/src/lib/`,
  `wg/` = `packages/plugins/helpdesk/widget/`, `ib/` = `packages/plugins/inbox/src/lib/email/`,
  `tk/` = `packages/core/src/lib/tasks/`.
- Gate: every route, GraphQL field, menu entry, public endpoint and MCP tool of these tasks is gated by
  `FEATURE_HELPDESK` (plugin listed only when `GAUZY_HELPDESK_ENABLED` is exactly `true`); assistant and responder
  tasks (T43 to T45) also by `FEATURE_HELPDESK_ASSISTANT`. The core and Inbox seams (T2, T4, T11, T13) carry no gate
  and keep today's behaviour.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/helpdesk.model.ts` (enums, entity interfaces, DTO shapes, events,
      `HelpdeskTicketLifecycle`, ports of plan §3) exported from `index.ts`; `TaskTypeEnum.TICKET` in
      `issue-type.model.ts`; `ITaskStatus` gains `isWaiting`, `isClosed`, `customerLabels`; `IComment` gains `isPinned`,
      `pinnedAt`. Files: `packages/contracts/src/lib/{helpdesk.model.ts,issue-type.model.ts,task-status.model.ts,comment.model.ts}`,
      `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/helpdesk.model.spec.ts` contract shape spec
      (existing values unchanged, only additions).
- [ ] **T2** (parallel). Inbox seams in `packages/contracts/src/lib/inbox-email.model.ts`: `INBOX_EMAIL_OUTBOUND`,
      `IInboxEmailHandoff.automatic`, optional `claimMailbox` / `releaseMailbox`. Files:
      `packages/contracts/src/lib/inbox-email.model.ts`. Test: compile and existing Inbox specs green.
- [ ] **T3**. Plugin scaffold `packages/plugins/helpdesk` (package, project, tsconfig, jest, eslint), `hd/helpdesk-enabled.ts`
      (exactly `true`), feature contributions (`FEATURE_HELPDESK`, `FEATURE_HELPDESK_ASSISTANT`, default off) in
      `hd/helpdesk.plugin.ts`, path mapping, `.env.sample`. Files:
      `packages/plugins/helpdesk/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
      `hd/{helpdesk-enabled.ts,helpdesk.plugin.ts,helpdesk.module.ts,helpdesk.features.ts}`, `tsconfig.json`,
      `.env.sample`. Test: `hd/helpdesk-enabled.spec.ts` flag parsing and `hd/helpdesk.plugin.spec.ts` feature catalogue specs.
- [ ] **T4**. Core: `tk/statuses/status.entity.ts` columns `isWaiting`, `isClosed`, `customerLabels`; `comment.entity.ts`
      columns `isPinned`, `pinnedAt`; core migration `1791000050900-AddHelpdeskTaskColumns`. Plugin:
      migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), template and channel entities and
      `1791000050100-CreateHelpdeskConfigurationTables`. Files: `tk/statuses/status.entity.ts`,
      `packages/core/src/lib/comment/comment.entity.ts`,
      `packages/core/src/lib/database/migrations/1791000050900-AddHelpdeskTaskColumns.ts`,
      `hd/templates/helpdesk-ticket-template.entity.ts`, `hd/channels/helpdesk-channel.entity.ts` with their repositories,
      `hd/database/migrations/{1791000050100-CreateHelpdeskConfigurationTables.ts,index.ts}`. Test:
      `packages/core/src/lib/database/helpdesk-task-columns-migration.spec.ts` and
      `hd/database/create-helpdesk-configuration-tables.migration.spec.ts` on SQLite; dialect branches snapshot; ORM
      parity; existing task status and comment specs green. Migration timestamps: `1791000050100` to `1791000050199` (`packages/plugins/helpdesk`); `1791000050900` to `1791000050999` (`packages/core`).
- [ ] **T5**. Ticket entities and repositories (extension `helpdesk_ticket`, message, draft, read, move) and
      `1791000050110-CreateHelpdeskTicketTables`. Files: `hd/tickets/{helpdesk-ticket.entity.ts,helpdesk-ticket-read.entity.ts}`,
      `hd/conversation/{helpdesk-ticket-message.entity.ts,helpdesk-reply-draft.entity.ts}`, `hd/moves/helpdesk-ticket-move.entity.ts`
      with their repositories, `hd/database/migrations/1791000050110-CreateHelpdeskTicketTables.ts`. Test:
      `hd/database/create-helpdesk-ticket-tables.migration.spec.ts` as T4; one extension per task; unique keys enforced.
- [ ] **T6** (parallel). Saved reply satellite and assistant entities (suggestion, responder limits, assist, widget
      session, channel event), `1791000050120` and `1791000050130`. Files: `hd/saved-replies/helpdesk-saved-reply.entity.ts`,
      `hd/assistant/helpdesk-assistant-suggestion.entity.ts`, `hd/responder/helpdesk-ai-responder.entity.ts`,
      `hd/assists/helpdesk-assist.entity.ts`, `hd/channels/widget/helpdesk-widget-session.entity.ts`,
      `hd/channels/helpdesk-channel-event.entity.ts` with their repositories,
      `hd/database/migrations/{1791000050120-CreateHelpdeskSavedReplyTables.ts,1791000050130-CreateHelpdeskAssistantTables.ts}`.
      Test: `hd/database/create-helpdesk-saved-reply-assistant-tables.migration.spec.ts` as T4.
- [ ] **T7**. Permission contributions with `defaultFor` grants in `hd/helpdesk.plugin.ts` (plan §9) and setting
      contributions in `hd/helpdesk.settings.ts` (plan §3). Files: `hd/{helpdesk.plugin.ts,helpdesk.permissions.ts,helpdesk.settings.ts}`.
      Test: `hd/helpdesk.permissions.spec.ts`: grants present after the contribution reload on a
      seeded tenant; `hd/helpdesk.settings.spec.ts`: settings resolve per organization with their defaults.
- [ ] **T8**. Registration: `apps/api/src/plugins.ts` (`HelpdeskPlugin`), `apps/worker/src/plugins.ts`
      (`HelpdeskSchedulePlugin`). Files: `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`,
      `hd/schedule/helpdesk-schedule.plugin.ts`. Test: plugin list specs with the switch on and off.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. `hd/setup/`: per organization the support project (key `HD`), its issue type "Ticket", task statuses with
      categories and customer labels, task priorities, the default template and channel; further support projects get
      the statuses through the task status bulk copy. Files: `hd/setup/{helpdesk-setup.service.ts,default-statuses.ts,default-priorities.ts}`.
      Test: `hd/setup/helpdesk-setup.service.spec.ts`: idempotent setup; a used status cannot be deleted; references
      read `HD-<number>`.
- [ ] **T10**. `hd/engine/status-rules.ts` (pure) and `hd/tickets/ticket.service.ts`: create the task through
      `TaskCreateCommand` (issue type "Ticket") and the extension in one transaction, update with `version`, reference,
      requester and customer resolution (`OrganizationContact`, `ContactBuyer`), bookkeeping; the lifecycle also runs on
      core `task.updated` for ticket tasks. Files: `hd/engine/status-rules.ts`, `hd/tickets/{ticket.service.ts,requester-resolver.ts,ticket-bookkeeping.ts,task-updated.listener.ts}`.
      Test: `hd/engine/status-rules.spec.ts`: each FR-14 row, including a status changed through the task API;
      `hd/tickets/ticket.service.spec.ts`: requester matching; concurrent update conflict; bookkeeping times.
- [ ] **T11**. `hd/tickets/ticket-visibility.ts` (lifecycle hook, default: holders of view) and the ticket list over the
      task query protocol; core `tk/views/view-filters.ts` gains the filter field `type` and `registerTaskViewFilterFields`
      (helpdesk: requester, customer, channel, template, unread). Files: `hd/tickets/{ticket-visibility.ts,ticket-list.service.ts}`,
      `tk/views/view-filters.ts`. Test: `hd/tickets/ticket-visibility.spec.ts`: another organization's ticket is `404`; hook
      narrows lists and reads; `tk/views/view-filters.contributions.spec.ts`: task views without contributions behave as before.
- [ ] **T12**. `hd/conversation/`: messages with Inbox bodies by reference, uploads as Documents linked through
      `document_link`, Inbox-linked attachments, `CustomerTicketSerializer`. Files:
      `hd/conversation/{conversation.service.ts,attachments.service.ts,customer-ticket.serializer.ts}`. Test:
      `hd/conversation/customer-ticket.serializer.spec.ts`, a contract test that task comments and
      agent-only fields never leave through the serializer; `hd/conversation/conversation.service.spec.ts`: an email
      message stores no body copy once the Inbox holds it; messages ordered oldest or newest first.
- [ ] **T13**. Inbox changes in `ib/`: processor honours `settings.handoff.suppressItems`; `automatic` classification from
      allowlisted headers; `InboxEmailService` implements `INBOX_EMAIL_OUTBOUND` (HTML, attachments, new message). Files:
      `ib/inbound/inbox-email.processor.ts`, `ib/emails/inbox-email.service.ts`, `ib/handoff/`. Test:
      `ib/inbound/inbox-inbound.db.spec.ts` and the `inbox-email` specs extended; behaviour unchanged without a claim and for a claim
      whose `suppressItems` is false (the channel default).
- [ ] **T14**. `hd/channels/email/`: hand-off listener, queue `helpdesk-intake`, matching (threading headers, reference
      token, reply tag, merged chain, former references), automatic-mail filter, bounce marking, recovery sweep. Files:
      `hd/channels/email/{email-handoff.listener.ts,intake.worker.ts,ticket-matcher.ts,automatic-mail.filter.ts,bounce.handler.ts,intake-recovery.job.ts}`.
      Test: `hd/channels/email/intake.db.spec.ts`, SQLite end to end from a stored Inbox message to a ticket task; redelivery creates nothing; out-of-office keeps the
      status; the arrival channel is recorded.
- [ ] **T15**. `hd/conversation/outbound/`: `HELPDESK_MAIL` port, Inbox adapter, queue `helpdesk-outbound` with retries,
      delivery states, acknowledgements per language with the per-address rate. Files:
      `hd/conversation/outbound/{helpdesk-mail.port.ts,inbox-outbound.adapter.ts,outbound.worker.ts,acknowledgement.service.ts}`.
      Test: `hd/conversation/outbound/outbound.worker.spec.ts`: threading headers and token; three
      retries then notice; `acknowledgement.service.spec.ts`: sixth acknowledgement in an hour skipped.
- [ ] **T16**. Controllers and DTOs (`hd/tickets`, `hd/conversation`, `hd/settings`, `hd/templates`, `hd/channels`) and
      GraphQL reads (`hd/graphql/`); statuses and priorities through the existing task routes. Files:
      `hd/tickets/{tickets.controller.ts,dto/}`, `hd/conversation/{conversation.controller.ts,dto/}`,
      `hd/settings/helpdesk-settings.controller.ts`, `hd/templates/templates.controller.ts`, `hd/channels/channels.controller.ts`,
      `hd/graphql/{schema-extensions.ts,resolvers/helpdesk-ticket.resolver.ts}`. Test: `hd/tickets/tickets.controller.spec.ts`
      e2e for create, read (also by a former reference), update, reply, trash, settings; `404` with the feature off.
- [ ] **T17**. Internal comments as core `Comment` rows on the ticket's task, mention warning, pins through
      `comment.isPinned` (limit 5). Files: `hd/conversation/{internal-comments.service.ts,pins.controller.ts}`. Test:
      `hd/conversation/internal-comments.service.spec.ts`: sixth pin refused; mention of a non-reader warns; the comment shows on the task.
- [ ] **T18** (parallel). `hd/saved-replies/`: satellite CRUD with scopes over `email_template` rows of record type
      `helpdesk.ticket` (one per language), insert into a draft. Files: `hd/saved-replies/{saved-reply.service.ts,saved-reply.controller.ts,dto/}`.
      Test: `hd/saved-replies/saved-reply.service.spec.ts`: scope visibility per team; one template row per language.
- [ ] **T19**. `hd/events/`: outbox events `helpdesk.*`, `declareStreamedEvents`, `restrictAudience` check, notification
      categories with fallbacks. Files: `hd/events/{helpdesk.events.ts,helpdesk.streamed-events.ts,helpdesk.notification-categories.ts,index.ts}`.
      Test: `hd/events/helpdesk.events.spec.ts`: event per change, ids only; audience excludes non-readers; agents notified per category.

## Phase 3 — UI surfaces

- [ ] **T20**. `packages/plugins/helpdesk-ui` scaffold, menu, routes; workspace with the shipped ticket views through the
      task view sidebar and the task list and board components, filtered to the issue type, and a plain list fallback.
      Files: `packages/plugins/helpdesk-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
      `ui/{helpdesk-ui.plugin.ts,helpdesk-ui.routes.ts,workspace/helpdesk-workspace.component.ts,workspace/shipped-views.ts}`.
      Test: `ui/workspace/helpdesk-workspace.component.spec.ts` rendering of the shipped views; plain list when saved views are off; hidden on `404`.
- [ ] **T21**. Ticket page `ui/ticket/`: header with inline subject, conversation, composer (reply and comment), requester
      panel, task properties, tags, followers; the existing task page shows a "Conversation" link for ticket tasks. Files:
      `ui/ticket/{ticket-page.component.ts,conversation.component.ts,composer.component.ts,requester-panel.component.ts,ticket-sidebar.component.ts}`,
      `apps/gauzy/src/app/pages/tasks/components/` (the "Conversation" link). Test: `ui/ticket/ticket-page.component.spec.ts` rendering and
      composer submit; breadcrumbs, next and previous ticket.
- [ ] **T22**. Settings pages `ui/settings/`: general (setting contributions), statuses and priorities through the existing
      task settings components scoped to the support project, templates, email channels, replies and notices, workflow,
      with unsaved-change guard. Files: `ui/settings/{general-settings.component.ts,statuses-priorities.component.ts,templates-settings.component.ts,channels-settings.component.ts,replies-notices.component.ts,workflow-settings.component.ts,unsaved-changes.guard.ts}`.
      Test: `ui/settings/general-settings.component.spec.ts` rendering; `ui/settings/unsaved-changes.guard.spec.ts` guard prompts.
- [ ] **T23** (parallel). Task screens: contract test over the core task API that ticket tasks list, open, change status
      and take time like any task, carry no customer field without `HELPDESK_TICKET_VIEW`, and run the status rules on a
      change made there (every task client uses that API unchanged). Files: `hd/testing/task-api.contract.spec.ts`. Test: e2e over the task API.
- [ ] **T24**. `HELPDESK.*` keys in every locale of `packages/ui-core/i18n`; keyboard operation and a live region for new
      messages. Files: `packages/ui-core/i18n/assets/i18n/*.json`, `ui/ticket/conversation.component.ts`. Test: i18n key check; accessibility lint.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T25**. MCP `packages/mcp-server/src/lib/tools/helpdesk.ts`: `helpdesk_tickets_list`, `helpdesk_ticket_get`,
      `helpdesk_saved_replies_search`; `register-all-tools.ts`. Files: `packages/mcp-server/src/lib/tools/helpdesk.ts`,
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: `packages/mcp-server/src/lib/tools/helpdesk.spec.ts` tool specs with permissions.
- [ ] **T26**. `apps/api/src/plugin-composition.ts`: `HELPDESK_MAIL` (Inbox adapter), the ticket registered as a kind of
      task for record views. Files: `apps/api/src/plugin-composition.ts`, `hd/record-views/ticket-record-kind.ts`. Test:
      `hd/record-views/ticket-record-kind.spec.ts` binding specs; unbound ports leave the capability absent.
- [ ] **T27**. OpenAPI regenerated; SDK regeneration noted; docs site pages; `docs/specs/README.md` row. Files:
      `packages/core/src/lib/bootstrap/swagger.ts`, `docs/specs/README.md`. Test: OpenAPI
      diff additive only.

## Phase 5 — Depth (plan phase 2)

- [ ] **T28**. Templates as kinds of request with custom-field layouts and field rules; customer write guard
      `HELPDESK_FIELD_CLOSED`. Files: `hd/templates/{template.service.ts,template-fields.ts,customer-write.guard.ts}`. Test:
      `hd/templates/customer-write.guard.spec.ts`: dependent options; closed field refused naming it.
- [ ] **T29**. Web form channel `hd/channels/web-form/` and `hd/public/`: form schema, submission endpoint posted to by
      `lead-capture-and-enrichment` hosted and embedded forms and by sites, `PUBLIC_FORM_DEFENCE` binding, origin
      allowlist, confirmation, arrival facts. Files: `hd/channels/web-form/web-form.service.ts`,
      `hd/public/{public-form.controller.ts,origin-allowlist.ts}`. Test: `hd/public/public-form.controller.spec.ts`: limits refuse without a ticket; without lead capture the endpoint
      still takes submissions under its own throttles; page, article, search text and campaign recorded.
- [ ] **T30**. API channel (scoped tenant API keys) and port `HELPDESK_TICKETS` for the portal. Files:
      `hd/channels/api/api-channel.service.ts`, `hd/tickets/helpdesk-tickets.port.ts`. Test:
      `hd/tickets/helpdesk-tickets.port.spec.ts`: portal calls see only customer fields.
- [ ] **T31**. Replies depth: schedule, cancel, record-only, retry; notices to web form, portal and widget requesters;
      signatures from `communication_signature` (channel footer without it); customer language. Files:
      `hd/conversation/{reply.service.ts,requester-notices.service.ts,signature.resolver.ts,customer-language.ts}`. Test:
      `hd/conversation/reply.service.spec.ts`: scheduled reply leaves once; `customer-language.spec.ts`: language fallback order.
- [ ] **T32**. Saved replies: placeholders validated against the template variables, action chips applied on send,
      ranking with use counted from sent messages per agent and team, bulk reply ≤ 500. Files:
      `hd/saved-replies/{placeholders.ts,saved-reply-actions.ts,saved-reply-ranking.ts,bulk-reply.service.ts}`. Test:
      `hd/saved-replies/placeholders.spec.ts`: unknown placeholder refused; `bulk-reply.service.spec.ts`: per-ticket results.
- [ ] **T33**. `hd/moves/`: merge and split as task operations in one transaction with the move log: sources closed,
      linked as duplicates (`task_linked_issues`) with `mergedIntoTaskId`; split creates a task through `TaskCreateCommand`
      linked as related with `splitFromTaskId`; messages, comments, document and record links moved, tags and followers
      united; merged chain in intake. Files: `hd/moves/{merge.service.ts,split.service.ts,moves.controller.ts}`. Test:
      `hd/moves/merge.service.spec.ts`: times kept; cycle and merged target refused; mail to a merged ticket reaches
      the final target; `split.service.spec.ts`.
- [ ] **T34** (parallel). Tasks from tickets through `TaskCreateCommand`, linked as blocking the ticket; done-task notice
      and optional status move. Files: `hd/tickets/ticket-tasks.service.ts`. Test: `hd/tickets/ticket-tasks.service.spec.ts`: link both ways; notice on done.
- [ ] **T35**. Reactions (setting), automatic followers as task subscribers, timeline contribution through
      `RECORD_TIMELINE_SOURCES`. Files: `hd/conversation/reactions.service.ts`, `hd/tickets/followers.service.ts`,
      `hd/record-views/ticket-timeline.source.ts`. Test: `hd/record-views/ticket-timeline.source.spec.ts`: timeline kinds and filters; reactions notify without email.
- [ ] **T36**. Bulk actions through the core bulk executor (`202` with an operation above 500), palette providers and
      shortcuts, seen and unread (recent items in `employee_recent_visit`). Files: `hd/bulk/helpdesk-bulk.service.ts`,
      `hd/tickets/ticket-read.service.ts`, `ui/palette/helpdesk-palette.providers.ts`. Test:
      `hd/bulk/helpdesk-bulk.service.spec.ts`: 700-ticket bulk as an operation with
      per-ticket results; `hd/tickets/ticket-read.service.spec.ts`: unread flag clears on open.
- [ ] **T37** (parallel). Search definitions `helpdesk-ticket` and `helpdesk-message` (quoted text stripped, comments for
      agents only) and `/pages/helpdesk/search`. Files: `hd/search/{helpdesk-ticket.search-definition.ts,helpdesk-message.search-definition.ts}`,
      `ui/search/helpdesk-search-page.component.ts`. Test: `hd/search/helpdesk-ticket.search-definition.spec.ts`: unreadable tickets absent; reference search exact.
- [ ] **T38**. Live updates and presence on the ticket page (record signal states `viewing`, `replying`), server drafts
      every 5 s. Files: `ui/ticket/ticket-live.service.ts`, `hd/conversation/drafts.service.ts`. Test:
      `ui/ticket/ticket-live.service.spec.ts`: two clients see each other; `hd/conversation/drafts.service.spec.ts`: draft restored on another device.
- [ ] **T39** (parallel). Jobs: auto-close and reminder, scheduled replies, maintenance (ticket trash period
      `helpdesk.trashPurgeDays`). Files: `hd/schedule/{auto-close.job.ts,scheduled-replies.job.ts,maintenance.job.ts}`. Test:
      `hd/schedule/auto-close.job.spec.ts`: close comment written; reminder before closing; `maintenance.job.spec.ts`: a trashed ticket past the period is purged; a trashed task
      of another issue type is kept.
- [ ] **T40**. Setup assistant, gap notices, phone layouts, contact page tickets list, Inbox viewer "Create ticket",
      call and chat message actions. Files: `ui/setup/{setup-assistant.component.ts,gap-notices.component.ts}`,
      `ui/contact/contact-tickets.component.ts`, `ui/actions/{inbox-create-ticket.action.ts,call-ticket.action.ts,chat-message-ticket.action.ts}`,
      `hd/setup/gap-notices.service.ts`. Test: `ui/setup/setup-assistant.component.spec.ts` rendering; Inbox email becomes a ticket with its attachments by reference.
- [ ] **T41**. Automation triggers and actions declarations; MCP write tools (create, update, reply draft and send, merge
      and split with preview). Files: `hd/automation/helpdesk-automation.declarations.ts`,
      `packages/mcp-server/src/lib/tools/helpdesk.ts`. Test: `hd/automation/helpdesk-automation.declarations.spec.ts` trial run of a flow on a ticket; tool previews write nothing.
- [ ] **T53**. Ticket links through the core task links (`task_linked_issues`, FR-47): link panel on the ticket page for
      relates to, duplicates (optionally closing the duplicate with a notice to its requester), blocks, is blocked by and
      clones, shown on both tickets and on linked tasks. Files: `hd/tickets/ticket-links.service.ts`,
      `ui/ticket/ticket-links.component.ts`. Test: `hd/tickets/ticket-links.service.spec.ts`: a duplicate link closes the
      duplicate and tells its requester when chosen; the link shows on both sides.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T42**. Time and cost `hd/time/`: time panel and cost from the ticket task's time logs (`HELPDESK_COST_VIEW`), the
      customer as time log client, invoice line with the reference, merged roll-up through duplicate links. Files:
      `hd/time/{ticket-time.service.ts,ticket-cost.service.ts}`, `ui/ticket/time-panel.component.ts`. Test:
      `hd/time/ticket-time.service.spec.ts`: time started from the core timer on the ticket reaches the timesheet with the customer; cost hidden without the
      permission.
- [ ] **T43**. Assistant `hd/assistant/`: `HELPDESK_ASSISTANT` and `HELPDESK_KNOWLEDGE` bindings, draft with sources and
      masking, summary, translation, decisions; runs of the purpose `helpdesk.assistant` with `ai_usage_entry` and its
      `ai_budget`. Files: `hd/assistant/{assistant.service.ts,assistant.controller.ts,masking.ts}`, `ui/ticket/assistant-panel.component.ts`.
      Test: `hd/assistant/masking.spec.ts`: masking of another customer's data; `assistant.service.spec.ts`: budget refusal.
- [ ] **T44** (parallel). Classification and duplicate proposals on arrival (queue `helpdesk.assistant`). Files: `hd/assistant/{classification.worker.ts,duplicates.ts}`.
      Test: `hd/assistant/classification.worker.spec.ts`: nothing applied without a decision.
- [ ] **T45**. AI responders `hd/responder/`: helpdesk limits on an `ai_agent` acting as its agent employee, decisions as
      `ai_run` rows keyed per message, threshold, limits, forbidden topics, hand-over, pause and pause-all. Files:
      `hd/responder/{responder.service.ts,responder.controller.ts,responder.worker.ts,hand-over.ts}`. Test:
      `hd/responder/responder.service.spec.ts`: each hand-over condition; draft-only mode never sends.
- [ ] **T46**. Collision prompt (`HELPDESK_REPLY_STALE` with the items since) and reply lock. Files: `hd/conversation/reply-collision.ts`,
      `ui/ticket/collision-prompt.component.ts`. Test: `hd/conversation/reply-collision.spec.ts`: send after a new
      customer message is refused until confirmed.
- [ ] **T47** (parallel). Assists through `HELPDESK_CHAT` (colleagues asked to assist on a ticket): linked private conversation, 7-day read access, summary to
      approve; ticket card (with `FEATURE_CHAT_RECORD_CARDS` on; the task card as today without it) and join in chat
      from a ticket reference. Files: `hd/assists/{assist.service.ts,assist.controller.ts}`. Test:
      `hd/assists/assist.service.spec.ts`: access expires; summary only after approval.
- [ ] **T48**. Related records through the record links of `record-views-and-search` and plugin actions; serial number
      lookup. Files: `hd/related/{related-records.service.ts,record-actions.service.ts,serial-lookup.ts}`. Test:
      `hd/related/related-records.service.spec.ts`: picker limited to the customer; record timeline lists the ticket.
- [ ] **T49**. Approval templates through `HELPDESK_APPROVALS`; parent tickets over `task.parentId` with one reply to
      children; undo of moves within 24 hours; task board layout. Files: `hd/templates/template-approval.service.ts`,
      `hd/tickets/parent-tickets.service.ts`, `hd/moves/undo.service.ts`, `ui/workspace/ticket-board.component.ts`. Test:
      `hd/templates/template-approval.service.spec.ts`: approval outcome moves the ticket; `hd/moves/undo.service.spec.ts`: undo refused
      after a new public message; a board move applies the status rules.
- [ ] **T50**. Chat widget: public conversation routes, hashed session tokens, long-poll, `wg/` script, email
      continuation. Files: `wg/{src/widget.ts,build.config.ts}`, `hd/channels/widget/{widget-conversation.controller.ts,widget-session.service.ts}`.
      Test: `hd/channels/widget/widget-conversation.controller.spec.ts`: visitor and agent exchange messages; session expiry.
- [ ] **T51**. Messaging channel through `HELPDESK_MESSAGING`; one-conversation reply routing to the last channel. Files:
      `hd/channels/messaging/{messaging-channel.service.ts,reply-routing.ts}`. Test:
      `hd/channels/messaging/messaging-channel.service.spec.ts`: number match joins the open ticket within 7 days; a reply goes to the last channel.
- [ ] **T52**. Benchmarks: five million tickets for the list, intake throughput, 500-ticket bulk, conversation paging.
      Files: `hd/benchmarks/{ticket-list.bench.ts,intake.bench.ts,bulk.bench.ts,conversation.bench.ts}`. Test: budgets of spec §4 met on PostgreSQL and MySQL.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T3, T16 |
| FR-2 | §3.1 Scope, flags and compatibility | T9, T10 |
| FR-3 | §3.1 Scope, flags and compatibility | T1, T4 |
| FR-4 | §3.2 Tickets | T1, T5, T9, T10 |
| FR-5 | §3.2 Tickets | T9, T16, T37 |
| FR-6 | §3.2 Tickets | T10 |
| FR-7 | §3.2 Tickets | T10, T16, T21 |
| FR-8 | §3.2 Tickets | T16, T23 |
| FR-9 | §3.2 Tickets | T10 |
| FR-10 | §3.2 Tickets | T14, T29 |
| FR-11 | §3.2 Tickets | T16, T39 |
| FR-12 | §3.2 Tickets | T21 |
| FR-13 | §3.3 Statuses, priorities, kinds of request and templates | T9, T22 |
| FR-14 | §3.3 Statuses, priorities, kinds of request and templates | T10 |
| FR-15 | §3.3 Statuses, priorities, kinds of request and templates | T39 |
| FR-16 | §3.3 Statuses, priorities, kinds of request and templates | T9, T16, T22 |
| FR-17 | §3.3 Statuses, priorities, kinds of request and templates | T49 |
| FR-18–FR-19 | §3.3 Statuses, priorities, kinds of request and templates | T28 |
| FR-20 | §3.4 Channels | T16, T22 |
| FR-21 | §3.4 Channels | T13, T14 |
| FR-22 | §3.4 Channels | T14 |
| FR-23 | §3.4 Channels | T12, T40 |
| FR-24 | §3.4 Channels | T29, T30 |
| FR-25 | §3.4 Channels | T50 |
| FR-26–FR-27 | §3.4 Channels | T51 |
| FR-28 | §3.4 Channels | T40 |
| FR-29 | §3.5 Conversation, replies and notices | T15, T16, T31 |
| FR-30 | §3.5 Conversation, replies and notices | T13, T15 |
| FR-31 | §3.5 Conversation, replies and notices | T31 |
| FR-32 | §3.5 Conversation, replies and notices | T15 |
| FR-33 | §3.5 Conversation, replies and notices | T31 |
| FR-34 | §3.5 Conversation, replies and notices | T19 |
| FR-35 | §3.5 Conversation, replies and notices | T12, T21 |
| FR-36 | §3.6 Internal collaboration | T17 |
| FR-37 | §3.6 Internal collaboration | T17, T35 |
| FR-38 | §3.6 Internal collaboration | T47 |
| FR-39 | §3.6 Internal collaboration | T21, T35 |
| FR-40 | §3.7 Saved replies | T18, T32 |
| FR-41–FR-43 | §3.7 Saved replies | T32 |
| FR-44–FR-45 | §3.8 Merge, split, links, tasks and related records | T33 |
| FR-46 | §3.8 Merge, split, links, tasks and related records | T49 |
| FR-47 | §3.8 Merge, split, links, tasks and related records | T53 |
| FR-48 | §3.8 Merge, split, links, tasks and related records | T49 |
| FR-49 | §3.8 Merge, split, links, tasks and related records | T34 |
| FR-50–FR-51 | §3.8 Merge, split, links, tasks and related records | T48 |
| FR-52 | §3.9 Lists, views, search, bulk work and keyboard | T11, T20 |
| FR-53 | §3.9 Lists, views, search, bulk work and keyboard | T20 |
| FR-54 | §3.9 Lists, views, search, bulk work and keyboard | T20, T49 |
| FR-55 | §3.9 Lists, views, search, bulk work and keyboard | T37 |
| FR-56–FR-58 | §3.9 Lists, views, search, bulk work and keyboard | T36 |
| FR-59 | §3.10 Real time, presence and collisions | T19, T38 |
| FR-60 | §3.10 Real time, presence and collisions | T38 |
| FR-61 | §3.10 Real time, presence and collisions | T46 |
| FR-62–FR-64 | §3.11 Time and cost | T42 |
| FR-65 | §3.12 Assistants and AI responder | T43 |
| FR-66 | §3.12 Assistants and AI responder | T44 |
| FR-67–FR-68 | §3.12 Assistants and AI responder | T43 |
| FR-69–FR-71 | §3.12 Assistants and AI responder | T45 |
| FR-72 | §3.13 Settings, setup and layouts | T22 |
| FR-73 | §3.13 Settings, setup and layouts | T9, T40 |
| FR-74 | §3.13 Settings, setup and layouts | T21, T40 |
| FR-75 | §3.13 Settings, setup and layouts | T21, T40 |
| FR-76 | §3.14 API, MCP, events and extension | T16, T19 |
| FR-77 | §3.14 API, MCP, events and extension | T26, T41 |
| FR-78 | §3.14 API, MCP, events and extension | T25, T41 |
| FR-79 | §3.14 API, MCP, events and extension | T30 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- No customer-facing surface (emails, portal port, widget, public routes) carries a task comment or agent-only field
  (contract test green).
- Inbox behaviour unchanged for mailboxes no channel claims, and tasks of other issue types unchanged (existing Inbox
  and task suites green).
- Every `(advanced)` requirement has its acceptance criterion passing.
