# Task Breakdown: Accounting foundation

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `accounting-foundation`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to `packages/plugins/accounting/src/lib/` unless they start with `packages/`, `apps/`, `docs/` or
  `tools/`, name a repository root file (`tsconfig.base.json`, `.env.sample`) or the docs site;
  `UI/` = `packages/plugins/accounting-ui/src/lib/`. Every entity file has its `repository/type-orm-<name>.repository.ts`
  and `repository/mikro-orm-<name>.repository.ts` beside it, every controller its `dto/` folder; migrations live in
  `database/migrations/` and are listed in `database/accounting-migrations.ts`; Angular components sit in
  `UI/components/<name>/<name>.component.ts` with their `*.component.spec.ts`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/accounting.model.ts` (profile, account, class, kind, type and
      traits, designation roles, category, template, import findings, fiscal year and period, patterns, ledger
      book) exported from `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/accounting.model.spec.ts`
      (type-level spec compiling every interface with a sample).
- [ ] **T2**. Plugin scaffold `packages/plugins/accounting` (package, project, tsconfig, jest, eslint, path mapping),
      `accounting.plugin.ts`, `accounting.module.ts`, `accounting.features.ts` (`FEATURE_ACCOUNTING`, default off),
      `accounting.settings.ts` (the settings of plan §3, including the chart and fiscal-year options),
      `accounting-enabled.ts` (`isAccountingEnabled`, exact `true`), `.env.sample` line. Files:
      `packages/plugins/accounting/` (`package.json`, `project.json`, `tsconfig.json`, `tsconfig.lib.json`,
      `jest.config.ts`, `.eslintrc.json`, `src/index.ts`), `accounting.plugin.ts`, `accounting.module.ts`,
      `accounting.features.ts`, `accounting.settings.ts`, `accounting-enabled.ts`, `tsconfig.base.json` (path mapping),
      `.env.sample`. Test: `accounting-enabled.spec.ts`; `accounting.plugin.spec.ts` (features, settings, no entity
      yet).
- [ ] **T3**. Registration in `apps/api/src/plugins.ts` (`AccountingPlugin`) and `apps/worker/src/plugins.ts`
      (`AccountingSchedulePlugin`) behind `isAccountingEnabled`. Test: `apps/api/src/plugins.matrix.spec.ts` and
      `apps/worker/src/plugins.spec.ts`, flag on and off.
- [ ] **T4**. `accounting.permissions.ts` with the thirteen keys of plan §9, their labels and `defaultFor` grants.
      Test: `accounting.permissions.spec.ts` (every key used by a controller is declared, and the reverse).
- [ ] **T5**. Plugin migration builders `database/accounting-migration-builders.ts` (base columns, foreign keys,
      live-unique index for the three dialects) on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), no copy of those helpers. Files:
      `database/accounting-migration-builders.ts`, `database/accounting-migrations.ts`. Test:
      `database/accounting-migration-builders.spec.ts` on SQLite. Migration timestamps: `1791000072100` to `1791000072199` (`packages/plugins/accounting`).
- [ ] **T6**. Entities and MikroORM repositories `profile/accounting-profile.entity.ts`, `chart/ledger-account.entity.ts`,
      `chart/ledger-account-designation.entity.ts`, `chart/ledger-account-category.entity.ts`,
      `template/chart-template.entity.ts` (merges and import runs are `data-exchange` rows). Test:
      `accounting-orm-parity.spec.ts` (both ORMs map the same columns).
- [ ] **T7**. Migration `CreateAccountingProfileAndChartTables` (three dialects, idempotent). Files:
      `database/migrations/1791000072100-CreateAccountingProfileAndChartTables.ts`, `database/accounting-migrations.ts`.
      Test: `database/accounting-migrations.spec.ts` on SQLite up and down; unique (live) code and sibling name
      enforced, root accounts included (`parentKey` `*`): two concurrent renames of root accounts to one name on
      PostgreSQL, MySQL and SQLite leave one success and one refusal.
- [ ] **T8** (parallel). Entities `calendar/fiscal-year.entity.ts`, `calendar/fiscal-period.entity.ts`,
      `book/ledger-book.entity.ts` and migration `CreateFiscalCalendarAndLedgerBookTables`. Files:
      `database/migrations/1791000072110-CreateFiscalCalendarAndLedgerBookTables.ts`. Test:
      `database/accounting-migrations.spec.ts` (one primary book per organization enforced).
- [ ] **T9** (parallel). Contracts for dimensions (dimension, value, set, rule, default, split, proposal, seasonal
      distribution, opening balance, validation result) in `accounting.model.ts`. Files:
      `packages/contracts/src/lib/accounting.model.ts`. Test: `packages/contracts/src/lib/accounting.model.spec.ts`.
- [ ] **T10**. Entities under `dimension/` (dimension, own value, set, set value, rule header, default, split rule,
      share, allocation proposal) and migration `CreateAnalyticDimensionTables` with append-only triggers on the two
      set tables; `RuleOwnerType.ANALYTIC_DIMENSION_RULE` in `packages/contracts/src/lib/rule.model.ts`. Files:
      `dimension/analytic-dimension.entity.ts`, `dimension/analytic-dimension-value.entity.ts`,
      `dimension/analytic-dimension-set.entity.ts`, `dimension/analytic-dimension-set-value.entity.ts`,
      `dimension/analytic-dimension-rule.entity.ts`, `dimension/analytic-dimension-default.entity.ts`,
      `dimension/analytic-split-rule.entity.ts`, `dimension/analytic-split-rule-share.entity.ts`,
      `dimension/analytic-allocation-proposal.entity.ts`,
      `database/migrations/1791000072120-CreateAnalyticDimensionTables.ts`. Test: `database/accounting-migrations.spec.ts`
      (update and delete of a set refused on SQLite).
- [ ] **T11** (parallel). Entities `distribution/seasonal-distribution*.entity.ts`, `opening/opening-balance*.entity.ts`
      and migrations `CreateSeasonalDistributionTables`, `CreateOpeningBalanceTables`. Files:
      `distribution/seasonal-distribution.entity.ts`, `distribution/seasonal-distribution-weight.entity.ts`,
      `opening/opening-balance.entity.ts`, `opening/opening-balance-line.entity.ts`,
      `database/migrations/1791000072130-CreateSeasonalDistributionTables.ts`,
      `database/migrations/1791000072140-CreateOpeningBalanceTables.ts`. Test: `database/accounting-migrations.spec.ts`.
- [ ] **T12**. Default grants as `defaultFor` on the permission contributions of T4 (super admin, admin; dimension
      view also manager and employee); no seed migration. Files: `accounting.permissions.ts`. Test:
      `accounting.permissions.grants.spec.ts` (a new tenant gets the grants; the permission reload adds missing grants to
      an existing tenant and touches nothing else).

## Phase 2 — Services, endpoints, events

- [ ] **T13**. `profile/accounting-profile.service.ts` and `profile/accounting-readiness.service.ts` (findings of
      spec FR-4), `profile/accounting-profile.controller.ts` (`/profile`, `/readiness`, `/profile/go-live`).
      Test: `profile/accounting-readiness.service.spec.ts` (one case per finding);
      `profile/accounting-profile.service.spec.ts` (resumable setup; go-live refused with a blocking finding).
- [ ] **T14**. `chart/ledger-account-type.registry.ts` (traits, allowed classes, plugin contributions) with the
      core types; `GET /account-types`. Files: `chart/ledger-account-type.registry.ts`,
      `chart/ledger-account-type.controller.ts`. Test: `chart/ledger-account-type.registry.spec.ts` (duplicate key fails
      bootstrap; unknown type readable).
- [ ] **T15**. `chart/ledger-account.service.ts`: create, update with version check, move, reorder, archive,
      restore, delete; class, group, code and name rules (spec FR-7 to FR-15). Test: `chart/ledger-account.service.spec.ts`
      (one case per refusal); `chart/ledger-account.db.spec.ts` for path maintenance on move.
- [ ] **T16**. `chart/ledger-account.controller.ts` with DTOs, `@Permissions`, `@FeatureFlag`, Swagger, cursor
      pagination, `If-Match`. Test: `chart/ledger-account.controller.spec.ts` (403 without permission, 409 on stale
      version; tree and list reads with search).
- [ ] **T17**. `chart/ledger-account-reference.registry.ts` (holders register a "who references this account"
      reader) and `GET /accounts/:id/references`; archive, delete and regroup refusals list references.
      Test: `chart/ledger-account-reference.registry.spec.ts` (two fake holders).
- [ ] **T18** (parallel). `chart/ledger-account-designation.service.ts` and controller; role catalogue with
      contributed roles. Files: `chart/ledger-account-designation.controller.ts`, `chart/designation-role.catalogue.ts`.
      Test: `chart/ledger-account-designation.service.spec.ts` (one account per role; designated account cannot be
      archived).
- [ ] **T19** (parallel). `chart/ledger-account-category.service.ts` and controller. Files:
      `chart/ledger-account-category.controller.ts`. Test: `chart/ledger-account-category.service.spec.ts` (delete and
      class change refused in use; margin tier and cash-flow section kept).
- [ ] **T20**. Controls: currency restriction, expected side, restricted flag validations on the account service,
      the type-change refusals of spec FR-18, and a `LedgerAccountPolicyReader` for the ledger. Files:
      `chart/ledger-account-controls.ts`, `chart/ledger-account-policy.reader.ts`, `chart/ledger-account.service.ts`. Test:
      `chart/ledger-account-controls.spec.ts` (currency change refused once another currency exists, reader faked when
      `general-ledger` is absent; control trait removal refused on an account with lines).
- [ ] **T21**. `chart/ledger-account-renumber.service.ts` with preview. Files: `chart/ledger-account.controller.ts`
      (`/accounts/renumber`). Test: `chart/ledger-account-renumber.service.spec.ts` (all-or-nothing on a code clash).
- [ ] **T22**. `calendar/fiscal-calendar.service.ts`: years (overlap, gap, irregular length), period patterns,
      adjustment periods, edit limits, `periodOf`, one year for several organizations, a child following its parent's
      calendar, delete only without lines; controller. Files: `calendar/fiscal-calendar.controller.ts`,
      `calendar/period-patterns.ts`. Test: `calendar/period-patterns.spec.ts` (each pattern covers the year exactly);
      `calendar/fiscal-calendar.db.spec.ts` (overlap refused under concurrency).
- [ ] **T23** (parallel). `book/ledger-book.service.ts` and controller. Files: `book/ledger-book.controller.ts`.
      Test: `book/ledger-book.service.spec.ts` (limit; primary rules; archive instead of delete with lines).
- [ ] **T24**. Organization fields: first-year proposal from `fiscalStartDate` / `fiscalEndDate`, a readiness finding
      with an "update" action when they differ from the current year, and keeping them equal to it only while
      `accounting.syncOrganizationFiscalDates` is on (`calendar/organization-fiscal-sync.service.ts`); the profile's
      `ledgerCurrency` taken from `organization.currency` at setup, and the organization update guard refusing a
      currency change once live only while `accounting.lockOrganizationCurrency` is on
      (`profile/organization-currency.guard.ts`). Test: `calendar/organization-fiscal-sync.service.spec.ts` and
      `profile/organization-currency.guard.spec.ts`: no write while the feature is off or the setting is
      off; with the settings at their defaults the organization's currency and fiscal dates change after go-live as
      before and a finding appears; with the lock on, `ORGANIZATION_CURRENCY_LOCKED`.
- [ ] **T25**. `template/chart-template.registry.ts` (shipped general templates in `template/data/`, plugin
      contributions, tenant rows), `template/chart-template.service.ts` (`apply` with preview, `copy`,
      `save-as-template`, review-status gate). Files: `template/chart-template.controller.ts`, `template/data/`. Test:
      `template/chart-template.service.spec.ts` (apply creates the whole tree or nothing; unreviewed gate; copy never
      carries balances).
- [ ] **T26**. `import/chart-import.target.ts`: the `data-exchange` target `accounting.chart` (field map, match keys,
      the validation matrix of spec FR-39 as row findings, replace and merge modes, export columns) registered
      through `ACCOUNTING_DATA_EXCHANGE`; no own file reader. Test: `import/chart-import.target.spec.ts` (one case per
      check; round trip export then import changes nothing; a chart that follows another refuses the import).
- [ ] **T27**. `import/chart-import.controller.ts` (`GET /chart/imports/:runId/tree`, tree preview of a dry run); the
      apply writes the tree in one transaction inside the engine's run. Test: `import/chart-import.db.spec.ts`
      (repeated upload returns the same `data_import_run`; a failure mid-apply leaves the chart unchanged; with
      `data-exchange` absent the import actions are hidden and the routes answer `404`).
- [ ] **T28**. `dimension/analytic-dimension.service.ts` and `analytic-dimension-value.service.ts` (limits, own
      list and tree rules, deactivate, the balanced mark), controllers, bulk upsert. Files:
      `dimension/analytic-dimension.controller.ts`, `dimension/analytic-dimension-value.controller.ts`. Test:
      `dimension/analytic-dimension-value.service.spec.ts` (group and leaf refusals; archive instead of delete with
      lines); `dimension/analytic-dimension.service.spec.ts` (limit of twelve; reactivation).
- [ ] **T29**. `dimension/dimension-source.registry.ts` (`ANALYTIC_DIMENSION_SOURCE`) with readers for project,
      team, department, employee, contact and tag (values of a tag type); record and tag values are read from their
      source, never copied; setup creates the built-in dimensions. Files: `dimension/sources/project.source.ts`,
      `dimension/sources/team.source.ts`, `dimension/sources/department.source.ts`, `dimension/sources/employee.source.ts`,
      `dimension/sources/contact.source.ts`, `dimension/sources/tag.source.ts`, `dimension/dimension-source.controller.ts`.
      Test: `dimension/dimension-source.registry.spec.ts` (a renamed project shows its new name in a set's description; an
      archived project or tag refuses new use; a tag of another type is refused).
- [ ] **T30**. `dimension/analytic-dimension-set.service.ts`: hash, find-or-create under a unique race, `describe`,
      cache; `POST /dimension-sets/resolve`. Files: `dimension/analytic-dimension-set.controller.ts`. Test:
      `dimension/analytic-dimension-set.db.spec.ts` (concurrent creation yields one set; equal combinations are one
      set).
- [ ] **T31**. `dimension/dimension-rule.service.ts` (rule headers; scope and value lists written as core `rule` rows
      of owner `ANALYTIC_DIMENSION_RULE` and evaluated with `evaluateRuleSet` over the line context; specificity
      derived from the tested scope) and `dimension-default.service.ts` (dated versions), `POST
      /dimension-sets/validate`. Files: `dimension/dimension-rule.controller.ts`, `dimension/dimension-default.controller.ts`.
      Test: `dimension/dimension-rule.service.spec.ts` (precedence table; deleting a rule header deletes its rule rows in
      the same transaction); `dimension/dimension-default.service.spec.ts` (resolution order; dated versions).
- [ ] **T32**. `dimension/split-rule.service.ts` (fixed shares, lifecycle, no chain, start-date guard) and a
      `splitLine` function the ledger calls, also for manual line shares (up to `accounting.maxLineShares`, by
      percentage or amount). Files: `dimension/split-rule.controller.ts`, `dimension/split-line.ts`. Test:
      `dimension/split-line.spec.ts` (100 % rule; rounding remainder to the largest share; twenty manual shares);
      `dimension/split-rule.service.spec.ts` (chain and early start refused).
- [ ] **T33** (parallel). `distribution/seasonal-distribution.service.ts` (presets, versions, `spread`). Files:
      `distribution/seasonal-distribution.controller.ts`. Test: `distribution/seasonal-distribution.service.spec.ts`
      (weights total 100; working-day preset against `official-holiday` data; delete refused in use).
- [ ] **T34**. Outbox events of plan §5 in every write path, realtime hints, activity log entries. Files:
      `events/accounting-streamed-events.ts`, `events/accounting-realtime-hints.ts`, `events/accounting-activity.ts`.
      Test: `events/accounting-streamed-events.spec.ts` (one event per change, same transaction; no event with the flag
      off; before and after in the activity log).
- [ ] **T35**. GraphQL read resolvers and `graphql-field-binding-check.mjs` entries. Files: `tools/scripts/graphql-field-binding-check.mjs`,
      `graphql/ledger-account.resolver.ts`, `graphql/fiscal-year.resolver.ts`, `graphql/ledger-book.resolver.ts`,
      `graphql/analytic-dimension.resolver.ts`, `graphql/schema-extensions.ts`. Test: `graphql/ledger-account.resolver.spec.ts`
      and `graphql/analytic-dimension.resolver.spec.ts`.
- [ ] **T36**. Ports and bindings in `apps/api/src/plugin-composition.ts` (`TAX_LEDGER_ACCOUNTS` answered by
      `LedgerAccountService`; `ACCOUNTING_DATA_EXCHANGE`; `OPEN_ITEM_REGISTER`). Files: `accounting.ports.ts`,
      `apps/api/src/plugin-composition.ts`. Test: `accounting.ports.spec.ts` (plugin boots with ports unbound; the tax
      plugin's posting key and existing hand-off identifiers unchanged with the plugin loaded).
- [ ] **T37**. Worker side `AccountingSchedulePlugin`: queue `accounting-maintenance`, schedule
      `accounting.fiscal-year.rollover` recorded in `job_execution`; API queue workers and the registered operation
      types; in-process timer without a queue. Files: `accounting-schedule.plugin.ts`,
      `calendar/fiscal-year-rollover.scheduler.ts`, `calendar/fiscal-year-rollover.worker.ts`, `accounting.operations.ts`.
      Test: `calendar/fiscal-year-rollover.worker.spec.ts` (rollover creates exactly one year; inbox item written;
      switched off by setting).

## Phase 3 — UI surfaces

- [ ] **T38**. `packages/plugins/accounting-ui` scaffold: declarative plugin, routes registered on the page location
      `accounting-sections`, menu entries under Accounting, availability service (hidden when the feature is off),
      `ACCOUNTING.*` keys in 14 locales. Files: `packages/plugins/accounting-ui/` (`package.json`, `project.json`,
      `jest.config.ts`), `UI/accounting-ui.plugin.ts`, `UI/accounting-ui.routes.ts`, `UI/services/accounting-availability.service.ts`,
      `apps/gauzy/src/plugin-ui.config.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: `UI/accounting-ui.plugin.spec.ts`
      (hidden when the feature is off); `UI/accounting-ui.i18n.spec.ts` (key parity).
- [ ] **T39**. Setup assistant and readiness panel. Files: `UI/components/setup-assistant/`,
      `UI/components/readiness-panel/`. Test: their component specs (resumes a started setup; each finding links to its
      fix).
- [ ] **T40**. Chart of accounts page: tree, saved-view list, account drawer, references, archive, renumber.
      Files: `UI/components/chart-of-accounts/`, `UI/components/account-drawer/`, `UI/components/account-references/`,
      `UI/components/renumber-dialog/`. Test: their component specs; keyboard navigation of the tree.
- [ ] **T41** (parallel). Template catalogue and the chart import page (the `data-exchange` upload and mapping dialog
      with this plugin's tree preview and row findings). Files: `UI/components/chart-templates/`,
      `UI/components/chart-import/`. Test: their component specs.
- [ ] **T42** (parallel). Fiscal years, ledger books, categories and designations pages. Files:
      `UI/components/fiscal-years/`, `UI/components/ledger-books/`, `UI/components/account-categories/`,
      `UI/components/designations/`. Test: their component specs.
- [ ] **T43**. Dimensions pages: list, values tree, sources, rules, defaults, split rules, seasonal distributions.
      Files: `UI/components/dimensions/`, `UI/components/dimension-values-tree/`, `UI/components/dimension-sources/`,
      `UI/components/dimension-rules/`, `UI/components/dimension-defaults/`, `UI/components/split-rules/`,
      `UI/components/seasonal-distributions/`. Test: their component specs.
- [ ] **T44**. Shared Angular components exported by `accounting-ui`: `ga-account-picker`, `ga-dimension-set-editor`,
      `ga-fiscal-period-picker`, `ga-ledger-book-select`, for the forms of other plugins. Files:
      `UI/shared/account-picker/account-picker.component.ts`, `UI/shared/dimension-set-editor/dimension-set-editor.component.ts`,
      `UI/shared/fiscal-period-picker/fiscal-period-picker.component.ts`, `UI/shared/ledger-book-select/ledger-book-select.component.ts`,
      `packages/plugins/accounting-ui/src/index.ts`. Test: their component specs (inline rule message shown; line shares
      in the dimension set editor).

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T45**. MCP tools `packages/mcp-server/src/lib/tools/accounting-foundation.ts` (plan §7) registered in
      `register-all-tools.ts`. Files: `packages/mcp-server/src/lib/tools/accounting-foundation.ts`,
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test:
      `packages/mcp-server/src/lib/tools/accounting-foundation.spec.ts` (input schemas; `preview: true` writes nothing).
- [ ] **T46**. Record types for saved views, custom fields, search and mapped import and export (accounts,
      dimension values, fiscal periods). Files: `accounting.record-types.ts`. Test: `accounting.record-types.spec.ts`
      (each type listed for saved views, custom fields, search and mapped import and export).
- [ ] **T47**. OpenAPI document regenerated; SDK regeneration noted for release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: contract diff is additive.
- [ ] **T48**. User docs (setup, chart, importer, calendar, dimensions) and the `docs/specs/README.md` index row.
      Files: docs site `website/docs/accounting/`, `docs/specs/README.md`. Test: docs build.

## Phase 5 — Opening balances and shared charts

- [ ] **T49**. `opening/opening-balance.service.ts`: worksheet, lines, open-item detail check, balance and
      tolerance rules, party creation; controller. Files: `opening/opening-balance.controller.ts`. Test:
      `opening/opening-balance.service.spec.ts` (one case per refusal of spec FR-58 and FR-60; created parties listed).
- [ ] **T50**. Opening posting through `ACCOUNTING_LEDGER_POSTING` with open items opened through
      `OPEN_ITEM_REGISTER` (source type `OPENING`) in the same transaction (preview, post, reverse, operation
      `ACCOUNTING_OPENING_POST` for large worksheets). Files: `opening/opening-balance-posting.service.ts`,
      `opening/opening-balance.controller.ts`, `accounting.operations.ts`. Test:
      `opening/opening-balance-posting.service.spec.ts`: contract test against the ledger's posting service and a
      register fake; whole-worksheet atomicity; refused with control lines when the register is absent.
- [ ] **T51**. Opening balances page (grid, open-item tab, preview). Files: `UI/components/opening-balances/`,
      `UI/components/opening-open-items/`. Test: their component specs.
- [ ] **T52**. `follow/chart-follow.service.ts` and consumer `subscriber:accounting-chart-follow`: follow, the
      operation `ACCOUNTING_CHART_FOLLOW` (one step per follower), conflict findings, detach; nightly drift report.
      Files: `follow/chart-follow.consumer.ts`, `follow/chart-follow.controller.ts`, `accounting.operations.ts`. Test:
      `follow/chart-follow.db.spec.ts` (three followers, one conflicting; a restart mid-operation resumes at the next
      follower; followed fields read-only in the follower).
- [ ] **T53**. `chart/ledger-account-merge.strategy.ts`: the `ALIAS` strategy of the `data_merge` record type
      `ledger_account` (preview checks of FR-29 and FR-30, alias, references repointed and journaled in
      `data_merge_journal`, undo until the first period close); merge dialog. Files: `chart/ledger-account-merge.controller.ts`,
      `UI/components/merge-dialog/`. Test: `chart/ledger-account-merge.strategy.spec.ts` (ledger lines unchanged,
      checksum before and after; undo restores).
- [ ] **T60**. Bulk merge: several sources into one target as one operation running one `data_merge` per source
      (preview and refusal per source, progress, done, partly done or failed, result per account),
      `POST /account-merges/bulk`, multi-select in the merge dialog. Files: `chart/ledger-account-bulk-merge.service.ts`,
      `chart/ledger-account-merge.controller.ts`, `UI/components/merge-dialog/`. Test:
      `chart/ledger-account-bulk-merge.service.spec.ts` (one refused source leaves the others merged and reported).

## Phase 6 — Advanced capabilities

- [ ] **T54**. `dimension/dimension-derivation.service.ts`: derivation from task, time entry, employee and
      document references, and of tag-type dimensions from the single tag of that type on the document (core tag
      pivots), with manual marks. Test: `dimension/dimension-derivation.service.spec.ts` (one case per reference kind; two
      tags of one type derive nothing; override survives).
- [ ] **T55**. Driver-based allocation: drivers (tracked hours, headcount, ledger amounts), proposals, job
      `accounting.allocation.propose`, proposal page. Files: `dimension/allocation-driver.service.ts`,
      `dimension/allocation-proposal.controller.ts`, `dimension/allocation-propose.scheduler.ts`,
      `UI/components/allocation-proposals/`. Test: `dimension/allocation-driver.service.spec.ts` (shares equal tracked hours
      of the period; posted only after confirmation).
- [ ] **T56** (parallel). Template versions: stored origin, difference, selective upgrade. Files:
      `template/chart-template-upgrade.service.ts`, `template/chart-template.controller.ts`. Test:
      `template/chart-template-upgrade.service.spec.ts` (selected additions and renames applied; nothing removed).
- [ ] **T57** (parallel). Seasonal distribution derived from ledger actuals or tracked hours. Files:
      `distribution/seasonal-distribution-derive.service.ts`. Test: `distribution/seasonal-distribution-derive.service.spec.ts`
      (proportions).
- [ ] **T58**. Trial balance mapping assistant (`opening/trial-balance-mapping.service.ts`, remembered mappings) and
      `POST /assist/chart-proposal`. Files: `assist/chart-proposal.controller.ts`, `assist/chart-proposal.service.ts`.
      Test: `opening/trial-balance-mapping.service.spec.ts` (suggestions deterministic for a fixture; mapping remembered);
      `assist/chart-proposal.service.spec.ts` (nothing applied; agent marked in the audit).
- [ ] **T59**. Live updates in the Angular pages and shared pickers from realtime hints. Files:
      `UI/services/accounting-realtime.service.ts`. Test: `apps/gauzy-e2e/tests/accounting-live-updates.spec.ts`
      (two-client e2e: a change shows on the other client within two seconds).
- [ ] **T61**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `BANKING_LEDGER_ACCOUNTS`, `DOCUMENT_FISCAL_CALENDAR`, `PAYROLL_DIMENSION_SETS`, `PAYROLL_LEDGER_ACCOUNTS`. Files: `apps/api/src/plugin-composition.ts`. Test:
`accounting-consumer-tokens.contract.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T62**. Consolidation mapping: the source-to-follower account links of followed charts offered as the default
      account mapping for consolidated statements (`GET /chart/follow/mapping`, read by `financial-reports`). Files:
      `follow/chart-follow-mapping.service.ts`, `follow/chart-follow.controller.ts`. Test:
      `follow/chart-follow-mapping.service.spec.ts` (each follower account maps to its source; a detached account maps to
      nothing).

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Activation and accounting profile | T2, T3, T38 |
| FR-2 | §3.1 Activation and accounting profile | T13, T24 |
| FR-3 | §3.1 Activation and accounting profile | T13, T39 |
| FR-4–FR-5 | §3.1 Activation and accounting profile | T13 |
| FR-6 | §3.1 Activation and accounting profile | T36 |
| FR-7–FR-8 | §3.2 Chart of accounts | T15 |
| FR-9 | §3.2 Chart of accounts | T16, T40 |
| FR-10–FR-13 | §3.2 Chart of accounts | T15 |
| FR-14 | §3.2 Chart of accounts | T21 |
| FR-15 | §3.2 Chart of accounts | T15, T16, T34 |
| FR-16 | §3.3 Account types, designations and controls | T14 |
| FR-17 | §3.3 Account types, designations and controls | T14 |
| FR-18 | §3.3 Account types, designations and controls | T14, T20 |
| FR-19 | §3.3 Account types, designations and controls | T18 |
| FR-20 | §3.3 Account types, designations and controls | T17 |
| FR-21–FR-22 | §3.3 Account types, designations and controls | T20 |
| FR-23 | §3.3 Account types, designations and controls | T20 |
| FR-24–FR-25 | §3.4 Shared charts and merge | T52 |
| FR-26 | §3.4 Shared charts and merge | T52 |
| FR-27 | §3.4 Shared charts and merge | T52 |
| FR-28 | §3.4 Shared charts and merge | T62 |
| FR-29–FR-30 | §3.4 Shared charts and merge | T53 |
| FR-31 | §3.4 Shared charts and merge | T53 |
| FR-32 | §3.4 Shared charts and merge | T53 |
| FR-33–FR-35 | §3.5 Chart templates, copy and importer | T25 |
| FR-36 | §3.5 Chart templates, copy and importer | T56 |
| FR-37 | §3.5 Chart templates, copy and importer | T25 |
| FR-38–FR-40 | §3.5 Chart templates, copy and importer | T26 |
| FR-41 | §3.5 Chart templates, copy and importer | T26 |
| FR-42 | §3.5 Chart templates, copy and importer | T25–T27 |
| FR-43–FR-45 | §3.6 Account categories | T19 |
| FR-46 | §3.7 Fiscal years and periods | T22 |
| FR-47 | §3.7 Fiscal years and periods | T24 |
| FR-48 | §3.7 Fiscal years and periods | T22 |
| FR-49 | §3.7 Fiscal years and periods | T22 |
| FR-50 | §3.7 Fiscal years and periods | T22 |
| FR-51 | §3.7 Fiscal years and periods | T22 |
| FR-52 | §3.7 Fiscal years and periods | T37 |
| FR-53 | §3.7 Fiscal years and periods | T22 |
| FR-54 | §3.8 Ledger books | T23 |
| FR-55 | §3.8 Ledger books | T23 |
| FR-56 | §3.8 Ledger books | T23 |
| FR-57 | §3.9 Opening balances | T49, T51 |
| FR-58 | §3.9 Opening balances | T49 |
| FR-59 | §3.9 Opening balances | T49, T51 |
| FR-60 | §3.9 Opening balances | T49 |
| FR-61 | §3.9 Opening balances | T50 |
| FR-62 | §3.9 Opening balances | T49–T51 |
| FR-63 | §3.9 Opening balances | T58 |
| FR-64 | §3.10 Analytic dimensions and values | T28, T29 |
| FR-65 | §3.10 Analytic dimensions and values | T29, T43 |
| FR-66–FR-67 | §3.10 Analytic dimensions and values | T28, T29, T46 |
| FR-68 | §3.10 Analytic dimensions and values | T28 |
| FR-69 | §3.10 Analytic dimensions and values | T10, T30 |
| FR-70 | §3.10 Analytic dimensions and values | T28 |
| FR-71 | §3.11 Dimension rules, derivation and allocation | T30, T31 |
| FR-72 | §3.11 Dimension rules, derivation and allocation | T54 |
| FR-73 | §3.11 Dimension rules, derivation and allocation | T31 |
| FR-74 | §3.11 Dimension rules, derivation and allocation | T10, T31 |
| FR-75 | §3.11 Dimension rules, derivation and allocation | T31, T44 |
| FR-76 | §3.11 Dimension rules, derivation and allocation | T32 |
| FR-77 | §3.11 Dimension rules, derivation and allocation | T32 |
| FR-78 | §3.11 Dimension rules, derivation and allocation | T32, T44 |
| FR-79 | §3.11 Dimension rules, derivation and allocation | T55 |
| FR-80 | §3.11 Dimension rules, derivation and allocation | T18, T28 |
| FR-81 | §3.11 Dimension rules, derivation and allocation | T31, T32 |
| FR-82–FR-83 | §3.12 Seasonal distributions | T33, T43 |
| FR-84 | §3.12 Seasonal distributions | T57 |
| FR-85 | §3.12 Seasonal distributions | T33 |
| FR-86 | §3.13 API, assistance and real time | T16, T35 |
| FR-87 | §3.13 API, assistance and real time | T45 |
| FR-88 | §3.13 API, assistance and real time | T58 |
| FR-89 | §3.13 API, assistance and real time | T34, T59 |
| FR-90 | §3.13 API, assistance and real time | T34 |
| FR-91 | §3.13 API, assistance and real time | T46 |
| FR-92 | §3.4 Shared charts and merge | T60 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With `GAUZY_ACCOUNTING_ENABLED` unset no table, route, schedule or grant of this feature exists; with the tenant
  feature off every route is refused and the menu is hidden.
- A chart of 5,000 accounts and an import of 10,000 rows meet the targets of `spec.md` §4.
- Strings, comments and docs of the feature describe our platform only (Principle XI).
