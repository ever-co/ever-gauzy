/**
 * The warehouse events `Subscription.events` may select.
 *
 * The kernel's catalogue and its `declareStreamedEvents` are the real ones — a stand-in would let the suite agree with
 * itself about which names are streamable — and `@gauzy/core` is otherwise doubled at the module boundary, so the
 * declaration is exercised without booting the application graph.
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
import { PICK_LIST_EVENTS } from './warehouse.types';
import { WAREHOUSE_STREAMED_EVENTS, WarehouseStreamedEvents } from './warehouse-streamed-events';

describe('WarehouseStreamedEvents', () => {
	it('declares every pick-list move with the catalogue and has the outbox consumer listen for them', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = { register: jest.fn() };

		new WarehouseStreamedEvents(catalogue, consumer as never).onModuleInit();

		expect(catalogue.names()).toEqual([
			'pick_list.assigned',
			'pick_list.canceled',
			'pick_list.created',
			'pick_list.picked',
			'pick_list.started'
		]);
		expect(consumer.register).toHaveBeenCalledTimes(1);
	});

	it('still declares in a process with no subscription surface', () => {
		const catalogue = new SubscriptionCatalogue();

		expect(() => new WarehouseStreamedEvents(catalogue).onModuleInit()).not.toThrow();
		expect(catalogue.size).toBe(5);
	});

	it('declares exactly the names the pick-list service appends, and the service appends each of them', () => {
		expect([...WAREHOUSE_STREAMED_EVENTS].sort()).toEqual(Object.values(PICK_LIST_EVENTS).sort());

		const appending = readFileSync(join(__dirname, 'pick-list', 'pick-list.service.ts'), 'utf8');
		for (const key of Object.keys(PICK_LIST_EVENTS)) {
			expect(appending).toContain(`PICK_LIST_EVENTS.${key}`);
		}
	});
});
