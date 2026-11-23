# Task Breakdown: Payment gateways

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `payment-gateways`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A spec file named in a `Test:` clause without a full path sits under the `src/lib/` folder of the package the task changes (beside the file it tests).
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_PAYMENT_GATEWAYS_ENABLED` and `FEATURE_PAYMENT_GATEWAY`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it; the
  callback route is never behind the tenant feature.
- Paths: `pay/` = `packages/plugins/payment/src/lib/`, `gw/` = `packages/plugins/payment/src/lib/gateways/`,
  `pui/` = `packages/plugins/payment-ui/src/lib/`, `sbx/` = `packages/plugins/payment-provider-sandbox/src/lib/`.
- Gate: every new route, GraphQL field, menu entry and MCP tool is gated by `FEATURE_PAYMENT_GATEWAY` (depends on
  `FEATURE_PAYMENT`; module loaded only when `GAUZY_PAYMENT_GATEWAYS_ENABLED` is exactly `true`); the public callback
  route is guarded only by the provider signature.
- Phase 3 checkout sources need the pay page of `payments-and-collections` (its Phase 5); until then the invoice public
  page is the only source wired.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/payment-gateway.model.ts` (enums, `IPaymentProviderAdapter`, outcome,
      checkout, charge, payout, dispute, routing, insight shapes, port tokens, event payloads); additive optional fields on
      the payment provider, collection, session and saved instrument interfaces; export from `index.ts`. Files:
      `packages/contracts/src/lib/payment-gateway.model.ts`, `packages/contracts/src/lib/payment-method-token.model.ts`,
      `pay/payment.types.ts` (provider, collection and session interfaces), `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/payment-gateway.model.spec.ts`, a type spec
      compiling a fake adapter; existing fields unchanged.
- [ ] **T2**. `gw/gateways-enabled.ts` (exact `true`), conditional `GatewaysModule` import in `pay/payment.plugin.ts`,
      `PaymentGatewaysSchedulePlugin` for the worker, `.env.sample`. Files: `gw/{gateways-enabled.ts,gateways.module.ts}`,
      `gw/schedule/payment-gateways-schedule.plugin.ts`, `pay/payment.plugin.ts`, `pay/migrations/index.ts`,
      `apps/worker/src/plugins.ts`, `.env.sample`. Test: `gw/gateways-enabled.spec.ts`: switch off → module, entity and migration lists
      equal today's. Migration timestamps: `1791000040100` to `1791000040199` (`packages/plugins/payment`).
- [ ] **T3**. Entity columns on `payment_provider`, `payment_collection`, `payment_session`, `payment_webhook_event`
      (`pay/`) and core `payment_method_token`; migration `1791000040100-AlterPaymentFrameworkForGateways`. Files:
      `pay/{payment-provider/payment-provider.entity.ts,payment-collection/payment-collection.entity.ts,payment-session/payment-session.entity.ts,payment-webhook-event/payment-webhook-event.entity.ts}`,
      `packages/core/src/lib/payment-method-token/payment-method-token.entity.ts`,
      `pay/migrations/1791000040100-AlterPaymentFrameworkForGateways.ts`. Test:
      `gw/database/alter-payment-framework-for-gateways.migration.spec.ts` SQLite run; existing payment specs pass unchanged.
- [ ] **T4**. New entities `gw/entities/` (plan §3.2) with MikroORM repositories; migrations `1791000040110` to `1791000040130`. Files:
      `gw/entities/{payment-terminal.entity.ts,payment-dispute.entity.ts,payment-dispute-evidence.entity.ts,payment-payout.entity.ts,payment-payout-line.entity.ts,payment-routing-rule.entity.ts,payment-provider-health.entity.ts,payment-decline-insight.entity.ts,payment-instrument-change.entity.ts,payment-provider-recurring.entity.ts}`,
      `gw/repositories/` (`type-orm-` and `mikro-orm-` repository per entity),
      `pay/migrations/{1791000040110-CreateGatewayTerminalAndDisputeTables.ts,1791000040120-CreateGatewayPayoutTables.ts,1791000040130-CreateGatewayRoutingInsightAndRecurringTables.ts}`.
      Test: `gw/entities/gateway-entities.spec.ts` metadata spec, both ORMs; `gw/database/gateway-tables.migration.spec.ts` rerun no-op; unique keys.
- [ ] **T5** (parallel). Contributions instead of a seed: `FEATURE_PAYMENT_GATEWAY` as a feature contribution of the
      gateway module (`dependsOn` `FEATURE_PAYMENT`, default off) and the new keys with `defaultFor` in
      `pay/payment.permissions.ts`; `RuleOwnerType.PAYMENT_ROUTING_RULE` in `rule.model.ts`. Files:
      `gw/gateways.features.ts`, `pay/payment.permissions.ts`, `packages/contracts/src/lib/rule.model.ts`. Test:
      `gw/gateways.features.spec.ts` and `pay/payment.permissions.spec.ts`: permission reload
      inserts missing grants only; the feature starts disabled and refuses to be on without `FEATURE_PAYMENT`.

## Phase 2 — Adapter contract and surfacing what exists

- [ ] **T6**. Adapter registry `gw/adapters/payment-adapter.registry.ts` (`registerPaymentAdapters`, capability checks,
      currency limits), `GET /api/payment-gateways/adapters`, and a connector manifest contribution (category `PAYMENTS`)
      per adapter plugin for the `integration-hub` catalogue. Files: `gw/adapters/{payment-adapter.registry.ts,adapters.controller.ts,minor-units.ts,connector-manifest.ts}`.
      Test: `gw/adapters/payment-adapter.registry.spec.ts`: unknown key refused; capability matrix; minor units per
      currency precision; with the hub on, the adapter is listed in its catalogue.
- [ ] **T7**. `PAYMENT_SESSION_DRIVER` seam in `pay/payment-session/payment-session.service.ts`,
      `pay/payment-capture/payment-capture.service.ts`, `pay/refund/refund.service.ts` and the driver `gw/driver/`. Files:
      `pay/payment-session/payment-session.service.ts`, `pay/payment-capture/payment-capture.service.ts`,
      `pay/refund/refund.service.ts`, `gw/driver/{payment-session.driver.ts,provider-call.log.ts}`. Test:
      `gw/driver/payment-session.driver.spec.ts`: unbound → record-only as today; adapter-backed provider calls the
      adapter once per idempotency key; each call logged with redacted bodies; amounts kept as exact decimals.
- [ ] **T8**. `signed-checkout` adapter `gw/adapters/signed-checkout/` over `pay/invoice-payment` (signature, checkout
      request, notification). Files: `gw/adapters/signed-checkout/signed-checkout.adapter.ts`,
      `pay/invoice-payment/invoice-payment.service.ts` (used unchanged). Test: today's `invoice-payment` specs pass
      through the adapter (`gw/adapters/signed-checkout/signed-checkout.adapter.spec.ts`).
- [ ] **T9** (parallel). Plugin `packages/plugins/payment-provider-sandbox` (success, decline classes, delayed
      confirmation, partial capture, refund, dispute, mandate, payout, settlement, updater notice scenarios). Files:
      `packages/plugins/payment-provider-sandbox/{package.json,project.json,src/index.ts}`,
      `sbx/{payment-provider-sandbox.plugin.ts,sandbox.adapter.ts,scenarios.ts,sandbox-enabled.ts}`,
      `gw/testing/adapter-contract.suite.ts`. Test: `sbx/sandbox.adapter.spec.ts` runs the contract scenario suite `gw/testing/adapter-contract.suite.ts`.
- [ ] **T10**. Provider accounts: credentials route writing `integration_setting`, verification, channels, defaults,
      clearing account through `PAYMENT_BANK_ACCOUNTS`, fee table, currency and amount checks (FR-6 to FR-13). Files:
      `gw/accounts/{provider-credentials.controller.ts,provider-credentials.service.ts,provider-resolution.ts,fee-table.ts}`,
      `pay/payment-provider/payment-provider.service.ts`. Test: `gw/accounts/provider-credentials.service.spec.ts`: live keys
      refused in test mode; secrets never returned; currency refused naming the offered ones; account resolved by
      channel, currency, then default; a retired account stops being offered and still processes callbacks.
- [ ] **T11**. Callback route `gw/callbacks/callback.controller.ts` (store through `PaymentWebhookEventService.intake`,
      verify, queue), processor `gw/callbacks/outcome-applier.ts` (ordering by provider event time, outcome mapping,
      reprocess). Files: `gw/callbacks/{callback.controller.ts,callback.worker.ts,outcome-applier.ts}`,
      `pay/payment-webhook-event/payment-webhook-event.service.ts`. Test: `gw/callbacks/outcome-applier.spec.ts`:
      duplicate once; out-of-order older outcome ignored for the session state; two partial captures whose callbacks
      arrive later one first both create their capture and reach collections once each, and a second callback for the
      same provider capture id adds nothing; bad signature changes nothing;
      `gw/callbacks/callback.controller.spec.ts`: route answers with the tenant feature off.
- [ ] **T12**. Capture hand-off: outbox events of plan §5; invoice fallback through `InvoicePaymentService` when
      `payments-and-collections` is off. Files: `gw/events/{payment-gateways.events.ts,capture-handoff.ts,index.ts}`. Test:
      `gw/events/capture-handoff.spec.ts`: one core payment per provider reference; test-mode never recorded; events carry ids and amounts only.
- [ ] **T13**. Hosted checkout and result pages: `PAYMENT_CHECKOUT` port, `gw/checkout/checkout.service.ts` (collection per
      source, supersede, expiry), public token routes, result pages in `public-layout-ui`, Pay button on the Angular public
      invoice page. Files: `gw/checkout/{checkout.service.ts,checkout.controller.ts,public-checkout.controller.ts,payment-checkout.port.ts,checkout-expiry.job.ts}`,
      `packages/plugins/public-layout-ui/src/lib/components/pay-result/pay-result.component.ts`,
      `packages/plugins/public-layout-ui/src/lib/components/invoice-estimate/invoice-estimate-view.component.ts`. Test:
      `gw/checkout/checkout.service.spec.ts`: e2e sandbox payment; a second attempt supersedes without a double charge;
      only methods of available accounts offered; a card field in a body refused by `RejectCardDataPipe`; reload of the result page changes nothing.
- [ ] **T14**. Angular `payment-ui` pages (created here if absent): Providers, Online payments (sessions, captures,
      callbacks with reprocess); menu entries gated; i18n keys in every locale. Files:
      `packages/plugins/payment-ui/{package.json,project.json,ng-package.json,src/index.ts}`,
      `pui/{payment-ui.plugin.ts,payment-ui.routes.ts,pages/providers-page.component.ts,pages/online-payments-page.component.ts}`,
      `packages/ui-core/i18n/assets/i18n/*.json`. Test: `pui/pages/providers-page.component.spec.ts` rendering tests; hidden on `404`.
- [ ] **T15**. MCP tools `packages/mcp-server/src/lib/tools/payment-gateways.ts` (adapters, providers, checkout link,
      sessions, capture and refund with preview). Files: `packages/mcp-server/src/lib/tools/payment-gateways.ts`,
      `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: `packages/mcp-server/src/lib/tools/payment-gateways.spec.ts`: preview writes nothing; caller permissions.
- [ ] **T37**. Callback health alerts (FR-35): payment administrators are alerted when callbacks of an account fail five
      times in a row or stop for 24 hours while sessions are open. Files: `gw/callbacks/callback-health.job.ts`,
      `gw/callbacks/callback-health.notifier.ts`. Test: `gw/callbacks/callback-health.job.spec.ts`: five failures raise
      one alert; 24 hours of silence with an open session raise one alert; no alert without open sessions.

## Phase 3 — Depth

- [ ] **T16**. Checkout sources: pay links and payment requests (the public pay page of `payments-and-collections`
      over `shared_entity` links), orders and carts (existing order checkout path), subscription subscribe links and plugin plans sold as `subscription`
      plans, portal, hosted forms of `lead-capture-and-enrichment` with fixed or field amounts (FR-20 to FR-24). Files:
      `gw/checkout/sources/{pay-link.source.ts,order.source.ts,subscription.source.ts,portal.source.ts,form.source.ts}`,
      `apps/api/src/plugin-composition.ts`. Test: `gw/checkout/sources/checkout-sources.spec.ts`: each source creates one collection; amounts must be positive.
- [ ] **T17**. Embedded form `ngx-payment-element` (`packages/ui-core/shared`) for the app, the portal and Gauzy's public
      pages, with per-adapter script origins and CSP; the checkout endpoint answers a hosted or redirect address for sites
      built with Ever Works. Files: `packages/ui-core/shared/src/lib/payment-element/{ngx-payment-element.component.ts,payment-element.module.ts}`,
      `gw/checkout/script-origins.ts`. Test: `ngx-payment-element.component.spec.ts`; no card field reaches the API in the e2e network log.
- [ ] **T18**. Redirect, wallet and bank redirect kinds; status query sweep `payment-gateways.status-query`. Files:
      `gw/checkout/redirect-kinds.ts`, `gw/jobs/status-query.job.ts`. Test: `gw/jobs/status-query.job.spec.ts`: closed
      browser settled by callback; silent provider settled by query after 15 minutes, then hourly.
- [ ] **T19** (parallel). Phone prompts with per-request split and single-use secrets for unsigned callbacks. Files:
      `gw/checkout/phone-prompt.service.ts`. Test: `gw/checkout/phone-prompt.service.spec.ts`: 1,000
      with a 300 limit makes four prompts; replayed callback after settlement changes nothing.
- [ ] **T20** (parallel). Terminals `gw/terminals/` (pair, start, cancel, progress over real time). Files:
      `gw/terminals/{terminal.service.ts,terminal.controller.ts}`. Test: `gw/terminals/terminal.service.spec.ts`: sandbox terminal
      paid and cancelled paths.
- [ ] **T21**. Authorise and capture windows (`payment-gateways.authorization-expiry`), automatic capture on channel events.
      Files: `gw/capture/{capture-policy.service.ts,auto-capture.consumer.ts}`, `gw/jobs/authorization-expiry.job.ts`.
      Test: `gw/capture/capture-policy.service.spec.ts`: partial captures never exceed authorisation; void at window end and the source's owner told.
- [ ] **T22**. Saved instruments and mandates `gw/instruments/` (set-up sessions, mandate states, earliest charge date,
      consent record, revoke at provider, expiry sweep, "instrument replaced"). Files:
      `gw/instruments/{instrument-setup.service.ts,instruments.controller.ts,mandate.service.ts,instrument-expiry.job.ts}`. Test:
      `gw/instruments/mandate.service.spec.ts`: pending mandate not chargeable; `instrument-expiry.job.spec.ts`: expiry notice once.
- [ ] **T23**. Off-session charges `PAYMENT_CHARGES` and queue `payment-gateway-charges` (decline classes, payer
      confirmation link through `MESSAGE_SENDER`); bound for the subscription order path and instalments. Files:
      `gw/charges/{off-session-charge.service.ts,charges.controller.ts,charge.worker.ts,payment-charges.port.ts}`. Test:
      `gw/charges/off-session-charge.service.spec.ts`: expired
      instrument refused before the provider; decline class returned; retry schedule left to the caller.
- [ ] **T24** (parallel). Provider-managed recurring `payment_provider_recurring` mirroring `subscription-billing`'s price
      references. Files: `gw/recurring/provider-recurring.service.ts`. Test:
      `gw/recurring/provider-recurring.service.spec.ts`: provider callbacks reach the subscription.
- [ ] **T25**. Refunds through adapters (pending until callback, failure reasons, approval rule, hand-off as money out).
      Files: `gw/refunds/adapter-refund.service.ts`, `pay/refund/refund.service.ts`. Test:
      `gw/refunds/adapter-refund.service.spec.ts`: never above captured; creator cannot approve; failed refund keeps the provider's reason.
- [ ] **T26**. Disputes `gw/disputes/` (intake from callbacks, deadlines, alerts, accept and submit with preview, optional
      order hold, loss hand-off). Files: `gw/disputes/{dispute.service.ts,disputes.controller.ts,dispute-deadlines.job.ts}`.
      Test: `gw/disputes/dispute.service.spec.ts`: deadline alert 3 days before; lost dispute publishes the reversal.
- [ ] **T27**. Payouts and settlements `gw/payouts/` (settlement import with lines, matching, fee check, party payouts
      with approval, `PAYMENT_PAYOUTS` port with `recordSettlement` for channel settlements, balance,
      `SETTLEMENT_LINE_SOURCES` read port); seller payouts executed from
      `seller_payout` through the marketplace's `PAYOUT_SOURCES` binding (outcome written back, no `payment_payout` row,
      no second approval) and seller reports handed to `seller_settlement`. Files:
      `gw/payouts/{payout.service.ts,payouts.controller.ts,settlement-import.service.ts,settlement-matching.ts,payment-payouts.port.ts,settlement-line-sources.port.ts}`,
      `gw/jobs/settlements.job.ts`. Test: `gw/payouts/payout.service.spec.ts`: unmatched line listed; fee difference
      over 1 % flagged; approver differs from requester; one marketplace-approved seller payout makes one provider call
      and no gateway approval; the same channel settlement recorded twice changes nothing.
- [ ] **T28**. UI: Disputes, Payouts, Terminals, Saved instruments pages in `payment-ui` and the portal's saved-instruments
      block (Angular, on `portal-sections`). Files: `pui/pages/{disputes-page.component.ts,payouts-page.component.ts,terminals-page.component.ts,saved-instruments-page.component.ts}`,
      `pui/portal/saved-instruments-block.component.ts`. Test: `pui/pages/disputes-page.component.spec.ts` and rendering tests per page.
- [ ] **T29**. Report definitions (spec FR-82) and datasets. Files: `gw/reports/{payment-gateways.report-definitions.ts,payment-gateways.report-datasets.ts}`.
      Test: `gw/reports/payment-gateways.report-datasets.spec.ts`: seeded figures, dispute win rates by reason and evidence kind.
- [ ] **T30** (parallel). First named adapter plugins `packages/plugins/payment-provider-<key>` (one card
      acquirer, a bank debit and a wallet or phone payment), each passing the contract suite against the provider's test
      mode. Files: `packages/plugins/payment-provider-<key>/src/lib/{<key>.adapter.ts,<key>.plugin.ts}` per adapter. Test: contract suite per adapter.

## Phase 4 — Advanced capabilities, SDKs, docs

- [ ] **T31**. Routing `gw/routing/` (rules with conditions as core `rule` rows of owner type `PAYMENT_ROUTING_RULE`,
      cost-aware choice from fee tables, simulation route, health window and pause, failover once on provider faults with
      linked keys; daily account health reported through `INTEGRATION_HEALTH`). Files:
      `gw/routing/{routing.service.ts,routing-rules.controller.ts,provider-health.service.ts}`, `gw/jobs/health.job.ts`. Test:
      `gw/routing/routing.service.spec.ts`: final decline never fails over;
      paused account skipped; the rule evaluator's trace explains the choice.
- [ ] **T32**. Network tokens and updater notices (`payment_instrument_change`, charges with tokens, saved-charge report).
      Files: `gw/instruments/{updater-notice.service.ts,network-tokens.ts}`. Test:
      `gw/instruments/updater-notice.service.spec.ts`: updater notice changes expiry and last four, records the change.
- [ ] **T33**. Evidence packs `gw/disputes/evidence-pack.service.ts` with `GATEWAY_EVIDENCE_SOURCES` (print, fulfillment,
      time logs, terms acceptance, communications) and assistant summary from pack facts. Files:
      `gw/disputes/{evidence-pack.service.ts,evidence-sources.ts}`, `pui/pages/evidence-pack-builder.component.ts`. Test:
      `gw/disputes/evidence-pack.service.spec.ts`: pack never submitted
      without a person; summary uses pack facts only; outcome recorded per reason and evidence kind.
- [ ] **T34** (parallel). Decline insights `payment-gateways.insights` (groups, 7-day baseline, notices, MCP read). Files:
      `gw/insights/{decline-insights.service.ts,insights.controller.ts}`, `gw/jobs/insights.job.ts`,
      `packages/mcp-server/src/lib/tools/payment-gateways.ts`. Test: `gw/insights/decline-insights.service.spec.ts`:
      seeded spike raises one insight per group.
- [ ] **T35**. Remaining MCP tools (disputes, payouts, insights). Files: `packages/mcp-server/src/lib/tools/payment-gateways.ts`.
      Test: `packages/mcp-server/src/lib/tools/payment-gateways.spec.ts`: preview writes nothing; agents never approve.
- [ ] **T36**. OpenAPI regenerated; SDK regeneration noted; adapter author guide on the docs site; `docs/specs/README.md`
      index row; spec status `Implemented`. Files: `packages/core/src/lib/bootstrap/swagger.ts`, `docs/specs/README.md`,
      `docs/specs/features/payment-gateways/spec.md`. Test: OpenAPI diff is additive; docs build.
- [ ] **T38**. GraphQL reads `paymentAdapters`, `paymentDisputes`, `paymentPayouts`, `paymentRoutingRules`,
      `paymentDeclineInsights` beside the plugin's existing resolvers (FR-77). Files:
      `pay/graphql/resolvers/{payment-adapter.resolver.ts,payment-dispute.resolver.ts,payment-payout.resolver.ts,payment-routing-rule.resolver.ts,payment-decline-insight.resolver.ts,index.ts}`,
      `pay/graphql/schema-extensions.ts`. Test: `pay/graphql/resolvers/gateway-reads.spec.ts`: each read returns what its
      REST route returns under the same permissions; absent with the switch off (`pay/graphql/schema-extensions.spec.ts` unchanged).

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T5, T15 |
| FR-2 | §3.1 Scope, flags and compatibility | T7, T8, T11 |
| FR-3 | §3.1 Scope, flags and compatibility | T13, T17 |
| FR-4 | §3.1 Scope, flags and compatibility | T12 |
| FR-5 | §3.1 Scope, flags and compatibility | T1, T3 |
| FR-6–FR-11 | §3.2 Provider accounts | T10 |
| FR-12 | §3.2 Provider accounts | T6, T10 |
| FR-13 | §3.2 Provider accounts | T10 |
| FR-14 | §3.3 Adapters | T1, T6 |
| FR-15 | §3.3 Adapters | T8, T9 |
| FR-16 | §3.3 Adapters | T6, T9, T30 |
| FR-17 | §3.3 Adapters | T6, T7 |
| FR-18 | §3.3 Adapters | T18 |
| FR-19 | §3.3 Adapters | T7 |
| FR-20–FR-22 | §3.4 Checkout | T13 |
| FR-23 | §3.4 Checkout | T13, T16 |
| FR-24 | §3.4 Checkout | T16 |
| FR-25 | §3.4 Checkout | T17 |
| FR-26 | §3.4 Checkout | T19 |
| FR-27 | §3.4 Checkout | T20 |
| FR-28–FR-29 | §3.4 Checkout | T13 |
| FR-30 | §3.4 Checkout | T12 |
| FR-31–FR-34 | §3.5 Provider callbacks | T11 |
| FR-35 | §3.5 Provider callbacks | T37 |
| FR-36 | §3.5 Provider callbacks | T12 |
| FR-37–FR-39 | §3.6 Authorisation and capture | T21 |
| FR-40 | §3.7 Saved instruments and mandates | T22, T28 |
| FR-41 | §3.7 Saved instruments and mandates | T22 |
| FR-42–FR-43 | §3.7 Saved instruments and mandates | T22, T28 |
| FR-44–FR-45 | §3.7 Saved instruments and mandates | T22 |
| FR-46 | §3.7 Saved instruments and mandates | T22, T28 |
| FR-47–FR-49 | §3.8 Merchant-initiated charges | T23 |
| FR-50 | §3.8 Merchant-initiated charges | T24 |
| FR-51 | §3.8 Merchant-initiated charges | T23 |
| FR-52–FR-54 | §3.9 Refunds | T25 |
| FR-55 | §3.9 Refunds | T12, T25 |
| FR-56–FR-59 | §3.10 Disputes | T26 |
| FR-60–FR-65 | §3.11 Payouts and settlements | T27 |
| FR-66–FR-69 | §3.12 Routing and failover (advanced) | T31 |
| FR-70–FR-72 | §3.13 Instruments that stay valid (advanced) | T32 |
| FR-73–FR-74 | §3.14 Dispute evidence packs (advanced) | T33 |
| FR-75 | §3.14 Dispute evidence packs (advanced) | T29, T33 |
| FR-76 | §3.15 Decline insights (advanced) | T34 |
| FR-77 | §3.16 API, events, agents and reports | T10, T13, T38 |
| FR-78 | §3.16 API, events, agents and reports | T12, T22, T26, T27 |
| FR-79 | §3.16 API, events, agents and reports | T15, T35 |
| FR-80 | §3.16 API, events, agents and reports | T13, T23, T27 |
| FR-81 | §3.16 API, events, agents and reports | T6, T7 |
| FR-82 | §3.16 API, events, agents and reports | T29 |
| FR-83 | §3.11 Payouts and settlements | T27 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With the feature off, the provider registry, collections, sessions, captures, refunds, callbacks and the signed
  invoice connector behave exactly as before; the callback route still records and acknowledges.
- The sandbox adapter passes the full contract suite; no card or bank number appears in any log in the redaction suite.
- A capture is recorded once whatever the number of callbacks, status queries and failovers.
