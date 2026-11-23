# Task Breakdown: Mail

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `mail`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_MAIL_ENABLED` and `FEATURE_MAIL`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it; the Inbox seams are optional
  and change nothing while this plugin is absent.
- Paths: `mail/` = `packages/plugins/mail/src/lib/`, `mailui/` = `packages/plugins/mail-ui/src/lib/`,
  `inbox/` = `packages/plugins/inbox/src/lib/`; a module path without a prefix (`state/…`, `folders/…`) is under `mail/`.
- Plan phase 1 = T1–T13, T33, T34, T40, T55; phase 2 = T14–T30, T35, T36, T49–T54, T56; phase 3 = T31, T32, T37–T39,
  T41; phase 4 = T42–T48. The sections below group tasks by layer, while the order of work follows the plan phase: take
  the tasks of one plan phase in number order before the next phase (phase 1: T1–T13, then T33, T34, T40, T55), since a
  task depends only on tasks of its own or an earlier plan phase; "sequential" applies within that order.
- Depends on, each behind a port with the fallback of plan §7: sending contract and assistant routes
  (`email-and-communications`), scheduling messages and availability (`calendar-and-scheduling`), mail intake record types
  (`helpdesk-tickets`, `crm-leads-and-deals`, `expenses-and-travel`, `invoicing-receivables-payables`), key scopes
  (`access-control-and-security`), contact sync (`integration-hub`), files (`drive`).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/mail.model.ts` (plan §3), the additive Inbox ports (including
  `INBOX_DOMAINS`) and the optional `sent` listener in `inbox-email.model.ts`, `BaseEntityEnum.InboxEmailThread`,
  `RuleOwnerType.MAIL_RULE`, `IMailUiPreferences` in `user.model.ts`; the additive mailbox fields on the sending request of
  `email-and-communications` recorded in its tasks. Test: guard and enum specs.
- [ ] **T2**. Plugin scaffold `packages/plugins/mail` (package, project, tsconfig, jest, eslint), `mail.plugin.ts`,
  `mail-schedule.plugin.ts`, `mail-enabled.ts` (exact `true` and Inbox email loaded), `mail.features.ts` (`FEATURE_MAIL`,
  default off); conditional entries in `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`. Test: plugin lists;
  every route answers `404` with the feature off.
- [ ] **T3**. Entities `mail/entities/` (`mail-folder.entity.ts`, `mail-message-state.entity.ts`,
  `mail-read-mark.entity.ts`, `mail-folder-counter.entity.ts`, `mail-label-scope.entity.ts`,
  `mail-message-label.entity.ts`, `mail-thread-state.entity.ts`, `mail-draft.entity.ts`, `mail-correspondent.entity.ts`)
  and migration `mail/database/migrations/1791000065100-CreateMailClientTables.ts`;
  migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), listed in
  `mail/database/mail-migrations.ts`.
  Test: migration spec on SQLite; PostgreSQL and MySQL in the suite. Migration timestamps: `1791000065100` to `1791000065199` (`packages/plugins/mail`).
- [ ] **T4** (parallel). Entities `mail/entities/mail-rule.entity.ts`, `mail-auto-reply.entity.ts`,
  `mail-auto-reply-sent.entity.ts`, `mail-remote-content-allow.entity.ts` and migration
  `mail/database/migrations/1791000065110-CreateMailAutomationTables.ts`. Test: migration spec.
- [ ] **T5** (parallel). Entities `mail/entities/mail-alias.entity.ts`, `mail-list.entity.ts`,
  `mail-list-member.entity.ts`, `mail-domain.entity.ts`, `mail-domain-report.entity.ts`,
  `mail-domain-report-row.entity.ts`, `mail-mailbox-usage.entity.ts` and migration
  `mail/database/migrations/1791000065120-CreateMailAddressTables.ts`. Test: migration spec.
- [ ] **T6** (parallel). Entities `mail/entities/mail-triage.entity.ts`, `mail-sender-bias.entity.ts` and migration
  `mail/database/migrations/1791000065130-CreateMailTriageTables.ts`. Test:
  migration spec.
- [ ] **T7**. Permissions `mail.permissions.ts` as plugin contributions with `defaultFor` (no seed migration); organization
  settings declared in `mail.settings.ts` (platform settings store, beside the Inbox's own organization setting). Test:
  grants for a new and an existing tenant; declared defaults answered without stored values.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Inbox seams in `packages/plugins/inbox/src/lib/email/`: `INBOX_EMAIL_READER`, `INBOX_MAILBOX_DIRECTORY` (with
  claims from `settings.handoff`), `INBOX_ITEM_STATE` (read, archive, snooze per person), `INBOX_DOMAINS` (domains of the
  organization's mailboxes with their proof state; one proof per organization and domain marking all its mailboxes;
  another tenant's verified domain refused), `sent` hand-off notices and `sentSince` beside `deliveredSince`, both with
  the optional `afterId` keyset cursor (`inbox/email/handoff/inbox-email-handoffs.ts`);
  members on employee mailboxes. Files: `inbox/email/ports/inbox-email-reader.ts`,
  `inbox/email/ports/inbox-mailbox-directory.ts`, `inbox/email/ports/inbox-item-state.ts`,
  `inbox/email/ports/inbox-domains.ts`. Test: existing Inbox
  specs green; access answers match `GET /mailboxes/mine`; a domain verified before stays verified; `sentSince` lists
  outbound `SENT` messages oldest first and `deliveredSince` answers as before without `afterId`; with `afterId` both
  page through 1,200 messages of one `updatedAt` returning each once; `INBOX_EMAIL_READER.messageIds` pages through
  received `PROCESSED` and sent `SENT` messages in id order with no time filter, each once, another tenant's never.
- [ ] **T9** (parallel). Inbox seams consumed: `INBOX_ADDRESS_RESOLVER` in the inbound recipient filter and
  `INBOX_EMAIL_ITEM_POLICY` before item creation, both no-ops when unbound. Files:
  `inbox/email/inbound/inbox-inbound.service.ts`, `mail/aliases/address-resolver.provider.ts`,
  `mail/state/item-policy.provider.ts`. Test: unbound behaviour identical; alias resolves; a mailbox set not to create
  attention entries gets none.
- [ ] **T10**. Arrival pipeline `state/arrival.service.ts` and queue (state rows, system folders, counters, usage, alias
  marks, Junk for suspect verdicts) and `mail.recovery` with `deliveredSince` and `sentSince`; the daily
  `mail.reconcile` pass over `INBOX_EMAIL_READER.messageIds` (`state/mail-reconcile.job.ts`); enable-time backfill of
  received and sent messages. Test: duplicate hand-offs make one row; recovery fills a missed message; a mailbox with
  sent mail from before Mail was enabled lists it in Sent after the backfill, once; a backfill and a recovery run over
  more than 5,000 messages sharing one time list each message once and finish; a message whose `PROCESSED` write
  commits after a later-stamped message, once the cursor has passed it, is recovered by the next run's 15-minute
  lookback, and the reread rows make no second state row; a message committed 20 minutes behind its `updatedAt`, after
  the recovery cursor passed it, and whose hand-off listener failed, is filed by the next `mail.reconcile` pass with one state row, and a second pass adds none; an arrival that fails after its folder step leaves no state row and is filed whole by its retry.
- [ ] **T11**. Lists and conversations `client/*` (keyset pages over state rows, display fields through the reader,
  all inboxes, copies folded by message identity, claimed mailboxes read-only). Test: 1 million state rows page under
  the budget on PostgreSQL; claimed mailbox refuses replies.
- [ ] **T12**. Read state `state/read-state.service.ts`: messages with an Inbox entry read and write their recipient row
  through `INBOX_ITEM_STATE`; `mail_read_mark` only for messages without one; counters follow `inbox_item.state_changed`;
  mark-read delay from `uiPreferences.mail`. Test: a read in either client shows in the other; no `mail_read_mark` row for
  a message with an Inbox entry.
- [ ] **T13**. Basic search: `packages/plugins/search/src/lib/definitions/inbox-email.definition.ts` with the mailbox-access
  predicate, active only for tenants with `FEATURE_MAIL` on, and `/mail/search` with state filters. Test: removed member
  gets no hit; a tenant with the feature off gets the same global search results as before.
- [ ] **T14**. Folders and labels `folders/*`, `labels/*` (nested folders; labels as core tags of the tag type `Mail`,
  personal ones scoped by `mail_label_scope`; one folder per message; deletion moves to Inbox). Test: concurrent moves keep
  the later; an organization mail tag is usable on another record type.
- [ ] **T15**. Message actions `state/actions.service.ts` (read, star, label, move, archive, junk, delete, restore; above
  200 messages a core operation through the bulk executor with progress and cancel). Test: 5,000 messages; second client
  updated.
- [ ] **T16**. Conversation state `shared/*` (snooze through the caller's Inbox recipient rows, mute, assign, states,
  reopen on new message, internal comments on `InboxEmailThread`, assignment notices, `MAIL_THREAD_STATE` as the only
  assignee store). Test: closed conversation reopens; assignee told; a snooze in the client shows in the attention inbox.
- [ ] **T17**. Drafts `drafts/*` as `communication` rows in `DRAFT` with mail's client fields in `mail_draft` (autosave,
  versions, private or shared, devices; browser-only draft without communications) and identities `identities/*`
  (mailboxes, send-as aliases, communications identities, delegate marks). Test: version conflict reported; forbidden
  identity refused; the communications log lists the draft once.
- [ ] **T18**. Sending `send/mail-sender.service.ts` through `MAIL_SENDER` (undo, schedule, delivery states, record links
  of the conversation) with the `INBOX_EMAIL_OUTBOUND` fallback; Scheduled and failed views. Test: both paths; reply
  linked to the conversation's records.
- [ ] **T19**. Recipient suggestions `identities/recipients.service.ts` (colleagues, contacts, people, correspondents)
  and pre-send warnings (missing attachment, outside recipients on an internal thread). Test: suggestion ranking; warnings.
- [ ] **T20**. Aliases and distribution addresses `aliases/*`, `lists/*` (namespace claim, verified domains, posting
  policy, fan-out once per member, daily refusal notice). Test: taken address refused; member gets one copy.
- [ ] **T21**. Rules `rules/*` (conditions saved as core `rule` rows with owner type `MAIL_RULE` and evaluated by the core
  rule evaluator, actions in `rules/actions.ts`, order after sender and intake rules in the arrival queue, stop, hits,
  preview and apply as core operations, outside-forward confirmation and cap). Test: condition and action table; cap
  enforced; a sender rule's block stops mail rules.
- [ ] **T22**. Auto-replies `auto-reply/*` (window, audience, once per sender per interval, automatic-sender guard). Test:
  loop with an automatic sender never answers.
- [ ] **T23**. Sender review `sender-review/*` (queue, allow and decline as `communication_sender_rule` rows of the mailbox,
  wrote-to allow, undo, item policy, the mailbox's `senderAllowlist` listed in the same view; not offered without
  communications) and junk `junk/*` (feedback through sender rules, thresholds, decision log). Test: undo restores folder;
  block writes a sender rule; an allow-listed address shows as allowed.
- [ ] **T24**. Attachments and sources (preview through the documents hub, archive download, save to `drive` or record
  writing `inbox_email_attachment.savedDocumentId`, message file and source download). Files:
  `mail/attachments/attachments.controller.ts`, `mail/attachments/attachment-archive.service.ts`,
  `mail/attachments/attachment-save.service.ts`, `mail/client/message-source.controller.ts`. Test: sources only download with
  `nosniff`; a saved attachment shows its document in the Inbox.
- [ ] **T25**. Remote content proxy `remote-content/*` (signed addresses, guarded fetch, tracking parameters stripped,
  cache, allow list per sender) and its use by the Inbox's `inbox-email-viewer`
  (`packages/plugins/inbox-ui/src/lib/components/inbox-email-viewer/inbox-email-viewer.component.ts`) while the feature
  is on; the allow prompt states that allowing can tell the sender the message was opened, and opened again after the
  24 h cache. Test: internal
  address refused; signature bound to user and message; the prompt shows that notice before any fetch; a message with
  a spoofed sender address (failed domain authentication) from an always-allowed sender loads no image and asks again,
  and offers no "always"; the "always" offer on an authenticated message states that the check proves the domain, not
  the address; the Inbox shows
  proxied images after consent too; with the
  feature off the Inbox viewer offers no consent and renders as before.
- [ ] **T26**. Contacts from messages and invitation banner through `MAIL_CALENDAR` (receive, read event, availability
  strip, answer). Files: `mail/contacts/message-contact.service.ts`, `mail/calendar/invitation.service.ts`,
  `mail/calendar/invitation.controller.ts`. Test: outside invitation answered; older sequence ignored.
- [ ] **T27**. Connected mailbox server sync (folders mapped, moves, flags, deletions through optional provider
  capabilities, undo on refusal). Files: `mail/folders/server-folder-sync.service.ts`,
  `mail/state/server-actions.service.ts`. Test: refused move undone with the reason.
- [ ] **T28**. Push of new mail per mailbox and folder with mute (`mail.new` category, muted folders in
  `uiPreferences.mail`). Files: `mail/notifications/new-mail.notifier.ts`. Test: muted folder sends nothing.
- [ ] **T29**. Outbox events and realtime hints (plan §5). Files: `mail/events/mail.events.ts`,
  `mail/events/mail-realtime.hints.ts`. Test: hints reach mailbox members only.
- [ ] **T30**. Permanent deletion and purge through `INBOX_EMAIL_DELETION` with `MAIL_DELETION_GUARDS`; the purge runs
  only in folders whose retention a manager set. Files: `mail/state/permanent-deletion.service.ts`,
  `mail/schedule/mail-purge.job.ts`. Test: linked message leaves views and stays on its record; Trash and
  Junk of a mailbox without a retention keep every message after 60 simulated days.
- [ ] **T31**. Domains `domains/*` (the organization's mailbox domains with the Inbox's proof through `INBOX_DOMAINS`,
  records for receiving and sending, export, daily re-check) and quotas `quota/*` (use, warnings, receiving above quota).
  Test: second tenant cannot verify a verified domain; a domain verified in the Inbox shows verified.
- [ ] **T32**. Domain reports `reports/*` (reports mailbox, parsers for aggregate authentication and secure-transport
  reports, rows, alerts for unknown or failing sources). Test: sample reports parsed; alert raised once a day.
- [ ] **T51**. Composer attachments (FR-32): uploads, `drive` files, record documents (a record's PDF through its print
  template) and inline images on a draft; above the identity's size limit protected links instead. Files:
  `mail/drafts/draft-attachments.service.ts`, `mail/drafts/drafts.controller.ts`. Test: a `drive` file and a record PDF
  attach to the draft; an attachment over the limit becomes a protected link.
- [ ] **T52**. Saved searches and suggestions (FR-46, FR-47): saved searches as folder-like views, stored as saved views
  of `record-views-and-search` for the record type `MailMessage` through `RECORD_VIEWS_SAVED_VIEWS` (without it, as a
  list in `uiPreferences.mail`), suggestions of people, labels and recent searches while typing, ranking by relevance
  or date with matched words marked. Files: `mail/search/saved-search.service.ts`, `mail/search/saved-search.controller.ts`,
  `mail/search/search-suggestions.service.ts`, `apps/api/src/plugin-composition.ts`. Test: a saved search reopens with its
  filters, with and without `record-views-and-search`; suggestions list only people and labels the user may see;
  matched words are marked in results.
- [ ] **T53**. Content scanning adapters (FR-57): a multi-provider `MAIL_CONTENT_SCANNERS` that plugins answer with spam
  and malware verdicts, consulted in the arrival pipeline and honoured like provider verdicts. Files:
  `mail/junk/content-scanners.registry.ts`, `state/arrival.service.ts`. Test: a fake scanner's spam verdict files the
  message to Junk; with no scanner registered arrival is unchanged.
- [ ] **T55**. GraphQL reads and API conventions (FR-94): `mailMailboxes`, `mailMessages`, `mailConversation`,
  `mailDrafts`; `Idempotency-Key` on creating routes; cursor pagination on lists. Files: `mail/graphql/mail.resolver.ts`,
  `mail/graphql/mail.schema.ts`. Test: resolver specs under mailbox access; a repeated create with the same key returns
  the first result.
- [ ] **T56**. Change history (FR-97): mailbox, alias, list, folder, label, rule, auto-reply, sender review, domain and
  quota changes and permanent deletions written to core `activity_log` with who, when, before and after. Files:
  `mail/audit/mail-change-log.subscriber.ts`. Test: one entry per change with before and after; a permanent deletion
  records the count and the actor.

## Phase 3 — UI surfaces

- [ ] **T33**. `mail-ui` components `mail-list`, `conversation-view` (messages rendered by the Inbox's
  `inbox-email-viewer`), `composer`, `invitation-banner`, `sender-review-queue`, `collision-badge`. Files:
  `mailui/components/mail-list/mail-list.component.ts`, `mailui/components/conversation-view/conversation-view.component.ts`,
  `mailui/components/composer/composer.component.ts`, `mailui/components/invitation-banner/invitation-banner.component.ts`,
  `mailui/components/sender-review-queue/sender-review-queue.component.ts`,
  `mailui/components/collision-badge/collision-badge.component.ts`. Test: component and
  keyboard tests; the same message renders identically in the Inbox and the client.
- [ ] **T34**. `packages/plugins/mail-ui`: client page (tree, list, reading pane layouts, conversations, all inboxes),
  menu entry, guards, shortcuts with help, phone layout; "Open in Mail" in `inbox-ui`. Files: `mailui/mail-ui.plugin.ts`,
  `mailui/pages/mail-client/mail-client-page.component.ts`, `mailui/services/mail-shortcuts.service.ts`,
  `packages/plugins/inbox-ui/src/lib/inbox-ui.plugin.ts`. Test: rendering specs.
- [ ] **T35**. Composer docking and full page, drafts list, Scheduled, labels, folders, bulk bar, snooze, shared views.
  Files: `mailui/services/composer-dock.service.ts`, `mailui/pages/compose/compose-page.component.ts`,
  `mailui/components/bulk-bar/bulk-bar.component.ts`, `mailui/components/shared-views/shared-views.component.ts`. Test:
  rendering specs.
- [ ] **T36**. Mailbox settings (folders, aliases, rules with preview, auto-reply, sender review with the allow list, quota)
  in Settings → Inbox → Mailboxes and My mail settings (`uiPreferences.mail`). Files:
  `mailui/settings/mailbox-settings/mailbox-settings.component.ts`, `mailui/settings/rules-editor/rules-editor.component.ts`,
  `mailui/settings/my-mail-settings/my-mail-settings.component.ts`. Test: rendering specs.
- [ ] **T37**. Settings → Mail (organization switches, domains with records and reports, distribution addresses,
  overview). Files: `mailui/settings/mail-settings/mail-settings.component.ts`,
  `mailui/settings/domains/domains.component.ts`, `mailui/settings/distribution-lists/distribution-lists.component.ts`,
  `mailui/settings/mail-overview/mail-overview.component.ts`. Test: rendering specs.
- [ ] **T38**. i18n keys `MAIL.*` in every locale; auto-reply and reminder templates. Files: `packages/ui-core/i18n/assets/i18n/`. Test: key presence check.
- [ ] **T49**. Print and open in a window (FR-17): print a message or a conversation and open a message in its own
  window. Files: `mailui/components/conversation-view/conversation-print.service.ts`,
  `mailui/pages/message-window/message-window-page.component.ts`. Test: the print view holds every message of the
  conversation; the window shows the single message under the same access.
- [ ] **T50**. Record links on messages (FR-19): the conversation view lists the records a message is linked to
  (ticket, deal, contact, bill) from the communications record links and opens them. Files:
  `mail/client/message-links.service.ts`, `mailui/components/conversation-view/message-links.component.ts`. Test: a
  message linked to a deal shows the deal and opens it; a record the reader may not view is not shown.
- [ ] **T54**. Sender pictures and link warnings (FR-62, FR-63): sender pictures only from the platform's contacts and
  colleagues; a warning before opening a link whose shown text names another address than its target. Files:
  `mail/client/sender-avatar.service.ts`, `mailui/components/conversation-view/link-guard.directive.ts`. Test: an
  outside sender shows initials, not a remote picture; a mismatching link asks before opening.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. Import and export as data-exchange formats `transfer/*` (message file and mailbox archive readers writing
  through `INBOX_EMAIL_IMPORTER`, writers over the reader; duplicates skipped; runs, resume and 7-day links from the
  engine); access information per mailbox; key scopes `mail:read`, `mail:send`. Test: 2 GB archive resumes; duplicates
  counted.
- [ ] **T40**. MCP tools `packages/mcp-server/src/lib/tools/collaboration/mail.ts` behind `GAUZY_MCP_TOOLS_MAIL` with
  scopes; registration with `AiChatToolRegistry`. Test: tools respect mailbox access; drafts never sent.
- [ ] **T41**. Report definitions of spec FR-98 with the read-only fallback viewer; personal data handlers; OpenAPI
  regenerated; SDK regeneration noted; plugin README. Files: `mail/reports/mail-report-definitions.ts`,
  `mail/reports/mail-reports.controller.ts`, `packages/plugins/mail/README.md`, `packages/core/src/lib/bootstrap/swagger.ts`.
  Test: figures on the demo data set.

## Phase 5 — Advanced capabilities

- [ ] **T42**. Triage `triage/*` (heuristics for automatic and list mail, ranking through `MAIL_TEXT_GENERATION`, kinds,
  Important view, corrections into sender bias, excluded mailboxes). Test: correction changes the next ranking; nothing
  sent to the provider with triage off.
- [ ] **T43**. Summaries and suggested replies (communications assistant routes when loaded, drafts marked suggested).
  Files: `mail/triage/conversation-summary.service.ts`, `mail/triage/suggested-replies.service.ts`. Test: suggestions
  saved as drafts only.
- [ ] **T44**. Reminders as platform reminders on the conversation (`reminder`, `recordType = InboxEmailThread`;
  no reply within a time; unanswered after working days), cancelled by mail on reply. Files:
  `mail/shared/conversation-reminders.service.ts`, `mail/schedule/mail-needs-answer.job.ts`. Test: a reply cancels the
  reminder; the reminder shows in the person's reminder list.
- [ ] **T45**. Records from conversations `intake/*` through `MAIL_RECORD_INTAKE` with proposed fields from bodies and
  attachment text (`MAIL_ATTACHMENT_TEXT`), created on confirmation and linked. Test: bill proposal from an invoice file.
- [ ] **T46**. Collision marks (presence of readers and repliers, other members' drafts) and the send-time check. Files:
  `mail/shared/collision.service.ts`, `send/mail-sender.service.ts`. Test:
  reply sent meanwhile shown before sending.
- [ ] **T47**. MCP write tools (label, move, snooze, draft reply, record proposal with preview). Files:
  `packages/mcp-server/src/lib/tools/collaboration/mail.ts`. Test: previews write nothing.
- [ ] **T48**. Demo data: mailboxes with folders, labels, rules, an auto-reply, a shared mailbox with assignments, a
  verified demo domain with sample reports; user docs and `docs/specs/README.md` row; spec status `Implemented` when
  phase 5 lands. Test: demo seed on SQLite.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and existing mail | T2 |
| FR-2 | §3.1 Presence and existing mail | T8, T11 |
| FR-3 | §3.1 Presence and existing mail | T12, T16 |
| FR-4 | §3.1 Presence and existing mail | T8, T11 |
| FR-5 | §3.1 Presence and existing mail | T9, T36 |
| FR-6 | §3.2 Mailboxes and all inboxes | T11 |
| FR-7 | §3.2 Mailboxes and all inboxes | T36 |
| FR-8 | §3.2 Mailboxes and all inboxes | T8, T17 |
| FR-9 | §3.2 Mailboxes and all inboxes | T34 |
| FR-10 | §3.2 Mailboxes and all inboxes | T27 |
| FR-11 | §3.2 Mailboxes and all inboxes | T34 |
| FR-12 | §3.2 Mailboxes and all inboxes | T29 |
| FR-13 | §3.3 Reading and conversations | T11 |
| FR-14 | §3.3 Reading and conversations | T33 |
| FR-15 | §3.3 Reading and conversations | T17, T18, T35 |
| FR-16 | §3.3 Reading and conversations | T12 |
| FR-17 | §3.3 Reading and conversations | T49 |
| FR-18 | §3.3 Reading and conversations | T18 |
| FR-19 | §3.3 Reading and conversations | T50 |
| FR-20–FR-21 | §3.4 Folders, labels and message actions | T14, T15 |
| FR-22 | §3.4 Folders, labels and message actions | T14 |
| FR-23 | §3.4 Folders, labels and message actions | T15 |
| FR-24 | §3.4 Folders, labels and message actions | T16 |
| FR-25–FR-26 | §3.4 Folders, labels and message actions | T30 |
| FR-27 | §3.4 Folders, labels and message actions | T12, T14, T15 |
| FR-28 | §3.4 Folders, labels and message actions | T16 |
| FR-29 | §3.4 Folders, labels and message actions | T28 |
| FR-30 | §3.5 Compose, drafts and sending | T33, T35 |
| FR-31 | §3.5 Compose, drafts and sending | T19 |
| FR-32 | §3.5 Compose, drafts and sending | T51 |
| FR-33 | §3.5 Compose, drafts and sending | T17 |
| FR-34–FR-36 | §3.5 Compose, drafts and sending | T18 |
| FR-37 | §3.5 Compose, drafts and sending | T11, T17 |
| FR-38 | §3.5 Compose, drafts and sending | T19 |
| FR-39 | §3.5 Compose, drafts and sending | T17, T18 |
| FR-40 | §3.6 Identities, aliases, signatures and lists | T17 |
| FR-41 | §3.6 Identities, aliases, signatures and lists | T20, T36 |
| FR-42 | §3.6 Identities, aliases, signatures and lists | T17, T36 |
| FR-43–FR-45 | §3.6 Identities, aliases, signatures and lists | T20 |
| FR-46–FR-47 | §3.7 Search | T13, T52 |
| FR-48 | §3.7 Search | T13 |
| FR-49 | §3.8 Rules, auto-replies, sender review and junk | T21 |
| FR-50 | §3.8 Rules, auto-replies, sender review and junk | T21, T36 |
| FR-51 | §3.8 Rules, auto-replies, sender review and junk | T21 |
| FR-52 | §3.8 Rules, auto-replies, sender review and junk | T22, T36 |
| FR-53 | §3.8 Rules, auto-replies, sender review and junk | T23 |
| FR-54 | §3.8 Rules, auto-replies, sender review and junk | T10, T23 |
| FR-55–FR-56 | §3.8 Rules, auto-replies, sender review and junk | T23, T36 |
| FR-57 | §3.8 Rules, auto-replies, sender review and junk | T53 |
| FR-58 | §3.8 Rules, auto-replies, sender review and junk | T23, T36 |
| FR-59–FR-60 | §3.9 Attachments, remote content and privacy | T24 |
| FR-61 | §3.9 Attachments, remote content and privacy | T25 |
| FR-62–FR-63 | §3.9 Attachments, remote content and privacy | T54 |
| FR-64–FR-67 | §3.10 Contacts and calendar invitations | T26 |
| FR-68–FR-70 | §3.11 Shared mailboxes | T16, T35 |
| FR-71–FR-72 | §3.11 Shared mailboxes | T46 |
| FR-73 | §3.11 Shared mailboxes | T16 |
| FR-74–FR-76 | §3.12 Domains, quotas and deliverability | T31 |
| FR-77–FR-78 | §3.12 Domains, quotas and deliverability | T31, T32 |
| FR-79 | §3.12 Domains, quotas and deliverability | T32 |
| FR-80 | §3.12 Domains, quotas and deliverability | T37, T41 |
| FR-81–FR-82 | §3.13 Import, export, programs and access | T39 |
| FR-83 | §3.13 Import, export, programs and access | T36, T39 |
| FR-84 | §3.13 Import, export, programs and access | T39 |
| FR-85 | §3.13 Import, export, programs and access | T8, T18, T39 |
| FR-86 | §3.14 Triage, nudges and records (advanced) | T42 |
| FR-87–FR-88 | §3.14 Triage, nudges and records (advanced) | T43 |
| FR-89–FR-90 | §3.14 Triage, nudges and records (advanced) | T44 |
| FR-91 | §3.14 Triage, nudges and records (advanced) | T45 |
| FR-92 | §3.14 Triage, nudges and records (advanced) | T40, T47 |
| FR-93 | §3.14 Triage, nudges and records (advanced) | T42 |
| FR-94 | §3.15 API, events, shortcuts and reports | T11, T55 |
| FR-95 | §3.15 API, events, shortcuts and reports | T29 |
| FR-96 | §3.15 API, events, shortcuts and reports | T34 |
| FR-97 | §3.15 API, events, shortcuts and reports | T56 |
| FR-98 | §3.15 API, events, shortcuts and reports | T41 |
| FR-99 | §3.15 API, events, shortcuts and reports | T13, T25 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default off; enabling them in dev shows the client end to end on existing mailboxes; with them off, the Inbox,
  its viewer, its replies, the attention inbox, global search and the communications composer behave as before; no
  message is purged where no retention was set (AC-22).
- Constitution gates in `spec.md` §9 confirmed.
- A helpdesk channel mailbox keeps opening tickets and refuses client replies with the feature on.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
