import { CartPlugin } from '@gauzy/plugin-cart';
import { DocsPlugin } from '@gauzy/plugin-docs';

/**
 * The plugins the WORKER process hosts.
 *
 * 🛑 This is deliberately NOT `apps/api/src/plugins.ts`. The worker exists to take the heavy,
 * long-running work off the API process (`10-implementation-plan.md` §2.6, mitigation R7), so it
 * carries only the plugins that own a queue the worker is meant to drain. Adding a plugin here
 * starts its BullMQ workers in this process — do not add one just because the API has it.
 *
 * 🛑 This module must never be imported statically from `main.ts`. `@gauzy/plugin-docs` decides
 * queue-mode vs in-process mode at MODULE-DEFINITION time (`isDocsQueueEnabled()` in
 * `docs.config.ts`, read by `docs.module.ts` when the file is first evaluated), so importing it
 * before `loadEnv()` has run would freeze that decision against an empty environment and the
 * worker would silently run every stage inline — the exact failure this process exists to avoid.
 * `main.ts` therefore reaches it through a dynamic `await import('./plugins')`.
 */
export const plugins = [
	/**
	 * Documents hub — drains the `docs-processing` queue: extract → classify → chunk → embed →
	 * index, plus thumbnails and the startup recovery scan. These stages run OCR, parse large
	 * binaries and call embedding providers, which is why they belong here and not in the API.
	 */
	DocsPlugin,
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
	CartPlugin
];
