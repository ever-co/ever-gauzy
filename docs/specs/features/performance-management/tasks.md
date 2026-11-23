# Task Breakdown: Performance management

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `performance-management`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Every controller, page, job, consumer and tool checks `FEATURE_PERFORMANCE_REVIEWS`.
- Prerequisite: the formula language of `custom-fields-and-forms` (`packages/utils/src/lib/formula/`) before T25.
- Paths are relative to `packages/plugins/performance-reviews/src/lib/` unless they start with `packages/` or
  `apps/`; `ui/` means `packages/plugins/performance-reviews-ui/src/lib/`. Each entity has its MikroORM repository
  beside it in `repository/`; migrations go to `database/migrations/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/performance.model.ts` (interfaces, enums, score and evidence
      shapes, formula variables, event payloads, ports of plan §3); `RuleOwnerType.REVIEW_CYCLE`;
      `ApprovalPolicyTypesStringEnum.BONUS_PROPOSAL`; export from `index.ts`. Files also:
      `packages/contracts/src/lib/rule.model.ts`, `packages/contracts/src/lib/approval-policy.model.ts`. Test: type spec
      compiles against sample payloads.
- [ ] **T2**. Plugin scaffold `packages/plugins/performance-reviews` (package, project, tsconfig, jest, eslint, path
      mapping), `performance-reviews.plugin.ts`, `performance-reviews.features.ts` (`FEATURE_PERFORMANCE_REVIEWS`,
      default off), `performance-reviews.permissions.ts` (seven keys with `defaultFor` of plan §9); registered in
      `apps/api/src/plugins.ts`. Test: plugin list spec; routes answer `404` with the feature off; a newly provisioned
      tenant's roles hold the defaults.
- [ ] **T3**. Migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
      `database/migrations/1791000027100-CreatePerformanceSetupTables.ts` and
      `database/migrations/1791000027110-CreateGoalPerformanceTables.ts` + entities and MikroORM repositories
      `setup/focus-area.entity.ts`, `setup/rating-criterion.entity.ts`, `setup/rating-scale.entity.ts`,
      `templates/review-template.entity.ts`, `templates/review-template-position.entity.ts`,
      `goals/goal-performance.entity.ts`, `goals/key-result-rollup.entity.ts`, `goals/key-result-metric.entity.ts`. Test:
      migration specs on SQLite (up twice is a no-op); cascade from `goal` and `key_result` deletes side rows.
- [ ] **T4** (parallel). Migrations `CreateReviewCycleTables`, `CreateCalibrationAndBonusTables` + entities. Files:
      `database/migrations/1791000027120-CreateReviewCycleTables.ts`,
      `database/migrations/1791000027130-CreateCalibrationAndBonusTables.ts`, `cycles/review-cycle.entity.ts`,
      `cycles/review-participant.entity.ts`, `reviews/review.entity.ts`, `reviews/review-focus-area-score.entity.ts`,
      `reviews/review-response.entity.ts`, `reviews/review-rating.entity.ts`, `development/development-area.entity.ts`,
      `calibration/calibration-session.entity.ts`, `calibration/calibration-change.entity.ts`,
      `bonus/bonus-proposal.entity.ts`. Test: migration specs; `liveKey` and `(cycleId, employeeId)` uniqueness on all
      three dialects.
- [ ] **T5** (parallel). Migrations `CreateFeedbackAndOneOnOneTables` (feedback notes and requests, one-to-one private
      notes), `CreatePerformanceAssistantTables` + entities. Files:
      `database/migrations/1791000027140-CreateFeedbackAndOneOnOneTables.ts`,
      `database/migrations/1791000027150-CreatePerformanceAssistantTables.ts`, `feedback/feedback-note.entity.ts`,
      `feedback/feedback-request.entity.ts`, `one-on-ones/one-on-one-note.entity.ts`,
      `assistant/review-assistant-draft.entity.ts`. Test: migration specs.
- [ ] **T6**. Settings contributions `performance-reviews.settings.ts` (keys of plan §3.1) read through the platform
      settings store; `/performance/settings` over them. Files also: `settings/performance-settings.controller.ts`.
      Test: defaults resolve; organization values win; no settings table exists.
- [ ] **T7**. Ports in `src/lib/ports/` (`HR_REPORTING_LINE`, `HR_DIRECTORY`, `PERFORMANCE_SKILL_RATINGS`,
      `PERFORMANCE_LEARNING`, `PERFORMANCE_RECOGNITIONS`, `PERFORMANCE_APPROVALS`, `PAYROLL_ADDITIONAL_PAY`,
      `PERFORMANCE_CALENDAR`, `PERFORMANCE_MEETINGS`, `PERFORMANCE_ASSISTANT`, `PERFORMANCE_PRINT`, `REPORT_RUNS`,
      `NOTIFICATION_DISPATCHER`, multi-provider `PERFORMANCE_METRIC_SOURCE`) with their fallbacks; provided
      `PERFORMANCE_TEMPLATES`; bindings in `apps/api/src/plugin-composition.ts`. Files: `ports/performance.ports.ts`,
      `ports/performance-port-fallbacks.ts`. Test: services run with every consumed port unbound.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Focus areas, criteria and scales with bands; deactivation instead of delete when used; first-enable
      seeding of spec FR-68. Files: `setup/focus-area.service.ts`, `setup/rating-criterion.service.ts`,
      `setup/rating-scale.service.ts`, `setup/performance-setup.controller.ts`, `setup/performance-first-enable.service.ts`.
      Test: unit; second enable adds nothing; existing goals untouched; a used scale is deactivated, not deleted.
- [ ] **T9**. Goal side table service and `/performance/goals/:goalId`: focus area, cycle, start date defaulted from the
      goal's time frame (end date read from `goal.deadline`), state derivation, progress cap for roll-ups, alignment
      cycle marking and the strict-alignment setting. Files: `goals/goal-performance.service.ts`,
      `goals/goal-performance.controller.ts`, `goals/goal-state.ts`. Test: unit; with the setting off a cycle is saved,
      marked and left out of roll-up; with it on the cycle is refused; no second end date stored.
- [ ] **T10**. Roll-up consumer: walk alignments upward with a visited set, recompute roll-up key results, file updates
      through `KeyResultUpdateService.create` under the system-actor request context; task key results follow task
      status changes. Files: `goals/rollup.consumer.ts`, `goals/rollup.service.ts`, `goals/task-key-result.handler.ts`;
      core `packages/core/src/lib/keyresult-update/keyresult-update.service.ts` used unchanged. Test: SQLite end-to-end
      from a child update to the organization goal; replay changes nothing twice.
- [ ] **T11**. Goal tree read model (lazy, filters) and check-in reminder sweep through `NOTIFICATION_DISPATCHER` with
      de-duplication keys. Files: `goals/goal-tree.service.ts`, `goals/goal-tree.controller.ts`,
      `goals/check-in-reminder.job.ts`. Test: 5,000-goal fixture first level within budget; reminder once per key result
      and period.
- [ ] **T12**. Outbox events of plan §5, consumer `subscriber:performance-reviews` (core goal and task changes, HR
      placement and separation, approval decisions), real-time hints. Files: `events/performance.events.ts`,
      `events/performance.consumer.ts`. Test: replayed deliveries change nothing twice.
- [ ] **T13**. Record types (`registerRecordTypes`) for cycles, reviews, responses, sessions and feedback notes. Files:
      `performance.record-types.ts`. Test: saved view lists reviews by step.
- [ ] **T14**. Goal progress dataset and definition (`registerReportDatasets`, `registerReportDefinitions`) with
      cards. Files: `reports/goal-progress.dataset.ts`, `reports/goal-progress.report.ts`. Test: figures agree with
      seeded goals.
- [ ] **T43**. Core UI: slot ids `GOAL_FORM_FIELDS` and `KEY_RESULT_FORM_FIELDS` in
      `packages/plugin-ui/src/lib/plugin-extension/page-extension-slot.types.ts`, rendered in
      `apps/gauzy/src/app/pages/goals/edit-objective` and `edit-keyresults`, each extension receiving the saved goal or
      key result after the dialog's own save. Files also: `apps/gauzy/src/app/pages/goals/edit-objective/edit-objective.component.ts`,
      `apps/gauzy/src/app/pages/goals/edit-keyresults/edit-keyresults.component.ts`. Test: existing dialog specs pass
      unchanged; an extension field renders and saves after the goal; no plugin loaded shows today's dialogs.

## Phase 3 — UI surfaces

- [ ] **T15**. Angular plugin scaffold `packages/plugins/performance-reviews-ui`, registered in
      `apps/gauzy/src/plugin-ui.config.ts`, routes through `goals-sections`; `PERFORMANCE.*` keys in every locale.
      Files: `ui/performance-reviews-ui.plugin.ts`, `ui/performance.routes.ts`, `packages/ui-core/i18n/assets/i18n/*.json`.
      Test: plugin spec; menu hidden without the feature.
- [ ] **T16**. Goal tree page and the focus area, cycle, roll-up fields registered in the goal dialogs' slots
      `GOAL_FORM_FIELDS` and `KEY_RESULT_FORM_FIELDS` (after T43), rendered only with the feature on. Files:
      `ui/goals/goal-tree.component.ts`, `ui/goals/goal-form-fields.component.ts`,
      `ui/goals/key-result-form-fields.component.ts`. Test: rendering specs; existing dialogs unchanged without the
      plugin and with the feature off.
- [ ] **T17**. Goal reports child route in `apps/gauzy/src/app/pages/pages.routes.ts`: plugin page when registered and
      `FEATURE_PERFORMANCE_REVIEWS` and `FEATURE_GOAL_REPORT` are on, `WorkInProgressModule` otherwise. Files also:
      `ui/reports/goal-reports.component.ts`. Test: route spec for both cases; with `FEATURE_GOAL_REPORT` on and the
      performance feature off the existing goal reports page stays.
- [ ] **T18** (parallel). Settings pages (focus areas, criteria, scales and bands). Files:
      `ui/settings/focus-areas.component.ts`, `ui/settings/criteria.component.ts`, `ui/settings/scales.component.ts`,
      `ui/services/performance-api.service.ts`. Test: rendering specs.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T19**. Read MCP tools in `packages/mcp-server/src/lib/tools/performance.ts` (`performance_cycles_list`,
      `performance_cycle_progress`, `performance_review_get`, `performance_goal_tree`), registered in
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: input-schema spec; review shaped by the caller;
      `goals.ts` and `key-results.ts` tools unchanged.
- [ ] **T20**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries for `performance.*` events. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `performance.*` events.
- [ ] **T21**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Depth

- [ ] **T22**. Templates: weights validation, questions in the question-set format of `custom-fields-and-forms` (its T63), response kinds, position and level
      defaults, snapshot on review creation, `PERFORMANCE_TEMPLATES` provider. Files: `templates/review-template.service.ts`,
      `templates/review-template.controller.ts`, `templates/template-weights.validator.ts`,
      `templates/performance-templates.provider.ts`. Test: weights not totalling 100 refused; snapshot unchanged after
      template edit; answers validated against the snapshot's field types.
- [ ] **T23**. Cycles: selection as core `rule` rows (`REVIEW_CYCLE`) over the employee context, selection preview,
      launch as core operation `PERFORMANCE_LAUNCH` (steps, per-employee results, resumable), manager from
      `HR_REPORTING_LINE`, duplicate refusal, add and remove with reason, status machine, locks of FR-24. Files:
      `cycles/review-cycle.service.ts`, `cycles/review-cycle.controller.ts`, `cycles/cycle-selection.ts`,
      `cycles/launch.operation.ts`. Test: 10,000-employee SQLite fixture launches within budget; agents and leavers
      excluded; a second launch joins the live operation.
- [ ] **T24**. Responses: self review, nominations with manager approval, requests, peer, upward and manager responses
      with guards (no self feedback, one per kind), decline, withdraw, locks, history. Files:
      `reviews/review.service.ts`, `reviews/review.controller.ts`, `reviews/review-response.service.ts`,
      `reviews/nomination.service.ts`. Test: unit and e2e.
- [ ] **T25**. Scoring engine (`src/lib/scoring/`): focus area completion, manual ratings, weighted scores, kind
      weights renormalized, competency ratings converted from the 1–5 proficiency scale to the review scale, formula
      compile and evaluate with the platform formula language, bands, freeze on manager submit. Files:
      `scoring/scoring-engine.ts`, `scoring/competency-conversion.ts`, `scoring/score-formula.ts`,
      `scoring/score-recompute.service.ts`. Test: golden tables for automatic, manual and custom formula; competency
      conversion golden values; invalid formula refused.
- [ ] **T26**. Cycle progress (counts, gaps, overdue), bulk reminders, leavers sweep, close guard. Files:
      `cycles/cycle-progress.service.ts`, `cycles/leavers.job.ts`, `cycles/cycle-close.guard.ts`. Test: unit; a leaver's
      review closes as incomplete and leaves the averages.
- [ ] **T27**. Release as core operation `PERFORMANCE_RELEASE`, visibility per cycle, acknowledgement, competency
      ratings through `PERFORMANCE_SKILL_RATINGS` (1–5 unchanged), recognitions evidence through
      `PERFORMANCE_RECOGNITIONS`. Files: `cycles/release.operation.ts`, `reviews/acknowledgement.service.ts`,
      `reviews/review-evidence.service.ts`. Test: SQLite end-to-end from launch to acknowledged review.
- [ ] **T28** (parallel). Anonymity shaping (unattributed responses, minimum answers) in every surface. Files:
      `reviews/review-shaper.ts`. Test: contract tests per surface; reviewer id never in the employee's payloads.
- [ ] **T29**. Report datasets and definitions for spec §3.11, charts, cards, dashboard template, group-size
      suppression. Files: `reports/performance-report-datasets.ts`, `reports/performance-report-definitions.ts`,
      `reports/group-size-suppression.ts`. Test: figures agree with seeded data.
- [ ] **T30**. UI: cycles (editor with the platform condition builder for selection, progress), review page (self,
      nominations, responses, manager review, evidence, scores), my reviews and team reviews, release and
      acknowledgement. Files: `ui/cycles/cycle-editor.component.ts`, `ui/cycles/cycle-progress.component.ts`,
      `ui/reviews/review-page.component.ts`, `ui/reviews/review-list.component.ts`,
      `ui/reviews/rating-control.component.ts`. Test: rendering specs; keyboard rating controls.
- [ ] **T31** (parallel). My review and respond-to-request pages laid out for phone width. Files:
      `ui/reviews/review-page.component.scss`, `ui/reviews/respond-request.component.ts`. Test: rendering specs at
      phone width.
- [ ] **T32** (parallel). Print template for the review summary and cycle export; import profiles. Files:
      `print/review-summary.print-template.ts`, `cycles/cycle-export.service.ts`, `import/performance-import-profiles.ts`.
      Test: PDF snapshot; per-row import errors.
- [ ] **T44**. Core request approval for bonus proposals: decision gate for `BONUS_PROPOSAL` in
      `request-approval/linked-document-decision.gate.ts` and the plugin's settler through the core request-approval
      settler registry (`approval-workflows` T53). Files: `packages/core/src/lib/request-approval/linked-document-decision.gate.ts`,
      `bonus/bonus-proposal-request-approval.settler.ts`. Test: existing request-approval suites green; a proposal
      decided on the Approvals page moves to approved or rejected on the same transaction.
- [ ] **T45**. Change history: who, when, before and after for every change of a template, cycle, review score or
      point, response and calibration decision, written to the core activity log from the services of T22 to T27.
      Files: `history/performance-history.subscriber.ts`. Test: `performance-history.subscriber.spec.ts`: a template
      weight change and a manager point change each leave one entry with the before and after values and the actor.

## Phase 6 — Advanced capabilities

- [ ] **T33**. Metric bindings: providers for tracked hours (approved time logs), tasks done, deals won, invoiced and
      paid, report measures through `REPORT_RUNS`; refresh as core operation `PERFORMANCE_METRICS` with event
      coalescing; `SOURCE_UNAVAILABLE` state. Files: `metrics/key-result-metric.service.ts`,
      `metrics/key-result-metric.controller.ts`, `metrics/metrics-refresh.operation.ts`, `metrics/providers/`. Test:
      golden values per metric; unloaded source keeps the last value.
- [ ] **T34**. Continuous feedback notes (suggestion, note) and requests with visibility; praise written as a
      recognition entry through `PERFORMANCE_RECOGNITIONS`; both as evidence on reviews. Files:
      `feedback/feedback.service.ts`, `feedback/feedback.controller.ts`. Test: manager-only notes never shown to the
      receiver; praise appears in the receiver's recognitions; praise hidden with the port unbound.
- [ ] **T35**. One-to-ones: series as recurring events through `PERFORMANCE_CALENDAR`, agenda and shared notes through
      `PERFORMANCE_MEETINGS` (carried items, action items as tasks), agenda source registered with
      `registerMeetingAgendaSources` for suggestions, private notes in `one_on_one_note`. Files:
      `one-on-ones/one-on-one.service.ts`, `one-on-ones/one-on-one.controller.ts`, `one-on-ones/agenda-suggestions.source.ts`.
      Test: unit; carried item appears once; a private note is never returned to the other side; page hidden without
      the two plugins.
- [ ] **T36**. Calibration sessions: scope, distribution against guidance with tolerance warnings, performance and
      potential grid, changes with reasons, self-review exclusion. Files: `calibration/calibration.service.ts`,
      `calibration/calibration.controller.ts`, `calibration/distribution.ts`. Test: unit; computed scores unchanged.
- [ ] **T37**. Development areas and learning assignment through `PERFORMANCE_LEARNING` with progress read. Files:
      `development/development-area.service.ts`. Test: assignment recorded; progress shown with the port bound.
- [ ] **T38**. Bonus matrix, proposals on release, approval through `PERFORMANCE_APPROVALS` (workflows, else core
      request approval `BONUS_PROPOSAL` with the decision gate and settler of T44), incentives through
      `PAYROLL_ADDITIONAL_PAY`. Files: `bonus/bonus-proposal.service.ts`, `bonus/bonus-proposal.controller.ts`,
      `bonus/bonus-matrix.ts`. Test: approved proposal sent once in both modes; rejected never sent; the requester
      cannot approve.
- [ ] **T39**. Review assistant on the agent runtime (`aiRunId` on drafts): evidence assembly, draft with source links,
      bias flags on drafts and written summaries; no write path to points. Files: `assistant/review-assistant.service.ts`,
      `assistant/bias-flags.ts`. Test: payload contains only the review's evidence; seeded biased phrase flagged.
- [ ] **T40**. UI for phase 6: metric binding dialog, feedback and praise, one-to-ones, calibration board with grid,
      assistant panel. Files: `ui/goals/metric-binding-dialog.component.ts`, `ui/feedback/feedback.component.ts`,
      `ui/one-on-ones/one-on-ones.component.ts`, `ui/calibration/calibration-board.component.ts`,
      `ui/reviews/assistant-panel.component.ts`. Test: rendering specs; grid table alternative.
- [ ] **T41**. Mutating MCP tools (`performance_cycle_launch`, `performance_feedback_request`,
      `performance_feedback_give`, `performance_response_submit`, `performance_summary_draft`,
      `performance_key_result_bind_metric`) with `preview` defaults, marked as agent actions. Files:
      `packages/mcp-server/src/lib/tools/performance.ts`. Test: preview writes nothing.
- [ ] **T42**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-3 | §3.1 Focus areas, rating criteria and scales | T8, T18 |
| FR-4 | §3.1 Focus areas, rating criteria and scales | T8, T18 |
| FR-5 | §3.2 Review templates | T22 |
| FR-6 | §3.2 Review templates | T22 |
| FR-7–FR-8 | §3.2 Review templates | T22 |
| FR-9 | §3.3 Goals and key results with roll-up | T9, T16 |
| FR-10 | §3.3 Goals and key results with roll-up | T9 |
| FR-11 | §3.3 Goals and key results with roll-up | T10 |
| FR-12 | §3.3 Goals and key results with roll-up | T9 |
| FR-13 | §3.3 Goals and key results with roll-up | T10 |
| FR-14 | §3.3 Goals and key results with roll-up | T10 |
| FR-15 | §3.3 Goals and key results with roll-up | T33 |
| FR-16 | §3.3 Goals and key results with roll-up | T11, T16 |
| FR-17 | §3.3 Goals and key results with roll-up | T11 |
| FR-18 | §3.3 Goals and key results with roll-up | T10, T12, T16 |
| FR-19 | §3.4 Review cycles | T23 |
| FR-20–FR-24 | §3.4 Review cycles | T23 |
| FR-25 | §3.4 Review cycles | T26 |
| FR-26–FR-27 | §3.4 Review cycles | T26 |
| FR-28–FR-31 | §3.5 Reviews and responses | T24 |
| FR-32 | §3.5 Reviews and responses | T25, T30 |
| FR-33 | §3.5 Reviews and responses | T24, T25 |
| FR-34–FR-35 | §3.6 Scoring | T25 |
| FR-36 | §3.6 Scoring | T25 |
| FR-37–FR-38 | §3.6 Scoring | T25 |
| FR-39 | §3.7 Competencies and development | T25, T27 |
| FR-40 | §3.7 Competencies and development | T37 |
| FR-41 | §3.7 Competencies and development | T27 |
| FR-42–FR-44 | §3.8 Calibration and release | T36 |
| FR-45 | §3.8 Calibration and release | T27 |
| FR-46 | §3.8 Calibration and release | T27, T30 |
| FR-47 | §3.8 Calibration and release | T38, T44 |
| FR-48–FR-49 | §3.9 Continuous feedback, one-to-ones and recognition | T34 |
| FR-50 | §3.9 Continuous feedback, one-to-ones and recognition | T35 |
| FR-51 | §3.9 Continuous feedback, one-to-ones and recognition | T35 |
| FR-52 | §3.9 Continuous feedback, one-to-ones and recognition | T34 |
| FR-53–FR-55 | §3.10 Review assistant | T39 |
| FR-56–FR-58 | §3.11 Reports and dashboards | T29 |
| FR-59 | §3.11 Reports and dashboards | T14 |
| FR-60–FR-63 | §3.11 Reports and dashboards | T29 |
| FR-64 | §3.11 Reports and dashboards | T17 |
| FR-65 | §3.12 API, agents, setup and compatibility | T13 |
| FR-66 | §3.12 API, agents, setup and compatibility | T12 |
| FR-67 | §3.12 API, agents, setup and compatibility | T19, T41 |
| FR-68 | §3.12 API, agents, setup and compatibility | T8 |
| FR-69 | §3.12 API, agents, setup and compatibility | T2 |
| FR-70 | §3.12 API, agents, setup and compatibility | T32 |
| FR-71 | §3.12 API, agents, setup and compatibility | T2, T16, T17, T43 |
| FR-72 | §3.12 API, agents, setup and compatibility | T45 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Existing goal, key result, KPI, template, time frame and settings suites and the goals MCP tools pass unchanged with
  the feature on and off.
- Scoring goldens and anonymity contract tests green.
- Every acceptance criterion of `spec.md` §7 has a named test.
