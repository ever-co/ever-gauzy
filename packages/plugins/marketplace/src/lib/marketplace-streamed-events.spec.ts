/**
 * The marketplace events `Subscription.events` may select.
 *
 * The kernel's catalogue and its `declareStreamedEvents` are the real ones — a stand-in would let the suite
 * agree with itself about which names are streamable — and `@gauzy/core` is otherwise doubled at the module
 * boundary, so the declaration is exercised without booting the application graph.
 */
jest.mock('@gauzy/core', () => ({
	declareStreamedEvents: jest.requireActual('@gauzy/core/src/lib/graphql/subscriptions/plugin-subscription')
		.declareStreamedEvents,
	SubscriptionCatalogue: jest.requireActual('@gauzy/core/src/lib/graphql/subscriptions/subscription-catalogue')
		.SubscriptionCatalogue,
	GraphqlSubscriptionConsumer: class GraphqlSubscriptionConsumer {}
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SubscriptionCatalogue } from '@gauzy/core';
import { MARKETPLACE_STREAMED_EVENTS, MarketplaceStreamedEvents } from './marketplace-streamed-events';

describe('MarketplaceStreamedEvents', () => {
	it('declares every streamed marketplace event with the catalogue and has the outbox consumer listen for them', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = { register: jest.fn() };

		new MarketplaceStreamedEvents(catalogue, consumer as never).onModuleInit();

		expect(catalogue.names()).toEqual([
			'seller.activated',
			'seller.created',
			'seller.rejected',
			'seller.suspended',
			'seller.transaction.recorded',
			'seller.transaction.reversed',
			'seller.transaction.settleable',
			'seller.verified',
			'seller_offering.created',
			'seller_offering.withdrawn',
			'seller_payout.canceled',
			'seller_payout.created',
			'seller_payout.failed',
			'seller_payout.paid',
			'seller_settlement.closed',
			'seller_settlement.recorded'
		]);
		expect(consumer.register).toHaveBeenCalledTimes(1);
	});

	it('declares nothing the kernel refuses to stream, and withholds what the package keeps off the stream', () => {
		for (const name of ['commerce_cart.updated', 'price.updated', 'seller_offering.updated']) {
			expect(MARKETPLACE_STREAMED_EVENTS).not.toContain(name);
		}
	});

	it('still declares in a process with no subscription surface', () => {
		const catalogue = new SubscriptionCatalogue();

		expect(() => new MarketplaceStreamedEvents(catalogue).onModuleInit()).not.toThrow();
		expect(catalogue.size).toBe(16);
	});

	it('declares only names the package really appends to the outbox', () => {
		const appending = [
			'seller/seller.service.ts',
			'seller-offering/seller-offering.service.ts',
			'seller-payout/seller-payout.service.ts',
			'seller-settlement/seller-settlement.service.ts',
			'seller-transaction/seller-transaction.service.ts',
			'split/seller-split.service.ts'
		]
			.map((file) => readFileSync(join(__dirname, file), 'utf8'))
			.join('\n');

		for (const name of MARKETPLACE_STREAMED_EVENTS) {
			expect(appending).toContain(`'${name}'`);
		}
	});
});
