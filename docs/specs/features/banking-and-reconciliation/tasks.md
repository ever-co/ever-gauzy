# Task Breakdown: Banking and reconciliation

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `banking-and-reconciliation`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_BANKING`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative to the repository root;
  `banking/` means `packages/plugins/banking/src/lib/` and `banking-ui/` means `packages/plugins/banking-ui/src/lib/`.
  Each entity folder `banking/<name>/` holds `<name>.entity.ts`, `repository/type-orm-<name>.repository.ts` and
  `repository/mikro-orm-<name>.repository.ts`, as in `packages/plugins/purchasing/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/banking.model.ts` and `banking.events.ts` (enums, records, port
  shapes including `IPartyBankAccounts`), export from `index.ts`; enum values `RuleOwnerType.BANK_RULE`,
  `IntegrationEntity.BANK_ACCOUNT`, `BaseEntityEnum.BankTransaction`. Test: compile spec.
- [ ] **T2**. Plugin scaffold `packages/plugins/banking` (package, project, tsconfig, jest, eslint, path mapping),
  `banking/banking.plugin.ts`, `banking.module.ts`, `banking.features.ts` (`FEATURE_BANKING`, default off),
  `banking.permissions.ts` (18 contributions with `defaultFor`), `banking.settings.ts`, registration in
  `apps/api/src/plugins.ts`. Test: plugin list spec; contribution spec.
- [ ] **T3**. Migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`); number protection helper `banking/security/account-number.ts`
  on the core `EncryptionService` (mask, keyed hash; IBAN and identifier-code checks; no cipher of its own). Test:
  check-digit tables; round-trip and hash equality. Migration timestamps: `1791000077100` to `1791000077199` (`packages/plugins/banking`).
- [ ] **T4**. Entities and repositories (both ORMs) for `bank`, `bank_account`, `party_bank_account` (verification
  state as `PaymentAccountVerificationStatus`, `@ExportRedacted` on number columns); migration
  `CreateBankingMasterTables`. Files: `banking/bank/bank.entity.ts`, `banking/bank-account/bank-account.entity.ts`,
  `banking/party-bank-account/party-bank-account.entity.ts` with their repositories,
  `banking/database/migrations/1791000077100-CreateBankingMasterTables.ts`, `banking/database/migrations/index.ts`.
  Test: migration spec on SQLite, uniqueness specs, export redaction spec.
- [ ] **T5**. Entities for `bank_statement` (with `dataImportRunId`), `bank_transaction`, `bank_match`,
  `bank_balance`; migration `CreateBankStatementTables`. Files: `banking/bank-statement/bank-statement.entity.ts`,
  `banking/bank-transaction/bank-transaction.entity.ts`, `banking/bank-match/bank-match.entity.ts`,
  `banking/bank-balance/bank-balance.entity.ts` with their repositories,
  `banking/database/migrations/1791000077110-CreateBankStatementTables.ts`. Test: migration and mapping-parity specs.
- [ ] **T6** (parallel). Entities for `bank_rule` (outcome, priority, no condition columns), `bank_rule_run`,
  `bank_match_memory`, `bank_match_proposal`; migration `CreateBankRuleTables`. Files:
  `banking/bank-rule/bank-rule.entity.ts`, `banking/bank-rule-run/bank-rule-run.entity.ts`,
  `banking/bank-match-memory/bank-match-memory.entity.ts`, `banking/bank-match-proposal/bank-match-proposal.entity.ts`
  with their repositories, `banking/database/migrations/1791000077120-CreateBankRuleTables.ts`. Test: migration spec.
- [ ] **T7** (parallel). Entities for `bank_reconciliation_checkpoint`, `bank_guarantee`; migration
  `CreateBankCheckpointAndGuaranteeTables`. Files:
  `banking/bank-reconciliation-checkpoint/bank-reconciliation-checkpoint.entity.ts`,
  `banking/bank-guarantee/bank-guarantee.entity.ts` with their repositories,
  `banking/database/migrations/1791000077130-CreateBankCheckpointAndGuaranteeTables.ts`. Test: migration spec.
- [ ] **T8** (parallel). Entities for `bank_connection` (with `integrationTenantId`) and `bank_payment_initiation`;
  migration `CreateBankConnectionTables`. Files: `banking/bank-connection/bank-connection.entity.ts`,
  `banking/bank-payment-initiation/bank-payment-initiation.entity.ts` with their repositories,
  `banking/database/migrations/1791000077140-CreateBankConnectionTables.ts`. Test: migration spec.
- [ ] **T9**. Default role grants as `defaultFor` on the permission contributions of `banking.permissions.ts` (no
  seed migration) and the organization settings of `banking.settings.ts` in the platform settings store. Test:
  role-grant resolution spec; settings resolve per organization.

## Phase 2 — Services, endpoints, events

- [ ] **T10**. Banks and bank accounts: services and controllers `banking/bank`, `banking/bank-account` (default per
  currency, ledger link through `BANKING_LEDGER_ACCOUNTS`, masking, reveal written to the access log through
  `BANKING_AUDIT_SINK`, delete guards). Files: `banking/bank/bank.service.ts`, `banking/bank/bank.controller.ts`,
  `banking/bank/dto/create-bank.dto.ts`, `banking/bank-account/bank-account.service.ts`,
  `banking/bank-account/bank-account.controller.ts`, `banking/bank-account/dto/create-bank-account.dto.ts`,
  `banking/banking.tokens.ts`. Test: service specs; e2e for masking and permissions.
- [ ] **T11** (parallel). Party bank accounts, the single store: `banking/party-bank-account` service and
  controller, change stamping, verification by a second person, owner notice, reveal with access log; port
  `PARTY_BANK_ACCOUNTS` answered by `PartyBankAccountService` (bound also as `PAYMENT_BANK_ACCOUNTS` and
  `PAYROLL_PAY_ACCOUNTS`). Files: `banking/party-bank-account/party-bank-account.service.ts`,
  `banking/party-bank-account/party-bank-account.controller.ts`,
  `banking/party-bank-account/dto/create-party-bank-account.dto.ts`, `apps/api/src/plugin-composition.ts`. Test:
  service spec; port returns masks unless a purpose and the permission are given; every full read writes an
  access-log event.
- [ ] **T12**. Import profile `banking.transactions` registered with `data-exchange` (`registerImportProfiles`:
  fields, amount layouts as transforms, match keys, mapping templates per bank account and bank); detection, mapping,
  rejected-row file and undo come from the engine. Files: `banking/import/banking-transactions.import-profile.ts`,
  `banking/import/amount-layout.transforms.ts`, `banking/banking.module.ts`. Test: fixture files per layout imported
  through the engine.
- [ ] **T13** (parallel). Readers for MT940, ISO 20022 camt.052 and camt.053, OFX, supplied to the
  `banking.transactions` profile for structured files. Files: `banking/import/readers/statement-parser.ts`
  (`IStatementParser`), `banking/import/readers/mt940.reader.ts`, `banking/import/readers/camt.reader.ts`,
  `banking/import/readers/ofx.reader.ts`, `banking/import/readers/fixtures/`. Test: fixture files incl. balances.
- [ ] **T14**. Import flow `banking/import/`: `/bank-statements/detect` and `/bank-statements` on
  `BANKING_IMPORT_ENGINE`, statement facts and `dataImportRunId`, fingerprint dedupe, insert or update mode,
  continuity check, undo guarded by matches. Files: `banking/import/bank-statement-import.service.ts`,
  `banking/import/statement-fingerprint.ts`, `banking/import/statement-continuity.ts`,
  `banking/bank-statement/bank-statement.controller.ts`, `banking/bank-statement/bank-statement.service.ts`,
  `banking/bank-statement/dto/create-bank-statement.dto.ts`. Test: duplicate file, overlapping file, foreign-currency
  rows, balance gap, undo guard.
- [ ] **T15**. Bank transactions: service and controller (list, hand entry, tags, exclude and include, split, void,
  claim with expiry, version check); notes as core `comment` rows on the line. Files:
  `banking/bank-transaction/bank-transaction.service.ts`, `banking/bank-transaction/bank-transaction.controller.ts`,
  `banking/bank-transaction/bank-transaction.state.ts`, `banking/bank-transaction/dto/create-bank-transaction.dto.ts`,
  `banking/bank-transaction/dto/split-bank-transaction.dto.ts`. Test: state machine spec; stale-version spec.
- [ ] **T16**. Match core `banking/reconciliation/`: match, partial match, unmatch, allocation guards, cleared-date
  stamping through `BANKING_COUNTERPART_SOURCE`, summary endpoint. Files:
  `banking/reconciliation/reconciliation.service.ts`, `banking/reconciliation/reconciliation.controller.ts`,
  `banking/reconciliation/dto/match.dto.ts`, `banking/bank-match/bank-match.service.ts`. Test: over-allocation and
  double-match specs.
- [ ] **T17**. Ports in `apps/api/src/plugin-composition.ts`: counterpart sources for core payments (adapter in
  `banking/adapters/payment-counterpart.adapter.ts` until `payments-and-collections` answers it itself), payment
  captures and settlement payouts of the payment plugin (provider and sales-channel settlements, lines through
  `SETTLEMENT_LINE_SOURCES`), and marketplace `seller_settlement`. Test: composition spec; plugin boots with ports
  unbound; a seller settlement and a channel settlement each match their bank line.
- [ ] **T18**. Candidate search and scorer (pure) `banking/matching/`: kinds, reasons, tolerance, reference
  extraction, date window, bounded subset-sum over open items. Files: `banking/matching/candidate-search.service.ts`,
  `banking/matching/match-scorer.ts`, `banking/matching/reference-extractor.ts`, `banking/matching/subset-sum.ts`,
  `banking/bank-transaction/bank-transaction.controller.ts` (`/:id/suggestions`). Test: property tests (score
  monotonic in evidence); latency budget spec on a seeded million-line set.
- [ ] **T19**. Party recognition: account hash, normalised name, similarity option. Files:
  `banking/matching/party-recognition.ts`, `banking/matching/name-normaliser.ts`. Test: table-driven spec.
- [ ] **T20**. Create from a line: payment (`BANKING_PAYMENT_GATEWAY`; open items through `BANKING_OPEN_ITEMS` bound
  to the `OPEN_ITEM_REGISTER` of `invoicing-receivables-payables`), journal (`BANKING_JOURNAL_GATEWAY`), transfer
  pairing, fee part, exchange difference hand-off, effects preview, period-lock refusal. Files:
  `banking/reconciliation/create-from-line.service.ts`, `banking/reconciliation/effects-preview.ts`,
  `banking/reconciliation/dto/create-from-line.dto.ts`, `banking/reconciliation/reconciliation.controller.ts`. Test:
  service specs with fake gateways; atomicity spec.
- [ ] **T21**. Bulk endpoint with per-row results. Files: `banking/reconciliation/bulk-reconciliation.service.ts`,
  `banking/reconciliation/dto/bulk-reconciliation.dto.ts`, `banking/reconciliation/reconciliation.controller.ts`.
  Test: partial-failure spec (196 of 200).
- [ ] **T22**. Rules: conditions as core `rule` rows (`BANK_RULE`, context mapping of the bank line registered with
  the rule validator), evaluation by `evaluateRuleSet` with pattern safety, outcomes, modes, preview on 12 months,
  run log, undo, counters, `/bank-rules` routes. Files: `banking/bank-rule/bank-rule.service.ts`,
  `banking/bank-rule/bank-rule.controller.ts`, `banking/bank-rule/bank-rule.context.ts`,
  `banking/bank-rule/bank-rule-outcome.service.ts`, `banking/bank-rule/bank-rule-preview.service.ts`,
  `banking/bank-rule-run/bank-rule-run.service.ts`, `banking/bank-rule/dto/create-bank-rule.dto.ts`. Test: outcome
  specs; last-line-remainder balance property; unsafe pattern refused; preview on a seeded year lists the lines a
  higher rule takes first; undo cancels what an application created.
- [ ] **T23**. Matching worker `banking.match`: automation levels, exact auto-match, rules, origin marking; hourly
  sweep recorded in `job_execution`. Files: `banking/matching/banking-match.worker.ts`,
  `banking/matching/banking-match.scheduler.ts`, `banking/bank-account/bank-account.controller.ts`
  (`PUT /:id/automation`). Test: idempotency spec.
- [ ] **T24**. Checkpoints and clearing without statements: close, difference with reason, lock, reopen order,
  clear endpoint, date guards. Files:
  `banking/bank-reconciliation-checkpoint/bank-reconciliation-checkpoint.service.ts`,
  `banking/bank-reconciliation-checkpoint/bank-reconciliation-checkpoint.controller.ts`,
  `banking/reconciliation/clearing.service.ts`, `banking/reconciliation/dto/clear-entries.dto.ts`. Test: lock and
  guard specs.
- [ ] **T25** (parallel). Balances: daily job, live totals, gap flags, `/bank-balances`. Files:
  `banking/bank-balance/bank-balance.service.ts`, `banking/bank-balance/bank-balance.controller.ts`,
  `banking/bank-balance/banking-balances-daily.scheduler.ts`. Test: job idempotency spec.
- [ ] **T26** (parallel). Guarantees: document type registration (numbering, lifecycle), service, controller,
  postings through the journal gateway, expiry reminders as `reminder` rows of `automation-and-notifications`,
  expiry job, facility utilisation. Files: `banking/bank-guarantee/bank-guarantee.service.ts`,
  `banking/bank-guarantee/bank-guarantee.controller.ts`, `banking/bank-guarantee/bank-guarantee.document-type.ts`,
  `banking/bank-guarantee/dto/create-bank-guarantee.dto.ts`, `banking/bank-guarantee/banking-guarantees-daily.scheduler.ts`.
  Test: lifecycle spec; reminder moves when the end date changes.
- [ ] **T27**. PDF text import with review step and password handling. Files: `banking/import/readers/pdf-text.reader.ts`,
  `banking/import/pdf-review.service.ts`, `banking/import/readers/fixtures/`. Test: fixture PDFs; password never
  persisted by default.
- [ ] **T28**. Events on the outbox, realtime channel `banking:account:<id>` (line versions), inbox items. Files:
  `banking/realtime/banking-outbox-append.ts`, `banking/realtime/banking-realtime.ts`,
  `banking/notifications/banking-inbox-items.ts`. Test: payload specs; reconnect catch-up spec.
- [ ] **T29**. Report definitions `banking/reports/banking-report.definitions.ts` (ten reports of spec §3.9) and
  the printable reconciliation statement template. Test: dataset spec per report.
- [ ] **T61**. Learned party bank accounts (spec FR-10): when a line from an account unknown for its party is matched
  to that party, the match answers a proposal to add a `party_bank_account` (`source = LEARNED`, `verificationStatus
  = PENDING`); the row is written only when the user accepts. Files:
  `banking/party-bank-account/party-bank-account-proposal.service.ts`,
  `banking/party-bank-account/party-bank-account.controller.ts`, `banking/reconciliation/reconciliation.service.ts`.
  Test: proposal spec; nothing is stored until accepted; an already known number proposes nothing.
- [ ] **T62**. Unmatch of a created counterpart (spec FR-59): unmatching a line whose `bank_match.createdCounterpart`
  is set answers a question first; on confirmation the counterpart is cancelled through its owner's cancellation
  (`BANKING_PAYMENT_GATEWAY` cancel, `BANKING_JOURNAL_GATEWAY` reverse). Files:
  `banking/reconciliation/reconciliation.service.ts`, `banking/reconciliation/dto/unmatch.dto.ts`. Test: unmatch
  without confirmation keeps the payment; with confirmation the fake gateway receives one cancel; a matched entry not
  created from the line is never cancelled.
- [ ] **T63**. Point-of-sale shift deposits as a counterpart source (spec FR-66): adapter
  `banking/adapters/shift-deposit-counterpart.adapter.ts` bound in `apps/api/src/plugin-composition.ts` when
  `point-of-sale-and-loyalty` is installed; filter `includeShiftDeposits` on the clearing list and the reconciliation
  statement. Test: deposits listed among entries to clear; filter hides them; plugin boots without point of sale.
- [ ] **T64**. Working without accounting (spec FR-85): with `BANKING_LEDGER_ACCOUNTS` and `BANKING_JOURNAL_GATEWAY`
  unbound, the book balance is the sum of payments on the account, the summary answers `journalActions: false`, and
  the journal routes answer "unavailable". Files: `banking/bank-balance/book-balance.service.ts`,
  `banking/reconciliation/reconciliation.controller.ts`. Test: e2e with the accounting plugins absent: a line
  matches a payment, book balance equals the payments, journal creation is refused.

## Phase 3 — UI surfaces

- [ ] **T30**. Scaffold `packages/plugins/banking-ui`; routes through the `accounting-sections` page location;
  accounts page with tiles; settings (banks, thresholds); menu gating; i18n in every locale. Files:
  `banking-ui/banking-ui.plugin.ts`, `banking-ui/banking-ui.routes.ts`,
  `banking-ui/components/bank-accounts-page/bank-accounts-page.component.ts`,
  `banking-ui/components/banking-settings-page/banking-settings-page.component.ts`,
  `packages/ui-core/i18n/assets/i18n/en.json` (and every other locale file there). Test: rendering specs.
- [ ] **T31**. Import wizard (upload, the `data-exchange` mapping step, progress, record, rejected-row file). Files:
  `banking-ui/components/statement-import-wizard/statement-import-wizard.component.ts`,
  `banking-ui/components/bank-statements-page/bank-statements-page.component.ts`. Test: wizard specs.
- [ ] **T32**. Workspace: line list (virtual scroll, filters), candidate panel, match and unmatch, split, exclude,
  header balances, comments. Files: `banking-ui/components/reconcile-workspace/reconcile-workspace.component.ts`,
  `banking-ui/components/bank-line-list/bank-line-list.component.ts`,
  `banking-ui/components/candidate-panel/candidate-panel.component.ts`, `banking-ui/services/banking.service.ts`.
  Test: component specs.
- [ ] **T33**. Workspace: create payment, journal and transfer drawers with effects preview; bulk actions; keyboard
  map and live-region announcements. Files:
  `banking-ui/components/create-from-line-drawer/create-from-line-drawer.component.ts`,
  `banking-ui/components/effects-preview/effects-preview.component.ts`,
  `banking-ui/components/reconcile-workspace/reconcile-keyboard-map.ts`. Test: keyboard specs, axe checks.
- [ ] **T34**. Rules pages (list, order, editor on rule rows, history preview, run log). Files:
  `banking-ui/components/bank-rules-page/bank-rules-page.component.ts`,
  `banking-ui/components/bank-rule-editor/bank-rule-editor.component.ts`. Test: rendering specs.
- [ ] **T35**. Checkpoints pages and printable statement; clearing mode. Files:
  `banking-ui/components/bank-checkpoints-page/bank-checkpoints-page.component.ts`,
  `banking-ui/components/clearing-mode/clearing-mode.component.ts`. Test: rendering specs.
- [ ] **T36** (parallel). Guarantees pages. Files:
  `banking-ui/components/bank-guarantees-page/bank-guarantees-page.component.ts`,
  `banking-ui/components/bank-guarantee-form/bank-guarantee-form.component.ts`. Test: rendering specs.
- [ ] **T37** (parallel). Party bank accounts panel on contact, vendor and employee pages (slot registry), with
  verification and masked numbers. Files:
  `banking-ui/components/party-bank-accounts-panel/party-bank-accounts-panel.component.ts`,
  `banking-ui/banking-ui.plugin.ts`. Test: panel spec; hidden with the flag off.
- [ ] **T38** (parallel). `BankBalancesCard` as an Angular widget registered by `banking-ui` in the existing
  dashboard widget registry. Files: `banking-ui/widgets/bank-balances-card/bank-balances-card.component.ts`,
  `banking-ui/banking-ui.plugin.ts` (registration through
  `packages/ui-core/core/src/lib/services/widget/widget-registry.service.ts`). Test: rendering test.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. MCP read tools `packages/mcp-server/src/lib/tools/banking.ts`: `bank_list_accounts`,
  `bank_list_transactions`, `bank_suggest_matches`, `bank_reconciliation_status`, `bank_get_report`. Test: schema
  specs; no tool returns a full number.
- [ ] **T40**. Import and export of masters and rules through `data-import-export`. Files:
  `banking/import/banking-master-import-profiles.ts` (banks, bank accounts, party bank accounts, rules),
  `banking/banking.module.ts`. Test: round-trip spec.
- [ ] **T41**. Worker plugin `BankingSchedulePlugin` in `apps/worker/src/plugins.ts`; in-process fallback timers.
  Files: `banking/banking-schedule.plugin.ts`. Test: worker plugin list spec.
- [ ] **T42**. OpenAPI regenerated; SDK regeneration noted; user docs (docs site: import, workspace, rules,
  checkpoints, bank details and their protection); index row in `docs/specs/README.md`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Bank feeds

- [ ] **T43**. Provider port `BANK_PROVIDER` and registry `banking/providers/`; `GET /bank-providers`; each provider
  listed in the Integrations catalogue. Files: `banking/providers/bank-provider.registry.ts`,
  `banking/providers/bank-provider.controller.ts`. Test: registry spec.
- [ ] **T44**. `packages/plugins/bank-provider-sandbox`: deterministic accounts, lines (announced → booked),
  balances, consent expiry, identifier change on re-link, initiation. Files:
  `packages/plugins/bank-provider-sandbox/src/lib/sandbox-bank-provider.ts`,
  `packages/plugins/bank-provider-sandbox/src/lib/bank-provider-sandbox.plugin.ts`,
  `banking/providers/testing/bank-provider.contract-suite.ts`. Test: provider contract suite (reused by every
  future provider).
- [ ] **T45**. Connections: connect and consent flow from the Integrations page, one `integration_tenant` per
  connection, credentials as `integration_setting` rows, account links as `integration_map` rows, account creation,
  disconnect. Files: `banking/bank-connection/bank-connection.service.ts`,
  `banking/bank-connection/bank-connection.controller.ts`, `banking/bank-connection/bank-connection-link.service.ts`,
  `banking/bank-connection/dto/create-bank-connection.dto.ts`. Test: e2e with the sandbox provider.
- [ ] **T46**. Sync: sweep, worker, `feedCursor`, upsert by external id, merge with file lines, one `job_execution`
  row per pass (job id per connection, counters in `metadata`), retries, failure inbox item, signed notice
  endpoint. Files: `banking/bank-connection/sync/bank-sync.service.ts`,
  `banking/bank-connection/sync/banking-sync.worker.ts`, `banking/bank-connection/sync/banking-sync.scheduler.ts`,
  `banking/bank-connection/bank-provider-notice.controller.ts`. Test: double-delivery spec; announced-to-booked spec;
  bad signature refused; second concurrent sync of a connection refused.
- [ ] **T47**. Consent state machine, reminders as `reminder` rows, re-consent mapping by number hash. Files:
  `banking/bank-connection/bank-connection.state.ts`, `banking/bank-connection/consent-reminder.service.ts`,
  `banking/bank-connection/banking-connections-daily.scheduler.ts`. Test: state spec.
- [ ] **T48**. Connections UI in the Integrations page (`integrations-sections`: wizard, state, sync log, "sync now").
  Files: `banking-ui/components/bank-connection-wizard/bank-connection-wizard.component.ts`,
  `banking-ui/components/bank-connection-status/bank-connection-status.component.ts`,
  `banking-ui/components/bank-sync-log/bank-sync-log.component.ts`. Test: rendering specs.

## Phase 6 — Advanced capabilities

- [ ] **T49**. Match memory: consumer `subscriber:banking-memory`, ranking features, reset endpoint. Files:
  `banking/bank-match-memory/match-memory.consumer.ts`, `banking/bank-match-memory/bank-match-memory.service.ts`,
  `banking/bank-match-memory/bank-match-memory.controller.ts`, `banking/matching/match-scorer.ts`. Test: ranking
  changes after confirmations and rejections.
- [ ] **T50**. Confidence score and per-account auto-match threshold. Files: `banking/matching/confidence.ts`,
  `banking/matching/banking-match.worker.ts`, `banking/bank-account/bank-account.service.ts`. Test: threshold spec.
- [ ] **T51**. Rule proposals: daily miner, proposals page, accept and dismiss with 90-day memory. Files:
  `banking/bank-match-proposal/rule-proposal.miner.ts`, `banking/bank-match-proposal/banking-proposals-mine.scheduler.ts`,
  `banking-ui/components/bank-proposals-page/bank-proposals-page.component.ts`. Test: miner spec.
- [ ] **T52**. Agent path: `/bank-proposals` batches, inbox item, accept some or all; MCP write tools with preview
  (`bank_match_transaction`, `bank_unmatch_transaction`, `bank_create_from_transaction`, `bank_propose_batch`,
  `bank_preview_rule`, `bank_save_rule`, `bank_import_statement`, `bank_sync_connection`). Files:
  `banking/bank-match-proposal/bank-match-proposal.service.ts`,
  `banking/bank-match-proposal/bank-match-proposal.controller.ts`, `packages/mcp-server/src/lib/tools/banking.ts`.
  Test: preview writes nothing; proposals post nothing.
- [ ] **T53**. Live collaboration in the workspace: presence, claims, pushed changes, stale-commit refusal. Files:
  `banking/realtime/banking-presence.service.ts`, `banking/bank-transaction/bank-transaction.service.ts`,
  `banking-ui/components/reconcile-workspace/workspace-presence.ts`. Test: two-session e2e.
- [ ] **T54**. Cash forecast: learned payment delay per party, recurring line detection, projection endpoint, page,
  `CashForecastCard` widget, threshold alert, MCP `bank_get_cash_forecast`. Files:
  `banking/forecast/cash-forecast.service.ts`, `banking/forecast/payment-delay.learner.ts`,
  `banking/forecast/recurring-line.detector.ts`, `banking/bank-balance/bank-balance.controller.ts`
  (`/bank-balances/forecast`), `banking-ui/components/cash-forecast-page/cash-forecast-page.component.ts`,
  `banking-ui/widgets/cash-forecast-card/cash-forecast-card.component.ts`,
  `packages/mcp-server/src/lib/tools/banking.ts`. Test: projection spec on seeded data.
- [ ] **T55**. Anomaly detector writing to the finding store of `general-ledger` through `BANKING_FINDINGS`
  (`source = BANKING`; inbox item and event only without it); `/bank-anomalies` list and dismissal. Files:
  `banking/anomalies/anomaly-detector.ts`, `banking/anomalies/bank-anomaly.controller.ts`,
  `banking/bank-match-memory/match-memory.consumer.ts`. Test: detector specs (duplicate outgoing payment within 7
  days, unknown account for the party, unusual amount, unusual fee).
- [ ] **T56**. Payment initiation: `BANKING_PAYMENT_ORDERS` port, submission, authorisation redirect, status poll
  and notices, auto-match by end-to-end reference. Files:
  `banking/bank-payment-initiation/bank-payment-initiation.service.ts`,
  `banking/bank-payment-initiation/bank-payment-initiation.controller.ts`,
  `banking/bank-payment-initiation/banking-initiation-poll.scheduler.ts`. Test: e2e with the sandbox provider
  (executed and rejected).
- [ ] **T57**. Scanned statements through `BANKING_DOCUMENT_EXTRACTION` with review of low-confidence fields. Files:
  `banking/import/scanned-statement.extractor.ts`, `banking/import/pdf-review.service.ts`. Test: fake extractor spec;
  unavailable when unbound.
- [ ] **T58**. Link imports on a schedule as `data-exchange` schedules of the `banking.transactions` profile, with
  the host allow-list and limits. Files: `banking/import/banking-link-schedule.service.ts`,
  `banking/bank-statement/bank-statement.controller.ts`. Test: refused host spec.
- [ ] **T59**. Single-store rule in code: option `unlessPermission` on `ExportRedacted`
  (`packages/core/src/lib/export-import/export-redact.decorator.ts`) used with `BANK_ACCOUNT_NUMBERS_EXPORT`; the
  comments of `packages/contracts/src/lib/payment-account-holder.model.ts`,
  `packages/core/src/lib/payment-account-holder/payment-account-holder.entity.ts` and
  `packages/plugins/marketplace/src/lib/seller/seller.entity.ts` updated to name `party_bank_account` as the one
  exception. Test: export spec with and without the permission; redaction entity spec extended.
- [ ] **T60**. Default for existing tenants (spec FR-84), `FEATURE_BANKING`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
  Files: `banking/banking.features.ts`, `banking-ui/banking-ui.plugin.ts`. Test: a tenant created before the change
  shows no Banking menu, party bank panel or balance card.
- [ ] **T65**. Bank-detail change control on payment orders (spec FR-11; the anomaly detector is T55): a party bank account
  changed within the configured window (default 14 days) and not yet `VERIFIED` blocks its use by a payment order
  until a second person verifies it; the approval workflow definition ships as a default. Files:
  `banking/party-bank-account/party-bank-account-change-control.ts`,
  `banking/workflows/bank-detail-verification.workflow.ts`, `banking/party-bank-account/party-bank-account.service.ts`.
  Test: verification required spec; the person who changed the number cannot verify it.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-2 | §3.1 Banks, bank accounts and party bank accounts | T10 |
| FR-3 | §3.1 Banks, bank accounts and party bank accounts | T3, T4 |
| FR-4–FR-6 | §3.1 Banks, bank accounts and party bank accounts | T10 |
| FR-7 | §3.1 Banks, bank accounts and party bank accounts | T10, T11 |
| FR-8 | §3.1 Banks, bank accounts and party bank accounts | T11 |
| FR-9 | §3.1 Banks, bank accounts and party bank accounts | T11, T19 |
| FR-10 | §3.1 Banks, bank accounts and party bank accounts | T61 |
| FR-11 | §3.1 Banks, bank accounts and party bank accounts | T11, T65 |
| FR-12 | §3.2 Statement import | T12, T13, T14, T27 |
| FR-13 | §3.2 Statement import | T12, T14 |
| FR-14 | §3.2 Statement import | T12 |
| FR-15 | §3.2 Statement import | T13, T14 |
| FR-16 | §3.2 Statement import | T27 |
| FR-17 | §3.2 Statement import | T57 |
| FR-18 | §3.2 Statement import | T58 |
| FR-19 | §3.2 Statement import | T12, T14 |
| FR-20 | §3.2 Statement import | T14, T46 |
| FR-21 | §3.2 Statement import | T14, T31 |
| FR-22 | §3.2 Statement import | T14 |
| FR-23 | §3.2 Statement import | T14 |
| FR-24 | §3.2 Statement import | T15 |
| FR-25 | §3.3 Bank transactions | T5, T15 |
| FR-26 | §3.3 Bank transactions | T15, T44, T46 |
| FR-27–FR-28 | §3.3 Bank transactions | T15 |
| FR-29 | §3.3 Bank transactions | T16 |
| FR-30 | §3.3 Bank transactions | T15, T16 |
| FR-31 | §3.3 Bank transactions | T20 |
| FR-32 | §3.3 Bank transactions | T16, T20 |
| FR-33 | §3.4 Bank feeds and payment initiation | T45, T48 |
| FR-34 | §3.4 Bank feeds and payment initiation | T46 |
| FR-35 | §3.4 Bank feeds and payment initiation | T47 |
| FR-36 | §3.4 Bank feeds and payment initiation | T46 |
| FR-37 | §3.4 Bank feeds and payment initiation | T45 |
| FR-38 | §3.4 Bank feeds and payment initiation | T43, T44 |
| FR-39 | §3.4 Bank feeds and payment initiation | T56 |
| FR-40 | §3.5 Suggestions, party recognition and rules | T17, T18 |
| FR-41 | §3.5 Suggestions, party recognition and rules | T18 |
| FR-42 | §3.5 Suggestions, party recognition and rules | T19 |
| FR-43 | §3.5 Suggestions, party recognition and rules | T18, T20 |
| FR-44 | §3.5 Suggestions, party recognition and rules | T18, T32 |
| FR-45–FR-46 | §3.5 Suggestions, party recognition and rules | T23 |
| FR-47 | §3.5 Suggestions, party recognition and rules | T22, T34 |
| FR-48 | §3.5 Suggestions, party recognition and rules | T22 |
| FR-49 | §3.5 Suggestions, party recognition and rules | T22, T23 |
| FR-50–FR-52 | §3.5 Suggestions, party recognition and rules | T22 |
| FR-53–FR-54 | §3.6 Reconciliation workspace | T32 |
| FR-55 | §3.6 Reconciliation workspace | T20, T33 |
| FR-56 | §3.6 Reconciliation workspace | T21, T33 |
| FR-57 | §3.6 Reconciliation workspace | T33 |
| FR-58 | §3.6 Reconciliation workspace | T53 |
| FR-59 | §3.6 Reconciliation workspace | T62 |
| FR-60 | §3.6 Reconciliation workspace | T20, T33 |
| FR-61–FR-63 | §3.7 Checkpoints, clearing and balances | T24, T35 |
| FR-64 | §3.7 Checkpoints, clearing and balances | T16 |
| FR-65 | §3.7 Checkpoints, clearing and balances | T24, T35 |
| FR-66 | §3.7 Checkpoints, clearing and balances | T63 |
| FR-67 | §3.7 Checkpoints, clearing and balances | T25 |
| FR-68 | §3.7 Checkpoints, clearing and balances | T25, T30, T38 |
| FR-69 | §3.7 Checkpoints, clearing and balances | T54 |
| FR-70 | §3.8 Bank guarantees | T26, T36 |
| FR-71 | §3.8 Bank guarantees | T26, T36 |
| FR-72 | §3.8 Bank guarantees | T26 |
| FR-73 | §3.8 Bank guarantees | T26, T36 |
| FR-74–FR-75 | §3.9 Reports | T29 |
| FR-76 | §3.10 Learning, agents, alerts and compatibility | T49 |
| FR-77 | §3.10 Learning, agents, alerts and compatibility | T51 |
| FR-78 | §3.10 Learning, agents, alerts and compatibility | T50 |
| FR-79 | §3.10 Learning, agents, alerts and compatibility | T52 |
| FR-80 | §3.10 Learning, agents, alerts and compatibility | T39, T52, T54 |
| FR-81 | §3.10 Learning, agents, alerts and compatibility | T55 |
| FR-82 | §3.10 Learning, agents, alerts and compatibility | T49 |
| FR-83 | §3.10 Learning, agents, alerts and compatibility | T28 |
| FR-84 | §3.10 Learning, agents, alerts and compatibility | T2, T60 |
| FR-85 | §3.10 Learning, agents, alerts and compatibility | T64 |
| FR-86 | §3.10 Learning, agents, alerts and compatibility | T40 |
| FR-87 | §3.10 Learning, agents, alerts and compatibility | T4, T11, T59 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- The provider contract suite passes for the sandbox provider; every reader has fixture files for each layout.
- The daily integrity check (matched amounts equal live matches; no counterpart over-matched) is green on the seed.
- The plugin boots and reconciles against payments with `accounting` absent.
- No table outside `party_bank_account` and `bank_account` holds an account number; every full-number read has an
  access-log entry.
- Every report of spec §3.9 has a dataset spec; every MCP write tool has a "preview writes nothing" spec.
