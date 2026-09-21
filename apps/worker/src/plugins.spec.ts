/**
 * Each plugin named here is a full Nest module graph — entities, a BullMQ host, providers — and this
 * file needs nothing but the class identity, so a stub stands in for each of them.
 */
jest.mock('@gauzy/plugin-docs', () => ({ DocsPlugin: class DocsPlugin {} }));
jest.mock('@gauzy/plugin-cart', () => ({ CartPlugin: class CartPlugin {} }));

import { CartPlugin } from '@gauzy/plugin-cart';
import { DocsPlugin } from '@gauzy/plugin-docs';
import { plugins } from './plugins';

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

	it('lists each plugin once, so no queue is registered twice in one process', () => {
		// Control: registering a plugin twice starts its BullMQ workers twice, which is two consumers
		// competing for the same jobs rather than one.
		expect(new Set(plugins).size).toBe(plugins.length);
	});
});
