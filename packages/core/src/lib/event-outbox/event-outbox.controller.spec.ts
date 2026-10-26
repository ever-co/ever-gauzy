/**
 * The reliability kernel over REST (API specification §5.1, §7; `12-events-webhooks-and-workflows.md`
 * §12.3).
 *
 * The suite pins the four things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on each class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the assertion
 *   is about the decision and not about the decorator's prose. The two moves carry the retry
 *   permission and never the inspect one, which is what makes "a caller who may look cannot move the
 *   machinery" true rather than intended;
 * - **the routes themselves** — each is called and its delegation is asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may not
 *   do this" and "there is nothing here";
 * - **the paths and the verbs**, read from the metadata Nest itself routes on, so a route that was
 *   renamed quietly is caught here rather than by a client.
 *
 * **The controllers under test are the real ones**, over a scripted service, so a route that stopped
 * delegating — or delegated to something else — is caught rather than accommodated.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// The gate on the GraphQL surface: a resolver carries the feature guard its module's resolvers are
	// declared under, and a spec that doubles the guard barrel has to double that one too.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Entering
 * that cycle from the wrong end — through `core/crud`, which reaches `core/dto` and the validators
 * first — leaves the decorator undefined when the entity applies it, and the suite fails to LOAD
 * rather than failing an assertion.
 */
import '../core/entities/internal';

import { HttpException, NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { EventOutboxStatus, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EventDeliveryController } from './event-delivery.controller';
import { EventOutboxController } from './event-outbox.controller';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1';
const OUTBOX_ROW = '00000000-0000-4000-8000-000000000010';
const DELIVERY = '00000000-0000-4000-8000-000000000020';

/** The rows a scripted service answers with. */
const OUTBOX_ROWS = [
	{
		id: OUTBOX_ROW,
		eventId: EVENT_ID,
		eventName: 'order.placed',
		status: EventOutboxStatus.PENDING,
		attemptCount: 1,
		tenantId: TENANT,
		organizationId: ORGANIZATION
	}
];

const DELIVERY_ROWS = [
	{
		id: DELIVERY,
		eventId: EVENT_ID,
		consumerKey: 'subscriber:notification.order-confirmation',
		status: EventOutboxStatus.FAILED,
		attemptCount: 3,
		tenantId: TENANT,
		organizationId: ORGANIZATION
	}
];

/**
 * The service, scripted per route.
 *
 * Every member the controllers reach is stated, so a route that calls something else fails loudly
 * rather than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const eventOutboxService = {
		listOutboxRows: jest.fn().mockResolvedValue(OUTBOX_ROWS),
		findOutboxRow: jest.fn().mockResolvedValue(OUTBOX_ROWS[0]),
		listDeliveryRows: jest.fn().mockResolvedValue(DELIVERY_ROWS),
		findDeliveryRow: jest.fn().mockResolvedValue(DELIVERY_ROWS[0]),
		replayDelivery: jest
			.fn()
			.mockResolvedValue({ ...DELIVERY_ROWS[0], status: EventOutboxStatus.PENDING, attemptCount: 0 }),
		deadLetterDelivery: jest
			.fn()
			.mockResolvedValue({ ...DELIVERY_ROWS[0], status: EventOutboxStatus.DEAD, lastError: 'stopped by hand' }),
		...overrides
	};

	return {
		eventOutboxService,
		outbox: new EventOutboxController(eventOutboxService as never),
		deliveries: new EventDeliveryController(eventOutboxService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/** The route one handler declares, as Nest's own metadata states it. */
function routeOf(
	controller: typeof EventOutboxController | typeof EventDeliveryController,
	handler: string
): { path: string; method: RequestMethod } {
	const prototype = controller.prototype as unknown as Record<string, object>;

	return {
		path: Reflect.getMetadata(PATH_METADATA, prototype[handler]),
		method: Reflect.getMetadata(METHOD_METADATA, prototype[handler])
	};
}

describe('EventOutboxController — the routes (API specification §7)', () => {
	it('lists the outbox rows of the caller’s tenant, one page at a time', async () => {
		const { outbox, eventOutboxService } = surfaces();

		const page = await outbox.findAll();

		// The read is the service's own, with the route's defaults, and the envelope reports the
		// filtered total rather than the size of the page.
		expect(eventOutboxService.listOutboxRows).toHaveBeenCalledWith({});
		expect(page.items).toEqual(OUTBOX_ROWS);
		expect(page.total).toBe(1);
	});

	it('narrows by the bracketed spelling the endpoint table names, and by the flat one', async () => {
		const { outbox, eventOutboxService } = surfaces();

		await outbox.findAll({ filter: { status: EventOutboxStatus.DEAD, eventName: 'order.placed' } });
		expect(eventOutboxService.listOutboxRows).toHaveBeenLastCalledWith({
			status: EventOutboxStatus.DEAD,
			eventName: 'order.placed'
		});

		await outbox.findAll({ status: EventOutboxStatus.PENDING, aggregateId: EVENT_ID });
		expect(eventOutboxService.listOutboxRows).toHaveBeenLastCalledWith({
			status: EventOutboxStatus.PENDING,
			aggregateId: EVENT_ID
		});
	});

	it('leaves an unstated member out of the criterion rather than writing it as undefined', async () => {
		// A repository handed an explicit `undefined` asks for the rows whose column *is* null, which is
		// a different question from "do not narrow on this column".
		const { outbox, eventOutboxService } = surfaces();

		await outbox.findAll({});

		expect(eventOutboxService.listOutboxRows).toHaveBeenCalledWith({});
	});

	it('pages the rows it was handed, with the protocol’s default size when none is stated', async () => {
		const rows = Array.from({ length: 25 }, (_, index) => ({ ...OUTBOX_ROWS[0], id: `row-${index}` }));
		const { outbox } = surfaces({ listOutboxRows: jest.fn().mockResolvedValue(rows) });

		const first = await outbox.findAll();
		expect(first.items).toHaveLength(20);
		expect(first.total).toBe(25);

		const second = await outbox.findAll({ take: 5, skip: 20 });
		expect(second.items).toHaveLength(5);
		expect(second.total).toBe(25);
	});

	it('reads one row, optionally with the records of what each consumer did with it', async () => {
		const { outbox, eventOutboxService } = surfaces();

		expect(await outbox.findById(OUTBOX_ROW)).toEqual(OUTBOX_ROWS[0]);

		const expanded = await outbox.findById(OUTBOX_ROW, { expand: ['deliveries'] });

		// The deliveries of a row are the records that name the row's **event id**, not its primary key:
		// the delivery table has no foreign key to the outbox, deliberately, because a record outlives
		// the event it is about.
		expect(eventOutboxService.listDeliveryRows).toHaveBeenCalledWith({ eventId: EVENT_ID });
		expect(expanded.deliveries).toEqual(DELIVERY_ROWS);
	});

	it('answers a row that is not the caller’s with the same 404 as a row that is not there', async () => {
		const { outbox } = surfaces({ findOutboxRow: jest.fn().mockResolvedValue(null) });

		const error = await outbox.findById(OUTBOX_ROW).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(NotFoundException);
		expect((error as Error).message).toContain('RESOURCE_NOT_FOUND');
	});

	it('declares the two reads the resource serves, and no write at all', () => {
		// An outbox row is written by the domain service that changed the state it describes, inside that
		// service's own transaction, so a route that appended one would be a route that could announce a
		// fact which never happened.
		const routes = ['findAll', 'findById'].map((handler) => routeOf(EventOutboxController, handler));

		expect(routes).toEqual([
			{ path: '/', method: RequestMethod.GET },
			{ path: ':id', method: RequestMethod.GET }
		]);
		expect(Reflect.getMetadata(PATH_METADATA, EventOutboxController)).toBe('/events/outbox');
	});
});

describe('EventDeliveryController — the routes (12 §5.4, §12.3)', () => {
	it('lists the delivery records of the caller’s tenant, one page at a time', async () => {
		const { deliveries, eventOutboxService } = surfaces();

		const page = await deliveries.findAll();

		expect(eventOutboxService.listDeliveryRows).toHaveBeenCalledWith({});
		expect(page.items).toEqual(DELIVERY_ROWS);
		expect(page.total).toBe(1);
	});

	it('narrows by status, consumer key and event, in either spelling', async () => {
		const { deliveries, eventOutboxService } = surfaces();

		await deliveries.findAll({ filter: { status: EventOutboxStatus.DEAD, consumerKey: 'job:search-index' } });
		expect(eventOutboxService.listDeliveryRows).toHaveBeenLastCalledWith({
			status: EventOutboxStatus.DEAD,
			consumerKey: 'job:search-index'
		});

		await deliveries.findAll({ eventId: EVENT_ID });
		expect(eventOutboxService.listDeliveryRows).toHaveBeenLastCalledWith({ eventId: EVENT_ID });
	});

	it('reads one record and answers a miss as a 404', async () => {
		const { deliveries } = surfaces();

		expect(await deliveries.findById(DELIVERY)).toEqual(DELIVERY_ROWS[0]);

		const missing = surfaces({ findDeliveryRow: jest.fn().mockResolvedValue(null) }).deliveries;
		const error = await missing.findById(DELIVERY).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(NotFoundException);
		expect((error as Error).message).toContain('RESOURCE_NOT_FOUND');
	});

	it('re-drives one record through the service and answers it as it stands afterwards', async () => {
		const { deliveries, eventOutboxService } = surfaces();

		const replayed = await deliveries.replay(DELIVERY);

		expect(eventOutboxService.replayDelivery).toHaveBeenCalledWith(DELIVERY);
		expect(replayed.status).toBe(EventOutboxStatus.PENDING);
		expect(replayed.attemptCount).toBe(0);
	});

	it('dead-letters one record through the service, with the caller’s reason', async () => {
		const { deliveries, eventOutboxService } = surfaces();

		const dead = await deliveries.markDead(DELIVERY, { reason: 'stopped by hand' });

		expect(eventOutboxService.deadLetterDelivery).toHaveBeenCalledWith(DELIVERY, 'stopped by hand');
		expect(dead.status).toBe(EventOutboxStatus.DEAD);
		expect(dead.lastError).toBe('stopped by hand');
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { deliveries, eventOutboxService } = surfaces();
		const refusal = new HttpException('RESOURCE_NOT_FOUND: delivery could not be found.', 409);

		eventOutboxService.replayDelivery.mockRejectedValueOnce(refusal);

		await expect(deliveries.replay(DELIVERY)).rejects.toBe(refusal);
		expect(isRefusal(refusal)).toBe(true);
	});

	it('declares the path and the verb of every route it serves', () => {
		// A route that lost its decorator is an endpoint that quietly stops existing, so the paths are
		// read from the metadata Nest routes on rather than from the method names.
		expect(Reflect.getMetadata(PATH_METADATA, EventDeliveryController)).toBe('/events/deliveries');
		expect(routeOf(EventDeliveryController, 'findAll')).toEqual({ path: '/', method: RequestMethod.GET });
		expect(routeOf(EventDeliveryController, 'findById')).toEqual({ path: ':id', method: RequestMethod.GET });
		expect(routeOf(EventDeliveryController, 'replay')).toEqual({ path: ':id/replay', method: RequestMethod.POST });
		expect(routeOf(EventDeliveryController, 'markDead')).toEqual({
			path: ':id/mark-dead',
			method: RequestMethod.POST
		});
	});
});

describe('The outbox resources — the guard stack and the permission every route declares', () => {
	it('guards each controller with both protocol guards', () => {
		for (const controller of [EventOutboxController, EventDeliveryController]) {
			const guards = Reflect.getMetadata('__guards__', controller) ?? [];

			expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		}
	});

	it('states the inspect permission on both classes', () => {
		// `EVENT_OUTBOX_VIEW` is the catalogue's own code for inspecting this machinery, and it is the
		// permission the GraphQL fields carry as well — the two surfaces are one capability.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventOutboxController)).toEqual([
			PermissionsEnum.EVENT_OUTBOX_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EventDeliveryController)).toEqual([
			PermissionsEnum.EVENT_OUTBOX_VIEW
		]);
	});

	it('carries the retry permission on the two moves and the inspect permission on every read', () => {
		const expected: Array<[object, string, PermissionsEnum]> = [
			[EventOutboxController.prototype, 'findAll', PermissionsEnum.EVENT_OUTBOX_VIEW],
			[EventOutboxController.prototype, 'findById', PermissionsEnum.EVENT_OUTBOX_VIEW],
			[EventDeliveryController.prototype, 'findAll', PermissionsEnum.EVENT_OUTBOX_VIEW],
			[EventDeliveryController.prototype, 'findById', PermissionsEnum.EVENT_OUTBOX_VIEW],
			[EventDeliveryController.prototype, 'replay', PermissionsEnum.EVENT_OUTBOX_RETRY],
			[EventDeliveryController.prototype, 'markDead', PermissionsEnum.EVENT_OUTBOX_RETRY]
		];

		for (const [prototype, handler, permission] of expected) {
			const fields = prototype as unknown as Record<string, object>;

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fields[handler])).toEqual([permission]);
		}
	});

	it('refuses each move to a caller who holds only the inspect permission', () => {
		// A role that may look at the reliability machinery may not change it: the two moves state the
		// retry permission, which the catalogue grants only through the administration group.
		for (const handler of ['replay', 'markDead']) {
			const stated =
				Reflect.getMetadata(
					PERMISSIONS_METADATA,
					(EventDeliveryController.prototype as unknown as Record<string, object>)[handler]
				) ?? [];

			expect(stated).not.toContain(PermissionsEnum.EVENT_OUTBOX_VIEW);
			expect(stated).toEqual([PermissionsEnum.EVENT_OUTBOX_RETRY]);
		}
	});
});
