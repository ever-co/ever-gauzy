# Task Breakdown: Custom fields and forms

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `custom-fields-and-forms`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_CUSTOM_FIELDS_ENABLED` and `FEATURE_CUSTOM_FIELDS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Paths are
  relative to the repository root; `cf/` means `packages/plugins/custom-fields/src/lib/`, `ui/` means
  `packages/ui-core/shared/src/lib/custom-fields/`, `cfui/` means `packages/plugins/custom-fields-ui/src/lib/`.
- Phases 1 to 4 deliver plan phases 1 and 2; Phases 5 and 6 deliver plan phase 3 (advanced; Phase 6 only for
  self-hosted installations with the script switch on).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/record-type.model.ts`, `custom-field.model.ts` (enums, definitions,
  overrides, rules, layouts, actions, values, record types, access, templates, ports, error codes) and
  `formula.model.ts`; export from `packages/contracts/src/index.ts`. Test: contract compile spec.
- [ ] **T2**. Core record type registry `packages/core/src/lib/record-type/` (`record-type.registry.ts` with
  `registerRecordTypes`, `RecordTypeRegistry`, `RECORD_TYPE_SOURCE` binding, the `recordType.<key>` setting family) and
  `core-record-types.ts` keyed by `BaseEntityEnum`, reading permissions from the comment parent access policies, standard
  fields from the query schemas and title and search fields from the search definitions; the validation of
  `packages/core/src/lib/core/entities/entity-type-base.entity.ts` accepts registered keys (FR-5). Test:
  `record-type.registry.spec.ts` (duplicate key refused, resolve with and without a source, an entry's permissions equal
  its comment access policy's).
- [ ] **T3** (parallel). Formula language `packages/utils/src/lib/formula/` (`tokenizer.ts`, `parser.ts`,
  `type-checker.ts`, `evaluator.ts` with `BigInt` decimals, `functions.ts` catalogue, step budget) and the isomorphic
  condition evaluator `condition-evaluator.ts`. Test: unit specs per function and operator; conformance spec
  `formula.conformance.spec.ts` replaying `packages/core/src/lib/rule/rule.evaluator.spec.ts` cases.
- [ ] **T4**. Plugin scaffold `packages/plugins/custom-fields` (package, project, tsconfig, jest, eslint),
  `cf/custom-fields-enabled.ts` (exact `true`), path mapping, `.env.sample`; `cf/custom-fields.features.ts`
  (`FEATURE_CUSTOM_FIELDS`, `FEATURE_CUSTOM_RECORD_TYPES` default off); `cf/custom-fields.permissions.ts` (eight values
  with `defaultFor`).
  Test: flag and contribution specs.
- [ ] **T5**. Plugin migration set `cf/database/custom-fields-migrations.ts` and folder `cf/database/migrations/` on the
  shared core migration helpers (`@gauzy/core`, `procurement` T4), no copy in the plugin.
  Test: an empty migration run on SQLite. Migration timestamps: `1791000030100` to `1791000030199` (`packages/plugins/custom-fields`).
- [ ] **T6**. Entities `cf/entities/custom-field-definition.entity.ts`, `custom-field-override.entity.ts` and
  `custom-field-rule.entity.ts` (conditions as core `rule` rows with the new `RuleOwnerType` values in
  `packages/contracts/src/lib/rule.model.ts`) + MikroORM repositories
  `cf/entities/repository/mikro-orm-custom-field-{definition,override,rule}.repository.ts`;
  migration `cf/database/migrations/1791000030100-CreateCustomFieldDefinitionTables.ts`. Test: migration spec on SQLite
  (up twice) and mapping spec for both ORMs.
- [ ] **T7**. Entities `cf/entities/custom-field-value.entity.ts` and `custom-field-record-state.entity.ts` with their
  repositories; migration `cf/database/migrations/1791000030110-CreateCustomFieldValueTables.ts`
  with the indexes of plan §3.1. Test: migration spec; index presence spec per dialect.
- [ ] **T8** (parallel). Entities `cf/entities/form-layout.entity.ts`, `form-layout-version.entity.ts` and
  `form-action.entity.ts` with their repositories; migration
  `cf/database/migrations/1791000030120-CreateFormLayoutTables.ts`. Test: migration spec.
- [ ] **T9** (parallel). Entities `cf/entities/custom-record-type.entity.ts`, `custom-record-type-access.entity.ts` and
  `custom-record.entity.ts` with their repositories; migration
  `cf/database/migrations/1791000030130-CreateCustomRecordTables.ts`. Test: migration spec.
- [ ] **T10** (parallel). Entities `cf/entities/record-template.entity.ts` and `customization-package-import.entity.ts`
  with their repositories; migrations `cf/database/migrations/1791000030140-CreateRecordTemplateTables.ts`,
  `cf/database/migrations/1791000030150-CreateCustomizationAuditTables.ts`. Test: migration specs.
- [ ] **T11**. Default role grants through the permission contributions' `defaultFor` (no migration);
  `cf/custom-fields.plugin.ts` and `cf/custom-fields.module.ts` registering entities, migrations, permissions, features;
  `apps/api/src/plugins.ts` entry behind the flag; `CustomFieldsSchedulePlugin` (`cf/schedule/custom-fields-schedule.plugin.ts`)
  in `apps/worker/src/plugins.ts`. Test: plugin list specs of API and worker (absent when the flag is off).
- [ ] **T62**. Dynamic-field hook in core `packages/core/src/lib/api/` (`registerDynamicQueryFields(prefix, resolver)` in
  `filter-parser.ts`, `sort-parser.ts`, `query-translator.ts`), no dependency on this plugin or its flag. Test: unit
  spec of the hook (unbound = `cf.` refused as unknown); existing query protocol specs unchanged.
- [ ] **T63**. Question sets (FR-92): contracts `question-set.model.ts`, `packages/utils/src/lib/question-set/`
  (definition checks, `validateAnswers` on the isomorphic evaluator of T3) and
  `packages/ui-core/shared/src/lib/question-set/` (`ngx-question-set-editor`, `ngx-question-set-form`), independent of
  this plugin and its flag; used by recruitment, performance, HR exit interviews and lead capture. Test: the same
  answers get the same verdict in the browser and on the server; a hidden required question is not required; answers
  to an earlier version validate against that version; component specs with and without custom fields loaded.

## Phase 2 — Services, endpoints, events

- [ ] **T12**. Definition service and controller `cf/definitions/custom-field-definition.service.ts`,
  `custom-field-definition.controller.ts`, `dto/create-custom-field-definition.dto.ts`,
  `dto/update-custom-field-definition.dto.ts` (create, edit, keys, limits, options added, relabelled, reordered and
  archived, organization allow-list, lifecycle) and `cf/definitions/system-fields.reader.ts` (system fields read from
  `config.customFields`). Test: service spec (FR-2, FR-8, FR-13, FR-78, FR-81); e2e `404` with the feature off.
- [ ] **T13**. Value validation `cf/values/value-validator.ts` (types, bounds, options, references with view check,
  set once, masks, unique keys) and the `cf.` provider of the core `FieldVisibility`
  (`cf/values/custom-field-visibility.provider.ts`). Test: matrix spec per type and behaviour (FR-14 to FR-17).
- [ ] **T14**. Write integration: `cf/values/custom-field-values.interceptor.ts` (strip and stash on registered routes)
  and `cf/values/custom-field-value.subscriber.ts` (validate before, write after with the transaction's manager,
  `activity_log` rows for fields with history on, record state version). Test: e2e on contacts and projects (record and values commit together, refusal
  rolls both back); ORM parity spec.
- [ ] **T15**. Read integration: response interceptor (`customFieldValues` on detail, on lists when asked), GraphQL
  field on registered types, values controller (read, replace, merge, `If-Match`, bulk per-row). Files:
  `cf/values/custom-field-values.response.interceptor.ts`, `cf/values/custom-field-values.controller.ts`,
  `cf/values/custom-field-values.service.ts`, `cf/values/dto/write-custom-field-values.dto.ts`,
  `cf/values/dto/bulk-custom-field-values.dto.ts`, `cf/graphql/schema-extensions.ts`,
  `cf/graphql/custom-field-values.resolver.ts`. Test: e2e and resolver
  specs; masked field absent everywhere.
- [ ] **T16**. History service and routes over core `activity_log` (`cf.` fields: per field, cross-record search,
  restore) and customisation audit as `activity_log` rows of the definition entity types. Files:
  `cf/history/custom-field-history.service.ts`, `cf/history/custom-field-history.controller.ts`,
  `cf/history/customization-audit.subscriber.ts`. Test: spec (sources recorded
  in `data.source`, masks applied, restore validated).
- [ ] **T17**. Standard field overrides service and controller; server enforcement of required overrides in the
  subscriber. Files: `cf/overrides/custom-field-override.service.ts`, `cf/overrides/custom-field-override.controller.ts`,
  `cf/overrides/dto/custom-field-override.dto.ts`, `cf/values/custom-field-value.subscriber.ts`. Test: spec (relaxing a
  required field refused; reset).
- [ ] **T18**. Rule service (kinds, condition validation, dependency graph and cycle check) and server rule evaluation in
  the subscriber using `@gauzy/utils`; formula test route. Files: `cf/rules/custom-field-rule.service.ts`,
  `cf/rules/custom-field-rule.controller.ts`, `cf/rules/dto/custom-field-rule.dto.ts`, `cf/rules/rule-dependency-graph.ts`,
  `cf/rules/formula-test.controller.ts`, `cf/values/custom-field-value.subscriber.ts`. Test: specs per rule kind
  (FR-20 to FR-26).
- [ ] **T19**. Layout service (drafts, versions, publish checks, inheritance, resolution by audience, device, condition,
  priority) and controller. Files: `cf/layouts/form-layout.service.ts`, `cf/layouts/form-layout.controller.ts`,
  `cf/layouts/form-layout.resolver.ts`, `cf/layouts/dto/form-layout.dto.ts`. Test: resolution matrix spec; publish
  refusal spec (FR-33 to FR-39).
- [ ] **T20**. Metadata route (resolved per caller, `ETag`) and schema route. Files:
  `cf/metadata/custom-field-metadata.controller.ts`, `cf/metadata/custom-field-metadata.service.ts`,
  `cf/metadata/custom-field-schema.builder.ts`. Test: e2e per role and device.
- [ ] **T21**. Record type settings: the `form` section of the `recordType.<key>` setting in `tenant_setting`
  (organization scope, tenant fallback) through `TenantSettingService.resolve`, service and controller (FR-7, FR-48).
  Files: `cf/record-types/record-type-form-settings.service.ts`, `cf/record-types/record-type-form-settings.controller.ts`,
  `cf/record-types/dto/record-type-form-settings.dto.ts`. Test: spec; writing the `form` section leaves the `views`
  section untouched.
- [ ] **T22**. `cf/query/custom-field-query.service.ts` binding `cf.` to the core dynamic-field hook of T62 (filter
  semi-join, sort join for TypeORM and MikroORM). Test: e2e `filter[cf.renewal][lt]` and `sort=cf.renewal` on contacts
  on SQLite through REST and GraphQL; parity spec.
- [ ] **T23**. Action service: kinds, conditions, run with per-record results, `preview`; ports `CUSTOM_FIELDS_FLOWS`,
  `CUSTOM_FIELDS_WORKFLOW`, `CUSTOM_FIELDS_WEBHOOKS`, `CUSTOM_FIELDS_AGENTS` (unbound → kind not offered). Files:
  `cf/actions/form-action.service.ts`, `cf/actions/form-action.controller.ts`, `cf/actions/form-action.runner.ts`,
  `cf/actions/dto/form-action.dto.ts`, `cf/actions/form-action.ports.ts`. Test: spec
  per kind; https-only spec.
- [ ] **T24**. Custom record types: service, access rows, `CustomRecordAccessGuard`, `RECORD_TYPE_SOURCE` binding,
  numbering through `CUSTOM_FIELDS_NUMBERING` with `SequenceService.allocate` fallback. Files:
  `cf/custom-records/custom-record-type.service.ts`, `cf/custom-records/custom-record-type.controller.ts`,
  `cf/custom-records/dto/custom-record-type.dto.ts`, `cf/custom-records/custom-record-access.guard.ts`,
  `cf/custom-records/custom-record-type.source.ts`, `cf/custom-records/custom-record-numbering.service.ts`. Test: spec
  (kinds, delete refused with records, limits).
- [ ] **T25**. Generic custom record controller and GraphQL (list, detail, create, update, delete, restore, duplicate,
  bulk, owner change, lines saved with parent). Files: `cf/custom-records/custom-record.controller.ts`,
  `cf/custom-records/custom-record.service.ts`, `cf/custom-records/dto/custom-record.dto.ts`,
  `cf/graphql/custom-record.resolver.ts`. Test: e2e per access scope; stale version `409`.
- [ ] **T26** (parallel). Templates service and controller; user defaults under `user.uiPreferences.customFields`
  (`IUserUiPreferences` gains `customFields`); duplicate rule. Files: `cf/templates/record-template.service.ts`,
  `cf/templates/record-template.controller.ts`, `cf/templates/dto/record-template.dto.ts`,
  `cf/values/user-field-defaults.service.ts`, `cf/values/duplicate-values.ts`, `packages/contracts/src/lib/user.model.ts`.
  Test: specs (FR-45 to FR-47).
- [ ] **T27**. Ports `CUSTOM_FIELD_METADATA`, `CUSTOM_FIELD_VALUE_READER`, `CUSTOM_FIELD_VALUE_WRITER` provided by
  the plugin. Files: `cf/ports/custom-field-metadata.provider.ts`, `cf/ports/custom-field-value-reader.provider.ts`,
  `cf/ports/custom-field-value-writer.provider.ts`, `cf/custom-fields.module.ts`. Test: port contract specs with masks.
- [ ] **T28**. Events: `values.changed`, `definition.*`, `custom_record.<type>.*` on the outbox; realtime hints. Files:
  `cf/events/custom-fields-events.ts`, `cf/events/custom-fields-outbox.publisher.ts`,
  `cf/events/custom-fields-realtime.hints.ts`. Test:
  outbox spec (one event per commit, before and after values).
- [ ] **T29** (parallel). Plugin record type entries in `order`, `purchasing`, `inventory`, `warehouse`, `fulfillment`,
  `returns`, `subscription`, `pricing`, `promotion`, `catalog`. Files: each plugin's existing
  `packages/plugins/<plugin>/src/lib/<plugin>.plugin.ts` (for example `packages/plugins/order/src/lib/order.plugin.ts`)
  and a new `packages/plugins/<plugin>/src/lib/<plugin>.record-types.ts`. Test: registry spec per plugin.
- [ ] **T64**. Record type listing (FR-6): `GET /api/custom-fields/record-types` answers the registered types the caller
  may view with counts of fields, rules, layouts and actions; a type whose plugin is not loaded is not listed and its
  definitions and values stay stored. Files: `cf/record-types/record-types.controller.ts`,
  `cf/record-types/record-types.service.ts`. Test: e2e listing with counts; with a plugin unloaded its type is absent
  and its definition and value rows remain.
- [ ] **T65**. Auto-number fields (FR-32): at a record's first save the value subscriber takes the field's next number
  from the organization's series through `CUSTOM_FIELDS_NUMBERING` (fallback `SequenceService.allocate`, as T24); the
  value stays read-only afterwards. Files: `cf/values/auto-number.allocator.ts`,
  `cf/values/custom-field-value.subscriber.ts`. Test: two organizations number independently; a later save keeps the
  number; concurrent creates get distinct numbers.

## Phase 3 — UI surfaces

- [ ] **T30**. Embeddables `ui/` — metadata service (cache, 404 hidden), `ngx-custom-fields-section`, field renderers per
  type, browser rule evaluation. Files: `ui/custom-fields-metadata.service.ts`,
  `ui/custom-fields-section/custom-fields-section.component.ts`, `ui/field-renderers/` (one component per field family),
  `ui/custom-field-rules.evaluator.ts`, `ui/custom-fields.module.ts`. Test: component specs per type and rule kind.
- [ ] **T31**. `CustomFieldsRecordViewProvider` for `ngx-record-view` and `CustomFieldColumnsService` for lists with
  in-place editing. Files: `ui/custom-fields-record-view.provider.ts`, `ui/custom-field-columns.service.ts`. Test:
  rendering specs.
- [ ] **T32**. Wire the section into the existing pages for contacts, deals, vendors, projects, employees, items, tasks, invoices, expenses,
  candidates, equipment and time-off pages. Files: `apps/gauzy/src/app/pages/contacts/contact-mutation/contact-mutation.component.ts`,
  `apps/gauzy/src/app/pages/pipelines/pipeline-deals/pipeline-deal-form/pipeline-deal-form.component.ts`,
  `apps/gauzy/src/app/pages/vendors/vendors.component.ts`,
  `packages/ui-core/shared/src/lib/project/project-mutation/project-mutation.component.ts`,
  `apps/gauzy/src/app/pages/employees/edit-employee/edit-employee-profile/edit-employee-main/edit-employee-main.component.ts`,
  `apps/gauzy/src/app/pages/inventory/components/edit-inventory-item/product-form.component.ts`,
  `packages/ui-core/shared/src/lib/tasks/add-task-dialog/add-task-dialog.component.ts`,
  `apps/gauzy/src/app/pages/invoices/invoice-edit/invoice-edit.component.ts`,
  `packages/ui-core/shared/src/lib/expenses/expenses-mutation/expenses-mutation.component.ts`,
  `apps/gauzy/src/app/pages/candidates/edit-candidate/edit-candidate-profile/edit-candidate-main/edit-candidate-main.component.ts`,
  `packages/ui-core/shared/src/lib/equipment/equipment-mutation.component.ts`,
  `packages/ui-core/shared/src/lib/time-off/time-off-request-mutation/time-off-request-mutation.component.ts`. Test: page
  specs (nothing rendered when the feature is off).
- [ ] **T33**. `packages/plugins/custom-fields-ui`: Settings → Customisation, record types, fields, standard fields,
  settings pages; menu and route guard. Files: `cfui/custom-fields-ui.plugin.ts`, `cfui/custom-fields-ui.routes.ts`,
  `cfui/services/custom-fields-api.service.ts`, `cfui/components/record-types-page/record-types-page.component.ts`,
  `cfui/components/fields-page/fields-page.component.ts`,
  `cfui/components/standard-fields-page/standard-fields-page.component.ts`,
  `cfui/components/record-type-settings-page/record-type-settings-page.component.ts`,
  `packages/ui-core/i18n/assets/i18n/*.json` (`CUSTOM_FIELDS.*`). Test: component specs; i18n keys in every locale.
- [ ] **T34**. Rule editor with condition builder, formula editor and test pane. Files:
  `cfui/components/rule-editor/rule-editor.component.ts`, `cfui/components/formula-editor/formula-editor.component.ts`,
  `cfui/components/formula-test-pane/formula-test-pane.component.ts`. Test: component specs; keyboard spec.
- [ ] **T35**. Layout designer (drag and drop and keyboard list editor, preview by role, device and record, versions).
  Files: `cfui/components/layout-designer/layout-designer.component.ts`,
  `cfui/components/layout-list-editor/layout-list-editor.component.ts`,
  `cfui/components/layout-preview/layout-preview.component.ts`,
  `cfui/components/layout-versions/layout-versions.component.ts`. Test: component specs; accessibility spec.
- [ ] **T36**. `ngx-dynamic-record-form`, `ngx-quick-entry-dialog`, `ngx-line-editor`, `ngx-form-actions-bar`,
  `ngxFieldOverride`. Files: `ui/dynamic-record-form/dynamic-record-form.component.ts`,
  `ui/quick-entry-dialog/quick-entry-dialog.component.ts`, `ui/line-editor/line-editor.component.ts`,
  `ui/form-actions-bar/form-actions-bar.component.ts`, `ui/field-override.directive.ts`. Test: specs (quick entry
  creates and selects; lines all or nothing; actions bar shows results and refusal reasons).
- [ ] **T37**. Custom record type builder; detail and create forms registered for `/pages/records/:typeKey` (the list is
  the generic record list of `record-views-and-search`, its T17 and T18) with menu entries, shown only while that
  route answers; without it a type's records open by direct link to their detail form. Files:
  `cfui/components/record-type-builder/record-type-builder.component.ts`,
  `cfui/components/custom-record-form/custom-record-form.component.ts`, `cfui/custom-fields-ui.routes.ts`,
  `cfui/custom-records-menu.ts`. Test: component specs; e2e create a type
  and a record.
- [ ] **T38** (parallel). Phone rendering of `ngx-dynamic-record-form` and `ngx-custom-fields-section` in the
  installable Gauzy web app (touch sizes, offline draft kept and re-validated on sync); no separate React package.
  Files: `ui/dynamic-record-form/dynamic-record-form.component.scss`,
  `ui/custom-fields-section/custom-fields-section.component.scss`, `ui/offline-draft.service.ts`. Test: rendering specs
  at phone width; offline draft spec.
- [ ] **T66**. Related-records panel and option badges (FR-40): the layout element `related-records` renders tiles
  counting the records of other types linked to the record, each opening the filtered list or creating a linked record;
  choice options show their colours as badges in forms, lists and record views. Files:
  `ui/related-records-panel/related-records-panel.component.ts`, `ui/field-renderers/choice-badge.component.ts`. Test:
  component spec (counts per linked type; a tile opens the filtered list; create links the new record; badge colours).
- [ ] **T67**. Language, formats and theme of forms (FR-42): field renderers and `ngx-dynamic-record-form` use the user's
  language, time zone, date, time and number formats and the current theme from the existing user and organization
  settings. Files: `ui/field-renderers/field-format.service.ts`, `ui/dynamic-record-form/dynamic-record-form.component.ts`.
  Test: component spec under two languages and time zones and the dark theme.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. MCP tools `packages/mcp-server/src/lib/tools/custom-fields.ts` (plan §7) registered in
  `register-all-tools.ts`. Test: tool specs (`preview` writes nothing; masks honoured).
- [ ] **T40**. Report datasets (FR-87) registered in the core reports catalogue and with the report builder when
  present, listed only for tenants with the feature on (FR-93, T60). Files: `cf/reports/custom-fields-reports.service.ts`,
  `cf/reports/custom-fields-reports.controller.ts`, `cf/reports/custom-fields-report-catalogue.ts`. Test: dataset specs on
  seeded data; the reports appear in the Reports menu with the feature on and are absent from the Reports page and menu
  with it off.
- [ ] **T41** (parallel). OpenAPI regenerated; SDK regeneration noted for the release; schema route documented. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; docs build.
- [ ] **T42**. User docs (customisation guide, formula function list) and `docs/specs/README.md` index row. Test: docs build.
- [ ] **T69**. Searchable custom fields (FR-70): values of fields with the `search` behaviour join their record's search
  document when the search plugin is loaded (read through `CUSTOM_FIELD_VALUE_READER`, masks applied) and reference
  pickers match them. Files: `cf/search/custom-fields-search.contributor.ts`,
  `packages/plugins/search/src/lib/services/search-document.builder.ts`. Test: a record is found by a searchable field's
  value in global search and in a picker; a masked value finds nothing for a user without its view permission; search
  documents of tenants with the feature off are unchanged.

## Phase 5 — Advanced capabilities (plan phase 3)

- [ ] **T43**. Formula fields: computation on save in the subscriber, dependents across records through
  `subscriber:custom-fields-computed`, `custom-fields.recompute` job with checkpoints. Files:
  `cf/computed/formula-field.computer.ts`, `cf/values/custom-field-value.subscriber.ts`,
  `cf/events/custom-fields-computed.consumer.ts`, `cf/schedule/custom-fields-recompute.worker.ts`. Test: specs (recompute
  within a minute, newer value never overwritten).
- [ ] **T44**. Roll-up fields: source relations from the registry, dirty capture after commit, aggregate queries,
  nightly `custom-fields.rollup.reconcile`. Files: `cf/computed/rollup.service.ts`, `cf/computed/rollup-dirty.capture.ts`,
  `cf/schedule/custom-fields-rollup-reconcile.scheduler.ts`. Test: specs per aggregate; drift repaired by the reconcile.
- [ ] **T45**. Tracked-time roll-ups (hours and cost over periods, rate source port). Files:
  `cf/computed/tracked-time-rollup.ts`, `cf/computed/rate-source.port.ts`. Test: spec with time logs.
- [ ] **T46**. Field health view and computed-field errors. Files: `cf/definitions/field-health.service.ts`,
  `cf/definitions/custom-field-definition.controller.ts` (`…/:id/health`). Test: spec (division by zero leaves empty,
  save succeeds).
- [ ] **T47**. Impact analysis (layouts, rules, formulas, roll-ups, actions, workflows, automations, saved views, report
  definitions, print and import templates, API reads of 30 days) through a usage registry other plugins contribute to.
  Files: `cf/impact/field-usage.registry.ts`, `cf/impact/field-impact.service.ts`,
  `cf/definitions/custom-field-definition.controller.ts` (`…/:id/impact`). Test: spec with seeded usages.
- [ ] **T48**. Type conversion with preview and `custom-fields.convert` job. Files:
  `cf/conversion/field-conversion.service.ts`, `cf/schedule/custom-fields-convert.worker.ts`. Test: spec (counts and
  failures listed; old field deprecated).
- [ ] **T49**. Packages: export, import with diff and choices, undo; `custom-fields.package.import` job. Files:
  `cf/packages/customization-package.service.ts`, `cf/packages/customization-package.controller.ts`,
  `cf/packages/dto/customization-package.dto.ts`, `cf/schedule/custom-fields-package-import.worker.ts`. Test: e2e across
  two tenants on SQLite; undo refused once values exist.
- [ ] **T50**. Organization variants of fields and overrides in validation, forms, reports. Files:
  `cf/definitions/organization-scope.ts`, `cf/values/value-validator.ts`, `cf/metadata/custom-field-metadata.service.ts`.
  Test: spec (FR-19).
- [ ] **T51**. Assistant drafting (`custom_fields_draft`) and agent writes marked in history. Files:
  `cf/assistant/custom-fields-draft.service.ts`, `packages/mcp-server/src/lib/tools/custom-fields.ts`,
  `cf/history/custom-field-history.service.ts`. Test: spec (nothing
  published by an agent).
- [ ] **T52**. Performance benchmark at one million records and 20 million values on PostgreSQL and MySQL; index tuning
  notes in the plan. Files: `cf/benchmarks/custom-field-values.bench.ts`,
  `docs/specs/features/custom-fields-and-forms/plan.md`. Test: benchmark report attached to the PR.
- [ ] **T53**. Real-time publication hints in the Angular app (form keeps input, applies at next open; live values).
  Files: `ui/custom-fields-realtime.service.ts`, `ui/custom-fields-metadata.service.ts`. Test: two-client spec.
- [ ] **T54**. Layout rendering of standard pages (contacts, deals, vendors, projects, employees, items) behind the
  per-type setting `form.layoutRendering` (default off): with it off, and with the feature off, each page shows its
  existing form (with the custom field section when the feature is on). Files: `ui/layout-rendering.service.ts` and the
  six page components wired in T32. Test: page specs for feature off, feature on
  with the setting off, setting on, and setting switched back off.
- [ ] **T55** (parallel). Phone layouts resolved for the installable Gauzy web app (device `PHONE`), with T38's
  rendering. Files: `cf/layouts/form-layout.resolver.ts`, `ui/custom-fields-metadata.service.ts`. Test: a phone layout
  is picked on a phone-width client and the desktop layout elsewhere.
- [ ] **T68**. Packages shipped by plugins and marketplace apps (FR-83): a plugin registers its customisation package,
  applied at load with `source` `PLUGIN` or `PACKAGE` and its `sourceRef`; such items change only through overrides
  (edits of the definitions refused) and are hidden, not deleted, while the plugin is disabled. Files:
  `cf/packages/plugin-package.registry.ts`, `cf/definitions/custom-field-definition.service.ts`. Test: a test plugin's
  package appears with its source; a direct edit is refused and an override applies; disabling the plugin hides the
  items and keeps their values.

## Phase 6 — Scripts on self-hosted installations

- [ ] **T56**. Core tenant script runtime `packages/core/src/lib/tenant-script/` (shared with automation flows):
  `GAUZY_TENANT_SCRIPTS_ENABLED` (exactly `true`) and the deployment marker `GAUZY_DEPLOYMENT` in `@gauzy/config`
  (`packages/config/src/lib/config/tenant-scripts.ts`), the
  switch refused at start-up on `cloud`; worker-process pool without network, file system, environment or credentials;
  time and memory limits; core migration
  `packages/core/src/lib/database/migrations/1791000030900-CreateTenantScriptRun.ts` and its writer (FR-88, FR-90,
  FR-91). Files: `tenant-script.runtime.ts`, `tenant-script.pool.ts`, `tenant-script-run.entity.ts`,
  `tenant-script-run.writer.ts` in that folder. Test: a script
  over its time or memory limit is killed and recorded; a script reaching for the network or files fails; with
  `GAUZY_DEPLOYMENT=cloud` and the switch on, boot logs the refusal and the runtime refuses every call.
  Migration timestamps: `1791000030900` to `1791000030999` (`packages/core`).
- [ ] **T57**. Script formulas `cf/scripts/` (`script-formula.service.ts`, `custom-field-scripts.controller.ts`):
  `config.script` on computed fields, test route, publish and deprecate as
  formulas, health view entries for failures, `CUSTOM_FIELD_SCRIPTS_MANAGE` contribution (`defaultFor` super admin),
  script changes as `activity_log` rows, run audit route (FR-89, FR-91). Test: a script field computes on save and in
  recompute; without the permission `403`; every run has a `tenant_script_run` row.
- [ ] **T58**. Cloud refusal suite: with the deployment marker `cloud`, script fields cannot be saved or published,
  script routes answer `403`, and package imports containing scripts are refused for those items (AC-16). Files:
  `cf/scripts/custom-field-scripts.controller.ts`, `cf/definitions/custom-field-definition.service.ts`,
  `cf/packages/customization-package.service.ts`. Test: e2e on
  SQLite with the marker set and unset.
- [ ] **T59**. Question sets: built by T63 (Phase 1, `packages/utils/src/lib/question-set/`); its tests are T63's.
- [ ] **T60**. Catalogue rows by feature (FR-93): the category of the FR-87 reports keyed `FEATURE_CUSTOM_FIELDS` in the
  shared catalogue feature filter of `report-builder-and-dashboards` (its T51: core migration
  `1791000037900-AddReportCategoryFeatureKey` and the filter in `packages/core/src/lib/reports/report.service.ts`,
  `report-category.service.ts` and `report-organization.service.ts`, which skip categories and rows whose feature is
  off for the tenant); nothing of that filter is built here. Test: with the feature off the Reports page, menu and a new organization's report switches equal today's;
  with it on the rows appear.
- [ ] **T61**. Flag-off pass-through (FR-62): the values interceptor, the response interceptor and the value subscriber
  do nothing for tenants with `FEATURE_CUSTOM_FIELDS` off. Files: `cf/values/custom-field-values.interceptor.ts`,
  `cf/values/custom-field-values.response.interceptor.ts`, `cf/values/custom-field-value.subscriber.ts`. Test: e2e on
  contacts and projects with the feature off; the request and response bodies equal today's snapshots.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T4, T11, T12, T33, T39 |
| FR-2–FR-3 | §3.1 Scope, flags and compatibility | T12 |
| FR-4 | §3.1 Scope, flags and compatibility | T1, T15, T41 |
| FR-5 | §3.2 Record types | T2 |
| FR-6 | §3.2 Record types | T64 |
| FR-7 | §3.2 Record types | T21, T33 |
| FR-8 | §3.3 Field definitions and types | T12 |
| FR-9 | §3.3 Field definitions and types | T12, T13, T30 |
| FR-10 | §3.3 Field definitions and types | T12, T13 |
| FR-11 | §3.3 Field definitions and types | T13, T30 |
| FR-12 | §3.3 Field definitions and types | T12, T25, T36 |
| FR-13 | §3.3 Field definitions and types | T12 |
| FR-14 | §3.4 Behaviour, validation and standard fields | T12, T13 |
| FR-15 | §3.4 Behaviour, validation and standard fields | T13, T14 |
| FR-16 | §3.4 Behaviour, validation and standard fields | T13 |
| FR-17 | §3.4 Behaviour, validation and standard fields | T13, T15 |
| FR-18 | §3.4 Behaviour, validation and standard fields | T17, T36 |
| FR-19 | §3.4 Behaviour, validation and standard fields | T50 |
| FR-20 | §3.5 Field rules and the formula language | T18 |
| FR-21 | §3.5 Field rules and the formula language | T18, T34 |
| FR-22 | §3.5 Field rules and the formula language | T3 |
| FR-23 | §3.5 Field rules and the formula language | T3, T18, T30 |
| FR-24 | §3.5 Field rules and the formula language | T18 |
| FR-25 | §3.5 Field rules and the formula language | T18, T34 |
| FR-26 | §3.5 Field rules and the formula language | T18, T30 |
| FR-27 | §3.6 Computed and roll-up fields | T43 |
| FR-28 | §3.6 Computed and roll-up fields | T44 |
| FR-29 | §3.6 Computed and roll-up fields | T45 |
| FR-30 | §3.6 Computed and roll-up fields | T46 |
| FR-31 | §3.6 Computed and roll-up fields | T43 |
| FR-32 | §3.6 Computed and roll-up fields | T65 |
| FR-33 | §3.7 Form layouts | T19, T35 |
| FR-34–FR-36 | §3.7 Form layouts | T19 |
| FR-37 | §3.7 Form layouts | T19, T35 |
| FR-38 | §3.7 Form layouts | T19 |
| FR-39 | §3.7 Form layouts | T19, T20 |
| FR-40 | §3.7 Form layouts | T66 |
| FR-41 | §3.7 Form layouts | T32, T37, T38, T54 |
| FR-42 | §3.7 Form layouts | T67 |
| FR-43–FR-44 | §3.8 Quick entry, lines, templates and defaults | T36 |
| FR-45–FR-47 | §3.8 Quick entry, lines, templates and defaults | T26 |
| FR-48 | §3.8 Quick entry, lines, templates and defaults | T21 |
| FR-49 | §3.9 Form actions | T23, T36 |
| FR-50 | §3.9 Form actions | T23 |
| FR-51 | §3.9 Form actions | T23, T36, T39 |
| FR-52 | §3.9 Form actions | T23, T56, T58 |
| FR-53 | §3.10 Custom record types | T24, T37 |
| FR-54 | §3.10 Custom record types | T9, T24 |
| FR-55 | §3.10 Custom record types | T24 |
| FR-56 | §3.10 Custom record types | T24, T37 |
| FR-57 | §3.10 Custom record types | T24, T25 |
| FR-58 | §3.10 Custom record types | T25, T28, T37, T39 |
| FR-59 | §3.10 Custom record types | T25 |
| FR-60–FR-61 | §3.10 Custom record types | T24 |
| FR-62 | §3.11 Custom fields everywhere | T14, T15, T61 |
| FR-63 | §3.11 Custom fields everywhere | T15 |
| FR-64 | §3.11 Custom fields everywhere | T20 |
| FR-65 | §3.11 Custom fields everywhere | T15, T20 |
| FR-66 | §3.11 Custom fields everywhere | T22, T62 |
| FR-67 | §3.11 Custom fields everywhere | T27 (columns, filters and grouping: `report-builder-and-dashboards` T22) |
| FR-68 | §3.11 Custom fields everywhere | T27 (import and export columns: `data-import-export` T22) |
| FR-69 | §3.11 Custom fields everywhere | T27 (print data: `print-and-pdf-designer` T12) |
| FR-70 | §3.11 Custom fields everywhere | T69 |
| FR-71 | §3.11 Custom fields everywhere | T28 |
| FR-72 | §3.11 Custom fields everywhere | T39 |
| FR-73 | §3.11 Custom fields everywhere | T31 |
| FR-74 | §3.12 Field history and audit | T14, T16, T51 |
| FR-75 | §3.12 Field history and audit | T16 |
| FR-76–FR-77 | §3.12 Field history and audit | T16 |
| FR-78 | §3.13 Lifecycle, packages, agents and real time | T12 |
| FR-79 | §3.13 Lifecycle, packages, agents and real time | T47 |
| FR-80 | §3.13 Lifecycle, packages, agents and real time | T48 |
| FR-81 | §3.13 Lifecycle, packages, agents and real time | T12 |
| FR-82 | §3.13 Lifecycle, packages, agents and real time | T49 |
| FR-83 | §3.13 Lifecycle, packages, agents and real time | T68 |
| FR-84 | §3.13 Lifecycle, packages, agents and real time | T51 |
| FR-85 | §3.13 Lifecycle, packages, agents and real time | T39, T51 |
| FR-86 | §3.13 Lifecycle, packages, agents and real time | T53 |
| FR-87 | §3.14 Reports | T40, T60 |
| FR-88 | §3.15 Scripts on self-hosted installations | T56 |
| FR-89 | §3.15 Scripts on self-hosted installations | T57 |
| FR-90 | §3.15 Scripts on self-hosted installations | T56 |
| FR-91 | §3.15 Scripts on self-hosted installations | T56, T57 |
| FR-92 | §3.7 Form layouts | T63 |
| FR-93 | §3.14 Reports | T40, T60 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: a field added to contacts reaches form, list, filter, report, import, export, print, API and MCP with
  no restart (AC-1); the same rule verdict in Angular and server (AC-3); masked values absent on every surface;
  record and values commit together or not at all; with `FEATURE_CUSTOM_FIELDS` off every route answers `404`, record
  routes and the Reports page answer as today, code-declared fields still work, and the list budget holds at one
  million records (AC-15); standard pages keep their existing forms until their type is switched to layout rendering
  (AC-17); on the cloud deployment
  the script switch is refused and script fields answer `403` (AC-16).
