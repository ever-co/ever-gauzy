# Task Breakdown: Print and PDF designer

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `print-and-pdf-designer`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Every route, page action, tab and tool checks `FEATURE_PRINT_TEMPLATES`; printers, agents and dispatches (T48 to
  T51) also `FEATURE_PRINT_AGENTS`.
- Paths are relative to `packages/plugins/print-templates/src/lib/` unless they start with `packages/` or `apps/`;
  `ui/` means `packages/plugins/print-templates-ui/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/print-template.model.ts` (enums, layout document, block union, registrations, data provider, `IPrintService`) and `print-layout.schema.json`; export from `index.ts`; only optional print references added to existing record contracts. Test: schema accepts the shipped samples and refuses unknown block types.
- [ ] **T2**. Plugin skeleton `packages/plugins/print-templates` (`print-templates.plugin.ts`, module,
      `print-templates-enabled.ts` exact `true`); `PluginContributions` on `@GauzyCorePlugin`:
      `print-templates.features.ts` (`FEATURE_PRINT_TEMPLATES`, `FEATURE_PRINT_AGENTS`), `print-templates.permissions.ts`
      (eleven permissions with `defaultFor`), `print-templates.settings.ts`; listed in `apps/api/src/plugins.ts`. Test:
      flag parsing; plugin absent when the switch is not `true`; contributions in the catalogues.
- [ ] **T3**. Entities and MikroORM repositories in `src/lib/entities/` for the fifteen tables of plan §3:
      `entities/print-template.entity.ts`, `print-template-version.entity.ts`, `print-assignment.entity.ts`,
      `print-letterhead.entity.ts`, `print-snippet.entity.ts`, `print-terms-text.entity.ts`, `print-title.entity.ts`,
      `print-font.entity.ts`, `print-output.entity.ts`, `print-job.entity.ts`, `print-job-item.entity.ts`,
      `print-printer.entity.ts`, `print-agent.entity.ts`, `print-agent-pairing.entity.ts`, `print-dispatch.entity.ts`,
      repositories in `entities/repository/`. Test: ORM parity spec (create and read each entity on both ORMs, SQLite).
- [ ] **T4**. Migrations `1791000038100` to `1791000038130` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`); PostgreSQL, MySQL, SQLite; both ORMs. Files: `database/migrations/1791000038100-CreatePrintTemplateTables.ts`, `database/migrations/1791000038110-CreatePrintLetterheadAndTermsTables.ts`, `database/migrations/1791000038120-CreatePrintOutputAndJobTables.ts`, `database/migrations/1791000038130-CreatePrintPrinterTables.ts`, `database/migrations/index.ts`. Test: up twice is a no-op; SQLite run in CI.
- [ ] **T5**. Default grants of plan §9 through `defaultFor` on the permission contributions; no seed migration. Files: `print-templates.permissions.ts`, `print-templates.permissions.spec.ts`. Test: grants per default role on a new tenant and after the permission reload on an existing one.
- [ ] **T54**. Core `PdfRenderService` in `packages/core/src/lib/pdf/`, extracted from `PdfmakerService`
      (`packages/core/src/lib/invoice/pdfmaker.service.ts`: fonts, URL access off, local access limited to fonts) and the
      Docs renderer (`packages/plugins/docs/src/lib/pdf/pdf-render.ts`, `document-pdf.service.ts`, image normaliser);
      invoices and Docs switched to it. Files: `packages/core/src/lib/pdf/pdf-render.service.ts`,
      `packages/core/src/lib/pdf/pdf-image-normaliser.ts`, `packages/core/src/lib/pdf/index.ts`,
      `packages/core/src/lib/invoice/pdfmaker.service.ts`, `packages/plugins/docs/src/lib/pdf/pdf-render.ts`. Test:
      invoice PDFs byte-identical and Docs PDF specs unchanged after the extraction; no URL or file access possible.

## Phase 2 — Services, endpoints, events

- [ ] **T6**. Layout document model: validator, schema upgrade functions, normaliser in `src/lib/engine/layout/`. Files: `engine/layout/layout-validator.ts`, `engine/layout/layout-upgrade.ts`, `engine/layout/layout-normaliser.ts`. Test: round trip, upgrade from schema version 1, refusal reasons; every block kind of spec FR-14 validates.
- [ ] **T7**. Template language in `engine/expressions/`: isolated Handlebars instance, helper library (money, number, date, percent, quantity, text, translation), step and size budgets. Files: `engine/expressions/print-handlebars.ts`, `engine/expressions/print-helpers.ts`. Test: helpers per locale; hostile templates (prototype access, deep recursion, huge output) refused.
- [ ] **T8**. Conditions in `engine/conditions/` on the `@gauzy/utils` evaluator; hide-when-empty. Files: `engine/conditions/print-conditions.ts`. Test: same verdicts as the evaluator's conformance suite.
- [ ] **T9**. PDF compiler in `engine/pdf/` on the core `PdfRenderService` of T54: flowing blocks, field blocks (labels, formats, negatives, prefix and suffix), line tables (header repeat, grouping, subtotals, row conditions), bands per page kind, page settings and page tokens, watermarks, headings, canvas positions. Files: `engine/pdf/pdf-compiler.ts`, `engine/pdf/blocks/`, `engine/pdf/line-table.ts`, `engine/pdf/bands.ts`. Test: text and structure snapshots per block; page N of M on a three-page fixture.
- [ ] **T10** (parallel). Images and barcodes in `engine/assets/` (images through the core `PdfRenderService` normaliser, `bwip-js` symbols, invalid-value marker). Files: `engine/assets/print-images.ts`, `engine/assets/print-barcodes.ts`. Test: each symbology; invalid values; 300 dpi scaling.
- [ ] **T11**. Render pool in `engine/pool/` (worker threads, timeout, heap limit, cancellation); a failed render names the block path and cause and returns no partial PDF. Files: `engine/pool/render-pool.ts`, `engine/pool/render-worker.ts`. Test: timeout stops a slow render; a crash fails one render only; the error names the block.
- [ ] **T12**. Print data pipeline `services/print-data.service.ts`: provider registry, document engine snapshot through
      `PRINT_DOCUMENTS`, generic registry provider with read scope, `FieldVisibility`, custom field reader, organization,
      party, letterhead. Test: masked values absent; another organization's record refused.
- [ ] **T13**. Standard template generator `engine/standard-template.ts` from a type's field catalogue; routes `/record-types` and `/record-types/:type/catalogue` with counts in `controllers/print-record-types.controller.ts`. Test: a document type, a custom record type and an item each produce a valid document; a field added to the type appears without editing.
- [ ] **T14**. Shipped invoice, estimate and receipt templates reproducing `generate-invoice-pdf.ts`; core port
      `invoice/invoice-pdf-renderer.port.ts` and `@Optional()` use in `InvoiceService`; `PrintInvoiceRenderer` bound in
      `plugin-composition.ts`. Files: `packages/core/src/lib/invoice/invoice-pdf-renderer.port.ts`,
      `packages/core/src/lib/invoice/invoice.service.ts`, `services/print-invoice-renderer.ts`,
      `shipped/invoice.template.json`, `shipped/estimate.template.json`, `shipped/receipt.template.json`. Test: without
      assignment the PDF bytes match today's; with one, the template renders on download, email and public link.
- [ ] **T15**. Accounting templates listed as `EXISTING` templates (read-through of `AccountingTemplateService`), preview with real records, assignable. Files: `services/accounting-template-source.ts` (reads `packages/core/src/lib/accounting-template/accounting-template.service.ts`). Test: list, preview, assign; the accounting template row is never written.
- [ ] **T16**. Template service and controller: CRUD, draft save with `If-Match`, lock and takeover, publish, archive refusal when default, copy, versions, diff, restore, usage, export and import; GraphQL reads `printTemplates`, `printTemplate`, `printOutputs`. Files: `services/print-template.service.ts`, `controllers/print-template.controller.ts`, `services/print-template-file.service.ts`, `dto/`, `graphql/schema-extensions.ts`. Test: e2e per route; `409` and
      `423` paths; an exported template with fonts, images and snippets imports after a preview.
- [ ] **T17**. Resolver and assignments (`services/print-template-resolver.ts`, `/assignments`). Files also: `controllers/print-assignment.controller.ts`. Test: party beats context beats organization beats tenant beats standard, per output.
- [ ] **T18**. Render endpoints `/render`, `/records/:type/:id/options`, `/templates/:id/preview` with warnings; the `PrintService` facade (`render`, `resolve`, `enqueue`, `dispatch`) owners bind to; several ids render into one PDF, each from a new page with its own numbering and a blank page for two-sided printing; print language resolved from the dialog, the party, the template default and the organization with an untranslated-text warning; output records and fingerprints, one `AUDIT_EVENT_SINK` event per output; the draft rule of spec FR-95 (`print.draftsNeedPermission`, default off) applied here and in `PrintInvoiceRenderer`. Files: `services/print.service.ts`, `controllers/print-render.controller.ts`, `services/print-output.service.ts`, `services/print-draft-rule.ts`. Test: permission per type; drafts with and without `PRINT_DRAFTS`, with the setting off (printed, no forced mark) and on (refused without the permission, forced mark with it); history rows; one sink event per output.
- [ ] **T19**. Letterheads, headings, snippets and fonts services and routes; font parsing and licence confirmation. Files: `services/print-letterhead.service.ts`, `services/print-heading.service.ts`, `services/print-snippet.service.ts`, `services/print-font.service.ts`, `controllers/print-assets.controller.ts`. Test: letterhead resolution order; font upload refuses non-font files; glyph fallback.
- [ ] **T20**. Terms texts service, `/terms/:id/render` and `PrintTermsService` for document forms, with the precedence of plan §1 (document's own terms; default terms text of the type and organization; `organization.defaultInvoiceEstimateTerms` for invoices and estimates). Files: `services/print-terms.service.ts`, `controllers/print-terms.controller.ts`. Test: merge fields rendered for a document; attachments copied when set; a new invoice without a default text gets the organization's terms.
- [ ] **T21**. Outbox events and realtime hints (plan §5) and `PrintOutputTimelineSource`. Files: `events/print.events.ts`, `events/print-output-timeline.source.ts`. Test: event payloads; hint channels.
- [ ] **T22**. Archive consumer `subscriber:print-templates-archive` and reprint choice (original or copy). Files: `events/print-archive.consumer.ts`. Test: one archival output per document and version under redelivery.
- [ ] **T55**. Append a record's PDF attachments after its pages on request (option `appendAttachments` of `/render` and of jobs), merged with `pdf-lib`. Files: `engine/pdf/append-attachments.ts`, `services/print.service.ts`. Test: `append-attachments.spec.ts`: a record with two PDF attachments yields its pages followed by both attachments; non-PDF attachments are skipped with a warning.

## Phase 3 — UI surfaces

- [ ] **T23**. Angular plugin `packages/plugins/print-templates-ui`: catalogue, assignments, letterheads, terms, headings, fonts pages; menu entries with feature and permissions; `PRINT_TEMPLATES.*` keys in every locale. Files: `ui/print-templates-ui.plugin.ts`, `ui/print-templates.routes.ts`, `ui/catalogue/template-catalogue.component.ts`, `ui/settings/assignments.component.ts`, `ui/settings/letterheads.component.ts`, `ui/settings/terms.component.ts`, `ui/settings/fonts.component.ts`, `packages/ui-core/i18n/assets/i18n/*.json`. Test: rendering tests; hidden when routes answer 404.
- [ ] **T24**. Print dialog and outputs tab exported for every page (`PrintActionComponent`, `PrintOutputsTabComponent`), wired into invoices, estimates and receipts beside the existing download, rendered only with `FEATURE_PRINT_TEMPLATES` on; the dialog asks for the template's input variables. Files: `ui/print-dialog/print-action.component.ts`, `ui/print-dialog/print-dialog.component.ts`, `ui/print-dialog/print-outputs-tab.component.ts`, `ui/index.ts`. Test: dialog choices remembered; keyboard operation; with the flag off the invoice, estimate and receipt pages show no new action or tab.
- [ ] **T25**. Designer, flowing mode: palette, field palette, properties, sections and columns, line table editor, styles, undo and redo, autosave, outline editor. Files: `ui/designer/designer.component.ts`, `ui/designer/block-palette.component.ts`, `ui/designer/field-palette.component.ts`, `ui/designer/properties-panel.component.ts`, `ui/designer/line-table-editor.component.ts`, `ui/designer/designer-history.ts`, `ui/designer/outline-editor.component.ts`. Test: component tests; outline editor reaches every action.
- [ ] **T26**. Designer, canvas mode: drawing, handles, snapping and guides, frame selection, align and distribute, nesting, nudge, exact inputs; canvas areas in flowing pages. Files: `ui/designer/canvas/canvas-editor.component.ts`, `ui/designer/canvas/canvas-geometry.ts`, `ui/designer/canvas/snapping.ts`. Test: geometry unit tests; keyboard nudge.
- [ ] **T27**. Designer bands, page settings, page tokens, versions list and visual diff, lock presence. Files: `ui/designer/bands-editor.component.ts`, `ui/designer/page-settings.component.ts`, `ui/designer/versions.component.ts`, `ui/designer/visual-diff.component.ts`. Test: band overlap warning; diff marks changed blocks.
- [ ] **T28**. Code template editor with subset validation (`PRINT_TEMPLATES_CODE`) and layout-to-code conversion. Files: `ui/code-editor/code-template-editor.component.ts`, `engine/code/code-subset-validator.ts`, `engine/code/layout-to-code.ts`. Test: unsupported elements named; conversion renders the same PDF text.
- [ ] **T29** (parallel). Invoice and estimate history: the server writes the `invoice_estimate_history` entry for outputs of invoices and estimates (`invoiceEstimateHistoryId` on `print_output`); the Angular download and email screens (`invoice-download-mutation.component.ts`, the email dialog) skip their own entry when the print options answer that the server records it; the invoice outputs tab reads that history. Files: `services/print-output.service.ts`, `apps/gauzy/src/app/pages/invoices/invoice-download/invoice-download-mutation.component.ts`. Test: one entry per download and per email with the feature on; the client still writes it with the feature off.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T30**. MCP tools `packages/mcp-server/src/lib/tools/print-templates.ts` (list, preview, print, check, explain), registered in `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: tool specs with permission refusals.
- [ ] **T31**. OpenAPI regenerated; SDK regeneration noted for release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive.

## Phase 5 — Depth (plan phase 2)

- [ ] **T32**. Bulk jobs: `/jobs` routes, core operation `print-templates.job` (slices as steps, lease and resume from
      the operation, no sweep job), merged PDF streaming with `pdf-lib`, archive output, caps, pinned versions, retries,
      CSV log, inbox notice. Files: `jobs/print-job.service.ts`, `jobs/print-job.operation.ts`,
      `jobs/print-job.controller.ts`, `jobs/merged-pdf.writer.ts`. Test: 1,200 records with a restart at 600 print each
      once; caps refuse with the limit; unreadable records and drafts without `PRINT_DRAFTS` (setting on) skipped with
      the reason.
- [ ] **T33**. Bulk action for saved-view lists through `registerBulkActions` and `RECORD_VIEWS_SELECTION`; bind
      `RECORD_VIEWS_PRINT`. Files: `jobs/print-bulk-action.ts`, `ui/print-dialog/print-bulk-action.component.ts`,
      `apps/api/src/plugin-composition.ts`. Test: selection and view-based jobs.
- [ ] **T34**. Labels: sheet and roll imposition, quantities from a field, start position, alignment test page,
      `/labels`. Files: `engine/labels/label-imposition.ts`, `controllers/print-labels.controller.ts`,
      `ui/print-dialog/label-print-dialog.component.ts`. Test: positions 7 to 46 filled on an 8 × 5 sheet.
- [ ] **T35**. Report templates through `PRINT_REPORTS`: title, prompts, grouped table with subtotals, charts as images. Files: `services/print-report.service.ts`, `shipped/report.template.json`. Test: a definition with two group levels prints the subtotals; the existing report pages' export actions are unchanged.
- [ ] **T36**. Seed job `print-templates.seed`, `registerPrintTemplates` and `registerPrintDataProviders`, upgrade rules for copies; generic document template for engine types without one; item label and address label sheet; no assignment written for invoices, estimates and receipts. Files: `seed/print-templates-seed.job.ts`, `seed/print-template-upgrade.ts`, `registration/register-print-templates.ts`, `shipped/generic-document.template.json`, `shipped/item-label.template.json`, `shipped/address-label-sheet.template.json`, `packages/plugin/src/lib/plugin-contributions.ts`. Test: upgrade leaves a copy untouched and flags the newer version; after enabling the feature an invoice PDF is byte-identical to today's until a template is assigned.
- [ ] **T37**. `PrintTemplateInstaller` for `REGIONAL_PRINT_TEMPLATES` (install, upgrade by checksum, archive). Files: `services/print-template-installer.ts`. Test: pack removal archives its templates.
- [ ] **T38**. Owner bindings in `plugin-composition.ts` for the print tokens of payroll, HR, organization structure, purchasing, automations and the commerce owners present in the build. Files: `apps/api/src/plugin-composition.ts`. Test: composition spec resolves every bound token.
- [ ] **T39**. Usage, queue, inventory and printers report datasets (`/reports/*`) and CSV export. Files: `reports/print-report-datasets.ts`, `controllers/print-reports.controller.ts`. Test: seeded tenant rows.
- [ ] **T40**. Right-to-left layout mirroring and amounts in words for every shipped language. Files: `engine/pdf/rtl-mirroring.ts`, `engine/expressions/amount-in-words/`. Test: snapshots in Arabic and Hebrew; amounts in words per language.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T41**. HTML target in `engine/html/` (email-safe tables with inline styles; semantic page markup for portal); the `printHtml` helper of core email templates (`email-template/`) that embeds it in the message; the public invoice page (`public-share/invoice/`) rendering it when a portal template is assigned; `PRINT_SENDER` hand-off. Files: `engine/html/html-compiler.ts`, `packages/core/src/lib/email-template/compile-mjml.ts`, `packages/core/src/lib/public-share/invoice/`. Test: one template renders all three targets with the same values; an invoice email keeps its template's subject and wrapper.
- [ ] **T42**. Live preview as a role (server render of the draft with the role's masks), one-second refresh with debounce and cancellation. Files: `services/print-preview.service.ts`, `ui/designer/preview-pane.component.ts`. Test: role preview hides that role's masked fields.
- [ ] **T43**. Assistant drafting `/templates/draft-from` and MCP `print_template_draft` through `PRINT_ASSISTANT`; mapping report; samples, job files and dispatch payloads declared as retention kinds through `RETENTION_SOURCES` (24 h, 7 days). Files: `services/print-template-draft.service.ts`, `retention/print-retention.sources.ts`, `packages/mcp-server/src/lib/tools/print-templates.ts`. Test: mocked provider; draft never published; samples purged by the retention runner.
- [ ] **T44**. Archival and tagged PDFs (profiles, embedded files for `E_INVOICING_PRINT`, alternative text rule on publish); validator run in CI on sample outputs. Files: `engine/pdf/archival-profile.ts`, `engine/pdf/tagged-pdf.ts`. Test: validator passes for each profile.
- [ ] **T45**. Signature blocks through `PRINT_SIGNATURES` and the certificate page. Files: `engine/pdf/blocks/signature.block.ts`, `engine/pdf/certificate-page.ts`, `ui/designer/signature-block-properties.component.ts`. Test: signed and unsigned blocks; certificate lists signers and fingerprint.
- [ ] **T46**. Verification codes: token on output, public summary and check routes, revoke, rate limit. Files: `verify/print-verify.service.ts`, `verify/print-verify.controller.ts`. Test: original matches; edited copy does not; revoked token answers not found.
- [ ] **T47**. Tracked-time appendix through `PRINT_TIME_SOURCE` (core billed time), reconciliation warning. Files: `engine/pdf/blocks/time-appendix.block.ts`, `services/print-time-source.adapter.ts`. Test: grouped totals equal invoiced quantities; mismatch warns.
- [ ] **T48**. Printers and dispatches: entities' services, `/printers`, `/dispatches`, test page, network sending by the internet printing protocol with the private-address rule, expiry job. Files: `printers/print-printer.service.ts`, `printers/print-printer.controller.ts`, `printers/print-dispatch.service.ts`, `printers/print-dispatch.controller.ts`, `printers/ipp-sender.ts`, `printers/dispatch-expiry.job.ts`, `ui/printers/printers.component.ts`. Test: private address refused unless allowed; expiry notices.
- [ ] **T49**. Raw templates: receipt and label command builders, helpers (styles, barcode, cut, drawer pulse), code pages. Files: `engine/raw/receipt-commands.ts`, `engine/raw/label-commands.ts`, `engine/raw/code-pages.ts`. Test: byte snapshots per helper.
- [ ] **T50**. Print agent in `packages/desktop-lib` and settings in `packages/desktop-ui-lib`: pairing (one-time codes of `access-control-and-security` when loaded), credential generated and hashed with `user-api-token.utils.ts`, credential storage, realtime subscription with polling fallback, local printer discovery, PDF and raw printing, status reports. Files: `printers/print-agent.service.ts`, `printers/print-agent.controller.ts` (`/agents/*`), `packages/desktop-lib/src/lib/print-agent/`, `packages/desktop-ui-lib/src/lib/settings/printing/`. Test: agent unit tests with a fake printer; revoked agent stops receiving.
- [ ] **T51**. Real-time progress and status in the Angular app (`print_job`, `print_printer`,
      `print_template_draft` channels). Files: `ui/services/print-realtime.service.ts`, `ui/jobs/print-jobs.component.ts`. Test: hints update the views without polling.
- [ ] **T52**. User docs (docs site), `docs/specs/README.md` index row, spec status `Implemented`. Test: docs build.
- [ ] **T53**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `COMMUNICATIONS_PRINT`, `LEARNING_PRINT`, `PERFORMANCE_PRINT`, `PORTAL_PRINT`, `RECRUITMENT_PRINT`, `REPORT_PRINT`, `SHEETS_PRINT`, `SLIDES_PRINT`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T23, T30 |
| FR-2 | §3.1 Scope, flags and compatibility | T14 |
| FR-3 | §3.1 Scope, flags and compatibility | T15 |
| FR-4 | §3.1 Scope, flags and compatibility | T54 |
| FR-5 | §3.1 Scope, flags and compatibility | T1, T2 |
| FR-6 | §3.2 Printable record types and the template catalogue | T13 |
| FR-7 | §3.2 Printable record types and the template catalogue | T13 |
| FR-8 | §3.2 Printable record types and the template catalogue | T16, T43 |
| FR-9 | §3.2 Printable record types and the template catalogue | T3, T16 |
| FR-10 | §3.2 Printable record types and the template catalogue | T36 |
| FR-11 | §3.2 Printable record types and the template catalogue | T16 |
| FR-12 | §3.2 Printable record types and the template catalogue | T16 |
| FR-13 | §3.2 Printable record types and the template catalogue | T16 |
| FR-14 | §3.3 Content | T6, T9, T25 |
| FR-15 | §3.3 Content | T8, T9, T25 |
| FR-16 | §3.3 Content | T9, T25 |
| FR-17 | §3.3 Content | T10 |
| FR-18 | §3.3 Content | T8 |
| FR-19 | §3.3 Content | T7 |
| FR-20 | §3.3 Content | T12 |
| FR-21 | §3.3 Content | T12, T18 |
| FR-22 | §3.3 Content | T19, T25 |
| FR-23–FR-24 | §3.3 Content | T20 |
| FR-25 | §3.3 Content | T19 |
| FR-26 | §3.3 Content | T9, T18 |
| FR-27 | §3.4 Designer | T25 |
| FR-28–FR-29 | §3.4 Designer | T26 |
| FR-30 | §3.4 Designer | T27 |
| FR-31–FR-32 | §3.4 Designer | T25 |
| FR-33 | §3.4 Designer | T16, T25, T27 |
| FR-34 | §3.4 Designer | T16 |
| FR-35 | §3.4 Designer | T28 |
| FR-36 | §3.4 Designer | T24, T25 |
| FR-37 | §3.4 Designer | T10, T18 |
| FR-38 | §3.5 Page settings, fonts and letterheads | T9, T27 |
| FR-39 | §3.5 Page settings, fonts and letterheads | T9, T27 |
| FR-40–FR-41 | §3.5 Page settings, fonts and letterheads | T19 |
| FR-42 | §3.5 Page settings, fonts and letterheads | T19 |
| FR-43 | §3.5 Page settings, fonts and letterheads | T19 |
| FR-44 | §3.6 Language and formats | T7, T18 |
| FR-45 | §3.6 Language and formats | T7 |
| FR-46–FR-47 | §3.6 Language and formats | T40 |
| FR-48 | §3.7 Choosing what prints | T17 |
| FR-49 | §3.7 Choosing what prints | T24 |
| FR-50 | §3.7 Choosing what prints | T18 |
| FR-51 | §3.7 Choosing what prints | T24, T41 |
| FR-52 | §3.8 Rendering and outputs | T9, T11 |
| FR-53 | §3.8 Rendering and outputs | T18 |
| FR-54 | §3.8 Rendering and outputs | T55 |
| FR-55 | §3.8 Rendering and outputs | T18, T29 |
| FR-56 | §3.8 Rendering and outputs | T22 |
| FR-57–FR-58 | §3.8 Rendering and outputs | T44 |
| FR-59 | §3.8 Rendering and outputs | T11 |
| FR-60 | §3.9 Bulk printing and the print queue | T32, T33 |
| FR-61 | §3.9 Bulk printing and the print queue | T32 |
| FR-62 | §3.9 Bulk printing and the print queue | T32 |
| FR-63–FR-66 | §3.9 Bulk printing and the print queue | T32 |
| FR-67–FR-69 | §3.10 Labels | T34 |
| FR-70 | §3.11 Reports | T35 |
| FR-71 | §3.11 Reports | T35 |
| FR-72 | §3.12 Printers and print agents | T48, T50 |
| FR-73 | §3.12 Printers and print agents | T48 |
| FR-74 | §3.12 Printers and print agents | T49 |
| FR-75 | §3.12 Printers and print agents | T48 |
| FR-76 | §3.12 Printers and print agents | T48, T51 |
| FR-77 | §3.12 Printers and print agents | T48 |
| FR-78 | §3.12 Printers and print agents | T48, T50 |
| FR-79 | §3.12 Printers and print agents | T48, T50 |
| FR-80–FR-81 | §3.13 Shipped templates and owning features | T14, T36 |
| FR-82 | §3.13 Shipped templates and owning features | T37 |
| FR-83 | §3.13 Shipped templates and owning features | T18, T38 |
| FR-84 | §3.13 Shipped templates and owning features | T16 |
| FR-85 | §3.14 One template, live preview, agents and time (advanced) | T41 |
| FR-86 | §3.14 One template, live preview, agents and time (advanced) | T42 |
| FR-87 | §3.14 One template, live preview, agents and time (advanced) | T43 |
| FR-88 | §3.14 One template, live preview, agents and time (advanced) | T43 |
| FR-89 | §3.14 One template, live preview, agents and time (advanced) | T30, T43 |
| FR-90 | §3.14 One template, live preview, agents and time (advanced) | T45 |
| FR-91 | §3.14 One template, live preview, agents and time (advanced) | T46 |
| FR-92 | §3.14 One template, live preview, agents and time (advanced) | T47 |
| FR-93 | §3.14 One template, live preview, agents and time (advanced) | T51 |
| FR-94 | §3.15 Reports of this feature | T39 |
| FR-95 | §3.16 Draft printing rule | T18 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With the flag off, invoice, estimate and receipt PDFs are byte-identical to the previous release.
- A render of 200 lines stays under 2 s at the 95th percentile on the reference server; a job prints 20 records per second per worker.
- Every shipped template has texts in every shipped language and passes `print_template_check` without warnings.
