# Task Breakdown: Learning management

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `learning-management`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Every controller, page, job and consumer of this list checks `FEATURE_LEARNING`.
- Paths are relative to `packages/plugins/learning/src/lib/` unless they start with `packages/` or `apps/`; `ui/`
  means `packages/plugins/learning-ui/src/lib/`. Each entity file has its MikroORM repository beside it in
  `repository/` (as in `packages/plugins/purchasing/src/lib/purchase-order/repository/`), each folder its
  `dto/`; migrations go to `database/migrations/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/learning.model.ts` (interfaces, enums, learning node types of the
      Docs content format, public feed shapes, event payloads, ports of plan §3); `RuleOwnerType.LEARNING_ASSIGNMENT_RULE`
      in `packages/contracts/src/lib/rule.model.ts`; export from `index.ts`. Test: type spec compiles against sample
      payloads; node schema accepts the shipped samples and refuses unknown kinds.
- [ ] **T2**. Plugin scaffold `packages/plugins/learning` (package, project, tsconfig, jest, eslint, path mapping),
      `learning.plugin.ts`, `learning.features.ts` (`FEATURE_LEARNING`, default off), `learning.permissions.ts`
      (thirteen keys with `defaultFor` of plan §9); registered in `apps/api/src/plugins.ts`. Test: plugin list spec;
      routes answer `404` with the feature off; a newly provisioned tenant's roles hold the defaults.
- [ ] **T3**. Migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
      `database/migrations/1791000028100-CreateLearningSetupTables.ts` and
      `database/migrations/1791000028110-CreateLearningContentTables.ts` + entities and MikroORM repositories
      `learner/learner.entity.ts`, `category/learning-category.entity.ts`, `course/learning-course.entity.ts`,
      `course/learning-course-version.entity.ts`, `course/learning-course-staff.entity.ts`,
      `course/learning-course-interest.entity.ts`, `outline/learning-chapter.entity.ts`,
      `outline/learning-lesson.entity.ts`, `package/learning-package.entity.ts`. Test: migration specs on SQLite (up
      twice is a no-op); `(versionId, key)` uniqueness.
- [ ] **T4** (parallel). Migrations `database/migrations/1791000028120-CreateLearningAssessmentTables.ts`,
      `database/migrations/1791000028130-CreateLearningProgressTables.ts` + entities `assessment/learning-question.entity.ts`,
      `assessment/learning-quiz.entity.ts`, `assessment/learning-quiz-attempt.entity.ts`,
      `assessment/learning-assignment.entity.ts`, `assessment/learning-submission.entity.ts`,
      `assessment/learning-exercise.entity.ts`, `assessment/learning-exercise-run.entity.ts`,
      `assessment/learning-placement.entity.ts`, `path/learning-path.entity.ts`, `path/learning-path-course.entity.ts`,
      `rule/learning-assignment-rule.entity.ts`, `enrolment/learning-enrolment.entity.ts`,
      `enrolment/learning-lesson-progress.entity.ts`, `enrolment/learning-activity-day.entity.ts`,
      `enrolment/learning-note.entity.ts`. Test: migration specs; `attemptKey` and enrolment `liveKey` uniqueness on all
      three dialects.
- [ ] **T5** (parallel). Migrations `database/migrations/1791000028140-CreateLearningCohortTables.ts`,
      `1791000028150-CreateLearningCertificateTables.ts`, `1791000028160-CreateTrainingTables.ts`,
      `1791000028170-CreateLearningCommerceTables.ts` + entities under `cohort/` (cohort, cohort course, cohort staff,
      cohort session, timetable template, waiting entry, live class, attendance, cohort feedback),
      `certificate/` (certificate, evaluation, badge, badge award, course review, mentor request), `training/`
      (programme, session, attendee, feedback) and `commerce/` (item link, course skill, assistant draft), one
      `<table-name>.entity.ts` per table of plan §3. Test: migration specs; verification code and evaluation `liveKey`
      uniqueness.
- [ ] **T6**. Settings contributions `learning.settings.ts` (keys of plan §3.1) read through the platform settings
      store; `/learning/settings` over them; role templates and invitations through core `invite`. Files:
      `learning.settings.ts`, `settings/learning-settings.controller.ts`, `settings/learning-roles.service.ts`. Test:
      defaults resolve; organization values win; an invited person receives the core invitation; no settings table
      exists.
- [ ] **T7**. Ports in `src/lib/ports/` (consumed `LEARNING_FILES`, `LEARNING_CONTENT_INDEX`, `LEARNING_MEETINGS`,
      `LEARNING_CALENDAR`, `LEARNING_COMMERCE`, `LEARNING_CHAT`, `LEARNING_ASSISTANT`, `LEARNING_RECOGNITIONS`,
      `LEARNING_CODE_RUNNER`, `LEARNING_PRINT`, `HR_DIRECTORY`, `HR_REPORTING_LINE`, `LEARNING_SKILL_RATINGS`,
      `RECRUITMENT_OPENINGS`, `NOTIFICATION_DISPATCHER`, `REMINDERS`, `PUBLIC_FORM_DEFENCE`; provided
      `LEARNING_COMPLETIONS`, `LEARNING_ASSIGNMENT`) with fallbacks; bindings in `apps/api/src/plugin-composition.ts`.
      Files: `ports/learning.ports.ts`, `ports/learning-port-fallbacks.ts`. Test: services run with every consumed port
      unbound.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Learners (resolve or create from employee, contact person or user; profile), categories, first-enable
      setup with sample course and welcome email once. Files: `learner/learner.service.ts`, `learner/learner.controller.ts`
      (`/learning/me/profile`), `category/learning-category.service.ts`, `category/learning-category.controller.ts`,
      `setup/learning-setup.service.ts`. Test: unit; the same person resolves to one learner; second enable adds
      nothing.
- [ ] **T9**. Courses: create, slug, staff, status machine with review queue, publish warnings, coming soon and interest
      list, featured, visibility. Files: `course/learning-course.service.ts`, `course/learning-course.controller.ts`,
      `course/learning-course-review-queue.service.ts`, `course/learning-course-interest.service.ts`,
      `course/dto/create-learning-course.dto.ts`. Test: unit and e2e; unpublished course refuses enrolment; duplicate
      instructors refused; interested people emailed once on publish.
- [ ] **T10**. Versions and outline: draft version, publish copies with stable lesson keys and writes the
      `learning_version_assessment` snapshot of quizzes, questions, assignments, exercises and placements (plan §3), outline editor
      endpoints with `version` autosave, reorder and move, delete with reference clean-up. Files:
      `course/learning-course-version.service.ts`, `course/learning-version-assessment.service.ts`,
      `outline/learning-outline.service.ts`, `outline/learning-outline.controller.ts`. Test: progress survives a
      publish; concurrent outline edits answer `409`; an edit of a published quiz's question, of an assignment's prompt,
      of an exercise's prompt, starter code or tests, or of a placement is invisible to enrolled learners (and to their
      exercise runs) until republish, and a question shared by two courses changes
      for the republished one only.
- [ ] **T11**. Lesson content in the Docs page content format: learning node types, validation, sanitizing, embed
      allow-list, instructor-only stripping, files through `LEARNING_FILES` with signed short-lived links, lessons
      registered as a source of the Docs retrieval pipeline through `LEARNING_CONTENT_INDEX`; free-preview lessons
      served to visitors as the course visibility allows. Files: `lesson/lesson-content.validator.ts`,
      `lesson/lesson-content.sanitizer.ts` (over `packages/core/src/lib/public-share/public-html-sanitizer.ts`),
      `lesson/learning-lesson.controller.ts`, `lesson/lesson-file.controller.ts`, `lesson/lesson-index.source.ts`.
      Test: unsafe HTML removed; instructor content never in a learner payload; file refused without enrolment; a
      preview lesson opens without enrolment, from the current published version, with its placed quiz, exercise and
      assignment shown as an invitation to enrol and no assessment definition in the payload; a published lesson's
      passages are retrievable, a draft's are not by the tutor.
- [ ] **T12**. Enrolment and progress: self and staff enrolment, roles, payment gate (active entitlement for paid
      items), progress events (video ranges, time spent, completion rules per organization and course, sequential
      locks), current lesson, activity days and streaks, live outline hints. Files:
      `enrolment/learning-enrolment.service.ts`, `enrolment/learning-enrolment.controller.ts`,
      `enrolment/lesson-progress.service.ts`, `enrolment/completion-rules.ts`, `enrolment/learning-streak.service.ts`.
      Test: golden rule matrix; enabling sequential mode keeps completed lessons.
- [ ] **T13**. Outbox events of plan §5 and consumer `subscriber:learning` (order and entitlement events, meeting
      participants, booking events, HR activities, review development areas). Files: `events/learning.events.ts`,
      `events/learning.consumer.ts`. Test: replayed deliveries change nothing twice.
- [ ] **T14**. Record types (`registerRecordTypes`) with comment access policies for `LearningLesson` and
      `LearningCourse` (discussions as core comments), notification categories, automation actions `learning.enrol` and
      `learning.award_badge` and triggers. Files: `learning.record-types.ts`, `comments/learning-comment-access.policy.ts`,
      `learning.notification-categories.ts`, `automation/learning-automation.actions.ts`,
      `automation/learning-automation.triggers.ts`. Test: a flow enrols a learner through the action; a non-enrolled
      user cannot read a lesson's comments; a grading notice follows the person's preferences.
- [ ] **T15**. Public feeds under `/api/public/learning/:org` (`catalogue.json`, `courses/:slug.json`, `certified.json`
      of opted-in certified learners by category, interest endpoint with `PUBLIC_FORM_DEFENCE`, enrol link into the
      learning portal), organization resolved from `profile_link`, cache and invalidation by publish events, content
      push to the linked Ever Works Work when the integration is on. Files: `public/learning-public-feed.controller.ts`,
      `public/learning-public-feed.service.ts`, `public/learning-works-push.service.ts`. Test: only published public
      items listed; only opted-in learners in the certified feed; interest throttled; push once per change.
- [ ] **T53**. Core broadcasts: a membership resolver per entity type in `packages/core/src/lib/broadcast/broadcast.service.ts`
      (`isEntityMember` consults registered resolvers for other entity types; the four existing types unchanged), and
      the learning resolver for `LearningCohort` (members by user). Files also: `cohort/cohort-broadcast-member.resolver.ts`.
      Test: existing broadcast suites pass; a cohort member reads a cohort broadcast, others do not.

## Phase 3 — UI surfaces

- [ ] **T16**. Angular plugin scaffold `packages/plugins/learning-ui`, registered in `apps/gauzy/src/plugin-ui.config.ts`
      through `page-sections`; menu group, feature and permission gating; learning commands registered with the command
      palette; `LEARNING.*` keys in every locale. Files: `ui/learning-ui.plugin.ts`, `ui/learning.routes.ts`,
      `ui/learning-commands.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: plugin spec; menu hidden without the
      feature; the palette lists the learning commands only with the feature on.
- [ ] **T17**. Author pages: course list, course settings, outline editor on the Docs editor with the learning nodes
      (wizard, drag, autosave, leave guard), review queue. Files: `ui/author/course-list.component.ts`,
      `ui/author/course-settings.component.ts`, `ui/author/outline-editor.component.ts`,
      `ui/author/learning-editor-nodes.ts`, `ui/author/review-queue.component.ts`, `ui/services/learning-api.service.ts`.
      Test: rendering specs; keyboard reordering.
- [ ] **T18**. Learner pages: home, catalogue, course view, lesson player (content, video with ranges and no-skip,
      files, private notes and highlights, the lesson's comment thread), "Learning" tab on the employee profile (only
      with the feature on). Files: `ui/learner/learner-home.component.ts`, `ui/learner/catalogue.component.ts`,
      `ui/learner/course-view.component.ts`, `ui/learner/lesson-player.component.ts`,
      `ui/learner/video-player.component.ts`, `ui/learner/employee-learning-tab.component.ts`. Test: rendering specs;
      player keyboard controls; the employee profile shows no new tab with the feature off.
- [ ] **T19** (parallel). Learner pages laid out for phone width (my learning, lesson player) in `learning-ui`. Files:
      `ui/learner/my-learning.component.scss`, `ui/learner/lesson-player.component.scss`. Test: component rendering
      specs at phone width.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T20**. Read MCP tools in `packages/mcp-server/src/lib/tools/learning.ts` (`learning_catalogue_search`,
      `learning_course_get`, `learning_progress_get`), registered in `packages/mcp-server/src/lib/tools/register-all-tools.ts`.
      Test: input-schema spec; instructor-only content absent.
- [ ] **T21**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries for `learning.*` events. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the `learning.*` events.
- [ ] **T22**. User docs (docs site) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Depth

- [ ] **T23**. Question bank with every kind of spec FR-21, numbering, tags and difficulty. Files:
      `assessment/learning-question.service.ts`, `assessment/learning-question.controller.ts`,
      `assessment/question-scoring.ts`. Test: scoring per kind.
- [ ] **T24**. Quizzes: fixed items and draws, options, windows, negative marking, attempts under concurrency,
      graded attempts kept after edits, manual grading queue, lesson completion on later pass, statistics. Files:
      `assessment/learning-quiz.service.ts`, `assessment/learning-quiz.controller.ts`,
      `assessment/quiz-attempt.service.ts`, `assessment/quiz-grading.controller.ts`, `assessment/quiz-statistics.service.ts`.
      Test: fourth attempt from two clients refused; golden scores.
- [ ] **T25** (parallel). Quiz monitoring: tab and focus events, consented snapshots with 30-day purge, violation limit
      and auto-submit, instructor log. Files: `assessment/quiz-monitoring.service.ts`, `assessment/quiz-snapshot-purge.job.ts`.
      Test: third violation submits with the reason.
- [ ] **T26**. Assignments and submissions: answer kinds, windows, rubric grading, self-grading refusal, private
      attachments, notifications. Files: `assessment/learning-assignment.service.ts`,
      `assessment/learning-assignment.controller.ts`, `assessment/learning-submission.service.ts`,
      `assessment/submission-grading.controller.ts`. Test: unit and e2e.
- [ ] **T27** (parallel). Exercises through `LEARNING_CODE_RUNNER` (queue `learning-runner`), hidden tests redacted.
      Files: `assessment/learning-exercise.service.ts`, `assessment/learning-exercise.controller.ts`,
      `assessment/exercise-runner.processor.ts`. Test: hidden expected output never in a learner payload; no runner
      hides the block.
- [ ] **T28**. Placements of assessments in lessons and timetables with validation; video question points. Files:
      `assessment/learning-placement.service.ts`, `assessment/learning-placement.controller.ts`. Test: placement
      outside the course refused; a video question point pauses the player until answered.
- [ ] **T29**. Packages: upload, validation, unpack (queue `learning-packages`), launch detection, sandboxed player with
      the run-time adapter, state on progress, delete removes files. Files: `package/learning-package.service.ts`,
      `package/package-validator.ts`, `package/package-unpack.processor.ts`, `ui/learner/package-player.component.ts`,
      `ui/learner/package-runtime.adapter.ts`. Test: path traversal and disallowed files refused; completion and resume
      stored.
- [ ] **T30**. Learning paths with order, membership and progress roll-up; bulk enrolment through the core bulk
      executor with preview. Files: `path/learning-path.service.ts`, `path/learning-path.controller.ts`,
      `enrolment/bulk-enrolment.service.ts` (over `packages/core/src/lib/api/bulk-executor.service.ts`). Test: path
      progress recomputed on course progress; 500-row bulk preview with per-row outcomes.
- [ ] **T31** (after T53). Cohorts: courses, staff, seats under concurrency, timetable and templates, announcements as core
      broadcasts (`LearningCohort`, `ENTITY_MEMBERS`) with the cohort membership resolver, feedback, dashboard, start
      reminders as `reminder` rows. Files: `cohort/learning-cohort.service.ts`, `cohort/learning-cohort.controller.ts`,
      `cohort/cohort-seat.service.ts`, `cohort/cohort-timetable.service.ts`, `cohort/cohort-announcement.service.ts`,
      `cohort/cohort-dashboard.service.ts`. Test: two enrolments for the last seat give one winner; a portal learner of
      the cohort reads its announcement, a non-member does not.
- [ ] **T32**. Live classes through `LEARNING_MEETINGS` and `LEARNING_CALENDAR` (invitations, retries, host notice,
      recordings and transcripts), attendance import from participants. Files: `cohort/live-class.service.ts`,
      `cohort/live-class.controller.ts`, `cohort/attendance-import.job.ts`. Test: failed invitation retried once; host
      told.
- [ ] **T33**. Certificates: completion issue, one per course and per cohort, expiry with one reminder row per
      certificate, print template, email, bulk issue through the core bulk executor, revoke. Files:
      `certificate/learning-certificate.service.ts`, `certificate/learning-certificate.controller.ts`,
      `certificate/certificate.print-templates.ts`, `certificate/certificate-expiry.job.ts`. Test: issue once under
      replay; bulk result per member; a revoked certificate's reminder is cancelled.
- [ ] **T34**. Evaluations: evaluation booking type per course through `LEARNING_CALENDAR` (hosts = evaluators, hours
      from their availability slots, window ending at the cohort's evaluation end), one upcoming per course, results,
      close job; fallback core appointment with its signed link. Files: `certificate/learning-evaluation.service.ts`,
      `certificate/learning-evaluation.controller.ts`, `certificate/evaluations-close.job.ts`. Test: concurrent booking
      of one slot books once; past slots never offered; an evaluator's time off is never offered.
- [ ] **T35** (parallel). Badges (rule and manual awards, each also written as a recognition entry through
      `LEARNING_RECOGNITIONS`), reviews of courses not sold (sold items through `product-reviews`), mentor requests,
      certified feed, cohort chat channels through `LEARNING_CHAT`. Files: `certificate/learning-badge.service.ts`,
      `certificate/learning-badge.controller.ts`, `community/learning-review.service.ts`,
      `community/mentor-request.service.ts`, `community/learning-community.controller.ts`,
      `cohort/cohort-chat.service.ts`. Test: badge granted once with one recognition; a sold course's review goes to the
      product review queue; cohort channel membership follows enrolments.
- [ ] **T36**. Training programmes and sessions: attendees, invitations, results once per session, feedback (three
      ratings and a comment) only from present attendees, `LEARNING_COMPLETIONS` provider for `hr-lifecycle` skills and
      compliance. Files: `training/training-programme.service.ts`, `training/training-session.service.ts`,
      `training/training.controller.ts`, `training/learning-completions.provider.ts`. Test: absent attendee refused;
      skills view lists the session; compliance lists learning certificates without a copy.
- [ ] **T37**. Commerce through `LEARNING_COMMERCE`: item links setting the product's `metadata.entitlement`, price and
      coupon resolution, tax, checkout placing an order and the hosted payment session, invoice through the order,
      recorded payment completing the order, enrolment following `entitlement.*` events, refund rule applied through
      the entitlement, unpaid-checkout reminders as `reminder` rows. Files: `commerce/learning-item-link.service.ts`,
      `commerce/learning-checkout.service.ts`, `commerce/learning-commerce.controller.ts`,
      `commerce/learning-commerce.adapter.ts`. Test: access opens only once the right is active; a refund revokes;
      replayed entitlement events count once; no purchase table exists.
- [ ] **T38**. Report datasets and definitions for spec §3.12 (sales from learning orders and entitlements), statistics
      page provider, charts and cards. Files: `reports/learning-report-datasets.ts`,
      `reports/learning-report-definitions.ts`, `reports/learning-statistics.service.ts`,
      `ui/reports/learning-statistics.component.ts`. Test: figures agree with seeded data.
- [ ] **T39**. Course export and import as core operations with validation and the 7-day purge; import profiles
      (`registerImportProfiles`). Files: `transfer/course-export.operation.ts`, `transfer/course-import.operation.ts`,
      `transfer/exports-purge.job.ts`, `transfer/learning-import-profiles.ts`. Test: colliding question names renamed;
      unsafe archive refused.
- [ ] **T40**. UI for phase 5: question bank, quiz and assignment editors and players, grading queue, cohorts (timetable,
      attendance, waiting list), paths, certificates, evaluations, badges, training, commerce, reports, settings and
      roles. Files: `ui/author/question-bank.component.ts`, `ui/author/quiz-editor.component.ts`,
      `ui/author/assignment-editor.component.ts`, `ui/learner/quiz-player.component.ts`,
      `ui/instructor/grading-queue.component.ts`, `ui/instructor/instructor-home.component.ts`,
      `ui/cohorts/cohort-detail.component.ts`, `ui/paths/path-list.component.ts`,
      `ui/certificates/certificate-list.component.ts`, `ui/evaluations/evaluation-list.component.ts`,
      `ui/training/training-sessions.component.ts`, `ui/commerce/item-links.component.ts`,
      `ui/settings/learning-settings.component.ts`. Test: rendering specs.
- [ ] **T41** (parallel). Quiz player, cohort page and training sessions laid out for phone width; camera access in the
      installed web app with consent. Files: `ui/learner/quiz-player.component.scss`,
      `ui/learner/quiz-camera-consent.component.ts`, `ui/cohorts/cohort-detail.component.scss`. Test: component rendering
      specs at phone width; no snapshot without consent.
- [ ] **T55**. Change history: who, when, before and after for every change of a published course version, grade,
      certificate, enrolment and training session result, written to the core activity log from the services of T10,
      T12, T24, T26, T33 and T36. Files: `history/learning-history.service.ts`, `history/learning-history.subscriber.ts`.
      Test: `learning-history.service.spec.ts`: publishing a version, changing a grade, revoking a certificate and
      recording a session result each leave one entry with the before and after values.

## Phase 6 — Advanced capabilities

- [ ] **T42**. Waiting lists with timed offers and in-person attendance by session code. Files:
      `cohort/waiting-list.service.ts`, `cohort/waiting-list.job.ts`, `cohort/session-check-in.service.ts`. Test: freed
      seat offered to the next learner; expired offer moves on.
- [ ] **T43**. Certificate verification codes and the built-in public check page with revocation status. Files:
      `certificate/certificate-check.controller.ts` (`/api/public/certificates/:code`),
      `certificate/certificate-check.page.ts`. Test: valid, expired and revoked pages.
- [ ] **T44**. Assignment rules with criteria as core `rule` rows (`LEARNING_ASSIGNMENT_RULE`; onboarding action,
      development areas through `LEARNING_ASSIGNMENT`, positions, groups, skill gaps) with due dates and reminder rows;
      compliance re-enrolment before expiry. Files: `rule/learning-assignment-rule.service.ts`,
      `rule/learning-assignment-rule.controller.ts`, `rule/learning-assignment.provider.ts`,
      `rule/compliance.service.ts`. Test: each trigger enrols once; a rule matching a department enrols only its people.
- [ ] **T45**. Skills graph: course skills on the 1–5 proficiency scale, gap view per employee, team and position,
      proficiency proposals through `LEARNING_SKILL_RATINGS` confirmed by the manager. Files:
      `skills/learning-course-skill.service.ts`, `skills/skill-gap.service.ts`, `skills/skills.controller.ts`. Test:
      completion proposes once; declined proposal changes nothing.
- [ ] **T46**. Assistant drafts (quizzes, summaries, glossaries) with source passages from the Docs retrieval index
      and approval, on the agent runtime (`aiRunId`); tutor answers from published content with links, refusing quiz
      answers. Files: `assistant/learning-assistant-draft.service.ts`, `assistant/learning-assistant.processor.ts`,
      `assistant/learning-tutor.service.ts`, `assistant/learning-assistant.controller.ts`. Test: drafts invisible to
      learners until approved; tutor prompt contains no learner data.
- [ ] **T47** (parallel). Learning time as manual time logs on the learning project when the organization opts in.
      Files: `enrolment/learning-time.service.ts` (over
      `packages/core/src/lib/time-tracking/time-log/time-log.service.ts`). Test: time log created once per lesson
      session with its reason.
- [ ] **T48** (parallel). Paths and catalogue access sold as plans of `subscription-billing` (the subscription keeps the
      entitlement in force). Files: `commerce/learning-subscription-plans.service.ts`,
      `commerce/learning-commerce.adapter.ts`. Test: access follows the entitlement's state.
- [ ] **T49**. Recruitment openings in the learning portal with apply from the learner profile. Files:
      `community/learning-openings.service.ts`, `ui/learner/openings.component.ts`. Test: application created in
      `recruitment` with the learner's CV.
- [ ] **T50**. Mutating MCP tools (`learning_enrol`, `learning_draft_assessment`, `learning_grade`,
      `learning_certificates_issue`, `learning_compliance_gaps`) with `preview` defaults, marked as agent actions.
      Files: `packages/mcp-server/src/lib/tools/learning.ts`. Test: preview writes nothing.
- [ ] **T51**. UI for phase 6: compliance, skills gaps, assistant panel, tutor, verification settings. Files:
      `ui/compliance/compliance.component.ts`, `ui/skills/skill-gaps.component.ts`,
      `ui/author/assistant-panel.component.ts`, `ui/learner/tutor-panel.component.ts`. Test: rendering specs.
- [ ] **T52**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.
- [ ] **T54**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `LEARNING_COMMERCE`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Catalogue and authoring | T9 |
| FR-2 | §3.1 Catalogue and authoring | T9 |
| FR-3 | §3.1 Catalogue and authoring | T9 |
| FR-4 | §3.1 Catalogue and authoring | T10 |
| FR-5 | §3.1 Catalogue and authoring | T9, T15 |
| FR-6 | §3.1 Catalogue and authoring | T10 |
| FR-7 | §3.1 Catalogue and authoring | T10, T17 |
| FR-8 | §3.1 Catalogue and authoring | T11, T17 |
| FR-9 | §3.1 Catalogue and authoring | T8, T18 |
| FR-10 | §3.1 Catalogue and authoring | T9, T15 |
| FR-11 | §3.1 Catalogue and authoring | T11 |
| FR-12 | §3.2 Lesson content and completion | T11 |
| FR-13 | §3.2 Lesson content and completion | T11, T12, T18 |
| FR-14 | §3.2 Lesson content and completion | T28 |
| FR-15 | §3.2 Lesson content and completion | T11 |
| FR-16 | §3.2 Lesson content and completion | T29 |
| FR-17 | §3.2 Lesson content and completion | T18 |
| FR-18 | §3.2 Lesson content and completion | T14 |
| FR-19 | §3.2 Lesson content and completion | T12 |
| FR-20 | §3.2 Lesson content and completion | T6, T12 |
| FR-21 | §3.3 Assessments | T23 |
| FR-22 | §3.3 Assessments | T24 |
| FR-23 | §3.3 Assessments | T24 |
| FR-24 | §3.3 Assessments | T25 |
| FR-25–FR-26 | §3.3 Assessments | T24 |
| FR-27–FR-28 | §3.3 Assessments | T26 |
| FR-29 | §3.3 Assessments | T27 |
| FR-30 | §3.3 Assessments | T28 |
| FR-31 | §3.4 Enrolment, progress and paths | T9, T12 |
| FR-32 | §3.4 Enrolment, progress and paths | T30 |
| FR-33–FR-34 | §3.4 Enrolment, progress and paths | T12 |
| FR-35 | §3.4 Enrolment, progress and paths | T30 |
| FR-36–FR-37 | §3.4 Enrolment, progress and paths | T44 |
| FR-38–FR-39 | §3.5 Cohorts, timetables and live classes | T31 |
| FR-40 | §3.5 Cohorts, timetables and live classes | T31, T42 |
| FR-41 | §3.5 Cohorts, timetables and live classes | T31 |
| FR-42 | §3.5 Cohorts, timetables and live classes | T31 |
| FR-43 | §3.5 Cohorts, timetables and live classes | T31 |
| FR-44 | §3.5 Cohorts, timetables and live classes | T32 |
| FR-45 | §3.5 Cohorts, timetables and live classes | T32, T42 |
| FR-46 | §3.5 Cohorts, timetables and live classes | T31 |
| FR-47 | §3.5 Cohorts, timetables and live classes | T32 |
| FR-48 | §3.6 Certificates, evaluations and badges | T33 |
| FR-49 | §3.6 Certificates, evaluations and badges | T43 |
| FR-50 | §3.6 Certificates, evaluations and badges | T34 |
| FR-51–FR-52 | §3.6 Certificates, evaluations and badges | T34 |
| FR-53 | §3.6 Certificates, evaluations and badges | T33 |
| FR-54 | §3.6 Certificates, evaluations and badges | T15 |
| FR-55 | §3.6 Certificates, evaluations and badges | T14, T35 |
| FR-56–FR-60 | §3.7 Paid learning | T37 |
| FR-61 | §3.7 Paid learning | T37, T48 |
| FR-62 | §3.8 Community, profiles and notifications | T35 |
| FR-63 | §3.8 Community, profiles and notifications | T8, T18 |
| FR-64 | §3.8 Community, profiles and notifications | T35 |
| FR-65 | §3.8 Community, profiles and notifications | T49 |
| FR-66 | §3.8 Community, profiles and notifications | T14 |
| FR-67 | §3.8 Community, profiles and notifications | T35 |
| FR-68–FR-73 | §3.9 Training programmes and sessions | T36 |
| FR-74 | §3.10 Assistants and skills graph | T46 |
| FR-75 | §3.10 Assistants and skills graph | T46, T51 |
| FR-76–FR-77 | §3.10 Assistants and skills graph | T45 |
| FR-78 | §3.10 Assistants and skills graph | T47 |
| FR-79 | §3.11 Portal, settings, roles and setup | T18, T40 |
| FR-80–FR-81 | §3.11 Portal, settings, roles and setup | T6 |
| FR-82 | §3.11 Portal, settings, roles and setup | T14, T16, T19, T41 |
| FR-83 | §3.11 Portal, settings, roles and setup | T8 |
| FR-84–FR-85 | §3.11 Portal, settings, roles and setup | T39 |
| FR-86–FR-93 | §3.12 Reports and dashboards | T38 |
| FR-94 | §3.13 API, agents and compatibility | T14 |
| FR-95 | §3.13 API, agents and compatibility | T8 |
| FR-96 | §3.13 API, agents and compatibility | T13, T21 |
| FR-97 | §3.13 API, agents and compatibility | T20, T50 |
| FR-98 | §3.13 API, agents and compatibility | T2, T16, T18 |
| FR-99 | §3.13 API, agents and compatibility | T55 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- A contact person, a portal user and an employee complete the same course in the end-to-end suite.
- Package, embed and archive abuse tests green; concurrency tests for seats, attempts and bookings green on SQLite.
- Every acceptance criterion of `spec.md` §7 has a named test.
