import { resolvePluginLoadOrder } from '@gauzy/plugin';
import { CartPlugin } from '@gauzy/plugin-cart';
import { CatalogPlugin } from '@gauzy/plugin-catalog';
import { DocsPlugin } from '@gauzy/plugin-docs';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
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
	OrderPlugin
]);
