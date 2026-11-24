# Task Breakdown: General ledger

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `general-ledger`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to `packages/plugins/accounting/src/lib/` unless they start with `packages/` or `apps/`; `ui/`
  means `packages/plugins/accounting-ui/src/lib/`.
  The plugin scaffold, flags and foundation services come from `accounting-foundation` (its T1 to T37).
- Migration timestamps: `1791000073100` to `1791000073199` (`packages/plugins/accounting`); file names as listed
  in plan §3 Migrations.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Posting contract `packages/contracts/src/lib/ledger-posting.model.ts` (registration, facts, fact
      amount, request, line, result, check, finding, `LedgerPostingCode`, `LedgerPostingArea`) with fixtures in
      `packages/contracts/src/lib/testing/ledger-posting.fixtures.ts`. Test: fixtures type-check; a contract spec
      sibling plugins can import.
- [ ] **T2**. Ledger contracts `packages/contracts/src/lib/ledger.model.ts` (journal with revision, line, kinds,
      origins, balance, open-item view, lock, checklist, run item, exception, manual journal, finding with source,
      rate source) and the `RuleOwnerType` values `LEDGER_POSTING_RULE_LINE`, `LEDGER_ACCOUNT_RULE` in
      `packages/contracts/src/lib/rule.model.ts`.
      Test: type-level spec.
- [ ] **T3**. Permissions: the twenty-three keys of plan §9 in `accounting.permissions.ts` with their `defaultFor`
      grants. Test: catalogue spec; `ACCOUNTING_JOURNAL_EDIT_POSTED` granted to super admin only.
- [ ] **T4**. Entities and MikroORM repositories `ledger/ledger-head.entity.ts`, `ledger-journal.entity.ts`,
      `ledger-line.entity.ts`, `ledger-journal-link.entity.ts`, `ledger-balance.entity.ts`,
      `ledger-closing-balance.entity.ts` (repositories in `ledger/repository/mikro-orm-<entity>.repository.ts`). Test:
      ORM parity spec.
- [ ] **T5**. Migration `database/migrations/1791000073100-CreateLedgerJournalTables.ts` with append-only triggers on
      journal, line and link for the three dialects (the journal trigger admits only `supersededById` going from null
      to a value, with `ledger.allowPostedJournalEdit` on or off: an edit writes a superseding revision, T70). Test: `database/ledger-append-only.db.spec.ts` (update and delete refused on SQLite, any other
      journal column change refused; PostgreSQL and MySQL variants run in CI). Migration timestamps: `1791000073100` to `1791000073199` (`packages/plugins/accounting`).
- [ ] **T6** (parallel). Entities under `rules/` (`ledger-posting-rule.entity.ts`, `ledger-posting-rule-line.entity.ts`,
      `ledger-account-rule.entity.ts`, `ledger-party-account.entity.ts`, `ledger-intercompany-pair.entity.ts`;
      conditions are core `rule` rows) and migration `database/migrations/1791000073110-CreateLedgerRuleTables.ts`. Test:
      migration spec.
- [ ] **T7** (parallel). Entities `manual-journal/manual-journal.entity.ts`, `manual-journal-line.entity.ts`,
      `manual-journal-template.entity.ts`, `manual-journal-template-line.entity.ts` and migration
      `database/migrations/1791000073120-CreateManualJournalTables.ts`. Test: migration spec.
- [ ] **T8** (parallel). `open-item/ledger-open-item.service.ts`: client of `OPEN_ITEM_REGISTER` (list,
      outstanding, advances for, open for manual and opening control lines, control check); no open-item tables.
      Test: contract test against a register fake; a control line without the register is refused with
      `LEDGER_OPEN_ITEM_REGISTER_ABSENT`.
- [ ] **T9** (parallel). Entities `lock/ledger-lock.entity.ts`, `close/ledger-close-checklist.entity.ts` (with
      `closeTaskId`), `close/ledger-close-item.entity.ts` (check items), `close/ledger-close-template-item.entity.ts`
      (task template) and migration `database/migrations/1791000073130-CreateLedgerLockAndCloseTables.ts`. Test:
      migration spec.
- [ ] **T10** (parallel). Entities `run/ledger-run-item.entity.ts` (keyed by `operationId`),
      `ledger/ledger-posting-exception.entity.ts`, `health/ledger-integrity-finding.entity.ts` (with `source`),
      `currency/ledger-rate-source.entity.ts` and migrations
      `database/migrations/1791000073140-CreateLedgerRunItemAndHealthTables.ts`,
      `database/migrations/1791000073150-CreateLedgerRateSourceTable.ts`. Test: migration specs.
- [ ] **T11**. The `ledger.*` settings in `accounting.settings.ts`, including the tenant setting
      `ledger.allowPostedJournalEdit` (default false); no seed migration (grants come from T3). Test: settings
      catalogue spec; the edit setting resolves per tenant and defaults to off.

## Phase 2 — Services, endpoints, events

- [ ] **T12**. `ledger/pipeline/` pure steps: period resolution (`period.step.ts`), normalisation (`normalise.step.ts`),
      conversion (`convert.step.ts`), rounding (`rounding.step.ts`), balance and side validation (`validate.step.ts`),
      canonical serialisation and hash (`canonical-hash.ts`). Test: unit spec per step; property-based spec that any
      accepted request balances in organization currency.
- [ ] **T13**. `lock/ledger-lock.service.ts`: one model, `check(organizationId, area, date, actor)`, set and lift,
      the `TAX` area for journals with tax amounts (set by the tax engine on filing), fiscal-year validity as the same
      refusal, refusal payload (lock, author, reason, who can lift); controller `lock/ledger-lock.controller.ts`
      (`/locks`). Test: precedence of levels
      and areas; restricted lock honours `ACCOUNTING_PERIOD_POST_LOCKED`; a tax lock refuses a sales journal with tax
      lines and admits one without.
- [ ] **T14**. `ledger/ledger-posting.service.ts` `post(manager, request)`: idempotency, head lock, numbering
      through the gap-free series of `LEDGER_DOCUMENTS` inside the transaction (never core `SequenceService`
      directly), journal, lines, register items for manual and opening control lines, balance upserts, outbox event,
      both ORMs. Test: `ledger-posting.db.spec.ts` (replay returns the first journal; concurrent posts keep
      sequence and chain; all-or-nothing on a failing line); ORM parity spec.
- [ ] **T15**. Dimension step: defaults, derivation, rules, fixed splits, line distributions, balanced-dimension
      offsets, calling the foundation services. Files: `ledger/pipeline/dimension.step.ts`. Test: split remainder to
      the largest share; offsets net to zero.
- [ ] **T16**. `ledger/ledger-balance.service.ts` (`balance`, `trialBalance`, merge-aware effective account,
      rebuild) and `GET /balances`, `/balances/trial` (`ledger/ledger-balance.controller.ts`). Test: balances equal a
      scan of lines after random postings.
- [ ] **T17**. `ledger/ledger-journal.controller.ts` and `ledger-line.controller.ts` (list, detail, explain,
      inquiry with running balance, cursor pagination) plus refusal of generic write routes. Test: controller
      specs; 403 without `ACCOUNTING_LEDGER_VIEW`.
- [ ] **T18**. Reversal: `reverse`, date rule, one reversal per journal, `asDraft`. Files:
      `ledger/ledger-reversal.service.ts`, `ledger/ledger-journal.controller.ts` (`POST /journals/:id/reverse`),
      `ledger/dto/reverse-journal.dto.ts`. Test: concurrent reversals
      yield one; locked original date moves to the earliest open date.
- [ ] **T19**. Manual journals: service (draft, rules of spec FR-35, confirm posts in the request, cancel
      reverses), registration as document type `accounting.manual_journal`, controller and DTOs. Files:
      `manual-journal/manual-journal.service.ts`, `manual-journal/manual-journal.controller.ts`,
      `manual-journal/dto/create-manual-journal.dto.ts`, `manual-journal/dto/update-manual-journal.dto.ts`,
      `manual-journal/manual-journal.document-type.ts`. Test: one spec
      per refusal; confirm is idempotent.
- [ ] **T20** (parallel). Manual journal helpers (difference, open items, transfer), templates with fixed,
      percentage and prompted amounts, controller. Files: `manual-journal/manual-journal-helpers.service.ts`,
      `manual-journal/journal-template.service.ts`, `manual-journal/journal-template.controller.ts`,
      `manual-journal/dto/journal-template.dto.ts`. Test: template application spec.
- [ ] **T21** (parallel). Auto-reversing journals and the daily job `accounting.journal.auto-reverse`; recurrence
      through the document engine. Files: `manual-journal/manual-journal-auto-reverse.service.ts`,
      `manual-journal/manual-journal-recurrence.ts`, `schedule/journal-auto-reverse.scheduler.ts`. Test: reversal
      posted once when the date opens.
- [ ] **T22**. `rules/ledger-document-type.registry.ts`: registration, component and role validation, balance
      proof of default rules on samples at bootstrap; `GET /document-types`. Test: an unbalanced default rule
      fails startup.
- [ ] **T23**. `rules/rule-engine.ts`: facts to request (sides, policies, conditions as core `rule` rows of owner
      `LEDGER_POSTING_RULE_LINE` evaluated with `evaluateRuleSet`, merge). Test: table-driven specs on the contract
      fixtures; property-based balance spec.
- [ ] **T24**. `rules/account-determination.service.ts`: line account, `LEDGER_ACCOUNT_RESOLVER`, account rules
      (conditions as `rule` rows of owner `LEDGER_ACCOUNT_RULE`) by specificity and priority, party accounts (party,
      group), designations, explanation; tax amounts only through `LEDGER_TAX_AMOUNTS`. Test: precedence spec; an
      account rule cannot name a tax rate part.
- [ ] **T25**. Posting rule and account rule management: override copy, versions, activation, simulation against
      samples and past documents; controllers. Files: `rules/posting-rule.service.ts`, `rules/posting-rule.controller.ts`,
      `rules/account-rule.service.ts`, `rules/account-rule.controller.ts`, `rules/rule-simulation.service.ts`,
      `rules/dto/posting-rule.dto.ts`. Test: activation refused for an unbalanced rule set.
- [ ] **T26**. `check(facts)`, `preview(...)` and `confirming(manager, facts)` with the `LedgerPipelineParticipant`
      extension points; `POST /posting/preview`; registration as effects provider and confirm hook through
      `LEDGER_DOCUMENTS`. Files: `ledger/ledger-posting.service.ts`, `ledger/pipeline/ledger-pipeline-participant.ts`,
      `ledger/posting-preview.controller.ts`, `ledger/ledger-documents.registration.ts`. Test: preview equals the
      posted journal line for line; a participant's blocking finding aborts the confirmation.
- [ ] **T27**. Consumer `events/accounting-posting.consumer.ts` (`subscriber:accounting-posting`, strict order):
      confirmed, cancelled, amended; go-live and registration skips; facts inline or through
      `LEDGER_POSTING_SOURCE`. Test: duplicate delivery posts once; out-of-order delivery is refused and retried.
- [ ] **T28**. Posting exceptions: creation on functional refusal, `accounting.journal.failed`, retry job, remedy,
      worklist controller. Files: `ledger/ledger-posting-exception.service.ts`,
      `ledger/ledger-posting-exception.controller.ts`, `schedule/posting-exception-retry.scheduler.ts`. Test: exception
      resolves by itself after the missing rule is added; a document cancelled before the nightly retry has its open
      exception `SUPERSEDED` with the reason, and the retry writes no journal for it, also when the cancellation event
      and the retry run at the same time; a retry that locked the exception and read the document as active before the
      cancellation posts its journal, and the cancellation, waiting on that exception lock, reverses the journal.
- [ ] **T29**. Control-account lines: every line on a control account names a register item (the owner's
      `openItemId`, or one opened through `OPEN_ITEM_REGISTER` for manual and opening lines), party and side checked
      against it; advances and earmarks read from the register; `GET /open-items/control-check`. Files:
      `open-item/ledger-control-line.validator.ts`, `open-item/ledger-open-item.controller.ts`. Test: control
      account equals the register's open items after random postings; with postings of 100 on October 1 and 200 on
      October 20, the control balance as of October 10 is 100 and as of October 31 is 300; an invoice dated in a closed period whose
      journal posts on the first open date (setting off) is listed as a timing difference as of its document date and
      matches from its posting date; a posting exception is listed as a timing difference until it posts; a 100
      invoice settled by a 90 payment and a 10 discount whose discount journal has not posted yet lists the 10 as a
      timing difference of the allocation, not a mismatch; an altered line is a mismatch.
- [ ] **T30**. Allocation postings: consumer of `payments.allocation.created` / `.released` (type
      `payment_allocation`) posting realized exchange difference, settlement discount, advance reclassification and
      the netting transfer for linked parties, reversed on release; idempotent per allocation. Files:
      `events/accounting-allocation.consumer.ts`, `ledger/allocation-posting.service.ts`. Test: `.db.spec.ts`
      where a release reverses exactly the journals of its allocation.
- [ ] **T31**. Cancellation and amendment: reverse journals (allocations released first by
      `payments-and-collections`), correction pairs, `POST /documents/:type/:id/reclassify`. Files:
      `ledger/ledger-correction.service.ts`, `ledger/document-reclassify.controller.ts`. Test: originals remain;
      net effect equals the new version.
- [ ] **T32** (parallel). Party accounts, the counterparty from `organization_vendor.contactId`, stocked-item role
      resolution; controllers. Files: `rules/ledger-party-account.service.ts`, `rules/ledger-party-account.controller.ts`,
      `rules/counterparty.resolver.ts`, `rules/stocked-item-role.resolver.ts`. Test: fallback order; change affects new
      postings only; a vendor naming a contact nets with it; a party account holds items in two currencies unless
      fixed to one.
- [ ] **T33**. Events of plan §5 on every write path, realtime hints, activity log entries. Files:
      `events/accounting-ledger.events.ts`, `events/accounting-realtime.hints.ts`, `ledger/ledger-activity-log.writer.ts`.
      Test: one event per journal in the same transaction.
- [ ] **T34**. Ports and bindings in `apps/api/src/plugin-composition.ts` (`LEDGER_EXCHANGE_RATES` to
      `ExchangeRateService`, `LEDGER_TAX_AMOUNTS`, `LEDGER_DOCUMENTS`, `LEDGER_APPROVALS`, `OPEN_ITEM_REGISTER`,
      `LEDGER_FINDINGS`, sibling tokens to the ledger services). Test: composition spec; boot with every port unbound.
- [ ] **T35**. Worker and API split: `AccountingSchedulePlugin` schedules of plan §8 (recorded in `job_execution`),
      queue `accounting-ledger`, registered operation types, in-process timers without a queue. Files:
      `schedule/accounting-schedule.plugin.ts`, `schedule/accounting-ledger.queue.ts`,
      `operations/ledger-operation-types.ts`, `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts`. Test: plugin-list
      specs of API and worker.
- [ ] **T36**. GraphQL reads and report-builder datasets (journals, lines, balances; superseded revisions excluded).
      Files: `graphql/ledger.resolver.ts`, `graphql/ledger.schema.ts`, `reports/ledger-report-datasets.ts`. Test:
      resolver specs; dataset registration spec.
- [ ] **T69** (parallel). Party role registry `rules/ledger-party-role.registry.ts` (contacts, vendors, employees,
      shareholders, roles registered by other plugins; receivable or payable side), used by party validation of lines,
      open items and payments; `GET /party-roles`. Test: a party of an unregistered role is refused with
      `LEDGER_PARTY_ROLE`; a role a plugin registers is accepted.
- [ ] **T76**. Go-live lock (FR-65): on `accounting.profile.went_live` a closed lock of origin `GO_LIVE` for all areas
      through the day before the cut-over date, which only the opening balance procedure passes; documents dated
      earlier keep being saved, amended and cancelled without journals. Files: `lock/ledger-go-live.consumer.ts`,
      `lock/ledger-lock.service.ts`. Test: after going live a manual journal dated before the cut-over is refused, the
      opening balance journal posts there, and an invoice dated before it confirms with no journal.

## Phase 3 — UI surfaces

- [ ] **T37**. `accounting-ui` (routes on `accounting-sections`): journals list and detail, account ledger with
      running balance and drill-down. Files: `ui/accounting-ui.routes.ts`,
      `ui/components/journals-page/journals-page.component.ts`,
      `ui/components/journal-detail/journal-detail.component.ts`,
      `ui/components/account-ledger/account-ledger.component.ts`. Test: component specs.
- [ ] **T38**. Manual journal editor (grid, helpers, templates, import dialog). Files:
      `ui/components/manual-journal-editor/manual-journal-editor.component.ts`,
      `ui/components/journal-template-picker/journal-template-picker.component.ts`,
      `ui/components/journal-import-dialog/journal-import-dialog.component.ts`. Test: component specs; keyboard
      entry of a ten-line journal.
- [ ] **T39** (parallel). Ledger account and posting state columns contributed to the register's Open items page;
      posting exception worklist. Files: `ui/components/open-item-ledger-columns/open-item-ledger-columns.ts`,
      `ui/components/posting-exceptions-page/posting-exceptions-page.component.ts`. Test: component specs; the columns
      are absent while the feature is off.
- [ ] **T40** (parallel). Posting rules, simulation, account rules and party accounts pages. Files:
      `ui/components/posting-rules-page/posting-rules-page.component.ts`,
      `ui/components/rule-simulation/rule-simulation.component.ts`,
      `ui/components/account-rules-page/account-rules-page.component.ts`,
      `ui/components/party-accounts-page/party-accounts-page.component.ts`. Test: component specs.
- [ ] **T41**. Lock timeline page and `LockNotice`. Files: `ui/components/locks-page/locks-page.component.ts`,
      `ui/shared/lock-notice/lock-notice.component.ts` (`ga-lock-notice`). Test: component specs.
- [ ] **T42**. Shared Angular components exported by `accounting-ui`: `ga-accounting-effects-panel`,
      `ga-posting-state-badge`, `ga-balance-chip`. Files:
      `ui/shared/accounting-effects-panel/accounting-effects-panel.component.ts`,
      `ui/shared/posting-state-badge/posting-state-badge.component.ts`,
      `ui/shared/balance-chip/balance-chip.component.ts`. Test: component specs with a fixture preview.
- [ ] **T43**. i18n keys of all pages in 14 locales. Files: `packages/ui-core/i18n/assets/i18n/`. Test: key parity check.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T44**. MCP tools `packages/mcp-server/src/lib/tools/accounting-ledger.ts` for journals, preview, manual
      journals, inquiry, control check, locks, exceptions. Test: input-schema spec; `preview: true` writes nothing.
- [ ] **T45**. Import profile `accounting.manual_journal`, CSV export of journals and lines, audit file export.
      Files: `manual-journal/manual-journal.import-profile.ts`, `export/ledger-csv.exporter.ts`,
      `export/ledger-audit-file.exporter.ts`. Test: import with one invalid journal rejects only that journal.
- [ ] **T46**. OpenAPI document regenerated; SDK regeneration noted for release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: additive contract diff.
- [ ] **T47**. User docs (posting, manual journals, corrections, open items, locks) and index row. Files: `docs/specs/README.md`. Test: docs build.

## Phase 5 — Close and currencies

- [ ] **T48**. Rate resolution (`currency/rate-resolver.service.ts`: document rate, pair, inverse, peg, cross rate,
      staleness), pegs as `exchange_rate` rows with `providerKey = 'PEG'` (`/currency-pegs` reads and writes them
      through `ExchangeRateService`), `GET /rates/resolve`. Test: resolution order spec; a peg row yields inverse and
      cross rates.
- [ ] **T49**. Rate sources and the fetch job (reference feed adapter, custom endpoint adapter, secret in
      `IntegrationSetting`, outbound address policy). Files: `currency/rate-source.service.ts`,
      `currency/rate-source.controller.ts`, `currency/adapters/reference-feed.adapter.ts`,
      `currency/adapters/custom-endpoint.adapter.ts`, `schedule/rate-feed-fetch.scheduler.ts`. Test: adapter specs
      against recorded responses.
- [ ] **T50**. Reporting currency on lines and balances. Files: `ledger/pipeline/convert.step.ts`,
      `ledger/ledger-balance.service.ts`. Test: reporting amounts equal amount times rate of the day.
- [ ] **T51**. Realized exchange difference on settlement and its reversal on release. Files:
      `currency/realized-difference.calculator.ts`, `ledger/allocation-posting.service.ts`. Test: cross-rate fixtures.
- [ ] **T52**. Revaluation run (compute, preview, post, self-reversal or cumulative, residue clearing, schedule).
      Files: `currency/revaluation.service.ts`, `currency/revaluation.controller.ts`,
      `operations/ledger-revaluation.operation.ts`, `schedule/revaluation.scheduler.ts`. Test: rerun for the same date
      posts a correction pair only.
- [ ] **T53**. Close checklist: check registry (`LEDGER_CLOSE_CHECK`) with this feature's checks, evaluation job,
      waivers; manual tasks as core tasks (a parent task per period, one subtask per template item) and the check
      `close.tasks_done`; controller and page. Files: `close/ledger-close-check.registry.ts`, `close/checks/`,
      `close/ledger-close-checklist.service.ts`, `close/close-tasks.service.ts`, `close/ledger-close.controller.ts`,
      `schedule/close-checks-evaluate.scheduler.ts`, `ui/components/close-page/close-page.component.ts`. Test: a failing
      blocking check prevents close; an open subtask fails `close.tasks_done`.
- [ ] **T54**. Period close, closing balances, chain head, closed lock; reopen in reverse order. Files:
      `close/ledger-period-close.service.ts`, `close/ledger-closing-balance.service.ts`,
      `operations/ledger-period-close.operation.ts`, `operations/ledger-reopen.operation.ts`. Test: a posting
      racing the close is inside the totals or refused (`close/ledger-period-close.db.spec.ts`).
- [ ] **T55**. Year-end close run (per book, per dimension set or collapsed, slices, pause, resume) and year
      reopen. Files: `close/ledger-year-end.service.ts`, `operations/ledger-year-end-close.operation.ts`. Test: income
      and expense balances are zero after close; reopen restores them.
- [ ] **T56**. Long procedures as core operations: the operation types of plan §8 registered with the runtime
      (close, year-end, reopen, reposting, catch-up and revaluation on the shared aggregate
      `ledger:<organizationId>:procedure`, the other kinds on one aggregate per organization and kind; steps in
      slices), `ledger_run_item` results keyed by `operationId`, `/runs`
      routes. Files: `operations/ledger-operation-types.ts`, `run/ledger-run-item.service.ts`,
      `run/ledger-runs.controller.ts`. Test: resume after a crash completes without duplicates; a second run of the
      same kind is refused while one is live, and a reposting run is refused while a period close of the same
      organization is live (and the reverse), while a reposting run of another organization starts beside it.
- [ ] **T57**. Reposting and catch-up runs with per-document difference and result. Files:
      `run/ledger-reposting.service.ts`, `operations/ledger-repost.operation.ts`, `operations/ledger-catch-up.operation.ts`.
      Test: unchanged documents get no journal; locked dates follow the run option.
- [ ] **T58**. Inter-organization journals: pairs, mirror creation in the counterpart scope, linked reversal, pair
      balance list. Files: `manual-journal/inter-organization-journal.service.ts`,
      `rules/inter-organization-pair.controller.ts`. Test: totals equal; counterpart lock refuses.
- [ ] **T59**. Health monitor, findings, rebuild tools, divergence finder; the `LEDGER_FINDINGS` writer for other
      features' sources; page with a source filter. Files: `health/ledger-health-monitor.service.ts`,
      `health/ledger-findings.service.ts`, `health/divergence-finder.service.ts`, `health/ledger-rebuild.service.ts`,
      `health/ledger-health.controller.ts`, `ui/components/health-page/health-page.component.ts`. Test: a corrupted
      balance is reported and its day found; a finding raised by a fake banking source appears once.
- [ ] **T60**. Tax on manual journals through `LEDGER_TAX_AMOUNTS`; periodic stock adjustment through
      `LEDGER_STOCK_VALUE`. Files: `manual-journal/manual-journal-tax.service.ts`,
      `manual-journal/periodic-stock-adjustment.service.ts`. Test: port fakes; refused when perpetual postings are on.
- [ ] **T75**. Close preview (FR-23): `POST /close/:periodId/close` and `/close/year-end/:fiscalYearId` with
      `preview: true` answer the closing journals, the lock and the totals they would write, in the effects form of
      T26, writing nothing. Files: `close/ledger-period-close.service.ts`, `close/ledger-year-end.service.ts`,
      `close/ledger-close.controller.ts`. Test: the previewed closing journal equals the one the close then posts; a
      preview leaves no operation, lock or journal behind.

## Phase 6 — Advanced capabilities

- [ ] **T61**. Continuous checks (event-triggered, debounced) and live checklist. Files: `close/continuous-checks.consumer.ts`,
      `ui/components/close-page/close-page.component.ts`. Test: a check flips without a
      manual run.
- [ ] **T62**. Unlock requests through `LEDGER_APPROVALS`. Files: `lock/unlock-request.service.ts`,
      `lock/ledger-lock.controller.ts` (`/locks/unlock-requests`). Test: approval lifts the lock for the stated date only.
- [ ] **T63**. `assist/balance-explanation.service.ts` and `ledger_balance_explain`. Test: parts add up to the
      balance; respects the caller's permissions.
- [ ] **T64**. `assist/journal-proposal.service.ts` and `ledger_journal_propose` (draft with effects, agent mark).
      Test: nothing posted; draft needs a permitted confirmation.
- [ ] **T65**. Anomaly scan rules and review page; `ledger_anomaly_scan`. Files: `health/anomaly-scan.service.ts`,
      `health/anomaly-rules.ts`, `schedule/anomaly-scan.scheduler.ts`, `packages/mcp-server/src/lib/tools/accounting-ledger.ts`,
      `ui/components/anomalies-page/anomalies-page.component.ts`. Test: duplicated document flagged.
- [ ] **T66**. Close preparation tools for agents (`ledger_close_status`, `_evaluate`, explanation, proposed
      correcting drafts). Files: `assist/close-preparation.service.ts`,
      `packages/mcp-server/src/lib/tools/accounting-ledger.ts`. Test: a holder of `ACCOUNTING_CLOSE_PREPARE` alone
      cannot close or waive.
- [ ] **T67**. Live balances and document posting state in pages and shared components. Files:
      `ui/services/accounting-realtime.service.ts`, `ui/shared/posting-state-badge/posting-state-badge.component.ts`,
      `ui/shared/balance-chip/balance-chip.component.ts`. Test: two-client e2e.
- [ ] **T68**. Load test: 50 million lines, 200 postings per second, trial balance and inquiry targets of
      `spec.md` §4. Files: `benchmarks/ledger-load.bench.ts`. Test: recorded results in the PR.

## Phase 7 — Editable journals and further posting types

- [ ] **T70**. `ledger/ledger-journal-edit.service.ts` and `PUT /journals/:id`, `GET /journals/:id/revisions`: refused
      unless `ledger.allowPostedJournalEdit` is on for the tenant and the actor holds `ACCOUNTING_JOURNAL_EDIT_POSTED`;
      manual journals of user kinds only; full pipeline on the new content; one transaction writing the new revision
      (same number, next sequence and hash), the one-time `supersededById`, the `REVISION` link, balance deltas, the
      `activity_log` entry (before, after, reason) and `accounting.journal.edited`. Test: `.db.spec.ts` on the three
      engines: setting off refuses; edit keeps the number, balances equal lines and the chain verifies afterwards;
      document journals, settled or opening control lines and closed dates are refused; concurrent edits of one
      revision yield one; with the setting on, an in-place update of a journal or line is still refused by the trigger;
      a reversed manual journal and a reversal journal are refused with `LEDGER_JOURNAL_REVERSED`, and a reversal and an
      edit of one journal started together leave exactly one of them.
- [ ] **T71** (parallel). Edit dialog with revision history and differences in `journals`, the tenant setting on the
      settings page, `ledger_journal_edit` MCP tool, inbox notice to accounting administrators. Files:
      `ui/components/journal-edit-dialog/journal-edit-dialog.component.ts`,
      `ui/components/journal-revisions/journal-revisions.component.ts`,
      `ui/components/ledger-settings/ledger-settings.component.ts`,
      `packages/mcp-server/src/lib/tools/accounting-ledger.ts`, `ledger/ledger-journal-edit.service.ts` (inbox notice).
      Test: component specs; e2e edit with history shown; `preview: true` writes nothing.
- [ ] **T72**. Posting types `income` and `expense`: adapter answering `LEDGER_POSTING_SOURCE` for core `income` and
      stand-alone core `expense` rows (not those of `expenses-and-travel`), default rule sets, consumer of their core
      entity events (create posts, change corrects, delete reverses), catch-up for existing rows. Files:
      `ledger/income-expense-posting.source.ts`, `rules/default-rules/income-expense.rules.ts`,
      `events/core-income-expense.consumer.ts`. Test: an imported
      income row posts once; changing its amount posts a correction pair; the accounting dashboard's income equals the
      ledger's for the period.
- [ ] **T73**. Documents that exist without the ledger (spec FR-98): `existsWithoutLedger` on
      `ILedgerDocumentTypeRegistration` (true for invoices, estimates, payments, expenses, incomes and types built on
      them), the setting `ledger.refuseUnpostableDocuments` (false) in `accounting.settings.ts`, `confirming` returning
      the ledger's findings as warnings for those types while it is off, and `postFacts` moving locked or closed dates
      to the earliest open date and keeping future dates as retried exceptions. Test: `.db.spec.ts` with the setting
      off: an invoice with an undetermined account, a future date, a restricted lock, a closed period and a date before
      go-live each confirms, amends and cancels as without the ledger, and its posting is an exception, on the earliest
      open date or absent; with the setting on each is refused with its reason; a manual journal is refused in both.
- [ ] **T74**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `ACCOUNTING_LEDGER_POSTING`, `BANKING_FINDINGS`, `BANKING_JOURNAL_GATEWAY`, `LEDGER_EFFECTS_PREVIEW`, `LEDGER_PERIOD_GUARD`, `MANUFACTURING_LEDGER`, `ORGANIZATION_CURRENCY_PEGS`, `ORGANIZATION_LEDGER_TYPES`, `PAYROLL_LEDGER`, `PROJECT_LEDGER_ACTUALS`, `REPORT_FX_RATES`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Posting engine | T5, T14, T17 |
| FR-2 | §3.1 Posting engine | T12 |
| FR-3 | §3.1 Posting engine | T4, T14, T50 |
| FR-4 | §3.1 Posting engine | T14, T27, T31 |
| FR-5 | §3.1 Posting engine | T22, T27 |
| FR-6 | §3.1 Posting engine | T6, T23 |
| FR-7 | §3.1 Posting engine | T25 |
| FR-8 | §3.1 Posting engine | T24 |
| FR-9 | §3.1 Posting engine | T12 |
| FR-10 | §3.1 Posting engine | T17, T24 |
| FR-11–FR-12 | §3.1 Posting engine | T12 |
| FR-13 | §3.1 Posting engine | T15 |
| FR-14 | §3.1 Posting engine | T12, T13, T15, T24 |
| FR-15 | §3.1 Posting engine | T26, T73 |
| FR-16 | §3.1 Posting engine | T27, T42, T67 |
| FR-17 | §3.1 Posting engine | T28 |
| FR-18 | §3.1 Posting engine | T27, T57 |
| FR-19 | §3.1 Posting engine | T14 |
| FR-20 | §3.1 Posting engine | T14, T29 |
| FR-21 | §3.2 Effects preview | T26 |
| FR-22 | §3.2 Effects preview | T26, T42, T44 |
| FR-23 | §3.2 Effects preview | T26, T52, T57, T75 |
| FR-24 | §3.3 Immutability, reversal and correction | T5, T17, T70 |
| FR-25 | §3.3 Immutability, reversal and correction | T18 |
| FR-26 | §3.3 Immutability, reversal and correction | T18 |
| FR-27 | §3.3 Immutability, reversal and correction | T30, T31 |
| FR-28–FR-29 | §3.3 Immutability, reversal and correction | T31 |
| FR-30 | §3.3 Immutability, reversal and correction | T56, T57 |
| FR-31 | §3.3 Immutability, reversal and correction | T18, T57 |
| FR-32 | §3.3 Immutability, reversal and correction | T12, T14, T54 |
| FR-33 | §3.4 Manual journals | T7, T19 |
| FR-34–FR-36 | §3.4 Manual journals | T19 |
| FR-37 | §3.4 Manual journals | T20 |
| FR-38 | §3.4 Manual journals | T21 |
| FR-39 | §3.4 Manual journals | T20 |
| FR-40 | §3.4 Manual journals | T21 |
| FR-41 | §3.4 Manual journals | T45 |
| FR-42 | §3.4 Manual journals | T60 |
| FR-43 | §3.4 Manual journals | T60 |
| FR-44–FR-45 | §3.4 Manual journals | T58 |
| FR-46 | §3.5 Open items (receivable and payable control accounts) | T8, T29 |
| FR-47–FR-48 | §3.5 Open items (receivable and payable control accounts) | T8, T29, T30 |
| FR-49–FR-50 | §3.5 Open items (receivable and payable control accounts) | T8, T29 |
| FR-51 | §3.5 Open items (receivable and payable control accounts) | T30, T32 |
| FR-52 | §3.5 Open items (receivable and payable control accounts) | T29, T56 |
| FR-53 | §3.5 Open items (receivable and payable control accounts) | T8, T39 |
| FR-54 | §3.6 Party accounts | T24, T32 |
| FR-55 | §3.6 Party accounts | T30, T32 |
| FR-56–FR-57 | §3.6 Party accounts | T32 |
| FR-58 | §3.6 Party accounts | T32 |
| FR-59–FR-62 | §3.7 Period locks | T13 |
| FR-63 | §3.7 Period locks | T13, T62 |
| FR-64 | §3.7 Period locks | T13, T22 |
| FR-65 | §3.7 Period locks | T33, T41, T76 |
| FR-66 | §3.8 Period close and year-end | T9, T53 |
| FR-67 | §3.8 Period close and year-end | T53 |
| FR-68 | §3.8 Period close and year-end | T53, T61 |
| FR-69 | §3.8 Period close and year-end | T54 |
| FR-70–FR-71 | §3.8 Period close and year-end | T55, T56 |
| FR-72 | §3.8 Period close and year-end | T54, T55 |
| FR-73 | §3.8 Period close and year-end | T54, T73 |
| FR-74 | §3.8 Period close and year-end | T54 |
| FR-75 | §3.8 Period close and year-end | T66 |
| FR-76 | §3.9 Multi-currency accounting | T48 |
| FR-77 | §3.9 Multi-currency accounting | T49 |
| FR-78 | §3.9 Multi-currency accounting | T48 |
| FR-79 | §3.9 Multi-currency accounting | T50 |
| FR-80 | §3.9 Multi-currency accounting | T30, T51 |
| FR-81–FR-83 | §3.9 Multi-currency accounting | T52 |
| FR-84 | §3.10 Ledger integrity | T59 |
| FR-85 | §3.10 Ledger integrity | T59 |
| FR-86 | §3.10 Ledger integrity | T16, T59 |
| FR-87 | §3.10 Ledger integrity | T65 |
| FR-88 | §3.11 Balances, inquiry and assistance | T14, T16, T67, T68 |
| FR-89 | §3.11 Balances, inquiry and assistance | T17, T36, T37 |
| FR-90 | §3.11 Balances, inquiry and assistance | T44, T71 |
| FR-91 | §3.11 Balances, inquiry and assistance | T63 |
| FR-92 | §3.11 Balances, inquiry and assistance | T64 |
| FR-93 | §3.11 Balances, inquiry and assistance | T14, T17, T45 |
| FR-94 | §3.11 Balances, inquiry and assistance | T33 |
| FR-95 | §3.6 Party accounts | T69 |
| FR-96 | §3.12 Editing posted journals | T11, T70, T71 |
| FR-97 | §3.12 Editing posted journals | T70, T71 |
| FR-98 | §3.13 Documents that exist without the ledger | T73 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Ledger invariants hold in tests on all three engines: every journal balances, balances equal lines, each
  control account equals the register's open items, the hash chain verifies (also after edits), no update or delete
  of a line succeeds, and with the edit setting off no journal can be edited.
- The contract fixtures in `packages/contracts` pass in this plugin and in every sibling plugin that publishes
  posting facts.
- With `ledger.refuseUnpostableDocuments` off (the default), no invoice, estimate, payment, expense or income is refused
  because of the ledger (AC-19).
- The effects preview of each registered document type equals its posted journal.
