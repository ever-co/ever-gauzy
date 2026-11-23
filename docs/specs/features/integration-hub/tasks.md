# Task Breakdown: Integration hub

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `integration-hub`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_INTEGRATION_HUB_ENABLED` and `FEATURE_INTEGRATION_HUB`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it; the core
  shared sync records (T6, T26, T44, T45) work without the hub plugin.
- Paths: `hub/` = `packages/plugins/integration-hub/src/lib/`, `core/` = `packages/core/src/lib/`, `hubui/` =
  `packages/plugins/integration-hub-ui/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/integration-hub.model.ts` and `integration-sync.model.ts` (enums,
      interfaces, port tokens, event payloads), additive fields in `webhook.model.ts`, `integration.model.ts`, values
      `RuleOwnerType.WEBHOOK_SUBSCRIPTION` and `RuleScope.EVENT` in `rule.model.ts`, contribution kinds `connectors`,
      `eventTypes`, `inboundHandlers` in `packages/plugin/src/lib/plugin-contributions.ts`; export from
      `packages/contracts/src/index.ts`.
      Test: type spec; contribution registry collects the new kinds.
- [ ] **T2**. Library `packages/connector-kit` (manifest JSON Schema, `IConnectorManifest`, `ConnectorBase`,
      `IConnectorContext`, `runContractSuite`; `OAuthStateStore` and `DeliveryDedupe` lifted from `integration-jira`'s
      `jira-oauth-state.service.ts` and `jira-webhook-dedupe.service.ts`, and `verifyHmacSignature` as a thin wrapper
      over core `verifyWebhookSignature` in place of `jira-webhook.verification.ts`). Files:
      `packages/connector-kit/src/lib/manifest.schema.json`, `manifest.ts`, `connector-base.ts`, `connector-context.ts`,
      `contract-suite.ts`, `oauth-state.store.ts`, `delivery-dedupe.ts`, `verify-hmac-signature.ts` in that folder;
      `packages/plugins/integration-jira/src/lib/jira-oauth-state.service.ts`,
      `packages/plugins/integration-jira/src/lib/jira-webhook-dedupe.service.ts`,
      `packages/plugins/integration-jira/src/lib/jira-webhook.verification.ts`.
      Test: schema accepts a sample manifest, refuses missing directions; state single use; Jira's existing specs pass
      against the lifted helpers.
- [ ] **T3**. Plugin scaffold `packages/plugins/integration-hub` (`integration-hub.plugin.ts`, `.module.ts`,
      `integration-hub-enabled.ts` exact `true`, `.features.ts` with `FEATURE_INTEGRATION_HUB`, `.permissions.ts`,
      `.settings.ts`); listed in `apps/api/src/plugins.ts`; `.env.sample`. Test: flag spec; off → lists unchanged.
- [ ] **T4**. Entities `hub/entities/` (plan §3.1: `integration-inbound-endpoint.entity.ts`,
      `integration-inbound-delivery.entity.ts`, `integration-call-log.entity.ts`, `integration-oauth-app.entity.ts`,
      `integration-connected-account.entity.ts`, `integration-storage-target.entity.ts`,
      `integration-storage-write.entity.ts`, `integration-api-usage.entity.ts`, `integration-health-snapshot.entity.ts`)
      with MikroORM repositories in `hub/entities/repository/`. Test: metadata spec, both ORMs.
- [ ] **T5**. Migrations `hub/database/migrations/1791000034100-CreateIntegrationHubInboundAndLogTables.ts`,
      `1791000034110-CreateIntegrationHubConnectedAccountTables.ts` and
      `1791000034130-CreateIntegrationHubStorageUsageHealthTables.ts` with the shared core migration helpers of `procurement` T4 (`@gauzy/core`, no
      plugin copy). Test: SQLite run, rerun
      no-op, unique keys. Migration timestamps: `1791000034100` to `1791000034199` (`packages/plugins/integration-hub`); `1791000034200` to `1791000034219` (`packages/core`); `1791000034220` to `1791000034229` (`packages/plugins/integration-jira`); `1791000034230` to `1791000034239` (`packages/plugins/integration-asana`); `1791000034240` to `1791000034249` (`packages/plugins/integration-linear`); `1791000034250` to `1791000034259` (`packages/plugins/integration-trello`); `1791000034260` to `1791000034269` (`packages/plugins/integration-ever-works`).
- [ ] **T6** (parallel). Core migrations `core/database/migrations/1791000034200-AddHubColumnsToWebhookAndIntegration.ts`
      and `core/database/migrations/1791000034210-CreateIntegrationSyncRecords.ts`: columns on
      `core/webhook/webhook-subscription.entity.ts`,
      `webhook-delivery.entity.ts`, `core/integration/integration.entity.ts`,
      `core/integration-entity-setting/integration-entity-setting.entity.ts`, `core/integration-map/integration-map.entity.ts`,
      and the entities of `core/integration-sync/` (`integration-sync-mapping.entity.ts`,
      `integration-sync-value-map.entity.ts`, `integration-sync-issue.entity.ts`). Test: existing webhook and integration
      specs pass; both ORMs.
- [ ] **T7** (parallel). Contributions instead of a seed: `FEATURE_INTEGRATION_HUB` (default off) in
      `integration-hub.features.ts`, the nine keys with `defaultFor` in `integration-hub.permissions.ts`, retention, dead
      letters, API limits, `galleryOpensCatalogue`, `pauseFailingSyncs`, `stopOnOwnerDeactivation` and geocoding in
      `integration-hub.settings.ts`. Test: permission reload inserts missing grants only; feature starts disabled;
      settings read through the settings store; delivery retention and tenant API limits are empty and the two switches
      off by default; `stopOnOwnerDeactivation` is on for a new tenant and off for an existing one.
- [ ] **T48**. Core record-change events, TypeORM (the MikroORM side is T57), with `RECORD_CHANGE_EVENTS_POLICY`:
      `<record_type>.created` / `.updated` / `.deleted` for registered types without events of their own
      (`employee.created` / `.updated` and `organization_team_employee.created` / `.deleted` and
      `organization_project_employee.created` / `.deleted` among them), appended when the hub policy is bound for the
      tenant or an outbox consumer is registered for the type; time logs and timesheets keep their own `time_tracking.*`
      events (`project-costing-and-billing` T61); no dependency on this plugin (FR-14). Files:
      `packages/core/src/lib/event-outbox/record-change.subscriber.ts`,
      `packages/core/src/lib/event-outbox/record-change-events.policy.ts`, `packages/core/src/lib/event-outbox/index.ts`.
      Test: `packages/core/src/lib/event-outbox/record-change.subscriber.spec.ts`: employee, team membership, time-off,
      expense and candidate changes append one event each; no event when the policy is unbound and no consumer is
      registered; a time log change appends no record-change event.
- [ ] **T57**. Core record-change events, MikroORM: the same events and policy as T48 from a MikroORM subscriber
      registered beside it, so both ORMs append the same events (FR-14). Files:
      `packages/core/src/lib/event-outbox/record-change.mikro-orm.subscriber.ts`,
      `packages/core/src/lib/event-outbox/event-outbox.module.ts`. Test:
      `packages/core/src/lib/event-outbox/record-change.orm-parity.spec.ts`: the changes of T48's test append the same
      events under MikroORM as under TypeORM; no event when the policy is unbound and no consumer is registered.

## Phase 2 — Surface what exists

- [ ] **T8**. Event catalogue `hub/events-catalogue/` (`event-catalogue.service.ts`, `event-catalogue.controller.ts`):
      `SubscriptionCatalogue.declare` in
      `core/graphql/subscriptions/subscription-catalogue.ts` gains optional metadata (description, schema, sample,
      version, permission), filled from `declareStreamedEvents` and the `eventTypes` contributions. Test: every streamed
      event listed; declaring without metadata still works.
- [ ] **T9**. `WEBHOOK_DELIVERY_POLICY` seam in `core/webhook/webhook-outbox.consumer.ts` and hub implementation
      `hub/webhooks/delivery-policy.service.ts` (filter as `rule` rows of owner type `WEBHOOK_SUBSCRIPTION` through
      `core/rule/rule.evaluator.ts`, owner rights through `restrictAudience` for `ownerScoped` subscriptions only, pause,
      test mode, rate spacing). Test: core specs pass unbound; an `ownerScoped` subscription whose owner lacks the event
      permission gets nothing; an existing subscription (not `ownerScoped`) receives exactly the events it receives
      today; a paused (owner-disabled) subscription keeps its events.
- [ ] **T10**. Webhook routes `hub/webhooks/` (`webhook-hub.controller.ts`: test, inspect, signature verify) on the
      existing controllers' paths behind the hub flag; the existing `/disable` of
      `core/webhook/webhook-subscription.controller.ts` takes an optional reason and `/enable` offers dead letters. Test:
      inspector names wrong secret and stale time stamp; disable without a reason behaves as today.
- [ ] **T11**. API catalogue `hub/api-catalogue/` (`api-catalogue.service.ts`, `api-catalogue.controller.ts`: groups
      from the OpenAPI document, per-group documents, record types from the core registry, SDK list, MCP info). Test: a
      custom record type appears with its path.
- [ ] **T12** (parallel). MCP route check: the build check `tools/scripts/mcp-tool-route-check.mjs` of
      `ai-agents-and-assistants` T50 covers FR-8 (no second script here); the API catalogue's MCP entry names it.
      Test: a fixture tool with a missing route fails that check in CI.
- [ ] **T13**. Connector catalogue `hub/connectors/` (`connector-catalogue.service.ts`, `connector.controller.ts`) over
      `integration` rows (`provider` as key, `docUrl`, `version`,
      `integration_type` categories) and `connectors` contributions (capabilities, settings schema, connection state);
      the Ever Platform connection and payment adapters listed; guard
      `apps/gauzy/src/app/pages/integrations/gallery-opens-catalogue.guard.ts` (pattern of
      `apps/gauzy/src/app/pages/feature-documents-redirect.guard.ts`) redirecting `/pages/integrations/new` to the Built
      in tab only while the feature and the organization setting `integration-hub.galleryOpensCatalogue` are on. Test:
      built-in rows keep free, paid and coming-soon marks; an invalid manifest is not listed and its problem is logged;
      feature off, or feature on with the setting off → `/new` opens the existing gallery as today.
- [ ] **T14**. Call log `hub/call-log/` (`call-log.service.ts`, `call-log.controller.ts`, `call-log.redaction.ts`;
      `INTEGRATION_LOG_SOURCES` with core webhook deliveries, hub inbound deliveries,
      the existing receivers of plan §4, payment callbacks, Inbox inbound deliveries, hub entries; redaction; export).
      Test: merged order; card and token fields removed.
- [ ] **T15**. Storage targets read model: the tenant file storage setting
      (`core/core/file-storage/tenant-storage-settings.ts`) as the files target `hub/storage/storage-targets.service.ts`,
      shown on the File storage settings page. Test: tenant setting unchanged after listing.
- [ ] **T16**. Usage view `hub/limits/usage.query.ts` over throttler storage counters. Test: per client and route group.
- [ ] **T17**. Angular: tab-registration seam `PLUGIN_LAYOUT_TABS` in `PluginLayoutComponent`
      (`packages/desktop-ui-lib/src/lib/settings/plugins/component/plugin-layout/plugin-layout.component.ts`) with
      Built in, Marketplace and Installed registered through it; `packages/plugins/integration-hub-ui` tabs Webhooks
      (picker, filter builder, test, deliveries, inspector), Call log and API as child routes of
      `apps/gauzy/src/app/pages/integrations/web-plugin.routes.ts`;
      Built in tab columns (capabilities, connection state, health) in
      `apps/gauzy/src/app/pages/integrations/components/plugin-builtin/plugin-builtin.component.ts`; list page columns
      in `apps/gauzy/src/app/pages/integrations/components/integration-list/list.component.ts`;
      "Targets and purposes" section on `apps/gauzy/src/app/pages/settings/file-storage/`; registered in
      `apps/gauzy/src/plugin-ui.config.ts`; hub components `hubui/components/webhooks-tab/webhooks-tab.component.ts`,
      `hubui/components/call-log-tab/call-log-tab.component.ts`, `hubui/components/api-tab/api-tab.component.ts`;
      i18n keys in every locale. Test: rendering tests; desktop tabs unchanged; hidden on `404`.
- [ ] **T18**. MCP tools `packages/mcp-server/src/lib/tools/integration-hub.ts` (events, subscriptions with preview,
      deliveries, connectors, requests, usage). Test: preview writes nothing; caller permissions.
- [ ] **T49**. Try a route from the API catalogue (FR-7): the API tab runs a read route with the user's own session and
      shows the answer; write routes are offered only in test mode tenants or after a confirmation. Files:
      `hubui/components/api-try-panel/api-try-panel.component.ts`, `hubui/components/api-tab/api-tab.component.ts`.
      Test: a read route answers with the session's permissions; a write route asks for confirmation outside test mode;
      a route the user may not call answers `403` in the panel.
- [ ] **T50**. Retention and the worker schedule plugin: `IntegrationHubSchedulePlugin` in `apps/worker/src/plugins.ts`
      and the nightly `integration-hub.retention` job (inbound deliveries and call log past their retention, default
      30 days; webhook deliveries only where the tenant set a delivery retention; counts per subscription and outcome
      kept). Files: `hub/schedule/integration-hub-schedule.plugin.ts`, `hub/retention/retention.job.ts`,
      `apps/worker/src/plugins.ts`. Test: with no delivery retention set no webhook delivery is removed; with 7 days set
      older deliveries go and their counts remain; call log entries older than the setting are removed.

## Phase 3 — Depth

- [ ] **T19**. Core record-change events: built by T48 and T57 (Phase 1, `packages/core/src/lib/event-outbox/`); its
      tests are theirs.
- [ ] **T20**. Payload versions (`apiVersion` pin; a subscription without one is pinned to version 1, today's payloads;
      every version kept while a subscription is pinned to it; catalogue marks superseded versions). Files:
      `hub/webhooks/payload-versions.ts`, `hub/webhooks/delivery-policy.service.ts`,
      `hub/events-catalogue/event-catalogue.service.ts`. Test: pinned
      subscription receives the old shape; an existing subscription receives byte-equal payloads after a new version
      ships.
- [ ] **T21**. Inbound endpoints `hub/inbound/` (`inbound-endpoint.service.ts`, `inbound-endpoint.controller.ts`,
      `inbound-receive.controller.ts`, `inbound.worker.ts`: public route, raw body, signature and dedupe through the kit
      helpers, size, allow-list, delivery key, queue `integration-inbound`, `inboundHandlers` contributions, rotation
      with overlap, reprocess under `INTEGRATION_INBOUND_ENDPOINT_MANAGE`). Test: fuzz cases for each refusal; duplicate
      key processed once.
- [ ] **T22**. Automation handler binding: incoming-webhook trigger of `automation-and-notifications` registered as an
      inbound handler. Files: `hub/inbound/handlers/automation-trigger.handler.ts`, `apps/api/src/plugin-composition.ts`.
      Test: a flow starts once per accepted delivery.
- [ ] **T23**. Sign-in applications `hub/connected/oauth-app.service.ts` and `hub/connected/oauth-app.controller.ts`
      (discovery, client secret in `integration_setting`, declared apps of connectors). Test: discovery fills endpoints.
- [ ] **T24**. Connected accounts `hub/connected/` (`connected-account.service.ts`, `connected-account.controller.ts`,
      `oauth-callback.controller.ts`, `token-refresh.job.ts`: authorize with PKCE and the kit's `OAuthStateStore`,
      callback, consents per feature, refresh sweep, expiry, revoke at the service, `CONNECTED_ACCOUNTS` port, existing
      integrations listed); the `*-oauth-state.service.ts` and `trello-connect-state.service.ts` of the existing plugins
      (`packages/plugins/integration-asana/src/lib/asana-oauth-state.service.ts`,
      `packages/plugins/integration-trello/src/lib/trello-connect-state.service.ts` and their siblings) become thin
      wrappers over the same store with their key prefixes. Test: OAuth server fake: grant, refresh, refusal → expired,
      removal → revoke; no route returns tokens; existing connect flows pass their specs.
- [ ] **T25**. `INTEGRATION_HTTP` client `hub/http/integration-http.client.ts` (endpoint policy, timeouts, 429
      retry-after, redaction, log). Test: private address refused; retry honours the server's time.
- [ ] **T26**. Core sync runner `core/integration-sync/` (`IntegrationSyncService` in `integration-sync.service.ts` behind
      `INTEGRATION_SYNC_RUNS`, the `INTEGRATION_SYNC` operation definition `integration-sync.operation.ts` on
      `core/operation`, the `integration-sync.tick` schedule `integration-sync.scheduler.ts` over
      `integration_entity_setting`, cursor in the operation state, conflict rules, issues, value maps, baselines on
      `integration_map`, pause after 10 failures for kit connectors' jobs, and for the existing integrations' jobs only
      while `integration-hub.pauseFailingSyncs` is on); `IntegrationTenantSyncService` completion
      (`core/integration-tenant/integration-tenant-sync.service.ts`) reports a run; hub
      routes for jobs, runs and issues (`hub/sync/sync-job.controller.ts`, `hub/sync/sync-issue.controller.ts`). Test:
      interrupted run resumes without duplicates; a second run of the same
      connection is refused by the live-operation rule; conflict "ask" opens an issue; an existing integration's job with
      12 failed runs in a row keeps running while the setting is off.
- [ ] **T27**. Record references and resync routes and `ngx-record-integrations` embeddable. Files:
      `hub/sync/record-references.controller.ts`, `hub/sync/record-resync.service.ts`,
      `packages/ui-core/shared/src/lib/integrations/ngx-record-integrations/record-integrations.component.ts`. Test:
      resync pushes the chosen value through the connector fake.
- [ ] **T28**. Tenant limits `API_LIMIT_POLICY` seam in `core/throttler/throttler-behind-proxy.guard.ts`, hub policy
      `hub/limits/api-limit.policy.ts` and limits routes `hub/limits/limits.controller.ts`, headers,
      notices at 80 % and 100 % (`hub/limits/usage-flush.job.ts`), provider callbacks and inbound exempt; no tenant limit
      until one is set; per-client limits counted per client, the all-clients limit as a shared ceiling that wins once
      reached (spec FR-10). Test: one
      client's burst past its own kind limit does not block another; with an all-clients limit of 100 per day used up by
      client A, client B also gets `429` until the reset; env ceiling still applies unbound; a tenant without limits set
      is throttled exactly as today; one notice per threshold and day.
- [ ] **T29**. Storage targets write path `hub/storage/` (`storage-targets.port.ts`, `storage-target.controller.ts`,
      `storage-verify.job.ts`: `STORAGE_TARGETS` port, verify, retention, failure notices) bound
      for exports, backups, scheduled reports and `ACCESS_AUDIT_STREAM`. Test: failed write recorded and notified.
- [ ] **T30** (parallel). Real-time for API clients: additive authenticator in `packages/plugins/realtime` for tenant keys,
      personal tokens and application tokens. Files: `packages/plugins/realtime/src/lib/realtime-api-client.authenticator.ts`,
      `packages/plugins/realtime/src/lib/realtime-audience.ts`. Test: a key without the event permission receives nothing.
- [ ] **T31** (parallel). Geocoding adapters registry with the existing address lookup
      (`packages/ui-core/shared/src/lib/forms/location/location-form.component.ts`) as
      first adapter; tenant setting route `hub/geocoding/geocoding.controller.ts`; the location form reads the tenant
      choice. Files: `hub/geocoding/geocoding-adapters.registry.ts`. Test: unconfigured tenant behaves as
      today.
- [ ] **T32** (parallel). File picker `FILE_PICKER_SOURCES` with the standard web-file protocol source and the picker
      dialog. Files: `hub/file-picker/web-file-protocol.source.ts`,
      `hubui/components/file-picker-dialog/file-picker-dialog.component.ts`. Test: chosen files copied into platform
      storage.
- [ ] **T33**. Address-book connector `packages/plugins/integration-address-book` on the kit (two-way contacts and people,
      direction switches). Files: `packages/plugins/integration-address-book/src/lib/address-book.connector.ts`,
      `packages/plugins/integration-address-book/src/lib/address-book.manifest.json`. Test: contract suite passes
      against the protocol fake.
- [ ] **T34**. Angular tabs Inbound, Sync (every connector's jobs, runs and issues), Health stub, Connected accounts
      settings. Files: `hubui/components/inbound-tab/inbound-tab.component.ts`,
      `hubui/components/sync-tab/sync-tab.component.ts`, `hubui/components/health-tab/health-tab.component.ts`,
      `hubui/components/connected-accounts/connected-accounts.component.ts`. Test: rendering tests.
- [ ] **T35**. Report definitions (spec FR-70) and datasets. Files: `hub/reports/integration-hub-report-datasets.ts`,
      `hub/reports/integration-hub-report-definitions.ts`. Test: seeded figures.
- [ ] **T51**. Account owners (FR-37): with the tenant setting `integration-hub.stopOnOwnerDeactivation` on (on by
      default for new tenants only; existing tenants keep their setting, off), a connected account stops being used at
      once when its owner is deactivated (consumers get no token); with it off, the account keeps working after its
      owner is deactivated, as today; an organization account moves to another administrator on request. Files:
      `hub/connected/connected-account-owner.subscriber.ts`, `hub/connected/connected-account.service.ts`,
      `hub/connected/connected-account.controller.ts` (`POST /:id/transfer`), `hub/integration-hub.settings.ts`. Test:
      with the setting on, after deactivating the owner `accessToken` refuses; with it off, the account keeps working and syncing
      after its owner is deactivated; a transfer keeps the account and its consents with the new owner.
- [ ] **T52**. Connecting a connector (FR-39, FR-41): its settings form rendered from the manifest's settings schema;
      connect, configure, pause and disconnect per organization; disconnecting keeps mapped records and history. Files:
      `hub/connectors/connector-connection.service.ts`, `hub/connectors/connector.controller.ts`,
      `hubui/components/connector-settings-form/connector-settings-form.component.ts`. Test: a form is generated from a
      sample schema and refuses invalid input; disconnect leaves `integration_map` rows and runs in place; pause stops
      the connection's jobs.
- [ ] **T53**. Extension points for connector builders (FR-40): the catalogue's developer view lists the extension points
      plugins declare through their contributions (record writers, search results, automation triggers and actions,
      export fields). Files: `hub/connectors/extension-points.catalogue.ts`,
      `hubui/components/extension-points/extension-points.component.ts`. Test: a sample plugin's declared trigger and
      record writer appear with their plugin; nothing is listed for a plugin that is not loaded.
- [ ] **T54**. Event streams for API clients (FR-57): GraphQL subscriptions for the catalogue's streamed events accept
      the filter rules of webhook subscriptions, evaluated with the same rule evaluator. Files:
      `packages/plugins/realtime/src/lib/graphql/realtime.resolver.ts`, `hub/events-catalogue/stream-filter.ts`. Test:
      a filtered stream receives only matching events; an event the client may not read is not streamed.
- [ ] **T55**. GraphQL reads and idempotent creates (FR-67): `integrationEvents`, `webhookDeliveries`,
      `connectedAccounts`, `syncRuns`, `syncIssues`; `Idempotency-Key` on every creating hub route. Files:
      `hub/graphql/integration-hub.resolver.ts`, `hub/graphql/integration-hub.schema.ts`. Test: resolver specs with
      permissions; a repeated create with the same key returns the first result.
- [ ] **T56**. Hub events (FR-68): `integration_hub.subscription.paused` / `.disabled`, `integration_hub.delivery.dead`,
      `integration_hub.connected_account.expiring` / `.expired` / `.revoked`, `integration_sync.run.completed` /
      `.failed`, `integration_sync.issue.opened` and `integration_hub.storage_write.failed`, ids only, declared in the
      catalogue. Files: `hub/events/integration-hub.events.ts`, `core/integration-sync/integration-sync.events.ts`. Test:
      each event appended once per cause with ids only; owner notices follow paused, dead and expiring.

## Phase 4 — Advanced capabilities, SDKs, docs

- [ ] **T36**. Bulk replay with preview and dead-letter list `hub/webhooks/replay.service.ts` under
      `WEBHOOK_DELIVERIES_RETRY` (original order and payload, replay marks, enable offers dead letters). Test: 37 dead
      deliveries replay in order; preview counts only; enabling without choosing replay sends no earlier event.
- [ ] **T37** (parallel). Test mode for subscriptions and endpoints with sample events. Files:
      `hub/webhooks/test-mode.service.ts`, `hub/webhooks/delivery-policy.service.ts`, `hub/inbound/inbound-endpoint.service.ts`.
      Test: live events never reach a test-mode subscription.
- [ ] **T38**. Contract suite health check from the connector page as `INTEGRATION_CONTRACT_SUITE` operations. Files:
      `hub/connectors/contract-suite.operation.ts`, `hubui/components/connector-health-check/connector-health-check.component.ts`.
      Test: failing check shown with its step.
- [ ] **T39**. Health scores and expiry warnings `integration-hub.health.daily`; `INTEGRATION_HEALTH` port for payment
      provider accounts. Files: `hub/health/health-score.service.ts`, `hub/health/health-daily.job.ts`,
      `hub/health/health.controller.ts`. Test: seeded failures lower the score; warnings at 14 and 3 days once each.
- [ ] **T40**. Assistant drafts and explanations `hub/assistant/` (`integration-draft.service.ts`,
      `integration-explain.service.ts`: draft from text never saved, failure explanation).
      Test: draft has events and filter; nothing persisted.
- [ ] **T41**. Automation-platform webhooks listed beside core subscriptions (spec FR-71): `integration-zapier`
      (`zapier_webhook_subscription`, `zapier-webhook.service.ts`, routes and the `zapier-webhooks` page of
      `integration-zapier-ui`) and `integration-make-com` (`webhook.service.ts` and its settings address) keep their
      tables and delivery code and answer the read-only `HUB_WEBHOOK_SOURCES` port with their subscriptions and
      deliveries; no row is copied or moved. Files:
      `packages/plugins/integration-zapier/src/lib/zapier-hub-webhook.source.ts`,
      `packages/plugins/integration-make-com/src/lib/make-com-hub-webhook.source.ts`. Test: existing Zapier and Make.com specs pass unchanged; delivered bodies and
      headers equal today's snapshots; their subscriptions and deliveries appear read-only in the Webhooks tab and the
      call log.
- [ ] **T42**. Remaining MCP tools (inbound, sync, replay, health check, draft, explain). Files:
      `packages/mcp-server/src/lib/tools/integration-hub.ts`. Test: preview writes nothing.
- [ ] **T43**. OpenAPI regenerated; SDK regeneration noted; developer docs for the kit and the event catalogue on the docs
      site; `docs/specs/README.md` index row; spec status `Implemented`. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Moving the existing integrations onto the shared records (after T26)

- [ ] **T44**. `integration-{jira,asana,linear,trello}`: `*-sync-run.service.ts`, `*-sync-conflict.service.ts`,
      `*-mapping.service.ts` and the baseline writes go through `INTEGRATION_SYNC_RUNS`, `integration_sync_mapping`,
      `integration_sync_value_map`, `integration_sync_issue` and `integration_map`; their routes
      (`/integration/<name>/:integrationId/{runs,conflicts,mappings}`) keep paths and shapes; copy migrations of plan
      §3.4 (`packages/plugins/integration-jira/src/lib/database/migrations/1791000034220-CopyJiraSyncRecords.ts`,
      `integration-asana` `1791000034230-CopyAsanaSyncRecords`, `integration-linear` `1791000034240-CopyLinearSyncRecords`,
      `integration-trello` `1791000034250-CopyTrelloSyncRecords`). Files: for example
      `packages/plugins/integration-jira/src/lib/jira-sync-run.service.ts`, `jira-sync-conflict.service.ts`,
      `jira-mapping.service.ts`. Test: route snapshots equal before and after the copy (the screens that call them keep working); a rerun of
      the copy changes nothing.
- [ ] **T45** (parallel). `integration-ever-works`: runs reported as `INTEGRATION_SYNC` operations, conflicts
      (`sync/conflicts/ever-works-conflicts.service.ts`) as `integration_sync_issue` rows, `ever_works_sync_run` copied
      (`packages/plugins/integration-ever-works/src/lib/database/migrations/1791000034260-CopyEverWorksSyncRecords.ts`);
      its message tables stay and feed the call log. Files:
      `packages/plugins/integration-ever-works/src/lib/sync/initial/ever-works-initial-sync.service.ts`,
      `packages/plugins/integration-ever-works/src/lib/sync/conflicts/ever-works-conflicts.service.ts`. Test: Ever Works
      sync specs pass; its conflicts listed in the Sync tab.
- [ ] **T46**. Catalogue entries by feature (spec FR-72): optional `featureKey` on `IConnectorManifest`; the core
      integration list routes read by the gallery (`packages/core/src/lib/integration/`) and the hub's `/connectors`
      leave out `integration` rows whose manifest feature is off for the tenant, whether or not the hub is on; rows
      without one are listed as today (used by `commerce-connectors`). Test: a row keyed to a feature that is off is
      absent from the gallery and the catalogue and present with it on; every existing row is listed as today.
- [ ] **T47**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CUSTOM_FIELDS_WEBHOOKS`, `INBOUND_ENDPOINT_HANDLERS`, `INTEGRATION_EVER_WORKS_LINKS`, `MARKETPLACE_WEBHOOK_SUBSCRIPTIONS`, `WORKFLOW_WEBHOOKS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T3, T17, T18 |
| FR-2 | §3.1 Scope, flags and compatibility | T10, T13, T15, T44 |
| FR-3 | §3.1 Scope, flags and compatibility | T1, T43 |
| FR-4–FR-6 | §3.2 API catalogue and documentation | T11 |
| FR-7 | §3.2 API catalogue and documentation | T49 |
| FR-8 | §3.2 API catalogue and documentation | T11, T12, T18 |
| FR-9–FR-10 | §3.3 API limits and usage | T7, T28 |
| FR-11 | §3.3 API limits and usage | T16 |
| FR-12 | §3.3 API limits and usage | T28 |
| FR-13 | §3.4 Event catalogue | T8 |
| FR-14 | §3.4 Event catalogue | T48, T57 |
| FR-15 | §3.4 Event catalogue | T20 |
| FR-16 | §3.4 Event catalogue | T8 |
| FR-17 | §3.5 Outbound webhooks | T9, T17 |
| FR-18 | §3.5 Outbound webhooks | T10 |
| FR-19 | §3.5 Outbound webhooks | T10 |
| FR-20 | §3.5 Outbound webhooks | T14, T17 |
| FR-21 | §3.5 Outbound webhooks | T9, T36 |
| FR-22–FR-23 | §3.5 Outbound webhooks | T9 |
| FR-24 | §3.5 Outbound webhooks | T50 |
| FR-25 | §3.6 Inbound endpoints | T21, T22 |
| FR-26 | §3.6 Inbound endpoints | T21 |
| FR-27 | §3.6 Inbound endpoints | T14, T21 |
| FR-28 | §3.6 Inbound endpoints | T21 |
| FR-29–FR-30 | §3.7 Integration call log | T14 |
| FR-31 | §3.7 Integration call log | T14, T50 |
| FR-32 | §3.8 Sign-in applications and connected accounts | T23 |
| FR-33 | §3.8 Sign-in applications and connected accounts | T23, T24 |
| FR-34 | §3.8 Sign-in applications and connected accounts | T24 |
| FR-35–FR-36 | §3.8 Sign-in applications and connected accounts | T24 |
| FR-37 | §3.8 Sign-in applications and connected accounts | T51 |
| FR-38 | §3.9 Connector catalogue | T13, T17 |
| FR-39 | §3.9 Connector catalogue | T2, T13, T52 |
| FR-40 | §3.9 Connector catalogue | T53 |
| FR-41 | §3.9 Connector catalogue | T52 |
| FR-42 | §3.10 Sync jobs | T26, T34 |
| FR-43–FR-44 | §3.10 Sync jobs | T26, T44, T45 |
| FR-45 | §3.10 Sync jobs | T27 |
| FR-46 | §3.10 Sync jobs | T26 |
| FR-47 | §3.10 Sync jobs | T25, T26 |
| FR-48 | §3.11 Shipped connectors and services | T33 |
| FR-49 | §3.11 Shipped connectors and services | T32 |
| FR-50 | §3.11 Shipped connectors and services | T31 |
| FR-51 | §3.11 Shipped connectors and services | T24, T26 |
| FR-52 | §3.12 Storage and backup targets | T15, T17, T29 |
| FR-53 | §3.12 Storage and backup targets | T15 |
| FR-54 | §3.12 Storage and backup targets | T29 |
| FR-55 | §3.12 Storage and backup targets | T29 |
| FR-56 | §3.13 Real time for API clients | T30 |
| FR-57 | §3.13 Real time for API clients | T54 |
| FR-58 | §3.14 Replay, inspection and test mode (advanced) | T36 |
| FR-59 | §3.14 Replay, inspection and test mode (advanced) | T10 |
| FR-60 | §3.14 Replay, inspection and test mode (advanced) | T36 |
| FR-61 | §3.14 Replay, inspection and test mode (advanced) | T37 |
| FR-62 | §3.15 Connector kit and health (advanced) | T2, T13 |
| FR-63 | §3.15 Connector kit and health (advanced) | T2, T38 |
| FR-64 | §3.15 Connector kit and health (advanced) | T39 |
| FR-65–FR-66 | §3.16 Assistant (advanced) | T40 |
| FR-67 | §3.17 MCP, events and reports | T55 |
| FR-68 | §3.17 MCP, events and reports | T56 |
| FR-69 | §3.17 MCP, events and reports | T18, T42 |
| FR-70 | §3.17 MCP, events and reports | T35 |
| FR-71 | §3.17 MCP, events and reports | T41 |
| FR-72 | §3.17 MCP, events and reports | T46 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- With the feature off, webhook routes, the integrations gallery, each integration and env throttling behave as before;
  with it on and no setting changed, AC-15 holds.
- The four issue-tracker integrations and Ever Works write only the shared sync records, and their routes answer as
  before.
- The MCP route check runs in CI; the sample connector passes its contract suite.
- No route returns a secret or token; the call log contains no credential in the redaction suite.
