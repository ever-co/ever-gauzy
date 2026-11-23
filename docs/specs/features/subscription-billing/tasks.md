# Task Breakdown: Subscription billing

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `subscription-billing`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flags: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- `sub/` means `packages/plugins/subscription/src/lib/`, `subui/` means `packages/plugins/subscription-ui/src/lib/`,
  `subrui/` means `packages/plugins/subscription-react-ui/src/lib/`. New entity folders follow the existing ones of
  `sub/` (`subscription-plan/`: `<name>.entity.ts`, `<name>.service.ts`, `<name>.controller.ts`, `dto/`,
  `repository/type-orm-<name>.repository.ts`, `repository/mikro-orm-<name>.repository.ts`). Plugin migrations take
  `1791000082100` to `1791000082150` and the core migration `1791000082900`, in the order the plan lists them.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: additive fields, new interfaces, enums and port interfaces in
      `packages/plugins/subscription/src/lib/subscription.types.ts`; `QUARTERLY`, `YEARLY`, `endDay`,
      `subscriptionId` in `packages/contracts/src/lib/invoice-schedule.model.ts`. Test: existing type specs pass;
      new shapes compile against sample payloads.
- [ ] **T2**. Migration `sub/database/migrations/1791000082100-AddSubscriptionBillingTerms.ts` (new columns on `subscription_plan`, `subscription`,
      `subscription_item`, `subscription_billing`) for PostgreSQL, MySQL and SQLite; entity columns in
      `sub/subscription-plan/subscription-plan.entity.ts`, `sub/subscription/subscription.entity.ts`,
      `sub/subscription-item/subscription-item.entity.ts`, `sub/subscription-billing/subscription-billing.entity.ts`. Test: migration
      spec on SQLite with seeded rows; existing rows read with defaults; up twice is a no-op. Migration timestamps: `1791000082100` to `1791000082199` (`packages/plugins/subscription`); `1791000082900` to `1791000082999` (`packages/core`).
- [ ] **T3** (parallel). Migrations `CreateSubscriptionPlanComponentTables`, `CreateSubscriptionChangeTables`,
      `CreateSupplierSubscriptionTables` (supplier subscription with `recurringExpenseId` and `dimensionSetId`) +
      entities and both repositories. Files: `sub/database/migrations/1791000082110-CreateSubscriptionPlanComponentTables.ts`,
      `sub/database/migrations/1791000082120-CreateSubscriptionChangeTables.ts`,
      `sub/database/migrations/1791000082130-CreateSupplierSubscriptionTables.ts`,
      `sub/subscription-plan-component/{subscription-plan-component,subscription-plan-provider-price}.entity.ts`,
      `sub/subscription-change/subscription-change.entity.ts`,
      `sub/supplier-subscription/{supplier-subscription,supplier-subscription-line,supplier-subscription-cycle}.entity.ts`,
      with their `repository/` files. Test: migration specs; repository smoke specs for both ORMs.
- [ ] **T4** (parallel). Migrations `CreateUsageTables`, `CreateSubscriptionMetricDailyTable` + entities.
      Files: `sub/database/migrations/1791000082140-CreateUsageTables.ts`,
      `sub/database/migrations/1791000082150-CreateSubscriptionMetricDailyTable.ts`,
      `sub/usage/{usage-meter,usage-event,usage-period-total}.entity.ts`,
      `sub/subscription-metric/subscription-metric-daily.entity.ts`, with their `repository/` files. Test: migration
      specs; unique keys refuse duplicates on the three dialects.
- [ ] **T5**. Core migration `packages/core/src/lib/database/migrations/1791000082900-AddInvoiceScheduleEndDayAndSubscription.ts`; entity and DTO fields in
      `packages/core/src/lib/invoice-schedule` (`invoice-schedule.entity.ts`, `dto/`). Test: `invoice-schedule.service.sqlite.spec.ts` extended; old rows
      unchanged.
- [ ] **T6**. `sub/subscription.settings.ts` (settings of plan §2, defaults keeping today's behaviour), new permission
      contributions with `defaultFor` in `sub/subscription.permissions.ts` (no seed migration), service seed of the tag type
      "Subscription cancellation reason" per organization (`sub/subscription-cancellation-reasons.ts`). Test: settings resolve per organization; every default reads
      today's behaviour (no scheduled run, no invoice for automatic cycles, bill while unpaid, no trial or pause limit);
      `defaultCollection` is automatic for an organization that had plans; grants resolve for the roles.
- [ ] **T7**. New port tokens with optional injection (`SUBSCRIPTION_INVOICING`, `SUBSCRIPTION_TIME_USAGE`,
      `SUBSCRIPTION_SEATS`, `SUBSCRIPTION_REVENUE_SCHEDULES`, `SUBSCRIPTION_PERIOD_LOCK`) in `sub/subscription.ports.ts` and the answered port
      `SUBSCRIPTION_COLLECTION_ACTIONS` (suspend, cancel, reinstate for the dunning engine of
      `payments-and-collections`; `sub/collection/subscription-collection-actions.ts`), bindings in `apps/api/src/plugin-composition.ts`. Test: composition spec lists the
      bindings; services run unbound.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Period engine: billing timing, calendar alignment with prorated first period, end date and expiry
      (`sub/subscription.cycle.ts`, `sub/engine/periods.ts`). Test: property tests (periods contiguous, late run never
      shifts the calendar) and existing `subscription.cycle.spec.ts` unchanged.
- [ ] **T9**. Price basis resolution per cycle (`sub/engine/price-basis.ts`) through the pricing port. Test: unit for
      the four bases.
- [ ] **T10**. Settlement by invoice: `InvoiceSettler` calling `ISubscriptionInvoicingPort.raiseCycleInvoice`
      (lines with service period, setup fee, discount, terms, dimensions, confirm or draft); settler stored on the
      cycle before the claim; the refund of an invoiced cycle raises a credit note through `raiseCreditNote`. Files:
      `sub/settlement/invoice-settler.ts`, `sub/subscription-billing/subscription-billing.service.ts`. Test: SQLite
      end-to-end with a fake invoicing port; a period bills once under two concurrent attempts; a refund of an invoiced
      cycle raises one credit note.
- [ ] **T11**. Automatic settlement keeps the order path and, where `subscription.invoiceAutomaticCycles` is on,
      invoices the order through the order-invoice bridge; the scheduled run that calls it is gated by
      `FEATURE_SUBSCRIPTION_BILLING`, while a manual bill of a cycle or run keeps this path whatever the flag, as today;
      refused with `SUBSCRIPTION_NO_PAYMENT_PROVIDER` when no provider is bound, as today. Files: `sub/settlement/automatic-settler.ts`,
      `sub/subscription-billing/subscription-billing.service.ts`. Test: existing order-path specs unchanged;
      invoice linked on the cycle with the setting on; no invoice with it off; with `FEATURE_SUBSCRIPTION_BILLING` off a
      manual `POST /subscriptions/:id/bill` of an automatically collected subscription raises the order and charge as
      today, and the scheduled sweep bills nothing.
- [ ] **T12**. Trial handling (`trialEndsAt`, extend, end, one trial per customer and plan where the organization
      setting is on), future start, restart endpoint. Files: `sub/subscription/subscription-trial.service.ts`,
      `sub/subscription/subscription.service.ts`, `sub/subscription/subscription.controller.ts` (`/restart`, `/trial`).
      Test: unit and e2e; a second trial is accepted with the setting
      off.
- [ ] **T13**. Collection state: outbox consumer `subscriber:subscription` for invoice paid, overdue, cancelled and
      credited (past due, back to current); suspend, cancel and reinstate through `SUBSCRIPTION_COLLECTION_ACTIONS`
      when a dunning level of `payments-and-collections` calls them; held cycles and release; immediate retry on a
      replaced instrument. Files: `sub/collection/subscription-invoice-events.consumer.ts`,
      `sub/collection/subscription-collection-actions.ts`, `sub/subscription-billing/subscription-billing.controller.ts`
      (`/release`). Test: SQLite end-to-end; redelivered events change nothing twice; a dunning level suspends;
      the default policy suspends no automatically collected subscription.
- [ ] **T14**. Locked-period handling through `SUBSCRIPTION_PERIOD_LOCK` (first open day or hold). Files:
      `sub/settlement/period-lock.ts`. Test: unit.
- [ ] **T15**. Billing run as core operation `SUBSCRIPTION_BILLING_RUN`: definition and steps registered with the
      operation registry, filters, as-of validation, preview mode, per-subscription outcomes on the cycles
      (`operationId`), counts and failures in the operation result, failure digest; `POST /subscriptions/billing-run`
      extended (`202` with the operation); history through core `/operations`. Files:
      `sub/billing-run/subscription-billing-run.operation.ts`, `sub/billing-run/subscription-billing-run.service.ts`,
      `sub/subscription/subscription.controller.ts`. Test: partial failure continues;
      preview writes nothing; future date refused; a second live run of an organization refused; a cycle of the period
      starting December 1 billed five days in advance is billed by a run on November 26, while a subscription starting
      in the future and a cycle whose billing date is still ahead are refused.
- [ ] **T16**. Schedules and workers in `sub/schedule/` (`subscription.scheduler.ts`, `subscription.worker.ts`,
      `subscription-schedule.plugin.ts`: billing sweep starting operations, changes and notices
      sweeps, each recorded in `job_execution`); `SubscriptionSchedulePlugin` in `apps/worker/src/plugins.ts`;
      in-process fallback. Test: sweep specs; tenant without `FEATURE_SUBSCRIPTION_BILLING` is skipped; an organization
      without `subscription.scheduledRun` is skipped; worker plugin list spec.
- [ ] **T17**. Supplier subscriptions: service and controller on the organization's recurring expense (created with
      it or attached through `POST /organization-recurring-expenses/:id/supplier-subscription`; monthly equivalent,
      start and end written to the recurring expense), bill drafts through `raiseBillDraft`, renewal reminders as
      `reminder` rows, matching of confirmed supplier bills, variance flag. Files:
      `sub/supplier-subscription/supplier-subscription.service.ts`, `sub/supplier-subscription/supplier-subscription.controller.ts`,
      `sub/supplier-subscription/dto/`, `sub/supplier-subscription/supplier-bill-matching.consumer.ts`. Test: unit and SQLite end-to-end;
      the dashboard's recurring cost counts the subscription once.
- [ ] **T18**. Notices: templates per language, notice markers, preference-aware delivery. Files:
      `sub/notices/subscription-notices.service.ts`, `sub/notices/subscription-notice-templates.ts`. Test: each notice sent
      once per subscription, kind and announced date (marker `<subscriptionId>:<kind>:<date>`); two successive renewals
      of a yearly subscription each get one renewal notice, and a repeated sweep sends neither again.
- [ ] **T19**. New events appended to the outbox and added to `SUBSCRIPTION_STREAMED_EVENTS`
      (`sub/subscription-streamed-events.ts`); timeline read
      (`/subscriptions/:id/timeline`), heat map read (`sub/subscription/subscription-timeline.service.ts`). Test: `subscription-streamed-events.spec.ts` extended.
- [ ] **T20**. Settings endpoint; cancellation reasons read from the tags of their tag type (core `/tags`). Files:
      `sub/settings/subscription-settings.controller.ts`, `sub/subscription/subscription.service.ts`. Test: e2e
      with permission checks; a cancellation stores the reason tag; a cancellation with a free-text reason or none is
      accepted as today.
- [ ] **T21**. Invoice schedules: quarterly and yearly cadence and end day in
      `packages/core/src/lib/invoice-schedule/invoice-schedule.rules.ts` and the
      run service (`invoice-schedule-run.service.ts`). Test: `invoice-schedule.rules.spec.ts` extended; schedule past its end day stops.
- [ ] **T22**. Billing history and supplier subscription report definitions. Files:
      `sub/reports/subscription-report-definitions.ts`. Test: figures agree with seeded cycles.
- [ ] **T54**. Plan components and provider prices (spec FR-3, FR-4): `/subscription-plans/:id/components` and
      `PUT /subscription-plans/:id/provider-prices` with a provider reference unique per provider. Files:
      `sub/subscription-plan-component/subscription-plan-component.service.ts`,
      `sub/subscription-plan-component/subscription-plan-component.controller.ts`,
      `sub/subscription-plan-component/dto/plan-component.dto.ts`, `sub/subscription-plan-component/dto/provider-price.dto.ts`.
      Test: `subscription-plan-component.service.spec.ts`: an add-on and a usage component are stored; a duplicate
      provider reference is refused; e2e with permission checks.
- [ ] **T55**. Subscription write rules (spec FR-7, FR-9, FR-19): create and update DTOs of plans and subscriptions
      accept the new optional fields; with the organization setting `subscription.refuseMixedLines` on, lines that do not
      share one cadence and one currency are refused with `SUBSCRIPTION_LINES_CADENCE_MISMATCH` naming the line; with
      `subscription.refuseArchivedPlans` on, a new subscription on an archived plan is refused; existing subscriptions of
      an archived plan keep billing; both settings are off by default; updates keep the existing version check (`409` on an outdated version).
      Files: `sub/subscription/dto/create-subscription.dto.ts`, `sub/subscription/dto/update-subscription.dto.ts`,
      `sub/subscription-plan/dto/create-subscription-plan.dto.ts`, `sub/subscription-plan/dto/update-subscription-plan.dto.ts`,
      `sub/subscription/subscription.service.ts`, `sub/subscription.settings.ts`. Test: `subscription.service.spec.ts`: with
      the settings on, mixed cadences refused naming the line and an archived plan refused for new subscriptions; an
      archived plan's existing subscriptions billed with either value; with the settings off, create and update behave
      as today; stale version answers `409`.

## Phase 3 — UI surfaces

- [ ] **T23**. Angular plugin scaffold `packages/plugins/subscription-ui` (`subui/subscription-ui.plugin.ts`,
      `subui/subscription.routes.ts`, `subui/services/subscriptions-api.service.ts`), registered in
      `apps/gauzy/src/plugin-ui.config.ts`; routes under `pages/sales/subscriptions`; gating by feature and
      permissions; i18n keys `SUBSCRIPTIONS.*` in every locale of `packages/ui-core/i18n/assets/i18n/`. Test: plugin
      spec; menu hidden with the feature off.
- [ ] **T24**. Plans pages (list, editor with price basis, timing, collection, components, provider prices).
      Files: `subui/pages/plans/subscription-plans-page.component.ts`, `subui/pages/plans/subscription-plan-editor.component.ts`.
      Test: rendering specs.
- [ ] **T25**. Subscriptions list (saved view) and detail (overview, lines, timeline, billing history with heat
      map, cycle actions pay, waive, refund, release). Files: `subui/pages/subscriptions/subscriptions-page.component.ts`,
      `subui/pages/subscription-detail/subscription-detail.component.ts`,
      `subui/components/billing-heat-map/billing-heat-map.component.ts`. Test: rendering specs; keyboard navigation.
- [ ] **T26** (parallel). Runs page (preview, start, history and failures from core operations) and settings page.
      Files: `subui/pages/runs/subscription-runs-page.component.ts`, `subui/pages/settings/subscription-settings-page.component.ts`.
      Test: rendering specs.
- [ ] **T27** (parallel). Supplier subscriptions pages; "Supplier subscription" action and link on the existing
      recurring expenses page. Files: `subui/pages/suppliers/supplier-subscriptions-page.component.ts`,
      `apps/gauzy/src/app/pages/expense-recurring/expense-recurring.component.ts`. Test: rendering specs.
- [ ] **T28**. "Recurring billing" page for invoice schedules (list, editor, pause, run history) wired to the route
      `pages/accounting/invoices/recurring` in `apps/gauzy/src/app/pages/invoices/invoices-routing.module.ts`, stub
      kept as fallback; page in `subui/pages/recurring-billing/recurring-billing-page.component.ts`. Test: rendering
      specs; route resolves to the stub without the UI plugin.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T29**. MCP read tools and `subscriptions_create`, `subscriptions_billing_run` (preview default) in
      `packages/mcp-server/src/lib/tools/subscriptions.ts`. Test: input-schema spec; preview writes nothing.
- [ ] **T30** (parallel). Import of subscriptions (`POST /subscriptions/import`, import template). Files:
      `sub/import/subscription-import.service.ts`, `sub/import/subscription.import-template.ts`,
      `sub/subscription/subscription.controller.ts`. Test: per-row
      results; no past period billed.
- [ ] **T31**. OpenAPI regenerated; GraphQL fields added (`sub/graphql/schema-extensions.ts`,
      `sub/graphql/resolvers/subscription.resolver.ts`) with `tools/scripts/graphql-field-binding-check.mjs` entries; SDK
      regeneration noted; webhook catalogue entries. Test: OpenAPI diff is additive; the webhook catalogue lists the new events; `graphql-field-binding-check.mjs` passes.
- [ ] **T32**. User docs and `docs/specs/README.md` index row; plugin README (`packages/plugins/subscription/README.md`) updated. Test: docs build.

## Phase 5 — Changes, usage and advanced

- [ ] **T33**. Change calculator (`sub/engine/change.ts`, `sub/engine/proration.ts`): plan, quantity, lines, discount,
      pause, cancel, restart; day-based proration; recurring delta. Test: property tests (credit plus charge equals
      net; preview equals apply).
- [ ] **T34**. Preview and apply endpoints with signed `previewToken`, stale refusal, `subscription_change`
      entries, scheduled changes list and cancel, conflict refusal. Files:
      `sub/subscription-change/subscription-change.service.ts`, `sub/subscription-change/subscription-change.controller.ts`,
      `sub/subscription-change/dto/subscription-change.dto.ts`, `sub/subscription-change/preview-token.ts`. Test: e2e; `409` on a stale preview.
- [ ] **T35**. Plan versions on request and migration of subscriptions with notice. Files:
      `sub/subscription-plan/subscription-plan-version.service.ts`, `sub/subscription-plan/subscription-plan.controller.ts`
      (`/versions`, `/migrate`). Test: subscriptions stay on their
      version until moved; a plan edited through `PUT /subscription-plans/:id` takes effect as today.
- [ ] **T36**. Change preview dialog and change history tab in `subscription-ui`
      (`subui/components/change-preview-dialog/change-preview-dialog.component.ts`,
      `subui/pages/subscription-detail/subscription-changes-tab.component.ts`). Test: rendering specs.
- [ ] **T37**. Meters CRUD; usage intake (`/usage-events`, `/bulk`) with idempotency, rate limit and per-row
      results; `SUBSCRIPTION_USAGE_REPORT` for API keys. Files: `sub/usage/usage-meter.service.ts`,
      `sub/usage/usage-meter.controller.ts`, `sub/usage/usage-event.service.ts`, `sub/usage/usage-event.controller.ts`,
      `sub/usage/dto/`. Test: duplicates counted once on the three dialects.
- [ ] **T38**. Queue `subscription-usage`: period totals for each aggregation, thresholds, late events. Files:
      `sub/usage/usage-totals.worker.ts`, `sub/usage/usage-aggregation.ts`. Test:
      totals equal a recomputation from events (property test).
- [ ] **T39**. Usage pricing (`sub/engine/usage-pricing.ts`): per unit, allowance, graduated, volume, package, minimum
      and maximum; usage lines and statement on the cycle invoice; interim invoices. Test: golden cases per model.
- [ ] **T40**. Tracked-time meter through `SUBSCRIPTION_TIME_USAGE`, claiming time-log ids on the invoice line;
      currency conversion of time priced in another currency. Files: `sub/usage/sources/tracked-time.meter.ts`,
      `apps/api/src/plugin-composition.ts`. Test: a time log billed by a subscription invoice is
      refused by a manual invoice and by an invoice schedule, and released by a void.
- [ ] **T41** (parallel). Seats meter through `SUBSCRIPTION_SEATS` (entitlements, else portal members), daily
      sampling; automation-fed meter action. Files: `sub/usage/sources/seats.meter.ts`,
      `sub/usage/sources/automation.meter-action.ts`. Test: maximum and time-weighted average cases.
- [ ] **T42**. Retainers: included quantity, overage, roll-over with limit. Files: `sub/engine/retainer.ts`. Test:
      golden cases over several periods.
- [ ] **T43**. Usage corrections (void, correct) and adjustment lines on the next invoice. Files:
      `sub/usage/usage-correction.service.ts`, `sub/usage/usage-event.controller.ts`. Test: unit and e2e.
- [ ] **T44**. Convert an invoice schedule into a subscription (`POST /invoice-schedules/:id/convert`), schedule
      paused and linked in one transaction. Files: `sub/invoice-schedule/invoice-schedule-conversion.service.ts`,
      `sub/invoice-schedule/invoice-schedule-conversion.controller.ts`. Test: no period billed by both.
- [ ] **T45**. Meters, usage and statement pages in `subscription-ui` (`subui/pages/meters/usage-meters-page.component.ts`,
      `subui/pages/subscription-detail/subscription-usage-tab.component.ts`,
      `subui/pages/statements/usage-statement-page.component.ts`). Test: rendering specs.
- [ ] **T46**. Portal API (`/portal/subscriptions/*`) limited by `plan.selfService`; retention offer once per
      subscription; customer as actor. Files: `sub/portal/portal-subscriptions.controller.ts`,
      `sub/portal/portal-subscriptions.service.ts`. Test: a forbidden action answers `403`; another customer's subscription `404`.
- [ ] **T47**. React UI plugin `packages/plugins/subscription-react-ui`: portal block and public subscribe page
      (`subrui/components/PortalSubscriptions.tsx`, `subrui/components/SubscribePage.tsx`,
      `subrui/subscription-react-ui.plugin.ts`); subscribe link issued and redeemed through the public-link service
      (`shared_entity` with expiry and revocation; `sub/subscribe-link/subscribe-link.service.ts`). Test: component
      tests; a link creates one subscription; a revoked link is refused.
- [ ] **T48**. Revenue and expense schedules through `SUBSCRIPTION_REVENUE_SCHEDULES` on confirmed cycles, with
      adjustment on credit, refund and cancel; amounts on the subscription. Files:
      `sub/revenue/subscription-revenue-schedules.service.ts`. Test: fake port contract test.
- [ ] **T49**. Metrics builder and `subscription_metric_daily`; analytics endpoints; report definitions (recurring
      revenue, churn and retention, forecast, usage). Files: `sub/subscription-metric/subscription-metrics.builder.ts`,
      `sub/subscription-metric/subscription-analytics.controller.ts`, `sub/reports/subscription-report-definitions.ts`.
      Test: movements add up to the change in the total.
- [ ] **T50**. Analytics page with cards, charts and table alternatives. Files:
      `subui/pages/analytics/subscription-analytics-page.component.ts`. Test: rendering specs.
- [ ] **T51**. Agent tools: `subscriptions_preview_change`, `subscriptions_apply_change`,
      `subscriptions_explain_invoice`, `subscriptions_record_usage`, `subscriptions_usage_summary`,
      `subscriptions_metrics`, `subscriptions_churn_risks`; risk signals service and inbox digest. Files:
      `packages/mcp-server/src/lib/tools/subscriptions.ts`, `sub/risk/subscription-risk-signals.service.ts`,
      `sub/risk/subscription-invoice-explainer.ts`. Test: seeded
      signals ranked with evidence.
- [ ] **T52**. Trial period on a tenant with both flags on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.
- [ ] **T53**. Plugin plans as a plan source (FR-85): plans with `pluginId` listed, billed and collected like other
      plans; `subscription.*` events of such subscriptions consumed by the plugin registry of
      the Ever Platform spec `app-installs-and-licensing`, which writes `plugin_subscriptions` from them. Files:
      `sub/subscription-plan/subscription-plan.service.ts`, `sub/subscription-streamed-events.ts`. Test: buying, renewing and
      cancelling a plugin plan grants, extends and ends access once; other plans unaffected.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Plans | T2, T24, T55 |
| FR-2 | §3.1 Plans | T9, T24 |
| FR-3 | §3.1 Plans | T3, T54, T24 |
| FR-4 | §3.1 Plans | T54, T24 |
| FR-5 | §3.1 Plans | T8, T24, T55 |
| FR-6 | §3.1 Plans | T35 |
| FR-7 | §3.1 Plans | T55 |
| FR-8 | §3.2 Subscriptions | T8, T12, T55 |
| FR-9 | §3.2 Subscriptions | T55 |
| FR-10 | §3.2 Subscriptions | T12, T13 |
| FR-11 | §3.2 Subscriptions | T12 |
| FR-12 | §3.2 Subscriptions | T8 |
| FR-13 | §3.2 Subscriptions | T12 |
| FR-14 | §3.2 Subscriptions | T8 |
| FR-15 | §3.2 Subscriptions | T20, T33 |
| FR-16 | §3.2 Subscriptions | T12 |
| FR-17 | §3.2 Subscriptions | T6, T16, T33 |
| FR-18 | §3.2 Subscriptions | T17 |
| FR-19 | §3.2 Subscriptions | T55 |
| FR-20 | §3.2 Subscriptions | T19 |
| FR-21 | §3.2 Subscriptions | T24, T25 |
| FR-22 | §3.2 Subscriptions | T30 |
| FR-23 | §3.3 Billing cycles and invoices | T8, T10, T15 |
| FR-24 | §3.3 Billing cycles and invoices | T10, T11 |
| FR-25 | §3.3 Billing cycles and invoices | T10 |
| FR-26 | §3.3 Billing cycles and invoices | T8, T10 |
| FR-27 | §3.3 Billing cycles and invoices | T10, T16 |
| FR-28 | §3.3 Billing cycles and invoices | T17 |
| FR-29 | §3.3 Billing cycles and invoices | T6, T13 |
| FR-30 | §3.3 Billing cycles and invoices | T13 |
| FR-31 | §3.3 Billing cycles and invoices | T6, T13 |
| FR-32 | §3.3 Billing cycles and invoices | T13 |
| FR-33 | §3.3 Billing cycles and invoices | T10, T25 |
| FR-34 | §3.3 Billing cycles and invoices | T19, T25 |
| FR-35 | §3.3 Billing cycles and invoices | T10, T33 |
| FR-36 | §3.4 Changes and proration | T33 |
| FR-37 | §3.4 Changes and proration | T33, T34 |
| FR-38 | §3.4 Changes and proration | T33, T34, T36 |
| FR-39–FR-40 | §3.4 Changes and proration | T33, T34 |
| FR-41 | §3.4 Changes and proration | T35 |
| FR-42 | §3.5 Usage metering (advanced) | T37, T45 |
| FR-43 | §3.5 Usage metering (advanced) | T37 |
| FR-44 | §3.5 Usage metering (advanced) | T40, T41 |
| FR-45 | §3.5 Usage metering (advanced) | T39 |
| FR-46 | §3.5 Usage metering (advanced) | T38, T39, T45 |
| FR-47 | §3.5 Usage metering (advanced) | T40 |
| FR-48 | §3.5 Usage metering (advanced) | T18, T38, T39 |
| FR-49 | §3.5 Usage metering (advanced) | T43 |
| FR-50 | §3.5 Usage metering (advanced) | T42 |
| FR-51 | §3.6 Recurring invoices for billable time | T21, T28 |
| FR-52 | §3.6 Recurring invoices for billable time | T28 |
| FR-53 | §3.6 Recurring invoices for billable time | T5, T21 |
| FR-54 | §3.6 Recurring invoices for billable time | T44 |
| FR-55 | §3.6 Recurring invoices for billable time | T40 |
| FR-56 | §3.7 Billing run | T6, T15, T16 |
| FR-57 | §3.7 Billing run | T15, T26 |
| FR-58 | §3.7 Billing run | T15, T29 |
| FR-59 | §3.7 Billing run | T15 |
| FR-60 | §3.7 Billing run | T15 |
| FR-61 | §3.7 Billing run | T8 |
| FR-62 | §3.7 Billing run | T14 |
| FR-63–FR-65 | §3.8 Self-service (advanced) | T46, T47 |
| FR-66 | §3.8 Self-service (advanced) | T47 |
| FR-67–FR-68 | §3.9 Revenue schedules (advanced) | T48 |
| FR-69 | §3.10 Analytics and reports | T22, T49 |
| FR-70–FR-72 | §3.10 Analytics and reports | T49 |
| FR-73 | §3.10 Analytics and reports | T37, T49 |
| FR-74 | §3.10 Analytics and reports | T17, T22, T27 |
| FR-75 | §3.11 Settings, notices, API, agents and compatibility | T6, T20 |
| FR-76 | §3.11 Settings, notices, API, agents and compatibility | T18 |
| FR-77 | §3.11 Settings, notices, API, agents and compatibility | T19, T31 |
| FR-78 | §3.11 Settings, notices, API, agents and compatibility | T31, T37 |
| FR-79 | §3.11 Settings, notices, API, agents and compatibility | T29 |
| FR-80 | §3.11 Settings, notices, API, agents and compatibility | T51 |
| FR-81 | §3.11 Settings, notices, API, agents and compatibility | T11, T24 |
| FR-82 | §3.11 Settings, notices, API, agents and compatibility | T7, T23, T48 |
| FR-83 | §3.11 Settings, notices, API, agents and compatibility | T19, T34 |
| FR-84 | §3.11 Settings, notices, API, agents and compatibility | T19, T31 |
| FR-85 | §3.1 Plans | T53 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default stay off; enabling them in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- The existing suites of `packages/plugins/subscription` and `packages/core/src/lib/invoice-schedule` pass
  unchanged, also with both flags on and default settings (spec AC-14); no existing route, event name or status value
  changed.
- Invariants hold in tests: one invoice per cycle; a time log is billed at most once across all invoice sources;
  a confirmed change bills exactly its preview.
- Every acceptance criterion of `spec.md` §7 has a named test.
