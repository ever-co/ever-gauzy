# Task Breakdown: HR core and employee lifecycle

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `hr-core-lifecycle`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `hr/` = `packages/plugins/hr-lifecycle/src/lib/`, `hrui/` = `packages/plugins/hr-lifecycle-ui/src/lib/`,
  `core/` = `packages/core/src/lib/`. Plugin migration timestamps follow the order of plan §3 Migrations from
  `1791000095100`; core ones from `1791000095900`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/hr-lifecycle.model.ts` (interfaces, enums, DTO and preview
      shapes, event payloads, port interfaces of plan §3) and the optional fields on `IEmployee`,
      `IOrganizationDepartment`, `IOrganizationPosition`, `IEmployeeLevel`; export from `packages/contracts/src/index.ts`.
      Test: type spec compiles against sample payloads.
- [ ] **T2**. Core: properties on `core/employee/employee.entity.ts`,
      `core/organization-department/organization-department.entity.ts`,
      `core/organization-position/organization-position.entity.ts`, `core/employee-level/employee-level.entity.ts` and
      `core/employee-phone/employee-phone.entity.ts` (`hrGroup`); core migrations
      `core/database/migrations/1791000095900-AddEmployeeHrStructureColumns.ts` and
      `core/database/migrations/1791000095910-BackfillEmployeeLevelReference.ts` (three dialects); enum
      values `AddressOwnerType.EMPLOYEE` / `BRANCH` (`packages/contracts/src/lib/address.model.ts`),
      `AddressRoleEnum.CURRENT` / `PERMANENT` (`core/address-role/address-role.enums.ts`, with the owner-type refusal
      for `EMPLOYEE` on the generic address routes in `core/address/address.service.ts`),
      `RuleOwnerType.EMPLOYEE_GROUP` / `LIFECYCLE_TEMPLATE` / `HR_DOCUMENT_TYPE` (`packages/contracts/src/lib/rule.model.ts`),
      `ApprovalPolicyTypesStringEnum.HR_EVENT` (`packages/contracts/src/lib/approval-policy.model.ts`); optional ports
      `MANAGED_EMPLOYEE_SOURCES` in `core/employee/managed-employee.service.ts` and `EMPLOYEE_RATE_CHANGE_HANDLER` in
      `core/employee/rate-change-request/rate-change-request.service.ts`. Test:
      migration spec on SQLite (up twice is a no-op); core DTO whitelist spec proves core routes ignore the fields;
      existing address, managed-employee and rate-change suites green with the ports unbound. Migration timestamps: `1791000095100` to `1791000095199` (`packages/plugins/hr-lifecycle`); `1791000095900` to `1791000095999` (`packages/core`).
- [ ] **T3**. Plugin scaffold `packages/plugins/hr-lifecycle` (package, project, tsconfig, jest, eslint, path
      mapping), `hr/hr-lifecycle.plugin.ts`, `hr/hr-lifecycle.module.ts`, `hr/hr-lifecycle.features.ts`
      (`FEATURE_HR_LIFECYCLE`, default off), `hr/hr-lifecycle.permissions.ts` (eighteen keys),
      `hr/hr-lifecycle.settings.ts`; registered in `apps/api/src/plugins.ts`.
      Test: plugin list spec; routes answer `404` with the feature off.
- [ ] **T4**. Migration `hr/database/migrations/1791000095100-CreateHrRecordTables.ts` on the shared core migration
      helpers of `procurement` T4 (`@gauzy/core`) + entities and MikroORM repositories in `hr/entities/`
      (`organization-branch.entity.ts` without address columns, `employee-hr-profile.entity.ts`,
      `employee-personal-detail.entity.ts` without names of `user`, phones or addresses,
      `employee-emergency-contact.entity.ts`, `employee-education.entity.ts`, `employee-previous-employment.entity.ts`,
      `employee-external-id.entity.ts`, `employee-group.entity.ts`, `employee-group-member.entity.ts`,
      `hr-approver.entity.ts`, `hr-position-skill.entity.ts`, `employee-skill-rating.entity.ts`). Test: migration spec
      on SQLite; repository smoke specs for both ORMs.
- [ ] **T5** (parallel). Migrations `hr/database/migrations/1791000095110-CreateHrEventTables.ts`,
      `hr/database/migrations/1791000095120-CreateHrLifecycleTables.ts` (activity details on core
      `task_template_task` of `project-costing-and-billing` T60, processes, questionnaire versions, exit interviews) +
      entities `hr/entities/hr-event.entity.ts`, `hr-event-change.entity.ts`, `lifecycle-template-activity.entity.ts`,
      `lifecycle-process.entity.ts`, `lifecycle-activity.entity.ts`, `separation.entity.ts`,
      `hr-questionnaire-version.entity.ts`, `exit-interview.entity.ts`, `onboarding-question.entity.ts`. Test: migration
      specs; `liveKey` uniqueness on all three dialects.
- [ ] **T6** (parallel). Migrations `hr/database/migrations/1791000095130-CreateHrGrievanceAndSettlementTables.ts`,
      `1791000095140-CreateHrDocumentTables.ts`, `1791000095150-CreateHrChartTables.ts` + entities
      `hr/entities/grievance-type.entity.ts`, `grievance.entity.ts`, `final-settlement.entity.ts`,
      `final-settlement-line.entity.ts`, `hr-document-type.entity.ts`, `employee-document.entity.ts`,
      `signature-request.entity.ts`, `signature-signer.entity.ts`, `employment-contract.entity.ts`,
      `reorg-scenario.entity.ts`, `hr-headcount-snapshot.entity.ts`. Test: migration specs.
- [ ] **T7**. Permission, feature and setting contributions with `defaultFor` (plan §9 grants); no seed migration.
      Files: `hr/hr-lifecycle.permissions.ts`, `hr/hr-lifecycle.features.ts`, `hr/hr-lifecycle.settings.ts`. Test:
      grants present for super admin, admin, manager and employee from the contributions.
- [ ] **T8**. Ports in `hr/ports/` (`hr-provided-ports.ts`, `hr-consumed-ports.ts`): provided (`HR_REPORTING_LINE`,
      `HR_APPROVER_RESOLVER`, `HR_ACTIVE_EMPLOYEE_CHECK`, `HR_DIRECTORY`, `HR_EMPLOYEE_RULE_CONTEXT`, `HR_SIGNATURES`, the
      core `MANAGED_EMPLOYEE_SOURCES` and `EMPLOYEE_RATE_CHANGE_HANDLER` bindings) and consumed (`HR_WORKING_CALENDAR`,
      `HR_AUTOMATION_ACTIONS`, `HR_APPROVALS`, `HR_ASSISTANT`, `HR_PRINT`, `HR_PAYROLL_HANDOFF`, `HR_CUSTODY`,
      `PARTY_BANK_ACCOUNTS`, `REMINDERS`, `NOTIFICATION_DISPATCHER`, multi-provider `HR_SETTLEMENT_SOURCE`) with no-op
      defaults; bindings in `apps/api/src/plugin-composition.ts`. Test: services run with every consumed port unbound.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Privacy (`hr/privacy/`): `@VisibleWith` on every sensitive field per group key (`hr-field-groups.ts`),
      default `access_field_rule` contributions (`hr-field-access.contributions.ts`), one `AUDIT_EVENT_SINK` event per
      employee and group read by someone else (REST, GraphQL, export, MCP surfaces; `sensitive-read-audit.interceptor.ts`),
      `EncryptionService` wrapper with `last4` for identity numbers (`identity-number.crypto.ts`). Test: unit per group
      and surface (field absent without the key); one audit event per read; numbers never appear in logs.
- [ ] **T10**. Settings over the settings store (`/hr/settings`, `hr.*` keys), numbering modes on core `sequence`.
      Files: `hr/settings/hr-settings.controller.ts`, `hr/settings/hr-settings.service.ts`,
      `hr/employees/employee-numbering.service.ts`. Test: series numbers unique and never reused; mode change does not
      renumber.
- [ ] **T11**. Employee record service and controller: list and read with HR columns, placement and profile writes
      (as `CORRECTION` events), validation of FR-3, level label sync, retirement suggestion, legal name defaulting from
      `user`. Files: `hr/employees/hr-employee.service.ts`, `hr/employees/hr-employee.controller.ts`,
      `hr/employees/dto/hr-placement.dto.ts`, `hr/employees/dto/hr-profile.dto.ts`, `hr/employees/employee-level-sync.ts`.
      Test: unit and e2e; editing the user name leaves the legal name.
- [ ] **T12**. Reporting line: cycle and self guards, cross-organization setting, `hrPath` maintenance, chain and
      reports reads, `HR_REPORTING_LINE` provider, `MANAGED_EMPLOYEE_SOURCES` binding (HR reads always; employee lists
      and time screens only while `hr.reportingLineInManagerScope` is on). Files:
      `hr/reporting-line/reporting-line.service.ts`, `hr/reporting-line/reporting-line.controller.ts`,
      `hr/ports/hr-reporting-line.provider.ts`, `hr/ports/managed-employee-sources.provider.ts`. Test: cycle refused;
      chain at depth; path
      rebuilt on move; with the setting off a manager's existing employee list and time screens show the same people as
      with the feature off; with it on they include reports.
- [ ] **T13** (parallel). Personal data (addresses as core `address` rows of owner `EMPLOYEE`, personal phones as
      `employee_phone` rows with `hrGroup = 'PERSONAL'`; existing phone rows untouched and as visible as today),
      contacts, education and employment (copied from the candidate on hire, once), pay accounts
      over `PARTY_BANK_ACCOUNTS` (`partyType = EMPLOYEE`, pending until verified, change notice), external ids with a
      lookup that also reads `integration_map`. Files: `hr/personal/personal-data.service.ts`,
      `hr/personal/personal-data.controller.ts`, `hr/personal/pay-accounts.service.ts`,
      `hr/personal/external-ids.service.ts`, `hr/personal/candidate-history-copy.ts`. Test: unit; fields absent without
      the key; pay account change notifies;
      no account number stored by the plugin; hire copies candidate rows once.
- [ ] **T14** (parallel). Structure endpoints: department tree, position details and required skills, level rank,
      branches with their `address` row, employee groups with `rule` rows (`EMPLOYEE_GROUP`) and recompute through
      `rule.evaluator.ts` and `HR_EMPLOYEE_RULE_CONTEXT`. Files: `hr/structure/structure.controller.ts`,
      `hr/structure/structure.service.ts`, `hr/structure/branch.service.ts`, `hr/structure/employee-group.service.ts`,
      `core/organization-department/organization-department.service.ts` (sub-departments move up on delete). Test: tree
      cycle guard; deleting a department with members
      works as today and moves its sub-departments to its parent; rule membership.
- [ ] **T15**. Approvers: lists, resolution order of FR-25, `HR_APPROVER_RESOLVER` provider. Files:
      `hr/approvers/hr-approver.service.ts`, `hr/approvers/hr-approver.controller.ts`,
      `hr/ports/hr-approver-resolver.provider.ts`. Test: each fallback step;
      never the employee or someone ended.
- [ ] **T16**. Active-employee check provider (`HR_ACTIVE_EMPLOYEE_CHECK`, answering `refuse` only while
      `hr.refuseInactiveDates` is on) and the "End work" warning about reports (extension of the employee page action);
      "End work" and "Back to work" set the employment status. Files: `hr/ports/hr-active-employee-check.provider.ts`,
      `hr/employees/employment-status.service.ts`, `hrui/components/end-work-warning/end-work-warning.component.ts`.
      Test: started, suspended and ended cases; with the
      setting off a time-off request for an ended employee is accepted with a warning, with it on refused.
- [ ] **T17**. HR events: record, preview, confirm, schedule, apply, cancel with later-change guard, bulk as core
      operation `HR_EVENTS_BULK` with per-row all-or-nothing, cross-organization transfer, pay rate revision through
      the existing rate path, `PAY_CHANGE` events from the existing rate-change request, approval hand-off through
      `HR_APPROVALS` (fallback core `request_approval` of type `HR_EVENT` with the FR-25 approver and its gate,
      outcome through its settler (`registerRequestApprovalSettler`)). Files: `hr/hr-events/hr-event.service.ts`,
      `hr/hr-events/hr-event.controller.ts`, `hr/hr-events/hr-events-bulk.operation.ts`,
      `hr/hr-events/cross-organization-transfer.service.ts`, `hr/hr-events/hr-event-approval.settler.ts`,
      `core/request-approval/linked-document-decision.gate.ts`. Test: unit and SQLite end-to-end; an event waits for and
      follows a core request approval decided on the Approvals page.
- [ ] **T18**. Outbox events of plan §5, consumer `subscriber:hr-lifecycle` (candidate hired, end work, task status,
      payment and journal results), real-time hints. Files: `hr/outbox/hr-lifecycle.events.ts`,
      `hr/outbox/hr-lifecycle.consumer.ts`, `hr/outbox/hr-realtime.hints.ts`. Test: replayed deliveries change nothing
      twice.
- [ ] **T19**. Schedules and workers in `hr/schedule/` (`hr-lifecycle-schedule.plugin.ts`, apply-due events first,
      reminders, groups, snapshot); `HrLifecycleSchedulePlugin` in `apps/worker/src/plugins.ts`; in-process fallback;
      every pass a `job_execution` row. Test: sweep specs, plugin list specs.
- [ ] **T20**. Documents and types: upload as a Docs document linked to the employee (`document_link`; core file
      storage without the Docs plugin), verify, reject, missing list, required rules as `rule` rows
      (`HR_DOCUMENT_TYPE`), expiry reminders as `REMINDERS` rows; candidate documents linked to the employee on hire, the
      candidate keeping them. Files: `hr/documents/employee-document.service.ts`,
      `hr/documents/employee-document.controller.ts`, `hr/documents/hr-document-type.service.ts`,
      `hr/documents/missing-documents.query.ts`. Test: unit; self-upload only where allowed; the file shows on the
      existing Documents tab; after hire the candidate's documents are still listed on the candidate; a verified
      document completes its "collect document" activity.
- [ ] **T21**. Org chart read model: lazy subtree, search, spans counts, agents under owners, badges from
      `HR_DIRECTORY` and time-off port. Files: `hr/org-chart/org-chart.service.ts`, `hr/org-chart/org-chart.controller.ts`.
      Test: 50,000-employee SQLite fixture within budget.
- [ ] **T59**. Interests as tags (FR-17): the organization's "Interest" tag type created on first use and an employee's
      interests read and written as core tags of that type. Files: `hr/personal/interests.service.ts`,
      `hr/personal/personal-data.controller.ts`. Test: an interest is a tag of type "Interest"; tags of other types are
      not offered as interests.
- [ ] **T61**. Skill ratings and gaps (FR-75): ratings per employee and skill on the 1 to 5 scale with evaluation date,
      evaluator and source, ratings on other scales converted proportionally, gaps against the position's required
      skills, completed trainings read through `LEARNING_COMPLETIONS`; routes `/hr/employees/:id/skill-ratings` and
      `/hr/skill-gaps`. Files: `hr/skills/skill-rating.service.ts`, `hr/skills/skill-rating.controller.ts`,
      `hr/skills/skill-gaps.query.ts`. Test: a rating of 7 on a 1 to 10 scale stores 3; gaps list skills under the
      position's minimum; without the learning plugin no trainings are listed.
- [ ] **T63**. Change history (FR-103): every write of an HR record, event, process, document, grievance and settlement
      is a core `activity_log` row with who, when, before and after. Files: `hr/audit/hr-change-log.subscriber.ts`. Test:
      one row per change with before and after values; sensitive values follow the group masks when the history is read.

## Phase 3 — UI surfaces

- [ ] **T22**. Angular plugin scaffold `packages/plugins/hr-lifecycle-ui` (`hrui/hr-lifecycle-ui.plugin.ts`,
      `hrui/hr-lifecycle-ui.routes.ts`), registered in
      `apps/gauzy/src/plugin-ui.config.ts`; "HR" menu group, feature and permission gating; `HR_LIFECYCLE.*` keys in
      every locale (`packages/ui-core/i18n/assets/i18n/`). Test: plugin spec; menu hidden without the feature.
- [ ] **T23**. Employee page tabs "HR record", "Personal" (with pay accounts over banking's store), "History" through
      the `employee-edit-page` tabset (`EMPLOYEE_EDIT_TABS` of
      `packages/plugin-ui/src/lib/plugin-extension/page-extension-slot.types.ts`) of
      `apps/gauzy/src/app/pages/employees/edit-employee`; hidden fields shown as such. Files:
      `hrui/components/hr-record-tab/hr-record-tab.component.ts`, `hrui/components/personal-tab/personal-tab.component.ts`,
      `hrui/components/history-tab/history-tab.component.ts`. Test: rendering specs; existing tabs unchanged.
- [ ] **T24** (parallel, after T56). Structure panels on the existing departments, positions and levels pages through
      their slots (tree, head, code, cost centre; description, planned headcount, required skills; rank); settings
      pages: branches, groups, approvers, document types, exit questionnaire, privacy and numbering. Files:
      `hrui/components/structure-panels/department-structure-panel.component.ts`,
      `hrui/components/structure-panels/position-structure-panel.component.ts`,
      `hrui/components/structure-panels/level-structure-panel.component.ts`, `hrui/settings/hr-settings-page.component.ts`
      and one component per settings section in `hrui/settings/`. Test: rendering
      specs; keyboard tree navigation; the existing pages unchanged without the feature.
- [ ] **T25**. Org chart page (tree, directory, filters, export) and events page with bulk events. Files:
      `hrui/pages/org-chart/org-chart-page.component.ts`, `hrui/pages/hr-events/hr-events-page.component.ts`. Test:
      rendering specs; screen-reader labels on nodes.
- [ ] **T26** (parallel). Self-service page `/pages/hr/me` (record, self-editable fields, documents, who read my
      data from the access audit). Files: `hrui/pages/hr-me/hr-me-page.component.ts`. Test: rendering specs; read-only
      fields.
- [ ] **T27** (parallel). Phone use of the installable Gauzy web app: `/pages/hr/me`, resignation, document upload
      from the camera and signing at phone width; no React package. Files: `hrui/pages/hr-me/hr-me-page.component.scss`,
      `hrui/components/resignation-form/resignation-form.component.ts`,
      `hrui/components/document-camera-upload/document-camera-upload.component.ts`. Test: rendering specs at phone width.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T28**. Read MCP tools in `packages/mcp-server/src/lib/tools/hr-lifecycle.ts` (`hr_employee_get`,
      `hr_employee_search`, `hr_org_chart`, `hr_reporting_chain`, `hr_documents_expiring`, `hr_skill_gaps`) through core
      field visibility with audit events of surface `MCP`. Test: input-schema spec; outputs without the hidden fields
      without keys.
- [ ] **T29** (parallel). Import templates (employees with HR fields, reporting lines in a second pass, documents'
      metadata) with the data exchange plugin. Files: `hr/import/hr-employee.import-template.ts`,
      `hr/import/reporting-line.second-pass.ts`. Test: per-row errors; unresolved managers reported.
- [ ] **T30**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries for `hr.*` events. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `hr.*` events.
- [ ] **T31**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.
- [ ] **T62**. HR record types (FR-95): employees with their HR columns, HR events, processes, grievances, documents and
      settlements registered in the core record type registry of `custom-fields-and-forms` T2 (list source, search
      fields, writers) for saved views,
      global search, custom fields, approval definitions, print templates and automation triggers. Files:
      `hr/hr-lifecycle.record-types.ts`, `hr/hr-lifecycle.plugin.ts`. Test: registry spec per type; a grievance never
      appears in a list or search of a reader the confidentiality filter excludes.

## Phase 5 — Lifecycle depth

- [ ] **T32**. Templates service and controller over the core task-template module (`task_template` of kind
      `HR_ONBOARDING` / `HR_SEPARATION`, built by `project-costing-and-billing` T60) with the HR activity details and
      applicability as `rule` rows (`LIFECYCLE_TEMPLATE`). Files: `hr/templates/lifecycle-template.service.ts`,
      `hr/templates/lifecycle-template.controller.ts`. Test: most specific template wins.
- [ ] **T33**. Processes: start from candidate, placeholder or employee; `TaskTemplateService.instantiate` into the
      onboarding project (anchor start or last day, tasks only for task activities); dates past rest days and holidays
      through `HR_WORKING_CALENDAR`; role assignment; progress; complete and cancel closing tasks; live-process
      uniqueness. Files: `hr/processes/lifecycle-process.service.ts`, `hr/processes/lifecycle-process.controller.ts`,
      `hr/processes/activity-dates.ts`. Test: unit and SQLite end-to-end; a template change leaves a running process
      unchanged.
- [ ] **T34**. Employee creation gate and "create employee" through the existing hire path
      (`core/candidate/commands/handlers/candidate.hired.handler.ts` untouched; gate checked by a guard on every
      creating path). Files: `hr/processes/employee-creation.guard.ts`, `hr/processes/create-employee.service.ts`. Test:
      creation refused with open required activities on each path.
- [ ] **T35**. Separations: resignation by the employee, HR start, notice dates, completion with new managers,
      end-of-work job (existing end-work path), sign-in deactivation rule, exit details. Files:
      `hr/separations/separation.service.ts`, `hr/separations/separation.controller.ts`,
      `hr/separations/end-of-work.job.ts`. Test: unit and e2e.
- [ ] **T36** (parallel). Exit interviews, questionnaire versions in the question-set format of `custom-fields-and-forms` (`question-set.model.ts`, its T63)
      (key, labels, type, required, options or rating scale), sending with per-leaver results, self-service answers keyed by the version's fields,
      reminders. Files: `hr/exit/exit-interview.service.ts`, `hr/exit/exit-interview.controller.ts`,
      `hr/exit/exit-questionnaire.service.ts`. Test: once-per-leaver sending; leavers without email listed; answers stay
      readable after a new version.
- [ ] **T37** (parallel). Grievances: types, raising, assignment, transitions, confidentiality filter, escalation
      sweep. Files: `hr/grievances/grievance.service.ts`, `hr/grievances/grievance.controller.ts`,
      `hr/grievances/grievance-confidentiality.filter.ts`, `hr/grievances/grievance-escalation.job.ts`. Test: concerned
      person never reads it; reads logged.
- [ ] **T38**. Final settlement: sources registry (`HR_SETTLEMENT_SOURCE`), collection, line edits, confirmation with
      preview, `document.final_settlement.confirmed` paid through a payroll settlement run when payroll is on, else
      through `payments-and-collections`, status from payment and journal events, print. Files:
      `hr/settlements/final-settlement.service.ts`, `hr/settlements/final-settlement.controller.ts`,
      `hr/settlements/settlement-sources.registry.ts`. Test: missing sources listed;
      unsettled line refuses confirmation; never handed to both.
- [ ] **T39** (parallel). Contracts (`ORG_CONTRACT_EDIT`, type = employment type) and HR letters through `HR_PRINT`.
      Files: `hr/contracts/employment-contract.service.ts`, `hr/contracts/employment-contract.controller.ts`,
      `hr/letters/hr-letter.service.ts`. Test: contract end feeds reminders; letter PDF snapshot.
- [ ] **T40**. Reminders: dated occasions (probation, contract, retirement, document expiry, interviews, signatures)
      as `REMINDERS` rows kept in step with their dates; birthdays, anniversaries and daily summary through
      `NOTIFICATION_DISPATCHER` with `dedupeKey`; Inbox fallback with the same keys; email templates. Files:
      `hr/reminders/hr-reminders.service.ts`, `hr/reminders/daily-notices.job.ts`, `hr/reminders/hr-email-templates.ts`.
      Test: once per person and occasion; a moved date moves its reminder; opted-out skipped.
- [ ] **T41**. Employee overview blocks and connections (`IHrOverviewBlockSource` sources from loaded plugins;
      tracked-time fallback for the year view). Files: `hr/overview/employee-overview.service.ts`,
      `hr/overview/overview-block-sources.registry.ts`, `hrui/components/overview-tab/overview-tab.component.ts`. Test: a
      failing block does not fail the page.
- [ ] **T42**. Report definitions (workforce, birthdays and anniversaries, employee list, exits), dashboard charts
      and cards, small-group suppression. Files: `hr/reports/hr-report-definitions.ts`, `hr/reports/hr-dashboard.service.ts`.
      Test: figures agree with seeded data.
- [ ] **T43**. UI: onboarding and separation boards, process page, exit interviews, grievances, settlement page,
      contracts and letters, reports and dashboard. Files: `hrui/pages/onboarding-board/onboarding-board.component.ts`,
      `hrui/pages/separations-board/separations-board.component.ts`, `hrui/pages/process/process-page.component.ts`,
      `hrui/pages/exit-interviews/exit-interviews-page.component.ts`, `hrui/pages/grievances/grievances-page.component.ts`,
      `hrui/pages/settlement/settlement-page.component.ts`, `hrui/pages/hr-dashboard/hr-dashboard-page.component.ts`.
      Test: rendering specs; the existing human resources dashboard renders as today.
- [ ] **T44**. Setup on first enable (employment types, document and grievance types, templates with no activity marked
      required before employee creation, email templates, HR manager role template, setup checklist). Files:
      `hr/setup/hr-setup.service.ts`. Test: existing
      data untouched; second run adds nothing; a candidate onboarded with the shipped template hires through the
      existing path at once.
- [ ] **T58**. Account for an onboarded employee (FR-10): "create account" from the work or personal email with an
      invite through the core invite service; one active employee per user and organization stays enforced, naming the
      conflicting employee. Files: `hr/processes/employee-account.service.ts`,
      `hr/processes/lifecycle-process.controller.ts`. Test: the invite goes to the chosen email; a second active
      employee for the same user and organization is refused with the existing one named.

## Phase 6 — Advanced capabilities

- [ ] **T45**. Automated activities: action catalogue from `HR_AUTOMATION_ACTIONS` (account and invite,
      memberships, role, equipment, course, chat, folders), run with `runKey`, results and failures, retry. Files:
      `hr/processes/automated-activities.runner.ts`. Test:
      failure keeps the activity open; retry runs once.
- [ ] **T46**. Separation revocation and handover: access revocation on the end date, custody list from
      `fixed-assets` through `HR_CUSTODY` (else core `equipment_sharing` holdings), successor proposals for tasks and
      owned records. Files: `hr/separations/access-revocation.service.ts`, `hr/separations/custody.service.ts`,
      `hr/separations/successor-proposal.service.ts`. Test: SQLite end-to-end; custody listed without `fixed-assets`.
- [ ] **T47**. Newcomer assistant through `HR_ASSISTANT` bound to `AGENT_RUNTIME` (knowledge marked as onboarding,
      sources, routing to inbox, no sensitive groups in prompts; runs and usage recorded by `ai-agents-and-assistants`).
      Files: `hr/assistant/onboarding-assistant.service.ts`, `hr/assistant/onboarding-assistant.controller.ts`. Test:
      answer with sources; unknown question routed; prompt contains no personal group.
- [ ] **T48** (parallel). Probation review: sweep, review activity with onboarding completion, goals and tracked
      versus expected hours; confirm, extend, end. Files: `hr/processes/probation-review.service.ts`,
      `hr/schedule/probation-review.job.ts`. Test: unit.
- [ ] **T49**. Spans range flags, vacancies from planned headcount, reorganisation scenarios (compare, share, apply as
      core operation `HR_SCENARIO_APPLY` creating a batch of dated transfers). Files: `hr/org-chart/spans.service.ts`,
      `hr/reorg/reorg-scenario.service.ts`, `hr/reorg/reorg-scenario.controller.ts`,
      `hr/reorg/hr-scenario-apply.operation.ts`. Test: apply creates one event per moved
      person; scenario changes nothing before.
- [ ] **T50**. Signature requests for any record type (`recordType`, `recordId`): fingerprint, ordered employee and
      outside signers (signed-token page in `public-layout-ui`), consent, evidence page, read-only file, reminders;
      `HR_SIGNATURES` provider. Files: `hr/signatures/signature-request.service.ts`,
      `hr/signatures/signature-request.controller.ts`, `hr/signatures/public-sign.controller.ts`,
      `hr/signatures/evidence-page.ts`, `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`,
      `hrui/pages/sign/sign-page.component.ts`. Test: fingerprint mismatch refused; evidence page content; an outside
      signer signs once with an expired token refused.
- [ ] **T51** (parallel). HR analytics data sources and snapshot (attrition, tenure, absence from time off, spans,
      onboarding days, internal moves, digital workforce with usage cost). Files: `hr/analytics/hr-analytics.service.ts`,
      `hr/analytics/headcount-snapshot.job.ts`. Test: golden monthly series.
- [ ] **T52**. Mutating MCP tools (`hr_event_record`, `hr_onboarding_start`, `hr_separation_start`,
      `hr_process_status`, `hr_settlement_preview`, `hr_settlement_confirm`, `hr_reorg_simulate`, `hr_analytics`)
      with `preview` defaults. Files: `packages/mcp-server/src/lib/tools/hr-lifecycle.ts`. Test: preview writes nothing.
- [ ] **T53**. UI for phase 6: scenario editor, signature screen, assistant panel in `hr-lifecycle-ui` (phone width
      included). Files: `hrui/pages/reorg-scenario/reorg-scenario-page.component.ts`,
      `hrui/pages/sign/sign-page.component.ts`,
      `hrui/components/onboarding-assistant-panel/onboarding-assistant-panel.component.ts`. Test: rendering specs.
- [ ] **T54**. Retention job and erasure registration with `access-control-and-security` (personal detail, `EMPLOYEE`
      address rows, phone rows with `hrGroup`), running only for organizations that set `hr.retention`. Files:
      `hr/privacy/hr-retention.job.ts`, `hr/privacy/hr-erasure.registration.ts`. Test: anonymised
      groups, events kept under a pseudonym; with no retention set nothing is anonymised; phone rows that existed before
      the feature are never touched.
- [ ] **T55**. Trial period on a tenant with the flag on; spec status `Implemented`. Files:
      `docs/specs/features/hr-core-lifecycle/spec.md`. Test: every acceptance criterion of `spec.md` §7 demonstrated on
      the trial tenant.
- [ ] **T56** (before T24). Core UI: named slots `DEPARTMENTS_PAGE_PANELS`, `POSITIONS_PAGE_PANELS`,
      `EMPLOYEE_LEVELS_PAGE_PANELS` added to `PAGE_EXTENSION_SLOTS`
      (`packages/plugin-ui/src/lib/plugin-extension/page-extension-slot.types.ts`) and placed on
      `apps/gauzy/src/app/pages/departments/departments.component.ts`,
      `apps/gauzy/src/app/pages/positions/positions.component.ts` and
      `apps/gauzy/src/app/pages/employee-levels/employee-level.component.ts`. Test: the pages render as today with no
      extension; a test extension appears in each slot.
- [ ] **T57**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `LEARNING_SKILL_RATINGS`, `PAYROLL_ACTIVE_EMPLOYEE`, `PAYROLL_HR_DIRECTORY`, `PERFORMANCE_SKILL_RATINGS`, `RECRUITMENT_ONBOARDING`, `WORKFLOW_HR_APPROVERS`, `WORKFLOW_REPORTING_LINE`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T60**. Agent employees in HR (FR-56): employees of kind agent are refused (`HR_AGENT_NOT_ALLOWED`) for personal
      data, documents, reminders, onboarding, separation, grievances and settlements, and are listed in HR views only
      under "agent employees" with their owner and usage cost from `ai-agents-and-assistants`. Files:
      `hr/privacy/agent-exclusion.guard.ts`, `hr/analytics/agent-employees.query.ts`. Test: each refused path for an agent
      employee; the agent employees list shows owner and cost, and agents are absent from other HR lists.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Employee record | T11 |
| FR-2 | §3.1 Employee record | T10 |
| FR-3–FR-4 | §3.1 Employee record | T11 |
| FR-5 | §3.1 Employee record | T11, T16 |
| FR-6 | §3.1 Employee record | T12 |
| FR-7 | §3.1 Employee record | T16, T35 |
| FR-8 | §3.1 Employee record | T16 |
| FR-9 | §3.1 Employee record | T16, T35 |
| FR-10 | §3.1 Employee record | T58 |
| FR-11 | §3.2 Personal data | T11, T13 |
| FR-12 | §3.2 Personal data | T4, T13 |
| FR-13 | §3.2 Personal data | T13 |
| FR-14 | §3.2 Personal data | T13, T23 |
| FR-15 | §3.2 Personal data | T13, T20 |
| FR-16 | §3.2 Personal data | T13 |
| FR-17 | §3.2 Personal data | T59 |
| FR-18 | §3.2 Personal data | T13, T26 |
| FR-19 | §3.3 Organisation structure and approvers | T14, T24 |
| FR-20 | §3.3 Organisation structure and approvers | T14, T24 |
| FR-21 | §3.3 Organisation structure and approvers | T2, T11, T14 |
| FR-22 | §3.3 Organisation structure and approvers | T14 |
| FR-23 | §3.3 Organisation structure and approvers | T14, T24 |
| FR-24 | §3.3 Organisation structure and approvers | T15 |
| FR-25 | §3.3 Organisation structure and approvers | T15, T17 |
| FR-26 | §3.3 Organisation structure and approvers | T12 |
| FR-27–FR-28 | §3.4 Organisation chart | T21, T25 |
| FR-29–FR-31 | §3.4 Organisation chart | T21, T49 |
| FR-32 | §3.4 Organisation chart | T21 |
| FR-33 | §3.4 Organisation chart | T18, T25 |
| FR-34–FR-39 | §3.5 Dated HR events | T17 |
| FR-40 | §3.5 Dated HR events | T17, T23 |
| FR-41 | §3.5 Dated HR events | T17 |
| FR-42 | §3.6 Onboarding and separation | T32 |
| FR-43 | §3.6 Onboarding and separation | T32, T33 |
| FR-44–FR-46 | §3.6 Onboarding and separation | T33 |
| FR-47 | §3.6 Onboarding and separation | T34 |
| FR-48 | §3.6 Onboarding and separation | T13, T34 |
| FR-49 | §3.6 Onboarding and separation | T45 |
| FR-50 | §3.6 Onboarding and separation | T35 |
| FR-51 | §3.6 Onboarding and separation | T46 |
| FR-52 | §3.6 Onboarding and separation | T35 |
| FR-53 | §3.6 Onboarding and separation | T35, T43 |
| FR-54 | §3.6 Onboarding and separation | T47 |
| FR-55 | §3.6 Onboarding and separation | T48 |
| FR-56 | §3.6 Onboarding and separation | T51, T60 |
| FR-57 | §3.7 Exit interviews | T36, T43 |
| FR-58 | §3.7 Exit interviews | T36 |
| FR-59 | §3.7 Exit interviews | T36, T40 |
| FR-60–FR-63 | §3.8 Grievances | T37 |
| FR-64–FR-67 | §3.9 Final settlement | T38 |
| FR-68 | §3.10 Documents, contracts, letters and skills | T20 |
| FR-69–FR-70 | §3.10 Documents, contracts, letters and skills | T20 |
| FR-71 | §3.10 Documents, contracts, letters and skills | T20, T40 |
| FR-72 | §3.10 Documents, contracts, letters and skills | T50 |
| FR-73–FR-74 | §3.10 Documents, contracts, letters and skills | T39 |
| FR-75 | §3.10 Documents, contracts, letters and skills | T61 |
| FR-76–FR-80 | §3.11 Reminders and summaries | T40 |
| FR-81–FR-82 | §3.12 Employee overview | T41 |
| FR-83 | §3.13 Privacy | T9 |
| FR-84 | §3.13 Privacy | T9, T26 |
| FR-85 | §3.13 Privacy | T9 |
| FR-86 | §3.13 Privacy | T54 |
| FR-87–FR-88 | §3.14 Reports and dashboards | T42 |
| FR-89–FR-90 | §3.14 Reports and dashboards | T42, T43 |
| FR-91–FR-92 | §3.14 Reports and dashboards | T42, T43 |
| FR-93 | §3.14 Reports and dashboards | T51 |
| FR-94 | §3.14 Reports and dashboards | T43 |
| FR-95 | §3.15 API, agents, setup and compatibility | T11, T17, T62 |
| FR-96 | §3.15 API, agents, setup and compatibility | T18 |
| FR-97 | §3.15 API, agents, setup and compatibility | T28, T52 |
| FR-98 | §3.15 API, agents, setup and compatibility | T44 |
| FR-99 | §3.15 API, agents, setup and compatibility | T7, T44 |
| FR-100 | §3.15 API, agents, setup and compatibility | T29 |
| FR-101 | §3.15 API, agents, setup and compatibility | T40, T44 |
| FR-102 | §3.15 API, agents, setup and compatibility | T3 |
| FR-103 | §3.15 API, agents, setup and compatibility | T63 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- No sensitive value leaves through any surface without the group key (contract tests per surface green).
- Existing employee, department, position, level, invite and hire suites pass unchanged with the feature on and off;
  with the feature on and no setting changed, AC-13 holds.
- Every acceptance criterion of `spec.md` §7 has a named test.
