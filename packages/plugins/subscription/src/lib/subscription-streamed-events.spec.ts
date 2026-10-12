/**
 * The subscription events `Subscription.events` may select.
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
import { SUBSCRIPTION_STREAMED_EVENTS, SubscriptionStreamedEvents } from './subscription-streamed-events';

describe('SubscriptionStreamedEvents', () => {
	it('declares every streamed subscription event with the catalogue and has the outbox consumer listen for them', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = { register: jest.fn() };

		new SubscriptionStreamedEvents(catalogue, consumer as never).onModuleInit();

		expect(catalogue.names()).toEqual([
			'subscription.activated',
			'subscription.canceled',
			'subscription.created',
			'subscription.expired',
			'subscription.paused',
			'subscription.payment-failed',
			'subscription.renewed',
			'subscription.resumed'
		]);
		expect(consumer.register).toHaveBeenCalledTimes(1);
	});

	it('declares nothing the kernel refuses to stream, and withholds what the package keeps off the stream', () => {
		for (const name of ['commerce_cart.updated', 'price.updated']) {
			expect(SUBSCRIPTION_STREAMED_EVENTS).not.toContain(name);
		}
	});

	it('still declares in a process with no subscription surface', () => {
		const catalogue = new SubscriptionCatalogue();

		expect(() => new SubscriptionStreamedEvents(catalogue).onModuleInit()).not.toThrow();
		expect(catalogue.size).toBe(8);
	});

	it('declares only names the package really appends to the outbox', () => {
		const appending = ['subscription/subscription.service.ts']
			.map((file) => readFileSync(join(__dirname, file), 'utf8'))
			.join('\n');

		for (const name of SUBSCRIPTION_STREAMED_EVENTS) {
			expect(appending).toContain(`'${name}'`);
		}
	});
});
