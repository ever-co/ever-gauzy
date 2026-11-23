# Task Breakdown: Lead capture and enrichment

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `lead-capture-and-enrichment`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_LEAD_CAPTURE_ENABLED` and `FEATURE_LEAD_CAPTURE`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Starts after `crm-leads-and-deals` T13 (lead service) and T14 (duplicates) have landed.
- Plan phase 1 (forms) = T1–T16, T31, T32, T35, T48; phase 2 (intake and enrichment depth) = the rest of phases 1–4; phase 3
  (advanced) = phase 5.
- Depends on, each behind a port with the fallback of plan §7: the crm intake adapter (`crm-leads-and-deals`),
  consent records, mail intake and sending (`email-and-communications`), inbound endpoints and connected accounts
  (`integration-hub`), the isomorphic condition evaluator (`custom-fields-and-forms`), linked Works of
  `integration-ever-works`, the import of `data-import-export`.
- Builds on, unchanged in shape: core `terms_acceptance`, the operation runtime, `integration_setting`,
  `verifyWebhookSignature`, the core token helpers (`automation-and-notifications` T58), the automation integration
  plugins,
  the settings store and permission contributions.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/lead-capture.model.ts` (plan §3), `IntegrationEntity.LEAD` in
  `integration.model.ts`, port tokens `LEAD_CAPTURE_CRM`, `LEAD_CAPTURE_CONSENT`, `LEAD_CAPTURE_TEXT_GENERATION`,
  `LEAD_INTAKE`; exports in `index.ts`. Test: form definition schema guard specs.
- [ ] **T2**. Plugin scaffold `packages/plugins/lead-capture` (package, project, tsconfig, jest, eslint),
  `lead-capture.plugin.ts`, `lead-capture-schedule.plugin.ts`, `lead-capture-enabled.ts` (exact `true`),
  `lead-capture.features.ts` (`FEATURE_LEAD_CAPTURE`, default off), `lead-capture.settings.ts` (plan §3 keys), CRM
  feature check guard; conditional entries in `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`. Test: plugin
  lists with the flag on and off; settings defaults resolve.
- [ ] **T3**. Entities and repositories for forms, versions, submissions, daily stats (`forms/lead-form.entity.ts`,
  `forms/lead-form-version.entity.ts`, `submissions/lead-submission.entity.ts`,
  `analytics/lead-form-daily-stat.entity.ts`, each with `repository/type-orm-*.repository.ts` and
  `repository/mikro-orm-*.repository.ts`); migration `1791000053100-CreateLeadFormTables` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`). Test: migration spec on SQLite; PostgreSQL and MySQL in the suite. Migration timestamps: `1791000053100` to `1791000053199` (`packages/plugins/lead-capture`).
- [ ] **T4** (parallel). Entities for intake sources and items (`intake/lead-intake-source.entity.ts`,
  `intake/lead-intake-item.entity.ts` with their repositories; no settings table, no secret column); migration
  `1791000053110-CreateLeadIntakeTables`. Test: migration spec.
- [ ] **T5** (parallel). Entities for enrichment rules, mappings and changes (`enrichment/lead-enrichment-rule.entity.ts`,
  `enrichment/lead-enrichment-mapping.entity.ts`, `enrichment/lead-enrichment-change.entity.ts` with their
  repositories); operation type `LEAD_ENRICHMENT` (and its
  undo) registered with the core operation registry; migration `1791000053120-CreateLeadEnrichmentTables`. Test:
  migration spec; registry spec.
- [ ] **T6**. Permission contributions with `defaultFor` in `lead-capture.permissions.ts`;
  `LeadCaptureBootstrapService.ensureSeeded` (default rules and mappings, lead sources with codes through the CRM list
  service). Test: registry spec for grants; idempotent bootstrap.
- [ ] **T48**. Shared public form defence in core `packages/core/src/lib/public-form-defence/`: `PublicFormDefenceModule`
  and port `PUBLIC_FORM_DEFENCE` (trap field, render token fill time, throttles per address and form, proof-of-work
  challenge answered by the caller's own route, block lists from the caller's policy; no table, no route), provided
  independently of this plugin and `GAUZY_LEAD_CAPTURE_ENABLED`; per-form organization settings
  `publicFormDefence.<form>` (default off) for the existing public routes (FR-17). Files:
  `packages/contracts/src/lib/public-form-defence.model.ts`, `packages/core/src/lib/public-form-defence/public-form-defence.module.ts`,
  `packages/core/src/lib/public-form-defence/public-form-defence.service.ts`,
  `packages/core/src/lib/public-form-defence/public-form-defence.settings.ts`, `packages/core/src/lib/public-form-defence/index.ts`,
  `packages/core/src/lib/employee-appointment/employee-appointment.controller.ts`,
  `packages/core/src/lib/organization-team-join-request/organization-team-join-request.controller.ts`,
  `packages/core/src/lib/auth/auth.controller.ts`, `packages/core/src/lib/public-share/invoice/public-invoice.controller.ts`.
  Test: `packages/core/src/lib/public-form-defence/public-form-defence.service.spec.ts`: each signal blocks; a stub
  caller gets the same verdicts with this plugin not loaded; the existing booking, team join, sign-up and
  `public-share` routes answer exactly as before while their setting is off (spec AC-21).

## Phase 2 — Services, endpoints, events

- [ ] **T7**. CRM port: `CrmLeadIntakeAdapter` in `packages/plugins/crm/src/lib/lead/` (create with duplicate policy,
  convert to deal, fill empty fields, timeline link) bound to `LEAD_CAPTURE_CRM` in `plugin-composition.ts`; contract: every
  call runs in the caller's transaction (the intake pipeline completes its item in the same one, plan §2 Leads) and
  records the submission's `reference` in the lead's `intake`. Test: each duplicate policy; refusal returns the clashing
  record; a worker stopped after the CRM call and before commit leaves no lead and no completed item, and the rerun
  creates exactly one lead; a committed item is not run again.
- [ ] **T8**. Form service `forms/lead-form.service.ts` (lead or deal target with pipeline and stage, draft with
  `If-Match`, field catalogue of the target and public custom fields, the field types of spec FR-7 with record choices
  only from lists the owner grants, rule validation with the condition evaluator, publish blockers, versions, share
  link and embed code) and `forms/lead-form.controller.ts` with `forms/dto/create-lead-form.dto.ts`,
  `update-lead-form.dto.ts` (`Idempotency-Key` on creating routes). Test: required target field without default blocks
  publishing; a record choice outside the granted list is refused; publishing keeps the earlier version unchanged.
- [ ] **T9**. Origin and redirect validation `forms/origin.ts` (pure: scheme, host, port, leading wildcard, refused
  characters). Test: unit table of valid and refused origins.
- [ ] **T10**. Hosted page `public/lead-form-page.controller.ts` (built-in transactional page: HTML shell,
  `frame-ancestors`, cached definition, throttling as the public estimate route) and public definition route;
  `public-layout-ui` route `form/:key`. Test: e2e headers per form; unpublished form `410`.
- [ ] **T11**. Visitor bundle `packages/plugins/lead-capture-form` (render sections and columns, rules with the shared
  evaluator, languages, right to left, errors announced, attribution and first touch, render token). Test: rendering
  and rule specs; accessibility checks.
- [ ] **T12**. Public submission route `public/lead-form-submit.controller.ts` (size limit, throttle, server validation,
  sanitizing, receipt, `202` with reference) and queue `lead-capture-intake`. Test: invalid answers named; 2 s answer.
- [ ] **T13**. Intake pipeline `intake/lead-intake.pipeline.ts` (mapping, attribution as source code and campaign
  reference on the lead with the raw tags on the submission and the touch handed to marketing when loaded, duplicate
  policy, CRM call with the lead service's assignment rules, deal target conversion, timeline link, outcome) and the
  `LEAD_INTAKE` port. Test: e2e on SQLite for lead and deal targets; the new lead has an owner within 5 s; no free-text
  campaign on the lead.
- [ ] **T14**. Acknowledgement through `COMMUNICATIONS_SENDER` with the core `EmailSendService` fallback and per-hour
  limit, sent by `subscriber:lead-capture-acknowledgement` on `lead_capture.submission.accepted` with the idempotency
  key `lead-ack:<reference>` (plan §8). Files: `packages/plugins/lead-capture/src/lib/intake/lead-acknowledgement.service.ts`,
  `packages/plugins/lead-capture/src/lib/intake/lead-acknowledgement.subscriber.ts`,
  `intake/lead-acknowledgement.service.spec.ts`. Test: one email per address and hour; none to suppressed addresses; a
  worker stopped after the item commits and before the send sends the acknowledgement once when the event is delivered
  again; through `COMMUNICATIONS_SENDER` a redelivery after the send sends nothing more; on the `EmailSendService`
  fallback a stop after the send and before the delivery record commits sends it a second time, and no more.
- [ ] **T15**. Test submission `forms/lead-form-test.service.ts` (dry run of the pipeline). Test: writes nothing, sends
  nothing.
- [ ] **T16**. Submissions list and detail routes (refused submissions with reason and clashing record); timeline source
  for submissions on CRM records. Files: `packages/plugins/lead-capture/src/lib/submissions/lead-submission.service.ts`,
  `submissions/lead-submission.controller.ts`, `submissions/dto/list-lead-submissions.dto.ts`,
  `submissions/lead-submission-timeline.source.ts`. Test: e2e filters; a refused submission shows its clashing record.
- [ ] **T17**. Mail intake declaration through `registerMailIntakes` and the `INBOX_EMAIL_HANDOFFS` fallback listener;
  `intake/name-split.ts`, `intake/automated-sender.ts` (pure). Test: unit tables; own domains and automatic replies skipped.
- [ ] **T18**. Message, call and booking intake (`intake/channels/*.ts`): new sender on opted-in accounts, manual and
  automatic call intake with minimum duration, appointments with guest emails. Test: each channel e2e with fakes.
- [ ] **T19**. Allowed origins from linked Ever Works Works: `forms/ever-works-origins.ts` reads the Works linked to the
  organization and their hostnames through `integration-ever-works` (which gains that list), offers them in the share
  and embed panel, keeps `lead_form.linkedWorkIds`, and refreshes the form's allowed origins when a link or hostname
  changes; `/lead-capture/forms/:id/origins/works`. Test: a linked Work's hostname frames the form; an unlinked one is
  refused; without the integration, origins are typed by hand.
- [ ] **T20**. Webhook source: `inboundHandlers` contribution `lead_capture.webhook`, fallback `/public/lead-intake/:token`
  with HMAC over the raw body through core `verifyWebhookSignature` and the token-hash and sealed-secret helpers of
  `automation-and-notifications` T58 (`packages/core/src/lib/core/util/`), signing secret in `integration_setting`, JSON-path mapping; a sample mapping for an Ever Works site's contact
  and newsletter form. Test: bad signature refused and logged; rotation overlap.
- [ ] **T21**. Connector contract and registry `connectors/lead-source-connector.registry.ts`, sources service with
  discovery, mapping and schedule, credentials in `integration_setting`, external ids in `integration_map`. Test:
  contract suite on a fake connector.
- [ ] **T22**. Connector sync job `schedule/lead-capture-connector-sync.*` (watermark minus overlap, paging, push
  intake, reconnect state; runs recorded in `job_execution`) and the file import through `data-import-export` with the
  source's saved mapping. Test: two overlapping runs create each lead once.
- [ ] **T23**. Sync log `intake/lead-intake-log.service.ts` (outcomes, payload redaction, trace), manual retry, source
  state and pause. Test: redaction of secrets; retry of many.
- [ ] **T24**. Enrichment crawler `enrichment/crawler.ts` (guarded agent, address check and pinned lookup per redirect,
  site map, link ranking, limits, robots rules) and `html-text.ts`. Test: private-address and redirect fixtures refused;
  limits stop with pages so far.
- [ ] **T25**. Extraction and scoring `enrichment/extract.ts`, `enrichment/score.ts` (rules with pattern safety and step
  budget, confidence). Test: fixture site gives expected values and confidence.
- [ ] **T26**. Mapping and write policies `enrichment/apply.ts` (when empty, on a new value, while default, create missing
  list values), the run as a `LEAD_ENRICHMENT` operation (record as aggregate, steps per stage) with change records,
  live progress signals. Test: each policy; concurrent requests serialised by the one-live-operation rule.
- [ ] **T27**. Retry (operation retry) and undo `enrichment/undo.ts` (child operation; latest run only, keeps edited
  fields and reports them), the edit mark of plan §3 set by `enrichment/enriched-field-edit.subscriber.ts` on any later
  write of an enriched field, warning
  before overwriting edited fields, propagation from organisations, auto-enrich on creation. Test: AC-13 and AC-15; a
  field enriched to A, edited to B and back to A is kept by undo and reported as edited.
- [ ] **T28**. Enriched-field marks route and timeline source for runs. Files:
  `packages/plugins/lead-capture/src/lib/enrichment/lead-enrichment-marks.controller.ts`,
  `enrichment/lead-enrichment-marks.service.ts`, `enrichment/lead-enrichment-timeline.source.ts`. Test: mark dropped on
  edit; a run appears on the record's timeline with its changes.
- [ ] **T29**. Events and declarations of plan §5, notification category, retention job. Files:
  `packages/plugins/lead-capture/src/lib/events/lead-capture.events.ts`, `events/lead-capture-event.declarations.ts`,
  `lead-capture.notifications.ts`, `schedule/lead-capture-retention.scheduler.ts`. Test: one event per outcome;
  retention keeps counts.
- [ ] **T30** (parallel). GraphQL reads `leadForms`, `leadIntakeSources`, `leadEnrichmentRuns`. Files:
  `packages/plugins/lead-capture/src/lib/graphql/lead-form.resolver.ts`, `graphql/lead-intake-source.resolver.ts`,
  `graphql/lead-enrichment-run.resolver.ts`, `graphql/types.ts`. Test: resolver specs.
- [ ] **T49**. Capture settings routes: `GET`, `PUT /lead-capture/settings` over the keys of `lead-capture.settings.ts`
  (spam defence, auto-reply limit, call and booking intake, default duplicate policy, log retention; crawl and AI keys
  under `LEAD_ENRICH_SETTINGS`), each change written to the activity log. Files:
  `packages/plugins/lead-capture/src/lib/settings/lead-capture-settings.controller.ts`,
  `settings/lead-capture-settings.service.ts`, `settings/dto/update-lead-capture-settings.dto.ts`. Test: e2e, a user
  without `LEAD_INTAKE_MANAGE` is refused; a change is audited.
- [ ] **T50**. File field (default off per form): one file per field in the submit request, at most 10 MB, PDF or image
  types, stored through the platform's file storage and linked as a document to the new lead by the pipeline. Files:
  `packages/plugins/lead-capture/src/lib/public/lead-form-submit.controller.ts`,
  `intake/lead-submission-file.service.ts`, `intake/lead-intake.pipeline.ts`. Test: oversized and wrong-type files
  refused; an accepted file is a document of the new lead.

## Phase 3 — UI surfaces

- [ ] **T31**. `packages/plugins/lead-capture-ui` scaffold, routes under `/pages/crm/capture`, menu entries, `LEAD_CAPTURE.*`
  keys in every locale. Test: rendering tests; menu hidden on `404`.
- [ ] **T32**. Form builder on `ngx-question-set-editor` of `custom-fields-and-forms` (its T63; questions in the
  question-set format) with the form's additions (sections and columns, field mapping, rules, hidden values, consent boxes,
  languages, end step, preview at phone and desktop widths, publish dialog with blockers, share and embed, versions).
  Files: `packages/plugins/lead-capture-ui/src/lib/components/form-builder/lead-form-builder.component.ts`,
  `components/form-builder/lead-form-field-panel.component.ts`,
  `components/form-builder/lead-form-publish-dialog.component.ts`,
  `components/form-builder/lead-form-share-panel.component.ts`, `components/forms-list/lead-forms-list.component.ts`,
  `services/lead-forms.service.ts`. Test: component specs; keyboard-only build of a form.
- [ ] **T33**. Submissions page, sources pages (mail shortcut, messaging, webhook, file import, connectors with discovery
  and mapping), sync log with payload view and retry, capture settings page (T49). Files:
  `packages/plugins/lead-capture-ui/src/lib/components/submissions/lead-submissions-page.component.ts`,
  `components/sources/lead-sources-page.component.ts`, `components/sources/lead-source-mapping.component.ts`,
  `components/sync-log/lead-sync-log-page.component.ts`, `settings/lead-capture-settings-page.component.ts`,
  `services/lead-intake.service.ts`. Test: component specs.
- [ ] **T34**. Enrichment settings (rules with pattern check, mappings, crawl limits) and CRM record additions
  contributed to the record pages of `crm-ui` (Enrich with live progress, marks, history tab). Files:
  `packages/plugins/lead-capture-ui/src/lib/settings/lead-enrichment-settings-page.component.ts`,
  `components/enrichment/lead-enrich-action.component.ts`, `components/enrichment/lead-enrichment-history.component.ts`,
  `components/enrichment/lead-enriched-field-mark.directive.ts`, `services/lead-enrichment.service.ts`. Test:
  component specs.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T35**. MCP tools `packages/mcp-server/src/lib/tools/lead-capture.ts` (plan §7) with `preview`; registration with
  `AiChatToolRegistry`; changes made through a tool recorded as made by the agent on behalf of the user who confirmed
  them. Test: previews write nothing; tool-to-route spec; an enrichment run started by a tool names the agent and the
  user.
- [ ] **T36**. Report definitions of spec FR-67, listed as core `report` rows of the "Sales" category keyed
  `FEATURE_LEAD_CAPTURE` in the shared catalogue feature filter, with the read-only fallback viewer; import mapping for
  `data-import-export`. Files: `packages/plugins/lead-capture/src/lib/analytics/definitions/lead-intake.definition.ts`,
  `analytics/definitions/form-performance.definition.ts`, `analytics/definitions/intake-health.definition.ts`,
  `analytics/definitions/enrichment.definition.ts`, `analytics/definitions/speed-to-lead.definition.ts`,
  `database/migrations/1791000053130-SeedLeadCaptureReportCatalogue.ts`, `intake/lead-import-mapping.ts`. Test: figures
  on the demo data set; with the flag off the report list and menu are unchanged.
- [ ] **T37**. Personal data handlers for submissions, partials, consents and payloads; OpenAPI regenerated, SDK
  regeneration noted. Files: `packages/plugins/lead-capture/src/lib/privacy/lead-capture-personal-data.handler.ts`,
  `packages/core/src/lib/bootstrap/swagger.ts`. Test: export by email contains a visitor's submissions; erasure removes
  them.
- [ ] **T38**. User docs page (building, publishing, embedding, intake, enrichment) and `docs/specs/README.md` row; spec
  status `Implemented` when phase 5 lands. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T39**. Lead forms on the shared defence of T48 and the lead form spam log with release
  (`abuse/spam-log/lead-spam-log.service.ts`, `POST /lead-capture/submissions/:id/release` in
  `submissions/lead-submission.controller.ts`).
  Test: a blocked submission is logged with its reason; release creates the lead.
- [ ] **T40**. Consent boxes per channel and purpose with texts per language; each ticked box written through
  `TermsAcceptanceService.record` once the lead exists, `acceptsMarketing` set for a marketing box, consent records of
  communications linked through `LEAD_CAPTURE_CONSENT`. Files:
  `packages/plugins/lead-capture/src/lib/intake/lead-consent.service.ts`, `intake/lead-intake.pipeline.ts`,
  `packages/plugins/lead-capture-form/src/lib/consent-box.ts`. Test: AC-7; the evidence row verifies and cannot be
  updated.
- [ ] **T41**. Duplicate policies at intake in the form and source settings, merge suggestion card on the lead page.
  Files: `packages/plugins/lead-capture/src/lib/intake/duplicate-policy.ts`,
  `packages/plugins/lead-capture-ui/src/lib/components/form-builder/lead-form-duplicate-policy.component.ts`,
  `components/enrichment/lead-merge-suggestion-card.component.ts`. Test: AC-6.
- [ ] **T42**. Conversational mode in the visitor bundle; progressive profiling with signed visitor tokens and
  personalized links; partial answers with consent and 30-day purge. Files:
  `packages/plugins/lead-capture-form/src/lib/conversational.ts`, `packages/plugins/lead-capture-form/src/lib/progressive.ts`,
  `packages/plugins/lead-capture/src/lib/public/lead-form-partial.controller.ts`,
  `public/visitor-token.ts`, `schedule/lead-capture-retention.scheduler.ts`. Test: AC-8; nothing stored shown.
- [ ] **T43**. Automatic retry with back-off and source alerts (`schedule/lead-capture-retry.*`). Test: five failures
  give one notice.
- [ ] **T44**. Single-field undo, AI proposals through `LEAD_CAPTURE_TEXT_GENERATION` (agent runtime, usage and budgets
  recorded there) with evidence and minimum confidence, signature enrichment from linked mail. Files:
  `packages/plugins/lead-capture/src/lib/enrichment/undo.ts`, `enrichment/ai-proposals.ts`,
  `enrichment/signature-enrichment.ts`, `enrichment/lead-enrichment-run.controller.ts`
  (`/changes/:changeId/undo`). Test: without provider; proposals below minimum not written; single-field undo restores
  one field.
- [ ] **T45**. Form analytics (counters at the form's own endpoints: form loads, starts and the last field reached sent
  by the form script; daily roll-up, drop-off per field, speed to lead from `CRM_ENGAGEMENT_FACTS`; page views of a
  linked Ever Works site's page read through `INTEGRATION_EVER_WORKS_LINKS`) and the analytics page. Files:
  `packages/plugins/lead-capture/src/lib/analytics/lead-form-analytics.service.ts`,
  `schedule/lead-capture-stats.scheduler.ts`, `public/lead-form-page.controller.ts` (`/view`, `/start`),
  `packages/plugins/lead-capture-ui/src/lib/components/analytics/lead-form-analytics-page.component.ts`. Test: counts
  for scripted traffic; page views shown only for a form on a linked site.
- [ ] **T46**. Demo data: a published demo form, a webhook source, enrichment rules and a fixture site in the demo seed.
  Files: `packages/plugins/lead-capture/src/lib/seeds/lead-capture-demo.seed.ts`, run from `onPluginRandomSeed` in
  `lead-capture.plugin.ts`. Test: demo seed on SQLite.
- [ ] **T47**. "Create lead" action in `packages/plugins/integration-zapier`, `integration-make-com` and
  `integration-activepieces` (action endpoint per plugin mapping its payload to `ILeadIntakeRequest` through
  `LEAD_INTAKE`, an `AUTOMATION` intake source per connection, external id from the caller), and their app definitions
  updated where they live. Files: `packages/plugins/integration-zapier/src/lib/zapier-create-lead.controller.ts`,
  `packages/plugins/integration-make-com/src/lib/make-com-create-lead.controller.ts`,
  `packages/plugins/integration-activepieces/src/lib/activepieces-create-lead.controller.ts`. Test: one lead per external id over repeated calls; refused while `FEATURE_LEAD_CAPTURE` is
  off.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and settings | T2, T10 |
| FR-2 | §3.1 Presence and settings | T7, T13 |
| FR-3 | §3.1 Presence and settings | T2, T33, T49 |
| FR-4 | §3.2 Form builder | T8, T32 |
| FR-5 | §3.2 Form builder | T8, T32 |
| FR-6 | §3.2 Form builder | T8, T11, T12, T32 |
| FR-7 | §3.2 Form builder | T8, T32 |
| FR-8 | §3.2 Form builder | T8, T13, T32 |
| FR-9 | §3.2 Form builder | T11, T32 |
| FR-10 | §3.2 Form builder | T8, T12 |
| FR-11 | §3.2 Form builder | T50 |
| FR-12 | §3.3 Publishing, sharing and embedding | T8, T10 |
| FR-13 | §3.3 Publishing, sharing and embedding | T9, T11, T12 |
| FR-14 | §3.3 Publishing, sharing and embedding | T8, T9, T10, T19 |
| FR-15 | §3.3 Publishing, sharing and embedding | T15 |
| FR-16 | §3.4 Submissions | T12 |
| FR-17 | §3.4 Submissions | T39, T48 |
| FR-18 | §3.4 Submissions | T16, T39 |
| FR-19 | §3.4 Submissions | T40 |
| FR-20 | §3.4 Submissions | T11, T13 |
| FR-21 | §3.4 Submissions | T7, T13, T41 |
| FR-22 | §3.4 Submissions | T13, T16 |
| FR-23 | §3.4 Submissions | T14 |
| FR-24 | §3.4 Submissions | T7, T13 |
| FR-25 | §3.4 Submissions | T27 |
| FR-26 | §3.4 Submissions | T7, T12, T13, T16 |
| FR-27–FR-29 | §3.5 Conversational forms and progressive profiling (advanced) | T42 |
| FR-30 | §3.6 Intake channels | T17 |
| FR-31 | §3.6 Intake channels | T17 |
| FR-32–FR-34 | §3.6 Intake channels | T18 |
| FR-35 | §3.6 Intake channels | T19, T20 |
| FR-36 | §3.6 Intake channels | T20 |
| FR-37 | §3.6 Intake channels | T22 |
| FR-38 | §3.7 Ad platform connectors and sync logs | T21, T33 |
| FR-39 | §3.7 Ad platform connectors and sync logs | T22 |
| FR-40 | §3.7 Ad platform connectors and sync logs | T21, T22 |
| FR-41 | §3.7 Ad platform connectors and sync logs | T23, T33 |
| FR-42 | §3.7 Ad platform connectors and sync logs | T23, T43 |
| FR-43 | §3.7 Ad platform connectors and sync logs | T22, T23 |
| FR-44 | §3.7 Ad platform connectors and sync logs | T21, T47 |
| FR-45 | §3.8 Enrichment | T24–T26 |
| FR-46 | §3.8 Enrichment | T25 |
| FR-47 | §3.8 Enrichment | T26 |
| FR-48 | §3.8 Enrichment | T5, T26 |
| FR-49–FR-50 | §3.8 Enrichment | T27 |
| FR-51 | §3.8 Enrichment | T24, T27 |
| FR-52–FR-53 | §3.8 Enrichment | T24 |
| FR-54 | §3.8 Enrichment | T27 |
| FR-55 | §3.8 Enrichment | T28, T34 |
| FR-56 | §3.9 Advanced enrichment (advanced) | T44 |
| FR-57–FR-58 | §3.9 Advanced enrichment (advanced) | T44 |
| FR-59 | §3.9 Advanced enrichment (advanced) | T28, T34, T36 |
| FR-60–FR-61 | §3.10 Form analytics (advanced) | T45 |
| FR-62 | §3.11 API, MCP, events and reports | T8, T12 |
| FR-63 | §3.11 API, MCP, events and reports | T35 |
| FR-64 | §3.11 API, MCP, events and reports | T13, T18, T20, T47 |
| FR-65 | §3.11 API, MCP, events and reports | T29 |
| FR-66 | §3.11 API, MCP, events and reports | T35 |
| FR-67 | §3.11 API, MCP, events and reports | T36 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default off for existing tenants; enabling them in dev shows the feature end to end; with them off no public
  route stores data and every existing page and public route behaves as before (spec AC-21).
- Constitution gates in `spec.md` §9 confirmed.
- Public routes pass the fuzz suite (oversized, malformed, injected origins, replayed tokens) and the rate limits hold
  under load at 50 submissions per second.
- The crawler refuses every private-address fixture, directly and through redirects.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
