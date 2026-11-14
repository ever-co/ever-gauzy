// Must stay first: the entities barrel resolves the circular entity imports.
import '../../core/entities/internal';

import { PublicInvoiceController } from './public-invoice.controller';

/** The per-address limit a route's `@Throttle` sets, if any. */
function throttleLimitOf(handler: object): number | undefined {
	const limitKey = Reflect.getMetadataKeys(handler).find(
		(key) => typeof key === 'string' && key.startsWith('THROTTLER:LIMIT')
	);
	return limitKey ? Reflect.getMetadata(limitKey, handler) : undefined;
}

/**
 * Each answer from the estimate link that changes the estimate tells the team: every invoice handler in-app, and the
 * estimate's creator by email. A link holder flipping the answer between accepted and declined would tell them every
 * time, so the answer route is held to a per-address budget of its own, where throttling is on (`THROTTLE_ENABLED`).
 */
describe('PublicInvoiceController', () => {
	it('takes an answer to an estimate within a per-address budget of its own', () => {
		expect(throttleLimitOf(PublicInvoiceController.prototype.updateInvoiceByEstimateEmailToken)).toBe(5);
	});

	it("leaves reading a shared invoice to the deployment's budget", () => {
		expect(throttleLimitOf(PublicInvoiceController.prototype.findOneByPublicLink)).toBeUndefined();
	});
});
