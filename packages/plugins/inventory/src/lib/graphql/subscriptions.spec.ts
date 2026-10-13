/**
 * The inventory streams, held to the subscriber's tenant.
 *
 * The five stock streams read the in-process bus. The level streams narrowed on the location and the
 * variant their arguments named and on nothing else; the reservation and transfer streams did not narrow
 * at all. A subscriber holding the view grant was therefore handed every tenant's levels, holds and
 * transfers. The cases below open each stream as a user of tenant A and publish as a user of tenant B —
 * the way a write of another tenant reaches the bus in the running API, inside that tenant's request —
 * and assert that the subscriber hears its own tenant's fact and nothing of the other's.
 *
 * **Nothing is doubled but the services**, which the streams never call: the resolvers, the bus, the
 * kernel's stream and `RequestContext` over a real CLS store are the real ones.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { SUBSCRIPTION_OPTIONS_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { isObservable, Observable } from 'rxjs';
import { deliverPayloadAsIs, EventBus, observableToAsyncIterable, RequestContext } from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import {
	InventoryLevelChangedEvent,
	InventoryLevelLowEvent,
	InventoryLevelOutOfStockEvent,
	StockReservationChangedEvent,
	StockTransferChangedEvent
} from './../events';
import { StockLevelResolver } from './stock-level.resolver';
import { StockReservationResolver } from './stock-reservation.resolver';
import { StockTransferResolver } from './stock-transfer.resolver';

type Row = Record<string, any>;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ORG_A = 'organization-a';
const ORG_B = 'organization-b';
const WAREHOUSE = 'warehouse-1';
const VARIANT = 'variant-1';

/** Runs work as a signed-in user of one tenant and organization. */
const as = <T>(tenantId: string, organizationId: string, work: () => T): T =>
	RequestContext.runWithRequest(
		{ user: { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } } as never,
		work
	);

/**
 * Opens a stream the way graphql-js does: the field is resolved as the subscriber, and the iterator is
 * taken from it at once — before any event is published.
 *
 * The streams these fields answered with before were rxjs observables, which graphql-js refuses outright;
 * one is read here through the kernel's adapter, so the suite shows what such a stream carried rather
 * than only that it could not be served.
 */
const subscribe = (tenantId: string, organizationId: string, open: () => unknown): AsyncIterator<unknown> =>
	as(tenantId, organizationId, () => {
		const stream = open() as AsyncIterable<unknown> | Observable<unknown>;
		return isObservable(stream) ? observableToAsyncIterable(stream) : stream[Symbol.asyncIterator]();
	});

/** Everything an opened stream delivers until it has been quiet for a moment. */
const delivered = async (iterator: AsyncIterator<unknown>, quietMs = 100): Promise<unknown[]> => {
	const values: unknown[] = [];

	for (;;) {
		let timer: NodeJS.Timeout | undefined;
		const quiet = new Promise<'quiet'>((resolve) => (timer = setTimeout(() => resolve('quiet'), quietMs)));
		const next = await Promise.race([iterator.next(), quiet]);
		clearTimeout(timer);

		if (next === 'quiet' || next.done) {
			break;
		}

		values.push(next.value);
	}

	await iterator.return?.();
	return values;
};

/** The same location and variant in two tenants: ids are not an owner, which is the point. */
const level = (availableQuantity: number) => ({
	levelId: `level-${availableQuantity}`,
	warehouseId: WAREHOUSE,
	variantId: VARIANT,
	availableQuantity
});

describe('the inventory subscriptions, scoped to the subscriber', () => {
	const originalClsService = RequestContext['clsService'];
	let bus: EventBus;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		bus = new EventBus();
	});

	describe.each([
		['stockLevelChanged', InventoryLevelChangedEvent],
		['stockLevelLow', InventoryLevelLowEvent],
		['stockLevelOutOfStock', InventoryLevelOutOfStockEvent]
	] as const)('%s', (field, Event) => {
		it("delivers a subscriber its own tenant's level and nothing of another tenant's", async () => {
			const resolver = new StockLevelResolver({} as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => (resolver as any)[field](WAREHOUSE));

			await as(TENANT_B, ORG_B, () => bus.publish(new Event(level(2) as never, TENANT_B, ORG_B)));
			await as(TENANT_A, ORG_A, () => bus.publish(new Event(level(1) as never, TENANT_A, ORG_A)));

			expect(await delivered(stream)).toEqual([level(1)]);
		});

		it('delivers a level that states no tenant to nobody', async () => {
			const resolver = new StockLevelResolver({} as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => (resolver as any)[field]());

			await as(TENANT_A, ORG_A, () => bus.publish(new Event(level(1) as never)));

			expect(await delivered(stream)).toEqual([]);
		});

		it('states the view grant and delivers the availability as the payload', () => {
			const handler = (StockLevelResolver.prototype as any)[field];

			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handler) ??
					Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelResolver)
			).toEqual([InventoryPermission.STOCK_VIEW]);
			expect(Reflect.getMetadata(SUBSCRIPTION_OPTIONS_METADATA, handler)?.resolve).toBe(deliverPayloadAsIs);
		});
	});

	describe('stockReservationChanged', () => {
		const hold = (tenantId: string, organizationId: string, referenceId = 'order-1'): Row => ({
			id: `hold-${tenantId}`,
			referenceId,
			tenantId,
			organizationId
		});

		it("delivers a subscriber its own tenant's hold and nothing of another tenant's", async () => {
			const resolver = new StockReservationResolver({} as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.stockReservationChanged(undefined as never));

			await as(TENANT_B, ORG_B, () =>
				bus.publish(new StockReservationChangedEvent(hold(TENANT_B, ORG_B) as never))
			);
			await as(TENANT_A, ORG_A, () =>
				bus.publish(new StockReservationChangedEvent(hold(TENANT_A, ORG_A) as never))
			);

			expect(await delivered(stream)).toEqual([hold(TENANT_A, ORG_A)]);
		});

		it('narrows to the document the subscriber named', async () => {
			const resolver = new StockReservationResolver({} as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.stockReservationChanged('order-2'));

			await as(TENANT_A, ORG_A, () =>
				bus.publish(new StockReservationChangedEvent(hold(TENANT_A, ORG_A) as never))
			);
			await as(TENANT_A, ORG_A, () =>
				bus.publish(new StockReservationChangedEvent(hold(TENANT_A, ORG_A, 'order-2') as never))
			);

			expect(await delivered(stream)).toEqual([hold(TENANT_A, ORG_A, 'order-2')]);
		});

		it('delivers the hold as the payload', () => {
			expect(
				Reflect.getMetadata(
					SUBSCRIPTION_OPTIONS_METADATA,
					StockReservationResolver.prototype.stockReservationChanged
				)?.resolve
			).toBe(deliverPayloadAsIs);
		});
	});

	describe('stockTransferChanged', () => {
		const transfer = (id: string, tenantId: string, organizationId: string): Row => ({
			id,
			tenantId,
			organizationId
		});

		it("delivers a subscriber its own tenant's transfer and nothing of another tenant's", async () => {
			const resolver = new StockTransferResolver({} as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.stockTransferChanged(undefined as never));

			await as(TENANT_B, ORG_B, () =>
				bus.publish(new StockTransferChangedEvent(transfer('transfer-b', TENANT_B, ORG_B) as never))
			);
			await as(TENANT_A, ORG_A, () =>
				bus.publish(new StockTransferChangedEvent(transfer('transfer-a', TENANT_A, ORG_A) as never))
			);

			expect(await delivered(stream)).toEqual([transfer('transfer-a', TENANT_A, ORG_A)]);
		});

		it("delivers nothing of another tenant's to a subscriber that named that tenant's transfer", async () => {
			const resolver = new StockTransferResolver({} as never, bus);
			const stream = subscribe(TENANT_A, ORG_A, () => resolver.stockTransferChanged('transfer-b'));

			await as(TENANT_B, ORG_B, () =>
				bus.publish(new StockTransferChangedEvent(transfer('transfer-b', TENANT_B, ORG_B) as never))
			);

			expect(await delivered(stream)).toEqual([]);
		});
	});

	it('refuses to open a stream for an operation with no tenant', () => {
		expect(() => new StockLevelResolver({} as never, bus).stockLevelChanged(WAREHOUSE, VARIANT)).toThrow(
			'no tenant'
		);
	});
});
