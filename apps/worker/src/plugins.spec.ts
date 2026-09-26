/**
 * Each plugin named here is a full Nest module graph — entities, a BullMQ host, providers — and this
 * file needs nothing but the class identity and the prerequisites it declares, so a stub stands in for
 * each of them.
 *
 * **Each stub carries the `dependsOn` its real plugin declares**, because the list is passed through
 * `resolvePluginLoadOrder` — the real one, from `@gauzy/plugin` — and a stub that declared nothing would
 * let this suite pass with a prerequisite missing. The declarations are copied from the plugin classes
 * (`order.plugin.ts`, `cart.plugin.ts`, `inventory.plugin.ts`); `worker-composition.spec.ts` checks the
 * same list against the real classes and their real module graphs.
 */
jest.mock('@gauzy/plugin-docs', () => ({ DocsPlugin: class DocsPlugin {} }));
jest.mock('@gauzy/plugin-catalog', () => ({ CatalogPlugin: class CatalogPlugin {} }));
jest.mock('@gauzy/plugin-pricing', () => ({ PricingPlugin: class PricingPlugin {} }));
jest.mock('@gauzy/plugin-tax', () => ({ TaxPlugin: class TaxPlugin {} }));
jest.mock('@gauzy/plugin-inventory', () => {
	class InventoryPlugin {}
	Reflect.defineMetadata('dependsOn', ['@gauzy/plugin-catalog'], InventoryPlugin);
	return { InventoryPlugin };
});
jest.mock('@gauzy/plugin-cart', () => {
	const { CatalogPlugin } = jest.requireMock('@gauzy/plugin-catalog');
	const { PricingPlugin } = jest.requireMock('@gauzy/plugin-pricing');
	const { InventoryPlugin } = jest.requireMock('@gauzy/plugin-inventory');
	class CartPlugin {}
	Reflect.defineMetadata('dependsOn', [CatalogPlugin, PricingPlugin, InventoryPlugin], CartPlugin);
	return { CartPlugin };
});
jest.mock('@gauzy/plugin-order', () => {
	const { PricingPlugin } = jest.requireMock('@gauzy/plugin-pricing');
	const { TaxPlugin } = jest.requireMock('@gauzy/plugin-tax');
	class OrderPlugin {}
	Reflect.defineMetadata('dependsOn', [PricingPlugin, TaxPlugin], OrderPlugin);
	return { OrderPlugin };
});

// `Reflect.defineMetadata` in the stubs above needs the polyfill before any of them is evaluated.
import 'reflect-metadata';
import { resolvePluginLoadOrder } from '@gauzy/plugin';
import { CartPlugin } from '@gauzy/plugin-cart';
import { CatalogPlugin } from '@gauzy/plugin-catalog';
import { DocsPlugin } from '@gauzy/plugin-docs';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
import { OrderPlugin } from '@gauzy/plugin-order';
import { PricingPlugin } from '@gauzy/plugin-pricing';
import { TaxPlugin } from '@gauzy/plugin-tax';
import { plugins } from './plugins';

/** Where a plugin sits in the list the worker registers. */
const positionOf = (plugin: unknown): number => plugins.indexOf(plugin as never);

describe('worker plugins', () => {
	it('registers the Documents plugin so the docs-processing queue is drained here', () => {
		expect(plugins).toContain(DocsPlugin);
	});

	it('registers the cart, because this is the process a schedule fires in', () => {
		// A `@ScheduledJob` registers only where the scheduler root is enabled, and the API registers
		// it disabled on purpose — it hosts the queues and the workers, and this process fires the
		// schedules. The cart's expiry and abandonment passes are loaded by its own plugin, so a cart
		// plugin that is not hosted here contributes its worker and never its cron.
		expect(plugins).toContain(CartPlugin);
	});

	it('registers the order, whose two sweeps are the only thing that repairs a stale status or frees a slot', () => {
		// The same rule, and it was nearly walked into: both entries are ordinary providers of the
		// order module rather than a queue registration, so they are discovered wherever the plugin is
		// loaded — and the API loads it while skipping every schedule. A plugin hosted only by the API
		// therefore contributes nothing to the schedule at all, and every piece still looks healthy.
		expect(plugins).toContain(OrderPlugin);
	});

	it('hosts the pricing and tax plugins before the order, whose module imports both of theirs', () => {
		// The defect this pins: the order was listed alone, its module imported `PricingModule` and
		// `TaxModule`, and each of those registers repositories for tables only a LISTED plugin hands to
		// the ORM — so MikroORM refused `PricePreference` while the container was being built and the
		// worker never booted, taking the documents pipeline and every sweep down with it.
		expect(plugins).toContain(PricingPlugin);
		expect(plugins).toContain(TaxPlugin);
		expect(positionOf(PricingPlugin)).toBeLessThan(positionOf(OrderPlugin));
		expect(positionOf(TaxPlugin)).toBeLessThan(positionOf(OrderPlugin));
	});

	it('hosts every prerequisite the cart declares, ahead of the cart', () => {
		for (const prerequisite of [CatalogPlugin, PricingPlugin, InventoryPlugin]) {
			expect(plugins).toContain(prerequisite);
			expect(positionOf(prerequisite)).toBeLessThan(positionOf(CartPlugin));
		}

		// The inventory names the catalog by package rather than by class; the resolver reads both.
		expect(positionOf(CatalogPlugin)).toBeLessThan(positionOf(InventoryPlugin));
	});

	it('is the list the load-order resolver accepts, so a missing prerequisite is refused rather than booted', () => {
		// The list is ordered by `resolvePluginLoadOrder` where it is declared; resolving it again is a
		// no-op, which is what says it is already in dependency order.
		expect(resolvePluginLoadOrder(plugins)).toEqual(plugins);

		// The control: the same resolver refuses the list this file used to export, naming the plugin and
		// what it lacks — which is the message an operator now gets instead of a MikroORM metadata error.
		expect(() => resolvePluginLoadOrder([DocsPlugin, CartPlugin, OrderPlugin] as never)).toThrow(
			/requires CatalogPlugin/
		);
		expect(() =>
			resolvePluginLoadOrder([CatalogPlugin, PricingPlugin, InventoryPlugin, CartPlugin, OrderPlugin] as never)
		).toThrow(/Plugin OrderPlugin requires TaxPlugin/);
	});

	it('lists each plugin once, so no queue is registered twice in one process', () => {
		// Control: registering a plugin twice starts its BullMQ workers twice, which is two consumers
		// competing for the same jobs rather than one.
		expect(new Set(plugins).size).toBe(plugins.length);
	});
});
