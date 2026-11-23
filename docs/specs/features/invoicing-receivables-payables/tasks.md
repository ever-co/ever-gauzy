# Task Breakdown: Invoicing, receivables and payables

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `invoicing-receivables-payables`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_RECEIVABLES_PAYABLES_ENABLED` and `FEATURE_RECEIVABLES_PAYABLES`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `core/` = `packages/core/src/lib/`, `rp/` = `packages/plugins/receivables-payables/src/lib/`,
  `rp-ui/` = `packages/plugins/receivables-payables-ui/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/receivables-payables.model.ts` (enums, `IInvoiceDocument`, `IOpenItem`,
      `IPartyOpenBalance`, event payloads, port interfaces and tokens) + optional fields on `IInvoice`; the
      `AdjustmentOwnerType` values `INVOICE` and `INVOICE_LINE`; export from `index.ts`. Test: type-level spec that
      existing invoice inputs still compile.
- [ ] **T2**. Permission contributions with `defaultFor` grants and the feature contribution
      `FEATURE_RECEIVABLES_PAYABLES` in `rp/receivables-payables.permissions.ts` and `.features.ts` (no core enum
      change, no seed); `FEATURE_MULTI_CURRENCY` switched on at first enablement for tenants that already hold
      foreign-currency invoices. Test: provisioning spec for the four roles; an existing tenant with a foreign-currency
      invoice keeps multi-currency access.
- [ ] **T3**. Plugin scaffold `packages/plugins/receivables-payables` (package, project, tsconfig, jest, eslint, path
      mapping), `receivables-payables-enabled.ts` (exact `true`), `.env.sample` entry, `receivables-payables.settings.ts`,
      `.features.ts`, `.permissions.ts`. Test: flag spec; plugin list specs of `apps/api` and `apps/worker`.
- [ ] **T4**. Core columns on `core/invoice/invoice.entity.ts` + migration `AlterInvoiceForFinanceDocuments` (three dialects,
      both ORMs). Files: `core/invoice/invoice.entity.ts`,
      `core/database/migrations/1791000075900-AlterInvoiceForFinanceDocuments.ts`. Test: migration spec on SQLite;
      existing rows read back unchanged. Migration timestamps: `1791000075100` to `1791000075199` (`packages/plugins/receivables-payables`); `1791000075900` to `1791000075999` (`packages/core`).
- [ ] **T5**. Entities `rp/entities/` (ten tables of plan §3) with MikroORM repositories. Files:
      `rp/entities/{invoice-document-detail,invoice-item-detail,open-item,open-item-entry,party-open-balance,bill-match-result,bill-capture,bill-capture-hint,unbilled-accrual,billing-claim}.entity.ts`,
      `rp/entities/index.ts`, `rp/repositories/mikro-orm-<entity>.repository.ts` per entity. Test: entity metadata
      spec under both ORMs.
- [ ] **T6**. Migration `CreateReceivablesPayablesTables` on the shared core migration helpers of `procurement` T4 (`@gauzy/core`).
      Files: `rp/database/migrations/1791000075110-CreateReceivablesPayablesTables.ts`, `rp/database/migrations/index.ts`.
      Test: SQLite run, rerun is a no-op; index and uniqueness assertions.
- [ ] **T7** (parallel). Settings contributions of spec FR-82 in `receivables-payables.settings.ts` (organization scope
      of the platform settings store). Test: settings catalogue spec; defaults resolve without stored rows.
- [ ] **T8**. Register the six document types and series with the document engine (`rp/documents/document-types.ts`,
      migration `SeedInvoiceDocumentTypesAndSeries`); the receivable and payable invoice types register with
      `preexisting: true` (`business-document-engine` FR-113). Files: `rp/documents/document-types.ts`,
      `rp/database/migrations/1791000075120-SeedInvoiceDocumentTypesAndSeries.ts`. Test: series starts after the
      organization's highest invoice number; with the engine on and no type policy, a confirmed invoice is still edited
      and deleted as today.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Totals: `rp/totals/invoice-totals.pipeline.ts` (lines, discounts, header discount spread, tax engine call or
      legacy percentages, rounding) on core `money`, writing discounts, fees and rounding as core `adjustment` rows
      (owners `INVOICE` / `INVOICE_LINE`) and the result into the engine's totals row (core `totalValue`, `tax`, `tax2`
      mirrored). Test: property tests (sum of lines = total; spread is exact; adjustments sum to the discount and
      rounding of the totals row) and the cases of today's `invoice-totals.spec.ts`.
- [ ] **T10**. `rp/documents/invoice-document.service.ts`: create and update drafts (core invoice + detail + line detail in
      one transaction), party, address, currency and item rules (FR-15, FR-17 to FR-22). Test: rule specs, one per refusal
      code; with the stricter settings off (default) negative lines, inactive parties, other addresses and a due date
      before the document date are accepted as today.
- [ ] **T11**. Exchange rate resolution `rp/documents/exchange-rate.resolver.ts` (table, override, supplier date). Test: date
      change refreshes a draft's rate; confirmed stays.
- [ ] **T12**. Open-item register `rp/open-items/open-item-register.service.ts` (`OPEN_ITEM_REGISTER`: open, settle, release,
      credit, write off, reschedule; entries; version check; `open` and `settle` join a caller's transaction; source types
      `OPENING` and `MANUAL_JOURNAL` for the ledger and the opening worksheet; mirror into `invoice.amountDue`,
      `alreadyPaid`, `paid`). Test: conservation property (original = outstanding + entries), conflict on stale version,
      both ORMs; the only store of open items (no other table holds an outstanding amount).
- [ ] **T13**. Party balances `rp/open-items/party-open-balance.service.ts` (delta updates of outstanding, overdue, not
      due, credits; ageing buckets computed when read from due dates with the scheme of `AGEING_BUCKET_SCHEME` or the
      default; as-of from entries). Test: balance equals sum of open items after random operations; buckets equal a
      recomputation for two schemes.
- [ ] **T14**. Confirm: `rp/documents/confirm-invoice-document.handler.ts` (period guard: a refusal while
      `ledger.refuseUnpostableDocuments` is on, a warning with the first open date while it is off; number, instalments from
      `PaymentTermService.schedule`, open items, roll-ups, snapshot, event) with `Idempotency-Key`. Test: all-or-nothing on
      injected failure; two parallel confirms give one number; an invoice dated in a locked period confirms with the
      warning with the setting off (the default) and is refused naming the first open date with it on.
- [ ] **T15**. Status mirror `rp/documents/invoice-status.mapper.ts` (lifecycle, sent or viewed, settlement → legacy
      `status`, `paid`, `alreadyPaid`, `amountDue`, `dueDate`). Test: mapping table spec; existing invoice specs still pass.
- [ ] **T16**. Cancel, amend, change set (`rp/documents/cancel-*.handler.ts`, `amend-*.handler.ts`), and the in-place
      edit of a confirmed document while `documents.lockConfirmed` is off (change set, re-derived unpaid open items,
      `.amended` event). Test: refused with settlements; released first when the setting is on; amendment links
      versions; an in-place edit with the lock off keeps the register and the event in step.
- [ ] **T17**. Credit and debit notes `rp/notes/` (caps, reasons from `adjustment_reason`, tax reversal, application to the
      original's open items, credit open item, time release choice). Files: `rp/notes/credit-note.service.ts`,
      `rp/notes/debit-note.service.ts`. Test: partial and full credit, surplus, standalone.
- [ ] **T18**. Supplier bills `rp/bills/bill.service.ts` (supplier number, duplicate policy, likely-duplicate warning,
      withholding marks). Test: duplicate refused or warned by setting.
- [ ] **T19** (parallel). Holds `rp/holds/` on the engine's `hold` / `release` actions (reason code and `holdReleaseOn` on
      the detail) + release sweep job. Files: `rp/holds/document-hold.service.ts`, `rp/holds/hold-release.scheduler.ts`.
      Test: held items excluded by the register's `find`; release on date writes the engine's history row.
- [ ] **T20**. Event payload builder `rp/events/invoice-document-event.factory.ts` and outbox append; posting result consumer
      of `accounting.journal.posted` / `.failed` setting `postingState`. Test: payload validates against the contract
      for all six kinds.
- [ ] **T21**. Controllers `rp/controllers/invoice-document.controller.ts`, `open-item.controller.ts`,
      `open-balance.controller.ts`, `document-hold.controller.ts`, `settings.controller.ts` with DTOs, guards, Swagger. Test:
      e2e per route (403 without permission, 404 with feature off).
- [ ] **T22**. Core guard in `core/invoice/invoice.service.ts`: amount change on a confirmed document through the old routes
      → `409` only while the organization's `documents.lockConfirmed` is on; otherwise the change goes through the
      amend path of T16. Test: old routes unchanged with the feature off; with the feature on and the lock off an edit
      is accepted as today; documents never confirmed keep today's payment updates.
- [ ] **T23**. Overdue sweep (`rp/schedule/`, recorded in `job_execution`), worker schedule plugin, in-process fallback.
      Files: `rp/schedule/overdue-sweep.scheduler.ts`, `rp/schedule/overdue-sweep.worker.ts`,
      `rp/receivables-payables-schedule.plugin.ts`, `apps/worker/src/plugins.ts`. Test: time-zone cases; one process at
      a time.
- [ ] **T24**. Backfill as the core operation `RECEIVABLES_OPEN_ITEM_BACKFILL` (`rp/backfill/open-item-backfill.operation.ts`,
      cursor steps, resumable). Test: rerun creates nothing new; totals less payments; a restart resumes at the cursor.
- [ ] **T25** (parallel). Real-time catalogue entries and hints for documents, open items and balances. Files:
      `rp/realtime/receivables-payables.realtime-catalogue.ts`, `rp/realtime/receivables-payables.hints.ts`. Test: hint
      emitted once per change.
- [ ] **T26** (parallel). Read-only GraphQL (`rp/graphql/`) + `graphql-field-binding-check.mjs` entry. Files:
      `rp/graphql/invoice-document.resolver.ts`, `rp/graphql/schema-extensions.ts`,
      `tools/scripts/graphql-field-binding-check.mjs`. Test: resolver specs.
- [ ] **T27**. Route the order billing bridge and invoice schedules through `INVOICE_DOCUMENT_WRITER` when the feature is on
      (`packages/plugins/order/src/lib/order-invoicing/order-invoicing.adapter.ts`, `core/invoice-schedule`). Test: bridge
      specs pass in both modes.
- [ ] **T63**. Opening documents (spec FR-8): a document marked `isOpening` confirms only with `OPENING_INVOICES_CREATE`,
      opens its open items with source type `OPENING`, stays out of sales and purchase figures and datasets, and its
      event carries `isOpening`. Files: `rp/documents/confirm-invoice-document.handler.ts`,
      `rp/documents/opening-document.rules.ts`, `rp/events/invoice-document-event.factory.ts`. Test: refused without the
      permission; open items created with source `OPENING`; the sales total of the period excludes it; the event says so.
- [ ] **T64**. Coupons on drafts (spec FR-13): a coupon code on a draft is validated and applied through `PRICING_COUPONS`
      (a `PROMOTION` adjustment row), counted as used on confirmation and returned on cancellation; absent port hides the
      field. Files: `rp/totals/invoice-coupon.service.ts`, `rp/totals/invoice-totals.pipeline.ts`,
      `rp/documents/confirm-invoice-document.handler.ts`. Test: invalid code refused; usage counted once on confirm and
      returned on cancel; without the port no coupon is accepted.
- [ ] **T65**. Instalment plans and early-settlement quotes (spec FR-24, FR-25): a draft's plan (count, dates, amounts) with
      an early-settlement discount and payment method per instalment, validated (sum equals the amount payable, no due
      date before the document date, equal dates warn); `GET /api/open-items/:id/settlement-quote?date=` answering the
      discount still available and the net amount, with the organization's discount tax treatment. Files:
      `rp/open-items/instalment-plan.service.ts`, `rp/open-items/settlement-quote.service.ts`,
      `rp/controllers/open-item.controller.ts`. Test: plan refused when it does not sum; quote before and after the
      discount date; tax-reducing treatment lowers the tax part in proportion.

## Phase 3 — UI surfaces

- [ ] **T28**. UI plugin scaffold `packages/plugins/receivables-payables-ui` (routes on the page location
      `accounting-sections`, menu entries, feature and permission gates, API services, i18n namespace). Files:
      `rp-ui/receivables-payables-ui.plugin.ts`, `rp-ui/receivables-payables-ui.routes.ts`,
      `rp-ui/services/invoice-documents.service.ts`. Test: plugin registration spec; hidden when routes answer 404.
- [ ] **T29**. Invoice pages: confirm bar with preview, state badges, instalments panel, document flow panel (extension
      panels on `apps/gauzy/src/app/pages/invoices`). Files: `rp-ui/components/confirm-bar/confirm-bar.component.ts`,
      `rp-ui/components/document-state-badge/document-state-badge.component.ts`,
      `rp-ui/components/instalments-panel/instalments-panel.component.ts`,
      `rp-ui/components/document-flow-panel/document-flow-panel.component.ts`. Test: component specs.
- [ ] **T30**. Bills list on the existing Received invoices page (`apps/gauzy/src/app/pages/invoices/invoices-received`,
      same route and toggle: payable documents and inter-company mirrors beside every `sentTo` invoice it lists today,
      each with "Record as bill") and the bill form (lines by item, expense category, description). Files:
      `apps/gauzy/src/app/pages/invoices/invoices-received/invoices-received.component.ts`,
      `rp-ui/components/bill-form/bill-form.component.ts`. Test: rendering and form specs; the page is unchanged with the
      feature off; with it on every invoice listed before is still listed.
- [ ] **T31** (parallel). Credit and debit note dialog and list. Files:
      `rp-ui/components/credit-note-dialog/credit-note-dialog.component.ts`,
      `rp-ui/pages/credit-debit-notes/credit-debit-notes-page.component.ts`. Test: caps shown, reason required.
- [ ] **T32** (parallel). Open items list, party balance card, reschedule dialog. Files:
      `rp-ui/pages/open-items/open-items-page.component.ts`, `rp-ui/components/open-balance-card/open-balance-card.component.ts`,
      `rp-ui/components/reschedule-dialog/reschedule-dialog.component.ts`. Test: component specs.
- [ ] **T33** (parallel). Holds dialog and Held documents view; settings page. Files:
      `rp-ui/components/hold-dialog/hold-dialog.component.ts`, `rp-ui/pages/held-documents/held-documents-page.component.ts`,
      `rp-ui/pages/settings/receivables-payables-settings-page.component.ts`. Test: component specs.
- [ ] **T34**. Recurring invoices page on the existing route (schedules of `invoice-schedule`). Files:
      `rp-ui/pages/recurring-invoices/recurring-invoices-page.component.ts`,
      `apps/gauzy/src/app/pages/invoices/invoices-routing.module.ts`. Test: stub stays with the feature off.
- [ ] **T35**. Default print templates for the six kinds (print template engine), today's invoice PDF kept as a template
      and as each organization's template until it picks another, and the public page additions
      (`packages/plugins/public-layout-ui`). Test: PDF snapshot per kind and language; an organization that picked
      nothing gets today's PDF.
- [ ] **T36**. i18n keys in every locale of `packages/ui-core/i18n`; accessibility pass (keyboard, labels). Test: i18n
      completeness check.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T37**. MCP tools for documents, notes, open items, holds
      (`packages/mcp-server/src/lib/tools/receivables-payables.ts`) with `preview`. Test: tool schema spec; preview writes
      nothing.
- [ ] **T38** (parallel). Report definitions (Open items, Instalments due, Credit and debit notes, Held documents) on the
      report builder. Files: `rp/reports/receivables-payables-report.definitions.ts`. Test: figures on seeded data.
- [ ] **T39** (parallel). Import templates `customer_invoices`, `supplier_bills`, `opening_open_items`. Files:
      `rp/import/receivables-payables.import-templates.ts`. Test: mapped import with an error file.
- [ ] **T40**. OpenAPI regenerated; SDK regeneration noted; user docs; `docs/specs/README.md` row. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Sources and controls

- [ ] **T41**. Create-from service `rp/sources/`: order lines through the order plugin's `OrderInvoicingService`
      (`order_line_invoice` counters), deliveries, estimates and deposits through the engine's links and roll-ups
      (tolerance, closed lines, required-source rules); no claim rows for these. Files:
      `rp/sources/create-from-sources.service.ts`, `rp/controllers/invoice-document.controller.ts`. Test: partial billing,
      over-billing, cancel and credit return quantities in `order_line_invoice` and the roll-ups.
- [ ] **T42**. Bills from purchase orders and receipts on `PurchaseOrderLineService`. Files: `rp/sources/purchase-bill.source.ts`,
      `packages/plugins/purchasing/src/lib/purchase-order-line/purchase-order-line.service.ts`. Test: billing policies;
      billed quantity recomputed.
- [ ] **T43**. Matching `rp/matching/bill-match.service.ts` (tolerances, outcomes, causes) and the confirm gate behind
      `matching.blockOnException` (default off: confirm with a warning). Test: matrix of quantity and price cases,
      two-way and three-way; with the setting off an exception warns and stays queued.
- [ ] **T44**. Exception queue: controller, resolutions, approval hand-off, re-match consumer on receipt and order events,
      inbox items. Files: `rp/matching/bill-match-exception.controller.ts`, `rp/matching/bill-match-exception.service.ts`,
      `rp/matching/rematch.consumer.ts`. Test: exception clears itself when the receipt event arrives.
- [ ] **T45** (parallel). Exception queue UI and facts panel. Files:
      `rp-ui/pages/bill-exceptions/bill-exception-queue.component.ts`,
      `rp-ui/components/bill-match-facts-panel/bill-match-facts-panel.component.ts`. Test: component specs.
- [ ] **T46**. Credit exposure `rp/credit/credit-exposure.service.ts` (`CREDIT_EXPOSURE_READER`: limit from
      `organization_contact.creditLimit`, exposure extending the `creditUsed` reconciliation with receivable open items)
      and the confirm check (limit, overdue threshold, policy). Test: exposure breakdown; warn and review modes; the
      nightly reconciliation and the live figure agree.
- [ ] **T47**. Credit reviews as `sales_credit_decision` rows (`invoiceId`, review state, exposure snapshot, condition,
      expiry) through `SALES_PARTY_GUARD`: controller, expiry job, inbox items, UI panel; no own table. Files:
      `rp/credit/credit-review.service.ts`, `rp/credit/credit-review.controller.ts`,
      `rp/schedule/credit-review-expiry.scheduler.ts`, `rp-ui/components/credit-review-panel/credit-review-panel.component.ts`.
      Test: approve once confirms the draft; lapse on exposure growth; an order decision and an invoice review share the
      record.
- [ ] **T48**. Advances and "settled now" through `OPEN_ITEM_ALLOCATOR`; small-balance proposal. Files:
      `rp/advances/advance-application.service.ts`, `rp/advances/small-balance.proposer.ts`,
      `rp/documents/confirm-invoice-document.handler.ts`. Test: same-transaction payment and allocation; absent port hides
      the options.
- [ ] **T49**. Inter-company mirror consumer on the `sentTo` path (mirror bill in the receiving organization, listed on its
      Received invoices page), price equality rule, paired cancel and notes, "Record as bill" for older received
      invoices. Files: `rp/intercompany/intercompany-mirror.consumer.ts`, `rp/intercompany/record-as-bill.service.ts`,
      `apps/gauzy/src/app/pages/invoices/invoices-received/invoices-received.component.ts`. Test: one counterpart per
      invoice; system actor of the other organization; older `sentTo` rows untouched.
- [ ] **T50**. Accrual register (money facts; quantities read from `purchase_order_line.receivedQuantity` /
      `billedQuantity` and the engine's delivery roll-ups): consumers for receipt and delivery events, clearing on bill
      and invoice lines, close reasons, events, list and report. Files: `rp/accruals/unbilled-accrual.service.ts`,
      `rp/accruals/accrual.consumer.ts`, `rp/accruals/unbilled-accrual.controller.ts`. Test: recognise, clear with price
      difference, restore on cancel; accrued quantity equals received minus billed on the purchase line.
- [ ] **T51**. Direct stock movement through `STOCK_MOVEMENT_WRITER`, bundle expansion, refusals (FR-60, FR-61). Files:
      `rp/stock/direct-stock-movement.service.ts`, `rp/stock/bundle-expansion.ts`. Test: confirm and cancel move stock
      both ways; drop-ship moves none.
- [ ] **T52** (parallel). Line marks for assets, service periods and landed cost in forms and events; billable source
      registry for other plugins. Files: `rp/documents/line-marks.ts`, `rp/sources/billable-source.registry.ts`,
      `rp/events/invoice-document-event.factory.ts`. Test: event carries the marks.
- [ ] **T53**. Bill approval through the approval workflows (amount bands). Files: `rp/bills/bill-approval.service.ts`,
      `rp/documents/confirm-invoice-document.handler.ts`. Test: confirm blocked until approved.
- [ ] **T66**. Sales shares from the source order (spec FR-16): building an invoice from order lines copies each line's sales
      shares and commissionable amount onto the draft (`salesAttribution` on the detail, `commissionable` on the line
      detail), in proportion to what is billed. Files: `rp/sources/sales-attribution.copier.ts`,
      `rp/sources/create-from-sources.service.ts`. Test: two partial invoices of one order carry shares that add up to
      the order's; a manual draft has none.

## Phase 6 — Advanced capabilities

- [ ] **T54**. Billing worklist read model `rp/worklist/` (time through `time_log.invoiceItemId`, expenses through
      `invoice_item.expenseId` and `expense.status`, delivered order lines through `order_line_invoice`, cycles and
      deposits through engine links, milestones through `billing_claim`; approved-only rule). Files:
      `rp/worklist/billing-worklist.read-model.ts`, `rp/worklist/billing-worklist.controller.ts`. Test: each source
      appears once and returns after release.
- [ ] **T55**. Build and bulk build (engine bulk creation; bulk as the operation `RECEIVABLES_BULK_BUILD` with a step per
      customer). Files: `rp/worklist/billing-worklist-build.service.ts`, `rp/worklist/bulk-build.operation.ts`. Test:
      partial failure keeps the rest; per-customer results on the operation.
- [ ] **T56**. Worklist UI and the Angular components `BillingWorklist`, `OpenBalanceCard`, `CreditReviewPanel`,
      `BillExceptionQueue` in `receivables-payables-ui`. Files: `rp-ui/pages/billing-worklist/billing-worklist-page.component.ts`,
      `rp-ui/components/billing-worklist/billing-worklist.component.ts`. Test: component specs.
- [ ] **T57**. Bill capture, the one intake register of supplier invoices: upload, email through a hand-off listener on
      `INBOX_EMAIL_HANDOFFS` for the capture mailbox, API and structured files through `BILL_CAPTURE_INTAKE` (batches as
      operations), checksum, extraction worker through the AI provider registry, proposal. Files:
      `rp/capture/bill-capture.service.ts`, `rp/capture/bill-capture.controller.ts`, `rp/capture/capture-email.handoff.ts`,
      `rp/capture/bill-capture-extract.worker.ts`. Test: duplicate file recognised; no provider → empty draft; never
      auto-confirmed; an email to the capture mailbox creates one capture; a structured file is proposed without
      extraction.
- [ ] **T58**. Live ageing: balance push, ageing card, "as of" queries, report definitions (Live ageing summary, Unbilled
      work, Bill match exceptions, Unbilled receipts and deliveries, Credit exposure). Files:
      `rp/realtime/receivables-payables.hints.ts`, `rp/open-items/party-open-balance.service.ts`,
      `rp-ui/components/ageing-card/ageing-card.component.ts`, `rp/reports/receivables-payables-report.definitions.ts`.
      Test: second client updates within 2 s; as-of equals a recomputation from entries.
- [ ] **T59**. Remaining MCP tools (worklist, matching, capture, credit, accruals) and the agent rules of FR-81. Files:
      `packages/mcp-server/src/lib/tools/receivables-payables.ts`. Test: an agent cannot decide its own request.
- [ ] **T60**. Integrity check job and endpoint (differences raised through `LEDGER_FINDINGS` when accounting is on);
      metrics. Files: `rp/integrity/receivables-integrity.scheduler.ts`, `rp/integrity/integrity-check.controller.ts`.
      Test: seeded mismatch is reported.
- [ ] **T61**. Defaults keep today's invoicing (spec AC-15): settings unset on a tenant with the feature on; existing
      invoice pages, routes, payments, PDF, public page and Received invoices page; backfill with invoices edited
      during the run. Files: `rp/receivables-payables.settings.ts`, `rp/backfill/open-item-backfill.operation.ts`,
      `rp-ui/receivables-payables-ui.plugin.ts`. Test: the existing invoice, estimate, payment, order bridge and schedule suites pass with the
      feature on and no setting written; an invoice edited mid-run ends with open items matching its new total.
- [ ] **T62**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `BANKING_OPEN_ITEMS`, `PORTAL_BILLS`, `PRINT_TIME_SOURCE`, `PURCHASING_BILLS`, `SUBCONTRACTING_BILLS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T67**. Worklist live updates and thresholds (spec FR-74): consumers of time approval, delivery confirmation and cycle
      due events refresh the customer's worklist entries and push them; the daily
      `receivables-payables.worklist-threshold` job tells the account owner once when unbilled work passes the
      organization's amount or age. Files: `rp/worklist/worklist-live.consumer.ts`,
      `rp/schedule/worklist-threshold.scheduler.ts`. Test: an approved time entry appears in an open worklist within 2 s;
      one inbox notice per customer and crossing.
- [ ] **T68**. Bill capture review (spec FR-54; intake and extraction are T57): review page with the file beside the proposed draft,
      low-confidence fields highlighted, corrections remembered per vendor as `bill_capture_hint` rows and offered on the
      next capture of that vendor. Files: `rp-ui/pages/bill-captures/bill-capture-review.component.ts`,
      `rp/capture/bill-capture-hint.service.ts`. Test: low-confidence fields marked; a corrected expense category is
      proposed for the vendor's next bill; accepting still leaves a draft.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Documents and lifecycle | T1, T4, T10 |
| FR-2 | §3.1 Documents and lifecycle | T8, T10 |
| FR-3 | §3.1 Documents and lifecycle | T14 |
| FR-4 | §3.1 Documents and lifecycle | T8, T14 |
| FR-5 | §3.1 Documents and lifecycle | T16, T22 |
| FR-6 | §3.1 Documents and lifecycle | T16 |
| FR-7 | §3.1 Documents and lifecycle | T15 |
| FR-8 | §3.1 Documents and lifecycle | T63 |
| FR-9 | §3.2 Lines, totals, parties, currency, dates | T9 |
| FR-10 | §3.2 Lines, totals, parties, currency, dates | T10 |
| FR-11–FR-12 | §3.2 Lines, totals, parties, currency, dates | T9 |
| FR-13 | §3.2 Lines, totals, parties, currency, dates | T64 |
| FR-14 | §3.2 Lines, totals, parties, currency, dates | T9 |
| FR-15 | §3.2 Lines, totals, parties, currency, dates | T10 |
| FR-16 | §3.2 Lines, totals, parties, currency, dates | T66 |
| FR-17–FR-19 | §3.2 Lines, totals, parties, currency, dates | T10 |
| FR-20 | §3.2 Lines, totals, parties, currency, dates | T10, T11 |
| FR-21 | §3.2 Lines, totals, parties, currency, dates | T10, T14 |
| FR-22 | §3.2 Lines, totals, parties, currency, dates | T10 |
| FR-23 | §3.3 Instalments and open items | T12, T14 |
| FR-24–FR-25 | §3.3 Instalments and open items | T65 |
| FR-26 | §3.3 Instalments and open items | T13, T23 |
| FR-27 | §3.3 Instalments and open items | T12 |
| FR-28 | §3.3 Instalments and open items | T12, T32 |
| FR-29–FR-32 | §3.4 Invoices from orders, deliveries and estimates | T41 |
| FR-33 | §3.4 Invoices from orders, deliveries and estimates | T29 |
| FR-34 | §3.4 Invoices from orders, deliveries and estimates | T27, T34 |
| FR-35 | §3.5 Credit notes and debit notes | T17, T31 |
| FR-36 | §3.5 Credit notes and debit notes | T11, T17 |
| FR-37 | §3.5 Credit notes and debit notes | T17 |
| FR-38 | §3.5 Credit notes and debit notes | T17, T51 |
| FR-39 | §3.5 Credit notes and debit notes | T17, T31 |
| FR-40 | §3.5 Credit notes and debit notes | T17 |
| FR-41 | §3.6 Supplier bills and holds | T18, T30 |
| FR-42 | §3.6 Supplier bills and holds | T18 |
| FR-43 | §3.6 Supplier bills and holds | T42 |
| FR-44 | §3.6 Supplier bills and holds | T53 |
| FR-45 | §3.6 Supplier bills and holds | T18 |
| FR-46 | §3.6 Supplier bills and holds | T19, T33 |
| FR-47 | §3.6 Supplier bills and holds | T19, T33 |
| FR-48–FR-49 | §3.7 Bill matching, exception queue and capture (advanced) | T43 |
| FR-50 | §3.7 Bill matching, exception queue and capture (advanced) | T43, T44, T45 |
| FR-51–FR-52 | §3.7 Bill matching, exception queue and capture (advanced) | T44 |
| FR-53 | §3.7 Bill matching, exception queue and capture (advanced) | T57 |
| FR-54 | §3.7 Bill matching, exception queue and capture (advanced) | T57, T68 |
| FR-55–FR-56 | §3.8 Credit control and credit reviews | T46 |
| FR-57–FR-58 | §3.8 Credit control and credit reviews | T47 |
| FR-59 | §3.8 Credit control and credit reviews | T46, T47 |
| FR-60–FR-61 | §3.9 Stock, assets, advances, inter-company documents, accruals | T51 |
| FR-62–FR-63 | §3.9 Stock, assets, advances, inter-company documents, accruals | T52 |
| FR-64–FR-66 | §3.9 Stock, assets, advances, inter-company documents, accruals | T48 |
| FR-67 | §3.9 Stock, assets, advances, inter-company documents, accruals | T30, T49 |
| FR-68 | §3.9 Stock, assets, advances, inter-company documents, accruals | T49 |
| FR-69–FR-70 | §3.9 Stock, assets, advances, inter-company documents, accruals | T50 |
| FR-71 | §3.10 Billing worklist and live ageing (advanced) | T54, T56 |
| FR-72 | §3.10 Billing worklist and live ageing (advanced) | T55, T56 |
| FR-73 | §3.10 Billing worklist and live ageing (advanced) | T54 |
| FR-74 | §3.10 Billing worklist and live ageing (advanced) | T67 |
| FR-75 | §3.10 Billing worklist and live ageing (advanced) | T13 |
| FR-76 | §3.10 Billing worklist and live ageing (advanced) | T58 |
| FR-77 | §3.11 Events, lists, agents, settings, compatibility | T14, T20 |
| FR-78 | §3.11 Events, lists, agents, settings, compatibility | T20 |
| FR-79 | §3.11 Events, lists, agents, settings, compatibility | T29, T30, T31, T32, T33 |
| FR-80 | §3.11 Events, lists, agents, settings, compatibility | T35 |
| FR-81 | §3.11 Events, lists, agents, settings, compatibility | T37, T59 |
| FR-82 | §3.11 Events, lists, agents, settings, compatibility | T7 |
| FR-83 | §3.11 Events, lists, agents, settings, compatibility | T21, T22 |
| FR-84 | §3.11 Events, lists, agents, settings, compatibility | T24, T61 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Every `FR-n` of `spec.md` is named by at least one test; every acceptance criterion has been run.
- With the flags off, the existing invoice, estimate, payment, order bridge and schedule suites pass unchanged.
- The integrity check reports no difference on the demo tenant after the finance acceptance run (invoice, part payment, bill).
