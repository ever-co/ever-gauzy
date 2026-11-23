# Task Breakdown: CRM leads and deals

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `crm-leads-and-deals`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_CRM`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Plan phase 1 (surface what exists) = T1–T9, T16, T26, T28, T31, T33, T39; phase 2 (depth) = the rest of phases 1–4;
  phase 3 (advanced) = phase 5 below.
- `crm/` means `packages/plugins/crm/src/lib/`, `crmui/` means `packages/plugins/crm-ui/src/lib/`; plugin paths without
  a prefix in a task (`lead/`, `deal/`, `settings/`, …) are under `crm/`. Each plugin area keeps its entities in
  `<area>/entities/` with TypeORM and MikroORM repositories in `<area>/repository/`.
- Depends on: the core record type registry (`custom-fields-and-forms` T2), saved-view lists
  (`record-views-and-search`), the quotation service with `dealId` (`sales-order-management`; fallback: core estimates),
  the automation trigger registry (`automation-and-notifications`), consent records (`email-and-communications`), the
  agent runtime (`ai-agents-and-assistants`; fallback: `ai-chat`). Each is reached through a port or registry with the
  fallback named in the task.
- Builds on, unchanged in shape: core `contact`, `resource_link`, `rule`, `terms_acceptance`, `accounting_template`,
  estimates (`estimate-email`, `public-share/invoice/`), the bulk executor, the settings store and permission
  contributions.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/crm-lead.model.ts`, `crm-party.model.ts`, `crm-deal.model.ts`,
  `crm-pipeline.model.ts`, `crm-duplicate.model.ts`, `crm-contract.model.ts`, `crm-settings.model.ts`,
  `crm-assist.model.ts`; additive optional fields on `organization-contact.model.ts`, `contact.model.ts`,
  `deal.model.ts`, `pipeline.model.ts`, `contact-buyer.model.ts` (`ContactBuyerRole.CONTACT`), `resource-link.model.ts`
  (record target); `RuleOwnerType.CRM_SCORE` in `rule.model.ts`; exports in `packages/contracts/src/index.ts`. Test: enum and type guard specs.
- [ ] **T2**. Core entity columns in `packages/core/src/lib/organization-contact/organization-contact.entity.ts`,
  `contact/contact.entity.ts` (`middleName`, `salutationId`), `deal/deal.entity.ts` (client relation many-to-one, same
  column), `pipeline/pipeline.entity.ts`, `pipeline-stage/pipeline-stage.entity.ts`,
  `contact-buyer/contact-buyer.entity.ts`, `resource-link/resource-link.entity.ts` (`targetEntity`, `targetEntityId`,
  `role`, `linkedBy`, nullable `url`; service accepts a record target instead of a URL and checks the caller may read
  both records); `phoneKey`, `websiteDomain`, `nameKey` kept by `organization-contact.subscriber.ts`. Test: subscriber
  spec, entity metadata spec for both ORMs, resource link with a URL unchanged and with a record target.
- [ ] **T3**. Core migrations `1791000051100-AddCrmColumnsToContactsAndDeals` and
  `1791000051110-AllowSeveralDealsPerContact` in `packages/core/src/lib/database/migrations/` (three dialects, `hasColumn`
  guards, `notes` widened to text, SQLite rebuild with a row-count check,
  backfills of `pipelineId`, `outcome`, `probabilityPercent`). Test: migration spec on SQLite; PostgreSQL and MySQL in
  the migration suite; two deals for one contact saved after it; existing resource links read back unchanged; record links come from `record-views-and-search` T52. Migration timestamps: `1791000051100` to `1791000051199` (`packages/core`); `1791000051200` to `1791000051299` (`packages/plugins/crm`).
- [ ] **T4** (parallel). `BaseEntityEnum.Deal` and `CrmContract` in `packages/contracts/src/lib/base-entity.model.ts`;
  `packages/core/src/lib/deal/deal-comment-access.policy.ts` beside the contact policy. Test: policy spec (member may comment, outsider refused).
- [ ] **T5**. Plugin scaffold `packages/plugins/crm` (`package.json`, `project.json`, `tsconfig.json`, `tsconfig.lib.json`,
  `tsconfig.spec.json`, `jest.config.ts`, `src/index.ts`), `crm/crm.plugin.ts`,
  `crm/crm-schedule.plugin.ts`, `crm/crm.module.ts`, `crm/crm.features.ts` (`FEATURE_CRM`, default off), `crm/crm.permissions.ts`,
  `crm/crm.settings.ts` (organization-scoped setting contributions with defaults: duplicate rule, owner default, default
  pipelines, converted stage, conversion requirements, re-conversion default, amount from lines, forecast fields required
  (off), customer on win, win on acceptance, auto-close, temperature bands, score decay, health thresholds, prefixes,
  `crm.openCrmPages` (off)),
  `crm/crm.types.ts` (ports `CRM_QUOTATIONS`, `CRM_ORDERS`, `CRM_DOCUMENT_FLOW`, `CRM_PRICING`, `CRM_SUBSCRIPTIONS`,
  `CRM_PROCUREMENT`, `CRM_CONSENT`, `CRM_TEXT_GENERATION`); path mapping in the root `tsconfig.json`; `apps/api/src/plugins.ts`,
  `apps/worker/src/plugins.ts`. Test: plugin list specs of the API and the worker; settings resolve defaults; every
  CRM route answers `404` with `FEATURE_CRM` off.
- [ ] **T6**. `FEATURE_PIPELINE` and `FEATURE_PIPELINE_DEAL` read by the CRM pipeline and deal controllers (the existing
  `pipeline.controller.ts`, `pipeline.resolver.ts`, `deal.controller.ts` and `deal.resolver.ts` stay ungated as today);
  audit of every reader of the deal's `client` relation (`apps/gauzy`, MCP, seeds). Test: extend
  `deal.controller.permissions.spec.ts`; `/deals` contract test; the existing pipeline and deal routes answer with either
  flag off as today.
- [ ] **T7**. Plugin entities and MikroORM repositories under `packages/plugins/crm/src/lib/**/entities/` for every
  `crm_*` table of plan §3 (no settings table, no link table): `settings/entities/crm-list-item.entity.ts`,
  `pipeline-rules/entities/crm-stage-history.entity.ts`, `party/entities/crm-contact-channel.entity.ts`,
  `deal/entities/{crm-line,crm-deal-contact,crm-deal-outcome-item}.entity.ts`, `health/entities/crm-record-state.entity.ts`,
  `lead/entities/crm-score-rule.entity.ts`, `duplicate/entities/crm-duplicate-dismissal.entity.ts`,
  `merge/entities/crm-merge.entity.ts`,
  `contract/entities/{crm-contract,crm-contract-signer,crm-contract-requirement,crm-contract-template}.entity.ts`;
  migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
  `crm/database/migrations/1791000051200-CreateCrmTables.ts`, `crm/database/migrations/1791000051210-CreateCrmContractTables.ts`,
  listed in `crm/database/crm-migrations.ts`. Test: migration spec on SQLite, entity specs.
- [ ] **T8**. Permission contributions in `crm/crm.permissions.ts` with `defaultFor` per role (plan §9), registered through
  `PluginContributions.permissions`; no seed migration. Test: registry spec (a new tenant's roles get the keys; the
  permission reload adds missing rows to an existing tenant and changes nothing else).

## Phase 2 — Services, endpoints, events

- [ ] **T9**. `settings/crm-bootstrap.service.ts` (`ensureSeeded`: lists with lead source codes, default lead and deal
  pipelines, whose ids are written to the settings store), organization-created handler
  (`settings/crm-organization-created.handler.ts`). Test: idempotent seeding,
  existing pipelines untouched.
- [ ] **T10**. Settings, lists and scoring rules: `settings/crm-settings.service.ts` (reads and writes the contributed
  keys through the platform settings store, audited), `settings/crm-list.service.ts`, `lead/crm-score-rule.service.ts` (conditions
  written and deleted as core `rule` rows of owner type `CRM_SCORE` through `RuleService`, validated by
  `rule.validator.ts` and `rule.pattern-safety.ts`), controllers `/crm/settings`, `/crm/lists/:list`,
  `/crm/score-rules` (`settings/crm-settings.controller.ts`, `settings/crm-list.controller.ts`,
  `lead/crm-score-rule.controller.ts`). Test: deactivate in use, never delete; audit entries; a rule's conditions are gone with it.
- [ ] **T11**. Pipelines: `pipeline-rules/crm-pipeline.service.ts`, `/crm/pipelines`, `/crm/pipelines/:id/stages`
  (`pipeline-rules/crm-pipeline.controller.ts`);
  optional core port `PIPELINE_STAGE_REMOVAL_GUARD` consulted by `PipelineService.update`
  (`packages/core/src/lib/pipeline/pipeline.service.ts`) when bound. Test: removal
  refused without target, records moved with target, flag-off path unchanged.
- [ ] **T12**. Stage engine (pure) `pipeline-rules/stage-rules.ts` (required fields, won and lost entry, probability
  default and rating sync) and `pipeline-rules/crm-stage-history.recorder.ts`. Test: unit specs for each rule.
- [ ] **T13**. Leads: `lead/crm-lead.service.ts`, `lead/crm-lead.controller.ts` (create, edit, stage, owner, qualification,
  display name, validation, reference via `SequenceService`; names on `contact`, description on `notes`, source on
  `acquiredChannel` (a list code from CRM forms; free text still accepted from the existing contact routes and forms),
  campaign reference; "do not contact" written through `CRM_CONSENT` to the consent records of
  `email-and-communications` with `acceptsMarketing` cleared, action hidden while unbound). Test: e2e on SQLite; no
  value is stored twice on the contact row; a free-text source saved through the existing contact route is kept and
  shown; an owner who is not a user of the organization, or whose sign-in email is the lead's, is refused.
- [ ] **T14**. Duplicates: `duplicate/normalize.ts` (email, phone digits, domain, name key), `duplicate/crm-duplicate.service.ts`,
  `/crm/duplicates/check`, `/dismiss` (`duplicate/crm-duplicate.controller.ts`); rule applied on lead, person and organisation create. Test: normaliser units,
  rule allow, warn, refuse.
- [ ] **T15**. Organisations and people: `party/crm-organisation.service.ts`, `party/crm-person.service.ts`,
  `party/crm-channel.service.ts` (primary email and phone stay in `primaryEmail` / `primaryPhone`; extra channels in
  `crm_contact_channel`; making one primary swaps it in one transaction), `party/crm-membership.service.ts` (one live
  membership, one primary, `CONTACT` role, job title on the membership), `/crm/contacts/:id/related`, CRM delete modes
  (`party/crm-party.controller.ts`).
  Test: membership rules, archive instead of trash, primary swap keeps `emailKey` matching.
- [ ] **T16**. Deals: `deal/crm-deal.service.ts`, `deal/crm-deal.controller.ts` (fields, currency rule with
  `FEATURE_MULTI_CURRENCY`, amount from lines, forecast fields, people with one primary, `If-Match`, mine, search,
  statistics, move to pipeline). Test: e2e including `409`.
- [ ] **T17**. Lines: `deal/crm-line.service.ts` with `CRM_PRICING` bound to the pricing plugin's price resolution in
  `apps/api/src/plugin-composition.ts` (fallback: variant price); totals through the order plugin's totals module; item checks; lead
  lines. Test: price prefill, inactive item refused, totals equal the order module's for the same lines.
- [ ] **T18**. Outcomes: win, lose (reasons, chosen alternatives, open-quotation check), reopen in `deal/crm-deal-outcome.service.ts`.
  Test: unit and e2e.
- [ ] **T19**. Conversion: `conversion/crm-conversion.service.ts` (lock, lead becomes person, organisation reuse or create,
  membership, deal, field and custom-field mapping through the custom-field value port, requirements, re-conversion
  policy, converted stage, event). Test: concurrent conversions give one deal; mapping cases.
- [ ] **T20**. Bulk conversion, to-customer and convert-and-quote: `conversion/crm-bulk-conversion.handler.ts` run by the
  core bulk executor as an async operation (`202` with the operation handle, per-lead results). Test: 40 leads with 3
  invalid; a retried request with the same key returns the same operation.
- [ ] **T21**. Lead score: `lead/score-engine.ts` (core rule evaluator over the lead context mapping of scope `CUSTOMER`,
  points per matching rule, decay, bands, breakdown), automation action "add score points". Test: unit specs; the
  evaluator gives the same verdict as for any other rule owner.
- [ ] **T22** (parallel). Lead progress: `lead/lead-progress.ts` (pure) and its updates from deal, quotation and customer
  events. Test: unit specs.
- [ ] **T23**. Quotations: bind `CRM_QUOTATIONS` to the order plugin's quotation service when `sales-order-management` is
  on, else to `quotations/crm-estimate-quotation.adapter.ts` (core estimate with the deal's lines as `invoice_item` rows,
  sent through `estimate-email`, answered once through the public estimate link); `/crm/deals/:id/quotations`; link rows
  in `resource_link`; `events/crm-quotation-events.consumer.ts` (Sales quotation events and the core
  `EstimateAnsweredEvent`: win on acceptance, all-lost prompt with reasons by name). Test: e2e with the Sales port bound
  and with the estimate fallback; an estimate accepted by link wins the deal.
- [ ] **T24**. Contracts: `contract/crm-contract.service.ts`, templates (terms as an `accounting_template` row of type
  `contract`, requirements in `crm_contract_template`), requirements, status machine, amendments, numbering through
  `business-documents` (fallback `SequenceService`); `contract/crm-contract.controller.ts`. Test: status transitions, immutability.
- [ ] **T25**. Signatures: `contract/crm-contract-signature.service.ts` (each signature recorded through
  `TermsAcceptanceService.record` with the SHA-256 of the terms; the signer row keeps the invitation, token and evidence
  id), public controller `/public/contracts/:token` (`contract/crm-public-contract.controller.ts`) with the throttling of the public estimate route, emails
  `crm-contract-signature-request`, `crm-contract-signed`, countersign and paper signature. Test: e2e, token expiry, rate
  limit, evidence row verifies and cannot be updated.
- [ ] **T26**. Events: outbox appends for every `crm.*` event, real-time hints, Inbox notices, `registerAutomationTriggers`,
  webhook catalogue entries. Files: `events/crm-events.ts`, `events/crm-realtime.ts`, `events/crm-inbox-notices.ts`,
  `events/crm-automation-triggers.ts`. Test: one event per change, deduplicated delivery; no event with `FEATURE_CRM` off.
- [ ] **T27**. Daily sweep: `schedule/crm-daily-sweep.{scheduler,worker,service}.ts` (stale and notices, auto-close,
  contract activation and expiry, requirement lapse, renewal reminders) with the inline fallback timer and lock. Test:
  one notice per stale spell; catch-up after a missed day.
- [ ] **T28**. Record types (`crm.lead`, `crm.organisation`, `crm.person`, `Deal`, `crm.contract`) with
  `registerRecordTypes`, system saved views "My open leads", "Stale deals", "Deals closing this month"; custom-field
  layout hooks. Files: `record-types/crm-record-types.ts`, `record-types/crm-system-views.ts`. Test: registry spec; views return the expected records.
- [ ] **T29**. `/crm/contacts/bulk` and `/crm/contacts/statistics`; import mappings declared to `data-import-export`
  (external id key, duplicate rule). Files: `party/crm-contacts-bulk.controller.ts`, `import/crm-import-mappings.ts`. Test: per-row results.
- [ ] **T30** (parallel). GraphQL reads (`graphql/crm.schema.ts`, `graphql/crm.resolver.ts`) and the field-binding check entry
  (`tools/scripts/graphql-field-binding-check.mjs`). Test: resolver specs.

## Phase 3 — UI surfaces

- [ ] **T31**. `packages/plugins/crm-ui` scaffold (`crmui/crm-ui.plugin.ts`, `crmui/crm.routes.ts`,
  `crmui/services/crm-api.service.ts`), routes under `/pages/crm`, its own menu entries (flag and
  permissions), menu items "Contacts", "Leads" and "Pipelines" pointed at CRM with `FEATURE_CRM` and `crm.openCrmPages`
  on; `featureCrmRedirectGuard` (`apps/gauzy/src/app/pages/feature-crm-redirect.guard.ts`) beside `apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts` on the old contact
  list, contact page, pipeline list and deal board routes (plan §6); `CRM.*` keys in every locale. Test: rendering
  tests, menu hidden on `404`; guard spec (flag or setting off activates the old page, both on redirect with query
  parameters and the old module never loads, setting switched off again opens the old page).
- [ ] **T32**. Leads pages: saved-view list and board, lead page with score breakdown, conversion dialog with duplicates
  and required fields, bulk convert. Files: `crmui/pages/leads/leads-page.component.ts`,
  `crmui/pages/lead/lead-page.component.ts`, `crmui/components/conversion-dialog/conversion-dialog.component.ts`,
  `crmui/components/bulk-convert-dialog/bulk-convert-dialog.component.ts`. Test: component specs.
- [ ] **T33**. Deals pages: board with stage colours and keyboard move, required-fields form, lost-reason prompt, deal page
  tabs (overview, lines, people, quotations, history). Files: `crmui/pages/deals/deals-board.component.ts`,
  `crmui/pages/deal/deal-page.component.ts`, `crmui/components/required-fields-form/required-fields-form.component.ts`,
  `crmui/components/lost-reason-dialog/lost-reason-dialog.component.ts`. Test: component specs.
- [ ] **T34**. Organisations and people pages: members, channels, memberships, related records, delete modes, photo and
  logo. Files: `crmui/pages/organisations/organisations-page.component.ts`, `crmui/pages/organisation/organisation-page.component.ts`,
  `crmui/pages/people/people-page.component.ts`, `crmui/pages/person/person-page.component.ts`. Test: component specs.
- [ ] **T35** (parallel). Settings → CRM: pipelines and stage rules, lists, scoring rules, settings. Files:
  `crmui/pages/settings/crm-settings-page.component.ts`, `crmui/pages/settings/crm-pipelines-settings.component.ts`,
  `crmui/pages/settings/crm-lists-settings.component.ts`, `crmui/pages/settings/crm-score-rules-settings.component.ts`. Test: component specs.
- [ ] **T36**. Contracts pages (list, editor, signers, requirements, chain, print) and `public-layout-ui` route
  `contract/:token` with typed signature alternative. Files: `crmui/pages/contracts/contracts-page.component.ts`,
  `crmui/pages/contract/contract-editor.component.ts`,
  `packages/plugins/public-layout-ui/src/lib/components/contract-signature/contract-signature.component.ts`,
  `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`. Test: component specs.
- [ ] **T37**. Phone width layouts and accessibility pass (keyboard, labels, automated checks) on every CRM page. Files:
  `crmui/components/bottom-sheet-actions/bottom-sheet-actions.component.ts`, `crmui/styles/crm-responsive.scss`. Test:
  viewport rendering at 360 px.
- [ ] **T38** (parallel). Phone use of the installable web app: CRM pages kept usable at 360 px with a lost connection
  (unsaved form kept, retry offered, nothing half-written). Files: `crmui/services/crm-offline-form.service.ts`. Test: offline form retry spec.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. Fix `packages/mcp-server/src/lib/tools/deals.ts`, `pipelines.ts`, `organization-contact.ts` per plan §7.
  Test: tool-to-route spec checking every tool path against the OpenAPI document.
- [ ] **T40**. New tools `crm-leads.ts`, `crm-parties.ts`, `crm-deals.ts`, `crm-contracts.ts`, `crm-settings.ts` in
  `packages/mcp-server/src/lib/tools/` with
  `preview`; `register-all-tools.ts`; `AiChatToolRegistry` registration when `ai-chat` is loaded. Test: preview writes
  nothing; with `FEATURE_CRM` off the tools answer that CRM is not enabled.
- [ ] **T41**. Default contract print template as an `accounting_template` row of type `contract` rendered through the
  core PDF path, handed to `print-and-pdf-designer` when it is loaded; OpenAPI regenerated, SDK regeneration noted for
  release. Files: `contract/crm-contract-print.service.ts`, `contract/crm-contract-print-template.ts`. Test: PDF snapshot.
- [ ] **T42**. User docs page and `docs/specs/README.md` row; spec status `Implemented` when phase 5 lands. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T43**. Merge: core `registerContactReferences` registry (core and plugin columns;
  `packages/core/src/lib/organization-contact/contact-references.registry.ts`), `merge/crm-merge.service.ts`
  (preview, transaction, record, undo with changed-record detection), `crm.merge-expiry` job. Test: merge and undo on
  PostgreSQL, MySQL and SQLite.
- [ ] **T44**. Merge UI: survivor, field choices, preview, undo banner. Files:
  `crmui/components/merge-dialog/merge-dialog.component.ts`, `crmui/components/merge-undo-banner/merge-undo-banner.component.ts`. Test: component specs.
- [ ] **T45**. Relationship map: `/crm/organisations/:id/relationship-map` and its UI (tree, deal roles, last contact,
  gaps). Files: `party/crm-relationship-map.service.ts`, `party/crm-party.controller.ts`,
  `crmui/components/relationship-map/relationship-map.component.ts`. Test: gap flags.
- [ ] **T46**. Pipeline rules in the UI: stale badges, auto-close setting, automation templates for stage rules. Files:
  `crmui/components/stale-badge/stale-badge.component.ts`, `crmui/pages/settings/crm-settings-page.component.ts`,
  `pipeline-rules/crm-automation-templates.ts`. Test:
  template creates a working rule.
- [ ] **T47**. Hand-off: `deal/crm-hand-off.service.ts` (preview, project with tasks through core project and task
  services, order through `CRM_ORDERS`, subscription through `CRM_SUBSCRIPTIONS`, contract), deal links as
  `resource_link` rows. Test: each target, permission per target.
- [ ] **T48**. Delivery panel: `/crm/deals/:id/delivery` (flow through `CRM_DOCUMENT_FLOW`, tasks, tracked hours and cost,
  invoiced and paid, subscriptions) with real-time hints; deal page tab. Files: `deal/crm-deal-delivery.service.ts`,
  `deal/crm-deal.controller.ts`, `crmui/pages/deal/deal-delivery-tab.component.ts`. Test: figures on the demo data set.
- [ ] **T49** (parallel). Requests for quotation from a deal through `CRM_PROCUREMENT` (hidden while unbound). Files:
  `deal/crm-rfq.service.ts`, `deal/crm-deal.controller.ts`. Test: e2e.
- [ ] **T50**. Health: `health/health-signals.ts` (pure), stage medians from the history, `crm_record_state`, poor-health
  notices, health tab. Test: unit specs per signal.
- [ ] **T51**. Next best action: rule proposals, `CRM_TEXT_GENERATION` adapter over the agent runtime of
  `ai-agents-and-assistants` (purposes `crm.*`, usage and budgets recorded there; fallback `AiChatService`), accept flows.
  Files: `health/crm-next-best-action.service.ts`, `assist/crm-text-generation.adapter.ts`. Test: without provider and with a stub provider; no usage row is written by the CRM.
- [ ] **T52**. Assistants: `/crm/assist/*` (`assist/crm-assist.controller.ts`, `assist/crm-assist.service.ts`),
  `packages/mcp-server/src/lib/tools/crm-assist.ts` MCP tools, source sentences, agent marker in the activity log.
  Test: previews write nothing; confirmed update attributed to agent and user.
- [ ] **T53**. Contract renewals and renewal deals (setting), reminders. Files: `contract/crm-contract-renewal.service.ts`,
  `schedule/crm-daily-sweep.service.ts`. Test: one renewal per contract, idempotent.
- [ ] **T54**. Demo data: leads, organisations, people, deals with lines, a signed contract in the demo seed. Files:
  `crm/seeds/crm-demo.seed.ts`, `packages/core/src/lib/core/seeds/seed-data.service.ts`. Test: demo
  seed on SQLite.
- [ ] **T55**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `LEAD_CAPTURE_CRM`, `LEAD_CAPTURE_TEXT_GENERATION`, `MARKETING_CRM`, `PORTAL_DUPLICATE_CHECK`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and compatibility | T5, T26, T31, T40 |
| FR-2 | §3.1 Presence and compatibility | T6, T31 |
| FR-3 | §3.1 Presence and compatibility | T2, T3, T6 |
| FR-4 | §3.1 Presence and compatibility | T3 |
| FR-5 | §3.1 Presence and compatibility | T31 |
| FR-6 | §3.2 Leads | T13 |
| FR-7 | §3.2 Leads | T2, T13 |
| FR-8 | §3.2 Leads | T13 |
| FR-9 | §3.2 Leads | T13 |
| FR-10 | §3.2 Leads | T13 |
| FR-11 | §3.2 Leads | T11, T12, T13 |
| FR-12 | §3.2 Leads | T13 |
| FR-13 | §3.2 Leads | T13 |
| FR-14 | §3.2 Leads | T10, T21, T35 |
| FR-15 | §3.2 Leads | T10, T21 |
| FR-16 | §3.2 Leads | T17 |
| FR-17 | §3.2 Leads | T22 |
| FR-18 | §3.3 Pipelines, stages and history | T11 |
| FR-19 | §3.3 Pipelines, stages and history | T11, T12, T33 |
| FR-20 | §3.3 Pipelines, stages and history | T9, T11 |
| FR-21 | §3.3 Pipelines, stages and history | T11, T12, T33 |
| FR-22 | §3.3 Pipelines, stages and history | T11 |
| FR-23 | §3.3 Pipelines, stages and history | T12, T33 |
| FR-24 | §3.3 Pipelines, stages and history | T12, T16 |
| FR-25–FR-27 | §3.4 Duplicates and merge | T14 |
| FR-28–FR-29 | §3.4 Duplicates and merge | T43, T44 |
| FR-30 | §3.4 Duplicates and merge | T43 |
| FR-31–FR-32 | §3.5 Conversion | T19 |
| FR-33 | §3.5 Conversion | T19, T32 |
| FR-34–FR-36 | §3.5 Conversion | T19 |
| FR-37 | §3.5 Conversion | T20, T32 |
| FR-38 | §3.5 Conversion | T20 |
| FR-39 | §3.5 Conversion | T19, T26 |
| FR-40–FR-41 | §3.6 Organisations and people | T15 |
| FR-42 | §3.6 Organisations and people | T15, T34 |
| FR-43 | §3.6 Organisations and people | T15, T34 |
| FR-44 | §3.6 Organisations and people | T45 |
| FR-45 | §3.6 Organisations and people | T15, T34 |
| FR-46 | §3.6 Organisations and people | T15 |
| FR-47 | §3.6 Organisations and people | T15 |
| FR-48 | §3.6 Organisations and people | T34 |
| FR-49–FR-50 | §3.7 Deals | T16 |
| FR-51 | §3.7 Deals | T12 |
| FR-52 | §3.7 Deals | T16, T17 |
| FR-53 | §3.7 Deals | T5, T12, T16 |
| FR-54 | §3.7 Deals | T16 |
| FR-55–FR-56 | §3.7 Deals | T17 |
| FR-57 | §3.7 Deals | T12, T18 |
| FR-58–FR-59 | §3.7 Deals | T18 |
| FR-60 | §3.7 Deals | T33 |
| FR-61 | §3.7 Deals | T2, T29 |
| FR-62 | §3.7 Deals | T13, T16 |
| FR-63–FR-64 | §3.8 Quotations and the one-platform hand-off | T23 |
| FR-65 | §3.8 Quotations and the one-platform hand-off | T18, T23 |
| FR-66 | §3.8 Quotations and the one-platform hand-off | T49 |
| FR-67 | §3.8 Quotations and the one-platform hand-off | T47 |
| FR-68 | §3.8 Quotations and the one-platform hand-off | T48 |
| FR-69 | §3.8 Quotations and the one-platform hand-off | T18 |
| FR-70 | §3.8 Quotations and the one-platform hand-off | T1, T8, T47 |
| FR-71 | §3.9 Pipeline rules | T12, T33, T46 |
| FR-72–FR-73 | §3.9 Pipeline rules | T27, T46 |
| FR-74 | §3.9 Pipeline rules | T46 |
| FR-75 | §3.10 Deal health and next best action | T50 |
| FR-76 | §3.10 Deal health and next best action | T51 |
| FR-77 | §3.10 Deal health and next best action | T50, T51 |
| FR-78–FR-79 | §3.11 Contracts | T24 |
| FR-80 | §3.11 Contracts | T24, T47 |
| FR-81 | §3.11 Contracts | T25 |
| FR-82 | §3.11 Contracts | T24, T25 |
| FR-83 | §3.11 Contracts | T24, T27 |
| FR-84 | §3.11 Contracts | T24, T36 |
| FR-85 | §3.11 Contracts | T53 |
| FR-86 | §3.11 Contracts | T24, T28, T40 |
| FR-87 | §3.11 Contracts | T36, T41 |
| FR-88 | §3.12 Lists and settings | T10, T35 |
| FR-89 | §3.12 Lists and settings | T5, T10, T35 |
| FR-90 | §3.12 Lists and settings | T9, T35 |
| FR-91 | §3.13 Lists, phones, real time, automation, import | T28, T32 |
| FR-92 | §3.13 Lists, phones, real time, automation, import | T28 |
| FR-93 | §3.13 Lists, phones, real time, automation, import | T4 |
| FR-94 | §3.13 Lists, phones, real time, automation, import | T26 |
| FR-95 | §3.13 Lists, phones, real time, automation, import | T37, T38 |
| FR-96 | §3.13 Lists, phones, real time, automation, import | T26 |
| FR-97 | §3.13 Lists, phones, real time, automation, import | T29 |
| FR-98 | §3.14 Assistants and MCP tools | T39 |
| FR-99 | §3.14 Assistants and MCP tools | T40 |
| FR-100–FR-101 | §3.14 Assistants and MCP tools | T51, T52 |
| FR-102 | §3.14 Assistants and MCP tools | T50, T52 |
| FR-103 | §3.14 Assistants and MCP tools | T52 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs, including the deal table rebuild on SQLite.
- Flag default stays off; enabling it in dev shows the feature end to end; with it off the contact, pipeline and deal
  contract tests pass unchanged.
- Constitution gates in `spec.md` §9 confirmed.
- Every MCP tool path exists in the OpenAPI document (tool-to-route spec green).
- Duplicate check and list budgets of spec §4 measured on a 1 M-contact data set.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
