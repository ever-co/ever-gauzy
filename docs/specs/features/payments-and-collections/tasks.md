# Task Breakdown: Payments and collections

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `payments-and-collections`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_COLLECTIONS_ENABLED` and `FEATURE_COLLECTIONS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `core/` = `packages/core/src/lib/`, `col/` = `packages/plugins/payment/src/lib/collections/`.
- Starts after Phase 2 of `invoicing-receivables-payables` (the open-item register) is merged.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/collections.model.ts` (enums, `IPaymentDocument`, `IPaymentAllocation`,
      requests, orders, dunning, collections, financing, event payloads, ports incl. `PAYMENT_BANK_ACCOUNTS`) + optional
      fields on `IPayment`, `IPaymentAccountHolder`, `ISharedEntity`, `IAdjustment`; `PaymentMethodEnum`,
      `AdjustmentOwnerType` (`PAYMENT`, `PAYMENT_ALLOCATION`) and `AdjustmentType` (`SETTLEMENT_DEDUCTION`) additions
      (no existing value renamed or removed);
      export from `index.ts`. Test: existing payment inputs still compile.
- [ ] **T2**. Permission contributions with `defaultFor` grants and the feature contribution `FEATURE_COLLECTIONS` in the
      plugin's `payment.permissions.ts` and `payment.features.ts` (no core enum change, no seed), `payment.settings.ts`
      additions (`collections.*` keys); every role that holds `ORG_PAYMENT_ADD_EDIT` also gets `PAYMENTS_CONFIRM` and
      `PAYMENTS_CANCEL` by default. Test: provisioning spec for the default roles, including a custom role with
      `ORG_PAYMENT_ADD_EDIT`.
- [ ] **T3**. `col/collections-enabled.ts` (exact `true`), conditional import of `CollectionsModule` in `payment.plugin.ts`,
      `CollectionsSchedulePlugin` for the worker, `.env.sample`. Test: flag spec; with the switch off the plugin's module,
      entity and migration lists equal today's. Migration timestamps: `1791000076100` to `1791000076199` (`packages/plugins/payment`); `1791000076900` to `1791000076999` (`packages/core`).
- [ ] **T4**. Core columns on `core/payment/payment.entity.ts`, `payment-account-holder` (`mandateSequenceState`,
      `mandateLastUsedOn`) and `adjustment` (`dimensionSetId`) + migration
      `packages/core/src/lib/database/migrations/1791000076900-AlterPaymentForPaymentDocuments.ts`. Test:
      migration spec on SQLite; existing rows unchanged; existing payment and account-holder specs pass.
- [ ] **T5**. Entities `col/entities/` (tables of plan §3) with MikroORM repositories. Test: metadata spec, both ORMs.
- [ ] **T6**. Migrations creating the collections tables (settlement; orders and requests; collections) with the plugin's
      migration helpers, listed in `packages/plugins/payment/src/lib/migrations/index.ts` only with the deployment switch
      on. Files: `packages/plugins/payment/src/lib/migrations/1791000076110-CreateCollectionsSettlementTables.ts`,
      `migrations/1791000076120-CreateCollectionsOrderTables.ts`, `migrations/1791000076130-CreateCollectionsWorklistTables.ts`,
      `migrations/index.ts`. Test: SQLite run, rerun is a no-op, uniqueness assertions (`activeKey`, one notice per run
      and customer).
- [ ] **T7** (parallel). Seed migration: payment methods, governed reasons, document types and series (the payment types
      with `preexisting: true`, `business-document-engine` FR-113). Files:
      `packages/plugins/payment/src/lib/migrations/1791000076140-SeedCollectionsMasters.ts`, `migrations/index.ts`. Test:
      six methods per organization; reasons present; `down` no-op; with no type policy a confirmed payment is edited and
      deleted as today.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Payment methods `col/payment-method/` (service, controller, in-use rule; `kind` from `PaymentMethodEnum`
      written into `payment.paymentMethod`; providers' `supportedPaymentMethods` and `PAYMENT_PROVIDER` rule rows read as
      they are). Test: enum kept in step; a method in use cannot be deactivated; a method whose kind no provider supports
      offers no online checkout.
- [ ] **T9**. `col/payment-document/payment-document.service.ts`: drafts of money in, out and transfer (core payment +
      detail), party mapping to `organizationContactId` / `employeeId`, reference rules (required only by a method with
      `requiresReference`, false for the six seeded methods), transfer rules (FR-1 to FR-7), pre-filled drafts from an
      invoice, bill, order, request, notice, statement or claim (`/payment-documents/from/:sourceType/:sourceId`). Test:
      rule specs per refusal code; a payment without reference on a seeded method is accepted; a draft from an invoice
      carries its party, items and amounts.
- [ ] **T10**. Allocation `col/settlement/allocation.service.ts` (`OPEN_ITEM_ALLOCATOR`): sets applied all or nothing through
      `OPEN_ITEM_REGISTER`, sense and limit rules, currency conversion and exchange difference, dating. Test: conservation
      property (amount + deductions + tax withheld = allocations + unallocated); a 60 receipt with a 40 bank-charge
      deduction settles a 100 invoice in full; stale version → conflict; both ORMs.
- [ ] **T11**. Early-settlement discount and deductions `col/settlement/deduction.service.ts`: core `adjustment` rows
      (owners `PAYMENT`, `PAYMENT_ALLOCATION`, type `SETTLEMENT_DEDUCTION`, governed `reasonCode`, `dimensionSetId`),
      system lines marked, tax parts from the tax engine, withholding at payment recorded by the tax engine through
      `TAX_WITHHOLDING` (no withholding kind here). Test: discount inside and outside the window; undone on release by a
      reversing adjustment row; amount + adjustments + tax withheld = allocations + unallocated.
- [ ] **T12**. Confirm and cancel `col/payment-document/confirm-payment.handler.ts`, `cancel-payment.handler.ts` (period
      guard, number, credit open item, allocations, advance marking, idempotency key); edit of a confirmed payment
      (reversal, new confirmation, allocations re-applied) unless `collections.lockConfirmedPayments` is on (default off).
      Test: all-or-nothing on injected failure; cancel releases and publishes a reversal; a confirmed payment is editable
      with the setting off and refused with it on.
- [ ] **T13**. Release `col/settlement/release-allocation.handler.ts` and release on document cancel or delete (outbox
      consumer; refusal only when the organization chose it, default off). Test: outstanding restored exactly; effective
      date moved to an open period; deleting an invoice with payments leaves them as advances by default.
- [ ] **T14**. Open items for allocation and proposal `col/settlement/open-items-for-allocation.query.ts` (filters, unbilled
      orders for advances, oldest first). Test: filter matrix; held items left out.
- [ ] **T15**. Reconciliation of credits against charges and netting `col/settlement/reconciliation.service.ts`. Test: credit
      note against invoice; netting only for a linked contact and vendor.
- [ ] **T16**. Write-offs `col/write-off/` (document, lines, limits, approval, bulk small balances, tolerance at allocation,
      cancel). Test: above limit waits for approval; bulk reports per row.
- [ ] **T17**. Event payload builders `col/events/` and outbox appends for payment, allocation and write-off; posting result
      consumer of `accounting.journal.posted` / `.failed`. Test: payloads validate against the contracts.
- [ ] **T18**. Controllers `col/controllers/payment-document.controller.ts`, `allocation.controller.ts`,
      `write-off.controller.ts`, `settings.controller.ts` with DTOs, guards, Swagger, `preview`. Test: e2e per route (403,
      404 with the feature off, preview writes nothing).
- [ ] **T19**. Core: `PaymentService.create` with `invoiceId` goes through `OPEN_ITEM_ALLOCATOR` when the feature is on; `GET
      /payments/search`, `/statistics`, `/overdue` and the status, process and refund routes in
      `core/payment/payment.controller.ts`; today's `POST`, `PUT`, `DELETE /payments` keep their permission and answers
      (saved confirmed; unallocatable rest kept unallocated; `PUT` re-applies and `DELETE` releases allocations). Test: old
      behaviour with the feature off; with it on a data-entry user creates, edits and deletes a payment, and an
      overpayment is saved with an unallocated rest; the six MCP payment tools get `200`.
- [ ] **T20**. Online path: `packages/plugins/payment/src/lib/invoice-payment/invoice-payment.service.ts` records through the
      payment document service (one payment per provider reference, allocation to the invoice). Test: duplicate notification
      creates nothing; existing invoice-payment specs pass in both modes.
- [ ] **T21**. Refund of a credit or overpayment `col/payment-document/refund-credit.handler.ts` on the existing refund flow.
      Test: never above the credit; provider path bounded by captures.
- [ ] **T22**. Backfill as the core operation `COLLECTIONS_ALLOCATION_BACKFILL` (`col/backfill/allocation-backfill.operation.ts`,
      after the open-item backfill). Test: rerun creates nothing new; an existing payment mirrored as one `EXISTING`
      allocation; a restart resumes at the cursor.
- [ ] **T23** (parallel). Real-time catalogue entries and hints (payments, allocations). Files:
      `col/events/collections-realtime.catalogue.ts`, `col/events/collections-realtime.hints.ts`. Test: one hint per
      change.
- [ ] **T24** (parallel). Integrity check job and `GET /api/allocations/integrity`. Files:
      `col/settlement/allocation-integrity.service.ts`, `col/settlement/allocation-integrity.scheduler.ts`,
      `col/controllers/allocation.controller.ts`. Test: seeded mismatch is reported.

## Phase 3 — UI surfaces

- [ ] **T25**. UI plugin scaffold `packages/plugins/payment-ui` (routes on the page location `accounting-sections`, the
      existing Payments page extended, menu, feature and permission gates, API services, i18n namespace). Test: plugin
      registration spec; hidden on 404.
- [ ] **T26**. Record payment dialog with allocation grid, deductions, advance rest and preview. Files:
      `packages/plugins/payment-ui/src/lib/components/record-payment/record-payment-dialog.component.ts`,
      `components/record-payment/allocation-grid.component.ts`, `services/payment-documents.service.ts`. Test: component
      specs (totals must balance; keyboard navigation).
- [ ] **T27**. Payments list with direction tabs and state badges on the existing page; invoice payments tab reads server
      states. Files: `apps/gauzy/src/app/pages/payments/payments.component.ts`,
      `packages/plugins/payment-ui/src/lib/components/payments-list/payment-direction-tabs.component.ts`,
      `components/payments-list/payment-state-badge.component.ts`. Test: rendering specs; old page unchanged with the
      feature off.
- [ ] **T28** (parallel). Reconciliation workspace (credits against charges, differences, netting). Files:
      `packages/plugins/payment-ui/src/lib/components/allocation-workspace/allocation-workspace.component.ts`,
      `services/allocations.service.ts`. Test: component specs; a netting is offered only for a linked contact and vendor.
- [ ] **T29** (parallel). Unallocated list, write-off dialog, small-balance list, approvals. Files:
      `packages/plugins/payment-ui/src/lib/components/unallocated/unallocated-list.component.ts`,
      `components/write-off/write-off-dialog.component.ts`, `components/write-off/small-balances.component.ts`. Test:
      specs.
- [ ] **T30** (parallel). Settings page (methods, reasons, tolerances, dating, refuse cancel while allocated, lock
      confirmed payments, reminders through dunning; each off by default). Files:
      `packages/plugins/payment-ui/src/lib/settings/collections-settings-page.component.ts`,
      `settings/payment-methods.component.ts`. Test: specs; defaults equal today's behaviour.
- [ ] **T31**. Print templates: receipt, payment voucher, remittance advice (existing receipt template kept). Files:
      `col/print-templates/payment-voucher.template.ts`, `col/print-templates/remittance-advice.template.ts`,
      `col/print-templates/collections-print-templates.ts`. Test: PDF snapshot per template and language.
- [ ] **T32**. i18n keys `COLLECTIONS.*` in every locale; accessibility pass. Files:
      `packages/ui-core/i18n/assets/i18n/en.json` and every other locale file there (`ar.json`, `bg.json`, `de.json`, …).
      Test: i18n completeness check.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T33**. MCP tools for payments, allocation, release, write-off (`packages/mcp-server/src/lib/tools/collections.ts`)
      with `preview`. Test: tool schema spec; preview writes nothing.
- [ ] **T34** (parallel). Report definitions: Payment register, Unallocated payments and credits, Allocation history,
      Write-offs and deductions, Discounts. Files: `col/reports/collections-report-datasets.ts` (datasets `payments`,
      `payment_allocations`, `write_offs`), `col/reports/definitions/payment-register.definition.ts`,
      `unallocated-payments.definition.ts`, `allocation-history.definition.ts`, `write-offs-and-deductions.definition.ts`,
      `discounts.definition.ts`. Test: figures on seeded data.
- [ ] **T35** (parallel). Import templates `payments`, `opening_advances` (party bank details import through banking).
      Files: `col/import/payments.import-template.ts`, `col/import/opening-advances.import-template.ts`. Test: mapped
      import with an error file.
- [ ] **T36**. OpenAPI regenerated; SDK regeneration noted; user docs; `docs/specs/README.md` row. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Requests, links, money out, statements

- [ ] **T37**. Payment requests `col/payment-request/` (lines, states, sending, expiry and reminder job). Test: amount equals
      lines; state follows open-item changes.
- [ ] **T38**. Pay links `col/pay-link/` as core `shared_entity` links issued through the public-link service of
      `access-control-and-security` (hashed token, expiry, revoke, view count; transfer reference derived from the
      link id; invoices keep `invoice.token`) and public controller extending
      `invoice-payment` (page data, checkout, notification). Test: only the party's items are exposed; expired and
      revoked links answer `404`; rate limit; the stored token never equals the secret in the URL.
- [ ] **T39**. Public pay page in `packages/plugins/public-layout-ui` (item selection, discount shown, methods, transfer
      details) and the Pay button on the public invoice page while the feature is on for the invoice's tenant. Test:
      component specs; the public invoice page is unchanged with the feature off.
- [ ] **T40**. Statements `col/statement/` (activity and open-items modes, ageing, language, PDF template, public page with
      link). Test: opening + movements = closing; per-currency output.
- [ ] **T41**. Statement schedules as report-builder schedules of the statement definition (`report_schedule` with one
      recipient per selected customer; runs and deliveries are `report_schedule_run` and `report_delivery`), `statement`
      rows keyed by `scheduleRunId`. Files: `col/statement/statement-schedule.service.ts`,
      `col/statement/statement-delivery.handler.ts`, `col/reports/definitions/statement-of-account.definition.ts`. Test:
      missing email is logged and the rest is sent; rerun sends nothing twice.
- [ ] **T42**. Bank details through `PAYMENT_BANK_ACCOUNTS` (banking's `party_bank_account`, masked, with its verification
      state) for order lines and pay-page transfer details; consumer holding or freeing order lines on banking's
      change and verification events; no account number stored here; the comments that forbid account numbers on
      `core/payment-account-holder/payment-account-holder.entity.ts` and `plugins/marketplace/src/lib/seller/seller.entity.ts`
      name banking's store as the one exception. Test: an unverified detail holds order lines; a verified one frees
      them; nothing of this plugin holds an account number.
- [ ] **T43**. Payment orders `col/payment-order/` (proposal over supplier and employee payable items, net pay included,
      lines, one active order per item, approval request, approval with creator ≠ approver and workflow bands, cancel);
      marketplace seller payouts stay on their provider path. Test: uniqueness; approval rules; a net pay item of an
      employee joins an order.
- [ ] **T44**. Bank file generator registry and the three shipped generators `col/bank-file/` (credit transfer XML, direct
      debit XML, delimited); export with hash and duplicate mark; `payment_order_file.fileId` marked `@ExportRedacted`.
      Test: generated XML validates against the published schemas; fixtures per generator; a tenant export omits the
      bank files.
- [ ] **T45**. Execution `col/payment-order/execute-payment-order.handler.ts` (manual, status file, bank match event):
      payments and allocations confirmed, rejected lines reopened; remittance advice sent. Test: partial rejection.
- [ ] **T46** (parallel). Payment orders UI (proposal, approval, export, execution, bank details). Files:
      `packages/plugins/payment-ui/src/lib/components/payment-orders/payment-orders-list.component.ts`,
      `components/payment-orders/payment-order-proposal.component.ts`,
      `components/payment-orders/payment-order-detail.component.ts`, `services/payment-orders.service.ts`. Test: component
      specs; the approve action is hidden for the order's creator.
- [ ] **T47**. Cheques `col/cheque/` (books, numbering, layout template with test print, void, reprint, register) + UI. Test:
      numbers never reused; amount in words per locale.
- [ ] **T48** (parallel). Recurring payments through the engine's recurrence (`col/payment-document/recurrence.consumer.ts`).
      Test: locked period skips with a notice.
- [ ] **T49** (parallel). Requests, links and statements UI; MCP tools for requests, orders, statements; report
      definitions Payment requests and orders, and the statement of account definition. Files:
      `packages/plugins/payment-ui/src/lib/components/payment-requests/payment-requests.component.ts`,
      `components/statements/statement-view.component.ts`, `packages/mcp-server/src/lib/tools/collections.ts`,
      `packages/plugins/payment/src/lib/collections/reports/definitions/payment-requests-and-orders.definition.ts`. Test:
      component specs; tool schema spec with `preview`.

## Phase 6 — Collections (advanced)

- [ ] **T50**. Dunning policies and levels `col/dunning/policy/` (assignment, texts per language, level 0 copied from the
      core reminder steps and template when an organization switches `collections.remindersThroughDunning` on, with
      `invoiceRemindersEnabled` left as it is; level actions `STOP_NEW_ORDERS` and `SUSPEND_SUBSCRIPTIONS`,
      `CANCEL_SUBSCRIPTIONS`). Test: level resolution by days overdue and minimum amount; the copied level 0 sends on the
      same days as the core sweep did; switching the setting off returns the sending to the core sweep.
- [ ] **T51**. Dunning notices `col/dunning/notice/` (lines, fee and interest computation, charges as open items of source
      type `DUNNING_CHARGE`, supersede, settle, cancel, waive, events, print template per level). Test: interest formula;
      notice settles when items and charges are settled.
- [ ] **T52**. Dunning runs as the core operation `COLLECTIONS_DUNNING_RUN` (one step per customer; exclusions, auto level
      cap, preview, log on the operation; level actions through `collections.dunning_level.action` and
      `SUBSCRIPTION_COLLECTION_ACTIONS`) and `DUNNING_COVERAGE` read by
      `core/invoice/invoice-reminder/invoice-reminder.service.ts` (covered only where the organization chose reminders
      through dunning). Test: one notice per customer per run; excluded cases; no reminder email from the core sweep for
      a covered customer; with the setting off the core sweep sends exactly as before; a level with the suspend action
      calls the port once.
- [ ] **T53** (parallel). Dunning UI (policies, runs with preview, notices, waive). Files:
      `packages/plugins/payment-ui/src/lib/components/dunning/dunning-policies.component.ts`,
      `components/dunning/dunning-runs.component.ts`, `components/dunning/dunning-notices.component.ts`,
      `services/dunning.service.ts`. Test: component specs.
- [ ] **T54**. Collection profiles (collection columns only; account manager, terms, blocks and limits read from
      `organization_contact` and its `contact_group`; notes as core `comment` rows on the contact), worklist read model and
      ranking `col/collections/worklist/`; days-late refresh job; forecast. Test: ranking order on seeded cases; expected
      date rule.
- [ ] **T55**. Promises and payment plans `col/collections/promise/` with the evaluation job. Test: kept and broken at the
      end of the day in the organization's time zone.
- [ ] **T56**. Disputes `col/collections/dispute/` (reasons, items, resolution paths, disputed flag through events). Test:
      disputed items leave dunning and interest.
- [ ] **T57**. Drafted reminders `col/collections/reminder/` (facts assembly, AI provider call, template fallback, approval,
      sending, timeline entry). Test: draft contains only supplied facts; no provider → template.
- [ ] **T58**. Worklist UI and the Angular components `AllocationWorkspace`, `CollectionsWorklist`, `StatementView` in
      `payment-ui` (the pay page is in `public-layout-ui`, T39). Test: component specs.
- [ ] **T59**. Automatic allocation and suggestions `col/settlement/auto/`: the operation `COLLECTIONS_AUTO_ALLOCATION` with
      one child operation per party (the live-aggregate rule is the per-party lock), rules, log, pause and cancel through
      the core routes; reasons and confidence; remittance text reader. Test: rule order; nothing below the threshold is
      applied; a hand allocation for a party under a live run is refused.
- [ ] **T60**. Direct debit mandates on `payment_account_holder` (`mandateReference`, `mandateAcceptedAt`,
      `mandateSequenceState`, `mandateLastUsedOn`; `DIRECT_DEBIT` method token naming the debtor's bank account in
      banking's store) and collection orders. Files:
      `packages/core/src/lib/payment-account-holder/payment-account-holder.entity.ts`,
      `col/payment-order/collection-order.service.ts`, `col/payment-order/mandate.controller.ts`
      (`PUT /api/payment-account-holders/:id/mandate`). Test: sequence state moves from first to recurring; no mandate
      table.
- [ ] **T61**. Invoice financing `col/financing/` (agreements, funding, repayment, financed flag, events) + UI. Test: one
      active agreement per invoice; amounts bounded by outstanding.
- [ ] **T62**. Remaining MCP tools (dunning, collections, financing, runs), agent rules of FR-63, report definitions Dunning,
      Collections performance, Collections forecast, Financing and cheques. Files:
      `packages/mcp-server/src/lib/tools/collections.ts`,
      `packages/plugins/payment/src/lib/collections/reports/definitions/dunning.definition.ts`,
      `collections-performance.definition.ts`, `collections-forecast.definition.ts`, `financing-and-cheques.definition.ts`.
      Test: an agent cannot approve its own order or write-off.
- [ ] **T63**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `EXPENSE_PAYMENTS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T64**. Saved-view lists: Payments, Unallocated, Requests, Orders, Write-offs, Statements, Dunning, Collections and
      Financing registered as record types of `record-views-and-search` (columns, filters, default views) and shown as
      saved-view lists in `payment-ui`. Files: `packages/plugins/payment/src/lib/collections/record-types/collections-record-types.ts`,
      `packages/plugins/payment-ui/src/lib/components/lists/collections-saved-view-lists.component.ts`. Test: each list
      opens with its default view and filters; with the feature off none is registered.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Payments as documents | T4, T9 |
| FR-2 | §3.1 Payments as documents | T12 |
| FR-3–FR-4 | §3.1 Payments as documents | T9 |
| FR-5 | §3.1 Payments as documents | T8 |
| FR-6 | §3.1 Payments as documents | T9 |
| FR-7 | §3.1 Payments as documents | T9, T10 |
| FR-8 | §3.1 Payments as documents | T2, T12, T19 |
| FR-9 | §3.1 Payments as documents | T9, T26 |
| FR-10 | §3.1 Payments as documents | T48 |
| FR-11 | §3.1 Payments as documents | T9, T43 |
| FR-12 | §3.1 Payments as documents | T10, T19, T22, T27 |
| FR-13 | §3.2 Allocation and reconciliation of open items | T10, T26 |
| FR-14 | §3.2 Allocation and reconciliation of open items | T14 |
| FR-15 | §3.2 Allocation and reconciliation of open items | T10 |
| FR-16 | §3.2 Allocation and reconciliation of open items | T11 |
| FR-17 | §3.2 Allocation and reconciliation of open items | T10 |
| FR-18 | §3.2 Allocation and reconciliation of open items | T15, T28 |
| FR-19 | §3.2 Allocation and reconciliation of open items | T10 |
| FR-20 | §3.2 Allocation and reconciliation of open items | T13 |
| FR-21 | §3.2 Allocation and reconciliation of open items | T13 |
| FR-22 | §3.2 Allocation and reconciliation of open items | T59 |
| FR-23 | §3.2 Allocation and reconciliation of open items | T59 |
| FR-24 | §3.3 Advances, deductions, taxes, write-offs, refunds | T12 |
| FR-25 | §3.3 Advances, deductions, taxes, write-offs, refunds | T11 |
| FR-26 | §3.3 Advances, deductions, taxes, write-offs, refunds | T11 |
| FR-27–FR-28 | §3.3 Advances, deductions, taxes, write-offs, refunds | T16 |
| FR-29 | §3.3 Advances, deductions, taxes, write-offs, refunds | T21 |
| FR-30 | §3.4 Payment requests and pay links | T37, T49 |
| FR-31 | §3.4 Payment requests and pay links | T37 |
| FR-32 | §3.4 Payment requests and pay links | T37 |
| FR-33 | §3.4 Payment requests and pay links | T38, T39, T49 |
| FR-34 | §3.4 Payment requests and pay links | T20, T38 |
| FR-35 | §3.4 Payment requests and pay links | T37, T43 |
| FR-36 | §3.5 Payment orders, bank files, cheques | T43 |
| FR-37 | §3.5 Payment orders, bank files, cheques | T42 |
| FR-38 | §3.5 Payment orders, bank files, cheques | T43, T46 |
| FR-39 | §3.5 Payment orders, bank files, cheques | T44 |
| FR-40 | §3.5 Payment orders, bank files, cheques | T45 |
| FR-41 | §3.5 Payment orders, bank files, cheques | T60 |
| FR-42 | §3.5 Payment orders, bank files, cheques | T47 |
| FR-43 | §3.5 Payment orders, bank files, cheques | T45 |
| FR-44 | §3.6 Statements of account | T40 |
| FR-45 | §3.6 Statements of account | T41 |
| FR-46 | §3.7 Dunning | T50 |
| FR-47–FR-48 | §3.7 Dunning | T51 |
| FR-49 | §3.7 Dunning | T52, T53 |
| FR-50 | §3.7 Dunning | T50, T51, T52 |
| FR-51 | §3.8 Collections worklist (advanced) | T54, T58 |
| FR-52 | §3.8 Collections worklist (advanced) | T55 |
| FR-53 | §3.8 Collections worklist (advanced) | T55 |
| FR-54 | §3.8 Collections worklist (advanced) | T56 |
| FR-55 | §3.8 Collections worklist (advanced) | T57 |
| FR-56 | §3.8 Collections worklist (advanced) | T54, T57 |
| FR-57 | §3.8 Collections worklist (advanced) | T54 |
| FR-58–FR-59 | §3.9 Invoice financing | T61 |
| FR-60 | §3.10 Events, lists, agents, settings, compatibility | T17, T51, T61 |
| FR-61 | §3.10 Events, lists, agents, settings, compatibility | T12, T17 |
| FR-62 | §3.10 Events, lists, agents, settings, compatibility | T31, T40, T47, T51, T64 |
| FR-63 | §3.10 Events, lists, agents, settings, compatibility | T33, T49, T62 |
| FR-64 | §3.10 Events, lists, agents, settings, compatibility | T19, T33 |
| FR-65 | §3.10 Events, lists, agents, settings, compatibility | T18, T30 |
| FR-66 | §3.10 Events, lists, agents, settings, compatibility | T19, T22 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; spec AC-14 holds.
- Constitution gates in `spec.md` §9 confirmed.
- Every `FR-n` of `spec.md` is named by at least one test; every acceptance criterion has been run.
- With the flags off, the existing payment, refund, invoice-payment and reminder suites pass unchanged.
- The integrity check reports no difference after the finance acceptance run (invoice, part payment, bank statement, bill).
