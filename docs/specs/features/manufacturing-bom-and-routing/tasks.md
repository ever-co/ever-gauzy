# Task Breakdown: Bills of materials and routings

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `manufacturing-bom-and-routing`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths below are relative to `packages/plugins/manufacturing/src/lib/` unless they start with `packages/` or `apps/`;
  `mui/` means `packages/plugins/manufacturing-ui/src/lib/`, `mrui/` means
  `packages/plugins/manufacturing-react-ui/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Plugin scaffold: `packages/plugins/manufacturing` (package, project, tsconfig, jest), `manufacturing.plugin.ts`
  (`@GauzyCorePlugin`, entities, migrations, permissions, features, settings), `manufacturing.module.ts`, listed in
  `apps/api/src/plugins.ts`; `ManufacturingSchedulePlugin` listed in `apps/worker/src/plugins.ts`. Test: plugin metadata
  spec (entities, migrations, `dependsOn`), both plugin lists. Migration timestamps: `1791000089100` to `1791000089199` (`packages/plugins/manufacturing`).
- [ ] **T2**. `manufacturing.features.ts` with `FEATURE_MANUFACTURING` (`defaultEnabled: false`, `dependsOn: FEATURE_CATALOG`)
  and the feature guard helper used by every controller. Test: catalogue contribution spec; guard answers 404 when off.
- [ ] **T3**. `manufacturing.permissions.ts` (seven structure keys of plan §9 as permission contributions with
  `defaultFor`) and `manufacturing.settings.ts` (setting contributions of spec FR-63, organization scope, defaults, stored
  in the platform settings store). Test: contribution specs.
- [ ] **T4**. Contracts `packages/contracts/src/lib/manufacturing-structure.model.ts` (+ `packages/contracts/src/index.ts`
  export): enums, interfaces, port shapes, operation payloads; `STRUCTURE_CHANGE` added to `ApprovalPolicyTypesStringEnum`
  (`packages/contracts/src/lib/approval-policy.model.ts`). Test:
  contracts build; enum value snapshot.
- [ ] **T5**. Migration list `database/manufacturing-migrations.ts` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), no copy in the plugin.
  Test: list spec (every migration registered once for both ORMs).
- [ ] **T6**. Entities and MikroORM repositories in `structure/entities/`: `manufacturing-operation.entity.ts`,
  `manufacturing-operation-step.entity.ts`, `routing.entity.ts`, `routing-operation.entity.ts`,
  `bill-of-materials.entity.ts`, `bill-of-materials-default.entity.ts`, `bill-of-materials-line.entity.ts`,
  `bill-of-materials-substitute.entity.ts`, `bill-of-materials-line-rule.entity.ts`, `bill-of-materials-output.entity.ts`,
  `bill-of-materials-operation.entity.ts` (structure operation), `bill-of-materials-explosion.entity.ts`; repositories in
  `structure/entities/repository/`. Test: entity metadata spec for both ORMs.
- [ ] **T7**. Migration `CreateManufacturingStructureTables` (PostgreSQL, SQLite, MySQL). Files:
  `database/migrations/1791000089100-CreateManufacturingStructureTables.ts`, `database/manufacturing-migrations.ts`. Test:
  SQLite migration spec
  (up twice is a no-op; indexes present).
- [ ] **T8** (parallel). Entities and migration `database/migrations/1791000089110-CreateManufacturingChangeAndDesignTables.ts`:
  `change-request/entities/structure-change-request.entity.ts`, `structure-change-request-line.entity.ts`,
  `design/entities/product-design.entity.ts`, `product-design-node.entity.ts`, `product-design-operation.entity.ts`,
  `product-design-change.entity.ts`. Test: SQLite migration spec.
- [ ] **T9** (parallel). Core operation types `MANUFACTURING_COST_REFRESH` (aggregate = organization),
  `MANUFACTURING_STRUCTURE_REPLACE` (aggregate = the replaced structure) and `MANUFACTURING_DESIGN_BUILD` (aggregate = the
  design) registered with `OperationRegistry` in `jobs/structure-operations.ts`; no job tables. Test: registry spec; a
  second live cost refresh of one organization is refused with the running operation's handle.
- [ ] **T10**. Default role grants of plan §9 as `defaultFor` of the permission contributions (super admin, admin,
  manager); no seed migration. Files: `manufacturing.permissions.ts`. Test: contribution spec; the permission reload adds the grants to an existing tenant
  once and leaves other roles untouched.
- [ ] **T11**. Ports in `manufacturing.types.ts` (`MANUFACTURING_CATALOG`, `_VALUATION`, `_PURCHASE_PRICES`, `_PRICE_LISTS`,
  `_DOCUMENTS`, `_QUALITY`, `_USAGE`, `_WORK_CENTRES`) with fallback adapters (valuation falls back to
  `product_variant_price.unitCost`; purchase prices read the latest `goods_receipt_line.unitCost`; work centres unbound:
  operations carry no work centre and no work centre rate); bindings in `apps/api/src/plugin-composition.ts` for
  the plugins that exist. Test: fallback adapter specs; composition spec lists the bindings.

## Phase 2 — Services, endpoints, events

- [ ] **T12**. Structure rules as pure functions `structure/rules/` (component refusal, whole units, percentages and balance,
  secondary outputs and shares, process loss, step outputs completeness) returning `IStructureRuleCheck[]`. Test: one spec
  per rule with each refusal of spec FR-6, FR-8, FR-15, FR-17, FR-18, FR-32.
- [ ] **T13**. `structure/bill-of-materials.service.ts`: create, edit drafts, delete drafts, unit conversion through the
  catalogue port, numbering through `MANUFACTURING_DOCUMENTS` or `SequenceService`, `If-Match`, refusal for an item with
  an active kit (`STRUCTURE_ITEM_IS_KIT`). Test: service spec; SQLite DB spec (organization allow-list refusal, kit
  refusal).
- [ ] **T14**. Explosion `structure/explosion/explosion.ts` (pure: roll-up, keep-as-stocked, phantom merge, cycle path) and
  `explosion.service.ts` (materialise rows, hash, dirty parents). Test: pure spec (two levels, phantom, cycle naming the
  path); DB spec (where-used by index).
- [ ] **T15**. Lifecycle `structure/structure-lifecycle.service.ts`: release, retire, make default (locked default row,
  item default through the catalogue port), in-use refusal listing parents, sub-assemblies released check. Test: DB spec
  with two concurrent releases (one default wins); retire refusal.
- [ ] **T16**. Component costing `costing/component-cost.service.ts` for the three rate bases through the valuation
  (fallback `product_variant_price.unitCost`), purchase price (latest `goods_receipt_line.unitCost`, never the supplier
  term) and price list ports, currency conversion, organization currency. Test: spec per basis; price list currency
  refusal; a supplier term price is never used as the last purchase price.
- [ ] **T17**. Controllers `structure/bill-of-materials.controller.ts` and DTOs (CRUD, validate, release, retire,
  make-default, new-version, explosion, tree, cost-breakdown) with Swagger decorators and the cost-stripping mapper. Test:
  controller specs; e2e for create → release → explosion; costs absent without `MANUFACTURING_COSTS_VIEW`.
- [ ] **T18**. Where-used and multi-item search `structure/where-used.service.ts` with `MANUFACTURING_USAGE` contributions
  (bundles, subcontract services, sales lines). Test: DB spec over three levels and each usage kind.
- [ ] **T19**. Events on the outbox (`structure.*`, partition per variant) and realtime hints declared with
  `declareStreamedEvents` in `structure/structure-streamed-events.ts`. Test: events appended in the write transaction.
- [ ] **T20**. Operations and routings (`routing/manufacturing-operation.service.ts`,
  `routing/manufacturing-operation.controller.ts`, `routing/routing.service.ts`, `routing/routing.controller.ts`):
  masters, operation-steps, sequence rule, deactivation; work centre
  references validated through the `MANUFACTURING_WORK_CENTRES` reader of T11, which the shop floor module binds
  (`shop-floor-and-work-orders` T11); unbound, operations are saved without a work centre. Test: unbound reader leaves
  the work centre empty; sequence rule spec; inactive routing refusal; controller specs.
- [ ] **T21**. Structure operations on a bill of materials: from routing or entered, material source, locations, issue
  mode, consumption basis, step outputs, flat operating cost exclusivity. Files: `structure/structure-operation.service.ts`,
  `structure/rules/step-outputs.rule.ts`. Test: service spec; step-output rule spec; an operation without a place or run
  time is refused.
- [ ] **T22**. Operating cost `costing/operating-cost.ts` (pure: rate × minutes, per batch, fixed time, set-up spread,
  labour/machine/overhead parts) and the full roll-up with secondary credit. Test: pure specs with worked examples.
- [ ] **T23**. Cost update with propagation `costing/cost-propagation.service.ts` (bottom-up by low-level code, rates
  refresh). Test: DB spec (three levels, parent unit cost updated once).
- [ ] **T24**. Cost refresh executor (`jobs/cost-refresh.operation.ts`) of core operation `MANUFACTURING_COST_REFRESH`:
  one step per low-level code, batches through `BulkExecutor` with a per-structure result, resume by operation retry,
  daily schedule skipped while one is live, `POST /bills-of-materials/cost-refresh` answering `202`; explosion refresh on
  queue `manufacturing-structures`. Test: operation spec with a forced stop and retry; second run refused.
- [ ] **T25**. Substitutes and percentage formulation in the editor services; template line rules and variant
  generation with preview (`structure/variants/variant-generation.service.ts`), substitutes in
  `structure/substitutes.service.ts`. Test: generation spec (same-value rule, value map, unresolved line).
- [ ] **T26**. Replacement `jobs/replace.operation.ts` (core operation `MANUFACTURING_STRUCTURE_REPLACE`) with preview,
  a result per parent and skipped step-output parents. Test: DB spec over 14 parents.
- [ ] **T27**. Designs (`design/product-design.service.ts`, `design/product-design.controller.ts`,
  `jobs/design-build.operation.ts`): CRUD, design operations with step outputs, confirm lock, build as core operation
  `MANUFACTURING_DESIGN_BUILD` creating items through the catalogue port and structures, outcome per node; released
  builds only with `MANUFACTURING_STRUCTURES_RELEASE`, and through one change request while change control is on (spec
  FR-52); revisions with change list. Test: build spec (three
  levels, missing items, report per node; a design editor without the release permission is refused a released build
  and builds drafts; with change control on a released build leaves drafts and one submitted change request, released
  on approval); revision spec.
- [ ] **T28** (parallel). Design file import `design/import/` (`parts-list.parser.ts`, `step-structure.parser.ts`,
  `gltf-tree.parser.ts`, `design-import.merge.ts`): delimited and spreadsheet parts lists, STEP part-structure
  parser, glTF node tree; re-import merge rules. Test: parser specs with fixtures, size and depth limits; merge spec.
- [ ] **T29**. Consumer `subscriber:manufacturing-structures` for catalogue and work centre events (stale flags,
  re-pointing merged items). Files: `structure/manufacturing-structures.consumer.ts`. Test: consumer spec, idempotent per event.
- [ ] **T30**. Port answers `StructurePortService` bound to `SUBCONTRACTING_BOM` and `PURCHASING_BOM`, and the in-plugin
  `StructureReader` (effective structure at a date). Files: `structure/structure-port.service.ts`,
  `structure/structure-reader.ts`, `apps/api/src/plugin-composition.ts`. Test: port spec against the same explosion as T14.
- [ ] **T31**. Report datasets `reports/structure-report-datasets.ts` and `reports/structure-reports.controller.ts` for
  spec FR-62 behind `/reports/:key`, cost columns stripped without the cost key.
  Test: dataset spec per report on SQLite fixtures.
- [ ] **T32**. Publication: settings route and the `@Public()` read feed of published views for sites built with Ever
  Works. Files: `structure/publication/publication.controller.ts`, `structure/publication/public-structure.controller.ts`,
  `settings/structure-settings.controller.ts`. Test: e2e (unpublished 404; no costs).
- [ ] **T51**. Inspection requirement (FR-19): a bill of materials and each of its operations may require inspection of
  the output with an inspection template looked up through `MANUFACTURING_QUALITY`; switching it off clears the
  template; without the quality plugin the requirement is kept and reported as not enforced. Files:
  `structure/inspection-requirement.service.ts`, `structure/bill-of-materials.service.ts`,
  `structure/structure-operation.service.ts`. Test: an unknown template is refused when the port is bound; switching
  off clears the template; unbound, the requirement saves with the "not enforced" flag in the answer.

## Phase 3 — UI surfaces

- [ ] **T33**. `packages/plugins/manufacturing-ui`: plugin registration in `apps/gauzy/src/plugin-ui.config.ts`, menu entry
  gated by flag and permission, routes, i18n keys `MANUFACTURING.STRUCTURES.*` in every locale. Files:
  `mui/manufacturing-ui.plugin.ts`, `mui/manufacturing-ui.routes.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: routing and menu specs.
- [ ] **T34**. Structure list (saved view) and editor (components, outputs, operations, cost, versions, where used tabs).
  Files: `mui/pages/structures-list/structures-list.component.ts`, `mui/pages/structure-editor/structure-editor.component.ts`,
  `mui/pages/structure-editor/component-lines-grid.component.ts`. Test: component rendering specs; keyboard navigation of
  the line grid.
- [ ] **T35**. Operations, routings, designs (tree, file upload, build report) and settings pages; runs link to the
  platform's operations list. Files: `mui/pages/operations/operations.component.ts`, `mui/pages/routings/routings.component.ts`,
  `mui/pages/designs/designs.component.ts`, `mui/pages/structure-settings/structure-settings.component.ts`. Test: rendering
  specs.
- [ ] **T36** (parallel). `packages/plugins/manufacturing-react-ui`: `StructureTree`, `StructureDiff`, `DesignViewer` (glTF
  with `three`). Files: `mrui/structure-tree/StructureTree.tsx`, `mrui/structure-diff/StructureDiff.tsx`,
  `mrui/design-viewer/DesignViewer.tsx`. Test: rendering tests; diff markers carry text.
- [ ] **T37**. Item page panels "Made from" and "Used in" through the catalogue's view-panel location. Files:
  `mui/panels/made-from-panel.component.ts`, `mui/panels/used-in-panel.component.ts`. Test: rendering spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T38**. MCP tools `packages/mcp-server/src/lib/tools/manufacturing-structures.ts` (list, get, explain, where used,
  can we make, compare), registered in `register-all-tools.ts`. Test: input schema specs; costs absent without the key.
- [ ] **T39** (parallel). Mapped import and export definitions for structures, operations and routings
  (`data-import-export`); print templates for the structure and the routing sheet (`print-and-pdf-designer`). Files:
  `exchange/structure-import.definitions.ts`, `exchange/structure-print-templates.ts`. Test:
  import validation spec; template render spec.
- [ ] **T40**. Report definitions registered with the report builder when bound. Files:
  `reports/structure-report-definitions.ts`. Test: registration spec.
- [ ] **T41**. OpenAPI regenerated; SDK regeneration noted for release; user docs page "Bills of materials and routings";
  `docs/specs/README.md` row. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.

## Phase 5 — Advanced capabilities

- [ ] **T42**. Live rule checklist endpoint and editor side panel with fixes (merge duplicates, add balance line, pick
  routing). Files: `structure/rules/rule-checklist.service.ts`,
  `mui/components/rule-checklist-panel/rule-checklist-panel.component.ts`. Test: rule check spec; panel rendering spec.
- [ ] **T43**. Effectivity: dates, overlap refusal, previous version closing, effectivity-switch job, effective structure
  at a date in `StructureReader`. Files: `structure/effectivity.service.ts`, `jobs/effectivity-switch.job.ts`,
  `structure/structure-reader.ts`. Test: DB spec across a date boundary.
- [ ] **T44**. Change requests (`change-request/structure-change-request.service.ts`,
  `change-request/structure-change-request.controller.ts`, `change-request/structure-change.settler.ts`): create, submit (files a core `request_approval` of type
  `STRUCTURE_CHANGE` through `RequestApprovalService`, the purchase-order approval idiom), cancel, settle on the request's
  decision through the plugin's settler (`registerRequestApprovalSettler`, `approval-workflows` T53): release in one
  transaction, or back to draft with the reason; document type
  `manufacturing.structure_change`. Test: DB spec (approval releases, refusal returns to draft); the request shows on
  the Approvals page; routed through `REQUEST_APPROVAL_ROUTER` when workflows are bound.
- [ ] **T45**. Comparison `change-request/comparison.ts` (pure: match by item and operation, field changes) and route.
  Test: pure spec with added, removed and changed rows.
- [ ] **T46**. Cost simulation and impact (`change-request/simulation.service.ts`): new unit costs up to the top, open work
  orders and plans through the in-plugin readers, subcontract and sales usage through `MANUFACTURING_USAGE`; writes
  nothing. Test: simulation spec asserting no write.
- [ ] **T47**. Standard cost proposal on release through `MANUFACTURING_VALUATION`. Files:
  `costing/standard-cost-proposal.service.ts`. Test: port spec.
- [ ] **T48**. Variant regeneration offer with differences on template change. Files:
  `structure/variants/variant-regeneration.service.ts`. Test: spec (no change without confirmation).
- [ ] **T49**. MCP tools `manufacturing_simulate_change`, `manufacturing_draft_structure` (`preview` default true; text,
  parts list, design). Files: `packages/mcp-server/src/lib/tools/manufacturing-structures.ts`. Test: draft tool writes nothing in preview; saved draft is never released.
- [ ] **T50**. Presence and live updates on the structure editor (presence key, hints consumed by the page). Files:
  `mui/pages/structure-editor/structure-editor-live.service.ts`. Test: two
  clients receive each other's save hint; 409 on stale save.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T2, T33, T38 |
| FR-2 | §3.1 Scope and compatibility | T16, T23 |
| FR-3 | §3.1 Scope and compatibility | T13 |
| FR-4 | §3.1 Scope and compatibility | T30 |
| FR-5 | §3.2 Bills of materials | T13 |
| FR-6 | §3.2 Bills of materials | T12, T13 |
| FR-7 | §3.2 Bills of materials | T13 |
| FR-8 | §3.2 Bills of materials | T12 |
| FR-9–FR-10 | §3.2 Bills of materials | T13, T15 |
| FR-11 | §3.2 Bills of materials | T15 |
| FR-12 | §3.2 Bills of materials | T13, T21 |
| FR-13 | §3.2 Bills of materials | T13, T16 |
| FR-14 | §3.2 Bills of materials | T25 |
| FR-15 | §3.2 Bills of materials | T12, T25 |
| FR-16 | §3.2 Bills of materials | T12, T13 |
| FR-17–FR-18 | §3.2 Bills of materials | T12 |
| FR-19 | §3.2 Bills of materials | T51 |
| FR-20 | §3.3 Multi-level structures | T14 |
| FR-21 | §3.3 Multi-level structures | T14 |
| FR-22–FR-23 | §3.3 Multi-level structures | T14 |
| FR-24 | §3.3 Multi-level structures | T14, T17, T36 |
| FR-25 | §3.3 Multi-level structures | T42 |
| FR-26 | §3.4 Operations and routings | T20, T35 |
| FR-27 | §3.4 Operations and routings | T20 |
| FR-28 | §3.4 Operations and routings | T21, T22 |
| FR-29–FR-31 | §3.4 Operations and routings | T21 |
| FR-32 | §3.4 Operations and routings | T12, T21 |
| FR-33 | §3.4 Operations and routings | T6, T21 |
| FR-34 | §3.5 Versions, effectivity and change requests (advanced) | T17 |
| FR-35 | §3.5 Versions, effectivity and change requests (advanced) | T43 |
| FR-36 | §3.5 Versions, effectivity and change requests (advanced) | T44 |
| FR-37 | §3.5 Versions, effectivity and change requests (advanced) | T43, T44 |
| FR-38 | §3.5 Versions, effectivity and change requests (advanced) | T36, T45 |
| FR-39 | §3.5 Versions, effectivity and change requests (advanced) | T46 |
| FR-40 | §3.5 Versions, effectivity and change requests (advanced) | T46 |
| FR-41 | §3.5 Versions, effectivity and change requests (advanced) | T47 |
| FR-42–FR-43 | §3.6 Variant structures | T25 |
| FR-44 | §3.6 Variant structures | T48 |
| FR-45 | §3.7 Costing | T16 |
| FR-46 | §3.7 Costing | T22 |
| FR-47 | §3.7 Costing | T16, T22 |
| FR-48 | §3.7 Costing | T23 |
| FR-49 | §3.7 Costing | T24 |
| FR-50 | §3.7 Costing | T3, T9, T24 |
| FR-51 | §3.7 Costing | T17, T22 |
| FR-52–FR-53 | §3.8 Designs to structures | T27 |
| FR-54 | §3.8 Designs to structures | T28, T36 |
| FR-55–FR-56 | §3.8 Designs to structures | T27 |
| FR-57 | §3.9 Update tools | T26 |
| FR-58 | §3.9 Update tools | T9, T24, T26, T27 |
| FR-59 | §3.10 Publishing | T32 |
| FR-60–FR-61 | §3.11 Lookups and reports | T18 |
| FR-62 | §3.11 Lookups and reports | T31, T40 |
| FR-63 | §3.12 Settings, exchange and print | T3 |
| FR-64–FR-65 | §3.12 Settings, exchange and print | T39 |
| FR-66 | §3.13 Agents and real time (advanced) | T38, T49 |
| FR-67 | §3.13 Agents and real time (advanced) | T19, T50 |
| FR-68 | §3.13 Agents and real time (advanced) | T19 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Every report of spec FR-62 returns rows on the demo tenant; costs are absent from every surface without
  `MANUFACTURING_COSTS_VIEW`; a change request releases a version only after a decision.
