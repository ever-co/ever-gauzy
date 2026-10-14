/**
 * The entitlement events `Subscription.events` may select.
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
import { ENTITLEMENT_STREAMED_EVENTS, EntitlementStreamedEvents } from './entitlement-streamed-events';

describe('EntitlementStreamedEvents', () => {
	it('declares every streamed entitlement event with the catalogue and has the outbox consumer listen for them', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = { register: jest.fn() };

		new EntitlementStreamedEvents(catalogue, consumer as never).onModuleInit();

		expect(catalogue.names()).toEqual([
			'entitlement.activated',
			'entitlement.created',
			'entitlement.deactivated',
			'entitlement.expired',
			'entitlement.reduced',
			'entitlement.renewed',
			'entitlement.revoked',
			'entitlement.suspended',
			'entitlement_key.revoked'
		]);
		expect(consumer.register).toHaveBeenCalledTimes(1);
	});

	it('declares nothing the kernel refuses to stream, and withholds what the package keeps off the stream', () => {
		for (const name of ['commerce_cart.updated', 'price.updated', 'entitlement_key.issued']) {
			expect(ENTITLEMENT_STREAMED_EVENTS).not.toContain(name);
		}
	});

	it('still declares in a process with no subscription surface', () => {
		const catalogue = new SubscriptionCatalogue();

		expect(() => new EntitlementStreamedEvents(catalogue).onModuleInit()).not.toThrow();
		expect(catalogue.size).toBe(9);
	});

	it('declares only names the package really appends to the outbox', () => {
		const appending = ['entitlement.types.ts']
			.map((file) => readFileSync(join(__dirname, file), 'utf8'))
			.join('\n');

		for (const name of ENTITLEMENT_STREAMED_EVENTS) {
			expect(appending).toContain(`'${name}'`);
		}
	});
});
