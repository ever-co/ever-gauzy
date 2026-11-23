# Task Breakdown: Fixed assets

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `fixed-assets`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- `fa/` means `packages/plugins/fixed-assets/src/lib/`, `faui/` means `packages/plugins/fixed-assets-ui/src/lib/`. Each
  entity folder follows the plugin layout of `packages/plugins/inventory`: `<name>.entity.ts`, `<name>.service.ts`,
  `<name>.controller.ts`, `dto/`, `repository/type-orm-<name>.repository.ts` and
  `repository/mikro-orm-<name>.repository.ts`. Migrations take the timestamps `1791000080100` to `1791000080140` in
  the order the plan lists them.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/fixed-asset.model.ts` (interfaces, enums, preview, run and
      event shapes; export from `packages/contracts/src/index.ts`). Test: type-level spec compiles against sample payloads.
- [ ] **T2**. Plugin scaffold `packages/plugins/fixed-assets` (`package.json`, `project.json`, `tsconfig.json`,
      `tsconfig.lib.json`, `tsconfig.spec.json`, `jest.config.ts`, `src/index.ts`, path mapping in the root
      `tsconfig.json`), `fa/fixed-assets.plugin.ts`, `fa/fixed-assets.module.ts`, `fa/fixed-assets.features.ts`
      (`FEATURE_FIXED_ASSETS`, default off), `fa/fixed-assets.permissions.ts` (eleven keys); registered in
      `apps/api/src/plugins.ts`. Test: plugin list spec; routes answer `404` with the feature off.
- [ ] **T3**. Migration `fa/database/migrations/1791000080100-CreateFixedAssetRegisterTables.ts` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`) (categories, accounts,
      book rules, item rules, asset with `equipmentId` and `dimensionSetId`, books, revisions, lines with
      `operationId`, factors, snapshots) for PostgreSQL, MySQL and SQLite, listed in
      `fa/database/fixed-assets-migrations.ts`. Test: migration spec on SQLite; up twice is
      a no-op. Migration timestamps: `1791000080100` to `1791000080199` (`packages/plugins/fixed-assets`).
- [ ] **T4** (parallel). Entities and MikroORM repositories for the register tables:
      `fa/asset-category/{asset-category,asset-category-account,asset-category-book-rule}.entity.ts`,
      `fa/asset-item-rule/asset-item-rule.entity.ts`, `fa/asset/asset.entity.ts`,
      `fa/asset-book/{asset-book,asset-schedule-revision,asset-depreciation-line}.entity.ts`,
      `fa/asset-intensity-factor/asset-intensity-factor.entity.ts`,
      `fa/asset-balance-snapshot/asset-balance-snapshot.entity.ts`, with their `repository/` files, listed in
      `fa/entities/index.ts`. Test: both ORMs map each entity (repository smoke specs).
- [ ] **T5**. Migration `fa/database/migrations/1791000080110-CreateFixedAssetDocumentTables.ts` + entities (locations, movement, capitalisation, repair,
      value adjustment, disposal). Files: `fa/asset-location/asset-location.entity.ts`,
      `fa/asset-movement/{asset-movement,asset-movement-line}.entity.ts`,
      `fa/asset-capitalisation/{asset-capitalisation,asset-capitalisation-line}.entity.ts`,
      `fa/asset-repair/{asset-repair,asset-repair-part,asset-repair-bill-line}.entity.ts`,
      `fa/asset-value-adjustment/asset-value-adjustment.entity.ts`, `fa/asset-disposal/asset-disposal.entity.ts`.
      Test: migration spec on SQLite.
- [ ] **T6** (parallel). Migrations `CreateFixedAssetMaintenanceTables` (plans, tasks with shared recurrence,
      occurrence links to core tasks and field-service visits, insurance), `CreateFixedAssetAuditAndUsageTables`,
      `CreateFixedAssetLeaseTables` + entities. Files: `fa/database/migrations/1791000080120-CreateFixedAssetMaintenanceTables.ts`,
      `fa/database/migrations/1791000080130-CreateFixedAssetAuditAndUsageTables.ts`,
      `fa/database/migrations/1791000080140-CreateFixedAssetLeaseTables.ts`,
      `fa/asset-maintenance/{asset-maintenance-plan,asset-maintenance-task,asset-maintenance-occurrence}.entity.ts`,
      `fa/asset-insurance-policy/asset-insurance-policy.entity.ts`,
      `fa/asset-audit/{asset-audit-session,asset-audit-scan}.entity.ts`,
      `fa/asset-usage-reading/asset-usage-reading.entity.ts`, `fa/asset-lease/{asset-lease,asset-lease-period}.entity.ts`.
      Test: migration specs.
- [ ] **T7**. Default grants of plan §9 as `defaultFor` on the permission contributions (no seed migration);
      organization settings in `fa/fixed-assets.settings.ts`. Test: grants resolve for the three roles; settings resolve
      per organization.
- [ ] **T8**. Port tokens and interfaces in `fa/ports/` (`fa/ports/fixed-assets.ports.ts`: `FIXED_ASSETS_LEDGER` incl.
      the finding writer of `general-ledger`, `FIXED_ASSETS_STOCK`, `FIXED_ASSETS_INVOICING`, `FIXED_ASSETS_DOCUMENTS`,
      `FIXED_ASSETS_APPROVALS`, `FIXED_ASSETS_FIELD_SERVICE`) with no-op defaults (`fa/ports/no-op-ports.ts`); bindings in
      `apps/api/src/plugin-composition.ts`. Test: services run with every port unbound.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Category service and controller (`fa/asset-category/asset-category.service.ts`,
      `fa/asset-category/asset-category.controller.ts`, `fa/asset-category/dto/`): CRUD, account roles per organization
      with type and currency checks, book rules, refusal rules of spec FR-3. Test: unit and e2e, including the refusals.
- [ ] **T10**. Asset service and controller (`fa/asset/asset.service.ts`, `fa/asset/asset.controller.ts`,
      `fa/asset/dto/`): draft CRUD (name, serial number, image and tags of a tangible asset written to and read from its
      equipment row through `EquipmentService` of `packages/core/src/lib/equipment/equipment.service.ts`), dimension
      sets, states, composite and component roll-up, optimistic version, cursor list with filters joined to equipment.
      Test: unit; `409` on concurrent confirm; nothing of the equipment row is stored on the asset.
- [ ] **T11**. Document type registration with the business document engine (asset, movement, capitalisation,
      repair, value adjustment, disposal, depreciation run, lease period): series, lifecycle, links. Files:
      `fa/documents/fixed-assets-document-types.ts`, `fa/asset/asset-links.service.ts`. Test: number
      assigned once; confirm and cancel transitions.
- [ ] **T12**. Equipment link: `POST /assets/from-equipment`, equipment row created with a tangible asset when none
      is chosen, relink, "make lendable" on the equipment row; operational state "on loan" computed from approved
      `equipment_sharing` rows. Files: `fa/asset/asset-equipment.service.ts`, `fa/asset/asset-operational-state.ts`,
      `fa/asset/asset.controller.ts`. Test: SQLite spec with seeded sharings; equipment routes unchanged; a tangible asset
      without equipment is refused.
- [ ] **T13**. Locations service and controller (tree, path maintenance, delete guards; place from a core
      `warehouse` or `address`, inherited by sub-locations). Files: `fa/asset-location/asset-location.service.ts`,
      `fa/asset-location/asset-location.controller.ts`, `fa/asset-location/dto/`. Test: unit.
- [ ] **T14**. Movement service and controller: lines, rules of FR-46, confirm, cancel latest only,
      acknowledgement route, inbox item, escalation marker. Files: `fa/asset-movement/asset-movement.service.ts`,
      `fa/asset-movement/asset-movement.controller.ts`, `fa/asset-movement/dto/`. Test: unit and e2e.
- [ ] **T15**. Timeline: activity-log entries through `ActivityLogService` (actor person, automation or agent) read
      together with the document history; outbox events of plan §5; real-time hints. Files:
      `fa/timeline/asset-timeline.service.ts`, `fa/events/fixed-assets.events.ts`, `fa/events/fixed-assets-realtime.ts`.
      Test: each document writes its
      entry once; replayed outbox delivery writes nothing twice.
- [ ] **T16**. Schedule engine (`fa/engine/schedule-engine.ts`, `fa/engine/methods/` with `straight-line.ts`,
      `declining-balance.ts`, `written-down-value.ts`, `manual.ts`; `fa/engine/proration.ts`): straight line, declining
      balance, written-down value, manual; month and day proration; rounding on the last line. Test: property tests
      (total equals depreciable amount, no line before in-service date) and golden cases.
- [ ] **T17**. Revision engine: recompute unposted lines, posted lines immutable, intensity factors with
      rebalancing from the end, life extension, undo latest. Files: `fa/engine/revision-engine.ts`,
      `fa/asset-intensity-factor/asset-intensity-factor.service.ts`,
      `fa/asset-intensity-factor/asset-intensity-factor.controller.ts`. Test: property tests and golden cases.
- [ ] **T18**. Books service and schedule routes (read, preview, revise). Files: `fa/asset-book/asset-book.service.ts`,
      `fa/asset-book/asset-book.controller.ts`, `fa/asset-book/dto/`. Test: preview saves nothing.
- [ ] **T19**. Asset confirm, cancel and effects preview through `FIXED_ASSETS_LEDGER`; existing assets with opening
      values post nothing; work in progress and `POST /assets/:id/capitalise`. Files:
      `fa/asset/asset-confirmation.service.ts`, `fa/asset/asset.controller.ts`. Test: preview equals posted effects
      (contract test with a fake ledger port).
- [ ] **T20**. Depreciation run as core operation `ASSET_DEPRECIATION_RUN`: preview, steps of 500 lines per book,
      grouped or per-line journals, locked-period handling, failures stamped on lines, single line post and reverse,
      outbox consumer for posting results, failure notification. Files: `fa/depreciation/depreciation-run.operation.ts`,
      `fa/depreciation/depreciation-run.controller.ts`, `fa/depreciation/depreciation-posting.service.ts`,
      `fa/events/accounting-result.consumer.ts`. Test: each line posted once across repeated runs;
      partial failure continues; a second live operation for the same organization and book is refused.
- [ ] **T21**. Posting rule templates contributed to `accounting` for every document of plan §7. Files:
      `fa/posting/fixed-assets-posting-templates.ts`. Test: balanced
      journals for each template with the ledger's test harness.
- [ ] **T22**. Assets from purchases: item rules, outbox consumer for goods receipt and supplier bill events,
      per-unit and grouped creation, later bill linking, price difference, cancellation guard. Files:
      `fa/asset-item-rule/asset-item-rule.service.ts`, `fa/asset-item-rule/asset-item-rule.controller.ts`,
      `fa/purchases/purchase-events.consumer.ts`, `fa/purchases/asset-from-purchase.service.ts`. Test: SQLite
      end-to-end with fake purchase events; delivered twice creates assets once.
- [ ] **T23**. Capitalisation service and controller: stock, asset and service lines, stock port issue and return,
      consumed assets, "cost changed" flag, cancel restore. Files:
      `fa/asset-capitalisation/asset-capitalisation.service.ts`, `fa/asset-capitalisation/asset-capitalisation.controller.ts`,
      `fa/asset-capitalisation/dto/`. Test: unit; insufficient stock refuses without postings.
- [ ] **T24**. Repair service and controller: open, complete, confirm, add to value, bill-line ceiling, cancel.
      Files: `fa/asset-repair/asset-repair.service.ts`, `fa/asset-repair/asset-repair.controller.ts`,
      `fa/asset-repair/dto/`. Test: unit and e2e.
- [ ] **T25**. Value adjustment (revaluation, cost adjustment): date rules, offer to post earlier lines, revision,
      cancel guard. Files: `fa/asset-value-adjustment/asset-value-adjustment.service.ts`,
      `fa/asset-value-adjustment/asset-value-adjustment.controller.ts`. Test: unit.
- [ ] **T26**. Disposal: sale from the asset (invoice draft through `FIXED_ASSETS_INVOICING`), asset chosen on an
      invoice line (consumer of invoice events), catch-up depreciation, partial sale with split, restore on
      cancellation or credit, scrap and restore, split endpoint. Files: `fa/asset-disposal/asset-disposal.service.ts`,
      `fa/asset-disposal/asset-disposal.controller.ts`, `fa/asset-disposal/invoice-events.consumer.ts`,
      `fa/asset/asset-split.service.ts`. Test: unit and SQLite end-to-end.
- [ ] **T27**. Maintenance: plans and tasks with the shared core recurrence rules, occurrences created as core tasks
      (or field-service visits through `FIXED_ASSETS_FIELD_SERVICE` for external tasks), close rules checked on the
      task (certificate required), team membership check, cost. Files:
      `fa/asset-maintenance/asset-maintenance-plan.service.ts`, `fa/asset-maintenance/asset-maintenance-plan.controller.ts`,
      `fa/asset-maintenance/maintenance-occurrence.service.ts`, `fa/asset-maintenance/task-close.listener.ts`. Test:
      unit; one task per maintenance task and due date.
- [ ] **T28** (parallel). Insurance policies CRUD with their end reminders as `reminder` rows. Files:
      `fa/asset-insurance-policy/asset-insurance-policy.service.ts`,
      `fa/asset-insurance-policy/asset-insurance-policy.controller.ts`. Test: unit;
      reminder moves when the end date changes.
- [ ] **T29**. Schedules and workers (plan §8) in `fa/schedule/` (`fixed-assets.scheduler.ts`,
      `fixed-assets.worker.ts`, `fixed-assets-schedule.plugin.ts`); `FixedAssetsSchedulePlugin` in
      `apps/worker/src/plugins.ts`; in-process fallback. Test: sweep specs (window, once per key), plugin list specs.
- [ ] **T30**. Balance snapshots and integrity comparison (`/asset-integrity`) writing differences to the finding
      store of `general-ledger` (`source = FIXED_ASSETS`). Files: `fa/integrity/asset-balance-snapshot.service.ts`,
      `fa/integrity/asset-integrity.service.ts`, `fa/integrity/asset-integrity.controller.ts`. Test: seeded difference
      reported once.
- [ ] **T31**. Report definitions (register, depreciation ledger, roll-forward, activity, maintenance, value
      analytics) and dashboard cards registered with the report builder. Files:
      `fa/reports/fixed-assets-report-definitions.ts`, `fa/reports/fixed-assets-dashboard-cards.ts`. Test: figures agree
      with seeded postings.

## Phase 3 — UI surfaces

- [ ] **T32**. Angular plugin scaffold `packages/plugins/fixed-assets-ui` (`faui/fixed-assets-ui.plugin.ts`,
      `faui/fixed-assets.routes.ts`, `faui/services/fixed-assets-api.service.ts`), registered in
      `apps/gauzy/src/plugin-ui.config.ts`; routes through the `accounting-sections` page location; menu group,
      feature and permission gating; i18n keys `FIXED_ASSETS.*` in every locale of `packages/ui-core/i18n/assets/i18n/`.
      Test: plugin spec; menu hidden without the feature.
- [ ] **T33**. Categories, item rules and settings pages. Files:
      `faui/pages/categories/asset-categories-page.component.ts`, `faui/pages/item-rules/asset-item-rules-page.component.ts`,
      `faui/pages/settings/fixed-assets-settings-page.component.ts`. Test: component rendering specs.
- [ ] **T34**. Register list (saved view, filters, bulk label printing) and asset page (overview, books and
      schedule with revision compare, timeline, linked documents). Files:
      `faui/pages/register/asset-register-page.component.ts`, `faui/pages/asset/asset-page.component.ts`,
      `faui/components/schedule-compare/schedule-compare.component.ts`. Test: rendering specs; keyboard navigation.
- [ ] **T35** (parallel). Locations tree and movements pages with hand-over acknowledgement. Files:
      `faui/pages/locations/asset-locations-page.component.ts`, `faui/pages/movements/asset-movements-page.component.ts`.
      Test: rendering specs.
- [ ] **T36**. Depreciation page: run with preview, history and failures read from core operations. Files:
      `faui/pages/depreciation/depreciation-page.component.ts`. Test: rendering
      specs.
- [ ] **T37** (parallel). Capitalisation, repair, adjustment and disposal forms with effects preview panels.
      Files: `faui/pages/capitalisations/asset-capitalisation-form.component.ts`,
      `faui/pages/repairs/asset-repair-form.component.ts`, `faui/pages/adjustments/asset-adjustment-form.component.ts`,
      `faui/pages/disposals/asset-disposal-form.component.ts`, `faui/components/effects-preview/effects-preview.component.ts`.
      Test: rendering specs.
- [ ] **T38** (parallel). Maintenance and insurance pages; "Asset" chip on the existing equipment pages through the
      plugin UI slot. Files: `faui/pages/maintenance/asset-maintenance-page.component.ts`,
      `faui/pages/asset/asset-insurance-tab.component.ts`, `faui/components/equipment-asset-chip/equipment-asset-chip.component.ts`.
      Test: rendering specs; equipment pages unchanged without the feature.
- [ ] **T39**. Reports and dashboard pages; print templates (label sheet, asset card, hand-over slip). Files:
      `faui/pages/reports/fixed-assets-reports-page.component.ts`, `faui/pages/dashboard/fixed-assets-dashboard.component.ts`,
      `fa/print/fixed-assets-print-templates.ts`, `fa/asset/asset-label.controller.ts` (`POST /assets/labels`). Test:
      rendering specs; label PDF snapshot.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T40**. MCP tools `packages/mcp-server/src/lib/tools/fixed-assets.ts` (plan §7) with `preview` defaults.
      Test: input-schema spec; preview tools write nothing.
- [ ] **T41** (parallel). Import template "asset register" with opening values. Files:
      `fa/import/asset-register.import-template.ts`. Test: per-row errors, failed rows
      not imported.
- [ ] **T42**. OpenAPI document regenerated; SDK regeneration noted for release; webhook event catalogue entries. Files: `fa/events/fixed-assets.events.ts`, `packages/plugins/fixed-assets/README.md`. Test: OpenAPI diff is additive; the webhook catalogue lists the new events.
- [ ] **T43**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T44**. Phone asset page `/pages/a/:labelCode` (through `page-sections`, installable) and label resolution
      route. Files: `faui/pages/phone-asset/phone-asset-page.component.ts`, `fa/asset/asset-label.controller.ts`
      (`GET /assets/by-label/:code`). Test: custodian sees own asset only.
- [ ] **T45**. Audit sessions: session CRUD, bulk scan upsert with client ids, live progress events, close with
      discrepancy list, proposals to drafts. Files: `fa/asset-audit/asset-audit.service.ts`,
      `fa/asset-audit/asset-audit.controller.ts`, `fa/asset-audit/dto/`. Test: two clients with overlapping offline scans
      merge once.
- [ ] **T46**. Audit scan page (camera scanner, IndexedDB queue, retry on reconnect). Files:
      `faui/pages/audit-scan/audit-scan-page.component.ts`, `faui/services/audit-scan-queue.service.ts`. Test: queue
      survives reload (component spec with a fake store).
- [ ] **T47**. Usage: readings CRUD and bulk, task and project links, lending and tracked-time roll-up sweep,
      readings of field-service visits recorded once with source `VISIT`, utilisation and idle reads. Files:
      `fa/asset-usage-reading/asset-usage-reading.service.ts`, `fa/asset-usage-reading/asset-usage-reading.controller.ts`,
      `fa/asset/asset-work-link.service.ts`, `fa/utilisation/asset-utilisation.service.ts`, `fa/schedule/fixed-assets.worker.ts`.
      Test: no reading counted twice; utilisation golden cases.
- [ ] **T48**. Units-of-usage method in the schedule engine with estimated lines and true-up. Files:
      `fa/engine/methods/units-of-usage.ts`, `fa/engine/schedule-engine.ts`. Test: property tests.
- [ ] **T49**. Component depreciation and component replacement. Files: `fa/engine/component-depreciation.ts`,
      `fa/asset/asset-component.service.ts`. Test: roll-up and replacement cases.
- [ ] **T50**. Impairment and capped reversal with approval through `FIXED_ASSETS_APPROVALS`. Files:
      `fa/asset-value-adjustment/asset-impairment.service.ts`. Test: cap
      computation; approval required above threshold.
- [ ] **T51**. Leases: present value, liability schedule, period postings, remeasurement, exempt leases. Files:
      `fa/asset-lease/asset-lease.service.ts`, `fa/asset-lease/asset-lease.controller.ts`, `fa/engine/lease-schedule.ts`.
      Test: golden schedules; balanced journals.
- [ ] **T52**. Forecast and simulation endpoints and page; book comparison, utilisation, idle, audit and cost of
      ownership report definitions. Files: `fa/forecast/asset-forecast.service.ts`, `fa/forecast/asset-forecast.controller.ts`,
      `fa/reports/fixed-assets-advanced-reports.ts`, `faui/pages/forecast/asset-forecast-page.component.ts`. Test:
      forecast equals sum of schedules; simulation writes nothing.
- [ ] **T53**. Asset assistant: findings service, `/asset-assistant/findings`, inbox digest, MCP tool. Files:
      `fa/assistant/asset-assistant.service.ts`, `fa/assistant/asset-assistant.controller.ts`,
      `packages/mcp-server/src/lib/tools/fixed-assets.ts` (`fixed_assets_findings`). Test: each
      seeded anomaly is found; proposals are drafts.
- [ ] **T54**. Custody on leaving: consumer of employee-ended and team-removed facts, draft return movement.
      Files: `fa/custody/custody-on-leaving.consumer.ts`. Test: SQLite end-to-end.
- [ ] **T55**. Country-pack extension point for methods and conventions (`AssetMethodRegistry`). Files:
      `fa/engine/asset-method.registry.ts`. Test: a
      registered method is selectable only for organizations with the pack.
- [ ] **T56**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.
- [ ] **T57**. Equipment MCP tools in `packages/mcp-server/src/lib/tools/equipment.ts`: the six tools that call routes
      the equipment controller does not offer (status, assign, unassign, mine, statistics, search) re-pointed to the
      asset routes and the equipment list filter. Test: input-schema spec; each tool calls an existing route.
- [ ] **T58**. Answers to other plugins' ports in `apps/api/src/plugin-composition.ts`: `MANUFACTURING_ASSETS`
      (maintenance windows, open or find the open repair of a work centre's asset, downtime hours on the repair from
      the linked downtime rows) and `EXPENSE_ASSET_READINGS` (distance per vehicle-log entry as a `VEHICLE_LOG` usage
      reading, service due dates from maintenance plans). Test: a downtime closed on the shop floor sets the repair's
      downtime hours; two log entries give one reading each with the distance between them; unbound ports leave both
      features working without assets.
- [ ] **T59**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `MANUFACTURING_ASSETS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-3 | §3.1 Asset categories | T9 |
| FR-4 | §3.1 Asset categories | T10 |
| FR-5–FR-6 | §3.2 Asset register | T10 |
| FR-7 | §3.2 Asset register | T10, T49 |
| FR-8 | §3.2 Asset register | T11 |
| FR-9 | §3.2 Asset register | T19 |
| FR-10 | §3.2 Asset register | T11, T19 |
| FR-11 | §3.2 Asset register | T10, T19 |
| FR-12 | §3.2 Asset register | T10, T12 |
| FR-13 | §3.2 Asset register | T12 |
| FR-14 | §3.2 Asset register | T28 |
| FR-15 | §3.2 Asset register | T11, T34 |
| FR-16 | §3.2 Asset register | T10 |
| FR-17 | §3.3 Acquisition from purchases, work in progress, capitalisation | T22, T33 |
| FR-18–FR-20 | §3.3 Acquisition from purchases, work in progress, capitalisation | T22 |
| FR-21 | §3.3 Acquisition from purchases, work in progress, capitalisation | T19, T29 |
| FR-22–FR-24 | §3.3 Acquisition from purchases, work in progress, capitalisation | T23 |
| FR-25 | §3.4 Depreciation books, methods and schedules | T16, T18 |
| FR-26–FR-29 | §3.4 Depreciation books, methods and schedules | T16 |
| FR-30 | §3.4 Depreciation books, methods and schedules | T17, T25 |
| FR-31–FR-32 | §3.4 Depreciation books, methods and schedules | T17 |
| FR-33 | §3.4 Depreciation books, methods and schedules | T16 |
| FR-34 | §3.4 Depreciation books, methods and schedules | T17, T20 |
| FR-35 | §3.4 Depreciation books, methods and schedules | T48 |
| FR-36 | §3.4 Depreciation books, methods and schedules | T49 |
| FR-37 | §3.4 Depreciation books, methods and schedules | T52 |
| FR-38 | §3.5 Depreciation posting | T20, T21 |
| FR-39–FR-41 | §3.5 Depreciation posting | T20, T29 |
| FR-42 | §3.5 Depreciation posting | T20 |
| FR-43 | §3.5 Depreciation posting | T20 |
| FR-44 | §3.6 Locations, movement and custody | T13 |
| FR-45 | §3.6 Locations, movement and custody | T14, T35 |
| FR-46 | §3.6 Locations, movement and custody | T14 |
| FR-47 | §3.6 Locations, movement and custody | T14, T35 |
| FR-48 | §3.6 Locations, movement and custody | T12 |
| FR-49 | §3.6 Locations, movement and custody | T54 |
| FR-50 | §3.6 Locations, movement and custody | T15, T34 |
| FR-51–FR-52 | §3.7 Repair | T24 |
| FR-53 | §3.7 Repair | T17, T24 |
| FR-54 | §3.7 Repair | T24 |
| FR-55 | §3.7 Repair | T17, T24 |
| FR-56 | §3.8 Revaluation, impairment and leases | T25 |
| FR-57 | §3.8 Revaluation, impairment and leases | T25 |
| FR-58 | §3.8 Revaluation, impairment and leases | T50 |
| FR-59 | §3.8 Revaluation, impairment and leases | T51 |
| FR-60–FR-66 | §3.9 Sale, scrap, restore and split | T26 |
| FR-67–FR-70 | §3.10 Maintenance | T27 |
| FR-71 | §3.10 Maintenance | T6, T27 |
| FR-72 | §3.11 Labels, audits and utilisation | T39, T44 |
| FR-73 | §3.11 Labels, audits and utilisation | T45, T46 |
| FR-74–FR-75 | §3.11 Labels, audits and utilisation | T45, T46 |
| FR-76–FR-77 | §3.11 Labels, audits and utilisation | T47 |
| FR-78 | §3.11 Labels, audits and utilisation | T47 |
| FR-79 | §3.11 Labels, audits and utilisation | T47 |
| FR-80–FR-82 | §3.12 Reports and dashboards | T31 |
| FR-83 | §3.12 Reports and dashboards | T15, T31 |
| FR-84 | §3.12 Reports and dashboards | T27, T31 |
| FR-85–FR-86 | §3.12 Reports and dashboards | T31 |
| FR-87 | §3.12 Reports and dashboards | T52 |
| FR-88 | §3.12 Reports and dashboards | T52 |
| FR-89 | §3.12 Reports and dashboards | T30 |
| FR-90 | §3.13 API, agents, automation and compatibility | T10, T19 |
| FR-91 | §3.13 API, agents, automation and compatibility | T40 |
| FR-92 | §3.13 API, agents, automation and compatibility | T53 |
| FR-93 | §3.13 API, agents, automation and compatibility | T15, T42 |
| FR-94 | §3.13 API, agents, automation and compatibility | T41 |
| FR-95 | §3.13 API, agents, automation and compatibility | T55 |
| FR-96 | §3.13 API, agents, automation and compatibility | T2, T8, T32 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Ledger invariants hold in tests: every journal balances; register equals the mapped accounts after every
  document and its cancellation; no posted schedule line ever changes.
- Equipment and equipment lending behave identically with the feature on and off (existing suites untouched).
- Every acceptance criterion of `spec.md` §7 has a named test.
