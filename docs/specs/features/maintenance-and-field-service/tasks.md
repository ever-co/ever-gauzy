# Task Breakdown: Maintenance and field service

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `maintenance-and-field-service`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Gate: every route, resolver, menu entry, job, consumer and MCP tool of these tasks is gated by `FEATURE_FIELD_SERVICE` (`@FeatureFlag` + `FeatureFlagGuard`); customer self-booking (T42) also needs the calendar feature. The route planner package (T46) carries no gate.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/field-service.model.ts` (interfaces, enums, visit request,
      offline operation kind payloads, proposal and booking filter shapes, event payloads; export from `index.ts`);
      `SERVICE_SITE` added to `AddressRoleEnum`. Files: `packages/contracts/src/lib/field-service.model.ts`,
      `packages/contracts/src/index.ts`, `packages/core/src/lib/address-role/address-role.enums.ts`. Test:
      `packages/contracts/src/lib/field-service.model.spec.ts`, a type-level spec of the shapes and enums.
- [ ] **T2**. Plugin scaffold `packages/plugins/field-service` (package, project, tsconfig, jest, eslint, path
      mapping), `field-service.plugin.ts`, `field-service.features.ts` (`FEATURE_FIELD_SERVICE`, default off),
      `field-service.permissions.ts` (ten keys as contributions with `defaultFor`), `field-service.settings.ts`
      (setting contributions in the platform settings store); registered in `apps/api/src/plugins.ts`. Files:
      `packages/plugins/field-service/{package.json,project.json,tsconfig.json,jest.config.ts,eslint.config.cjs,src/index.ts}`,
      `packages/plugins/field-service/src/lib/{field-service.plugin.ts,field-service.module.ts,field-service.features.ts,field-service.permissions.ts,field-service.settings.ts}`,
      `apps/api/src/plugins.ts`, `tsconfig.json`. Test: `field-service.plugin.spec.ts`: plugin list spec; routes
      `404` with the feature off; contribution specs for features, permissions and settings.
- [ ] **T3**. Migration `CreateFieldServiceBaseTables` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), for PostgreSQL, MySQL and
      SQLite + entities and MikroORM repositories. Files: `packages/plugins/field-service/src/lib/database/migrations/{1791000093100-CreateFieldServiceBaseTables.ts,index.ts}`,
      `packages/plugins/field-service/src/lib/{site/fs-site.entity.ts,installed-unit/installed-unit.entity.ts,unit-meter/unit-meter.entity.ts,meter-reading/meter-reading.entity.ts}`,
      each with `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts` beside it. Test:
      `database/create-field-service-base-tables.migration.spec.ts` on SQLite; both ORMs map each entity. Migration timestamps: `1791000093100` to `1791000093199` (`packages/plugins/field-service`).
- [ ] **T4** (parallel). Migrations `CreateFieldServiceContractTables`, `CreateFieldServicePlanTables` + entities.
      Files: `packages/plugins/field-service/src/lib/database/migrations/{1791000093110-CreateFieldServiceContractTables.ts,1791000093120-CreateFieldServicePlanTables.ts}`,
      `packages/plugins/field-service/src/lib/{service-contract/service-contract.entity.ts,contract-unit/contract-unit.entity.ts,contract-period/contract-period.entity.ts,checklist-template/checklist-template.entity.ts,maintenance-plan/maintenance-plan.entity.ts,plan-line/plan-line.entity.ts,planned-visit/planned-visit.entity.ts}`
      with their repositories. Test: `database/create-field-service-contract-plan-tables.migration.spec.ts`.
- [ ] **T5** (parallel). Migrations `CreateFieldServiceVisitTables`, `CreateFieldServiceDispatchTables` + entities.
      Files: `packages/plugins/field-service/src/lib/database/migrations/{1791000093130-CreateFieldServiceVisitTables.ts,1791000093140-CreateFieldServiceDispatchTables.ts}`,
      `packages/plugins/field-service/src/lib/{warranty-claim/warranty-claim.entity.ts,visit/service-visit.entity.ts,visit-technician/visit-technician.entity.ts,visit-purpose/visit-purpose.entity.ts,visit-check/visit-check.entity.ts,visit-part/visit-part.entity.ts,visit-labour/visit-labour.entity.ts,visit-position/visit-position.entity.ts,technician-profile/technician-profile.entity.ts,dispatch-proposal/dispatch-proposal.entity.ts,profitability-snapshot/profitability-snapshot.entity.ts}`
      with their repositories. Test: `database/create-field-service-visit-dispatch-tables.migration.spec.ts`;
      `field-service.repositories.spec.ts` repository smoke specs.
- [ ] **T6**. The two role bundles of plan §9 as `roleBundleTemplates` of the plugin contributions; default grants as
      `defaultFor`; no seed migration. Files: `packages/plugins/field-service/src/lib/{field-service.role-bundles.ts,field-service.permissions.ts,field-service.plugin.ts}`. Test: `field-service.role-bundles.spec.ts`: templates listed and installable once; grants added for an existing
      tenant by the permission reload.
- [ ] **T7**. Port tokens in `src/lib/ports/` (`FIELD_SERVICE_SERIALS`, `_STOCK`, `_INVOICING`, `_BILLING`,
      `_CALENDAR`, `_RETURNS`, `_DOCUMENTS`, `_APPROVALS`, `_COMMUNICATIONS`, `_AI` (bound to
      `ai-agents-and-assistants`), `_PRICING`, `_PORTAL`) with fallbacks; provided `FIELD_SERVICE_VISIT_REQUESTS` and
      the serial unit contract read; bindings in `apps/api/src/plugin-composition.ts`. Files:
      `packages/plugins/field-service/src/lib/ports/{field-service.ports.ts,fallbacks.ts,index.ts}`,
      `apps/api/src/plugin-composition.ts`. Test: `ports/fallbacks.spec.ts`: services run with every port unbound.
- [ ] **T46**. Route planner package `packages/route-planner` (`@gauzy/route-planner`): the `RoutePlanner` contract,
      the planner registry, travel-time providers with the straight-line fallback, and the trip input and output
      types shared with delivery trips; no dependency on this plugin. Files:
      `packages/route-planner/{package.json,project.json,tsconfig.json,jest.config.ts,src/index.ts}`,
      `packages/route-planner/src/lib/{route-planner.contract.ts,route-planner.registry.ts,trip.types.ts,travel-time/travel-time.provider.ts,travel-time/straight-line.provider.ts}`,
      `tsconfig.json`. Test: `route-planner.registry.spec.ts`; `travel-time/straight-line.provider.spec.ts`:
      straight-line fallback used when no provider is configured; `trip.types.spec.ts` type snapshot.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Coverage engine `engine/coverage.ts` (warranty, contract, both, none on a date; a serial-tracked unit's
      warranty read from its serial unit through `FIELD_SERVICE_SERIALS`, own dates only without one). Files:
      `packages/plugins/field-service/src/lib/engine/coverage.ts`, `packages/plugins/field-service/src/lib/installed-unit/unit-coverage.controller.ts`. Test: `engine/coverage.spec.ts` property
      and golden tests; no warranty date is written for a serial-tracked unit.
- [ ] **T9**. Sites (address through the core address book with role `SERVICE_SITE`, service team) and installed units
      services and controllers (CRUD, components, replacement, `activity_log` entries, timeline source for
      `RECORD_TIMELINE_SOURCES`, notes as core comments, not delivered warning, warranty sources). Files:
      `packages/plugins/field-service/src/lib/site/{fs-site.service.ts,fs-site.controller.ts,dto/}`,
      `packages/plugins/field-service/src/lib/installed-unit/{installed-unit.service.ts,installed-unit.controller.ts,installed-unit.timeline-source.ts,dto/}`. Test:
      `installed-unit/installed-unit.service.spec.ts`, `installed-unit/installed-unit.controller.spec.ts` and
      `site/fs-site.service.spec.ts`: one unit per serial unit; the site position is read from its address; a part
      replacement keeps both units' history; an undelivered serial unit is accepted with a warning; an own warranty
      edit needs a reason.
- [ ] **T10**. Consumer `subscriber:field-service-sources` for `delivery.installation.completed`,
      `serial_unit.delivered`, `serial_unit.warranty_expiring`. Files: `packages/plugins/field-service/src/lib/consumers/field-service-sources.consumer.ts`. Test: `consumers/field-service-sources.consumer.spec.ts`: delivered twice creates one unit.
- [ ] **T11** (parallel). Meters and readings (cumulative and gauge rules, reset, device endpoint with HMAC and rate
      limit). Files: `packages/plugins/field-service/src/lib/unit-meter/{unit-meter.service.ts,unit-meter.controller.ts,dto/}`,
      `packages/plugins/field-service/src/lib/meter-reading/{meter-reading.service.ts,meter-reading.controller.ts,device-reading.controller.ts,device-signature.guard.ts,dto/}`. Test:
      `meter-reading/meter-reading.service.spec.ts`: decreasing reading refused unless a reset;
      `meter-reading/device-reading.controller.spec.ts`: device signature refused when wrong; second reading in a
      minute refused.
- [ ] **T12**. Document type registrations (contract, claim, visit) with the business document engine. Files: `packages/plugins/field-service/src/lib/documents/field-service.document-types.ts`. Test: `documents/field-service.document-types.spec.ts`: number
      assigned once; lifecycle transitions.
- [ ] **T13**. Service contracts: draft, activation with preview, overlap refusal, the serial unit contract read
      answered from the active contract, periods, cancellation and expiry, from order line; ending notices scheduled
      as `reminder` rows through `REMINDERS`. Files: `packages/plugins/field-service/src/lib/service-contract/{service-contract.service.ts,service-contract.controller.ts,serial-unit-contract.reader.ts,dto/}`,
      `packages/plugins/field-service/src/lib/contract-period/contract-period.service.ts`. Test:
      `service-contract/service-contract.service.spec.ts`, SQLite end-to-end with a stub serial port: overlap and end
      before start refused; activation proposes a draft plan from the included visits; a contract drafted from an
      order line takes the delivered serial units; the serial unit shows the end of the active contract without a copy.
- [ ] **T14**. Contract billing through `FIELD_SERVICE_BILLING` (subscription or recurring invoice) and renewal
      rules. Files: `packages/plugins/field-service/src/lib/service-contract/{contract-billing.service.ts,contract-renewal.service.ts}`. Test:
      `service-contract/contract-renewal.service.spec.ts`: automatic renewal unless cancelled before notice; propose
      drafts a renewal; `service-contract/contract-billing.service.spec.ts`: billed and unbilled periods.
- [ ] **T15**. Plan dates through the core recurrence module (`packages/core/src/lib/recurrence/` of
      `business-document-engine` T62: calendar rules, counts, holiday shift) plus `engine/meter-rule.ts` (meter rule,
      whichever first, spreading, third-value computation, time-off shift). Files:
      `packages/plugins/field-service/src/lib/engine/{meter-rule.ts,plan-dates.ts}`. Test: `engine/meter-rule.spec.ts`
      and `engine/plan-dates.spec.ts` property tests; golden month-end and nth-weekday cases through the core rules; a
      count the period cannot hold refused; no working day refused.
- [ ] **T16**. Maintenance plans: lines (parts kit proposed from the item's catalogue `SPARE_PART` relations),
      generation with preview diff, regeneration of untouched future visits only, fill from sales order, one plan per
      order line, planned visit tracking. Files: `packages/plugins/field-service/src/lib/maintenance-plan/{maintenance-plan.service.ts,maintenance-plan.controller.ts,plan-generation.service.ts,dto/}`,
      `packages/plugins/field-service/src/lib/plan-line/plan-line.service.ts`,
      `packages/plugins/field-service/src/lib/planned-visit/planned-visit.service.ts`,
      `packages/plugins/field-service/src/lib/checklist-template/{checklist-template.service.ts,checklist-template.controller.ts}`. Test:
      `maintenance-plan/plan-generation.service.spec.ts`: regeneration keeps hand scheduled visits; holiday dates
      shifted; `planned-visit/planned-visit.service.spec.ts`: the latest done visit wins.
- [ ] **T17**. Warranty claims: numbering, statuses, coverage on complaint date, serial-item check, cancel refusal,
      approval through `FIELD_SERVICE_APPROVALS`, cost roll-up, resolution by replacement or refund as an
      `order_claim` or `order_exchange` on the delivering order through `FIELD_SERVICE_RETURNS`. Files:
      `packages/plugins/field-service/src/lib/warranty-claim/{warranty-claim.service.ts,warranty-claim.controller.ts,claim-resolution.service.ts,dto/}`. Test:
      `warranty-claim/warranty-claim.service.spec.ts` and `warranty-claim/warranty-claim.controller.spec.ts`: a
      serial unit of another item refused; cancel refused with an open visit; approval above the threshold; a
      refund resolution creates one order claim and no stock movement here.
- [ ] **T18**. Visits: create from plan, claim, ticket, request contract; states recorded in `activity_log`, consented
      positions in `fs_visit_position` with the 30-day purge; purposes, checklist (reading steps write meter readings
      of the unit, checked against the meter's limits), parts through `FIELD_SERVICE_STOCK` (van location, returns),
      follow-ups, no access. Files: `packages/plugins/field-service/src/lib/visit/{service-visit.service.ts,service-visit.controller.ts,visit-state.machine.ts,dto/}`,
      `packages/plugins/field-service/src/lib/{visit-purpose/visit-purpose.service.ts,visit-check/visit-check.service.ts,visit-part/visit-part.service.ts,visit-position/visit-position.service.ts}`. Test:
      `visit/service-visit.service.spec.ts`: required step blocks completion; no purpose blocks completion; a gauge
      reading outside the meter's limits flags the step; a scheduled visit without a technician, outside its plan
      line's period or of another customer's plan is refused; `visit-part/visit-part.service.spec.ts`: parts issued
      from the van with serial units.
- [ ] **T19**. Labour under the labour attribution rule: a work task and a travel task per technician and visit,
      time-log read of each into `fs_visit_labour` at the stored pay rate, billing at `employee.billRateValue`. Files: `packages/plugins/field-service/src/lib/visit-labour/{visit-labour.service.ts,visit-tasks.service.ts}`. Test:
      `visit-labour/visit-labour.service.spec.ts`: travel and work minutes come from their tasks; state changes add no
      minutes; no double count on refresh.
- [ ] **T20**. Completion: preview of stock, claim and invoice effects; chargeable lines from coverage and terms;
      invoice draft through `FIELD_SERVICE_INVOICING`; plan and claim write-back with revert on reopen; visit report
      through the print service. Files: `packages/plugins/field-service/src/lib/visit/{visit-completion.service.ts,visit-charging.ts,visit-report.service.ts}`. Test:
      `visit/visit-completion.service.spec.ts`: covered visit drafts nothing; chargeable parts, labour and travel
      drafted at price list and billing rate; reopen reverts claim; signature and rating stored on the report.
- [ ] **T21**. Technician profiles (teams as service areas), assignment checks (skills, time off, holidays, overlap,
      hours, service area, parts, response risk), assign endpoint with versions. Files:
      `packages/plugins/field-service/src/lib/technician-profile/{technician-profile.service.ts,technician-profile.controller.ts,dto/}`,
      `packages/plugins/field-service/src/lib/dispatch/{assignment-check.service.ts,assignment.controller.ts}`. Test:
      `dispatch/assignment-check.service.spec.ts`: each finding; overlap refused unless overbooking is allowed;
      `dispatch/assignment.controller.spec.ts`: `409` on concurrent assignment.
- [ ] **T22**. Calendar events through `FIELD_SERVICE_CALENDAR` with employee-appointment fallback and the visits layer
      (`registerCalendarLayers`); customer notices through `FIELD_SERVICE_COMMUNICATIONS`. Files:
      `packages/plugins/field-service/src/lib/calendar/{visit-calendar.service.ts,visits-calendar.layer.ts}`,
      `packages/plugins/field-service/src/lib/notices/customer-notices.service.ts`. Test:
      `calendar/visit-calendar.service.spec.ts`: event follows reschedule and cancel; fallback creates an appointment;
      `notices/customer-notices.service.spec.ts`: one notice per visit and event per the settings.
- [ ] **T23**. Mobile endpoints `/field-service/me/*` (reads, offline pack) and the `field_service.*` operation kinds
      contributed through `OFFLINE_OPERATION_KINDS` to the core offline-sync module (`warehouse-and-stock-movements`
      T59), with assignment checks and conflict rules (dispatcher wins the assignment, the work record is kept). Files:
      `packages/plugins/field-service/src/lib/mobile/{field-service-me.controller.ts,offline-pack.service.ts,field-service.offline-kinds.ts}`. Test:
      `mobile/field-service.offline-kinds.spec.ts`: batch through `/api/offline-sync/batches` applied in order;
      replayed batch applies nothing twice; a conflict becomes an `offline_exception`.
- [ ] **T24** (parallel). Tool reservations through the existing equipment sharing request. Files: `packages/plugins/field-service/src/lib/visit/visit-tools.service.ts`, `packages/core/src/lib/equipment-sharing/commands/equipment-sharing.create.command.ts` (called, unchanged). Test: `visit/visit-tools.service.spec.ts`: sharing rules and
      approval unchanged.
- [ ] **T25** (parallel). Visit request contract for helpdesk tickets, fixed-asset maintenance occurrences and
      delivery installations, with requester notifications. Files: `packages/plugins/field-service/src/lib/visit-request/{visit-request.service.ts,visit-request.controller.ts}`. Test: `visit-request/visit-request.service.spec.ts`, a contract test with each requester stub.
- [ ] **T26**. Events of plan §5 and real-time hints; schedules and consumers in `src/lib/schedule/`
      (`FieldServiceSchedulePlugin` in `apps/worker/src/plugins.ts`), in-process fallback. Files:
      `packages/plugins/field-service/src/lib/events/{field-service.events.ts,index.ts}`,
      `packages/plugins/field-service/src/lib/schedule/{field-service-schedule.plugin.ts,plans-sweep.job.ts,contracts-sweep.job.ts,labour-refresh.job.ts,positions-purge.job.ts}`,
      `packages/plugins/field-service/src/lib/consumers/field-service-notices.consumer.ts`, `apps/worker/src/plugins.ts`. Test: `schedule/plans-sweep.job.spec.ts` (visits due within the lead time created once) and one sweep spec per job; `events/field-service.events.spec.ts` payloads; with the feature off no job or consumer runs.
- [ ] **T27**. Report definitions (maintenance schedules, visits, claims, contracts and renewals, parts used, service
      profitability) and dashboard cards. Files: `packages/plugins/field-service/src/lib/reports/{field-service.report-definitions.ts,field-service-dashboard.service.ts,field-service-dashboard.controller.ts}`. Test: `reports/field-service.report-definitions.spec.ts`: figures on seeded data.
- [ ] **T47**. Contract period usage (FR-18): per contract and period, visits included, used and remaining updated at
      visit completion and reopen, and response targets met or missed per visit from `responseDueAt`;
      `/field-service/contracts/:id/periods`. Files: `packages/plugins/field-service/src/lib/contract-period/{contract-period.service.ts,contract-period-usage.subscriber.ts}`,
      `packages/plugins/field-service/src/lib/service-contract/service-contract.controller.ts`. Test:
      `contract-period/contract-period.service.spec.ts`: a completed visit uses one included visit, a reopen gives it
      back; a visit started after `responseDueAt` counts as missed.
- [ ] **T48**. Dispatch board endpoint `/field-service/board` (FR-49): technicians by day or week with their visits,
      time off and travel, filtered by service area, the unassigned queue sorted by priority and response due, and the
      technician views (day, week, agenda). Files: `packages/plugins/field-service/src/lib/dispatch/{dispatch-board.service.ts,dispatch-board.controller.ts}`. Test:
      `dispatch/dispatch-board.service.spec.ts`: queue order; service-area filter; 50 technicians and 500 visits within
      the spec §4 time.
- [ ] **T49**. Settings route `/field-service/settings` (FR-55) over the setting contributions of T2: response hours by
      priority, booking rules, notification texts, lead days, claim approval threshold, overbooking. Files:
      `packages/plugins/field-service/src/lib/settings/{field-service-settings.service.ts,field-service-settings.controller.ts,dto/}`. Test:
      `settings/field-service-settings.controller.spec.ts`: values stored per organization; `FIELD_SERVICE_SETTINGS_EDIT`
      required to write.

## Phase 3 — UI surfaces

- [ ] **T28**. Angular plugin scaffold `packages/plugins/field-service-ui`, registered in
      `apps/gauzy/src/plugin-ui.config.ts`; menu, feature and permission gating; i18n keys in every locale. Files:
      `packages/plugins/field-service-ui/{package.json,project.json,ng-package.json,src/index.ts,src/i18n/en.json}`,
      `packages/plugins/field-service-ui/src/lib/{field-service-ui.plugin.ts,field-service-ui.routes.ts,services/field-service-api.service.ts}`,
      `apps/gauzy/src/plugin-ui.config.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test:
      `field-service-ui.plugin.spec.ts`: plugin spec; menu hidden when off.
- [ ] **T29**. Units (list, map, page with coverage, record timeline, meters, comments), sites, contracts pages. Files: `packages/plugins/field-service-ui/src/lib/components/{units-page/units-page.component.ts,unit-detail/unit-detail.component.ts,sites-page/sites-page.component.ts,contracts-page/contracts-page.component.ts,contract-detail/contract-detail.component.ts}`. Test:
      rendering specs `units-page.component.spec.ts`, `unit-detail.component.spec.ts`, `contracts-page.component.spec.ts`.
- [ ] **T30** (parallel). Plans (lines, recurrence editor, generation preview diff), checklists, claims pages. Files: `packages/plugins/field-service-ui/src/lib/components/{plans-page/plans-page.component.ts,plan-detail/plan-detail.component.ts,recurrence-editor/recurrence-editor.component.ts,checklists-page/checklists-page.component.ts,claims-page/claims-page.component.ts}`. Test:
      rendering specs `plan-detail.component.spec.ts`, `recurrence-editor.component.spec.ts`, `claims-page.component.spec.ts`.
- [ ] **T31**. Visit page (purposes, checklist, parts, labour, signature, report). Files: `packages/plugins/field-service-ui/src/lib/components/{visit-detail/visit-detail.component.ts,visit-signature/visit-signature.component.ts}`. Test: `visit-detail.component.spec.ts` rendering and keyboard specs.
- [ ] **T32**. Dispatch board (technician rows, service-area filter, queue, drag and drop with list alternative,
      findings, map) with its technician view (day, week, agenda) used as the technician calendar when the calendar
      feature is off, and real-time updates. Files: `packages/plugins/field-service-ui/src/lib/components/{dispatch-board/dispatch-board.component.ts,dispatch-queue/dispatch-queue.component.ts,technician-calendar/technician-calendar.component.ts,visits-map/visits-map.component.ts}`. Test: `dispatch-board.component.spec.ts` rendering specs; keyboard assignment.
- [ ] **T33** (parallel). Contributed panels: customer tabs, helpdesk ticket action and chip, fixed-asset "request
      visit", serial unit link. Files: `packages/plugins/field-service-ui/src/lib/panels/{customer-units-tab.component.ts,customer-service-tab.component.ts,ticket-field-service-action.component.ts,asset-request-visit.component.ts,serial-unit-link.component.ts}`. Test: `panels/panels.spec.ts`: hidden with the feature off.
- [ ] **T34**. Dashboard, reports, settings and technician pages; print templates (visit report, contract, claim,
      maintenance schedule). Files: `packages/plugins/field-service-ui/src/lib/components/{dashboard-page/dashboard-page.component.ts,reports-page/reports-page.component.ts,settings-page/settings-page.component.ts,technicians-page/technicians-page.component.ts}`,
      `packages/plugins/field-service/src/lib/print/field-service.print-templates.ts`. Test:
      `dashboard-page.component.spec.ts` rendering specs; `print/field-service.print-templates.spec.ts` report PDF snapshot.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T35**. MCP tools `packages/mcp-server/src/lib/tools/field-service.ts` (plan §7) with `preview` defaults.
      Files: `packages/mcp-server/src/lib/tools/field-service.ts`, `packages/mcp-server/src/lib/tools/register-all-tools.ts`.
      Test: `packages/mcp-server/src/lib/tools/field-service.spec.ts`: input-schema spec; preview tools write nothing.
- [ ] **T36** (parallel). Import templates (installed base, contracts, plans). Files: `packages/plugins/field-service/src/lib/import/field-service.import-profiles.ts`. Test: `import/field-service.import-profiles.spec.ts`: per-row errors.
- [ ] **T37**. OpenAPI regenerated; SDK regeneration noted for release; webhook event catalogue entries; mobile job
      module of the floor app (screens in `field-service-ui` registered with the `floor-ui` module registry of
      `warehouse-and-stock-movements` T44: my visits, detail, states with travel and work timers, checklist,
      readings, parts, photos, signature, notes). Files: `packages/plugins/field-service-ui/src/lib/mobile/{field-service-floor.module.ts,my-visits.component.ts,mobile-visit.component.ts}`,
      `packages/plugins/field-service/src/lib/events/field-service.webhook-catalogue.ts`,
      `packages/core/src/lib/bootstrap/swagger.ts`.
      Test: `mobile/mobile-visit.component.spec.ts` rendering tests; actions queue offline through the floor app's queue.
- [ ] **T38**. User docs (docs site) and `docs/specs/README.md` index row. Files: `docs/specs/README.md`. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T39**. Forecast engine `engine/forecast.ts` (trend, confidence, anomaly rules), forecast visits that move
      with new readings, anomaly breakdown offer. Files: `packages/plugins/field-service/src/lib/engine/forecast.ts`,
      `packages/plugins/field-service/src/lib/schedule/forecast.job.ts`. Test: `engine/forecast.spec.ts` golden series;
      `schedule/forecast.job.spec.ts`: forecast visit moves only beyond two days; an anomaly offers a breakdown visit.
- [ ] **T40**. Dispatch on the route planner package of T46 (`packages/route-planner`): its built-in planner for
      several routes (windows, locked stops and capacities by insertion plus local search, deterministic; shared with
      the delivery trip planner); field-service constraint set (skills, parts, technician hours and time off, fixed visits),
      core operation `FIELD_SERVICE_DISPATCH_PROPOSE`, proposal endpoints and review page, re-proposal on overrun or
      urgent breakdown. Files: `packages/route-planner/src/lib/planner/{insertion-planner.ts,local-search.ts}`,
      `packages/plugins/field-service/src/lib/dispatch-proposal/{dispatch-proposal.service.ts,dispatch-proposal.controller.ts,dispatch-propose.operation.ts,field-service.constraints.ts}`,
      `packages/plugins/field-service-ui/src/lib/components/proposal-review/proposal-review.component.ts`. Test:
      `packages/route-planner/src/lib/planner/insertion-planner.spec.ts` golden instances;
      `dispatch-proposal/dispatch-proposal.service.spec.ts`: fixed visits never moved; budget respected; a delivery
      trip and a technician day use the same planner.
- [ ] **T41**. Travel times through the route planner's travel-time providers with the straight-line fallback. Files: `packages/plugins/field-service/src/lib/dispatch-proposal/travel-times.service.ts`. Test:
      `dispatch-proposal/travel-times.service.spec.ts`: fallback used when no provider is configured.
- [ ] **T42**. Customer self-booking: a visit kind's `event_type` with technician hosts, open slots from the calendar
      booking engine through `FIELD_SERVICE_CALENDAR` filtered by skills, service area and parts; book, move, cancel
      as calendar bookings under the event type's rules; the booking's signed link; portal page through
      `FIELD_SERVICE_PORTAL`; breakdown requests from the portal. Files: `packages/plugins/field-service/src/lib/booking/{visit-booking.service.ts,visit-booking.controller.ts,portal-requests.controller.ts}`,
      `packages/plugins/field-service-ui/src/lib/components/{booking-page/booking-page.component.ts,portal-request/portal-request.component.ts}`. Test:
      `booking/visit-booking.service.spec.ts`: notice rule refuses late moves; link limited to its visit; unavailable
      with the calendar feature off; a portal breakdown request creates a claim with coverage shown.
- [ ] **T43**. First-time fix job and report; technician brief and report draft through `FIELD_SERVICE_AI`
      (`ai-agents-and-assistants`, runs and usage recorded there) with plain fallback. Files:
      `packages/plugins/field-service/src/lib/assistant/{visit-brief.service.ts,report-draft.service.ts,assistant.controller.ts}`,
      `packages/plugins/field-service/src/lib/schedule/first-fix.job.ts`. Test: `schedule/first-fix.job.spec.ts` golden
      first-fix cases; `assistant/report-draft.service.spec.ts`: drafts never saved without confirmation; no AI table
      in this plugin.
- [ ] **T44** (parallel). Supplier recovery claims from claims on supplier-warranted items; profitability snapshot.
      Files: `packages/plugins/field-service/src/lib/warranty-claim/supplier-recovery.service.ts`,
      `packages/plugins/field-service/src/lib/profitability-snapshot/profitability-snapshot.service.ts`,
      `packages/plugins/field-service/src/lib/schedule/profitability.job.ts`. Test:
      `warranty-claim/supplier-recovery.service.spec.ts`: recovery lists parts and labour;
      `profitability-snapshot/profitability-snapshot.service.spec.ts`: profitability golden month.
- [ ] **T45**. Trial period on a tenant with the flag on; spec status `Implemented`. Files: `docs/specs/features/maintenance-and-field-service/spec.md`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Installed base and sites | T9 |
| FR-2 | §3.1 Installed base and sites | T10 |
| FR-3 | §3.1 Installed base and sites | T9 |
| FR-4 | §3.1 Installed base and sites | T8 |
| FR-5 | §3.1 Installed base and sites | T8, T9 |
| FR-6 | §3.1 Installed base and sites | T9, T29 |
| FR-7–FR-8 | §3.1 Installed base and sites | T9 |
| FR-9–FR-10 | §3.1 Installed base and sites | T11 |
| FR-11 | §3.2 Service contracts | T12, T13 |
| FR-12–FR-13 | §3.2 Service contracts | T13 |
| FR-14 | §3.2 Service contracts | T13, T16 |
| FR-15 | §3.2 Service contracts | T14 |
| FR-16 | §3.2 Service contracts | T13, T14 |
| FR-17 | §3.2 Service contracts | T13 |
| FR-18 | §3.2 Service contracts | T13, T47 |
| FR-19 | §3.3 Maintenance plans and visit generation | T16 |
| FR-20–FR-21 | §3.3 Maintenance plans and visit generation | T15 |
| FR-22 | §3.3 Maintenance plans and visit generation | T15, T16 |
| FR-23–FR-25 | §3.3 Maintenance plans and visit generation | T16 |
| FR-26 | §3.3 Maintenance plans and visit generation | T18, T30 |
| FR-27 | §3.3 Maintenance plans and visit generation | T26 |
| FR-28–FR-29 | §3.4 Warranty claims | T12, T17 |
| FR-30 | §3.4 Warranty claims | T8, T17 |
| FR-31 | §3.4 Warranty claims | T17 |
| FR-32 | §3.4 Warranty claims | T17, T18, T20 |
| FR-33–FR-34 | §3.4 Warranty claims | T17 |
| FR-35 | §3.4 Warranty claims | T44 |
| FR-36 | §3.5 Visits | T18, T25 |
| FR-37 | §3.5 Visits | T18 |
| FR-38 | §3.5 Visits | T18, T21 |
| FR-39–FR-41 | §3.5 Visits | T18 |
| FR-42 | §3.5 Visits | T19 |
| FR-43 | §3.5 Visits | T20, T31 |
| FR-44 | §3.5 Visits | T20 |
| FR-45 | §3.5 Visits | T18, T20 |
| FR-46 | §3.5 Visits | T25 |
| FR-47 | §3.5 Visits | T24 |
| FR-48 | §3.6 Technicians, dispatch and calendar | T21, T34 |
| FR-49 | §3.6 Technicians, dispatch and calendar | T48, T32 |
| FR-50 | §3.6 Technicians, dispatch and calendar | T21 |
| FR-51 | §3.6 Technicians, dispatch and calendar | T22 |
| FR-52 | §3.6 Technicians, dispatch and calendar | T22, T32 |
| FR-53 | §3.6 Technicians, dispatch and calendar | T22, T26 |
| FR-54 | §3.6 Technicians, dispatch and calendar | T23, T37 |
| FR-55 | §3.6 Technicians, dispatch and calendar | T49, T34 |
| FR-56–FR-58 | §3.7 Predictive maintenance (advanced) | T39 |
| FR-59 | §3.8 Route-optimised dispatch (advanced) | T40, T46 |
| FR-60 | §3.8 Route-optimised dispatch (advanced) | T40, T41 |
| FR-61 | §3.8 Route-optimised dispatch (advanced) | T40 |
| FR-62–FR-64 | §3.9 Customer self-booking (advanced) | T42 |
| FR-65–FR-67 | §3.10 Assistant, agents and analytics | T43 |
| FR-68 | §3.10 Assistant, agents and analytics | T35 |
| FR-69 | §3.11 Events, integration and compatibility | T26 |
| FR-70 | §3.11 Events, integration and compatibility | T25, T26, T33 |
| FR-71 | §3.11 Events, integration and compatibility | T6 |
| FR-72 | §3.11 Events, integration and compatibility | T36 |
| FR-73 | §3.11 Events, integration and compatibility | T2, T24, T26, T28 |
| FR-74 | §3.11 Events, integration and compatibility | T3–T5 |
| FR-75–FR-79 | §3.12 Reports and dashboard | T27, T34 |
| FR-80 | §3.12 Reports and dashboard | T27, T34, T44 |
| FR-81 | §3.12 Reports and dashboard | T43 |
| FR-82 | §3.12 Reports and dashboard | T27, T34 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Equipment, equipment sharing, appointments, deliveries and serial units behave identically with the feature on and
  off (their suites untouched).
- Coverage on a unit, a claim and a visit always agrees for the same date (shared engine, contract test).
- Every acceptance criterion of `spec.md` §7 has a named test.
