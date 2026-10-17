/**
 * The fulfillment events `Subscription.events` may select.
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
import { FULFILLMENT_STREAMED_EVENTS, FulfillmentStreamedEvents } from './fulfillment-streamed-events';

describe('FulfillmentStreamedEvents', () => {
	it('declares every streamed fulfillment event with the catalogue and has the outbox consumer listen for them', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = { register: jest.fn() };

		new FulfillmentStreamedEvents(catalogue, consumer as never).onModuleInit();

		expect(catalogue.names()).toEqual([
			'fulfillment.canceled',
			'fulfillment.created',
			'fulfillment.delivered',
			'fulfillment.in_transit',
			'fulfillment.shipped'
		]);
		expect(consumer.register).toHaveBeenCalledTimes(1);
	});

	it('declares nothing the kernel refuses to stream, and withholds what the package keeps off the stream', () => {
		for (const name of ['commerce_cart.updated', 'price.updated']) {
			expect(FULFILLMENT_STREAMED_EVENTS).not.toContain(name);
		}
	});

	it('still declares in a process with no subscription surface', () => {
		const catalogue = new SubscriptionCatalogue();

		expect(() => new FulfillmentStreamedEvents(catalogue).onModuleInit()).not.toThrow();
		expect(catalogue.size).toBe(5);
	});

	it('declares only names the package really appends to the outbox', () => {
		const appending = ['fulfillment.types.ts']
			.map((file) => readFileSync(join(__dirname, file), 'utf8'))
			.join('\n');

		for (const name of FULFILLMENT_STREAMED_EVENTS) {
			expect(appending).toContain(`'${name}'`);
		}
	});
});
