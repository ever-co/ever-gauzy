# Task Breakdown: Platform administration

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `platform-administration`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/admin-console.model.ts` (interfaces, enums, contribution shapes,
      event payloads; export from `index.ts`). Test: type-level spec compiles against sample payloads.
- [ ] **T2**. Plugin scaffold `packages/plugins/admin-console` (package, project, tsconfig, jest, eslint, path
      mapping), `admin-console.plugin.ts` declaring `PluginContributions`: `admin-console.features.ts`
      (`FEATURE_ADMIN_CONSOLE`, default off), `admin-console.permissions.ts` (fifteen keys with `defaultFor`),
      `admin-console.settings.ts` (`admin.telemetry.*`, `admin.backup.*`); registered in `apps/api/src/plugins.ts`.
      Test: plugin list spec; contributions in the catalogues; routes answer `404` with the feature off.
- [ ] **T3**. Migration `packages/plugins/admin-console/src/lib/database/migrations/1791000029100-CreateAdminJobsAndErrorsTables.ts`
      on the shared core migration helpers of `procurement` T4 (`@gauzy/core`) (summary, control, run
      request, heartbeat, error group, occurrence) for PostgreSQL, MySQL and SQLite. Test: migration spec on SQLite; up
      twice is a no-op. Migration timestamps: `1791000029100` to `1791000029199` (`packages/plugins/admin-console`); `1791000029900` to `1791000029999` (`packages/core`).
- [ ] **T4** (parallel). Migrations for health and backups (backup, restore, drill with `operationId`) + entities and
      MikroORM repositories. Files:
      `packages/plugins/admin-console/src/lib/database/migrations/1791000029110-CreateAdminHealthTables.ts`,
      `database/migrations/1791000029120-CreateAdminBackupTables.ts`, `health/admin-health-sample.entity.ts`,
      `health/admin-health-threshold.entity.ts`, `health/admin-health-alert.entity.ts`, `backups/admin-backup.entity.ts`,
      `backups/admin-restore.entity.ts`, `backups/admin-restore-drill.entity.ts` (each with `repository/`). Test: both
      ORMs map each entity.
- [ ] **T5** (parallel). Migrations for onboarding (role and profile navigation layers only), translations and
      operations + entities; core usage meter in `packages/core/src/lib/stats/` (`usage_counter` entity,
      `UsageMeterService`, `USAGE_METER` token in contracts) with its core migration. Files:
      `packages/plugins/admin-console/src/lib/database/migrations/1791000029130-CreateAdminOnboardingTables.ts`,
      `database/migrations/1791000029140-CreateAdminTranslationTables.ts`,
      `database/migrations/1791000029150-CreateAdminOpsTables.ts`,
      `packages/core/src/lib/database/migrations/1791000029900-CreateUsageCounter.ts`,
      `packages/core/src/lib/stats/usage-counter.entity.ts`, `packages/core/src/lib/stats/usage-meter.service.ts`. Test:
      migration specs; repository smoke specs; meter adds and reads per subject, metric and window.
- [ ] **T6**. Default health thresholds seed; default grants through `defaultFor` on the permission contributions (no
      permission seed). Files: `packages/plugins/admin-console/src/lib/database/migrations/1791000029160-SeedAdminDefaultThresholds.ts`,
      `admin-console.permissions.ts`. Test: grants for the default roles on a new tenant and after the permission
      reload on an existing one; idempotent; the six default thresholds of spec FR-82 present.
- [ ] **T7**. `InstallationOperatorGuard` in the plugin reusing `mayWriteGlobalSettings` /
      `isListedInstallationOperator` from `tenant-setting/global-setting-writer.ts`. Test: single-tenant super admin
      passes, multi-tenant without list refused, listed user passes.
- [ ] **T8**. Scheduler seam: `SchedulerJobGate` interface and `attachJobGate()` in `packages/scheduler`
      (`scheduler.service.ts`, `scheduler-job-runner.service.ts`), optional `triggerNow(jobId, { trigger,
      requestedBy })`; paused ticks recorded as skipped with reason. Test: runner specs with and without a gate; gate
      errors never break a run.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Job summary and monitor services (`jobs/`): summary maintenance from `job_execution`, list, ledger
      reads, control (pause, override with schedule validation), run requests; controllers under `/admin/jobs`. Test:
      unit; `409` on live run and stale version.
- [ ] **T10**. Worker wiring: `AdminConsoleSchedulePlugin` in `apps/worker/src/plugins.ts` with heartbeat, run-request
      taker and gate adapter next to `scheduler-ledger.bootstrap.ts`. Test: worker plugin spec; run request taken once
      across two nodes.
- [ ] **T11** (parallel). Workers and queues reads (`/admin/workers`, `/admin/queues`), lost-worker rule; outbox and
      webhook backlog cards; plugins loaded per process (`/admin/plugins`, from the heartbeat). Files:
      `packages/plugins/admin-console/src/lib/workers/admin-workers.service.ts`, `workers/admin-workers.controller.ts`,
      `workers/admin-plugins.controller.ts`, `workers/backlog-cards.service.ts`. Test: unit with seeded heartbeats; a
      worker silent for 2 minutes is lost.
- [ ] **T12**. Dead-letter routes over `JobDeadLetterService` (list, payload, replay selection, discard with reason).
      Files: `packages/plugins/admin-console/src/lib/dead-letters/admin-dead-letters.controller.ts`,
      `dead-letters/admin-dead-letters.service.ts`, `packages/core/src/lib/job-dead-letter/job-dead-letter.service.ts`.
      Test: replay once; discard requires reason.
- [ ] **T13**. Error sink: `ERROR_OCCURRENCE_SINK` token in core, call from `api-exception.filter.ts` and
      `database-error.filter.ts` after the reply; plugin buffer, scrubber (secrets, tokens and bodies removed, stack cut
      at 4 KB), fingerprint, record and job links, flush job; job failures and dead letters as occurrences. Files:
      `packages/core/src/lib/core/errors/api-exception.filter.ts`, `packages/core/src/lib/core/errors/database-error.filter.ts`,
      `packages/plugins/admin-console/src/lib/errors/error-occurrence.sink.ts`, `errors/error-scrubber.ts`,
      `errors/error-fingerprint.ts`. Test: filter specs unchanged; fingerprint stability; secrets stripped.
- [ ] **T14**. Error log service and routes (groups, occurrences, status, reopen on later release, tenant view without
      stacks). Files: `packages/plugins/admin-console/src/lib/errors/admin-errors.service.ts`,
      `errors/admin-errors.controller.ts`. Test: unit and e2e for tenant isolation.
- [ ] **T15**. Health snapshot service (reuses `HealthService`, scheduler, outbox, email history, sessions, sign-in
      attempts, last good backup) and storage reads per dialect (`storage/dialects/{postgres,mysql,sqlite}.ts`), file
      storage per tenant where the provider reports it; liveness and readiness probes untouched. Files:
      `packages/plugins/admin-console/src/lib/health/admin-health-snapshot.service.ts`, `health/admin-health.controller.ts`,
      `storage/admin-storage.service.ts`, `storage/dialects/postgres.ts`, `storage/dialects/mysql.ts`,
      `storage/dialects/sqlite.ts`. Test: SQLite and PostgreSQL specs for table sizes; probe specs unchanged.
- [ ] **T16**. Health sampler (every 5 minutes, 30 days kept), roll-up, thresholds, alerts with inbox and email. Files:
      `packages/plugins/admin-console/src/lib/health/admin-health-sampler.scheduler.ts`, `health/admin-health-rollup.ts`,
      `health/admin-alerts.service.ts`, `health/admin-thresholds.controller.ts`. Test: open and close with duration; one
      notification per opening.
- [ ] **T17**. Setup wizard service and routes: state, core steps, contributed steps, persona, resume, idempotent
      apply; installation first-run step. Files: `packages/plugins/admin-console/src/lib/setup/admin-setup.service.ts`,
      `setup/admin-setup.controller.ts`, `setup/core-setup-steps.ts`, `setup/setup-step.registry.ts`,
      `setup/installation-setup.controller.ts`. Test: unit; contributed step hidden with feature off.
- [ ] **T18**. Reference seed contributions: `IAdminReferenceSeedContribution` registry, called from
      `TenantService.executeTenantUpdateTasks` (additive, only missing) and on feature enable; re-seed preview. Files:
      `packages/plugins/admin-console/src/lib/setup/reference-seed.registry.ts`, `setup/reference-seed.service.ts`,
      `packages/core/src/lib/tenant/tenant.service.ts`. Test: SQLite end-to-end on a new tenant; second run adds nothing.
- [ ] **T19**. Invitations: extend core `POST /invite/emails` (`packages/core/src/lib/invite/invite.controller.ts`,
      `invite.service.ts`) with a file of addresses, an access profile and a per-row result; add existing user,
      half-life reminders and expiry job over core `invite`. Test: mixed batch; existing callers of `/invite/emails`
      unchanged; reminder once.
- [ ] **T20** (parallel). Sign-in facts (`user.lastLoginAt`, user type, invitation origin) added to the existing user
      list routes, and bulk actions delegating to access-control routes. Files:
      `packages/core/src/lib/user/user.controller.ts`, `packages/plugins/admin-console/src/lib/users/admin-user-facts.service.ts`,
      `users/admin-user-bulk.controller.ts`. Test: unit with fake ports; existing user list specs unchanged.
- [ ] **T21**. Checklists: contributions, assignment, per-user and shared progress, auto-ticks from outbox events,
      reset. Files: `packages/plugins/admin-console/src/lib/checklists/admin-checklists.service.ts`,
      `checklists/admin-checklists.controller.ts`, `checklists/checklist-autotick.consumer.ts`,
      `checklists/checklist.registry.ts`. Test: event ticks a step once; completion per step, role and organization
      read back.
- [ ] **T22**. Tours and help items: CRUD, progress, page lookup, search, keep-or-discard record option. Files:
      `packages/plugins/admin-console/src/lib/tours/admin-tours.service.ts`, `tours/admin-tours.controller.ts`,
      `help/admin-help.service.ts`, `help/admin-help.controller.ts`. Test: unit; a tour is offered once per user and
      resumes at the step reached.
- [ ] **T23**. Activation level and empty-state metadata (`/admin/activation`). Files:
      `packages/plugins/admin-console/src/lib/activation/admin-activation.service.ts`,
      `activation/admin-activation.controller.ts`, `activation/empty-state.registry.ts`. Test: levels from seeded records.
- [ ] **T24**. Navigation layers (tenant layer in the tenant UI preferences, role and profile layers in
      `admin_navigation_layout`, user layer in `user.uiPreferences`), header menus, landing page with fallback, home
      tiles, app links, filtered by permissions, features and the page gates of `access-control-and-security`; menu
      counts with cache and real-time refresh; banner broadcasts. Files:
      `packages/plugins/admin-console/src/lib/navigation/admin-navigation.service.ts`,
      `navigation/admin-navigation.controller.ts`, `navigation/admin-counts.service.ts`, `navigation/admin-counts.controller.ts`,
      `navigation/announcement-banner.service.ts`. Test: layering rules; an entry hidden by permission or gate never
      shown; a gated landing page falls back.
- [ ] **T25**. Session-start endpoint aggregating features, display settings, preferences, layers, counts and
      announcements. Files: `packages/plugins/admin-console/src/lib/session-start/session-start.service.ts`,
      `session-start/session-start.controller.ts`. Test: performance spec under 250 ms on seeded data.
- [ ] **T26** (parallel). Settings hub registry, deployment switches route for the existing features page, installation
      settings with sources (secrets masked). Files:
      `packages/plugins/admin-console/src/lib/settings-hub/settings-hub.registry.ts`,
      `settings-hub/settings-hub.controller.ts`, `installation/deployment-switches.controller.ts`,
      `installation/installation-settings.service.ts`, `installation/installation-settings.controller.ts`. Test: no
      secret value in any response.
- [ ] **T27**. Translations: tenant languages, overrides with placeholder and markup checks, override map with ETag,
      export and import with preview, proposals. Files:
      `packages/plugins/admin-console/src/lib/translations/admin-languages.controller.ts`,
      `translations/admin-translations.service.ts`, `translations/admin-translations.controller.ts`,
      `translations/placeholder-check.ts`, `translations/translation-file.io.ts`,
      `translations/admin-translation-proposals.controller.ts`. Test: placeholder refusal; ETag changes on save.
- [ ] **T28**. `TRANSLATION_OVERRIDE_SOURCE` in core: email-template and print rendering read overrides. Files:
      `packages/core/src/lib/i18n/translation-override.source.ts`,
      `packages/core/src/lib/email-send/email-template-render.service.ts`,
      `packages/plugins/admin-console/src/lib/translations/translation-override.provider.ts`. Test: an email of the
      tenant shows the override, another tenant's does not.
- [ ] **T29**. Translated values: `translated_value` service for types without translation tables,
      `IAdminTranslatableField` contributions, read interceptor choosing the reader's language with fallback; the
      product translation tables stay and the editor reads both. Files:
      `packages/plugins/admin-console/src/lib/translations/translated-value.service.ts`,
      `translations/translated-value.controller.ts`, `translations/translated-value.interceptor.ts`,
      `translations/translatable-field.registry.ts`. Test: unit; existing product translation specs unchanged.
- [ ] **T30**. Telemetry choices as tenant settings (`admin.telemetry.*`); the `ever-stats` collector
      (`ever-stats-collector.service.ts`) leaves out tenants that do not share; the analytics choice over the existing
      product-analytics tenant settings (no new default); preview through the `ever-stats` preview;
      adoption counters in the core usage meter with the collector's metric names; deletion. Test: opted-out tenant
      absent from the payload; preview equals payload; a tenant sending analytics events today still sends them after
      the console is switched on.
- [ ] **T31**. Tenant backups as core operation `admin.backup`: backup-mode archive on `repositories.service.ts`
      registry, streaming, manifest, encryption, target port, rotation, pin, download link; policy from the
      `admin.backup.*` settings. Test: round trip on SQLite; manifest mismatch refused; resumed after a worker restart.
- [ ] **T32**. Restore as core operation `admin.restore`: new tenant, same tenant with safety backup, read-only window
      and roll-back, release checks, forward migration. Files:
      `packages/plugins/admin-console/src/lib/backups/admin-restore.operation.ts`, `backups/admin-restores.controller.ts`,
      `backups/release-compatibility.ts`. Test: PostgreSQL backup restored on SQLite; forced failure rolls back.
- [ ] **T33** (parallel). Installation backups: SQLite consistent copy, dump command behind
      `GAUZY_ADMIN_DB_DUMP_ENABLED`, signed status endpoint. Files:
      `packages/plugins/admin-console/src/lib/backups/installation-backup.service.ts`,
      `backups/installation-backups.controller.ts`, `backups/backup-status.signature.ts`. Test: HMAC refusal; SQLite copy
      opens.
- [ ] **T34**. Retention: this plugin's log kinds declared through `RETENTION_SOURCES` with shipped defaults
      (`job-execution.service.ts` and `idempotency-cleanup.worker.ts` read their period from it), installation
      defaults through the global settings writer, `admin.retention` applying the defaults only while
      `access-control-and-security` is not loaded; current periods as defaults and `KEEP` for kinds nothing purges today.
      Test: purges only finished ledger rows older than the bound; one runner when both plugins are loaded; with the
      defaults, expired invitations, call logs, delivered outbox rows and discarded dead letters are kept.
- [ ] **T35** (parallel). Update check and what's-new link; demo-mode protections (password, email, factor, role),
      outbound capture, scheduled reset, each behind its installation setting (`admin.demo.*`, default off). Files:
      `packages/plugins/admin-console/src/lib/update-check/update-check.scheduler.ts`,
      `demo/demo-protections.guard.ts`, `demo/demo-outbound-capture.ts`, `demo/demo-reset.scheduler.ts`,
      `demo/demo-captures.controller.ts`. Test: protected account refused and capture instead of send with the settings
      on; with them off the demo installation sends and accepts changes as today.
- [ ] **T36**. Operations catalogue registered in core `OperationRegistry` (clear caches, rebuild search, re-seed,
      re-send outbox, recompute counts, verify backup, table maintenance pass refused during a backup) with preview and
      scope in the operation input, progress and result; my-operations panel over `/api/operations`. Files:
      `packages/plugins/admin-console/src/lib/operations/admin-operations.catalogue.ts`,
      `operations/admin-operations.controller.ts`, `operations/table-maintenance.operation.ts`,
      `operations/my-operations.controller.ts`. Test: each operation previews and runs once; it appears in
      `/api/operations`; a maintenance pass is refused while a backup runs.
- [ ] **T37** (parallel). Profiler sessions (query count and time hooks for both ORMs, slow-query plans, index
      suggestions, auto-stop) and read-only query page behind `GAUZY_ADMIN_QUERY_CONSOLE_ENABLED`. Files:
      `packages/plugins/admin-console/src/lib/profiler/admin-profiler.service.ts`, `profiler/admin-profiler.controller.ts`,
      `profiler/query-hooks.ts`, `query/admin-query.controller.ts`. Test: write statement refused; session stops at 15
      minutes.
- [ ] **T38**. Console events on the outbox and real-time hints (plan §5); report definitions of spec §3.15
      registered. Files: `packages/plugins/admin-console/src/lib/events/admin-console.events.ts`,
      `events/admin-console.hints.ts`, `reports/admin-report-datasets.ts`, `reports/definitions/*.definition.ts` (one
      per report of spec §3.15). Test: each event emitted once; report figures agree with seeded records.
- [ ] **T58**. Console home `/admin/overview`: one card per area (setup, onboarding, jobs, errors, health, backups,
      telemetry, translations) with its count of open problems and a link, and the age of the last good backup. Files:
      `packages/plugins/admin-console/src/lib/overview/admin-overview.service.ts`, `overview/admin-overview.controller.ts`.
      Test: counts per card on seeded problems; an installation card is absent for a non-operator.
- [ ] **T59**. Console request rules: every console change written to the platform audit (who, when, before, after,
      scope), `version` on updates answering `409` when stale, `Idempotency-Key` on creating and running routes, cursor
      pagination on lists. Files: `packages/plugins/admin-console/src/lib/common/admin-audit.interceptor.ts`,
      `common/admin-version.guard.ts`, `common/admin-pagination.ts`. Test: a change records before and after; a stale
      version gets `409`; a repeated key returns the first result.

## Phase 3 — UI surfaces

- [ ] **T39**. Angular plugin scaffold `packages/plugins/admin-console-ui`, registered in
      `apps/gauzy/src/plugin-ui.config.ts`, settings sections, feature and permission gating, i18n keys in every
      locale. Test: plugin spec; menu hidden without the feature.
- [ ] **T40**. Overview, jobs (list, detail with ledger chart, controls), workers, queues, dead letters pages. Files:
      `packages/plugins/admin-console-ui/src/lib/components/overview/admin-overview.component.ts`,
      `components/jobs/admin-jobs.component.ts`, `components/jobs/admin-job-detail.component.ts`,
      `components/workers/admin-workers.component.ts`, `components/queues/admin-queues.component.ts`,
      `components/dead-letters/admin-dead-letters.component.ts`. Test: rendering specs; keyboard navigation.
- [ ] **T41** (parallel). Error log pages and health pages (snapshot, history, thresholds, alerts), storage page;
      links to the existing monitoring page. Files:
      `packages/plugins/admin-console-ui/src/lib/components/errors/admin-errors.component.ts`,
      `components/errors/admin-error-detail.component.ts`, `components/health/admin-health.component.ts`,
      `components/health/admin-thresholds.component.ts`, `components/storage/admin-storage.component.ts`. Test: rendering
      specs; table alternative for charts.
- [ ] **T42**. Setup wizard route in `onboarding-ui` (steps, persona, proposal preview), installation first-run page.
      Files: `packages/plugins/onboarding-ui/src/lib/onboarding.routes.ts`,
      `packages/plugins/onboarding-ui/src/lib/components/setup-wizard/setup-wizard.component.ts`,
      `packages/plugins/admin-console-ui/src/lib/components/installation/installation-first-run.component.ts`. Test:
      rendering and resume specs.
- [ ] **T43**. Shell pieces in `packages/ui-core`: tour overlay and `[gaTourAnchor]`, "Get started" card, help panel,
      empty-state panel, operations panel, announcement bar, menu counts, navigation layering in the menu builder, and
      on the hosted cloud installation only the plan, trial days left and billing link in the header, each active only
      while `FEATURE_ADMIN_CONSOLE` is on. Files: `packages/ui-core/shared/src/lib/admin-shell/tour-overlay.component.ts`,
      `packages/ui-core/shared/src/lib/admin-shell/tour-anchor.directive.ts`,
      `packages/ui-core/shared/src/lib/admin-shell/get-started-card.component.ts`,
      `packages/ui-core/shared/src/lib/admin-shell/help-panel.component.ts`,
      `packages/ui-core/shared/src/lib/admin-shell/empty-state-panel.component.ts`,
      `packages/ui-core/shared/src/lib/admin-shell/announcement-bar.component.ts`,
      `packages/ui-core/core/src/lib/services/nav-builder/nav-menu-builder.service.ts` (layers and counts). Test: component specs; Escape closes a tour; with the flag off the shell
      renders and calls exactly as before; a self-hosted installation shows no plan or trial.
- [ ] **T44** (parallel). Onboarding admin pages (checklists, tour editor with anchor picker, help items), navigation
      editor (no hide for others; gates live in `access-control-and-security`), settings hub, deployment switches
      section on the existing `settings/feature` page, installation settings. Files:
      `packages/plugins/admin-console-ui/src/lib/components/onboarding/admin-checklists.component.ts`,
      `components/onboarding/tour-editor.component.ts`, `components/onboarding/help-items.component.ts`,
      `components/navigation/navigation-editor.component.ts`, `components/settings-hub/settings-hub.component.ts`,
      `components/installation/installation-settings.component.ts`,
      `apps/gauzy/src/app/pages/settings/feature/feature.component.ts`. Test: rendering specs.
- [ ] **T45**. Translation pages (languages, grid, proposals, import and export) and the override merge in
      `packages/ui-core/i18n` loader; translated-value editor on forms that declare fields. Files:
      `packages/plugins/admin-console-ui/src/lib/components/translations/admin-languages.component.ts`,
      `components/translations/translation-grid.component.ts`, `components/translations/translation-proposals.component.ts`,
      `packages/ui-core/i18n/src/lib/translate-http-loader.ts`,
      `packages/ui-core/shared/src/lib/translated-value/translated-value-editor.component.ts`. Test: merged string shows.
- [ ] **T46** (parallel). Telemetry, adoption, backups (policy, runs, restore wizard), installation retention
      defaults, operations, profiler, plugins, demo captures pages. Files:
      `packages/plugins/admin-console-ui/src/lib/components/telemetry/admin-telemetry.component.ts`,
      `components/adoption/admin-adoption.component.ts`, `components/backups/admin-backups.component.ts`,
      `components/backups/restore-wizard.component.ts`, `components/retention/admin-retention.component.ts`,
      `components/operations/admin-operations.component.ts`, `components/profiler/admin-profiler.component.ts`,
      `components/plugins/admin-plugins.component.ts`, `components/demo/admin-demo-captures.component.ts`. Test:
      rendering specs.
- [ ] **T47** (parallel). Bulk invitation on the existing invitations page and sign-in facts with bulk actions on the
      existing `apps/gauzy/src/app/pages/users` page (no second users page). Files:
      `apps/gauzy/src/app/pages/users/manage-user-invite/manage-user-invite.component.ts`,
      `apps/gauzy/src/app/pages/users/users.component.ts`. Test: per-row result rendering.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T48**. MCP tools `packages/mcp-server/src/lib/tools/admin-console.ts` (plan §7) with `preview` defaults,
      registered in `register-all-tools.ts`. Test: input-schema spec; preview tools write nothing.
- [ ] **T49**. OpenAPI document regenerated; SDK regeneration noted for release; webhook event catalogue entries. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive; the webhook catalogue lists the new events.
- [ ] **T50**. User docs (docs site: operator guide, tenant administrator guide) and `docs/specs/README.md` index row. Test: docs build.

## Phase 5 — Advanced capabilities

- [ ] **T51**. Restore preview (whole tenant and one organization) and organization restore. Files:
      `packages/plugins/admin-console/src/lib/backups/restore-preview.service.ts`,
      `backups/organization-restore.operation.ts`, `backups/admin-restores.controller.ts`. Test: preview equals the
      applied differences on a seeded tenant.
- [ ] **T52**. Restore drills as core operation `admin.drill`: schedule from the backup settings, temporary tenant
      without sign-in, comparison, removal, report, notifications. Files:
      `packages/plugins/admin-console/src/lib/backups/restore-drill.operation.ts`, `backups/restore-drill.scheduler.ts`,
      `backups/admin-restore-drills.controller.ts`. Test: drill report on SQLite; temporary tenant gone afterwards.
- [ ] **T53**. Administrator assistant: hint registry (`IAdminJobHint`), explain service over ledger, error groups,
      alerts and backups, proposals as catalogue operations, findings, MCP tool; read-only access plus the operations the
      asking user may run, each confirmed, marked as agent actions in the audit. Files:
      `packages/plugins/admin-console/src/lib/assistant/admin-assistant.service.ts`,
      `assistant/admin-assistant.controller.ts`, `assistant/job-hint.registry.ts`,
      `packages/mcp-server/src/lib/tools/admin-console.ts` (`admin_explain`). Test: seeded failure explained; no
      operation without confirmation; the audit marks the agent.
- [ ] **T54**. Configuration snapshots: area contributions, capture, signed export and import, diff, promotion with
      prior snapshot, automatic snapshots. Files: `packages/plugins/admin-console/src/lib/snapshots/config-snapshot.service.ts`,
      `snapshots/config-snapshots.controller.ts`, `snapshots/config-diff.ts`, `snapshots/config-area.registry.ts`,
      `snapshots/config-promotion.service.ts`. Test: diff golden cases; failed item does not stop others.
- [ ] **T55** (parallel). Persona proposal (features, checklists, navigation preset) and adoption view. Files:
      `packages/plugins/admin-console/src/lib/setup/persona-proposal.service.ts`, `telemetry/admin-adoption.service.ts`,
      `telemetry/admin-adoption.controller.ts`. Test: proposal applied only on confirmation; accepted invitations counted
      per inviter.
- [ ] **T56** (parallel). AI translation suggestions through the assistant provider port. Files:
      `packages/plugins/admin-console/src/lib/translations/translation-suggestions.service.ts`,
      `translations/admin-translations.controller.ts` (`/suggest`). Test: suggestions stay proposals; hidden without a
      provider.
- [ ] **T57**. Trial period on a tenant with the flag on; spec status `Implemented`. Test: every acceptance criterion of `spec.md` §7 demonstrated on the trial tenant.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Console and scope | T2, T7, T39 |
| FR-2 | §3.1 Console and scope | T40, T58 |
| FR-3 | §3.1 Console and scope | T59 |
| FR-4 | §3.1 Console and scope | T38 |
| FR-5 | §3.1 Console and scope | T2, T43 |
| FR-6–FR-7 | §3.2 Setup wizard | T17, T42 |
| FR-8 | §3.2 Setup wizard | T17 |
| FR-9–FR-10 | §3.2 Setup wizard | T17, T42 |
| FR-11 | §3.2 Setup wizard | T55 |
| FR-12 | §3.2 Setup wizard | T17, T42 |
| FR-13 | §3.2 Setup wizard | T18 |
| FR-14 | §3.2 Setup wizard | T17, T18, T42 |
| FR-15 | §3.3 Invitations and user administration | T19, T47 |
| FR-16–FR-18 | §3.3 Invitations and user administration | T19 |
| FR-19 | §3.3 Invitations and user administration | T20, T47 |
| FR-20 | §3.3 Invitations and user administration | T20, T47, T55 |
| FR-21 | §3.4 Onboarding checklists, tours, hints and help | T21, T43 |
| FR-22 | §3.4 Onboarding checklists, tours, hints and help | T21 |
| FR-23 | §3.4 Onboarding checklists, tours, hints and help | T21, T44 |
| FR-24–FR-25 | §3.4 Onboarding checklists, tours, hints and help | T22, T43, T44 |
| FR-26 | §3.4 Onboarding checklists, tours, hints and help | T22, T44 |
| FR-27 | §3.4 Onboarding checklists, tours, hints and help | T23 |
| FR-28 | §3.4 Onboarding checklists, tours, hints and help | T23, T43 |
| FR-29 | §3.4 Onboarding checklists, tours, hints and help | T22, T43 |
| FR-30 | §3.4 Onboarding checklists, tours, hints and help | T22, T44 |
| FR-31 | §3.4 Onboarding checklists, tours, hints and help | T21, T38 |
| FR-32–FR-34 | §3.5 Navigation, home and counts | T24, T44 |
| FR-35 | §3.5 Navigation, home and counts | T24, T44 |
| FR-36–FR-38 | §3.5 Navigation, home and counts | T24 |
| FR-39 | §3.5 Navigation, home and counts | T25 |
| FR-40 | §3.6 Settings hub and installation configuration | T26, T44 |
| FR-41 | §3.6 Settings hub and installation configuration | T26, T44 |
| FR-42 | §3.6 Settings hub and installation configuration | T7, T26 |
| FR-43 | §3.6 Settings hub and installation configuration | T26 |
| FR-44 | §3.6 Settings hub and installation configuration | T41, T46 |
| FR-45 | §3.6 Settings hub and installation configuration | T26, T44 |
| FR-46 | §3.6 Settings hub and installation configuration | T26, T43 |
| FR-47 | §3.7 Translations | T27, T45 |
| FR-48 | §3.7 Translations | T27, T45 |
| FR-49 | §3.7 Translations | T27 |
| FR-50 | §3.7 Translations | T28, T45 |
| FR-51 | §3.7 Translations | T27, T45 |
| FR-52 | §3.7 Translations | T29, T45 |
| FR-53 | §3.7 Translations | T29 |
| FR-54 | §3.7 Translations | T27, T45 |
| FR-55 | §3.7 Translations | T56 |
| FR-56–FR-57 | §3.8 Usage telemetry controls | T30 |
| FR-58 | §3.8 Usage telemetry controls | T5, T30 |
| FR-59 | §3.8 Usage telemetry controls | T30 |
| FR-60 | §3.8 Usage telemetry controls | T55 |
| FR-61–FR-62 | §3.8 Usage telemetry controls | T30 |
| FR-63 | §3.9 Scheduled jobs, workers and queues | T9, T40 |
| FR-64 | §3.9 Scheduled jobs, workers and queues | T9, T40 |
| FR-65 | §3.9 Scheduled jobs, workers and queues | T8, T9 |
| FR-66 | §3.9 Scheduled jobs, workers and queues | T8, T9 |
| FR-67 | §3.9 Scheduled jobs, workers and queues | T8, T9, T10 |
| FR-68 | §3.9 Scheduled jobs, workers and queues | T11 |
| FR-69 | §3.9 Scheduled jobs, workers and queues | T11, T40 |
| FR-70 | §3.9 Scheduled jobs, workers and queues | T12 |
| FR-71 | §3.9 Scheduled jobs, workers and queues | T11 |
| FR-72 | §3.9 Scheduled jobs, workers and queues | T36, T43 |
| FR-73 | §3.10 Error log | T13 |
| FR-74–FR-76 | §3.10 Error log | T14 |
| FR-77 | §3.10 Error log | T13, T14 |
| FR-78 | §3.10 Error log | T13 |
| FR-79 | §3.11 System health and storage | T15, T41 |
| FR-80 | §3.11 System health and storage | T16, T41 |
| FR-81 | §3.11 System health and storage | T16 |
| FR-82 | §3.11 System health and storage | T6, T16 |
| FR-83 | §3.11 System health and storage | T15 |
| FR-84 | §3.11 System health and storage | T36, T41 |
| FR-85 | §3.11 System health and storage | T15 |
| FR-86 | §3.11 System health and storage | T15, T41 |
| FR-87–FR-90 | §3.12 Backups and restore | T31 |
| FR-91–FR-92 | §3.12 Backups and restore | T32 |
| FR-93–FR-94 | §3.12 Backups and restore | T51 |
| FR-95 | §3.12 Backups and restore | T52 |
| FR-96 | §3.12 Backups and restore | T33 |
| FR-97 | §3.12 Backups and restore | T15, T31, T38 |
| FR-98 | §3.13 Retention, update notices, operations, profiler and demo mode | T34 |
| FR-99 | §3.13 Retention, update notices, operations, profiler and demo mode | T35, T46 |
| FR-100 | §3.13 Retention, update notices, operations, profiler and demo mode | T36 |
| FR-101–FR-102 | §3.13 Retention, update notices, operations, profiler and demo mode | T37 |
| FR-103 | §3.13 Retention, update notices, operations, profiler and demo mode | T11, T46 |
| FR-104–FR-105 | §3.13 Retention, update notices, operations, profiler and demo mode | T35 |
| FR-106–FR-107 | §3.13 Retention, update notices, operations, profiler and demo mode | T35, T46 |
| FR-108 | §3.14 Configuration snapshots, assistant, API and compatibility | T54 |
| FR-109–FR-111 | §3.14 Configuration snapshots, assistant, API and compatibility | T54 |
| FR-112 | §3.14 Configuration snapshots, assistant, API and compatibility | T53 |
| FR-113 | §3.14 Configuration snapshots, assistant, API and compatibility | T53 |
| FR-114 | §3.14 Configuration snapshots, assistant, API and compatibility | T18, T36, T51, T54, T59 |
| FR-115 | §3.14 Configuration snapshots, assistant, API and compatibility | T48 |
| FR-116 | §3.14 Configuration snapshots, assistant, API and compatibility | T38 |
| FR-117 | §3.14 Configuration snapshots, assistant, API and compatibility | T3–T5, T31 |
| FR-118–FR-124 | §3.15 Reports | T38 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; spec AC-17 holds.
- Constitution gates in `spec.md` §9 confirmed.
- A tenant backup taken on each dialect restores on each other dialect with a verified manifest.
- Liveness and readiness probes, the existing settings pages and the usage statistics plugin behave identically with
  the feature on and off.
- No console response contains a secret value (contract test over every route).
- Every acceptance criterion of `spec.md` §7 has a named test.
