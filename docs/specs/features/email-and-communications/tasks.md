# Task Breakdown: Email and communications

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `email-and-communications`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_COMMUNICATIONS_ENABLED` and `FEATURE_COMMUNICATIONS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `com/` = `packages/plugins/communications/src/lib/`, `inbox/` = `packages/plugins/inbox/src/lib/`,
  `core/` = `packages/core/src/lib/`, `comui/` = `packages/plugins/communications-ui/src/lib/`, `inboxui/` =
  `packages/plugins/inbox-ui/src/lib/`, `imap/` = `packages/plugins/email-provider-imap/src/lib/`, `shared/` =
  `packages/ui-core/shared/src/lib/communications/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/communications.model.ts` (enums, entity interfaces, `IMessageSender`,
      `IMailIntakeDeclaration`, `ITextAdapter`, `IPushAdapter`, port tokens, event payloads); export from
      `packages/contracts/src/index.ts`.
      Test: type-level spec compiling a fake sender, intake and adapters.
- [ ] **T2**. Plugin scaffold `packages/plugins/communications` (`package.json`, `project.json`, `tsconfig.json`,
      `jest.config.ts`, `src/index.ts`, `com/communications.plugin.ts`, `com/communications.module.ts`,
      `com/communications-enabled.ts` exact `true`); `PluginContributions` on `@GauzyCorePlugin`: `com/communications.features.ts`
      (`FEATURE_COMMUNICATIONS`), `com/communications.permissions.ts` (with `defaultFor`), `com/communications.settings.ts`, mail
      intakes; listed in `apps/api/src/plugins.ts`; `.env.sample`. Test: flag spec; with the switch off the API's plugin,
      entity and migration lists equal today's; the feature is registered disabled by the feature registry. Migration timestamps: `1791000033100` to `1791000033199` (`packages/plugins/communications`); `1791000033200` to `1791000033299` (`packages/core`); `1791000033300` to `1791000033399` (`packages/plugins/email-provider-imap`); `1791000033400` to `1791000033499` (`packages/plugins/inbox`).
- [ ] **T3**. Entities `com/entities/` (tables of plan §3.1: `communication-identity.entity.ts`,
      `communication-signature.entity.ts`, `communication.entity.ts`, `communication-recipient.entity.ts`,
      `communication-link-state.entity.ts`, `communication-event.entity.ts`, `communication-intake-rule.entity.ts`,
      `communication-sender-rule.entity.ts`, `communication-suppression.entity.ts`, `communication-consent.entity.ts`,
      `communication-bulk-send.entity.ts`, `communication-identity-health.entity.ts`,
      `communication-thread-summary.entity.ts`) with MikroORM repositories in `com/repositories/`. Test: metadata spec, both ORMs.
- [ ] **T4**. Migrations 033100–033130 on the shared core migration helpers of `procurement` T4 (`@gauzy/core`) (no provider account or device table):
      `com/database/migrations/1791000033100-CreateCommunicationCoreTables.ts`,
      `1791000033110-CreateCommunicationIntakeAndSuppressionTables.ts`, `1791000033120-CreateCommunicationBulkTables.ts`,
      `1791000033130-CreateCommunicationHealthTables.ts`, listed in `com/database/communications-migrations.ts`.
      Test: SQLite run, rerun no-op, uniqueness assertions (`idempotencyKey`, `trackingToken`, suppression key, event key).
- [ ] **T5** (parallel). Core migration `core/database/migrations/1791000033200-AddCommunicationColumnsToEmailTemplateAndHistory.ts`
      and entity columns on `core/email-template/email-template.entity.ts` and
      `core/email-history/email-history.entity.ts`; Inbox migration
      `inbox/database/migrations/1791000033400-AddChannelsAndMobileDevicesToInbox.ts` (`inbox_provider_account.channels` with a `hasColumn` guard, mobile
      device columns on `inbox_push_subscription`). Test: system templates read unchanged; existing template and Inbox
      specs pass.
- [ ] **T6** (parallel). Default grants through `defaultFor` on the permission contributions; no seed migration and no
      feature row insert. Files: `com/communications.permissions.ts`. Test: default-role snapshot on a new tenant and after the permission reload.

## Phase 2 — Surface and unify what exists

- [ ] **T7**. Sending identities `com/identity/` (`communication-identity.service.ts`, `communication-identity.controller.ts`,
      `identity-resolver.ts`: resolution order purpose → record type → default,
      test send through `EmailSendService`, personal identities and delegates). Test: resolution matrix; failing transport
      refused with the error.
- [ ] **T8**. Accounts overview `com/accounts/accounts.query.ts` over custom SMTP, `inbox_provider_account` of every
      channel and mailboxes; identities over an account or mailbox read its `status`, `lastVerifiedAt` and `lastError`.
      Test: scope (tenant vs organization) and no secret in the answer; an identity shows its account's error.
- [ ] **T9**. Template service `com/templates/` (`communication-template.service.ts`, `communication-template.controller.ts`,
      `token-catalogue.ts`: user templates on `email_template`, sharing, token catalogue from the
      record type registry and custom fields, validation, preview against a record) and signatures `com/signatures/`
      (`communication-signature.service.ts`, `communication-signature.controller.ts`: several per person, a default per
      identity, the organization block placed under personal ones). Test: unknown token refused; language
      fallback; system templates untouched; the organization block renders under the person's default signature.
- [ ] **T10**. `com/send/communication-send.service.ts` (`IMessageSender`): recipients from refs, identity, render, footer
      wrap, attachments (files; print through `COMMUNICATIONS_PRINT`), undo hold, schedule, idempotency, record links;
      the `email_sent` row written with `communicationId` and without `content`; mailbox sends referenced through
      `inboxEmailId` with no copy; one `AUDIT_EVENT_SINK` event per communication; the email history's view and resend
      read the body through `communicationId`; a separate-messages send creates one communication per recipient under
      one `sendGroupId`; sensitive templates sent inside the call (plan §2). Test: idempotent send; undo window; a
      sensitive template stores no body at any time, also when its first attempt fails and the call retries, and its
      schedule or undo hold is refused with `COMMUNICATION_SENSITIVE_IMMEDIATE`; one body stored per email; one email to
      a To and a Cc recipient keeps one communication and one rendering, a separate send to Alice and Bob in two
      languages keeps two communications of one group, each with the body that person received, and the call answers
      both ids; invoice emails and reminders logged, not resent; the history resends such a row with its body.
- [ ] **T11**. Queue worker `com/send/communication-send.worker.ts` and `communications.queue.tick`
      (`com/schedule/communications-queue-tick.scheduler.ts`):
      priority order, leases, retry with back-off, per-recipient `acceptedAt`, stuck recovery, suspend and resume. Test:
      crash after accept never resends; a crash after the transport accepted and before `acceptedAt` was saved sends
      once more with the same `messageKey` on a transport declaring `idempotentSend` (one delivery), and marks the
      recipient `UNCERTAIN` without a resend on a plain mail server; retry ladder; in-process fallback on SQLite.
- [ ] **T12**. Messages controller `com/messages/` (`communication-message.controller.ts`, `dto/`: compose, `preview`, list by record, detail, scheduled mine, cancel,
      retry) with GraphQL reads (`com/graphql/communications.resolver.ts`). Test: e2e send from a record; `403` without view of the record; `404` with the feature off.
- [ ] **T13**. Record links and read rule `com/links/` (`communication-links.service.ts`, `communication-read.policy.ts`): links on send and filing as core `resource_link` rows
      (`entity = Communication`, record target, `role` `PRIMARY` / `RELATED`, `linkedBy` `PERSON` / `MATCH` / `SYSTEM` /
      `INTAKE`) through `ResourceLinkService` of `record-views-and-search`, the answer state per link in
      `communication_link_state`, read through linked records.
      Test: a person who is neither author nor recipient and has no access to any linked record cannot read the
      message; its author and each of its recipients (by user or employee) can read it without access to a linked
      record (FR-49).
- [ ] **T14**. Hand-off listener `com/inbound/communications-handoff.listener.ts` and matcher `com/inbound/matcher.ts`
      (reference token, thread, address to contact, people and vendors, record numbers; reason and confidence). Test:
      matcher fixtures; ambiguous match goes to "to file".
- [ ] **T15**. Intake rules `com/intake/` (`intake-rule.service.ts`, `intake-rule.controller.ts`, `acknowledgement.ts`: mail intakes from the `communications` contributions member, conditions as core
      `rule` rows of owner type `COMMUNICATION_INTAKE` evaluated by `rule.evaluator.ts`, create through the owner,
      acknowledgement with loop guards, contact creation option). Test: one record per thread; no reply to automatic
      senders; acknowledgement rate limit; no contact created for an address on the organization's own domains.
- [ ] **T16**. Inbox seams (additive) `inbox/email/inbound/inbox-email.processor.ts` (`INBOX_EMAIL_SENDER_POLICY`),
      `inbox/email/emails/inbox-email.service.ts` (`INBOX_EMAIL_OUTBOUND`, HTML and attachments on reply), sender rules
      `com/intake/sender-rule.service.ts` with `senderAllowlist` entries taken over as `ALLOW` rows and written back in
      step, precedence mailbox before organization and block before quarantine before allow, allow rules admitting only
      their senders as the allow list does. Test: Inbox specs unchanged with the ports unbound, and with them bound for a
      tenant with the feature off; block and quarantine rules; an allow rule edited here shows in `senderAllowlist`; a
      sender missing from the allow rules is still not admitted.
- [ ] **T17**. Port bindings in `apps/api/src/plugin-composition.ts`: `MESSAGE_SENDER`, `AUTOMATION_COMMUNICATIONS`,
      `PRINT_SENDER`, `REPORT_EMAIL`, `HELPDESK_MAIL`, `HELPDESK_MESSAGING`, `ACCESS_TEXT_CHANNEL`,
      `NOTIFICATION_TEXT_TRANSPORT`. Test: composition spec resolves each token when the plugin is loaded, none when off.
- [ ] **T18**. Timeline source `com/timeline/communication-timeline.source.ts` for `RECORD_TIMELINE_SOURCES` and search
      index definitions (`com/timeline/communication-search.definition.ts`). Test: entries filtered by channel and viewer.
- [ ] **T19**. Events `com/events/` (`communications.events.ts`: outbox appends in the writing transaction;
      `communications-realtime.ts`: real-time catalogue entries). Test: one
      event per transition; ids only.
- [ ] **T20**. Angular `packages/plugins/communications-ui` (`comui/communications-ui.plugin.ts`,
      `comui/communications.routes.ts`, `comui/pages/settings/communications-settings-page.component.ts` with tabs in
      `comui/pages/settings/`): Settings → Communications (accounts, identities, templates,
      signatures, intake and sender rules, queue); registered in `apps/gauzy/src/plugin-ui.config.ts`; i18n keys in every
      locale. Test: rendering tests; hidden on `404`.
- [ ] **T21** (parallel). Embeddables `packages/ui-core/shared/src/lib/communications/` (`ngx-record-composer` in
      `shared/record-composer.component.ts` with email and text tabs and the part counter,
      `ngx-record-communications` in `shared/record-communications.component.ts`) placed on contacts, deals, invoices, estimates, orders and employees. Test: composer
      keyboard flow; undo toast.
- [ ] **T22** (parallel). `inbox-ui` additions: record chips, "to file" tab, assign, create record. Files:
      `inboxui/components/inbox-page/inbox-page.component.ts`, `inboxui/components/inbox-email-viewer/inbox-email-viewer.component.ts`,
      `inboxui/services/inbox-communications.service.ts`. Test: rendering tests.
- [ ] **T23**. MCP tools `packages/mcp-server/src/lib/tools/communications.ts` (send with preview, schedule, cancel, list,
      delivery, templates). Test: preview writes nothing; permissions of the caller.
- [ ] **T47**. Send limits (spec FR-44): messages counted per organization and channel per day and month, counters
      read by the send service, the limits of the plan or the deployment settings enforced at queueing, refusal with
      `COMMUNICATIONS_LIMIT_REACHED` naming the limit. Files: `com/send/send-limits.ts`,
      `com/send/communication-send.service.ts`. Test: `com/send/send-limits.spec.ts`: the message past the daily limit is refused naming it; the next day it is accepted; with no
      limit set nothing is refused.

## Phase 3 — Depth

- [ ] **T24**. Plugin `packages/plugins/email-provider-imap` (provider registration with `connectedMailbox`, protocol and
      sign-in auth through `CONNECTED_ACCOUNTS`, SMTP transport, `email_imap_folder_state`, migration
      `imap/database/migrations/1791000033300-CreateImapFolderState.ts`, pull job with
      initial window, attachment limit, read state write-back, sent folder append, failure pause). Files:
      `imap/email-provider-imap.plugin.ts`, `imap/imap.provider.ts`, `imap/imap-pull.worker.ts`,
      `imap/email-imap-folder-state.entity.ts`. Test: against an
      in-memory mail server fixture; resume from `lastUid`; five failures pause.
- [ ] **T25**. Connected mailbox routes and form `com/accounts/connected-mailbox.controller.ts`, `inbox-ui` form
      (`inboxui/settings/connected-mailbox-form.component.ts`). Test: e2e
      connect, pull, reconnect.
- [ ] **T26**. Delivery events `com/events-intake/` (`delivery-events.controller.ts`, `delivery-events.service.ts`: public signed route per adapter, dedupe, recipient states, hard
      bounce and complaint suppression) and email provider plugins' delivery parsers (additive `deliveryEvents` on
      `IEmailProviderPlugin` in `inbox/email/providers/email-provider.types.ts`; parsers beside each provider, such as
      `packages/plugins/email-provider-sendgrid/src/lib/sendgrid.provider.ts`). Test: fixture payloads per provider plugin; duplicate event ignored.
- [ ] **T27** (parallel). Open and click tracking `com/tracking/` (`tracking.controller.ts`, `tracking-token.ts`: tokens, pixel, allow-listed redirects, off by default,
      never to employees). Test: redirect refuses links not in the body.
- [ ] **T28**. Suppression and consent `com/suppression/` (`suppression.service.ts`, `suppression.controller.ts`,
      `public-unsubscribe.controller.ts`, `consent.service.ts`: list, check at send, purpose rules, unsubscribe header and
      link, public unsubscribe and preference pages, export); consent records with `communications.consent.granted` /
      `.withdrawn` events. Test: receipts pass a marketing suppression; complaint removal needs consent; one event per
      captured consent.
- [ ] **T29**. Text adapters registry `com/text/` (`text-adapter.registry.ts`, `http-gateway.adapter.ts`,
      `test.adapter.ts`, `text-send.service.ts`) with the generic HTTP gateway and a test adapter; text accounts as
      `inbox_provider_account` rows with `TEXT` in `channels`, with secrets sealed by `inbox-secret-box.ts`; number normalisation;
      part counter and encoding; caps and allowed countries; role restriction. Test: GET and POST gateway variants;
      refused country; cap reached; no secret returned.
- [ ] **T30**. Inbound texts and keywords `com/text/text-inbound.controller.ts` (stop and start per organization, party
      match by number). Test: stop keyword suppresses; start removes.
- [ ] **T31**. Settings → SMS gateway page shows text accounts when the feature is on
      (`apps/gauzy/src/app/pages/settings/sms-gateway`), fallback kept. Test: rendering with and without the feature.
- [ ] **T32**. Bulk sends `com/bulk/` (`bulk-send.service.ts`, `bulk-send.controller.ts`, `communications-bulk.operation.ts`) as core operation `communications.bulk` (expansion from `RECORD_VIEWS_SELECTION` or
      ids as steps, skips by reason, failure stop, pause, resume, cancel, live progress). Test: 10,000 recipients in
      pages; stop at 10 % of 200; resumed after a restart.
- [ ] **T33** (parallel). Push `com/push/` (`push-adapter.registry.ts`, `push-send.service.ts`, `devices.controller.ts`: mobile devices registered in `inbox_push_subscription` beside browsers, push
      accounts as `inbox_provider_account` rows with `PUSH` in `channels`, adapters registry, invalid token removal, Inbox web
      push kept). Test: fake adapter reports an invalid token and it is removed; "My devices" lists a browser and a phone
      from one table.
- [ ] **T34** (parallel). Document default templates: declaration API for plugins, seeds for invoice, estimate, order,
      purchase order and receipt events. Files: `com/templates/document-default-templates.ts`,
      `com/templates/document-template.registry.ts`. Test: defaults listed per type and language.
- [ ] **T35**. Unanswered alerts `communications.unanswered.sweep` through `NOTIFICATION_DISPATCHER`. Files:
      `com/schedule/communications-unanswered.scheduler.ts`, `com/intake/unanswered-alerts.service.ts`. Test: once per message;
      working hours respected.
- [ ] **T36**. Preference and consent checks for notification purpose (`COMMUNICATIONS_PREFERENCES`), Inbox delivery's
      email and text lanes through the queue (FR-79). Files: `com/send/notification-preferences.check.ts`,
      `inbox/delivery/inbox-delivery-mailer.ts`. Test: muted channel not sent; Inbox specs pass unbound.
- [ ] **T37**. Report definitions (spec FR-81) and datasets. Files: `com/reports/communications-reports.ts`. Test: seeded figures.

## Phase 4 — Advanced capabilities, MCP, SDKs, docs

- [ ] **T38**. Identity health `communications.health.daily`, score with causes, complaint pause, warm-up check at send
      and bulk spreading; retention kind `communications.events` declared through
      `RETENTION_SOURCES`. Files: `com/health/identity-health.service.ts`, `com/health/identity-health.scheduler.ts`,
      `com/health/warm-up.check.ts`, `com/communications-retention-sources.ts`. Test: seeded bounce spike lowers the score; volume jump warns; events past 400 days dropped by the
      retention runner with their counts kept.
- [ ] **T39** (parallel). Domain checks added to the Inbox domain verifier (`inbox/email/mailboxes/inbox-mailbox.service.ts`:
      published authentication and reporting records next to the TXT verification, guidance); identities read its
      status. Test: resolver fakes for missing and wrong records; existing domain verification specs unchanged.
- [ ] **T40**. Assistant `com/assistant/` (`thread-assistant.service.ts`, `thread-assistant.controller.ts`,
      `shared/thread-assistant.component.ts`: thread summary stored per version, reply draft facts-only, sentiment and urgency
      hints, organization opt-in). Test: prompt contains only thread and record facts; draft never queued.
- [ ] **T41**. Party conversation `com/conversation/` (`party-conversation.service.ts`, `party-conversation.controller.ts`,
      `shared/party-conversation.component.ts`: merge across records and mailboxes, `COMMUNICATION_CONVERSATION_SOURCES`,
      reply on any channel, address merge). Test: chat and call fakes appear in order; reply links to the answered records.
- [ ] **T42** (parallel). Local sending windows (party time zone, organization defaults per channel, urgent bypass).
      Files: `com/send/sending-window.ts`, `com/send/communication-send.worker.ts`. Test: message queued at 23:00 local leaves at 08:00.
- [ ] **T43**. API contract for Ever Teams' mail screens: `/api/communications/*` and `/api/communications/devices`
      documented in OpenAPI with examples (Ever Teams builds its screens in its own app; no React package). Files:
      `com/messages/dto/`, `com/push/devices.controller.ts`. Test: OpenAPI
      examples validate against the DTOs.
- [ ] **T44**. Remaining MCP tools (thread summary, draft reply, bulk send preview, suppressions). Files:
      `packages/mcp-server/src/lib/tools/communications.ts`. Test: preview writes nothing.
- [ ] **T45**. OpenAPI regenerated; SDK regeneration noted for release; webhook catalogue entries; user docs on the docs
      site and the `docs/specs/README.md` index row; spec status `Implemented`. Test: OpenAPI diff is additive; the webhook catalogue lists the new events; docs build.
- [ ] **T46**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CALENDAR_IDENTITIES`, `LEAD_CAPTURE_CONSENT`, `MAIL_RECORD_INTAKE`, `MARKETING_CONSENT`, `MARKETING_IDENTITIES`, `MARKETING_SUPPRESSION`, `MARKETING_TEMPLATES`, `MARKETING_TRACKING`, `TELEPHONY_CONTACT_POLICY`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T12, T23 |
| FR-2 | §3.1 Scope, flags and compatibility | T5, T10 |
| FR-3 | §3.1 Scope, flags and compatibility | T7, T10 |
| FR-4 | §3.1 Scope, flags and compatibility | T2 |
| FR-5 | §3.2 Sending identities and accounts | T7 |
| FR-6–FR-7 | §3.2 Sending identities and accounts | T7 |
| FR-8 | §3.2 Sending identities and accounts | T7, T8 |
| FR-9 | §3.2 Sending identities and accounts | T10 |
| FR-10 | §3.2 Sending identities and accounts | T8 |
| FR-11 | §3.2 Sending identities and accounts | T15 |
| FR-12–FR-13 | §3.3 Connected mailboxes and receiving | T24, T25 |
| FR-14 | §3.3 Connected mailboxes and receiving | T24 |
| FR-15 | §3.3 Connected mailboxes and receiving | T24 |
| FR-16 | §3.3 Connected mailboxes and receiving | T16 |
| FR-17 | §3.3 Connected mailboxes and receiving | T24, T25 |
| FR-18 | §3.4 Mail to records | T15 |
| FR-19 | §3.4 Mail to records | T14, T15 |
| FR-20 | §3.4 Mail to records | T15 |
| FR-21 | §3.4 Mail to records | T35 |
| FR-22 | §3.4 Mail to records | T13, T22 |
| FR-23 | §3.4 Mail to records | T15 |
| FR-24 | §3.5 Composer on records | T10, T21 |
| FR-25 | §3.5 Composer on records | T9 |
| FR-26 | §3.5 Composer on records | T10, T21 |
| FR-27 | §3.5 Composer on records | T10, T12 |
| FR-28 | §3.5 Composer on records | T10, T13 |
| FR-29 | §3.5 Composer on records | T10 |
| FR-30 | §3.5 Composer on records | T21 |
| FR-31 | §3.6 Templates and signatures | T9 |
| FR-32 | §3.6 Templates and signatures | T9, T20 |
| FR-33 | §3.6 Templates and signatures | T9, T34 |
| FR-34 | §3.6 Templates and signatures | T9 |
| FR-35 | §3.6 Templates and signatures | T9, T20 |
| FR-36 | §3.7 Outbound queue and delivery status | T11 |
| FR-37 | §3.7 Outbound queue and delivery status | T11 |
| FR-38–FR-39 | §3.7 Outbound queue and delivery status | T11 |
| FR-40 | §3.7 Outbound queue and delivery status | T32 |
| FR-41 | §3.7 Outbound queue and delivery status | T26 |
| FR-42 | §3.7 Outbound queue and delivery status | T27 |
| FR-43 | §3.7 Outbound queue and delivery status | T10 |
| FR-44 | §3.7 Outbound queue and delivery status | T47 |
| FR-45 | §3.8 Communication log and timeline | T10, T13, T14 |
| FR-46 | §3.8 Communication log and timeline | T13, T18 |
| FR-47 | §3.8 Communication log and timeline | T13, T18 |
| FR-48 | §3.8 Communication log and timeline | T18 |
| FR-49 | §3.8 Communication log and timeline | T13 |
| FR-50–FR-53 | §3.9 Suppression and unsubscribe | T28 |
| FR-54 | §3.10 Text messages | T29, T31 |
| FR-55 | §3.10 Text messages | T21, T29 |
| FR-56 | §3.10 Text messages | T29 |
| FR-57 | §3.10 Text messages | T32 |
| FR-58 | §3.10 Text messages | T30 |
| FR-59 | §3.10 Text messages | T29, T32 |
| FR-60–FR-61 | §3.11 Push | T33 |
| FR-62 | §3.12 Preferences, consent and quiet times | T36 |
| FR-63 | §3.12 Preferences, consent and quiet times | T28, T36 |
| FR-64 | §3.12 Preferences, consent and quiet times | T42 |
| FR-65 | §3.13 Delivery health (advanced) | T38 |
| FR-66 | §3.13 Delivery health (advanced) | T39 |
| FR-67 | §3.13 Delivery health (advanced) | T38 |
| FR-68–FR-69 | §3.14 Assistant (advanced) | T40 |
| FR-70 | §3.14 Assistant (advanced) | T35, T40 |
| FR-71 | §3.14 Assistant (advanced) | T40 |
| FR-72–FR-74 | §3.15 One conversation per party (advanced) | T41 |
| FR-75 | §3.16 API, events, agents and reports | T12 |
| FR-76 | §3.16 API, events, agents and reports | T19 |
| FR-77 | §3.16 API, events, agents and reports | T17 |
| FR-78 | §3.16 API, events, agents and reports | T23, T44 |
| FR-79 | §3.16 API, events, agents and reports | T36 |
| FR-80 | §3.16 API, events, agents and reports | T14 |
| FR-81 | §3.16 API, events, agents and reports | T37 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With the feature off, system mail, email history, mail server settings, the Inbox and its replies behave exactly as
  before (their existing specs pass unchanged).
- Every consumer token of T17 resolves to the one sender; no feature sends mail around it once it is on.
- No message is sent twice in the crash-recovery suite; suppressions are honoured in every send path.
