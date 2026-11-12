import { resolvePluginLoadOrder } from '@gauzy/plugin';
import { CartPlugin } from '@gauzy/plugin-cart';
import { CatalogPlugin } from '@gauzy/plugin-catalog';
import { DocsPlugin } from '@gauzy/plugin-docs';
import {
	InboxDeliveryPlugin,
	InboxEmailPlugin,
	InboxPlugin,
	isInboxEmailEnabled,
	isInboxEnabled,
	isInboxNotificationEmailEnabled,
	isInboxWebPushEnabled
} from '@gauzy/plugin-inbox';
import { EmailProviderMailgunPlugin, isMailgunEnabled } from '@gauzy/plugin-email-provider-mailgun';
import { EmailProviderPostmarkPlugin, isPostmarkEnabled } from '@gauzy/plugin-email-provider-postmark';
import { EmailProviderResendPlugin, isResendEnabled } from '@gauzy/plugin-email-provider-resend';
import { EmailProviderSendGridPlugin, isSendGridEnabled } from '@gauzy/plugin-email-provider-sendgrid';
import { EmailProviderSesPlugin, isSesEnabled } from '@gauzy/plugin-email-provider-ses';
import { IntegrationEverWorksPlugin, isEverWorksEnabled } from '@gauzy/plugin-integration-ever-works';
import { IntegrationAsanaPlugin, isAsanaEnabled } from '@gauzy/plugin-integration-asana';
import { IntegrationJiraCloudPlugin, isJiraEnabled } from '@gauzy/plugin-integration-jira';
import { IntegrationLinearPlugin, isLinearEnabled } from '@gauzy/plugin-integration-linear';
import { IntegrationTrelloPlugin, isTrelloEnabled } from '@gauzy/plugin-integration-trello';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
import { isTaskAutomationsEnabled, TaskAutomationsSchedulePlugin } from '@gauzy/plugin-task-automations';
import { OrderPlugin } from '@gauzy/plugin-order';
import { PricingPlugin } from '@gauzy/plugin-pricing';
import { TaxPlugin } from '@gauzy/plugin-tax';

/**
 * The plugins the WORKER process hosts.
 *
 * 🛑 This is deliberately NOT `apps/api/src/plugins.ts`. The worker exists to take the heavy,
 * long-running work off the API process (`10-implementation-plan.md` §2.6, mitigation R7), so it
 * carries only the plugins that own a queue the worker is meant to drain or a schedule it is meant to
 * fire — **and the prerequisites those plugins declare**. Adding a plugin here starts its BullMQ
 * workers in this process — do not add one just because the API has it.
 *
 * 🛑 This module must never be imported statically from `main.ts`. `@gauzy/plugin-docs` decides
 * queue-mode vs in-process mode at MODULE-DEFINITION time (`isDocsQueueEnabled()` in
 * `docs.config.ts`, read by `docs.module.ts` when the file is first evaluated), so importing it
 * before `loadEnv()` has run would freeze that decision against an empty environment and the
 * worker would silently run every stage inline — the exact failure this process exists to avoid.
 * `main.ts` therefore reaches it through a dynamic `await import('./plugins')`.
 *
 * 🛑 **A plugin's prerequisites are hosted with it, because its module graph reaches theirs.** The
 * order module imports the pricing and tax modules, and each of those registers its own tables with
 * both ORMs (`MikroOrmModule.forFeature([...])`). Only the entities of the plugins listed HERE are
 * handed to the ORM, so a prerequisite that is imported but not listed is a repository whose entity
 * MikroORM never discovered — `em.getRepository(PricePreference)` throws `Metadata for entity
 * PricePreference not found` while the container is being built, and the worker does not boot at all:
 * the documents pipeline, the outbox dispatch and every sweep this process runs stop with it, on either
 * `DB_ORM`. That is what listing the order plugin alone did.
 *
 * The list is therefore passed through `resolvePluginLoadOrder`, exactly as the API's is: a plugin that
 * declares a prerequisite (`dependsOn`) is ordered after it, and a prerequisite that is missing from
 * this list is refused here — naming the plugin and what it needs — instead of surfacing as a DI error
 * deep inside the boot. `worker-composition.spec.ts` checks the other half, which `dependsOn` cannot:
 * that every entity a hosted module registers a repository for is one this list hands to the ORM.
 */
/** Read once: each switch warns once about a value that is neither `true` nor `false`. */
const everWorksEnabled = isEverWorksEnabled(process.env, (message) => console.warn(message));
/** The Inbox's notification delivery (emails, web push): its sweep, and the transports it sends through, are hosted here. */
const inboxDeliveryEnabled =
	isInboxEnabled(process.env) &&
	(isInboxNotificationEmailEnabled(process.env, (message) => console.warn(message)) ||
		isInboxWebPushEnabled(process.env, (message) => console.warn(message)));

export const plugins = resolvePluginLoadOrder([
	/**
	 * Documents hub — drains the `docs-processing` queue: extract → classify → chunk → embed →
	 * index, plus thumbnails and the startup recovery scan. These stages run OCR, parse large
	 * binaries and call embedding providers, which is why they belong here and not in the API.
	 */
	DocsPlugin,
	/**
	 * The commerce prerequisites, in the dependency order the API lists them in: the sellable thing,
	 * what it costs, what it is taxed. None of them is hosted for work of its own — they are here
	 * because the cart and the order below declare them (`dependsOn`) and import their modules, and a
	 * module whose tables the ORM was never given cannot be constructed.
	 */
	CatalogPlugin,
	PricingPlugin,
	TaxPlugin,
	/**
	 * The stock ledger — a prerequisite of the cart, and also the owner of a schedule of its own.
	 *
	 * `InventoryMaintenanceModule` carries the sweep that releases stock holds whose expiry has
	 * passed, and it states in its own documentation that the cron fires only where the scheduler root
	 * is enabled — which on this platform is this process. Hosting the plugin here is therefore also
	 * what makes that sweep fire; with no queue root the plugin does not import the maintenance module
	 * at all, so a process without Redis is unchanged.
	 */
	InventoryPlugin,
	/**
	 * The cart — hosted here for its two sweeps, not for a queue it drains on demand.
	 *
	 * 🛑 **A `@ScheduledJob` registers only where `SchedulerModule.forRoot({ enabled: true })`,
	 * and that is this process.** The API registers the root with `enabled: false` on purpose: it
	 * hosts the queues and the workers that consume them, and this process is the one that fires the
	 * schedules. So a plugin whose maintenance module is loaded only by the API contributes its
	 * worker and never its cron — nothing is ever enqueued, the worker idles, and every piece looks
	 * healthy.
	 *
	 * That is what the expiry and abandonment passes were: `cart.expiresAt` was refreshed on every
	 * recalculation and acted on by nothing, and `cart.abandonedAfterHours` was declared and read by
	 * nothing. The plugin's own gate still applies — with no queue root `CartMaintenanceModule` is
	 * not imported at all — so a single-container installation is unchanged.
	 */
	CartPlugin,
	/**
	 * The order — hosted here for its two sweeps, on the same reasoning as the cart.
	 *
	 * **A scheduled entry that is not hosted in this process is a scheduled entry that never
	 * fires**, and this package's two were added without one: the ADR-26 reconciliation, which
	 * derives each recently-touched order from its ledgers and repairs a status a missed recompute
	 * left stale, and the stale-change sweep, which is the only thing that releases an order's
	 * exclusive change slot after a request was abandoned. Both are ordinary providers of
	 * `OrderModule`, so both are discovered wherever the plugin is loaded — and the API, which loads
	 * it, registers the scheduler root with `enabled: false` and skips every schedule on purpose.
	 * Hosting the plugin here is therefore what makes them run at all, exactly as it is for the
	 * cart's expiry and abandonment passes.
	 *
	 * This does start the package's BullMQ workers in this process, which is why the note above says
	 * not to add a plugin just because the API has it. The order package owns no queue of its own
	 * today — what travels here is the module graph the two entries are declared in, which is also why
	 * the pricing and tax plugins above are listed — and a single container that runs neither process
	 * is unchanged, because it has no scheduler root at all.
	 */
	OrderPlugin,
	/**
	 * The Ever Works integration — hosted here, behind its switch, for the sync schedules it owns (feed
	 * poll, reconcile, dirty and orphan sweeps, the daily health check). A `@ScheduledJob` fires only in
	 * this process, so a plugin that is not hosted here would never sync on its own.
	 *
	 * Its sync loop stays out of this process on its own (it logs why once): the sync's Gauzy writes go
	 * through core's task, project and employee services, which this module graph does not host, so the
	 * loop runs where they are — the API — and the connection's lease never strands them here.
	 *
	 * 🛑 Off unless `EVER_WORKS_ENABLED` is exactly `true` — the same switch as the API's list — so a
	 * worker of an installation that has not switched the integration on is unchanged: the plugin is not
	 * loaded, its module graph is never built and nothing is scheduled.
	 */
	...(everWorksEnabled ? [IntegrationEverWorksPlugin] : []),
	/**
	 * The Asana integration — hosted here, behind its switch, for the scheduled import it owns: a `@ScheduledJob`
	 * fires only in this process, so a plugin that is not hosted here never imports on its own (its webhooks and
	 * "import now" are the API's). The sweep is registered by the plugin only where a queue root exists and
	 * `ASANA_IMPORT_INTERVAL_MINUTES` is not `0`, so a worker without Redis is unchanged.
	 *
	 * 🛑 Off unless `ASANA_ENABLED` is exactly `true` — the same switch as the API's list.
	 */
	...(isAsanaEnabled(process.env, (message) => console.warn(message)) ? [IntegrationAsanaPlugin] : []),
	/**
	 * The Linear integration — hosted here, behind its switch, for the scheduled import it owns: a `@ScheduledJob`
	 * fires only in this process, so a plugin that is not hosted here never imports on its own (its webhooks and
	 * "import now" are the API's). The sweep is registered by the plugin only where a queue root exists and
	 * `LINEAR_IMPORT_INTERVAL_MINUTES` is not `0`, so a worker without Redis is unchanged.
	 *
	 * 🛑 Off unless `LINEAR_ENABLED` is exactly `true` — the same switch as the API's list.
	 */
	...(isLinearEnabled(process.env, (message) => console.warn(message)) ? [IntegrationLinearPlugin] : []),
	/**
	 * The Trello integration — hosted here, behind its switch, for the scheduled import it owns: a `@ScheduledJob`
	 * fires only in this process, so a plugin that is not hosted here never imports on its own (its webhooks and
	 * "import now" are the API's). The sweep is registered by the plugin only where a queue root exists and
	 * `TRELLO_IMPORT_INTERVAL_MINUTES` is not `0`, so a worker without Redis is unchanged.
	 *
	 * 🛑 Off unless `TRELLO_ENABLED` is exactly `true` — the same switch as the API's list.
	 */
	...(isTrelloEnabled(process.env, (message) => console.warn(message)) ? [IntegrationTrelloPlugin] : []),
	/**
	 * The Jira Cloud sync — hosted here, behind its switch, for the sweep it owns: the scheduled import, the refresh of
	 * each connection's dynamic webhook before Jira's 30-day expiry, and the refused-token notices. A `@ScheduledJob`
	 * fires only in this process (its webhooks and "import now" are the API's). The sweep is registered by the plugin
	 * only where a queue root exists, so a worker without Redis is unchanged. The Connect descriptor plugin
	 * (`IntegrationJiraPlugin`) is the API's alone: it owns no queue and no schedule.
	 *
	 * 🛑 Off unless `JIRA_ENABLED` is exactly `true` — the same switch as the API's list.
	 */
	...(isJiraEnabled(process.env, (message) => console.warn(message)) ? [IntegrationJiraCloudPlugin] : []),
	/**
	 * The Inbox — hosted whenever it is switched on, for its own schedule: the recovery sweep that files the
	 * notifications the API's live filing missed (a process that stopped between a notification's commit and its
	 * filing; the Inbox spec's "no lost entries"). A `@ScheduledJob` fires only here, so without the Inbox in this
	 * process the sweep would never run. It also serves what writes into it here: the Ever Works sync (this process
	 * runs it as often as the API does, whoever holds the connection's lease, and it writes Ever Works inbox items
	 * through the Inbox's writer), the notification delivery (its sweep reads the entries), and a task integration
	 * whose scheduled import met a refused token (the notice to the person who connected is filed through the same
	 * writer). With no queue root the plugin does not import its schedule at all.
	 *
	 * 🛑 Off unless `GAUZY_INBOX_ENABLED` is exactly `true`, so a worker is unchanged by default.
	 */
	...(isInboxEnabled(process.env, (message) => console.warn(message)) ? [InboxPlugin] : []),
	/**
	 * Task automations — hosted here, behind their switch, for the one schedule they own: the 15-minute due-date
	 * sweep. A `@ScheduledJob` fires only in this process. Only the schedule is hosted (`TaskAutomationsSchedulePlugin`:
	 * the queue and the job that enqueues onto it, no consumer, no entity): the rules write through core's task
	 * services, which this module graph does not host, so the sweep runs in the API that consumes the queue — the
	 * outbox's own split. With no queue root the plugin registers nothing here.
	 *
	 * 🛑 Off unless `GAUZY_TASK_AUTOMATIONS_ENABLED` is exactly `true` — the same switch as the API's list.
	 */
	...(isTaskAutomationsEnabled(process.env, (message) => console.warn(message)) ? [TaskAutomationsSchedulePlugin] : []),
	/**
	 * Email delivery of the Inbox's notifications (immediate or digest per kind, the Inbox spec FR-10–FR-12): the
	 * sweep that decides and sends runs here, on the worker's queue root, every minute.
	 *
	 * 🛑 Off unless `GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED` or `GAUZY_INBOX_WEB_PUSH_ENABLED` is exactly `true` as well — the
	 * same switches as the API's list; each channel is served under its own.
	 */
	...(inboxDeliveryEnabled ? [InboxDeliveryPlugin] : []),
	/**
	 * The Inbox email features and the email providers, for the delivery's emails: a provider's transport registers
	 * with the registry of the process that hosts it, so without them here the worker would send over SMTP alone
	 * (and fail where an installation has no SMTP). Hosted only with the delivery, each under its own switch, as the
	 * API's list has them.
	 */
	...(inboxDeliveryEnabled && isInboxEmailEnabled(process.env, (message) => console.warn(message)) ? [InboxEmailPlugin] : []),
	...(inboxDeliveryEnabled && isResendEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderResendPlugin] : []),
	...(inboxDeliveryEnabled && isPostmarkEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderPostmarkPlugin] : []),
	...(inboxDeliveryEnabled && isMailgunEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderMailgunPlugin] : []),
	...(inboxDeliveryEnabled && isSendGridEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderSendGridPlugin] : []),
	...(inboxDeliveryEnabled && isSesEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderSesPlugin] : [])
]);
