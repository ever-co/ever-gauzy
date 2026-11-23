# Task Breakdown: Quality management

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `quality-management`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to the repository root; `q/` means `packages/plugins/quality/src/lib/` and `qui/` means
  `packages/plugins/quality-ui/src/lib/`. Each new service, controller, pure module or component ships with a `.spec.ts`
  beside it.
- T34 needs the floor app `packages/plugins/floor-ui` of `warehouse-and-stock-movements` T44.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/quality.model.ts` (interfaces, enums, gate contract, finding
      codes, decision preview, derived review view, event payloads; export from `packages/contracts/src/index.ts`);
      `BaseEntityEnum` gains `QualityInspection`, `QualityNonConformance`, `ImprovementAction`
      (`packages/contracts/src/lib/base-entity.model.ts`). Test: type-level spec against sample payloads.
- [ ] **T2**. Plugin scaffold `packages/plugins/quality` (`package.json`, `project.json`, `tsconfig.json`,
      `jest.config.ts`, `eslint.config.cjs`, path mapping in `tsconfig.base.json`), `q/quality.plugin.ts`,
      `q/quality.module.ts`, `q/quality.features.ts` (`FEATURE_QUALITY`, default off), `q/quality.permissions.ts` (twelve
      keys), `q/quality.settings.ts`; registered in `apps/api/src/plugins.ts`. Test: plugin list spec; routes `404` with
      the feature off.
- [ ] **T3**. Migration `q/database/migrations/1791000088100-CreateQualitySetupTables.ts` on the shared core migration
      helpers of `procurement` T4 (`@gauzy/core`), for PostgreSQL, MySQL and SQLite + entities and MikroORM repositories
      in `q/setup/entities/` (`quality-parameter-group.entity.ts`, `quality-parameter.entity.ts`,
      `quality-template.entity.ts`, `quality-template-version.entity.ts`, `quality-template-line.entity.ts`,
      `quality-sampling-plan.entity.ts`, `quality-sampling-level.entity.ts`, `quality-item-profile.entity.ts`,
      `quality-enforcement-rule.entity.ts`; no location-setting table). Test: migration spec on SQLite; both ORMs map
      each entity; a second profile of one variant, product or category, a second sampling level of one plan, item and
      vendor (or none) and a second enforcement rule of one point and scope are refused through their key columns on
      each dialect. Migration timestamps: `1791000088100` to `1791000088199` (`packages/plugins/quality`); `1791000088900` to `1791000088999` (`packages/core`).
- [ ] **T4** (parallel). Migration `q/database/migrations/1791000088110-CreateQualityInspectionTables.ts` (inspections,
      reading sets, readings, hints, retained samples) + entities in `q/inspection/entities/`
      (`quality-inspection.entity.ts`, `quality-reading-set.entity.ts`, `quality-reading.entity.ts`,
      `quality-inspection-hint.entity.ts`, `quality-retained-sample.entity.ts`; `quality_inspection.lotId` and
      `sourceKey`). Test: migration specs; repository smoke specs; a second live inspection with one `sourceKey` is refused.
- [ ] **T5** (parallel). Migration `q/database/migrations/1791000088130-CreateQualityAnalyticsTables.ts` + entities in
      `q/analytics/entities/` (`quality-control-chart.entity.ts`, `quality-control-limit.entity.ts`,
      `quality-control-point.entity.ts`, `quality-control-alert.entity.ts`, `quality-supplier-measure.entity.ts`,
      `quality-cost-snapshot.entity.ts`). Test: migration spec.
- [ ] **T6**. Default role grants as `defaultFor` on the permission contributions of `q/quality.permissions.ts` (plan §9;
      no seed migration, existing tenants through the permission reload). Test: grants for default roles.
- [ ] **T7**. Port tokens in `q/ports/quality-ports.ts` (`QUALITY_STOCK`, `QUALITY_DOCUMENTS`, `QUALITY_SOURCE_LINES`,
      `QUALITY_LOTS`, `QUALITY_TASKS`, `QUALITY_AI`, `QUALITY_CALENDAR`, `QUALITY_MEETINGS`, `QUALITY_PROCEDURES`,
      `QUALITY_APPROVALS`, `QUALITY_COMMUNICATIONS`; consumer of `REMINDERS`) with no-op defaults; bindings in
      `apps/api/src/plugin-composition.ts` (`QUALITY_AI` to the `ai-agents-and-assistants` runtime). Test: services run
      with ports unbound.
- [ ] **T49**. Core part of the improvement data: core migration
      `packages/core/src/lib/database/migrations/1791000088900-AddKeyResultUpdatePeriod.ts` (nullable `periodStart`,
      `periodEnd` on `key_result_update`) and the two columns on the core entity, with no dependency on the quality
      plugin. Files: `packages/core/src/lib/database/migrations/1791000088900-AddKeyResultUpdatePeriod.ts`,
      `packages/core/src/lib/keyresult-update/keyresult-update.entity.ts`. Test: migration spec on SQLite; core entity
      spec for both ORMs; existing key result updates read as before with the new columns null.
- [ ] **T50**. Plugin part of the improvement data: migration
      `q/database/migrations/1791000088120-CreateQualityImprovementTables.ts` (goal bindings, key-result measures,
      non-conformances, improvement actions, quality circle marks, customer and supplier feedback) and entities in
      `q/improvement/entities/` with their repositories. Files:
      `q/database/migrations/1791000088120-CreateQualityImprovementTables.ts`,
      `q/improvement/entities/{quality-goal-binding,quality-key-result-measure,quality-nonconformance,improvement-action,improvement-action-step,quality-circle,quality-feedback-template,quality-feedback,quality-feedback-score}.entity.ts`.
      Test: migration spec on SQLite; repository smoke specs.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Rule engine `q/engine/rules.ts` and safe expression parser `q/engine/expression.ts` (numbers, reading
      names, aggregates, comparisons, logic, fixed functions; depth and length limits). Test: property and golden
      tests per rule kind; fuzz test that no input reaches host evaluation.
- [ ] **T9**. Locale number parsing for readings with `@gauzy/common` helpers. Files: `q/engine/locale-number.ts`. Test:
      comma and point formats.
- [ ] **T10**. Parameters, groups and templates services and controllers with versioning and formula validation.
      Files: `q/setup/quality-parameter.service.ts`, `q/setup/quality-parameter.controller.ts`,
      `q/setup/quality-template.service.ts`, `q/setup/quality-template.controller.ts`, `q/setup/dto/quality-parameter.dto.ts`,
      `q/setup/dto/quality-template.dto.ts`. Test: unit and e2e; used parameter cannot be deleted.
- [ ] **T11**. Sampling engine `q/engine/sampling.ts` (fixed, percent, full, table by lot size and level) and plans
      controller (`q/setup/quality-sampling-plan.service.ts`, `q/setup/quality-sampling-plan.controller.ts`). Test: golden
      tables; sample never above quantity.
- [ ] **T12**. Item profiles, enforcement rules (defaults of spec FR-11), the warehouse's hold, quarantine and sample
      children read through `QUALITY_STOCK` (`/quality/locations`), requirement resolver with per-organization cache.
      Files: `q/setup/quality-item-profile.service.ts`, `q/setup/quality-enforcement-rule.service.ts`,
      `q/setup/quality-setup.controller.ts`, `q/setup/quality-requirement.resolver.ts`. Test: resolution order item →
      variant → group; cache invalidated on change; missing child refuses the rule.
- [ ] **T13**. Inspection document type registration with the business document engine (series, lifecycle, history,
      own cancel check) through `QUALITY_DOCUMENTS`. Files: `q/inspection/quality-inspection.document-type.ts`. Test:
      number once; cancel refused when in use.
- [ ] **T14**. Inspection service and controller: create (quantity = the line's good quantity, damaged on arrival
      excluded), load template, reading sets (online; offline as kind `quality.reading-set` of the core offline-sync
      module), live results, override, proposed decision. Files: `q/inspection/quality-inspection.service.ts`,
      `q/inspection/quality-inspection.controller.ts`, `q/inspection/quality-reading-set.service.ts`,
      `q/inspection/quality-offline-reading-set.handler.ts`. Test: unit; offline set after decision kept apart; replayed
      set applied once.
- [ ] **T15**. Decision service: preview of stock effects, decide, partial decision, verification, cancel with
      reversal; stock movements through `QUALITY_STOCK` and lot statuses through `QUALITY_LOTS.setStatus`; outbox append
      in the same transaction. Files: `q/inspection/quality-decision.service.ts`. Test: SQLite end-to-end with a stub
      warehouse port; `409` on concurrent decision; a failing lot status update rolls back the decision and its stock
      movements.
- [ ] **T16**. `QualityGateService` implementing the gate contract for each point (missing, undecided, rejected ×
      refuse, warn, hold or move), bound to `PURCHASING_QUALITY`, `SUBCONTRACTING_QUALITY`, `MANUFACTURING_QUALITY`
      and the fulfilment and stock-document gates; answers the owner's damaged-on-arrival figure beside the decision.
      Files: `q/gate/quality-gate.service.ts`. Test: full enforcement matrix; unbound owners unchanged.
- [ ] **T17**. `QualityTemplateLookup` for manufacturing structures and the operation-card inspection state (missing,
      unfinished, rejected) with corrective-card proposal. Files: `q/gate/quality-template.lookup.ts`. Test: contract
      test with the manufacturing stub.
- [ ] **T18**. `DOCUMENT_CHECKS` entry `quality.inspection-in-use` (cancel of documents relied upon). Files:
      `q/gate/quality-inspection-in-use.check.ts`. Test: delivery cancel refused while its accepted inspection exists
      only when rules require.
- [ ] **T19**. Consumer `subscriber:quality-sources`: draft inspections per flagged line and lot from receipt, stock
      document, delivery, subcontract receipt, return and card events; `POST /quality/inspections/from-document`.
      Files: `q/events/quality-sources.consumer.ts`, `q/inspection/quality-inspection.controller.ts`. Test: event
      delivered twice creates one inspection per source line and lot (`sourceKey`); after a cancellation a new draft
      can be made; a 500-unit line with lots of 300 and 200 drafts inspections of 300 and 200, whose decisions move
      500 units in all.
- [ ] **T20**. Return inspections with restock location choice, covering restocked units only. Files:
      `q/inspection/quality-return-inspection.service.ts`. Test: decision restocks to the allowed location; damaged
      return units not inspected.
- [ ] **T21**. Retained samples: movement to the sample location on receipt and produced lots, draw, dispose,
      refusals for untracked items and missing shelf life, the 30-day reminder through `REMINDERS`. Files:
      `q/samples/quality-retained-sample.service.ts`, `q/samples/quality-retained-sample.controller.ts`. Test: SQLite
      end-to-end; reminder scheduled once and cancelled on disposal.
- [ ] **T22**. Quality objectives on core goals: goal bindings with core recurrence rule columns (every N days, weeks
      on a weekday, months on a day with month-end clamp, yearly date), daily sweep writing one `key_result_update` per
      key result and period with measured values and the KPI's current value, derived review status, draft action
      on failure, review notes as `comment` rows on the goal. Files: `q/objectives/quality-goal-binding.service.ts`,
      `q/objectives/quality-goal-binding.controller.ts`, `q/objectives/quality-review.service.ts`,
      `q/objectives/quality-reviews.sweep.ts`. Test: golden calendar cases; once per period; status derivation.
- [ ] **T23**. Measures provider (`QualityMeasureProvider`): acceptance rate, rejected quantity, defects per
      million, open non-conformances, overdue actions, days to close, cost; bound to KPI-backed key results. Files:
      `q/objectives/quality-measure.provider.ts`. Test: figures on seeded data.
- [ ] **T24** (parallel). Procedures on the docs plugin through `QUALITY_PROCEDURES`: "Quality procedures" category,
      tree and cycle-guarded move, versions and lock, approval through `QUALITY_APPROVALS`, `document_link` rows to
      goals, non-conformances and actions. Files: `q/procedures/quality-procedures.service.ts`. Test: cycle refused
      (`DOCS_TREE_CYCLE`); new version through approval; link created once.
- [ ] **T25**. Non-conformances: numbering, statuses, draft from rejected inspections, from tickets (tasks of issue
      type ticket), order claims and returns with their reason (`/from-source`). Files:
      `q/improvement/quality-nonconformance.service.ts`, `q/improvement/quality-nonconformance.controller.ts`. Test: close
      refused while an action is open.
- [ ] **T26**. Improvement actions and corrective steps: statuses, effectiveness check, inbox items, reminders through
      `REMINDERS`, tasks through `QUALITY_TASKS`. Files: `q/improvement/improvement-action.service.ts`,
      `q/improvement/improvement-action.controller.ts`. Test: action closes only after the check; reopen on failed check;
      reminders cancelled on close.
- [ ] **T27** (parallel). Quality circles as core appointments with a quality mark (agenda and invitees on the
      appointment; agenda items, minutes and record links through `QUALITY_MEETINGS` when meetings are on) and
      customer and supplier feedback (templates, scores 1–5, action threshold). Files:
      `q/improvement/quality-circle.service.ts`, `q/improvement/quality-circle.controller.ts`,
      `q/feedback/quality-feedback.service.ts`, `q/feedback/quality-feedback.controller.ts`. Test: score range refused;
      employee subject refused; circle listed from its appointment; a user with `QUALITY_VIEW` and without
      `QUALITY_FEEDBACK_EDIT` is refused every feedback read.
- [ ] **T28**. Events of plan §5 and real-time hints; `.completed` alias of `.decided`. Files: `q/events/quality.events.ts`.
      Test: each event once per action; alias carries the same payload.
- [ ] **T29**. Schedules and consumers in `q/schedule/` (`quality-schedule.plugin.ts` as `QualitySchedulePlugin` in
      `apps/worker/src/plugins.ts`; `quality-reviews.scheduler.ts`, `quality-supplier-measures.scheduler.ts`,
      `quality-cost-snapshot.scheduler.ts`; consumer `q/events/quality-decisions.consumer.ts`), in-process fallback.
      Test: sweep specs.
- [ ] **T30**. Report definitions (inspection summary, actions from reviews, cost of poor quality, non-conformance
      ageing, supplier quality, retained samples, control charts) and dashboard cards. Files:
      `q/reports/quality-report-definitions.ts`, `q/reports/quality-dashboard-cards.ts`. Test: figures on seeded data.

## Phase 3 — UI surfaces

- [ ] **T31**. Angular plugin scaffold `packages/plugins/quality-ui` (`qui/quality-ui.plugin.ts`, `qui/quality-ui.routes.ts`,
      `qui/services/quality-api.service.ts`), registered in `apps/gauzy/src/plugin-ui.config.ts`; menu group, feature and
      permission gating; `QUALITY.*` keys in every locale (`packages/ui-core/i18n/assets/i18n/*.json`). Test: plugin
      spec; menu hidden when off.
- [ ] **T32**. Setup pages (parameters, templates with line editor and formula check, sampling, profiles, rules,
      locations read-only with a link to the Warehouses page). Files:
      `qui/components/setup-parameters/setup-parameters.component.ts`,
      `qui/components/setup-templates/setup-templates.component.ts`,
      `qui/components/setup-sampling/setup-sampling.component.ts`, `qui/components/setup-profiles/setup-profiles.component.ts`,
      `qui/components/setup-rules/setup-rules.component.ts`, `qui/components/setup-locations/setup-locations.component.ts`.
      Test: rendering specs.
- [ ] **T33**. Inspection list and inspection page (keyboard reading grid, live results, override, decision preview,
      verification, certificate). Files: `qui/components/inspection-list/inspection-list.component.ts`,
      `qui/components/inspection-page/inspection-page.component.ts`, `qui/components/reading-grid/reading-grid.component.ts`.
      Test: rendering and keyboard specs.
- [ ] **T34** (parallel). Inspector module of the floor app (`floor-ui`, `/pages/floor/inspect/:labelOrNumber`):
      scanner, readings, photos, decide, offline sets through the floor app's queue. Files:
      `qui/floor/inspector-page.component.ts`, `qui/floor/inspector-offline-queue.service.ts`, registered in
      `qui/quality-ui.plugin.ts`. Test: queue survives reload (component spec with a fake store).
- [ ] **T35** (parallel). Owner-page panels through extension slots (state chip, damaged-on-arrival and rejected
      columns, create inspections) on receipts, stock documents, deliveries, subcontract receipts, returns; item
      "Quality" tab; lot samples; operator console checklist component. Files:
      `qui/panels/owner-quality-panel.component.ts`, `qui/panels/item-quality-tab.component.ts`,
      `qui/panels/lot-samples-panel.component.ts`, `qui/panels/operator-inspection-checklist.component.ts`. Test: panels
      hidden with the feature off.
- [ ] **T36** (parallel). Quality panel on the existing Goals pages (rhythm, measures, reviews of the period),
      procedures through the documents pages filtered by category, non-conformances, improvement actions, quality
      circles (marked appointments), feedback pages. Files: `qui/panels/goal-quality-panel.component.ts`,
      `qui/components/nonconformances-page/nonconformances-page.component.ts`,
      `qui/components/actions-page/actions-page.component.ts`, `qui/components/circles-page/circles-page.component.ts`,
      `qui/components/feedback-page/feedback-page.component.ts`. Test: rendering specs; Goals page unchanged with the
      feature off.
- [ ] **T37**. Home page, dashboard, holds and samples pages, reports pages; print templates (certificate,
      non-conformance report, sample label). Files: `q/home/quality-home.controller.ts` (`/quality/home`, `/quality/holds`),
      `q/print/quality-print-templates.ts`, `qui/components/quality-home/quality-home.component.ts`,
      `qui/components/quality-dashboard/quality-dashboard.component.ts`, `qui/components/holds-page/holds-page.component.ts`,
      `qui/components/samples-page/samples-page.component.ts`, `qui/components/reports-page/reports-page.component.ts`.
      Test: rendering specs; certificate PDF snapshot.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T38**. MCP tools `packages/mcp-server/src/lib/tools/quality.ts` (plan §7), registered in
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`, `preview` true by default on deciding tools;
      objectives through the existing `goals.ts` and `key-results.ts` tools. Test: input-schema spec; preview writes
      nothing.
- [ ] **T39** (parallel). Import templates (parameters, templates, profiles, historical inspections). Files:
      `q/import/quality-import-templates.ts`. Test: per-row errors; failed rows not imported.
- [ ] **T40**. OpenAPI regenerated; SDK regeneration noted for release; webhook event catalogue entries. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the new events.
- [ ] **T41**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T42**. Control charts: chart definitions, points from decisions, limits from a baseline, capability, run
      rules, alerts, draft non-conformance, operator console warning. Files: `q/analytics/control-chart.service.ts`,
      `q/analytics/control-chart.controller.ts`, `q/engine/control-limits.ts`, `q/engine/run-rules.ts`. Test: property
      tests for limits; golden run rule cases.
- [ ] **T43**. Acceptance sampling switching rules per item and supplier with reasons on inspections. Files:
      `q/engine/sampling-switching.ts`, `q/setup/quality-sampling-level.service.ts`. Test: tighten after the configured
      rejects, return to normal after the configured accepts.
- [ ] **T44**. Supplier measures: consumer of decisions and of non-conformance and action changes (plan §8), nightly
      rebuild (damaged on arrival and rejected both counted),
      `quality.supplier_measure.updated`, measures exposed to procurement scorecards; send a non-conformance to the
      supplier through `QUALITY_COMMUNICATIONS` and record the answer. Files: `q/analytics/supplier-measure.service.ts`,
      `q/events/quality-decisions.consumer.ts`, `q/improvement/supplier-answer.service.ts`. Test: scorecard receives
      measures within 60 s in an e2e with the purchasing stub after a decision, after a non-conformance is closed and
      after an action linked to the supplier's non-conformance is closed.
- [ ] **T45**. Photo hints through `QUALITY_AI` as runs of an agent of `ai-agents-and-assistants` (model and usage on
      the run), hint records with `aiRunId` and agreement report. Files: `q/ai/photo-hints.service.ts`. Test: hints never
      set results.
- [ ] **T46**. Quality assistant as an agent of `ai-agents-and-assistants`: similar non-conformances (text and
      attribute similarity), drafts of containment, cause and corrective steps. Files: `q/ai/quality-assistant.service.ts`,
      `q/ai/quality-assistant.controller.ts`. Test: seeded cases found; drafts only.
- [ ] **T47**. Cost of poor quality snapshot with corrective card cost, scrap and rejected value, returns, supplier
      credits and tracked time on corrective step tasks at cost rates. Files:
      `q/analytics/cost-of-poor-quality.service.ts`, `q/schedule/quality-cost-snapshot.scheduler.ts`. Test: golden month.
- [ ] **T48**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Parameters, templates and sampling | T10 |
| FR-2 | §3.1 Parameters, templates and sampling | T10, T32 |
| FR-3–FR-4 | §3.1 Parameters, templates and sampling | T8, T10 |
| FR-5 | §3.1 Parameters, templates and sampling | T10 |
| FR-6 | §3.1 Parameters, templates and sampling | T11 |
| FR-7 | §3.1 Parameters, templates and sampling | T43 |
| FR-8 | §3.2 Item quality profiles and enforcement rules | T12 |
| FR-9 | §3.2 Item quality profiles and enforcement rules | T17 |
| FR-10 | §3.2 Item quality profiles and enforcement rules | T12, T16 |
| FR-11–FR-13 | §3.2 Item quality profiles and enforcement rules | T12 |
| FR-14 | §3.3 Inspections | T14 |
| FR-15 | §3.3 Inspections | T13 |
| FR-16 | §3.3 Inspections | T11 |
| FR-17 | §3.3 Inspections | T14 |
| FR-18 | §3.3 Inspections | T9, T14 |
| FR-19 | §3.3 Inspections | T14, T33 |
| FR-20 | §3.3 Inspections | T14 |
| FR-21–FR-23 | §3.3 Inspections | T15 |
| FR-24 | §3.3 Inspections | T15, T18 |
| FR-25 | §3.3 Inspections | T33, T37 |
| FR-26 | §3.3 Inspections | T14 |
| FR-27 | §3.4 Creating inspections and enforcement on documents | T16, T19, T35 |
| FR-28 | §3.4 Creating inspections and enforcement on documents | T19, T35 |
| FR-29–FR-30 | §3.4 Creating inspections and enforcement on documents | T16 |
| FR-31 | §3.4 Creating inspections and enforcement on documents | T17 |
| FR-32 | §3.4 Creating inspections and enforcement on documents | T16, T35 |
| FR-33 | §3.4 Creating inspections and enforcement on documents | T16, T17 |
| FR-34 | §3.4 Creating inspections and enforcement on documents | T20 |
| FR-35–FR-37 | §3.5 Retained samples | T21 |
| FR-38 | §3.5 Retained samples | T21, T30 |
| FR-39–FR-41 | §3.6 Quality objectives, reviews and procedures | T22 |
| FR-42 | §3.6 Quality objectives, reviews and procedures | T22, T36 |
| FR-43 | §3.6 Quality objectives, reviews and procedures | T23 |
| FR-44–FR-45 | §3.6 Quality objectives, reviews and procedures | T24 |
| FR-46 | §3.7 Non-conformances, improvement actions, quality circles and feedback | T25, T36 |
| FR-47–FR-48 | §3.7 Non-conformances, improvement actions, quality circles and feedback | T25 |
| FR-49 | §3.7 Non-conformances, improvement actions, quality circles and feedback | T26, T36 |
| FR-50–FR-51 | §3.7 Non-conformances, improvement actions, quality circles and feedback | T26 |
| FR-52–FR-53 | §3.7 Non-conformances, improvement actions, quality circles and feedback | T27 |
| FR-54 | §3.7 Non-conformances, improvement actions, quality circles and feedback | T27, T36 |
| FR-55–FR-58 | §3.8 Statistical process control (advanced) | T42 |
| FR-59–FR-61 | §3.9 Supplier quality (advanced) | T44 |
| FR-62–FR-63 | §3.10 Photo inspection, assistant and agents | T45 |
| FR-64 | §3.10 Photo inspection, assistant and agents | T46 |
| FR-65 | §3.10 Photo inspection, assistant and agents | T38 |
| FR-66–FR-67 | §3.11 Cost of poor quality | T47 |
| FR-68 | §3.12 Quality home, events and compatibility | T37 |
| FR-69 | §3.12 Quality home, events and compatibility | T28 |
| FR-70 | §3.12 Quality home, events and compatibility | T34 |
| FR-71 | §3.12 Quality home, events and compatibility | T39 |
| FR-72 | §3.12 Quality home, events and compatibility | T2, T16, T35, T36 |
| FR-73 | §3.12 Quality home, events and compatibility | T3 |
| FR-74–FR-75 | §3.13 Reports and dashboards | T30 |
| FR-76 | §3.13 Reports and dashboards | T30, T47 |
| FR-77 | §3.13 Reports and dashboards | T30 |
| FR-78 | §3.13 Reports and dashboards | T30, T44 |
| FR-79 | §3.13 Reports and dashboards | T30, T37 |
| FR-80–FR-81 | §3.13 Reports and dashboards | T30 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With the feature off or a port unbound, receipts, stock documents, deliveries, subcontract receipts and operation
  cards confirm exactly as before (owners' suites untouched); the Goals, documents and appointment pages are unchanged.
- Every decision's stock effects equal its preview; no stock on hold is ever available or reserved.
- Every acceptance criterion of `spec.md` §7 has a named test.
