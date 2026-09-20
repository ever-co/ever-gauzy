/**
 * The module boundaries are doubled for the reason the package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel — and its nested `uuid` is ESM-only, so reading
 * one entity under jest fails — and `@gauzy/common` is read by the feature-flag decorator. Neither is
 * something a return resource needs.
 *
 * **The two conventions this suite is about are the platform's own.** `Idempotent`, `Versioned`, the
 * guard that refuses a stale write, the interceptor that publishes the version and the conditional
 * write they act on are all pulled from the kernel's own modules, so the declaration a route carries
 * and the decision made from it are the platform's rather than this suite's. Only the key store is an
 * in-memory double of the kernel service — the interceptor calls three methods on it and reads one
 * outcome vocabulary, which is the whole of that seam.
 *
 * The resource under test is the real one: the return controller with its own decorators and its own
 * signature, driven through the guard-and-interceptor chain the application runs, over a stubbed
 * service. Where the write itself is concerned — the conditional update, the version it is predicated
 * on and the conflict it answers — the service's own specification is the place that pins it, because
 * that is the layer the statement lives in.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	// The kernel's own declarations and its conditional write, so the cases below assert the platform
	// rather than a restatement of it.
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, as a class the controller can extend: its own routes are not what this suite pins. */
	class CrudController {
		constructor(protected readonly crudService: unknown) {}
	}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		// The soft-delete and recover routes construct this pipe at class-definition time, so the
		// double has to export the class those routes build.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
		// The platform's decorator is `UsePipes(new ValidationPipe(options))`, so the double is that same
		// line rather than a no-op.
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		Versioned: versioned.Versioned,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/common',
	() => ({
		FeatureFlag: () => () => undefined
	}),
	{ virtual: true }
);

/**
 * The interceptor names `IdempotencyService` as its injected dependency, and a class used in a
 * constructor signature is emitted as a value — so the interceptor cannot be loaded without the
 * service module, whose own import chain is the whole core entity graph. The service is doubled at its
 * own module: the interceptor under test is the real one, and the store it calls is the in-memory
 * double the cases below hand it.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { VersionGuard } from '@gauzy/core/src/lib/concurrency/version.guard';
import { VersionInterceptor } from '@gauzy/core/src/lib/concurrency/version.interceptor';
import { VERSIONED_METADATA_KEY } from '@gauzy/core/src/lib/concurrency/version.util';
import { OrderReturnController } from './order-return.controller';
import { OrderReturnService } from './order-return.service';
import { OrderReturnStatus } from '../returns.types';

/**
 * The return resource's retry-safety and optimistic-concurrency contract.
 *
 * A return is goods and money moving, so the suite pins the two properties the whole mechanism exists
 * for: **one key, one receipt**, and **no write over a version the caller never saw**.
 *
 * - the route that receives goods requires a retry key, and the route that requests a return honours
 *   one when it is presented;
 * - a request without a key is refused with `IDEMPOTENCY_KEY_REQUIRED` before the service is reached;
 * - the same key with the same body replays the first answer and does not receive twice;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, and neither body is
 *   applied;
 * - a route that declares no scope is untouched: no key is read, nothing is claimed and the handler
 *   runs exactly as it did before the convention existed;
 * - every write states the version it read, a write that states none is refused with
 *   `VERSION_REQUIRED`, and one that states a version the return has moved past is refused with
 *   `ENTITY_VERSION_CONFLICT` before the handler runs;
 * - a write's answer carries the version it left behind, published as the entity tag the next write is
 *   conditioned on;
 * - a read states no version and is not refused for one, which is what makes the version readable in
 *   the first place.
 *
 * The guard, the interceptors, the plan they decide from and the refusals they throw are the
 * platform's own; only the request, the response, the key store and the service are doubles.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const RETURN = '00000000-0000-4000-8000-0000000000e1';
const LINE = '00000000-0000-4000-8000-0000000000e2';
const RECEIVE_KEY = 'return-receive-0001';
const OTHER_KEY = 'return-receive-0002';

/**
 * The key store, doubled in memory.
 *
 * The interceptor reads one vocabulary from it — a first claim, a replay of the stored response, a key
 * already used for a different request, and a claim still held by another request — so the double
 * answers that vocabulary, keyed the way the kernel keys a row: by scope, by key and within the
 * caller's own tenant and organization.
 */
function keyStore() {
	const rows = new Map<string, any>();
	let sequence = 0;

	const byId = (id: string) => [...rows.values()].find((row) => row.id === id);

	return {
		rows,
		claim: jest.fn(async (input: any) => {
			const identity = `${input.scope}:${input.key}`;
			const existing = rows.get(identity);

			if (existing) {
				if (existing.requestHash !== input.requestHash) {
					return { outcome: 'REUSED_KEY', record: existing };
				}

				return {
					outcome: 'REPLAYED',
					record: existing,
					response: { status: existing.responseStatus, body: existing.responseBody }
				};
			}

			const record = { id: `key-${++sequence}`, ...input, status: 'IN_PROGRESS' };
			rows.set(identity, record);

			return { outcome: 'CLAIMED', record };
		}),
		complete: jest.fn(async (id: string, completion: any) =>
			Object.assign(byId(id), {
				status: 'COMPLETED',
				responseStatus: completion.responseStatus,
				responseBody: completion.responseBody,
				resourceType: completion.resourceType,
				resourceId: completion.resourceId
			})
		),
		fail: jest.fn(async (id: string, completion: any) =>
			Object.assign(byId(id), { status: 'FAILED', responseStatus: completion.responseStatus })
		)
	};
}

/** A response double, recording what an interceptor wrote onto it. */
function responseDouble() {
	return {
		headers: {} as Record<string, string>,
		statuses: [] as number[],
		setHeader(name: string, value: string) {
			this.headers[name] = value;
		},
		status(code: number) {
			this.statuses.push(code);

			return this;
		}
	};
}

type ResponseDouble = ReturnType<typeof responseDouble>;

/** One request as the transport hands it to a guard and an interceptor. */
interface RequestDouble {
	method: string;
	originalUrl: string;
	params: Record<string, string>;
	query: Record<string, unknown>;
	body: any;
	headers: Record<string, string>;
}

/** What the return holds when the request is made, which the guard reads the version from. */
const returnRow = (overrides: Record<string, unknown> = {}) => ({
	id: RETURN,
	tenantId: TENANT,
	organizationId: ORG,
	number: 'RET-000001',
	status: OrderReturnStatus.APPROVED,
	currency: 'USD',
	version: 3,
	...overrides
});

/**
 * The resource over a stubbed service and one in-memory key store.
 *
 * The service is a double because the guarded and intercepted chain is what this suite pins; it
 * answers the payload a receipt produces, carrying the version the write would have left behind.
 */
function resource(row: Record<string, unknown> = returnRow()) {
	const service = {
		create: jest.fn(async (entity: any) => ({ ...row, ...entity })),
		receive: jest.fn(async () => ({
			returnId: RETURN,
			status: OrderReturnStatus.RECEIVED,
			version: 4,
			movementIds: ['movement-1'],
			receivedQuantity: '5.000000',
			outstandingQuantity: '0.000000'
		})),
		approve: jest.fn(async () => ({ ...row, status: OrderReturnStatus.APPROVED, version: 4 })),
		reject: jest.fn(async () => ({ ...row, status: OrderReturnStatus.REJECTED, version: 4 })),
		cancel: jest.fn(async () => ({ ...row, status: OrderReturnStatus.CANCELED, version: 4 })),
		close: jest.fn(async () => ({ ...row, status: OrderReturnStatus.CLOSED, version: 4 })),
		refund: jest.fn(async () => ({ refundId: 'refund-1', amount: '50.000000', currency: 'USD' })),
		createShipment: jest.fn(async () => ({ fulfillmentId: 'fulfillment-1' })),
		applyVersionedUpdate: jest.fn(async () => ({ ...row, version: 4 })),
		replaceLines: jest.fn(async () => []),
		findOneDetailed: jest.fn(async () => row),
		findAll: jest.fn(async () => ({ items: [row], total: 1 })),
		findOneByIdString: jest.fn(async (id: string) => {
			if (id !== row.id) {
				throw new NotFoundException('The requested record was not found');
			}

			return row;
		})
	};
	const store = keyStore();
	const reflector = new Reflector();

	return {
		row,
		service,
		store,
		controller: new OrderReturnController(service as never),
		guard: new VersionGuard(reflector, { get: () => service } as never),
		idempotency: new IdempotencyInterceptor(store as never, reflector),
		versioning: new VersionInterceptor(reflector)
	};
}

type Surface = ReturnType<typeof resource>;

/** The execution context a REST route is guarded and intercepted with. */
function httpContext(handler: string, request: RequestDouble, response: ResponseDouble): ExecutionContext {
	return {
		getType: () => 'http',
		getClass: () => OrderReturnController,
		getHandler: () => (OrderReturnController.prototype as any)[handler],
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
		getArgByIndex: (index: number) => [null, request][index]
	} as unknown as ExecutionContext;
}

/**
 * Sends one request through the chain the application runs: the guard, then the retry interceptor,
 * then the version interceptor, then the controller's own method.
 *
 * The handler reached is the controller's prototype method, so the declarations under test are read
 * from the route rather than restated here, and the work that runs is the controller's real method
 * over the stubbed service.
 */
async function send(
	surface: Surface,
	handler: string,
	request: RequestDouble,
	args: unknown[] = []
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	const context = httpContext(handler, request, response);

	await surface.guard.canActivate(context);

	const result = await lastValueFrom(
		surface.idempotency.intercept(context, {
			handle: () =>
				surface.versioning.intercept(context, {
					handle: () =>
						from(
							(surface.controller as unknown as Record<string, (...rest: unknown[]) => Promise<unknown>>)[
								handler
							].apply(surface.controller, args)
						)
				})
		})
	);

	return { result, response };
}

/** A receipt of the whole line, conditioned on a version and, when one is given, retried under a key. */
const receipt = (version?: number, key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: `/api/order-returns/${RETURN}/receive`,
	params: { id: RETURN },
	query: {},
	body: { lines: [{ lineId: LINE, receivedQuantity: 5 }], ...overrides },
	headers: {
		...(key === undefined ? {} : { 'idempotency-key': key }),
		...(typeof version === 'number' ? { 'if-match': `"${version}"` } : {})
	}
});

/** The request that takes a return back: no version, because a return that does not exist has none. */
const requestForANewReturn = (key?: string): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/order-returns',
	params: {},
	query: {},
	body: { orderId: 'order-1', currency: 'USD', lines: [{ orderLineId: LINE, quantity: 1 }] },
	headers: key === undefined ? {} : { 'idempotency-key': key }
});

/** A read of one return, with the version a caller may state on it and which a read ignores. */
const read = (version?: number): RequestDouble => ({
	method: 'GET',
	originalUrl: `/api/order-returns/${RETURN}`,
	params: { id: RETURN },
	query: {},
	body: undefined,
	headers: typeof version === 'number' ? { 'if-match': `"${version}"` } : {}
});

/** The arguments the controller's own receipt handler takes, in order. */
const receiptArgs = (request: RequestDouble): unknown[] => [request.params.id, request.body, request];

/** The retry declaration a handler carries, as the interceptor reads it. */
const idempotentDeclarationOf = (handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (OrderReturnController.prototype as any)[handler]);

/** The concurrency declaration a handler carries, as the guard and the interceptor read it. */
const versionedDeclarationOf = (handler: string) =>
	Reflect.getMetadata(VERSIONED_METADATA_KEY, (OrderReturnController.prototype as any)[handler]);

describe('the receipt route — the retry declaration', () => {
	it('requires a key, under the scope the operation is named by', () => {
		expect(idempotentDeclarationOf('receive')).toEqual({
			scope: 'return.receive',
			required: true,
			resourceType: 'order_return'
		});
	});

	it('honours a key on the request route without demanding one', () => {
		// Requesting the same return twice is refused by the ceiling rather than by the key, so the key
		// is offered rather than required: a client that retries is answered from its record, and one
		// that never sends a key is unaffected.
		expect(idempotentDeclarationOf('create')).toEqual({
			scope: 'return.create',
			required: false,
			resourceType: 'order_return'
		});
	});
});

describe('the return routes — the concurrency declaration', () => {
	it('reads and writes a versioned aggregate, named as the service that owns the row', () => {
		expect(versionedDeclarationOf('receive')).toEqual({ resource: OrderReturnService });
		expect(versionedDeclarationOf('create')).toEqual({ resource: OrderReturnService, required: false });
	});

	it('states that a read does not write the version it reads', () => {
		// A GraphQL operation travels over POST whichever root type it selects, so a resolver has to say
		// which of its operations read; the guard skips a write's precondition for them.
		expect(versionedDeclarationOf('findById')).toEqual({ resource: OrderReturnService, write: false });
		expect(versionedDeclarationOf('findAll')).toBeUndefined();
	});
});

describe('OrderReturnController — a receipt without a retry key', () => {
	it('refuses the request, naming IDEMPOTENCY_KEY_REQUIRED, before the service is reached', async () => {
		const surface = resource();
		const request = receipt(3);

		await expect(send(surface, 'receive', request, receiptArgs(request))).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.service.receive).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('OrderReturnController — a retried receipt', () => {
	it('replays the first receipt for the same key and the same body, receiving once', async () => {
		const surface = resource();
		const first = receipt(3, RECEIVE_KEY);
		const second = receipt(3, RECEIVE_KEY);

		const sent = await send(surface, 'receive', first, receiptArgs(first));
		const replayed = await send(surface, 'receive', second, receiptArgs(second));

		expect(sent.result).toMatchObject({ returnId: RETURN, status: OrderReturnStatus.RECEIVED, version: 4 });
		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.receive).toHaveBeenCalledTimes(1);
		// The replay carries the answer the first attempt produced, status included, and says so.
		expect(replayed.response.headers['Idempotency-Replayed']).toBe('true');
		expect(replayed.response.statuses).toEqual([201]);
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();
		const first = receipt(3, RECEIVE_KEY);
		const different = receipt(3, RECEIVE_KEY, { lines: [{ lineId: LINE, receivedQuantity: 1 }] });

		await send(surface, 'receive', first, receiptArgs(first));

		await expect(send(surface, 'receive', different, receiptArgs(different))).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// Neither delivery was received a second time: the key covers one receipt and only one.
		expect(surface.service.receive).toHaveBeenCalledTimes(1);
	});

	it('treats two keys on the same body as two attempts at one operation', async () => {
		const surface = resource();
		const first = receipt(3, RECEIVE_KEY);
		const second = receipt(3, OTHER_KEY);

		await send(surface, 'receive', first, receiptArgs(first));
		await send(surface, 'receive', second, receiptArgs(second));

		expect(surface.service.receive).toHaveBeenCalledTimes(2);
	});
});

describe('OrderReturnController — the routes that declare no scope', () => {
	it('leaves the list untouched, key or no key', async () => {
		const surface = resource();

		await send(surface, 'findAll', { ...read(), method: 'GET', originalUrl: '/api/order-returns' });

		// A key on a route that has not adopted the convention means nothing: the header is not read,
		// nothing is hashed and no key is claimed.
		expect(idempotentDeclarationOf('findAll')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('OrderReturnController — a receipt that states no version', () => {
	it('is refused with VERSION_REQUIRED, before the service is reached', async () => {
		const surface = resource();
		const request = receipt(undefined, RECEIVE_KEY);

		await expect(send(surface, 'receive', request, receiptArgs(request))).rejects.toMatchObject({
			status: 428,
			code: 'VERSION_REQUIRED'
		});
		expect(surface.service.receive).not.toHaveBeenCalled();
	});

	it('is not refused on the request route, because a return that does not exist has no version', async () => {
		const surface = resource();
		const request = requestForANewReturn();

		const { result } = await send(surface, 'create', request, [request.body]);

		expect(surface.service.create).toHaveBeenCalledWith(request.body);
		expect(result).toMatchObject({ number: 'RET-000001' });
	});
});

describe('OrderReturnController — a receipt of a version the return has moved past', () => {
	it('is refused with ENTITY_VERSION_CONFLICT, and nothing is received', async () => {
		const surface = resource(returnRow({ version: 4 }));
		const request = receipt(3, RECEIVE_KEY);

		await expect(send(surface, 'receive', request, receiptArgs(request))).rejects.toMatchObject({
			status: 409,
			code: 'ENTITY_VERSION_CONFLICT'
		});
		expect(surface.service.receive).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});

	it('answers a receipt of a return that is not there with not-found rather than with a conflict', async () => {
		const surface = resource();
		const request = { ...receipt(3, RECEIVE_KEY), params: { id: 'another' } };

		await expect(send(surface, 'receive', request, receiptArgs(request))).rejects.toMatchObject({
			status: 404,
			code: 'RESOURCE_NOT_FOUND'
		});
	});
});

describe('OrderReturnController — a receipt of the version the caller read', () => {
	it('lands, hands the accepted version to the service and publishes the version it left behind', async () => {
		const surface = resource();
		const request = receipt(3, RECEIVE_KEY);

		const { result, response } = await send(surface, 'receive', request, receiptArgs(request));

		// The write is predicated on exactly the version the guard accepted, and the payload carries the
		// version the write left behind — which is what the caller conditions its next write on.
		expect(surface.service.receive).toHaveBeenCalledWith(
			RETURN,
			request.body.lines,
			{ warehouseId: undefined, refund: undefined, note: undefined },
			{ wildcard: false, versions: [3] }
		);		expect(result).toMatchObject({ version: 4 });
		expect(response.headers['ETag']).toBe('"4"');
	});

	it('publishes the entity tag on a read as well, because a caller learns the version by reading', async () => {
		const surface = resource(returnRow({ version: 9 }));

		const { result, response } = await send(surface, 'findById', read());

		expect(result).toMatchObject({ version: 9 });
		expect(response.headers['ETag']).toBe('"9"');
	});

	it('answers a read that states a stale version, because a read changes nothing', async () => {
		// Refusing a read for a version it does not need would refuse a request that cannot conflict with
		// anything — and would make the version unreadable to the client that has to state it.
		const surface = resource(returnRow({ version: 9 }));

		const { response } = await send(surface, 'findById', read(1));

		expect(response.headers['ETag']).toBe('"9"');
		expect(surface.service.findOneDetailed).toHaveBeenCalledTimes(1);
	});
});
