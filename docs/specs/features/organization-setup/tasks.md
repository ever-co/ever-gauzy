# Task Breakdown: Organization setup

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `organization-setup`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_ORGANIZATION_STRUCTURE`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are relative to the repository
  root; `os/` means `packages/plugins/organization-structure/src/lib/`.
- Plan phase 1 is T1 to T16 with T35, T36 and T51; phase 2 is T17 to T22 with T37; phase 3 is T23 to T34 with T38 to T42;
  phase 4 (advanced) is T44 to T50; T43 closes each phase (OpenAPI and docs).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/organization-structure.model.ts` (profile, tree, defaults, shares,
  relationships, setup, data runs and handlers, overview, register) and the `ORGANIZATION_CHANGE_GUARDS` interface;
  export from `index.ts`. Test: contract compile spec.
- [ ] **T2**. Plugin scaffold `packages/plugins/organization-structure` (package, project, tsconfig, jest, eslint,
  `organization-structure.plugin.ts`, module), feature contribution `FEATURE_ORGANIZATION_STRUCTURE` (default off),
  settings, `apps/api/src/plugins.ts` entry. Test: plugin list spec; flag off → routes `404`.
- [ ] **T3**. Permissions `os/organization-structure.permissions.ts` (eleven keys with `defaultFor`; no migration).
  Test: grants per role on a new tenant and after the permission reload. Migration timestamps: `1791000071100` to `1791000071199` (`packages/plugins/organization-structure`); `1791000071200` to `1791000071299` (`packages/plugins/pricing`).
- [ ] **T4**. Plugin migration set `os/database/migrations/` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), no copy in the plugin. Test: an empty migration run on SQLite.
- [ ] **T5**. Entities profile (no country column), group default, share, share member, share default, relationship +
  MikroORM repositories. Files: `os/profile/organization-profile.entity.ts`, `os/defaults/organization-group-default.entity.ts`,
  `os/sharing/organization-share.entity.ts`, `os/sharing/organization-share-member.entity.ts`,
  `os/sharing/organization-share-default.entity.ts`, `os/relationships/organization-relationship.entity.ts` (each with
  `repository/`), `os/database/migrations/1791000071100-CreateOrganizationStructureTables.ts`. Test: migration spec (up
  twice), unique indexes on three dialects, mapping spec for both ORMs.
- [ ] **T6** (parallel). Entities setup run, setup template, data run (dry run, `planHash`, `operationId`), demo record
  (keyed by `operationId`). Files: `os/setup/organization-setup-run.entity.ts`, `os/setup/organization-setup-template.entity.ts`,
  `os/data-runs/organization-data-run.entity.ts`, `os/data-runs/organization-demo-record.entity.ts`,
  `os/database/migrations/1791000071110-CreateOrganizationSetupTables.ts`. Test: migration spec (up twice).
- [ ] **T7** (parallel). Entities share class, shareholder, share transaction, holding range. Files:
  `os/register/share-class.entity.ts`, `os/register/shareholder.entity.ts`, `os/register/share-transaction.entity.ts`,
  `os/register/share-holding-range.entity.ts`, `os/database/migrations/1791000071120-CreateShareRegisterTables.ts`. Test:
  migration spec.
- [ ] **T8** (parallel). Pricing: `exchange_rate.purpose` nullable column, migration
  `packages/plugins/pricing/src/lib/database/migrations/1791000071200-AddExchangeRatePurpose.ts`, optional
  `PRICING_RATE_BOOK` port read by
  `ExchangeRateService.findRateAt`. Test: existing pricing specs unchanged; purpose preference spec; unbound port →
  today's lookup.
- [ ] **T51**. Core guard slot: `ORGANIZATION_CHANGE_GUARDS` consulted by
  `packages/core/src/lib/organization/organization.service.ts` (update, with `afterUpdate(before, after)`) and
  `organization-deletion.ts` (soft delete, delete for good); unbound → unchanged. Core settings store: the organization
  level in `packages/core/src/lib/tenant/tenant-setting/tenant-setting.service.ts` (`resolve(names, { tenantId,
  organizationId?, channelId? })` channel → organization → inherited → tenant → global → declared default;
  `saveOrganizationSettings`; optional `SETTING_INHERITANCE` token; `getResolvedSettings` unchanged). Files:
  `packages/core/src/lib/organization/organization-change-guards.ts`,
  `packages/core/src/lib/organization/organization.service.ts`, `packages/core/src/lib/organization/organization-deletion.ts`,
  `packages/core/src/lib/tenant/tenant-setting/tenant-setting.service.ts`,
  `packages/core/src/lib/tenant/tenant-setting/setting-inheritance.ts`. Test:
  `packages/core/src/lib/tenant/tenant-setting/tenant-setting.resolve.spec.ts` and
  `packages/core/src/lib/organization/organization-change-guards.spec.ts`: core specs unchanged; guard refusal surfaces as `422`; resolution-order table spec on three dialects; a plugin setting declared
  with scope `ORGANIZATION` resolves per organization.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Core guard slot and the organization level of the settings store: built by T51 (Phase 1, `packages/core/src/lib/tenant/tenant-setting/`); its tests are T51's.
- [ ] **T10**. Profile service and controller `os/profile/` (short code rules, commencement date, country read from and
  written to `organization.contact.country` with the event from the guard's `afterUpdate`, branding, lazy profile
  creation) (FR-4 to FR-7, FR-10, FR-11). Test: unit and e2e on SQLite; a country edited on the existing location tab
  publishes the event.
- [ ] **T11**. Organization addresses on the core address book: `address` rows with `ownerType = ORGANIZATION`, roles
  and defaults through `AddressRoleService` (`assign`, `setDefault`, `defaultFor`), `OTHER` added to `AddressRoleEnum`,
  the organization's contact address as fallback default (FR-9). Files: `os/addresses/organization-address.service.ts`,
  `packages/core/src/lib/address-role/address-role.service.ts`, `packages/core/src/lib/address-role/address-role.enums.ts`
  and `schema/address-role.type.gql` (`OTHER`). Test: one default per role on three dialects; `defaultFor` answers the contact address when no role
  default exists.
- [ ] **T12**. Tree service `os/tree/` (group flag, path maintenance, cycle and parent rules, ownership links, as-of
  reads, move preview of inherited changes, reporting currency derivation) and `ORGANIZATION_TREE` (FR-12 to FR-20).
  Test: unit table of refused moves; SQLite spec of a three-level move.
- [ ] **T13**. Organization change guard `os/guards/organization-change.guard.ts`: currency lock from journal counts,
  and from document counts only with `organization.lockCurrencyOnceDocuments` on (else a warning), group with
  children, delete rules with what remains, lock during data runs (FR-8, FR-19, FR-69); inert while the flag is off.
  Test: each refusal with its counts; with the setting off an organization with invoices and no journals changes its
  currency after the warning.
- [ ] **T14**. Defaults service `os/defaults/` (declarations from `PluginSettingRegistry` and
  `ORGANIZATION_DEFAULT_DECLARATIONS`, including the existing organization fields and settings tables read through
  their owners; values in `tenant_setting` through T51; group values and enforce switch in `organization_group_default`
  bound to `SETTING_INHERITANCE`; validation, tenant-wide values, fixed once used, cache with event eviction,
  readiness) and `ORGANIZATION_DEFAULTS` (FR-21 to FR-29). Test: resolution-order table spec; `409` on a stale
  `If-Match`; an organization field default is written to the organization row, not copied; with the root enforcing
  30 days, an intermediate group's enforced 60 days is refused with `ORG_DEFAULT_ENFORCED` and a descendant
  resolves 30; a value an intermediate group enforced before the root did shows as overridden.
- [ ] **T15**. Controllers and DTOs for profile, tree, defaults, readiness; `@FeatureFlag`, Swagger; membership checks
  (organizations the caller belongs to, or all of the tenant with `ALL_ORG_EDIT`; another tenant's organization
  answers `404`). Files: `os/profile/organization-profile.controller.ts`, `os/tree/organization-tree.controller.ts`,
  `os/defaults/organization-defaults.controller.ts`, `os/defaults/organization-readiness.controller.ts`, `dto/` beside
  each. Test: e2e on SQLite; `404` with the flag off; a non-member is refused.
- [ ] **T16**. Events and realtime hints for tree, profile, country and defaults (FR-20, FR-29, FR-100). Files:
  `os/events/organization-structure.events.ts`, `os/events/organization-structure.hints.ts`. Test: event once per
  change.
- [ ] **T17**. Sharing service `os/sharing/` (modes, expansion into member rows, sharing defaults, `filter` sub-select
  for both ORMs, additive to the organization's own and tenant-wide records, `assertShared`, in-use refusal through
  `ORGANIZATION_SHAREABLE_TYPES`) (FR-30 to FR-36, FR-38). Test: filter spec on three dialects; unshare refused with open
  documents; with no share configured every list returns the same rows as without the filter, tenant-wide rows
  included.
- [ ] **T18**. Share changes of a tree move (FR-15, FR-35, FR-36): the move transaction of T12 deletes and inserts the
  group-origin member rows of the moved subtree set-based, after the in-use check on the removed rows that leave the
  organization no other member row for their record, and publishes
  `organization_structure.tree.changed` after commit; the consumer on tree changes only reconciles. Files:
  `os/sharing/share-tree-move.ts`, `os/tree/organization-tree.service.ts`, `os/sharing/share-reexpansion.consumer.ts`.
  Test: joining and leaving a group; right after a move commits (consumer stopped) the departed organization reads
  none of the group's records and the joining one reads them; leaving a group while an open order uses a group-shared
  customer is refused with `ORG_SHARE_IN_USE` listing the order, and nothing moves; with the same customer also shared
  directly with that organization, the departure goes through and the order keeps its customer.
- [ ] **T19**. Document check participant `os/sharing/organization-document.check.ts` bound to `DOCUMENT_CHECKS`
  (shared party and items, organization lock) and `DOCUMENT_ORGANIZATION_PROFILE` (short code, internal party,
  pair policy) (FR-34, FR-64, FR-88). Test: unit with a stub document.
- [ ] **T20**. Shared-masters page data and bulk share route (FR-37, FR-38). Files:
  `os/sharing/shared-masters.service.ts`, `os/sharing/organization-sharing.controller.ts`
  (`/shared-masters`, `/shares/bulk`). Test: per-record results.
- [ ] **T21**. Rate book `os/rates/rate-book.service.ts` bound to `PRICING_RATE_BOOK`, rate purpose, rate book view
  and duplicate rules (FR-39 to FR-41, FR-43). Test: lookup order spec with group root rates.
- [ ] **T22**. Pegs proposal through `ORGANIZATION_CURRENCY_PEGS` with the shipped list and its as-of date (FR-42).
  Files: `os/rates/currency-pegs.service.ts`, `os/rates/currency-pegs.data.ts`. Test: proposal only, nothing written
  before confirmation.
- [ ] **T23**. Setup assistant `os/setup/` (runs, steps registry `ORGANIZATION_SETUP_STEPS`, built-in steps for
  profile, currencies and formats hosting the existing `organizations-step-form` sections, structure, addresses,
  defaults, departments through core `OrganizationDepartmentService`, modules through core `feature_organization`,
  idempotent apply, progress, failure handling) (FR-44, FR-46, FR-47, FR-51, FR-52). Test: apply twice creates once;
  the step form writes the same organization fields as organization creation.
- [ ] **T24**. Industry templates `os/setup/templates/` (eight shipped, tenant-saved) and copy setup from another
  organization (FR-49, FR-50). Test: copy excludes transactions.
- [ ] **T25**. Data runs on the core operation runtime `os/data-runs/`: operation types `ORG_*` registered with
  `OperationRegistry`, `aggregateType` `organization` for one live run per organization, one step per record type with
  the cursor in the step state, slices of 1,000, pause and resume through the runtime's parked state, cancel and
  retry through `/api/operations`, `ORGANIZATION_DATA_HANDLERS` registry, `@AcceptedOperation` (FR-56, FR-63). Test:
  resume after a killed process; a second run for the same organization is refused.
- [ ] **T26**. Demo data runs: core demo handlers call the existing `createRandom*` seeders for one organization;
  `IOnPluginWithOrganizationRandomSeed` added to `packages/plugin/src/lib/plugin.hook.ts` for plugins; a seeding-context
  subscriber records created ids in `organization_demo_record`; demo organization kind and its removal path (FR-53 to
  FR-57). Test: removal leaves people's records; same seed → same data.
- [ ] **T27**. Transaction deletion: dry run with dependents and protected types returning its `planHash` (the
  `account-deletion` contract), confirmation with `planHash`, typed name and second factor (`409` when the plan
  changed), archive writer to tenant storage, lock, recalculation hooks, deletion record, counter reset option (FR-58
  to FR-68). Files: `os/data-runs/transaction-deletion.service.ts`, `os/data-runs/deletion-dry-run.ts`,
  `os/data-runs/deletion-archive.writer.ts`, `os/data-runs/organization-data-runs.controller.ts`. Test: SQLite end-to-end
  with three handlers; protected type refused; archive complete before the first delete; a time log and an expense
  created after the confirmation and before their slice runs are kept, archived nowhere and listed in the outcome.
- [ ] **T28**. Core data handlers derived from `FactoryResetService`'s dependency-ordered repository list, filtered to
  one organization and classified (comments, activity entries, attachment links, notifications, time logs, expenses,
  invoices and payments as transactions; contacts, items, employees as masters), each selecting only records created
  at or before the run's `confirmedAt`. Files:
  `os/data-runs/handlers/core-data-handlers.ts`, `packages/core/src/lib/user/factory-reset/factory-reset.service.ts`
  (the ordered list exported). Test: handler contract kit green for each; the handler order equals the factory-reset
  order.
- [ ] **T29**. Delete for good as an `ORG_PURGE` run (setting handlers of every feature, tenant settings naming the
  organization, then core delete for good) and soft-delete side effects: shares, group defaults and pairs
  deactivated and restored with the organization (FR-69, FR-70). Files: `os/data-runs/organization-purge.operation.ts`,
  `os/guards/organization-soft-delete.listener.ts`. Test: purge leaves no setting row of the organization; restore brings
  shares and pairs back.
- [ ] **T30**. Shareholder register services `os/register/` (classes, holders, drafts, range arithmetic, validations,
  holding ranges, cancel rule, delete rules) (FR-71 to FR-77). Test: table spec of every refusal; range split and
  merge spec.
- [ ] **T31**. Register as a document type through `ORGANIZATION_DOCUMENTS` (`share_transaction`, numbering, lifecycle)
  and posting facts through `ORGANIZATION_LEDGER_TYPES` (FR-73, FR-75, FR-78). Files:
  `os/register/share-transaction-document.type.ts`, `os/register/share-transaction-posting.facts.ts`. Test: confirm
  publishes `document.share_transaction.confirmed` with components; accounting off → no facts needed.
- [ ] **T32**. Register reports (share movements, holdings) and certificate through `ORGANIZATION_PRINT` (FR-79,
  FR-80, FR-82). Files: `os/register/reports/share-movements.report.ts`, `os/register/reports/holdings.report.ts`,
  `os/register/share-certificate.template.ts`. Test: report rows on seeded data.
- [ ] **T33**. Overview: monthly target as a core `goal_kpi` per organization, sales by month from the core statistics
  queries extended with the invoice or order source, document counts through `ORGANIZATION_DOCUMENTS`, group
  aggregation in the group currency, realtime hint on confirmed or cancelled sales documents (FR-83 to FR-85). Files:
  `os/overview/organization-overview.service.ts`, `os/overview/sales-target.service.ts`,
  `packages/core/src/lib/employee-statistics/employee-statistics.service.ts` (source option). Test: the overview's
  months equal the accounting dashboard's income months.
- [ ] **T34**. Controllers for sharing, rates, setup, data runs, register and overview (the relationships controller
  comes with T47); events for setup, data runs and register (FR-100). Files:
  `os/sharing/organization-sharing.controller.ts`, `os/rates/rate-book.controller.ts`,
  `os/setup/organization-setup.controller.ts`, `os/data-runs/organization-data-runs.controller.ts`,
  `os/register/share-register.controller.ts`, `os/overview/organization-overview.controller.ts`,
  `os/events/organization-structure.events.ts`. Test: e2e on SQLite.

## Phase 3 — UI surfaces

- [ ] **T35**. Angular `packages/plugins/organization-structure-ui`: Structure tab on the existing organization edit
  page (profile, address-book entries with roles through the core address routes, branding, ownership), tree page with
  list alternative and keyboard moves, the existing `gauzy-logo` component and the favicon made organization-aware from
  the `Store` where `organization.inAppBranding` is on; `ORGANIZATION_STRUCTURE.*` keys in every locale. Test: rendering
  and keyboard specs; with the flag or the setting off the logo and favicon render as today.
- [ ] **T36**. Defaults tab on the organization edit page with source badges and enforce switch; readiness panel.
  Files: `packages/plugins/organization-structure-ui/src/lib/components/defaults-tab/organization-defaults-tab.component.ts`,
  `components/readiness/organization-readiness-panel.component.ts`, `services/organization-defaults.service.ts`.
  Test: component specs.
- [ ] **T37**. Shared-masters page, share dialog for owners' record pages, rate book page. Files:
  `packages/plugins/organization-structure-ui/src/lib/components/shared-masters/shared-masters-page.component.ts`,
  `components/share-dialog/share-record-dialog.component.ts`, `components/rate-book/rate-book-page.component.ts`. Test:
  component specs.
- [ ] **T38**. Setup tab: assistant shell hosting the `organizations-step-form` sections and contributed step
  components, proposal preview and apply. Files:
  `packages/plugins/organization-structure-ui/src/lib/components/setup-tab/setup-assistant.component.ts`,
  `components/setup-tab/setup-step-preview.component.ts`,
  `packages/ui-core/shared/src/lib/organizations/organizations-step-form/organizations-step-form.component.ts`. Test:
  component specs with stub steps.
- [ ] **T39**. Data tab: demo data, deletion with dry run, typed confirmation, live progress from the core operation
  events and archive download; banner while locked; link to and from Settings → Danger zone. Files:
  `packages/plugins/organization-structure-ui/src/lib/components/data-tab/organization-data-tab.component.ts`,
  `components/data-tab/deletion-dry-run.component.ts`, `components/data-tab/deletion-confirm-dialog.component.ts`,
  `components/banners/data-run-banner.component.ts`. Test: component specs with a stubbed channel.
- [ ] **T40**. Share register pages (classes, holders, transactions, reports, certificate) and the overview on the
  existing accounting dashboard. Files:
  `packages/plugins/organization-structure-ui/src/lib/components/register/share-classes.component.ts`,
  `components/register/shareholders.component.ts`, `components/register/share-transactions.component.ts`,
  `components/register/register-reports.component.ts`, `components/overview/organization-overview-widget.component.ts`.
  Test: component specs.
- [ ] **T41** (parallel). Angular shared pieces in `organization-structure-ui`: organization tree picker in the existing
  organization switcher (only with the flag on), sandbox and demo banner, default source badge; no separate React
  package. Test: rendering specs; the switcher is unchanged with the flag off.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T42**. MCP tools in `packages/mcp-server/src/lib/tools/organization-structure.ts` (tree, defaults, shares,
  demo data, dry run, register, overview; the relationships tool comes with T47) registered in
  `register-all-tools.ts`; data-run confirmation,
  sandbox reset and demo removal refused for agents, dry runs allowed; every action taken by an agent marked in the
  organization's history (FR-97 to FR-99). Test: tool schema spec; agent confirm refused; an agent's change shows the
  agent in the history.
- [ ] **T43**. OpenAPI regenerated; SDK regeneration noted; user docs and `docs/specs/README.md` row. Test: OpenAPI
  diff additive.

## Phase 5 — Advanced capabilities

- [ ] **T44**. Proposal engine from country and industry: answers to proposals per step, contributed proposals from
  regional packs, accounting and business documents (FR-45). Files: `os/setup/proposal-engine.ts`,
  `os/setup/proposal-contributions.registry.ts`. Test: two countries × two industries snapshot specs.
- [ ] **T45**. Conversational assistant tools (`organization_setup_status`, `_next_question`, `_answer`, `_propose`,
  `_apply`) with confirmation in the conversation and agent marking (FR-48). Files:
  `packages/mcp-server/src/lib/tools/organization-structure.ts`, `os/setup/conversational-setup.service.ts`. Test: agent
  run to completion with stubbed steps.
- [ ] **T46**. Consolidation-ready links: ownership proposals from the register when the holder is an organization
  of the tenant, and the as-of reader used by consolidation groups (FR-14, FR-81). Files:
  `os/register/ownership-proposal.service.ts`, `os/tree/organization-tree-as-of.reader.ts`. Test: issue of 100 % proposes
  the link ownership.
- [ ] **T47**. Inter-organization pairs: internal customer and supplier created both ways through core
  `OrganizationContactService` and `OrganizationVendorService`, pair policies, matrix with mismatches, deactivation on
  leave (FR-86 to FR-90). Files: `os/relationships/organization-relationship.service.ts`,
  `os/relationships/organization-relationships.controller.ts`, `os/relationships/relationship-matrix.query.ts`,
  `packages/plugins/organization-structure-ui/src/lib/components/relationships/relationship-matrix.component.ts`, the
  relationships read tool in `packages/mcp-server/src/lib/tools/organization-structure.ts`. Test: SQLite spec with two
  organizations and the counterpart consumer of `business-documents` stubbed.
- [ ] **T48**. Sandbox copies on the export / import pipeline: export of the organization, the handlers'
  anonymization rules applied to the rows, import into the new organization with `import_record` id mapping,
  non-deliverable emails, integrations, webhooks and payment connections switched off, refusal of outside sends, invited-only access,
  reset and expiry with reminders (FR-91 to FR-96). Files: `os/sandbox/sandbox-copy.operation.ts`,
  `os/sandbox/sandbox-anonymiser.ts`, `os/sandbox/sandbox-outbound.guard.ts`, `os/sandbox/sandbox-expiry.scheduler.ts`,
  `os/sandbox/sandbox.controller.ts`. Test: copy of a seeded organization leaves the source unchanged; each outside
  channel refused.
- [ ] **T49**. MCP write tools with preview for tree, defaults, shares, demo data and sandbox creation. Files:
  `packages/mcp-server/src/lib/tools/organization-structure.ts`. Test: preview writes nothing.
- [ ] **T50**. Realtime hints for overview and sandbox banners; data-run progress from the core operation events.
  Files: `os/events/organization-structure.hints.ts`,
  `packages/plugins/organization-structure-ui/src/lib/components/banners/sandbox-banner.component.ts`. Test: hint spec.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T2, T13, T15 |
| FR-2 | §3.1 Scope and compatibility | T10, T12 |
| FR-3 | §3.1 Scope and compatibility | T3, T15 |
| FR-4 | §3.1 Scope and compatibility | T10 |
| FR-5–FR-7 | §3.2 Company profile | T10 |
| FR-8 | §3.2 Company profile | T13 |
| FR-9 | §3.2 Company profile | T11 |
| FR-10 | §3.2 Company profile | T10, T35 |
| FR-11 | §3.2 Company profile | T10 |
| FR-12–FR-13 | §3.3 Organization tree and group companies | T12 |
| FR-14 | §3.3 Organization tree and group companies | T12, T46 |
| FR-15 | §3.3 Organization tree and group companies | T12 |
| FR-16 | §3.3 Organization tree and group companies | T12, T35 |
| FR-17–FR-18 | §3.3 Organization tree and group companies | T12 |
| FR-19 | §3.3 Organization tree and group companies | T12, T13 |
| FR-20 | §3.3 Organization tree and group companies | T12, T16 |
| FR-21 | §3.4 Per-organization and group defaults | T14, T36 |
| FR-22–FR-28 | §3.4 Per-organization and group defaults | T14 |
| FR-29 | §3.4 Per-organization and group defaults | T14, T16 |
| FR-30–FR-33 | §3.5 Shared masters | T17 |
| FR-34 | §3.5 Shared masters | T17, T19 |
| FR-35 | §3.5 Shared masters | T17 |
| FR-36 | §3.5 Shared masters | T17, T18 |
| FR-37 | §3.5 Shared masters | T20, T37 |
| FR-38 | §3.5 Shared masters | T17, T20 |
| FR-39–FR-40 | §3.6 Currencies and exchange rates | T8, T21 |
| FR-41 | §3.6 Currencies and exchange rates | T21, T37 |
| FR-42 | §3.6 Currencies and exchange rates | T22 |
| FR-43 | §3.6 Currencies and exchange rates | T21 |
| FR-44 | §3.7 Setup assistant | T23, T38 |
| FR-45 | §3.7 Setup assistant | T44 |
| FR-46–FR-47 | §3.7 Setup assistant | T23 |
| FR-48 | §3.7 Setup assistant | T45 |
| FR-49–FR-50 | §3.7 Setup assistant | T24 |
| FR-51–FR-52 | §3.7 Setup assistant | T23 |
| FR-53–FR-54 | §3.8 Demo data | T26 |
| FR-55 | §3.8 Demo data | T26, T41 |
| FR-56 | §3.8 Demo data | T25, T26 |
| FR-57 | §3.8 Demo data | T26 |
| FR-58–FR-62 | §3.9 Deleting an organization's transactions | T27 |
| FR-63 | §3.9 Deleting an organization's transactions | T25, T27 |
| FR-64 | §3.9 Deleting an organization's transactions | T19, T27 |
| FR-65 | §3.9 Deleting an organization's transactions | T27, T28 |
| FR-66–FR-68 | §3.9 Deleting an organization's transactions | T27 |
| FR-69 | §3.10 Deleting an organization | T13, T29 |
| FR-70 | §3.10 Deleting an organization | T29 |
| FR-71–FR-72 | §3.11 Shareholder register | T30 |
| FR-73 | §3.11 Shareholder register | T30, T31 |
| FR-74 | §3.11 Shareholder register | T30 |
| FR-75 | §3.11 Shareholder register | T30, T31 |
| FR-76–FR-77 | §3.11 Shareholder register | T30 |
| FR-78 | §3.11 Shareholder register | T31 |
| FR-79–FR-80 | §3.11 Shareholder register | T32 |
| FR-81 | §3.11 Shareholder register | T46 |
| FR-82 | §3.11 Shareholder register | T32 |
| FR-83–FR-85 | §3.12 Organization overview | T33, T40 |
| FR-86–FR-87 | §3.13 Inter-organization relationships | T47 |
| FR-88 | §3.13 Inter-organization relationships | T19, T47 |
| FR-89–FR-90 | §3.13 Inter-organization relationships | T47 |
| FR-91–FR-96 | §3.14 Sandbox copies | T48 |
| FR-97 | §3.15 Agents, events and real time | T42, T49 |
| FR-98 | §3.15 Agents, events and real time | T42 |
| FR-99 | §3.15 Agents, events and real time | T42, T45 |
| FR-100 | §3.15 Agents, events and real time | T16, T34 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows a group tree with inherited defaults, a shared
  customer, the assistant's proposal, a deletion dry run and the register reports end to end; spec AC-13 holds.
- Constitution gates in `spec.md` §9 confirmed.
- With the flag off, existing organization, address, tenant-setting, pricing exchange-rate, seed and deletion suites
  pass unchanged.
- Handler contract kit green for every core and plugin data handler; no organization-scoped table is unhandled in the
  dry run of the demo tenant.
