# Implementation Plan: Accounting foundation

> Translates an approved `spec.md` into architecture and tech choices. The plan owns
> implementation details; the spec owns behaviour.

**Feature ID**: `accounting-foundation`
**Spec**: `./spec.md`
**Tasks**: `./tasks.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## 1. Architecture Summary

A new plugin pair: `packages/plugins/accounting` (`@gauzy/plugin-accounting`, API) and `accounting-ui` (Angular, which
also exports the account, dimension, period and book pickers other features' forms reuse). This spec delivers the
plugin scaffold and its master data; `general-ledger` and `budgets-and-revenue-schedules` add modules to the same
plugin. The plugin is built like the commerce plugins (`packages/plugins/purchasing`, `packages/plugins/inventory`):
`accounting.plugin.ts` with `entities`, `migrations`, `permissions`, `features`, `settings`, GraphQL `extensions`;
`accounting.features.ts`; `accounting.permissions.ts`; `accounting.settings.ts`; controllers guarded by
`TenantPermissionGuard, PermissionGuard, FeatureFlagGuard` with `@FeatureFlag(AccountingFeatures.ACCOUNTING)`;
cross-plugin calls only through optional injection tokens bound in `apps/api/src/plugin-composition.ts`.

It builds on what the platform already holds: the organization's fiscal dates and currency, core projects, teams,
departments, employees, contacts and **tags with tag types** as dimension sources (read from the records, never
copied), the core `rule` table for dimension rule scopes, the `data-exchange` engine for chart import and account
merge (`data_import_run`, `data_merge`), the core operation runtime for long work, the platform settings store, and
the open-item register of `invoicing-receivables-payables` for opening open items.

```mermaid
flowchart LR
    UI[Angular accounting-ui on page location accounting-sections] --> API[Controllers /api/accounting/...]
    MCP[MCP tools accounting_*] --> API
    API --> CH[Chart services: account, type registry, designation, category]
    API --> TPL[Template and copy services, chart import target]
    API --> FY[Fiscal calendar and ledger book services]
    API --> DIM[Dimension services: values, sets, rules, derivation, splits]
    API --> OB[Opening balance service]
    CH --> DB[(accounting tables)]
    TPL --> DB
    FY --> DB
    DIM --> DB
    DIM -. rule rows ANALYTIC_DIMENSION_RULE .-> RULE[(core rule)]
    OB -- posting contract --> GL[general-ledger posting engine]
    OB -. OPEN_ITEM_REGISTER .-> OIR[receivables-payables open-item register]
    TPL -. target accounting.chart, merge strategy ALIAS .-> DX[data-exchange: data_import_run, data_merge]
    DIM -. source registry .-> SRC[projects, teams, departments, employees, contacts, tags of a tag type]
    CH --> OUT[[event outbox]]
    DIM --> OUT
    OUT --> RT[realtime hints, inbox, automations, webhooks]
    OUT --> FOL[subscriber:accounting-chart-follow]
    FOL --> OPS[core operation: one step per follower]
    OPS --> CH
    JOBS[worker schedules, job_execution] --> Q[queue accounting-maintenance] --> FY
    Q --> DIM
```

## 2. Tech Choices

| Concern | Choice | Rationale |
| ------- | ------ | --------- |
| Package | new `packages/plugins/accounting` and `accounting-ui`; registered in `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts` behind `isAccountingEnabled(process.env)` (`GAUZY_ACCOUNTING_ENABLED` exactly `true`, the `isTaskAutomationsEnabled` pattern) | Principle I; deploy-level absence of a risky path |
| Tenant gate | `AccountingFeatures.ACCOUNTING = 'FEATURE_ACCOUNTING'` in `accounting.features.ts` (`defaultEnabled: false`), `@FeatureFlag` on every controller and resolver, menu hidden by the same code | [platform architecture](../../architecture/business-suite.md) §6 |
| Persistence | MultiORM entities on `TenantOrganizationBaseEntity`, MikroORM repositories beside each entity, hand-written tri-dialect migrations with the shared core migration helpers of `@gauzy/core` and the plugin's own builders; every table joins the core tenant export (`packages/core/src/lib/export-import`); none holds a secret, so none needs `@ExportRedacted` | Principle III |
| Trees | `parentId` + materialised `path` (ids joined by `/`) + `depth`; subtree reads by `path LIKE` prefix | one code path on three dialects, no recursive SQL |
| Money and rates | `DecimalString` / `CurrencyCode` from `packages/contracts/src/lib/money.model.ts`, `Money` and rounding from `packages/core/src/lib/money`; amounts `numeric(20,6)`, rates `numeric(20,10)`, percentages `numeric(9,4)` | money kernel |
| Ledger currency | `accounting_profile.ledgerCurrency`, taken from `organization.currency` at setup; the organization's currency stays editable, a difference is an advisory readiness finding, and the organization update guard refuses a change only while `accounting.lockOrganizationCurrency` is on (default off) | the ledger keeps its currency; the organization form keeps today's freedom |
| Account types | code registry `LedgerAccountTypeRegistry` fed by plugin contributions (`accountTypes` list exported by each plugin and registered at bootstrap, as `registerUnitReferences` in `purchasing.plugin.ts`) | types are behaviour, not tenant data |
| Dimension values | `OWN_LIST` / `OWN_TREE` values are rows of `analytic_dimension_value`; for a `RECORD` dimension the value **is** the source record (its id is the value id; name, parent and archive state are read through the source's `ANALYTIC_DIMENSION_SOURCE` reader); for a `TAG_TYPE` dimension the values are the core `tag` rows of that tag type (`packages/core/src/lib/tags`, `tag-type`) | no mirror table, no sync job |
| Dimension sets | one row per distinct combination, addressed by a deterministic hash; lines of every plugin carry one nullable `dimensionSetId` resolved through `AnalyticDimensionSetService.resolve` | additive for other plugins; no column per dimension |
| Dimension rule scopes | `analytic_dimension_rule` keeps kind, requirement and dates; which accounts it covers and which values it allows or denies are core `rule` rows of the new owner type `ANALYTIC_DIMENSION_RULE`, evaluated by `evaluateRuleSet` (`packages/core/src/lib/rule/rule.evaluator.ts`) against the line context (statement, class, category, group path, account, value with its ancestors) | the kernel's "one rule table for all domains" |
| Imports and merges | the chart is a target `accounting.chart` of the `data-exchange` engine (`data_import_run`, `data_import_row`, `data_mapping_template`: parsing, mapping, dry run, error file); this plugin contributes the field map, match keys, the validation matrix of spec FR-39 and the tree preview; account merge is a `data_merge` of record type `ledger_account` with this plugin's strategy `ALIAS` (references repointed and journaled in `data_merge_journal`, ledger lines untouched); without `data-exchange` the import and merge actions are unavailable | no second import or merge engine |
| Settings | platform settings store through `accounting.settings.ts` contributions (scope `ORGANIZATION` unless noted); the profile row holds setup state only | no settings table |
| Long work | core operation runtime (`packages/core/src/lib/operation`, `api/async-operation.ts`): template application, chart-follow fan-out and opening postings are `operation` rows with steps, answered `202` with the operation handle | resumable, observable, cancellable |
| Periodic work | `@ScheduledJob` in the worker enqueues on `accounting-maintenance`; `@QueueWorker` in the API runs it; every pass recorded in `job_execution`; in-process timer when no queue root (the `TaskAutomationDueSweepTimer` layout) | scheduler package |
| Push | `EventOutboxService.append` in the write transaction; hints through `RealtimeHintsService.appendHint` | Principle VII |
| UI | Angular declarative plugin (`defineDeclarativePlugin`, as `task-automations-ui.plugin.ts`) whose routes register on the page location `accounting-sections` (`apps/gauzy/src/app/pages/pages.routes.ts`, children of `/pages/accounting`) | [platform architecture](../../architecture/business-suite.md) §6; one Accounting menu |

## 3. Data Model

### New or changed entities

All tables extend the tenant and organization base (id, `tenantId`, `organizationId`, audit and soft-delete
columns). "Unique (live)" = unique among rows that are not soft-deleted (partial index on PostgreSQL and SQLite,
generated key columns on MySQL, as `UQ_purchase_order_number`). No existing table changes; the core `RuleOwnerType`
enumeration gains `ANALYTIC_DIMENSION_RULE` (a value, no schema change).

```ts
@MultiORMEntity('ledger_account', { mikroOrmRepository: () => MikroOrmLedgerAccountRepository })
export class LedgerAccount extends TenantOrganizationBaseEntity implements ILedgerAccount { /* columns below */ }
```

| Table | Columns (beyond the base) | Indexes and uniqueness |
| --- | --- | --- |
| `accounting_profile` | `state` varchar(16) default `NOT_STARTED`, `goLiveDate` date null, `wentLiveAt` timestamp null, `wentLiveByUserId` uuid null, `chartTemplateKey` varchar(96) null, `chartTemplateVersion` varchar(24) null, `followsChartOfId` uuid null, `followsCalendarOfId` uuid null, `ledgerCurrency` varchar(3) null (set from `organization.currency` at setup), `setupState` text (JSON), `version` int (chart and calendar options are settings, below) | unique `(tenantId, organizationId)` |
| `ledger_account` | `code` varchar(32) null, `codeKey` varchar(32) null (lower-cased), `name` varchar(160), `nameTranslations` text (JSON) null, `class` varchar(16), `kind` varchar(8), `isRoot` bool, `parentId` uuid null fk self restrict, `parentKey` varchar(36) not null (the `parentId`, or `*` for a root account; written with it so sibling names stay unique among roots on every dialect), `path` varchar(1024), `depth` int, `position` int, `typeKey` varchar(48) null, `categoryId` uuid null fk set null, `currency` varchar(3) null, `expectedSide` varchar(6) null, `expectedSideAction` varchar(8) null, `isRestricted` bool default false, `sourceAccountId` uuid null fk self set null, `mergedIntoId` uuid null fk self restrict, `description` text null, `version` int default 1 | unique (live) `(organizationId, codeKey)`; unique (live) `(organizationId, parentKey, name)`; idx `(organizationId, path)`, `(organizationId, class, kind)`, `(sourceAccountId)`, `(mergedIntoId)` |
| `ledger_account_designation` | `role` varchar(64), `accountId` uuid fk restrict, `validFrom` date null | unique (live) `(organizationId, role)`; idx `(accountId)` |
| `ledger_account_category` | `name` varchar(120), `class` varchar(16), `parentId` uuid null fk self, `position` int, `marginTier` varchar(16) null, `cashFlowSection` varchar(16) null, `description` text null | unique (live) `(organizationId, class, name)` |
| `chart_template` | tenant scoped (`organizationId` null) with `organizationAllowList` text (JSON) null; `key` varchar(96), `version` varchar(24), `name` varchar(160), `countryCode` varchar(2) null, `languages` text (JSON), `reviewStatus` varchar(16), `origin` varchar(16) (`TENANT`; shipped and contributed templates live in code and are listed with these rows), `document` text (JSON tree with types, categories, designations, rule suggestions) | unique (live) `(tenantId, key, version)` |
| `fiscal_year` | `name` varchar(64), `startDate` date, `endDate` date, `isIrregular` bool default false, `pattern` varchar(16), `state` varchar(8) (`PLANNED`, `OPEN`, `CLOSED`), `version` int | unique (live) `(organizationId, startDate)`; idx `(organizationId, state, endDate)`; overlap refused in the service under a row lock on the profile |
| `fiscal_period` | `fiscalYearId` uuid fk cascade, `number` int, `name` varchar(64), `startDate` date, `endDate` date, `isAdjustment` bool default false | unique `(fiscalYearId, number)`; idx `(organizationId, startDate, endDate)` |
| `ledger_book` | `code` varchar(24), `name` varchar(120), `purpose` varchar(255) null, `isPrimary` bool default false | unique (live) `(organizationId, code)`; one primary per organization (partial unique) |
| `analytic_dimension` | `code` varchar(32), `name` varchar(120), `sourceKind` varchar(16) (`OWN_LIST`, `OWN_TREE`, `RECORD`, `TAG_TYPE`), `sourceType` varchar(64) null (registered record type), `tagTypeId` uuid null (core `tag_type`), `position` int, `isBalanced` bool default false, `isBuiltIn` bool default false | unique (live) `(organizationId, code)`; idx `(organizationId, isActive, position)` |
| `analytic_dimension_value` (own values only) | `dimensionId` uuid fk restrict, `code` varchar(64) null, `name` varchar(160), `parentId` uuid null fk self, `path` varchar(1024), `isGroup` bool default false, `validFrom` date null, `validUntil` date null | unique (live) `(dimensionId, code)`; idx `(dimensionId, path)` |
| `analytic_dimension_set` | `hash` char(64) (SHA-256 of sorted `dimensionId:valueId` pairs), `valueCount` int, `label` varchar(512) | unique `(organizationId, hash)`; no update, no delete |
| `analytic_dimension_set_value` | `setId` uuid fk cascade, `dimensionId` uuid, `valueId` uuid (an own value, the source record or the tag, by the dimension's `sourceKind`; no fk) | unique `(setId, dimensionId)`; idx `(organizationId, dimensionId, valueId, setId)` |
| `analytic_dimension_rule` | `dimensionId` uuid fk, `kind` varchar(12) (`REQUIREMENT`, `ALLOW`, `DENY`), `requirement` varchar(12) null, `specificity` int (from the scope its rule rows test: statement 1, class 2, category 3, group 4, account 5), `validFrom` date null, `validUntil` date null; scope and value list are `rule` rows (`ownerType = ANALYTIC_DIMENSION_RULE`, `ownerId` = this row) | idx `(organizationId, dimensionId, kind, specificity)`; one live `ALLOW` or `DENY` per dimension, scope and date (service) |
| `analytic_dimension_default` | `dimensionId` uuid fk, `ownerType` varchar(32) (`ORGANIZATION`, `CONTACT`, `VENDOR`, `ITEM`, `PROJECT`, `EMPLOYEE`, `WAREHOUSE`), `ownerId` uuid null, `valueId` uuid (any source, validated by the service), `validFrom` date null, `validUntil` date null | unique (live) `(dimensionId, ownerType, ownerId, validFrom)` |
| `analytic_split_rule` | `dimensionId` uuid fk, `sourceValueId` uuid, `kind` varchar(8) (`FIXED`, `DRIVER`), `driver` varchar(24) null, `driverConfig` text (JSON) null, `state` varchar(8) (`DRAFT`, `ACTIVE`, `ENDED`), `validFrom` date, `validUntil` date null, `version` int | idx `(organizationId, sourceValueId, state, validFrom)` |
| `analytic_split_rule_share` | `ruleId` uuid fk cascade, `targetValueId` uuid, `percent` numeric(9,4) | unique `(ruleId, targetValueId)` |
| `analytic_allocation_proposal` | `ruleId` uuid fk, `fiscalPeriodId` uuid fk, `state` varchar(12) (`PROPOSED`, `POSTED`, `SUPERSEDED`), `evidence` text (JSON driver figures), `amount` numeric(20,6), `journalId` uuid null | unique `(ruleId, fiscalPeriodId)` while not `SUPERSEDED` |
| `seasonal_distribution` | `name` varchar(120), `pattern` varchar(16), `version` int, `supersedesId` uuid null, `origin` text (JSON) null | unique (live) `(organizationId, name, version)` |
| `seasonal_distribution_weight` | `distributionId` uuid fk cascade, `periodNumber` int, `percent` numeric(9,4) | unique `(distributionId, periodNumber)` |
| `opening_balance` | `cutOverDate` date, `ledgerBookId` uuid null fk, `state` varchar(12) (`DRAFT`, `QUEUED`, `POSTED`, `REVERSED`, `FAILED`), `operationId` uuid null (the posting operation), `supersedesId` uuid null, `mapping` text (JSON map of the uploaded accounts), `totals` text (JSON), `journalIds` text (JSON), `version` int | idx `(organizationId, state)` |
| `opening_balance_line` | `openingBalanceId` uuid fk cascade, `lineNo` int, `accountId` uuid fk, `debit` numeric(20,6), `credit` numeric(20,6), `currency` varchar(3), `rate` numeric(20,10) null, `dimensionSetId` uuid null, `partyType` varchar(16) null, `partyId` uuid null, `documentNumber` varchar(64) null, `documentDate` date null, `dueDate` date null, `openItemId` uuid null (the register's item, once posted), `sourceAccount` varchar(160) null, `version` int | unique `(openingBalanceId, lineNo)`; idx `(openingBalanceId, accountId)` |

The party, document and due-date columns of a line are the worksheet's input only: posting opens each of them as an
open item of source type `OPENING` in the one open-item register of `invoicing-receivables-payables`
(`OPEN_ITEM_REGISTER.open`, same transaction as the opening journal), which is also where the opening invoices of that
spec (its FR-8) put theirs. Without that plugin a worksheet with control-account lines is refused (readiness finding).

Settings in the platform settings store, declared in `accounting.settings.ts` (scope `ORGANIZATION` unless noted):
`accounting.allowUnreviewedTemplates` (false, `TENANT`), `accounting.maxActiveDimensions` (12),
`accounting.maxLedgerBooks` (6), `accounting.maxLineShares` (20), `accounting.chart.codeRequired` (false),
`accounting.chart.codeMask` (none), `accounting.chart.allowLocalAccounts` (true), `accounting.chart.allowDetach`
(true), `accounting.fiscalYear.autoNextYearDays` (30), `accounting.lockOrganizationCurrency` (false),
`accounting.syncOrganizationFiscalDates` (false). The organization level of the store is the one `organization-setup`
provides.

### Migrations

**Migration timestamps**: `packages/plugins/accounting` `1791000072100` to `1791000072199`.

In `packages/plugins/accounting/src/lib/database/migrations/`, each additive, idempotent, three dialects, registered
for both ORMs:

- `1791000072100-CreateAccountingProfileAndChartTables` (profile, account, designation, category, template)
- `1791000072110-CreateFiscalCalendarAndLedgerBookTables`
- `1791000072120-CreateAnalyticDimensionTables` (dimension, value, set, set value, `analytic_dimension_rule` with only the kind,
  requirement and dates of a rule (its scope and value lists are core `rule` rows, so no condition table is created),
  default, split, share, proposal;
  append-only triggers on `analytic_dimension_set` and `analytic_dimension_set_value`, the `stock_movement` idiom)
- `1791000072130-CreateSeasonalDistributionTables`
- `1791000072140-CreateOpeningBalanceTables`

No `NOT NULL` column is added to an existing table, so there is no backfill. Default role grants are declared on the
permission contributions (§9), not seeded. Built-in dimensions and the primary ledger book are created by the setup
service when a profile leaves `NOT_STARTED`, not by a migration.

### Contracts

`packages/contracts/src/lib/accounting.model.ts` (exported from `index.ts`): `IAccountingProfile`,
`AccountingProfileState`, `ILedgerAccount`, `LedgerAccountClass`, `LedgerAccountKind`, `ILedgerAccountType`,
`LedgerAccountTrait`, `ILedgerAccountDesignation`, `LedgerDesignationRole`, `ILedgerAccountCategory`,
`IChartTemplate`, `IChartImportFinding`, `IFiscalYear`, `IFiscalPeriod`, `FiscalPeriodPattern`, `ILedgerBook`,
`IAnalyticDimension`, `AnalyticDimensionSourceKind`, `IAnalyticDimensionValue` (own value, record or tag, with its
display name), `IAnalyticDimensionSet`, `IAnalyticDimensionRule`, `IAnalyticSplitRule`, `ISeasonalDistribution`,
`IOpeningBalance`, `IAccountingReadinessFinding`, `IDimensionValidationResult`. `RuleOwnerType` gains
`ANALYTIC_DIMENSION_RULE`. Permission values and feature codes are contributed by the plugin (§9), not added to the
core enums by hand.

## 4. API Surface

All under `/api/accounting`, guarded as in §1; the organization is the caller's current one. Lists use cursor
pagination; creating, applying and posting calls accept an `Idempotency-Key` (`@Idempotent`,
`packages/core/src/lib/idempotency`). Request and response bodies are the contracts above with `Create…Dto` /
`Update…Dto` classes (class-validator, Swagger decorators).

| Method | Endpoint | Permission | Description | Status |
| ------ | -------- | ---------- | ----------- | ------ |
| `GET` `PUT` | `/profile` | `ACCOUNTING_CHART_VIEW` / `ACCOUNTING_SETTINGS_EDIT` | profile and setup state | New |
| `POST` | `/profile/go-live` | `ACCOUNTING_SETTINGS_EDIT` | body `{ goLiveDate }`; refused with blocking findings | New |
| `GET` | `/readiness` | `ACCOUNTING_CHART_VIEW` | `IAccountingReadinessFinding[]` | New |
| `GET` `POST` | `/accounts` | `ACCOUNTING_CHART_VIEW` / `ACCOUNTING_CHART_EDIT` | list (`?view=tree\|list&class=&q=`), create | New |
| `GET` `PUT` `DELETE` | `/accounts/:id` | view / edit | read, update (`If-Match` version), delete when unused | New |
| `PUT` | `/accounts/:id/archive`, `/accounts/:id/restore`, `/accounts/:id/move` | `ACCOUNTING_CHART_EDIT` | lifecycle and position | New |
| `POST` | `/accounts/renumber` | `ACCOUNTING_CHART_EDIT` | `{ rootId, rule, preview }` | New |
| `GET` | `/accounts/:id/references` | `ACCOUNTING_CHART_VIEW` | designations, rules and other holders | New |
| `POST` | `/accounts/:id/merge`, `/account-merges/:id/undo` | `ACCOUNTING_CHART_MERGE` | `{ intoAccountId, preview }`; starts or undoes a `data_merge` (record type `ledger_account`, strategy `ALIAS`) after this plugin's checks | New |
| `POST` | `/account-merges/bulk` | `ACCOUNTING_CHART_MERGE` | `{ fromAccountIds, intoAccountId, preview }` → `202` with an operation running one `data_merge` per source, result per account | New |
| `GET` | `/account-types` | `ACCOUNTING_CHART_VIEW` | catalogue with traits | New |
| `GET` `PUT` | `/designations`, `/designations/:role` | view / `ACCOUNTING_CHART_EDIT` | default roles | New |
| CRUD | `/account-categories` | view / `ACCOUNTING_CHART_EDIT` | categories | New |
| `GET` | `/chart-templates`, `/chart-templates/:key/:version` | `ACCOUNTING_CHART_VIEW` | catalogue, tree | New |
| `POST` | `/chart/apply-template`, `/chart/copy`, `/chart/save-as-template` | `ACCOUNTING_CHART_EDIT` | `{ …, preview }`; a large application answers `202` with its operation | New |
| `GET` `POST` | `/chart/template-upgrade` | view / `ACCOUNTING_CHART_EDIT` | difference; apply selected changes | New |
| `GET` | `/chart/export?format=csv\|xlsx\|json` | `ACCOUNTING_CHART_VIEW` | re-importable file (the `data-exchange` export of target `accounting.chart`) | New |
| `GET` | `/chart/imports/:runId/tree` | `ACCOUNTING_CHART_IMPORT` | tree preview of a dry run of target `accounting.chart` with row findings; upload, mapping, apply and error file are the `data-exchange` import routes of that target | New |
| `PUT` `DELETE` | `/chart/follow` | `ACCOUNTING_CHART_EDIT` | follow an ancestor; stop following | New |
| CRUD | `/fiscal-years` (`POST` accepts `organizationIds[]`), `/fiscal-years/:id/periods` | `ACCOUNTING_FISCAL_YEAR_VIEW` / `_EDIT` | calendar | New |
| CRUD | `/ledger-books` | `ACCOUNTING_CHART_VIEW` / `ACCOUNTING_LEDGER_BOOK_EDIT` | books | New |
| CRUD | `/dimensions`, `/dimensions/:id/values` (+ `/bulk`) | `ANALYTIC_DIMENSION_VIEW` / `_EDIT` | dimensions and own values | New |
| `GET` | `/dimension-sources` | `ANALYTIC_DIMENSION_VIEW` | registered record types and the organization's tag types | New |
| `POST` | `/dimension-sets/resolve` | `ANALYTIC_DIMENSION_VIEW` | `{ values?, references? }` → set, derived values, manual marks | New |
| `POST` | `/dimension-sets/validate` | `ANALYTIC_DIMENSION_VIEW` | `{ accountId, dimensionSetId, date }[]` → `IDimensionValidationResult[]` | New |
| CRUD | `/dimension-rules`, `/dimension-defaults`, `/split-rules` (+ `/activate`, `/end`) | view / `ANALYTIC_DIMENSION_EDIT` | rules | New |
| `GET` `POST` | `/allocation-proposals`, `/allocation-proposals/:id/post` | `ANALYTIC_DIMENSION_VIEW` / `ACCOUNTING_JOURNAL_POST` | driver-based proposals | New |
| CRUD | `/seasonal-distributions` (+ `/derive`) | `ANALYTIC_DIMENSION_VIEW` / `_EDIT` | curves | New |
| CRUD | `/opening-balances`, `/opening-balances/:id/lines/bulk` | `ACCOUNTING_OPENING_BALANCE_EDIT` | worksheet | New |
| `POST` | `/opening-balances/:id/map`, `/preview`, `/post`, `/reverse` | edit / `ACCOUNTING_OPENING_BALANCE_POST` | mapping suggestions; effects; post (`202` with the posting operation when large) | New |
| `POST` | `/assist/chart-proposal` | `ACCOUNTING_CHART_VIEW` | proposal as a change list (never applies) | New |

GraphQL (read only, behind `FEATURE_GRAPHQL` as the commerce resolvers): `ledgerAccounts`, `ledgerAccount`,
`fiscalYears`, `ledgerBooks`, `analyticDimensions`, `analyticDimensionValues`.

Services other plugins bind their own ports to (in `apps/api/src/plugin-composition.ts`): `LedgerAccountService`
(read, validate and label accounts by trait: answers `TAX_LEDGER_ACCOUNTS` of the tax plugin and the account
pickers of every domain), `FiscalCalendarService` (`periodOf(organizationId, date)`), `AnalyticDimensionSetService`
(`resolve`, `validate`, `describe`: the one way every finance table turns dimension values into its
`dimensionSetId`), `SeasonalDistributionService` (`spread(amount, distributionId, yearId)`).
Ports this module declares: `ANALYTIC_DIMENSION_SOURCE` (multi: a record type usable as a dimension source, with a
reader for name, parent, archive state and the derivation path; shipped readers for project, team, department,
employee, contact and tag), `ACCOUNTING_DATA_EXCHANGE` (registration of the target `accounting.chart`, the dimension
values target and the `ALIAS` merge strategy with the `data-exchange` engine; unbound = import and merge unavailable),
`OPEN_ITEM_REGISTER` (consumed, from `invoicing-receivables-payables`: opening open items),
`ACCOUNTING_LEDGER_POSTING` (the posting service of `general-ledger`; unbound until that module is loaded, then
opening balances and allocations can post). The plugin also registers an organization update guard that refuses a
change of `organization.currency` while its profile is live only where `accounting.lockOrganizationCurrency` is on;
otherwise the change is saved as today and the readiness check reports the difference from the ledger currency.

Errors are `400` with a stable `code` (`ACCOUNT_HAS_LINES`, `ACCOUNT_REFERENCED`, `ACCOUNT_CODE_TAKEN`,
`ACCOUNT_CLASS_MISMATCH`, `FISCAL_YEAR_OVERLAP`, `DIMENSION_LIMIT`, `SPLIT_NOT_100`, `SPLIT_CHAINED`,
`OPENING_UNBALANCED`, `CHART_FOLLOWED`, `ORGANIZATION_CURRENCY_LOCKED`, …), `409` on a version conflict, `403` on a
missing permission.

**Consumer tokens answered** (bound in `apps/api/src/plugin-composition.ts` to the account, fiscal calendar and analytic dimension services; each consumer plan states the shape it calls and its fallback): `BANKING_LEDGER_ACCOUNTS`, `DOCUMENT_FISCAL_CALENDAR`, `PAYROLL_DIMENSION_SETS`, `PAYROLL_LEDGER_ACCOUNTS`.

## 5. Events, Real-Time and Notifications

| Event | Emitted when | Consumers (push channel, notifications, inbox, integrations, activity log) |
| ----- | ------------ | --------------------------------------------------------------------------- |
| `accounting.profile.went_live` | go-live | `general-ledger` (sets the initial lock), activity log |
| `accounting.account.created` / `.updated` / `.archived` / `.restored` | chart change | `subscriber:accounting-chart-follow` (applies it to followers), realtime hint, webhooks, search index |
| `accounting.account.merged` / `.merge_undone` | the account's `data_merge` finished or was undone | `general-ledger` (rebuilds balances), realtime |
| `accounting.chart.applied` | template, copy or import applied | readiness check, realtime |
| `accounting.chart_follow.conflict` | a follower could not apply a change | inbox item to accounting administrators of both organizations |
| `accounting.fiscal_year.created` / `.updated`, `accounting.fiscal_period.created` | calendar change | `general-ledger`, budgets, inbox (automatic next year) |
| `accounting.ledger_book.created` / `.archived` | book change | `fixed-assets` schedules, reports |
| `accounting.dimension.created` / `.updated`, `accounting.dimension_value.created` / `.updated` / `.archived` | dimension change | realtime, search index |
| `accounting.split_rule.activated` / `.ended`, `accounting.allocation.proposed` | rule lifecycle; period proposal ready | inbox item to holders of `ACCOUNTING_JOURNAL_POST` |
| `accounting.opening_balance.posted` / `.failed` | background posting ended | inbox item to the requester, realtime |

Sourced dimension values need no consumer: a record or tag is read where it is shown, so a renamed project or tag
appears renamed everywhere at once and an archived one is refused for new lines by the validation of §4.

Events are appended with `EventOutboxService.append(manager, …)` inside the write transaction (aggregate = the
record, partition = `accounting:<organizationId>`). Real-time: one hint per changed record type and organization,
coalesced, on the platform channel. Inbox items through `INBOX_ITEM_WRITER` when the inbox is loaded, platform
notifications otherwise.

## 6. UI Surface

- Angular `packages/plugins/accounting-ui`, whose routes register on the existing page location
  `accounting-sections` (`getPageLocationRoutes('accounting-sections')` in `apps/gauzy/src/app/pages/pages.routes.ts`,
  children of `/pages/accounting` beside Income, Expenses, Invoices and Payments; every accounting UI plugin uses
  this location): `setup` (assistant, readiness panel), `chart-of-accounts` (tree and saved-view list, account
  drawer, references, merge dialog with preview, renumber dialog), `chart-of-accounts/import` (the `data-exchange`
  import dialog for target `accounting.chart` with this plugin's tree preview and row findings),
  `chart-of-accounts/templates` (catalogue, upgrade difference), `fiscal-years`, `ledger-books`, `dimensions` (list,
  own values tree, sources incl. tag types), `dimension-rules`, `split-rules` (with allocation proposals),
  `seasonal-distributions` (bar editor), `opening-balances` (grid, open-item tab, mapping assistant, preview).
  Menu entries carry the feature code and `permissionKeys`; strings under `ACCOUNTING.*` in all 14 locale files of
  `packages/ui-core/i18n/assets/i18n/`. Lists are saved-view lists; forms honour custom fields.
- Shared Angular components exported by `accounting-ui` for the forms of other plugins: `ga-account-picker` (filter
  by class, trait, currency), `ga-dimension-set-editor` (chips per active dimension, derived and manual marks,
  inline rule messages), `ga-fiscal-period-picker`, `ga-ledger-book-select`.

## 7. MCP Tools, SDKs and Integrations

MCP tools in `packages/mcp-server/src/lib/tools/accounting-foundation.ts`, registered in `register-all-tools.ts`
(input → output; each calls the REST route and so inherits its permission):

| Tool | Input | Output |
| --- | --- | --- |
| `accounting_readiness_check` | `organizationId` | findings |
| `accounting_account_list` / `_get` | filters / id | accounts |
| `accounting_account_create` / `_update` / `_archive` | account fields, `preview` | account or planned change |
| `accounting_account_merge` | `fromId`, `intoId`, `preview` | merge preview or result |
| `accounting_chart_template_list` / `accounting_chart_apply` | — / `key`, `version`, `preview` | catalogue / tree or result |
| `accounting_chart_import` | file reference, `mapping`, `mode`, `preview` | findings and tree, or the `data_import_run` |
| `accounting_chart_propose` | business description or file reference | template and change list |
| `accounting_fiscal_year_list` / `_create` | — / dates, pattern, `organizationIds` | years and periods |
| `analytic_dimension_list` / `analytic_dimension_value_upsert` | — / value fields | dimensions, values |
| `analytic_dimension_resolve` / `_validate` | references or values / account, set, date | set / validation result |
| `accounting_split_rule_upsert`, `accounting_allocation_propose` | rule / rule id, period | rule / proposal with evidence |
| `accounting_opening_balance_prepare` / `_post` | lines or file reference / id, `preview` | worksheet with mapping / effects or result |

SDK impact: additive OpenAPI paths; the SDKs are regenerated after merge. Import and export formats (all through
`data-exchange` targets): chart as CSV, spreadsheet or JSON (columns: identifier, code, name, parent code, class,
kind, type, category, currency, restricted); own dimension values as CSV; opening balance as CSV or spreadsheet (two
sheets: balances, open items). Integrations:
chart templates and account types can be contributed by any plugin, including marketplace ones, through the plugin
contribution lists.

## 8. Background Jobs

| Trigger | When | What it does | Idempotency |
| ------- | ---- | ------------ | ----------- |
| `accounting.fiscal-year.rollover` (`@ScheduledJob`, daily 01:10) | worker enqueues, API runs | creates the next year where the last open year ends within `accounting.fiscalYear.autoNextYearDays` | unique `(organizationId, startDate)` |
| operation `ACCOUNTING_CHART_FOLLOW` (one per change, one step per follower) | on `accounting.account.*` of a followed chart | applies the change to each follower in its own transaction; a conflicting follower ends its step with a finding | operation idempotency key = outbox event id; per-follower version check |
| `data_import_run` of target `accounting.chart` (the engine's run) | on apply of an import | writes the tree in one transaction | the engine's run state and file hash |
| `data_merge` of record type `ledger_account` (the engine's operation) | on merge and undo | repoints references through the `ALIAS` strategy, then asks the ledger to rebuild balances | the merge row's state |
| operation `ACCOUNTING_OPENING_POST` | on post of a large worksheet | opens the open items in the register and posts through the ledger contract | posting idempotency key `opening:<id>:<version>` |
| `accounting.allocation.propose` (period end + 1 day) | same split | computes driver figures and proposals | unique `(ruleId, fiscalPeriodId)` |

The worker loads `AccountingSchedulePlugin` (queue and schedules only); the API loads `AccountingPlugin` with the
queue consumers and the registered operation types. Every scheduled pass is a `job_execution` row; operations are
observable, resumable and cancellable through the core `/operations` routes. Each scheduled job takes a
per-organization lock (PostgreSQL advisory lock, MySQL `GET_LOCK`, in-process on SQLite) and runs inside
`RequestContext.runWithRequest` with a system actor of the organization.

## 9. Security & Permissions

New permission values in `accounting.permissions.ts` (`PluginPermissionContribution`, group `GENERAL`), granted to
`SUPER_ADMIN` and `ADMIN` through each contribution's `defaultFor` (no seed migration; the permission reload inserts
missing grants for existing tenants):

`ACCOUNTING_CHART_VIEW`, `ACCOUNTING_CHART_EDIT`, `ACCOUNTING_CHART_IMPORT`, `ACCOUNTING_CHART_MERGE`,
`ACCOUNTING_SETTINGS_EDIT`, `ACCOUNTING_FISCAL_YEAR_VIEW`, `ACCOUNTING_FISCAL_YEAR_EDIT`,
`ACCOUNTING_LEDGER_BOOK_EDIT`, `ANALYTIC_DIMENSION_VIEW`, `ANALYTIC_DIMENSION_EDIT`,
`ACCOUNTING_OPENING_BALANCE_EDIT`, `ACCOUNTING_OPENING_BALANCE_POST`, `ACCOUNTING_ACCOUNT_POST_RESTRICTED`.
`ANALYTIC_DIMENSION_VIEW` is also in the `defaultFor` of `MANAGER` and `EMPLOYEE` so that expense and time screens
can show the dimension pickers. Merge, import and opening post are separate keys (segregation of duties); the
`data-exchange` routes of the `accounting.chart` target and of the `ledger_account` merge check these keys.

Privacy: employee as a dimension exposes names only to holders of the dimension view permission, and a record or tag
value is shown only as its source's own read rules allow. Uploaded files are parsed by the `data-exchange` engine
in memory, stored through the platform file storage, size-limited (10 MB) and never executed; cell content is
treated as text. Agent calls run under the calling user or a service account and are marked in the
audit trail. No secrets are introduced by this spec.

## 10. Observability

- Activity log entries (entity, action, before and after) for every master record through `ActivityLogService`;
  merges, imports, go-live and opening postings write a summary entry with counts.
- Metrics: import rows per second, follower propagation lag, dimension set cache hit ratio, readiness findings per
  organization, job durations. Job runs are recorded by the scheduler's job execution log; failures reach the
  dead-letter list and an inbox item.
- Logs with the stable error codes of §4; no balances or names in log lines.

## 11. Phased Rollout

1. **Phase 1 — Scaffold, chart, calendar.** Plugin pair, flags, settings, profile, accounts, types, designations,
   categories, fiscal years and periods, ledger books, general templates, readiness. Usable: an organization can
   build and browse its chart and calendar.
2. **Phase 2 — Templates, copy, importer, dimensions.** Template catalogue and contributions, copy, chart import
   target (both modes), dimensions with own, record and tag values, sets, rules, defaults, fixed splits, seasonal
   distributions, shared pickers. Usable: documents of other plugins can carry and validate dimension sets.
3. **Phase 3 — Opening balances and shared charts.** Worksheet, open items, posting through `general-ledger`,
   follow and detach, merge and undo.
4. **Phase 4 — Advanced capabilities.** Derivation from tasks and tracked time, driver-based allocation, template
   upgrade, distribution from history, mapping assistant, chart proposal, MCP tools, live updates.
5. **Phase 5 — General availability**: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.

## 12. Constitution Reconciliation

- I Plugin-first: new plugin pair; core gains only a `RuleOwnerType` value; import, merge, long work, settings,
  tags and open items are existing platform pieces this plugin plugs into.
- II Tenant/organization scoping: every entity on the tenant and organization base; templates tenant scoped with
  an allow-list; follower writes run in the follower's own scope.
- III Both ORMs, additive migrations: MultiORM entities, MikroORM repositories, tri-dialect migrations, no drop.
- IV Default-off flag; nothing removed: `FEATURE_ACCOUNTING` off, `GAUZY_ACCOUNTING_ENABLED` unset; the tax posting
  key and organization fiscal fields stay.
- V Contracts and API first: `accounting.model.ts`, REST before UI, additive OpenAPI.
- VI Permissions, privacy, security: thirteen keys with contributed default grants, file handling rules.
- VII Real-time through the event bus: outbox events and realtime hints only.
- VIII i18n and accessibility: `ACCOUNTING.*` keys in 14 locales; keyboard tree and grid.
- IX Tests: unit specs per service, `*.db.spec.ts` on SQLite for trees, sets, imports and merges, ORM parity specs,
  migration spec, e2e for the main routes, component specs.
- X Behaviour-first spec: implementation lives here only.
- XI Documentation describes our platform only.

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Dimension set table grows without bound | Medium | Medium | sets are shared by hash; cap of 12 dimensions; label cached; index by `(dimensionId, valueId)` |
| Merge as alias makes every balance read resolve aliases | Medium | Medium | the ledger's maintained balances are keyed by the effective account and rebuilt by the merge job; lines keep the original |
| Follower propagation diverges | Low | High | per-follower atomic apply, conflict findings, nightly comparison job reporting drift |
| Importer accepts a tree that breaks statements | Low | High | class and root checks are blocking; replace mode only before go-live; all-or-nothing apply |
| Reading record and tag values from their sources slows set descriptions | Medium | Low | the set's `label` is cached at creation; batch reads per source reader; names refreshed on display |
| Code comments that describe the hand-off model are updated with the plugin | High | Low | the tax comment is updated when `tax-engine` maps accounts; behaviour is unchanged with the flag off |

## 14. References

- Spec: `./spec.md` · Tasks: `./tasks.md`
- Patterns followed: `packages/plugins/purchasing/src/lib/purchasing.plugin.ts`, `purchasing.features.ts`,
  `purchasing.permissions.ts`, `database/migrations/1791000000340-CreatePurchasingTables.ts`;
  `packages/plugins/task-automations/src/lib/database/migration-helpers.ts`, `schedule/`;
  `packages/plugins/inventory/src/lib/database/migrations/1791000000161-CreateInventoryTables.ts` (append-only
  triggers); `apps/api/src/plugin-composition.ts`; `packages/plugins/task-automations-ui/src/lib/task-automations-ui.plugin.ts`
- Kernel used: `packages/core/src/lib/money`, `event-outbox`, `idempotency`, `sequence`, `official-holiday`,
  `organization` (fiscal dates, currency), `tags`, `tag-type`, `rule` (`rule.evaluator.ts`), `operation`,
  `api/async-operation.ts`, `job-execution`, `export-import`, `packages/plugin/src/lib/plugin-contributions.ts`,
  `packages/scheduler`; page location `accounting-sections` (`apps/gauzy/src/app/pages/pages.routes.ts`)
- Related plans: `../general-ledger/plan.md` (posting contract §4, events §5), `../budgets-and-revenue-schedules/plan.md`,
  `../data-import-export/plan.md` (`data_import_run`, `data_merge`), `../invoicing-receivables-payables/plan.md`
  (open-item register)
