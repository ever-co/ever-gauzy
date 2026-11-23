# Task Breakdown: Regional compliance packs

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `regional-compliance-packs`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flags: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Gating: pack, rule, address, checker and payroll-hook tasks check `FEATURE_REGIONAL_PACKS`; e-invoicing and code
  list tasks (T6, T22 to T28, T37, T38, T49, T52) check `FEATURE_E_INVOICING`.
- Path prefixes: `rp/` = `packages/plugins/regional-packs/src/lib/`, `ei/` = `packages/plugins/e-invoicing/src/lib/`,
  `rpui/` = `packages/plugins/regional-packs-ui/src/lib/`, `eiui/` = `packages/plugins/e-invoicing-ui/src/lib/`.
  A country pack `packages/plugins/regional-<iso2>/src/lib/` holds `regional-<iso2>.plugin.ts` and `pack/`
  (`manifest.json`, one JSON file per section under `pack/sections/`, `pack/tests/*.json`, `pack/i18n/<locale>.json`).
  Each entity has its MikroORM repository beside it in `repository/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/regional/` (manifest, section content types incl. return
      layouts and their export mapping, installation, run result, preview, diff, document rule headers and findings,
      hooks) and JSON Schemas of the pack format; `RuleOwnerType.REGIONAL_RULE`; export from `index.ts`. Files:
      `packages/contracts/src/lib/regional/regional-pack.model.ts`, `regional-rule.model.ts`, `regional-hooks.model.ts`,
      `packages/contracts/src/lib/regional/schemas/`, `packages/contracts/src/lib/rule.model.ts`. Test: schemas
      accept the sample pack and reject malformed ones.
- [ ] **T2**. Plugin scaffold `packages/plugins/regional-packs` (package, project, tsconfig, jest, eslint, path
      mapping), `regional-packs.plugin.ts`, `regional-packs.features.ts` (`FEATURE_REGIONAL_PACKS`, default off),
      `regional-packs.permissions.ts`; registered in `apps/api/src/plugins.ts`. Test: plugin list spec; `404` with
      the feature off; with the feature off no pack is proposed and no rule is evaluated.
- [ ] **T3**. Migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
      `rp/database/migrations/1791000083100-CreateRegionalPackTables.ts` (incl. `regional_document_rule`) and
      `rp/database/migrations/1791000083110-CreateRegionalComplianceCheckTable.ts`; entities and both repositories
      `rp/pack/regional-pack-version.entity.ts`, `rp/installation/regional-pack-installation.entity.ts`,
      `rp/installation/regional-pack-content-record.entity.ts`, `rp/self-test/regional-self-test-result.entity.ts`,
      `rp/address/regional-address-format.entity.ts`, `rp/rules/regional-document-rule.entity.ts`,
      `rp/compliance/regional-compliance-check.entity.ts`. Test: migration specs on SQLite; unique keys hold on the
      three dialects.
- [ ] **T4**. Default role grants as `defaultFor` on the permission contributions (no seed migration);
      `regional-packs.settings.ts` (automatic apply, automatic rate upgrades). Files: `rp/regional-packs.permissions.ts`,
      `rp/regional-packs.settings.ts`. Test: grants resolve; settings resolve per organization.
- [ ] **T5**. Port tokens with no-op defaults in `src/lib/ports/` and bindings in
      `apps/api/src/plugin-composition.ts` (`REGIONAL_HOLIDAYS` bound to core `official-holiday`,
      `REGIONAL_TAX_CONTENT` to the `tax` plugin's services: rates, withholding, account-map rows, return layouts and
      export mappings; `REGIONAL_TAX_PERIODS` to its periods; `REGIONAL_STATEMENT_LAYOUTS` to the layout service of
      `financial-reports`). Files: `rp/ports/regional.ports.ts`, `rp/ports/regional-port-defaults.ts`. Test: installer
      runs with every other port unbound and reports the skipped sections.
- [ ] **T6** (parallel). Contracts `e-invoice.model.ts`, `code-list.model.ts`; plugin scaffold
      `packages/plugins/e-invoicing` with `e-invoicing.features.ts` (`FEATURE_E_INVOICING`), permission contributions
      with `defaultFor`, `e-invoicing.settings.ts` (import defaults), migrations
      `ei/database/migrations/1791000083200-CreateEInvoiceTables.ts`,
      `ei/database/migrations/1791000083210-CreateCodeListTables.ts`, entities `ei/register/e-invoice-profile-setting.entity.ts`,
      `ei/register/e-invoice-document.entity.ts`, `ei/register/e-invoice-event.entity.ts`,
      `ei/transports/e-invoice-transport.entity.ts`, `ei/code-lists/code-list.entity.ts`,
      `ei/code-lists/code-list-entry.entity.ts`, `ei/code-lists/code-list-mapping.entity.ts`. Test: migration and plugin
      list specs; with the feature off nothing is generated, sent or imported.
      Migration timestamps: `1791000083200` to `1791000083299` (`packages/plugins/e-invoicing`).

## Phase 2 — Services, endpoints, events

- [ ] **T7**. `RegionalPackRegistry` (register in `onPluginBootstrap`, versions, lookup by country, tenant versions
      from `regional_pack_version`) and the pack validator (schema, references, test-case shape). Files:
      `rp/pack/regional-pack.registry.ts`, `rp/pack/regional-pack.validator.ts`. Test: unit; invalid pack refused with a
      report; a tenant-private version is invisible to another tenant.
- [ ] **T8**. Installer core: preview, apply as a core operation `REGIONAL_PACK_APPLY` (one step per section, cursor
      in the operation state), content ledger with checksums, clash handling, one live operation per organization;
      one primary pack per organization and secondary packs limited to tax content, statutory fields, reports and
      e-invoice profiles; who, when, before and after recorded per content record.
      Files: `rp/installation/regional-pack-installer.service.ts`, `rp/installation/regional-pack-apply.operation.ts`,
      `rp/installation/regional-pack-preview.service.ts`, `rp/installation/content-ledger.service.ts`. Test: SQLite
      end-to-end; an operation killed midway resumes and creates nothing twice; second concurrent run answers `409`; a
      second primary pack is refused; a run with undated content (`validFromKey` `-`) killed and resumed writes one
      ledger record per content key on PostgreSQL, MySQL and SQLite.
- [ ] **T9**. Section handlers: tax content (categories, rates with parts, regimes with windows) and statutory
      fields (format, check-digit and required-when checks as warnings unless `regional.fieldChecksBlocking` is on).
      Files: `rp/sections/tax-content.section.ts`, `rp/sections/statutory-fields.section.ts`,
      `rp/sections/field-checks.ts`. Test: applied content equals the pack files; dated rates select by document date;
      a contact that saves today still saves with the default setting, with the warning shown.
- [ ] **T10**. Address formats: registry, base set (nine countries and default), `/address-formats/:countryCode`,
      formatter and validator used by print and structured files and, for organizations with a pack, by forms
      (warnings unless `regional.addressChecksBlocking` is on), tenant override. Files:
      `rp/address/address-format.registry.ts`, `rp/address/address-formats/` (base set JSON),
      `rp/address/address-formatter.ts`, `rp/address/address-format.controller.ts`. Test: golden addresses per country;
      an address that saves today still saves with the default setting; stored addresses unchanged.
- [ ] **T11**. Catalogue, installation, run and content endpoints (`regional-pack.controller.ts`,
      `regional-pack-installation.controller.ts`). Files: `rp/pack/regional-pack.controller.ts`,
      `rp/installation/regional-pack-installation.controller.ts`. Test: e2e with permission checks; idempotency key on
      runs.
- [ ] **T12**. Pack proposal on organization creation or country change (consumer of core facts), tenant setting
      for automatic apply. Files: `rp/installation/pack-proposal.consumer.ts`. Test: organization without a pack gets
      no proposal.
- [ ] **T13**. Country plugin scaffolds `packages/plugins/regional-us`, `regional-gb`, `regional-de`, `regional-in`
      (content files, test cases, registration; holidays and address formats first). Files:
      `packages/plugins/regional-us/src/lib/regional-us.plugin.ts`, `packages/plugins/regional-us/src/lib/pack/manifest.json`
      and the same files in `regional-gb`, `regional-de`, `regional-in`. Test: each pack validates and its test cases
      pass in CI on the three dialects.
- [ ] **T14**. Section handlers: chart templates, print layouts (optional section; assigned only to the types picked
      in the preview), role bundles, report definitions, holidays. Files: `rp/sections/chart-templates.section.ts`,
      `rp/sections/print-layouts.section.ts`, `rp/sections/role-bundles.section.ts`,
      `rp/sections/report-definitions.section.ts`, `rp/sections/holidays.section.ts`. Test: fake ports receive the
      expected calls; holidays land in `official_holiday` once; without a pick the invoice layout stays assigned.
- [ ] **T15**. Document rules on the core rule engine: `regional_document_rule` headers (rule kinds of spec FR-28)
      whose conditions are `rule` rows (`REGIONAL_RULE`, context mapping of documents and lines registered with
      `rule.validator.ts`), evaluated by `evaluateRuleSet`, typed functions for extended packs; the document check
      slot adapter (`REGIONAL_DOCUMENT_CHECKS`): draft warnings, blocking at confirm, cancel and delete; overrides of
      adjustable rules on the header; blocking rules on document types that exist today installed as warnings until
      enforced (spec FR-107). Files: `rp/rules/regional-document-rule.service.ts`, `rp/rules/regional-rule.context.ts`,
      `rp/rules/regional-document-checks.adapter.ts`, `rp/rules/regional-rule.controller.ts`; core
      `packages/core/src/lib/rule/rule.validator.ts`. Test: rule cases per kind; with the default the deletion of a
      confirmed invoice proceeds with the warning recorded; once enforced the deletion lock refuses with rule and pack
      named; an organization without a pack confirms and deletes documents as today.
- [ ] **T16**. Reverse-charge recomputation and credit-note treatment check through the tax content port; rounding
      and convention settings; `RegionalHookRegistry` with `taxRoundingRule` and `depreciationConvention`. Files:
      `rp/hooks/regional-hook.registry.ts`, `rp/tax/reverse-charge.service.ts`, `rp/tax/credit-note-treatment.check.ts`.
      Test: golden documents.
- [ ] **T17**. Tax account map content: rows filled from the chart template and handed to `tax_account_mapping` of
      `tax-engine` through `REGIONAL_TAX_CONTENT` (validated there, recorded in the content ledger). Files:
      `rp/sections/tax-account-map.section.ts`. Test: map survives an organization rename; no second map exists.
- [ ] **T18**. Return content: section handler that hands return layouts (boxes as tax-register filters and
      formulas) and the authority's export mapping to `tax-engine`, which registers them with the layout model of
      `financial-reports`; preparation, drill-down, freezing, adjustments and export run on its tax periods. Files:
      `rp/sections/return-layouts.section.ts`. Test: boxes of a seeded period equal the sums of seeded tax lines;
      drill-down returns the same documents; the structured export matches the pack's sample file.
- [ ] **T19**. Tax audit trail report definition (every pack) and pack status report. Files:
      `rp/reports/tax-audit-trail.report.ts`, `rp/reports/pack-status.report.ts`. Test: figures agree with seeded
      documents.
- [ ] **T20**. Accounting side of `regional-us`, `regional-gb` and `regional-de` (charts, tax content, statutory
      fields, document rules, layouts, the returns of FR-88, FR-104 and FR-105 with the digital summary file of the
      United Kingdom return) with test cases. Files: `packages/plugins/regional-us/src/lib/pack/sections/`,
      `packages/plugins/regional-gb/src/lib/pack/sections/`, `packages/plugins/regional-de/src/lib/pack/sections/`
      (`chart.json`, `tax.json`, `fields.json`, `rules.json`, `print.json`, `returns.json`) and their `pack/tests/`.
      Test: pack test cases in CI.
- [ ] **T21**. Withholding content section and reports (summary, details, certificate use) on the tax engine's
      withholding. Files: `rp/sections/withholding.section.ts`, `rp/reports/withholding.reports.ts`. Test: fake port
      contract test; report figures for the pack's test documents.
- [ ] **T22**. Code lists: CRUD, genericode import, versions, mappings single and bulk, default entry, delete
      guards. Files: `ei/code-lists/code-list.service.ts`, `ei/code-lists/code-list.controller.ts`,
      `ei/code-lists/genericode.importer.ts`, `ei/code-lists/code-list-mapping.service.ts`. Test: a record cannot map to
      two codes of one list; import of a published sample list; a record without a required mapping gives a finding.
- [ ] **T23**. Profile framework (`profiles/`): `IEInvoiceProfile` (map, build, validate, read), XML builder,
      schema validation, rule tables, findings. Files: `ei/profiles/e-invoice-profile.ts`, `ei/profiles/xml-builder.ts`,
      `ei/profiles/schema-validator.ts`, `ei/profiles/rule-tables/`. Test: conformance files of the European standard
      validate; broken samples produce the expected findings.
- [ ] **T24**. Profiles: European standard in both syntaxes and hybrid PDF through `E_INVOICING_PRINT`, with the
      marks a profile requires (scannable code, transmission reference) printed on the document's layout. Files:
      `ei/profiles/en16931-ubl.profile.ts`, `ei/profiles/en16931-cii.profile.ts`, `ei/profiles/hybrid-pdf.profile.ts`.
      Test: generated files for the pack's test invoices validate; the printed layout carries the required marks.
- [ ] **T25**. Germany pack e-invoicing: the German profiles of the European standard (both syntaxes and hybrid PDF)
      with their mandatory data checks, sending and receiving for business customers and suppliers. Files:
      `ei/profiles/de/`, `packages/plugins/regional-de/src/lib/pack/sections/e-invoicing.json`. Test: generated
      files validate; missing buyer reference gives a blocking finding; a received file drafts a bill.
- [ ] **T26**. E-invoice service and register: generate on confirm or on demand (consumer of invoice events),
      progressive numbering through one gap-free series per organization shared by every profile, versions on
      amendment, cancellation handling, attach to the document, endpoints; blocking findings stop transmission and,
      when the profile's `blockConfirmOnFindings` is on, confirmation through a synchronous pre-confirm check bound to
      `REGIONAL_DOCUMENT_CHECKS` (the consumer only generates after a successful confirmation).
      Files: `ei/register/e-invoice.service.ts`, `ei/register/e-invoice.controller.ts`,
      `ei/register/e-invoice-invoice-events.consumer.ts`, `ei/register/transmission-numbering.ts`,
      `ei/register/e-invoice-preconfirm.check.ts`. Test: no gap or reuse under concurrent confirms, two profiles of one
      organization never allocate the same number or file name; amendment supersedes; a blocking finding stops the
      send; with `blockConfirmOnFindings` on an invalid invoice is refused at confirmation and stays a draft, with it
      off it confirms and its e-invoice is `INVALID` with the findings and is not sent.
- [ ] **T27**. Transports `download`, `email` and `simulator`; queue `e-invoice-transmit` with backoff, status
      events, inbox items on rejected and failed; batch export. Files: `ei/transports/download.transport.ts`,
      `ei/transports/email.transport.ts`, `ei/transports/simulator.transport.ts`, `ei/transports/transmit.processor.ts`,
      `ei/register/e-invoice-export.service.ts`. Test: state machine against the simulator; retry ends after 72 hours
      of simulated time.
- [ ] **T28**. Inbound import: upload endpoint, core operation `E_INVOICE_INBOUND_IMPORT`, readers of both shipped
      profiles, refusal reasons, signature envelope handling, each readable file handed to the capture register of
      `invoicing-receivables-payables` through `E_INVOICING_CAPTURES` (source `STRUCTURED`; supplier and line
      matching with the import defaults of the settings store, bill draft), result log in the operation result. Files:
      `ei/inbound/inbound-import.operation.ts`, `ei/inbound/inbound.controller.ts`, `ei/inbound/signature-envelope.ts`.
      Test: archive with valid, duplicate, foreign and unreadable files.
- [ ] **T29**. Payroll content section and hooks (`exemptionForDeclaration`, `exemptionForPeriod`, `taxRelief`,
      `regionalDeductions`, `employerContributions`, `costToCompanyComponents`, `endOfServiceAmount`). Files:
      `rp/sections/payroll-content.section.ts`, `rp/hooks/regional-hook.registry.ts`. Test: the registry returns
      nothing for a country without payroll content.
- [ ] **T30**. Country plugin `regional-in`: chart, goods and services tax content, withholding content, employee
      fields, deduction tags, rent-allowance exemption, marginal relief with surcharge and cess, pay element
      templates, end-of-service rule, payroll reports, test cases. Files:
      `packages/plugins/regional-in/src/lib/pack/sections/`, `packages/plugins/regional-in/src/lib/hooks/rent-allowance-exemption.ts`,
      `packages/plugins/regional-in/src/lib/hooks/marginal-relief.ts`, `packages/plugins/regional-in/src/lib/hooks/end-of-service.ts`,
      `packages/plugins/regional-in/src/lib/pack/tests/`. Test: pack test cases (exemption least-of-three, relief band,
      end-of-service amounts).
- [ ] **T31** (parallel). Payroll side of `regional-gb`, `regional-us` and `regional-de` (FR-101 to FR-103) with the
      payroll reports of FR-106 and salary bank-file layouts, test cases. Files:
      `packages/plugins/regional-gb/src/lib/hooks/`, `packages/plugins/regional-us/src/lib/hooks/`,
      `packages/plugins/regional-de/src/lib/hooks/` and each pack's `pack/sections/payroll.json`. Test: tax and
      contribution amounts per pack test case; period submission data and yearly statements match the test payslips.
- [ ] **T32**. Outbox events of plan §5, real-time hints, inbox items, email templates. Files:
      `rp/events/regional.events.ts`, `ei/events/e-invoicing.events.ts`. Test: each event once per state change.
- [ ] **T56**. Detach: operation `REGIONAL_PACK_DETACH` archives pack content no document uses, keeps content in use,
      changes and deletes no document, and records the run in the history. Files:
      `rp/installation/regional-pack-detach.operation.ts`, route `/regional-pack-installations/:id/detach` in
      `rp/installation/regional-pack-installation.controller.ts`. Test: `regional-pack-detach.operation.spec.ts`: a rate
      used by a confirmed invoice stays, an unused one is archived, no document row changes.

## Phase 3 — UI surfaces

- [ ] **T33**. Angular plugin scaffold `packages/plugins/regional-packs-ui`, registered in
      `apps/gauzy/src/plugin-ui.config.ts`; Settings → Regional: catalogue, pack page, apply wizard with preview.
      Files: `rpui/regional-packs-ui.plugin.ts`, `rpui/catalogue/pack-catalogue.component.ts`,
      `rpui/pack/pack-page.component.ts`, `rpui/apply/apply-wizard.component.ts`. Test: plugin and rendering specs;
      hidden without the feature; the pack page states the content date and what it does not cover.
- [ ] **T34**. Run history (core operations) and rules pages with overrides and the enforcement switches of spec
      FR-107 (per rule, field checks, address checks; also offered in the apply preview); links to the tax accounts
      page of `tax-engine` for the pack's map; exported "Regional" step for the setup assistant. Files:
      `rpui/runs/run-history.component.ts`, `rpui/rules/rules-page.component.ts`,
      `rpui/setup/regional-setup-step.component.ts`. Test: rendering specs; a switch is audited with who and why.
- [ ] **T35** (parallel). Address form component used through the form layout slot for organizations with a pack,
      keeping every field of today's form. Files: `rpui/address/regional-address.component.ts`. Test: renders each
      base format; falls back without the feature and for an organization without a pack.
- [ ] **T36**. Returns in the UI: the pack page lists its return layouts and links to the tax period pages of
      `tax-engine`; the pack's structured export appears in the period's export menu; a warning on the pack page and
      on affected returns when the content date is older than twelve months or a newer version exists. Files:
      `rpui/pack/pack-returns.component.ts`, `rpui/pack/stale-content-warning.component.ts`. Test: rendering specs;
      keyboard navigation of the pack page; the warning shows for a thirteen-month-old content date.
- [ ] **T37**. Angular plugin `packages/plugins/e-invoicing-ui`: register, file viewer, status timeline, send and
      withdraw, export, "E-invoice" chip on the invoice page. Files: `eiui/e-invoicing-ui.plugin.ts`,
      `eiui/register/e-invoice-register.component.ts`, `eiui/register/e-invoice-detail.component.ts`,
      `eiui/chip/e-invoice-chip.component.ts`. Test: rendering specs.
- [ ] **T38** (parallel). Inbound upload and import result with links to the captures; settings (profiles,
      transports with test, import defaults); routing identifiers edited on the party's tax registrations; code lists
      pages. Files: `eiui/inbound/inbound-upload.component.ts`, `eiui/settings/e-invoicing-settings.component.ts`,
      `eiui/code-lists/code-lists.component.ts`. Test: rendering specs.
- [ ] **T39**. i18n keys `REGIONAL.*`, `E_INVOICING.*`, `CODE_LISTS.*` in every locale; pack-supplied translations
      with English fallback. Files: `packages/ui-core/i18n/assets/i18n/*.json`, `rp/pack/pack-i18n.ts`. Test:
      missing-key check.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T40**. MCP tools `packages/mcp-server/src/lib/tools/regional.ts` and `e-invoicing.ts` (catalogue, apply and
      upgrade with preview, return prepare, validate, send with preview, status, code list lookup). Test:
      input-schema spec; preview tools write nothing.
- [ ] **T41**. OpenAPI regenerated; SDK regeneration noted; webhook catalogue entries. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the new events.
- [ ] **T42**. User docs: pack coverage pages per country with content date and limits; e-invoicing guide;
      `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T43**. Upgrades: version comparison, diff (added, changed, retired, user-changed, affected drafts), upgrade
      run, accept the pack's value per record, rollback guard, notices, automatic rate upgrades. Files:
      `rp/upgrade/regional-pack-upgrade.service.ts`, `rp/upgrade/regional-pack-upgrade.operation.ts`,
      `rp/upgrade/regional-pack-rollback.operation.ts`, `rp/upgrade/upgrade-check.job.ts`,
      `rp/upgrade/rate-upgrades.job.ts`. Test: user-changed record survives; rollback refused once a confirmed
      document uses new content.
- [ ] **T44**. Upgrade and "changed by you" pages. Files: `rpui/upgrade/upgrade-diff.component.ts`,
      `rpui/upgrade/changed-by-you.component.ts`. Test: rendering specs.
- [ ] **T45**. Self-tests: test-case runner as operation `REGIONAL_PACK_SELF_TEST` against the organization's
      configuration, nightly job, results, "not reliable" marker on the returns of affected tax periods. Files:
      `rp/self-test/self-test.operation.ts`, `rp/self-test/self-test-runner.ts`, `rp/self-test/self-test-nightly.job.ts`.
      Test: deleting a mapped account fails the dependent cases.
- [ ] **T46**. Compliance checker: `/compliance/check`, automatic check on draft save (debounced), stored findings,
      worklist, tax explanation, findings panel component for document forms. Files:
      `rp/compliance/compliance-check.service.ts`, `rp/compliance/compliance.controller.ts`,
      `rp/compliance/tax-explanation.service.ts`, `rpui/compliance/findings-panel.component.ts`,
      `rpui/compliance/worklist.component.ts`. Test: seeded drafts give the expected findings; 200-line document within
      the time budget.
- [ ] **T47**. MCP tools `compliance_check_document`, `compliance_explain_tax`, `regional_pack_self_test` and the
      agent's fix proposals as change previews. Files: `packages/mcp-server/src/lib/tools/regional.ts`. Test: nothing
      is confirmed or sent by the tools.
- [ ] **T48**. Return assistant: draft preparation of the `tax-engine` period with anomalies. Files:
      `rp/compliance/return-assistant.service.ts`. Test: seeded anomalies listed.
- [ ] **T49**. Network transport `network-access-point`: send, callbacks with signature
      check, polling, inbound receipt with acknowledgement, directory lookup offered as a `TAX_REGISTRATION_VERIFIER`
      and routing identifiers stored as tax registrations through `E_INVOICING_REGISTRATIONS`. Files:
      `ei/transports/network-access-point.transport.ts`, `ei/transports/callbacks.controller.ts`,
      `ei/transports/status-poll.job.ts`. Test: adapter contract suite against recorded exchanges; forged callback
      refused.
- [ ] **T50**. Run-time packs: install endpoint, storage of content, validation run, marketplace install consumer,
      tenant visibility. Files: `rp/pack/runtime-pack.service.ts`, `rp/pack/marketplace-install.consumer.ts`. Test:
      installed pack applies without restart; another tenant cannot read it.
- [ ] **T51**. Authoring kit `packages/plugins/regional-packs/kit` (schemas, `validate-pack` CLI, test runner,
      sample pack) and its documentation. Test: CLI passes the shipped packs and fails a broken one.
- [ ] **T52**. Retention check job and audit export of files and responses. Files: `ei/register/retention-check.job.ts`,
      `ei/register/audit-export.service.ts`. Test: nothing is deleted before `retainUntil`.
- [ ] **T53**. Schedules in the worker (`RegionalPacksSchedulePlugin`, `EInvoicingSchedulePlugin` in
      `apps/worker/src/plugins.ts`) and in-process fallbacks. Test: worker plugin list spec; sweep specs.
- [ ] **T54**. Legal review checklist per pack recorded in the pack's docs; packs move from "preview" to "shipped";
      trial period on a tenant with the flags on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant; docs build.
- [ ] **T55**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PAYROLL_REGIONAL_HOOKS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Pack contract and catalogue | T7 |
| FR-2 | §3.1 Pack contract and catalogue | T1, T8 |
| FR-3 | §3.1 Pack contract and catalogue | T1, T13, T50 |
| FR-4 | §3.1 Pack contract and catalogue | T11, T33 |
| FR-5 | §3.1 Pack contract and catalogue | T7 |
| FR-6 | §3.1 Pack contract and catalogue | T10, T15, T35 |
| FR-7 | §3.1 Pack contract and catalogue | T11, T33, T39 |
| FR-8 | §3.2 Applying a pack | T12 |
| FR-9 | §3.2 Applying a pack | T8, T33 |
| FR-10–FR-12 | §3.2 Applying a pack | T8 |
| FR-13 | §3.2 Applying a pack | T56 |
| FR-14 | §3.2 Applying a pack | T8, T34 |
| FR-15 | §3.2 Applying a pack | T17 |
| FR-16 | §3.3 Versions, upgrades and self-tests (advanced) | T9, T43 |
| FR-17–FR-20 | §3.3 Versions, upgrades and self-tests (advanced) | T43 |
| FR-21 | §3.3 Versions, upgrades and self-tests (advanced) | T45 |
| FR-22 | §3.3 Versions, upgrades and self-tests (advanced) | T4, T43 |
| FR-23 | §3.4 Accounting-side content | T14 |
| FR-24–FR-25 | §3.4 Accounting-side content | T9 |
| FR-26 | §3.4 Accounting-side content | T10 |
| FR-27–FR-28 | §3.4 Accounting-side content | T15 |
| FR-29–FR-30 | §3.4 Accounting-side content | T16 |
| FR-31–FR-32 | §3.4 Accounting-side content | T14 |
| FR-33 | §3.4 Accounting-side content | T21 |
| FR-34 | §3.4 Accounting-side content | T9, T20 |
| FR-35 | §3.4 Accounting-side content | T18 |
| FR-36 | §3.4 Accounting-side content | T18 |
| FR-37 | §3.4 Accounting-side content | T18, T20, T36 |
| FR-39 | §3.5 Packs that ship first | T13, T30 |
| FR-41 | §3.5 Packs that ship first | T13, T20, T31 |
| FR-44 | §3.5 Packs that ship first | T13, T20, T25, T31 |
| FR-47 | §3.5 Packs that ship first | T10 |
| FR-48 | §3.6 Payroll-side content | T29, T30 |
| FR-49 | §3.6 Payroll-side content | T29 |
| FR-50 | §3.6 Payroll-side content | T29, T30, T31 |
| FR-51 | §3.6 Payroll-side content | T30 |
| FR-52 | §3.6 Payroll-side content | T30 |
| FR-53–FR-55 | §3.6 Payroll-side content | T30 |
| FR-56 | §3.6 Payroll-side content | T29, T30 |
| FR-58 | §3.6 Payroll-side content | T14 |
| FR-59 | §3.6 Payroll-side content | T31 |
| FR-60 | §3.7 Electronic invoicing | T23, T24 |
| FR-61 | §3.7 Electronic invoicing | T26 |
| FR-62 | §3.7 Electronic invoicing | T23, T26, T37 |
| FR-63 | §3.7 Electronic invoicing | T26 |
| FR-65 | §3.7 Electronic invoicing | T26 |
| FR-66 | §3.7 Electronic invoicing | T27, T37 |
| FR-67 | §3.7 Electronic invoicing | T27, T49 |
| FR-68 | §3.7 Electronic invoicing | T27 |
| FR-69 | §3.7 Electronic invoicing | T49 |
| FR-70–FR-71 | §3.7 Electronic invoicing | T28 |
| FR-72 | §3.7 Electronic invoicing | T49 |
| FR-73 | §3.7 Electronic invoicing | T28 |
| FR-74 | §3.7 Electronic invoicing | T24 |
| FR-75 | §3.7 Electronic invoicing | T52 |
| FR-76–FR-78 | §3.8 Code lists | T22 |
| FR-79 | §3.8 Code lists | T22, T23 |
| FR-80 | §3.9 Compliance checker and agents (advanced) | T46 |
| FR-81 | §3.9 Compliance checker and agents (advanced) | T47 |
| FR-82 | §3.9 Compliance checker and agents (advanced) | T46, T47 |
| FR-83 | §3.9 Compliance checker and agents (advanced) | T48 |
| FR-84 | §3.9 Compliance checker and agents (advanced) | T46 |
| FR-86 | §3.10 Statutory reports | T19 |
| FR-87 | §3.10 Statutory reports | T26, T37 |
| FR-88 | §3.10 Statutory reports | T20 |
| FR-89 | §3.10 Statutory reports | T21 |
| FR-90 | §3.10 Statutory reports | T30 |
| FR-91 | §3.10 Statutory reports | T19 |
| FR-92 | §3.11 Marketplace, API and compatibility | T50 |
| FR-93 | §3.11 Marketplace, API and compatibility | T7, T51 |
| FR-94 | §3.11 Marketplace, API and compatibility | T11, T40 |
| FR-95 | §3.11 Marketplace, API and compatibility | T32, T41 |
| FR-96 | §3.11 Marketplace, API and compatibility | T8, T34 |
| FR-97 | §3.11 Marketplace, API and compatibility | T7, T50 |
| FR-98 | §3.11 Marketplace, API and compatibility | T2, T6 |
| FR-99 | §3.11 Marketplace, API and compatibility | T36 |
| FR-100 | §3.5 Packs that ship first | T13, T20, T31 |
| FR-101–FR-103 | §3.6 Payroll-side content | T31 |
| FR-104–FR-105 | §3.10 Statutory reports | T20 |
| FR-106 | §3.10 Statutory reports | T31 |
| FR-107 | §3.4 Accounting-side content | T9, T10, T15, T34 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default stay off; enabling them in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Every shipped pack passes the validator and its own test cases on the three dialects in CI.
- Every shipped profile produces files that pass the conformance files of its standard.
- Applying, upgrading and detaching a pack never changes or deletes a record a user created or changed (ledger
  invariant test).
- Every acceptance criterion of `spec.md` §7 has a named test.
