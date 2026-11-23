# Task Breakdown: Attendance and shifts

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `attendance-and-shifts`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_ATTENDANCE` / `FEATURE_SHIFTS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths starting with `attendance/`, `attendance-ui/`, `shifts/` or `shifts-ui/` are under `packages/plugins/`; a bare
  folder of an attendance task (`engine/`, `days/`, `device/`, `requests/`, …) is under
  `packages/plugins/attendance/src/lib/`, of a shifts task (`templates/`, `assignments/`, `rules/`, …) under
  `packages/plugins/shifts/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/attendance.model.ts` and `shifts.model.ts` (interfaces, enums,
      DTO and preview shapes, event payloads, port tokens `SHIFTS_SCHEDULE`, `SHIFTS_ATTENDANCE_ACTUALS`,
      `SHIFTS_LOCATIONS`, `SHIFTS_COVERAGE`, `ATTENDANCE_APPROVALS`, `SHIFTS_APPROVALS`, `ATTENDANCE_CALENDAR_SIGNALS`,
      `SHIFTS_LABOUR_COST`, `SHIFTS_DEMAND_SOURCE`); `AddressOwnerType.WORK_LOCATION`; `ApprovalPolicyTypesStringEnum`
      values `ATTENDANCE_REQUEST`, `OVERTIME_REQUEST`, `OVERTIME_STATEMENT`, `SHIFT_REQUEST`, `SHIFT_TRADE`; export from
      `index.ts`. Test: type spec over sample payloads.
- [ ] **T2**. Scaffold `packages/plugins/attendance` (package, project, tsconfig, jest, eslint, path mapping),
      `attendance.plugin.ts`, `attendance.features.ts` (`FEATURE_ATTENDANCE` and `FEATURE_TEAMS_PEOPLE_SELF_SERVICE`, the tenant switch of the Ever Teams screens, both default off), `attendance.permissions.ts`
      (nine keys), `attendance.settings.ts`; registered in `apps/api/src/plugins.ts`. Test: plugin list spec; every route
      `404` with the feature off.
- [ ] **T3** (parallel). Same scaffold for `packages/plugins/shifts` (`FEATURE_SHIFTS`, seven keys, `shifts.settings.ts`).
      Test: as T2.
- [ ] **T4**. Attendance migration on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
      `CreateAttendanceCoreTables` (locations without address columns, profiles without badges, devices, check-ins, days)
      and entities with MikroORM repositories (`entities/`). Files:
      `attendance/src/lib/database/migrations/1791000096100-CreateAttendanceCoreTables.ts`,
      `attendance/src/lib/entities/{work-location,employee-attendance-profile,attendance-device,attendance-check-in,attendance-day}.entity.ts`,
      `attendance/src/lib/repositories/mikro-orm-<entity>.repository.ts` per entity. Test: migration up twice on SQLite
      is a no-op; repository smoke specs for both ORMs; `dedupeKey` / `clientKey` / `sourceKey` uniqueness. Migration timestamps: `1791000096100` to `1791000096199` (`packages/plugins/attendance`); `1791000096200` to `1791000096299` (`packages/plugins/shifts`).
- [ ] **T5** (parallel). Migrations `CreateAttendanceExceptionAndRequestTables`, `CreateOvertimeTables` and entities.
      Files: `attendance/src/lib/database/migrations/1791000096110-CreateAttendanceExceptionAndRequestTables.ts`,
      `attendance/src/lib/database/migrations/1791000096120-CreateOvertimeTables.ts`,
      `attendance/src/lib/entities/{attendance-exception,attendance-request,overtime-type,overtime-request,overtime-statement,overtime-statement-line}.entity.ts`.
      Test: migration spec; `liveKey` and `factKey` uniqueness on three dialects; every declared
      `attendance_exception.state` (`AUTO_ACCEPTED` included) persists on PostgreSQL, MySQL in strict mode and SQLite.
- [ ] **T6** (parallel). Shifts helpers, migrations `CreateShiftTemplateTables`, `CreateShiftMarketplaceTables`,
      `CreateShiftPlanningTables` and entities. Files:
      `shifts/src/lib/database/migrations/1791000096200-CreateShiftTemplateTables.ts`,
      `shifts/src/lib/database/migrations/1791000096210-CreateShiftMarketplaceTables.ts`,
      `shifts/src/lib/database/migrations/1791000096220-CreateShiftPlanningTables.ts`,
      `shifts/src/lib/entities/{shift-template,shift-template-version,employee-shift-profile,shift-pattern,shift-pattern-assignment,shift-assignment,shift-request}.entity.ts`,
      `shifts/src/lib/entities/{open-shift,shift-trade,working-time-rule,shift-rule-override}.entity.ts`,
      `shifts/src/lib/entities/{coverage-target,demand-forecast,demand-forecast-slot,roster-proposal,roster-proposal-row,roster-action}.entity.ts`.
      Test: migration spec; `generationKey` and trade `liveKey` uniqueness.
- [ ] **T7**. Permission and feature contributions with `defaultFor` (grants of plan §9) in both plugins; tables
      registered with tenant export, import and factory reset; no seed migration. Files:
      `attendance/src/lib/attendance.permissions.ts`, `attendance/src/lib/attendance.plugin.ts`,
      `shifts/src/lib/shifts.permissions.ts`, `shifts/src/lib/shifts.plugin.ts`. Test: grants per role from the
      contributions; export lists the tables.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Settings over the settings store (`attendance.*`, branch overrides in `attendance.branchOverrides`,
      full day defaulting from `organization.standardWorkHoursPerDay`) and locations with their core `address` row
      (owner `WORK_LOCATION`) (`settings/`, `locations/`), first-enable handler (FR-3). Files:
      `attendance/src/lib/settings/attendance-settings.service.ts`, `attendance/src/lib/settings/first-enable.handler.ts`,
      `attendance/src/lib/locations/work-location.service.ts`, `attendance/src/lib/locations/work-location.controller.ts`.
      Test: branch override precedence; full day follows the organization's standard hours while unset; starter
      locations per branch; validation of radius and coordinates.
- [ ] **T9**. Day engine, pure (`engine/pairing.ts`, `summing.ts`, `intervals.ts`, `thresholds.ts`, `lateness.ts`,
      `overtime-split.ts`, `night.ts`). Test: golden cases — alternate and by-direction pairing, unpaired parts, union
      of check-ins and tracked time, half holiday thresholds, night minutes across midnight.
- [ ] **T10**. Shift resolution (`shifts/src/lib/resolution/`), template versions and `SHIFTS_SCHEDULE` provider.
      Test: crossing midnight, back-to-back, windows, version by date, daylight-saving days per location time zone.
- [ ] **T11**. Check-in service and own routes (`/attendance/me/*`): channels, active and agent checks, direction,
      dedupe, shift link, off-shift. Files: `attendance/src/lib/check-ins/check-in.service.ts`,
      `attendance/src/lib/check-ins/my-attendance.controller.ts`, `attendance/src/lib/check-ins/check-in.controller.ts`,
      `attendance/src/lib/check-ins/dto/create-check-in.dto.ts`. Test: refusals (`403`, `400` codes); identical check-in
      returns the existing row.
- [ ] **T12**. Geofence and location privacy (`location/geofence.ts`, distance against the location's address
      coordinates, office networks, minimisation, raw fields behind `@VisibleWith(ATTENDANCE_LOCATION_VIEW)`, raw read
      endpoint writing one `AUDIT_EVENT_SINK` event; with no audit sink bound, raw reads refused with
      `ATTENDANCE_LOCATION_AUDIT_UNAVAILABLE`, raw fields omitted and keeping raw coordinates unavailable). Test: inside,
      outside flag and refuse; coordinates dropped unless kept; every raw read in the access audit; field absent without
      the key; without `access-control-and-security` no raw coordinate is returned to a holder of
      `ATTENDANCE_LOCATION_VIEW` and the keep setting is refused.
- [ ] **T13**. Timer capture handler (`TimerStartedEvent`, `TimerStoppedEvent`) and `attendance.time-log-sweep` whose
      watermark is the organization's last succeeded `job_execution` of the sweep. Files:
      `attendance/src/lib/capture/timer-capture.handler.ts`, `attendance/src/lib/capture/time-log-sweep.scheduler.ts`,
      `attendance/src/lib/capture/time-log-sweep.worker.ts`. Test: start/stop create `TIMER` check-ins once; manual
      edit, delete and offline upload reflected within one sweep; break logs (per `break-rules.ts`) become breaks; idle
      discarded time ignored.
- [ ] **T14**. Day builder service: sources, calendar day kinds through `TIME_OFF_WORKING_CALENDAR` (fallback core
      `official-holiday`), time-off portions from `time_off.*` events, thresholds, lateness, absences, holiday work,
      recorded breaks before the template's unpaid break, overrides kept, change history as `activity_log` rows. Files:
      `attendance/src/lib/days/day-builder.service.ts`, `attendance/src/lib/days/day-history.ts`,
      `attendance/src/lib/days/time-off-portions.consumer.ts`. Test: each FR-27 to FR-35 rule; manual override survives
      a rebuild; a timer break is not deducted twice.
- [ ] **T15**. Processing job `attendance.process` (schedule plugin in `apps/worker/src/plugins.ts`, queue worker in the
      API, in-process fallback), advisory lock, passes as `job_execution` rows and on-demand runs as core operation
      `ATTENDANCE_PROCESS`, source completeness (device `completeThrough`, timer). Files:
      `attendance/src/lib/processing/attendance-process.scheduler.ts`, `attendance/src/lib/processing/attendance-process.worker.ts`,
      `attendance/src/lib/attendance-schedule.plugin.ts`. Test: one run per organization; silent device holds absences;
      repeat run changes nothing.
- [ ] **T16**. Manual, multi-day and bulk marking, void, period lock and unlock (`days/`). Files:
      `attendance/src/lib/days/attendance-day.service.ts`, `attendance/src/lib/days/attendance-day.controller.ts`,
      `attendance/src/lib/days/period-lock.service.ts`. Test: refusals of FR-20 and FR-21; bulk results per employee;
      void unlinks check-ins; locked day refuses edits.
- [ ] **T17**. Device API (`device/`): device registry, key hashing, rotate and revoke, batch of 500 with per-item
      results, employee resolution through `HR_DIRECTORY` (device ids, `BADGE` external ids, employee number; fallback
      employee id), `completeThrough`. Files: `attendance/src/lib/device/attendance-device.service.ts`,
      `attendance/src/lib/device/attendance-device.controller.ts`, `attendance/src/lib/device/device-check-in.controller.ts`,
      `attendance/src/lib/device/device-key.guard.ts`. Test: batch replay idempotent; unknown badge refused alone;
      revoked key `401`.
- [ ] **T18** (parallel). Check-in import template and `/attendance/check-ins/import` with preview. Files:
      `attendance/src/lib/check-ins/check-in.import-template.ts`, `attendance/src/lib/check-ins/check-in.controller.ts`.
      Test: per-row results; duplicates skipped.
- [ ] **T19**. Requests and corrections (`requests/`): remote, off-site, correction; approval through
      `ATTENDANCE_APPROVALS` (fallback: core `request_approval` of type `ATTENDANCE_REQUEST` naming the approver resolved
      via `HR_APPROVER_RESOLVER`, else permission holders, gate registered, outcome through its settler (`registerRequestApprovalSettler`));
      apply and revert. Files: `attendance/src/lib/requests/attendance-request.service.ts`,
      `attendance/src/lib/requests/attendance-request.controller.ts`, `attendance/src/lib/requests/attendance-request.settler.ts`.
      Test: overlap refused; holidays and time-off portions skipped; cancel rebuilds; locked day publishes
      `attendance.correction.approved`; a request is decided on the existing Approvals page with workflows off.
- [ ] **T20**. Shift templates, defaults, assignments, end and expiry job, overlap and linked-attendance rules
      (`templates/`, `assignments/`). Files: `shifts/src/lib/templates/shift-template.service.ts`,
      `shifts/src/lib/templates/shift-template.controller.ts`, `shifts/src/lib/assignments/shift-assignment.service.ts`,
      `shifts/src/lib/assignments/shift-assignment.controller.ts`, `shifts/src/lib/assignments/assignment-expiry.scheduler.ts`.
      Test: FR-57 refusals; delete refused when linked; ended after last linked date.
- [ ] **T21**. Patterns and generation job; bulk assignment with preview (`patterns/`, `assignments/bulk`). Files:
      `shifts/src/lib/patterns/shift-pattern.service.ts`, `shifts/src/lib/patterns/pattern-generation.scheduler.ts`,
      `shifts/src/lib/assignments/bulk-assignment.service.ts`. Test: 4-week rotation; never twice; manual assignment not
      overwritten; per-employee results.
- [ ] **T22**. Shift requests with approval (`SHIFTS_APPROVALS`, fallback core request approval `SHIFT_REQUEST`) and
      bulk decision (`requests/`). Files: `shifts/src/lib/requests/shift-request.service.ts`,
      `shifts/src/lib/requests/shift-request.controller.ts`. Test: default template refused; approval creates
      assignments; cancel removes unlinked ones.
- [ ] **T23**. Working-time rules engine (pure `rules/`) and `/shifts/rules/check`; checks wired into assignments,
      patterns and publish; overrides recorded; a weekly-hours rule without a value reads `employee.reWeeklyLimit`. Files:
      `shifts/src/lib/rules/working-time-rules.ts`, `shifts/src/lib/rules/working-time-rule.controller.ts`,
      `shifts/src/lib/rules/working-time-rule.service.ts`. Test: each rule kind with warn and block; averaged weekly hours;
      weekly limit used per employee.
- [ ] **T24**. Roster read grid and actions (move, swap, copy, split, insert, undo), drafts and publish, conflict
      `409`, `roster_action`, notices (`roster/`). Files: `shifts/src/lib/roster/roster.service.ts`,
      `shifts/src/lib/roster/roster.controller.ts`, `shifts/src/lib/roster/roster-action.service.ts`,
      `shifts/src/lib/roster/roster-publish.service.ts`. Test: split at date; same source and target refused; scope over
      both employees; publish notifies only affected employees.
- [ ] **T25**. Overtime types, overtime on days (daily and weekly, no double count), statements build (single and
      bulk), approve (fallback core request approvals `OVERTIME_REQUEST`, `OVERTIME_STATEMENT`), cancel, correction,
      time-off settlement of lines credited through `TIME_OFF_COMPENSATORY_INTAKE` keyed by employee and work day. Files:
      `attendance/src/lib/overtime/overtime-type.service.ts`, `attendance/src/lib/overtime/overtime-statement.service.ts`,
      `attendance/src/lib/overtime/overtime-statement.controller.ts`, `attendance/src/lib/overtime/overtime-time-off.settlement.ts`.
      Test: caps and excess; one statement per period; one line per date, type, day kind, multiplier and project (two
      shifts of one date with different types or projects give two lines, day and night overtime of one type, day kind
      and project on one date give one line at each multiplier, a rebuild adds none); correction after payment; a work day
      credited once;
      an existing compensatory policy keeps accruing as today with attendance on.
- [ ] **T26**. Ports provided: `PAYROLL_ATTENDANCE` (`AttendancePayrollFactsProvider`, fact keys), `TIME_OFF_ATTENDANCE`
      (`AttendanceTimeOffProvider`), `SHIFTS_ATTENDANCE_ACTUALS`, `SHIFTS_LOCATIONS`, `SHIFTS_COVERAGE`, the shift layer
      for `calendar-and-scheduling` (`registerCalendarLayers`, `CALENDAR_SHIFTS`); bindings in
      `apps/api/src/plugin-composition.ts`. Test: stub consumers; facts stable across rebuilds; payroll close locks days;
      coverage answer matches the targets.
- [ ] **T27**. Outbox events of plan §5 and consumers `subscriber:attendance`, `subscriber:shifts` (time off, payroll,
      workflows, HR; core request-approval settlers). Files: `attendance/src/lib/events/attendance-outbox.ts`,
      `attendance/src/lib/events/attendance.consumer.ts`, `shifts/src/lib/events/shifts-outbox.ts`,
      `shifts/src/lib/events/shifts.consumer.ts`. Test: each consumed event applied once; tolerant of extra payload
      fields.
- [ ] **T28** (parallel). Reminders job through `NOTIFICATION_DISPATCHER` with `dedupeKey` and notification templates.
      Files: `attendance/src/lib/reminders/attendance-reminders.scheduler.ts`,
      `attendance/src/lib/reminders/attendance-notification.templates.ts`. Test: once per shift; preferences honoured.
- [ ] **T29** (parallel). Report definitions FR-95 to FR-100 registered with the report builder. Files:
      `attendance/src/lib/reports/attendance-report.definitions.ts`, `shifts/src/lib/reports/shifts-report.definitions.ts`.
      Test: seeded month totals equal day rows.
- [ ] **T54**. Record types (spec FR-105): attendance days, check-ins, requests, corrections, overtime statements, shift
      assignments, shift requests and open shifts registered as record types for saved views, custom fields, approval
      definitions and automation triggers, each only while its feature is on. Files:
      `attendance/src/lib/record-types/attendance-record-types.ts`, `shifts/src/lib/record-types/shifts-record-types.ts`.
      Test: each record type listed in the saved-view and automation catalogues with the feature on and absent with it
      off; a custom field on a check-in round-trips.
- [ ] **T55**. Change audit (spec FR-110): who, when, before and after for every change of a setting, location, device,
      template, rule, assignment, day override and statement, written as `activity_log` entries (device secrets and PINs
      never logged). Files: `attendance/src/lib/audit/attendance-audit.ts`, `shifts/src/lib/audit/shifts-audit.ts`.
      Test: one entry per change with before and after; a rotated device key logs no secret.

## Phase 3 — UI surfaces

- [ ] **T30**. `packages/plugins/attendance-ui`: My attendance (check-in card, calendar, requests), Days, Check-ins,
      Requests; menu hidden without feature or permission; keys `ATTENDANCE.*` in every locale. Files: `attendance-ui/src/lib/attendance-ui.plugin.ts`,
      `attendance-ui/src/lib/pages/my-attendance/my-attendance-page.component.ts`,
      `attendance-ui/src/lib/pages/days/attendance-days-page.component.ts`,
      `attendance-ui/src/lib/pages/check-ins/check-ins-page.component.ts`,
      `attendance-ui/src/lib/pages/requests/attendance-requests-page.component.ts`. Test: rendering specs; keyboard and
      labels. The Settings and Overtime pages land in T56.
- [ ] **T31**. `packages/plugins/shifts-ui`: Templates, Patterns, Assignments, Requests, Rules, My shifts. Keys
      `SHIFTS.*`. Files: `shifts-ui/src/lib/shifts-ui.plugin.ts`,
      `shifts-ui/src/lib/pages/{templates,patterns,assignments,requests,rules,my-shifts}/` (one page component each).
      Test: rendering specs.
- [ ] **T32**. Roster planner (`shifts-ui/roster`): grid, drag and drop, palette, keyboard mode, coverage and cost rows,
      availability from core `employee_availability` and `availability_slots` (edited through their existing
      services), draft bar, live updates and `409` handling. Files: `shifts-ui/src/lib/roster/roster-planner.component.ts`,
      `shifts-ui/src/lib/roster/roster-cell-dialog.component.ts`, `shifts-ui/src/lib/roster/roster-keyboard.ts`. Test:
      component specs for each action; accessibility audit.
- [ ] **T33** (parallel). Ever Teams contract for the Ever Teams spec `people-self-service`: OpenAPI examples and contract tests for
      check-in, offline batch, own calendar, own roster, open shifts and trades routes and the realtime channels; no
      React package. Test: contract specs pass against the API.
- [ ] **T56**. Attendance settings and overtime pages, beside the pages of T30: Settings (general, locations with map picker,
      devices with key shown once, overtime types) and the Overtime page (requests, statements, bulk build). Files:
      `attendance-ui/src/lib/pages/settings/attendance-settings-page.component.ts`,
      `attendance-ui/src/lib/pages/settings/work-locations-page.component.ts`,
      `attendance-ui/src/lib/pages/settings/attendance-devices-page.component.ts`,
      `attendance-ui/src/lib/pages/settings/overtime-types-page.component.ts`,
      `attendance-ui/src/lib/pages/overtime/overtime-page.component.ts`. Test: rendering specs; the device key is shown
      once; map picker sets coordinates and radius.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T34**. MCP tools `packages/mcp-server/src/lib/tools/attendance.ts`, `shifts.ts` (read tools and
      `attendance_check_in`, `attendance_request_submit` with preview). Test: tool schema spec; permissions honoured.
- [ ] **T35** (parallel). Import templates (templates, assignments, historic days); OpenAPI regenerated; SDK
      regeneration noted. Files: `attendance/src/lib/import/attendance.import-templates.ts`,
      `shifts/src/lib/import/shifts.import-templates.ts`, `packages/core/src/lib/bootstrap/swagger.ts`. Test: import
      per-row errors.
- [ ] **T36**. User docs (Attendance, Shifts, device API), `docs/specs/README.md` row; spec status updated. Test: docs build.
- [ ] **T57**. Kept behaviour (spec FR-111): the timer, time logs, timesheets, availability slots, employee availability,
      appointments, existing reports and MCP tools behave as today with the features on or off, and nothing in the timer
      imports the attendance plugin. Files: `attendance/src/lib/compat/kept-behaviour.spec.ts`,
      `attendance/src/lib/compat/timer-independence.spec.ts`. Test: the existing time-tracking, availability, appointment
      and report suites pass in both modes; the dependency spec finds no import of the attendance or shifts plugins in
      `packages/core/src/lib/time-tracking`.

## Phase 5 — Advanced capabilities

- [ ] **T37**. Exceptions (`exceptions/`): kinds of FR-36, proposals, employee then approver stage, escalation job,
      one-step resolutions, auto-accept rules, auto-close; inbox items through `INBOX_ITEM_WRITER`. Files:
      `attendance/src/lib/exceptions/attendance-exception.service.ts`,
      `attendance/src/lib/exceptions/attendance-exception.controller.ts`,
      `attendance/src/lib/exceptions/exception-escalation.scheduler.ts`. Test: each kind; escalation once; auto-close when
      facts change.
- [ ] **T38**. Exceptions queue page and inbox actions in `attendance-ui`. Files:
      `attendance-ui/src/lib/pages/exceptions/exceptions-queue-page.component.ts`. Test: rendering; one-tap resolution.
- [ ] **T39**. Calendar signals (`ATTENDANCE_CALENDAR_SIGNALS`, fallback core appointments flagged off-site). Files:
      `attendance/src/lib/calendar/calendar-signals.ts`, `attendance/src/lib/days/day-builder.service.ts`. Test: off-site
      hours fill a day without check-ins.
- [ ] **T40**. Kiosk: identify and check-in routes, rotating phone code, badge and PIN with lockout; kiosk page in
      `public-layout-ui`. Files: `attendance/src/lib/kiosk/kiosk.controller.ts`, `attendance/src/lib/kiosk/phone-code.ts`,
      `attendance/src/lib/kiosk/kiosk-pin.service.ts`,
      `packages/plugins/public-layout-ui/src/lib/components/attendance-kiosk/attendance-kiosk-page.component.ts`,
      `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`. Test: lockout after three failures; page shows
      name, direction and time only.
- [ ] **T41**. Offline batches (`/attendance/me/offline-batch`, device batches): original times, max age, clock offset
      correction and flag, late arrival reprocessing. Files: `attendance/src/lib/offline/offline-batch.service.ts`,
      `attendance/src/lib/check-ins/my-attendance.controller.ts`, `attendance/src/lib/device/device-check-in.controller.ts`.
      Test: replay idempotent; skew above 2 minutes corrected.
- [ ] **T42** (parallel). Location purge job and "what was stored about me" view. Files:
      `attendance/src/lib/location/location-purge.scheduler.ts`, `attendance/src/lib/location/my-location-data.controller.ts`,
      `attendance-ui/src/lib/pages/my-attendance/my-location-data.component.ts`. Test: purge after retention.
- [ ] **T43**. Presence board service (check-in states with the existing timer states `isTrackingTime`, `isAway`,
      `lastSeenAt`), realtime channel `attendance:presence:<locationId>` and page. Files:
      `attendance/src/lib/presence/presence-board.service.ts`, `attendance/src/lib/presence/presence-board.realtime.ts`,
      `attendance-ui/src/lib/pages/presence-board/presence-board-page.component.ts`. Test: board changes within 5 s on
      check-in; colleague visibility setting; `GET /employee/working` unchanged.
- [ ] **T44**. Overtime pre-approval requests and automatic approval of matching overtime. Files:
      `attendance/src/lib/requests/overtime-request.service.ts`, `attendance/src/lib/requests/overtime-request.controller.ts`.
      Test: approved hours consumed; excess raises an exception.
- [ ] **T45**. Marketplace: open shifts, volunteer and pick, offers and swaps, eligibility checks, automatic approval
      rules (manager decisions through `SHIFTS_APPROVALS`, fallback core request approval `SHIFT_TRADE`), history,
      expiry job. Files: `shifts/src/lib/marketplace/open-shift.service.ts`, `shifts/src/lib/marketplace/shift-trade.service.ts`,
      `shifts/src/lib/marketplace/trade-eligibility.ts`, `shifts/src/lib/marketplace/marketplace.controller.ts`,
      `shifts/src/lib/marketplace/trade-expiry.scheduler.ts`. Test: ineligible colleagues never offered; safe pickup
      auto-approved; swap creating overtime goes to the manager. The UI pages land in T58.
- [ ] **T46**. Coverage targets and demand forecast (`demand/`) as core operation `SHIFTS_DEMAND_FORECAST`, built-in
      sources and `SHIFTS_DEMAND_SOURCE` adapters bound in `plugin-composition.ts`. Files:
      `shifts/src/lib/demand/coverage-target.service.ts`, `shifts/src/lib/demand/coverage-target.controller.ts`,
      `shifts/src/lib/demand/demand-forecast.operation.ts`, `shifts/src/lib/demand/demand-sources.ts`,
      `apps/api/src/plugin-composition.ts`. Test: contributions sum; confidence bounded; accept into targets; one live
      forecast per location.
- [ ] **T47**. Labour cost through `SHIFTS_LABOUR_COST` (fallback pay rate) in roster rows; stripped without pay
      permission. Files: `shifts/src/lib/cost/labour-cost.service.ts`, `shifts/src/lib/roster/roster.service.ts`. Test:
      multipliers; stripping.
- [ ] **T48**. Roster proposal optimizer (`proposal/`): constraints (availability from core `employee_availability` and
      `availability_slots`; preferences as likes only), fairness, cost, deterministic seed, explanations, partial
      acceptance into drafts; core operation `SHIFTS_ROSTER_PROPOSAL` and page. Files:
      `shifts/src/lib/proposal/roster-optimizer.ts`, `shifts/src/lib/proposal/roster-proposal.operation.ts`,
      `shifts/src/lib/proposal/roster-proposal.controller.ts`,
      `shifts-ui/src/lib/pages/roster-proposal/roster-proposal-page.component.ts`. Test: seeded store reaches target
      coverage with no blocking violation; same seed same result; nothing written before acceptance.
- [ ] **T49**. Write MCP tools (`attendance_exception_resolve`, `attendance_overtime_statements_build`,
      `shifts_roster_propose`, `shifts_roster_accept`, `shifts_trade_propose`, `shifts_demand_forecast`) with preview.
      Files: `packages/mcp-server/src/lib/tools/attendance.ts`, `packages/mcp-server/src/lib/tools/shifts.ts`. Test:
      preview writes nothing; agent actions carry `actorType`.
- [ ] **T50** (parallel). Reports FR-101 to FR-104 and the shift layer in the personal feeds of
      `calendar-and-scheduling`. Files: `attendance/src/lib/reports/attendance-report.definitions.ts`,
      `shifts/src/lib/reports/shifts-report.definitions.ts`, `shifts/src/lib/calendar/shift-calendar-layer.ts`. Test:
      report totals; published shifts appear in the person's feed, drafts do not.
- [ ] **T51**. `MANUFACTURING_BADGES` answered by `AttendanceBadgeService` (badge identity through the `BADGE` external
      id, PIN check with the profile's failure count and lockout, `TERMINAL` device key check), bound in
      `apps/api/src/plugin-composition.ts`. Test: a badge and PIN identify the operator at a station; the third wrong
      PIN locks the profile as at the kiosk; a revoked terminal is refused.
- [ ] **T52**. Default for existing tenants (spec FR-112): the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
      Files: `attendance/src/lib/attendance.features.ts`, `shifts/src/lib/shifts.features.ts`. Test: with the shipped
      default, an existing tenant and a new tenant both have both features off and get no day, reminder or exception;
      with the default for new tenants switched on, a tenant created afterwards gets the features on while a tenant
      created before keeps them off.
- [ ] **T53**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PROJECT_OVERTIME_FACTS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T58**. Marketplace pages over the routes of T45: open shifts to volunteer for or pick up, offers to the pool or named
      colleagues, swap proposals with accept and decline, the shift's trade history. Files:
      `shifts-ui/src/lib/pages/open-shifts/open-shifts-page.component.ts`,
      `shifts-ui/src/lib/pages/trades/shift-trades-page.component.ts`. Test: rendering specs; only eligible colleagues
      offered in the picker; a decision updates the roster view live.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Enabling and settings | T2, T3, T30 |
| FR-2–FR-3 | §3.1 Enabling and settings | T8 |
| FR-4–FR-5 | §3.2 Check-ins | T11 |
| FR-6 | §3.2 Check-ins | T11, T13 |
| FR-7 | §3.2 Check-ins | T10, T11 |
| FR-8 | §3.2 Check-ins | T11, T16 |
| FR-9 | §3.2 Check-ins | T17 |
| FR-10 | §3.2 Check-ins | T17, T56 |
| FR-11 | §3.2 Check-ins | T18 |
| FR-12 | §3.2 Check-ins | T11, T30 |
| FR-13–FR-15 | §3.3 Tracked time and calendar as sources | T13, T14 |
| FR-16 | §3.3 Tracked time and calendar as sources | T14 |
| FR-17 | §3.3 Tracked time and calendar as sources | T14, T19 |
| FR-18 | §3.3 Tracked time and calendar as sources | T39 |
| FR-19 | §3.4 Attendance days | T4, T14 |
| FR-20–FR-23 | §3.4 Attendance days | T16 |
| FR-24 | §3.4 Attendance days | T14, T16 |
| FR-25 | §3.4 Attendance days | T16 |
| FR-26 | §3.4 Attendance days | T30 |
| FR-27–FR-28 | §3.4 Attendance days | T9, T14 |
| FR-29–FR-30 | §3.5 Automatic attendance and exceptions | T9, T14 |
| FR-31–FR-32 | §3.5 Automatic attendance and exceptions | T15 |
| FR-33–FR-35 | §3.5 Automatic attendance and exceptions | T9, T14 |
| FR-36 | §3.5 Automatic attendance and exceptions | T37 |
| FR-37 | §3.5 Automatic attendance and exceptions | T37, T38 |
| FR-38–FR-39 | §3.5 Automatic attendance and exceptions | T37 |
| FR-40–FR-45 | §3.6 Requests and corrections | T19 |
| FR-46 | §3.7 Locations, privacy, kiosks and offline | T8, T12, T56 |
| FR-47 | §3.7 Locations, privacy, kiosks and offline | T8, T14 |
| FR-48 | §3.7 Locations, privacy, kiosks and offline | T12 |
| FR-49 | §3.7 Locations, privacy, kiosks and offline | T12, T42 |
| FR-50 | §3.7 Locations, privacy, kiosks and offline | T12 |
| FR-51 | §3.7 Locations, privacy, kiosks and offline | T40 |
| FR-52 | §3.7 Locations, privacy, kiosks and offline | T41 |
| FR-53 | §3.7 Locations, privacy, kiosks and offline | T14, T41 |
| FR-54 | §3.7 Locations, privacy, kiosks and offline | T43 |
| FR-55 | §3.7 Locations, privacy, kiosks and offline | T28 |
| FR-56 | §3.8 Shift templates and assignments | T20, T31 |
| FR-57 | §3.8 Shift templates and assignments | T10, T20 |
| FR-58–FR-59 | §3.8 Shift templates and assignments | T20, T31 |
| FR-60 | §3.8 Shift templates and assignments | T10, T20 |
| FR-61 | §3.8 Shift templates and assignments | T20 |
| FR-62 | §3.8 Shift templates and assignments | T21, T31 |
| FR-63 | §3.8 Shift templates and assignments | T21, T22 |
| FR-64 | §3.8 Shift templates and assignments | T22 |
| FR-65 | §3.9 Roster and working-time rules | T24, T32 |
| FR-66 | §3.9 Roster and working-time rules | T24, T32 |
| FR-67 | §3.9 Roster and working-time rules | T32 |
| FR-68 | §3.9 Roster and working-time rules | T24 |
| FR-69 | §3.9 Roster and working-time rules | T24, T32 |
| FR-70 | §3.9 Roster and working-time rules | T24 |
| FR-71 | §3.9 Roster and working-time rules | T26, T31, T33, T50 |
| FR-72 | §3.9 Roster and working-time rules | T32 |
| FR-73–FR-74 | §3.9 Roster and working-time rules | T23 |
| FR-75–FR-78 | §3.10 Shift marketplace, demand and proposals | T45, T58 |
| FR-79 | §3.10 Shift marketplace, demand and proposals | T26, T46 |
| FR-80 | §3.10 Shift marketplace, demand and proposals | T46 |
| FR-81–FR-82 | §3.10 Shift marketplace, demand and proposals | T48 |
| FR-83 | §3.10 Shift marketplace, demand and proposals | T47 |
| FR-84 | §3.11 Overtime, compensatory time off and payroll | T25, T56 |
| FR-85 | §3.11 Overtime, compensatory time off and payroll | T9, T14, T25 |
| FR-86 | §3.11 Overtime, compensatory time off and payroll | T44 |
| FR-87–FR-89 | §3.11 Overtime, compensatory time off and payroll | T25 |
| FR-90 | §3.11 Overtime, compensatory time off and payroll | T25, T26 |
| FR-91 | §3.11 Overtime, compensatory time off and payroll | T25 |
| FR-92–FR-93 | §3.11 Overtime, compensatory time off and payroll | T26 |
| FR-94 | §3.11 Overtime, compensatory time off and payroll | T16, T26 |
| FR-95–FR-100 | §3.12 Reports | T29 |
| FR-101–FR-104 | §3.12 Reports | T50 |
| FR-105 | §3.13 API, agents and compatibility | T54 |
| FR-106 | §3.13 API, agents and compatibility | T27 |
| FR-107 | §3.13 API, agents and compatibility | T34, T49 |
| FR-108 | §3.13 API, agents and compatibility | T18, T35 |
| FR-109 | §3.13 API, agents and compatibility | T7 |
| FR-110 | §3.13 API, agents and compatibility | T55 |
| FR-111 | §3.13 API, agents and compatibility | T57 |
| FR-112 | §3.13 API, agents and compatibility | T25, T52 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag defaults stay off; enabling them in dev shows attendance and shifts end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Existing timer, time-log, timesheet, availability, appointment and report suites pass unchanged with the features on
  and off.
- A seeded month: zero-marking days from tracked time and check-ins, exceptions resolved in one step, roster published
  with notices, overtime statements reaching payroll once, reports matching the day rows.
- Raw coordinates absent from storage unless opted in; device replay and offline replay change nothing.
