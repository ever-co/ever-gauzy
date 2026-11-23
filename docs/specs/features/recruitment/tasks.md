# Task Breakdown: Recruitment

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `recruitment`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths are relative to the repository root; `rc/` means `packages/plugins/recruitment/src/lib/` and `rcui/` means
  `packages/plugins/recruitment-ui/src/lib/`. Each new service, controller or component ships with a `.spec.ts` beside
  it.
- T49 (core pipelines and approval settlers, Phase 1) needs the core settler registry of `approval-workflows` T53; T48
  (core candidate profile tabs) sits in Phase 3 before T52, which registers the plugin's tab on it.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/recruitment.model.ts` (interfaces, enums, DTO and preview shapes,
      public feed and apply payloads, event payloads, port interfaces of plan §3); pipeline kind `HIRING` in
      `packages/contracts/src/lib/pipeline.model.ts`; `ApprovalPolicyTypesStringEnum` values `HIRING_REQUEST`,
      `JOB_OFFER` in `packages/contracts/src/lib/approval-policy.model.ts`; export from `packages/contracts/src/index.ts`.
      Test: type spec compiles against sample payloads.
- [ ] **T2**. Plugin scaffold `packages/plugins/recruitment` (`package.json`, `project.json`, `tsconfig.json`,
      `jest.config.ts`, `eslint.config.cjs`, path mapping in `tsconfig.base.json`), `rc/recruitment.plugin.ts`,
      `rc/recruitment.module.ts`, `rc/recruitment.features.ts` (`FEATURE_RECRUITMENT`, default off),
      `rc/recruitment.permissions.ts` (fourteen keys with `defaultFor` of plan §9); registered in `apps/api/src/plugins.ts`.
      Test: plugin list spec; routes answer `404` with the feature off; a newly provisioned tenant's roles hold the
      defaults.
- [ ] **T3**. Migration on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
      `rc/database/migrations/1791000026100-CreateRecruitmentSetupTables.ts` + entities and MikroORM repositories in
      `rc/entities/` (`applicant-source.entity.ts`, `rejection-reason.entity.ts`, `recruitment-stage-detail.entity.ts`,
      `interview-template.entity.ts`, `job-opening-template.entity.ts`, `offer-term.entity.ts`,
      `offer-term-set.entity.ts`; repositories in `rc/entities/recruitment.repositories.ts`). Test: migration spec on SQLite (up twice is a
      no-op); repository smoke specs for both ORMs. Migration timestamps: `1791000026100` to `1791000026199` (`packages/plugins/recruitment`).
- [ ] **T4** (parallel). Migrations `rc/database/migrations/1791000026110-CreateHeadcountAndRequestTables.ts`,
      `rc/database/migrations/1791000026120-CreateOpeningAndApplicationTables.ts` + entities in `rc/entities/`
      (`headcount-plan.entity.ts`, `headcount-plan-line.entity.ts`, `hiring-request.entity.ts`, `job-opening.entity.ts`,
      `job-opening-member.entity.ts`, `job-application.entity.ts`, `job-application-move.entity.ts`). Test: migration
      specs; `liveKey` and `submissionKey` uniqueness on all three dialects.
- [ ] **T5** (parallel). Migrations `rc/database/migrations/1791000026130-CreateInterviewTables.ts`,
      `rc/database/migrations/1791000026140-CreateOfferAndReferralTables.ts`,
      `rc/database/migrations/1791000026150-CreateScreeningTables.ts` + entities in `rc/entities/`
      (`interview-round.entity.ts`, `interview-scorecard.entity.ts`, `offer.entity.ts`, `referral.entity.ts`,
      `screening-summary.entity.ts`). Test: migration specs.
- [ ] **T6**. Settings contributions `rc/recruitment.settings.ts` (keys of plan §3.1, referral programme and sender
      included) read through the platform settings store; `/recruitment/settings` and `/recruitment/referral-programme`
      over them (`rc/settings/recruitment-settings.controller.ts`). Test: defaults resolve; organization values win; no
      settings or programme table exists.
- [ ] **T7**. Ports in `rc/ports/` (`recruitment-ports.fallbacks.ts`): consumed (`RECRUITMENT_APPROVALS`,
      `RECRUITMENT_ONBOARDING`, `HR_DIRECTORY`, `RECRUITMENT_HEADCOUNT`, `RECRUITMENT_SIGNATURES`, `PAYROLL_PREVIEW`,
      `PAYROLL_ADDITIONAL_PAY`, `TIME_OFF_WORKING_CALENDAR`, `TIME_OFF_AVAILABILITY`, `RECRUITMENT_TIME_OFF_SUMMARY`,
      `RECRUITMENT_CALENDAR`, `RECRUITMENT_MEETINGS`, `RECRUITMENT_ASSISTANT`, `RECRUITMENT_PRINT`,
      `PUBLIC_FORM_DEFENCE`, `NOTIFICATION_DISPATCHER`, `REMINDERS`) with the documented fallbacks; provided
      `RECRUITMENT_OPENINGS`; bindings in `apps/api/src/plugin-composition.ts`. Test: services run with every consumed
      port unbound.
- [ ] **T49**. Core pipelines: migration
      `packages/core/src/lib/database/migrations/1791000026900-AddPipelineKindAndDefault.ts` (adds `pipeline.kind` and `pipeline.isDefault` when missing, on `packages/core/src/lib/pipeline/pipeline.entity.ts`),
      the pipeline list (`packages/core/src/lib/pipeline/pipeline.service.ts`) leaves `HIRING` pipelines out unless that
      kind is asked for, decision gates for `HIRING_REQUEST` and `JOB_OFFER` in
      `packages/core/src/lib/request-approval/linked-document-decision.gate.ts` and their settlers
      (`rc/approvals/recruitment-request-approval.settlers.ts`) through the core request-approval settler registry of
      `approval-workflows` T53. Test: existing pipeline and deal suites pass; a hiring pipeline never appears on the sales
      pipelines page; existing request-approval suites green. Migration timestamps: `1791000026900` to `1791000026999`
      (`packages/core`).

## Phase 2 — Services, endpoints, events

- [ ] **T8** (after T49). Masters services and controllers (sources with candidate source name sync limited to entries
      still carrying the former name, rejection reasons,
      interview templates, templates, terms); hiring pipelines on core `pipeline` / `pipeline_stage` (kind `HIRING`, organization default,
      per-opening override) with `recruitment_stage_detail`, stage removal with a target stage; first-enable seeding of
      spec FR-82. Files: `rc/masters/applicant-source.service.ts`, `rc/masters/rejection-reason.service.ts`,
      `rc/masters/interview-template.service.ts`, `rc/masters/job-opening-template.service.ts`,
      `rc/masters/offer-term.service.ts`, `rc/masters/recruitment-masters.controller.ts`,
      `rc/pipelines/hiring-pipeline.service.ts`, `rc/pipelines/hiring-pipeline.controller.ts`,
      `rc/setup/recruitment-first-enable.seeder.ts`. Test: unit; second enable adds nothing; a stage holding
      applications cannot be removed without a target.
- [ ] **T9**. Openings: numbering on core `sequence`, lifecycle with date stamps, members, templates, requirements
      from `HR_DIRECTORY`, questions in the question-set format of `custom-fields-and-forms` (its T63) with `questionsVersion`, auto-close on fill. Files:
      `rc/openings/job-opening.service.ts`, `rc/openings/job-opening.controller.ts`, `rc/openings/dto/job-opening.dto.ts`.
      Test: unit and e2e; closes-on before open-from refused; a question change raises the version.
- [ ] **T10**. `CandidateIntakeService`: match by email, create inactive user without password and without welcome
      email, candidate and source, CV as candidate document, consent as core `terms_acceptance`; idempotent by
      submission key. Files: `rc/intake/candidate-intake.service.ts`. Test: unit; the intake user cannot sign in; same
      key twice creates one application.
- [ ] **T11**. Applications: create, one live per opening, merge or refuse duplicates, stage moves with the rules of
      FR-31, history, candidate status written only when one of its applications changes status (the candidate's own
      rating never written), bulk moves through the core bulk executor with per-row results, rating. Files:
      `rc/applications/job-application.service.ts`, `rc/applications/job-application.controller.ts`,
      `rc/applications/application-move.rules.ts`. Test: unit and SQLite end-to-end; editing the source on the old
      candidate page leaves the application's source unchanged; a status and rating set by hand on the candidate page
      stay until an application changes (AC-14).
- [ ] **T12**. Rounds on core interviews: schedule from interview template (criteria copied through
      `packages/core/src/lib/candidate-interview/interview-criteria.helper.ts`), restrictions, reschedule and cancel
      notices with the existing email templates, calendar and meeting ports, before-round reminders as `reminder` rows
      through `REMINDERS`. Files: `rc/rounds/interview-round.service.ts`, `rc/rounds/interview-round.controller.ts`.
      Test: unit; core interview routes still list the round; a reschedule moves its reminders.
- [ ] **T13**. Scorecards on core feedback: listed-interviewer and start-time guards, one per interviewer, edits until
      closed, per-criterion averages, rating push, decision inbox item after the last one. Files:
      `rc/scorecards/interview-scorecard.service.ts`, `rc/scorecards/interview-scorecard.controller.ts`. Test: unit and
      e2e.
- [ ] **T14**. Outbox events of plan §5, consumer `subscriber:recruitment` (approval decisions, booking and signature
      events, `hr.employee.hired`, payroll additional-pay results), real-time hints for boards. Files:
      `rc/events/recruitment.events.ts`, `rc/events/recruitment.consumer.ts`. Test: replayed deliveries change nothing
      twice.
- [ ] **T15**. Record types (`registerRecordTypes`) for plans, requests, openings, applications, rounds, offers and
      referrals with list sources and writers; the board system view per opening. Files:
      `rc/recruitment-record-types.ts`, `rc/applications/job-application.board-view.ts`. Test: board view lists by
      stage; writer refuses a hired move.
- [ ] **T16**. Report datasets and definitions for spec §3.13 (`registerReportDatasets`, `registerReportDefinitions`),
      dashboard template `recruitment.hiring`, invalidation names. Files: `rc/reports/recruitment-report-datasets.ts`,
      `rc/reports/recruitment-report-definitions.ts`, `rc/reports/recruitment-dashboard.template.ts`. Test: figures agree
      with seeded data.
- [ ] **T50**. Schedules: `RecruitmentSchedulePlugin` (`rc/schedule/recruitment-schedule.plugin.ts`) loaded by
      `apps/worker/src/plugins.ts`, in-process timers under an advisory lock without a queue root, and the daily
      `recruitment.openings.close-expired` sweep per organization time zone closing openings past their closes-on date
      and notifying their recruiters. Files: `rc/schedule/openings-close-expired.scheduler.ts`. Test:
      `rc/schedule/openings-close-expired.scheduler.spec.ts`: an opening past closes-on is closed once with its
      recruiters notified; a run on the same day changes nothing; the sweep runs in process without a queue (FR-14).
- [ ] **T51**. Change history: who, when, before and after for every change of a plan, request, opening, application
      stage, offer and referral, as activity-log entries (actor type `Agent` for MCP actions). Files:
      `rc/audit/recruitment-change-history.subscriber.ts`. Test: `rc/audit/recruitment-change-history.subscriber.spec.ts`:
      one entry with before and after per change of each record kind; a stage move records who and when (FR-86).

## Phase 3 — UI surfaces

- [ ] **T17**. Angular plugin scaffold `packages/plugins/recruitment-ui` (`rcui/recruitment-ui.plugin.ts`,
      `rcui/recruitment-ui.routes.ts`, `rcui/services/recruitment-api.service.ts`), registered in
      `apps/gauzy/src/plugin-ui.config.ts`; menu group, feature and permission gating; `RECRUITMENT.*` keys in every
      locale (`packages/ui-core/i18n/assets/i18n/*.json`). Test: plugin spec; menu hidden without the feature.
- [ ] **T18**. Openings list and opening page (details, team, board through the record-views board embeddable,
      rounds). Files: `rcui/components/openings-list/openings-list.component.ts`,
      `rcui/components/opening-page/opening-page.component.ts`. Test: rendering specs; keyboard moves between columns.
- [ ] **T19** (parallel). Application page (CV preview, timeline, rounds, scorecards, offers, the candidate's other
      applications). Files: `rcui/components/application-page/application-page.component.ts`. Test: rendering specs.
- [ ] **T20** (parallel). Settings pages (pipelines, sources, reasons, interview templates, templates, terms). Files:
      `rcui/components/settings-pipelines/settings-pipelines.component.ts`,
      `rcui/components/settings-sources/settings-sources.component.ts`,
      `rcui/components/settings-reasons/settings-reasons.component.ts`,
      `rcui/components/settings-interview-templates/settings-interview-templates.component.ts`,
      `rcui/components/settings-opening-templates/settings-opening-templates.component.ts`,
      `rcui/components/settings-terms/settings-terms.component.ts`. Test: rendering specs.
- [ ] **T21** (parallel). Referral form, my referrals, my interviews and scorecard form laid out for phone width in
      `recruitment-ui` (`rcui/components/referral-form/referral-form.component.ts`,
      `rcui/components/my-referrals/my-referrals.component.ts`, `rcui/components/my-interviews/my-interviews.component.ts`,
      `rcui/components/scorecard-form/scorecard-form.component.ts`). Test: rendering specs at phone width.
- [ ] **T48**. Core UI: candidate profile tabs (`edit-candidate-profile`,
      `apps/gauzy/src/app/pages/candidates/edit-candidate/edit-candidate-profile/edit-candidate-profile.component.ts`) on
      `PageTabRegistryService` (`packages/ui-core/core/src/lib/services/page/page-tab-registry.service.ts`) with
      `PageTabsetPageId` `candidate-edit-page` (existing tabs registered first, same order and routes) and the slot id
      `CANDIDATE_VIEW_ACTIONS` in `packages/plugin-ui/src/lib/plugin-extension/page-extension-slot.types.ts`, rendered in
      the profile header. Test: existing candidate tab specs pass unchanged; an extension registered for the slot
      renders; no plugin loaded shows today's page.
- [ ] **T52**. The "Applications" tab and the "Schedule from template" action registered on the candidate profile's tab
      registry and the `CANDIDATE_VIEW_ACTIONS` slot of T48, behind `FEATURE_RECRUITMENT`. Files:
      `rcui/candidate/candidate-applications-tab.component.ts`, `rcui/candidate/schedule-from-template.action.ts`,
      `rcui/recruitment-ui.plugin.ts`. Test: `rcui/candidate/candidate-applications-tab.component.spec.ts`: the tab lists
      the candidate's applications with the feature on and is absent with it off; existing candidate tabs unchanged.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T22**. Read MCP tools in `packages/mcp-server/src/lib/tools/recruitment.ts` (`recruitment_openings_search`,
      `recruitment_opening_get`, `recruitment_applications_search`, `recruitment_application_get`,
      `recruitment_funnel`) with pay fields by permission, registered in
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: input-schema spec; pay absent without the key.
- [ ] **T23**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries for `recruitment.*` events. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `recruitment.*` events.
- [ ] **T24**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Depth

- [ ] **T25**. Headcount plans: lines, overlap refusal, group plans, pull requests, held and open recount job, the
      opening check of FR-5 with enforcement modes, position headcount written on activation through
      `RECRUITMENT_HEADCOUNT`. Files: `rc/headcount/headcount-plan.service.ts`, `rc/headcount/headcount-plan.controller.ts`,
      `rc/headcount/opening-plan.check.ts`, `rc/headcount/headcount-recount.scheduler.ts`. Test: block, warn, off; with a
      plan of three and two held, an opening for two positions is refused in block mode and one for one position
      passes; two openings of one position each saved at once against one free position leave one refused; with lines of
      one position for departments A (full) and B (one free), an opening of B passes and one of A is refused, an
      opening without a department is checked against the line without one, and an opening no line matches is saved
      with the notice; group plan bound; chart vacancies equal plan vacancies.
- [ ] **T26**. Hiring requests: lifecycle, duplicate warning, approval through `RECRUITMENT_APPROVALS` (workflows, else
      core request approval `HIRING_REQUEST` with its decision gate and settler), opening from request, fill and time
      to fill. Files: `rc/requests/hiring-request.service.ts`, `rc/requests/hiring-request.controller.ts`. Test: unit; the
      decision moves the request once in both modes; the requester cannot approve.
- [ ] **T27**. Careers feed: `@Public()` controller under `/api/public/careers` with `openings.json` (job-posting fields,
      apply form definition) and `embed.js`, organization resolved from `profile_link`, cache and invalidation by
      opening events, content push to the linked Ever Works Work when the integration is on. Files:
      `rc/careers/careers-feed.controller.ts`, `rc/careers/careers-feed.service.ts`, `rc/careers/careers-embed.ts`,
      `rc/careers/ever-works-push.consumer.ts`. Test: only public open openings listed; a closed opening leaves the
      feed; push happens once per change.
- [ ] **T28**. Public apply: endpoint and built-in apply page (public layout `public-sections`), multipart post,
      `PUBLIC_FORM_DEFENCE`, throttling, file checks and scanning hook, queue `recruitment-intake`, acknowledgement
      email, thank-you answer. Files: `rc/careers/careers-apply.controller.ts`, `rc/intake/recruitment-intake.worker.ts`,
      `rcui/public/apply-page.component.ts`, acknowledgement template
      `packages/core/src/lib/core/seeds/data/default-email-templates/recruitment-application-received/<lang>/`. Test:
      rate limit; disallowed file refused; closed opening refused.
- [ ] **T29** (parallel). Mailbox intake: `INBOX_EMAIL_HANDOFFS` listener for the bound mailbox, opening by alias or
      subject, attachments as documents, thread link. Files: `rc/intake/recruitment-mailbox.listener.ts`. Test:
      redelivered message creates nothing twice.
- [ ] **T30**. Missing-scorecard notices (`recruitment.scorecards.missing`) through `NOTIFICATION_DISPATCHER` with
      de-duplication keys; notification categories. Files: `rc/schedule/scorecards-missing.scheduler.ts`,
      `rc/notifications/recruitment-notification-categories.ts`. Test: once per round, interviewer and day.
- [ ] **T31**. Offers: draft, one live offer, revisions, approval when above range (workflows, else core request
      approval `JOB_OFFER`), send with a `shared_entity` link, expire job, terms and term sets. Files:
      `rc/offers/offer.service.ts`, `rc/offers/offer.controller.ts`, `rc/offers/offer-terms.service.ts`,
      `rc/schedule/offers-expire.scheduler.ts`. Test: unit and e2e of the lifecycle; an expired offer's link stops
      working.
- [ ] **T32**. Compensation preview through `PAYROLL_PREVIEW` (target cost solving) with the payroll-less fallback;
      time-off summary through `RECRUITMENT_TIME_OFF_SUMMARY` and `TIME_OFF_WORKING_CALENDAR`. Files:
      `rc/offers/compensation-preview.service.ts`, `rc/offers/offer-time-off-summary.service.ts`. Test: golden previews.
- [ ] **T33**. Letters: print templates (offer standard, short, with pay breakdown; appointment letter), data provider
      for `Offer`, amounts in words. Files: `rc/print/recruitment-print-templates.ts`, `rc/print/offer.data-provider.ts`,
      `rc/print/amount-in-words.ts`. Test: PDF snapshots.
- [ ] **T34**. Acceptance: offer decision page through the new `public-sections` page location (member added to
      `PageRouteLocationId` in `packages/ui-core/core/src/lib/common/component-registry.types.ts`, read by
      `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`), acceptance as a signature request through
      `RECRUITMENT_SIGNATURES` (fallback evidence on the offer), onboarding start through `RECRUITMENT_ONBOARDING`, hire
      fallback through `CandidateHiredCommand`, employee offer and accept dates. Files:
      `rc/offers/offer-acceptance.service.ts`, `rc/public/offer-decision.controller.ts`,
      `rcui/public/offer-decision-page.component.ts`. Test: SQLite end-to-end from offer to employee in both modes.
- [ ] **T35**. Referrals: create, window refusal, status follow, programme rules from settings, eligibility job,
      proposal and cancel through `PAYROLL_ADDITIONAL_PAY`, due task without payroll. Files:
      `rc/referrals/referral.service.ts`, `rc/referrals/referral.controller.ts`,
      `rc/schedule/referral-eligibility.scheduler.ts`. Test: ineligible never proposed; proposal once.
- [ ] **T36** (parallel). Consent records as `terms_acceptance` rows, consent withdrawal links in every email. Files:
      `rc/consent/recruitment-consent.service.ts`. Test: withdrawal recorded.
- [ ] **T37**. UI: plans, requests, offers with preview and letter, referrals, interviews calendar entry, dashboard
      and reports pages, careers feed, sender and mailbox settings. Files: `rcui/components/plans-page/plans-page.component.ts`,
      `rcui/components/requests-page/requests-page.component.ts`, `rcui/components/offer-page/offer-page.component.ts`,
      `rcui/components/referrals-page/referrals-page.component.ts`,
      `rcui/components/recruitment-dashboard/recruitment-dashboard.component.ts`,
      `rcui/components/settings-careers/settings-careers.component.ts`. Test: rendering specs.
- [ ] **T38** (parallel). Import profiles (openings, candidates with applications and stages, historical offers).
      Files: `rc/import/recruitment-import-profiles.ts`. Test: per-row errors.

## Phase 6 — Advanced capabilities

- [ ] **T39**. Self-scheduling through `RECRUITMENT_CALENDAR`: one-off collective booking type per round (hosts = the
      required interviewers; window, notice and cut-off from the link), the calendar's signed booking link, round
      scheduled from the booking event; fallback core appointment with its signed link over availability slots. Files:
      `rc/scheduling/self-scheduling.service.ts`, `rc/rounds/interview-round.controller.ts`. Test: concurrent booking of
      one slot books once; time off excluded; a reschedule within the lead time moves the round.
- [ ] **T40**. Screening assistant: redaction of FR-62, queue `recruitment-screening`, run on the agent runtime
      (`aiRunId` on the summary), summary with evidence and flags; no write path from results. Files:
      `rc/screening/screening-redaction.ts`, `rc/screening/screening.service.ts`, `rc/screening/screening.worker.ts`. Test:
      prompt payload contains no removed attribute; output never changes an application.
- [ ] **T41** (parallel). Blind review per opening and hidden scorecards until own submission. Files:
      `rc/applications/blind-review.ts`, `rc/scorecards/scorecard-visibility.ts`. Test: masked board cards; reveal after
      scheduling; another interviewer's scorecard hidden until one's own is submitted.
- [ ] **T42** (parallel). Calibration dataset and report (interviewer against panel, hire outcomes, outliers). Files:
      `rc/reports/recruitment-calibration.dataset.ts`. Test: seeded lenient interviewer flagged.
- [ ] **T43**. Applicant portal `/pages/my-applications` (public stage labels, interviews, offers, documents,
      withdraw) with `RECRUITMENT_CANDIDATE_SELF`. Files: `rc/portal/applicant-portal.controller.ts`,
      `rcui/components/my-applications/my-applications.component.ts`. Test: candidate sees only own applications.
- [ ] **T44**. Retention and talent pool: notice to admins, anonymization job (only with `recruitment.retentionEnabled`
      on, only candidates with at least one application), talent-pool search and invitation, personal-data handler
      registration with `access-control-and-security`. Files: `rc/retention/recruitment-retention.scheduler.ts`,
      `rc/retention/recruitment-anonymiser.ts`, `rc/talent-pool/talent-pool.service.ts`,
      `rc/privacy/recruitment-personal-data.handler.ts`. Test: report counts kept after anonymization; with the setting
      off, or for a candidate without applications, nothing is removed; after anonymization no screening summary,
      linked run input or output, scorecard or feedback text, stage-move reason, offer acceptance or preview, or
      referral name, phone or reason of the candidate remains while the stage moves keep their stages and dates, and a quotation of the CV in a screening summary is gone.
- [ ] **T45** (parallel). Source cost and tracked recruiting time in source effectiveness. Files:
      `rc/reports/source-effectiveness.dataset.ts`. Test: cost per hire golden figures.
- [ ] **T46**. Mutating MCP tools (`recruitment_opening_draft_from_request`, `recruitment_application_move`,
      `recruitment_round_schedule`, `recruitment_screening_summary`, `recruitment_offer_draft`) with `preview`
      defaults, marked as agent actions. Files: `packages/mcp-server/src/lib/tools/recruitment.ts`. Test: preview writes
      nothing.
- [ ] **T47**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1–FR-5 | §3.1 Headcount plans | T25 |
| FR-6–FR-10 | §3.2 Hiring requests | T26 |
| FR-11–FR-12 | §3.3 Job openings and templates | T9 |
| FR-13 | §3.3 Job openings and templates | T8, T9, T20 |
| FR-14 | §3.3 Job openings and templates | T50 |
| FR-15 | §3.3 Job openings and templates | T9 |
| FR-16 | §3.4 Careers pages and applying | T27 |
| FR-17 | §3.4 Careers pages and applying | T10, T28 |
| FR-18 | §3.4 Careers pages and applying | T11, T28 |
| FR-19 | §3.4 Careers pages and applying | T28 |
| FR-20 | §3.4 Careers pages and applying | T29 |
| FR-21 | §3.4 Careers pages and applying | T6, T37 |
| FR-22 | §3.4 Careers pages and applying | T27 |
| FR-23 | §3.5 Candidates, applications and sources | T10, T11 |
| FR-24–FR-25 | §3.5 Candidates, applications and sources | T11 |
| FR-26 | §3.5 Candidates, applications and sources | T8, T20 |
| FR-27 | §3.5 Candidates, applications and sources | T19 |
| FR-28 | §3.5 Candidates, applications and sources | T11 |
| FR-29 | §3.6 Pipeline and applicant board | T8, T49 |
| FR-30 | §3.6 Pipeline and applicant board | T15, T18 |
| FR-31 | §3.6 Pipeline and applicant board | T11 |
| FR-32 | §3.6 Pipeline and applicant board | T14, T15, T18 |
| FR-33 | §3.7 Interview templates, scheduling and calendar | T8, T20 |
| FR-34–FR-37 | §3.7 Interview templates, scheduling and calendar | T12 |
| FR-38 | §3.7 Interview templates, scheduling and calendar | T39 |
| FR-39 | §3.7 Interview templates, scheduling and calendar | T12, T30 |
| FR-40–FR-41 | §3.8 Scorecards and decisions | T13 |
| FR-42 | §3.8 Scorecards and decisions | T41 |
| FR-43 | §3.8 Scorecards and decisions | T13 |
| FR-44 | §3.8 Scorecards and decisions | T42 |
| FR-45 | §3.9 Offers, letters and acceptance | T31, T32 |
| FR-46 | §3.9 Offers, letters and acceptance | T31 |
| FR-47–FR-48 | §3.9 Offers, letters and acceptance | T32 |
| FR-49 | §3.9 Offers, letters and acceptance | T8, T31 |
| FR-50 | §3.9 Offers, letters and acceptance | T31 |
| FR-51 | §3.9 Offers, letters and acceptance | T31, T33 |
| FR-52 | §3.9 Offers, letters and acceptance | T34 |
| FR-53 | §3.9 Offers, letters and acceptance | T31 |
| FR-54 | §3.9 Offers, letters and acceptance | T34 |
| FR-55 | §3.9 Offers, letters and acceptance | T33 |
| FR-56 | §3.9 Offers, letters and acceptance | T16 |
| FR-57 | §3.10 Referrals | T21, T35 |
| FR-58 | §3.10 Referrals | T35 |
| FR-59 | §3.10 Referrals | T6 |
| FR-60 | §3.10 Referrals | T35 |
| FR-61–FR-63 | §3.11 Screening assistant and fairness | T40 |
| FR-64 | §3.11 Screening assistant and fairness | T41 |
| FR-65 | §3.12 Applicant portal, consent and retention | T43 |
| FR-66 | §3.12 Applicant portal, consent and retention | T36, T43 |
| FR-67–FR-68 | §3.12 Applicant portal, consent and retention | T44 |
| FR-69–FR-70 | §3.13 Reports and dashboards | T16 |
| FR-71 | §3.13 Reports and dashboards | T16, T45 |
| FR-72–FR-75 | §3.13 Reports and dashboards | T16 |
| FR-76–FR-77 | §3.13 Reports and dashboards | T16, T37 |
| FR-78 | §3.13 Reports and dashboards | T12, T48 |
| FR-79 | §3.14 API, agents, setup and compatibility | T15 |
| FR-80 | §3.14 API, agents, setup and compatibility | T14 |
| FR-81 | §3.14 API, agents, setup and compatibility | T22, T46 |
| FR-82 | §3.14 API, agents, setup and compatibility | T8 |
| FR-83 | §3.14 API, agents, setup and compatibility | T2 |
| FR-84 | §3.14 API, agents, setup and compatibility | T38 |
| FR-85 | §3.14 API, agents, setup and compatibility | T2, T17 |
| FR-86 | §3.14 API, agents, setup and compatibility | T11, T51 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Existing candidate, interview, feedback, invite, hire, pipeline and deal suites pass unchanged with the feature on
  and off.
- Public routes pass the abuse tests (throttling, file checks, token reuse) and expose no internal opening.
- Every acceptance criterion of `spec.md` §7 has a named test.
