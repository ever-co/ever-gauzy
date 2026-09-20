/**
 * Three module boundaries are doubled, and the reason is the same for all three: `@gauzy/core` boots
 * the whole application graph from its barrel — and its nested `uuid` is ESM-only, so reading one
 * entity under jest fails — while `@gauzy/plugin-order`'s barrel re-exports the whole order and cart
 * domain and `@gauzy/common` is read by the feature-flag decorator. None of them is something a
 * shipment's retry contract needs.
 *
 * **Retry safety is the one seam left real.** `Idempotent`, its metadata key and the interceptor that
 * acts on it are pulled from the kernel's own modules with `requireActual`, so the declaration a route
 * carries and the decision made from it are the platform's, and only the key store is an in-memory
 * double of the kernel service — the interceptor calls three methods on it and reads one outcome
 * vocabulary, which is the whole of that seam.
 *
 * The resources under test are the real ones: the fulfilment controller and the resolver whose
 * mutations mirror it, each reached through its own prototype method so the declaration under test is
 * read from the route rather than restated here, over a stubbed service.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const decimals = jest.requireActual('@gauzy/core/src/lib/money/decimal');

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
		compareDecimalStrings: decimals.compareDecimalStrings,
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		Warehouse: class Warehouse {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		// The platform's decorator is `UsePipes(new ValidationPipe(options))`, so the double is that same
		// line rather than a no-op.
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENCY_METADATA_KEY,
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

jest.mock('@gauzy/plugin-order', () => ({
	// The counter writer is a collaborator of this package, not of the thing under test: the suite hands
	// the controller a stubbed service, so the class here is only the module's identity.
	OrderLineService: class OrderLineService {}
}));

/**
 * The interceptor names `IdempotencyService` as its injected dependency, and a class used in a
 * constructor signature is emitted as a value — so the interceptor cannot be loaded without the
 * service module, whose own import chain is the whole core entity graph. The service is therefore
 * doubled at its own module: the interceptor under test is the real one, and the store it calls is the
 * in-memory double the cases below hand it.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentResolver } from '../graphql/fulfillment.resolver';

/**
 * The fulfilment resource's retry contract.
 *
 * Creating a fulfilment ships goods, so the suite pins the two properties the mechanism exists for:
 * **one key, one shipment**, and **a route that offers the key rather than demanding it stays usable
 * without one**.
 *
 * - creating a fulfilment demands a key, and the mutation that mirrors it declares the same scope;
 * - a create without a key is refused with `IDEMPOTENCY_KEY_REQUIRED`, before the service is reached;
 * - the same key with the same body replays the first answer and does not create a second fulfilment;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, and neither body is
 *   applied;
 * - handing a shipment to the carrier honours a key without demanding one, so a client that never
 *   sends one is unaffected and one that does is answered from its record;
 * - a route that declares no scope is untouched: no key is read, nothing is claimed, and the handler
 *   runs exactly as it did before the convention existed.
 *
 * The interceptor, the plan it decides from and the refusal it throws are the platform's own; only the
 * request, the response, the key store and the service are doubles.
 */

const FULFILLMENT = '00000000-0000-4000-8000-0000000000f1';
const ORDER = '00000000-0000-4000-8000-0000000000f2';
const ORDER_LINE = '00000000-0000-4000-8000-0000000000f3';
const CREATE_KEY = 'fulfillment-create-0001';
const SHIP_KEY = 'fulfillment-ship-0001';
const OTHER_KEY = 'fulfillment-create-0002';

/** What a client sends as the body of a fulfilment. */
const body = (overrides: Record<string, unknown> = {}) => ({
	orderId: ORDER,
	lines: [{ orderLineId: ORDER_LINE, quantity: 2 }],
	...overrides
});

/** What a client sends when the parcel is handed to the carrier. */
const shipment = (overrides: Record<string, unknown> = {}) => ({
	trackingNumber: 'TRACK-1',
	carrier: 'the carrier',
	...overrides
});

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

/** One request as the transport hands it to an interceptor. */
interface RequestDouble {
	method: string;
	originalUrl: string;
	params: Record<string, string>;
	query: Record<string, unknown>;
	body: any;
	headers: Record<string, string>;
}

/** The resource over a stubbed service and one in-memory key store. */
function resource() {
	const service = {
		create: jest.fn(async (entity: any) => ({ id: FULFILLMENT, version: 1, ...entity })),
		ship: jest.fn(async (id: string, input: any) => ({ id, status: 'SHIPPED', version: 2, ...input })),
		findAll: jest.fn(async () => ({ items: [{ id: FULFILLMENT }], total: 1 }))
	};
	const store = keyStore();
	const reflector = new Reflector();

	return {
		service,
		store,
		controller: new FulfillmentController(service as never),
		resolver: new FulfillmentResolver(service as never, {} as never),
		interceptor: new IdempotencyInterceptor(store as never, reflector)
	};
}

type Surface = ReturnType<typeof resource>;

/** One REST request, with the key when one is given. */
const request = (url: string, payload: unknown, key?: string): RequestDouble => ({
	method: 'POST',
	originalUrl: url,
	params: { id: FULFILLMENT },
	query: {},
	body: payload,
	headers: key === undefined ? {} : { 'idempotency-key': key }
});

/** Sends one HTTP request through the interceptor the way the application does. */
async function send(
	surface: Surface,
	handler: string,
	input: RequestDouble,
	args: unknown[]
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	const context = {
		getType: () => 'http',
		getClass: () => FulfillmentController,
		getHandler: () => (FulfillmentController.prototype as any)[handler],
		switchToHttp: () => ({ getRequest: () => input, getResponse: () => response }),
		getArgByIndex: (index: number) => [null, input][index]
	} as unknown as ExecutionContext;

	const result = await lastValueFrom(
		surface.interceptor.intercept(context, {
			handle: () =>
				from(
					(surface.controller as unknown as Record<string, (...rest: unknown[]) => Promise<unknown>>)[
						handler
					].apply(surface.controller, args)
				)
		})
	);

	return { result, response };
}

/**
 * Runs one GraphQL mutation through the interceptor, with the arguments a root field is executed with:
 * the root value, the arguments, the GraphQL context and the field info, which is what the kernel reads
 * the operation and the retry key from. The resolver's own arguments are handed in separately, because
 * a resolver reads its collaborators from `this` and its parameters from the arguments it declares.
 */
async function mutate(
	surface: Surface,
	handler: string,
	gqlArgs: Record<string, unknown>,
	args: unknown[]
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	const values = [
		null,
		gqlArgs,
		{ res: response },
		{ operation: { operation: 'mutation' }, fieldName: handler }
	];
	const context = {
		getType: () => 'graphql',
		getClass: () => FulfillmentResolver,
		getHandler: () => (FulfillmentResolver.prototype as any)[handler],
		getArgs: () => values,
		getArgByIndex: (index: number) => values[index],
		switchToHttp: () => {
			throw new Error('a GraphQL operation has no HTTP request of its own');
		}
	} as unknown as ExecutionContext;

	const result = await lastValueFrom(
		surface.interceptor.intercept(context, {
			handle: () => from((surface.resolver as any)[handler].call(surface.resolver, ...args))
		})
	);

	return { result, response };
}

/** The retry declaration a handler carries, as the interceptor reads it. */
const declarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (surface.prototype as any)[handler]);

describe('the fulfilment routes — the retry declarations', () => {
	it('demands a key for a create, because creating a fulfilment twice ships twice', () => {
		expect(declarationOf(FulfillmentController, 'create')).toEqual({
			scope: 'fulfillment.create',
			required: true,
			resourceType: 'fulfillment'
		});
	});

	it('offers a key for a shipment, because a repeat is refused by the status machine', () => {
		expect(declarationOf(FulfillmentController, 'ship')).toEqual({
			scope: 'fulfillment.ship',
			required: false,
			resourceType: 'fulfillment'
		});
	});

	it('declares the same scopes on the mutations that mirror them', () => {
		// One operation, two protocols: a key presented over GraphQL and the same key presented over REST
		// name the same operation, so a client may retry on either without shipping twice.
		expect(declarationOf(FulfillmentResolver, 'createFulfillment')).toEqual(
			declarationOf(FulfillmentController, 'create')
		);
		expect(declarationOf(FulfillmentResolver, 'shipFulfillment')).toEqual(
			declarationOf(FulfillmentController, 'ship')
		);
	});
});

describe('FulfillmentController — a create without a key', () => {
	it('refuses the request, naming IDEMPOTENCY_KEY_REQUIRED, before the service is reached', async () => {
		const surface = resource();
		const input = request('/api/fulfillments', body());

		await expect(send(surface, 'create', input, [input.body])).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.service.create).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('FulfillmentController — a retried create', () => {
	it('replays the first fulfilment for the same key and the same body, creating once', async () => {
		const surface = resource();
		const first = request('/api/fulfillments', body(), CREATE_KEY);
		const second = request('/api/fulfillments', body(), CREATE_KEY);

		const sent = await send(surface, 'create', first, [first.body]);
		const replayed = await send(surface, 'create', second, [second.body]);

		expect(sent.result).toMatchObject({ id: FULFILLMENT });
		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.create).toHaveBeenCalledTimes(1);
		// The replay carries the answer the first attempt produced, status included, and says so.
		expect(replayed.response.headers['Idempotency-Replayed']).toBe('true');
		expect(replayed.response.statuses).toEqual([201]);
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();
		const first = request('/api/fulfillments', body(), CREATE_KEY);
		const different = request('/api/fulfillments', body({ lines: [{ orderLineId: ORDER_LINE, quantity: 5 }] }), CREATE_KEY);

		await send(surface, 'create', first, [first.body]);

		await expect(send(surface, 'create', different, [different.body])).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// Neither shipment was created a second time: the key covers one fulfilment and only one.
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});

	it('treats two keys on the same body as two attempts at one operation', async () => {
		const surface = resource();
		const first = request('/api/fulfillments', body(), CREATE_KEY);
		const second = request('/api/fulfillments', body(), OTHER_KEY);

		await send(surface, 'create', first, [first.body]);
		await send(surface, 'create', second, [second.body]);

		expect(surface.service.create).toHaveBeenCalledTimes(2);
	});
});

describe('FulfillmentController — a shipment that presents a key', () => {
	it('runs without one, because the route offers the key rather than demanding it', async () => {
		const surface = resource();
		const input = request(`/api/fulfillments/${FULFILLMENT}/ship`, shipment());

		await expect(send(surface, 'ship', input, [FULFILLMENT, input.body])).resolves.toMatchObject({
			result: { id: FULFILLMENT, status: 'SHIPPED' }
		});
		expect(surface.service.ship).toHaveBeenCalledTimes(1);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});

	it('replays the first shipment when the key and the body are repeated, handing over once', async () => {
		const surface = resource();
		const first = request(`/api/fulfillments/${FULFILLMENT}/ship`, shipment(), SHIP_KEY);
		const second = request(`/api/fulfillments/${FULFILLMENT}/ship`, shipment(), SHIP_KEY);

		const sent = await send(surface, 'ship', first, [FULFILLMENT, first.body]);
		const replayed = await send(surface, 'ship', second, [FULFILLMENT, second.body]);

		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.ship).toHaveBeenCalledTimes(1);
	});
});

describe('FulfillmentController — the routes that declare no scope', () => {
	it('leaves the list untouched, key or no key', async () => {
		const surface = resource();
		const input = { ...request('/api/fulfillments', undefined, CREATE_KEY), method: 'GET' };

		await send(surface, 'findAll', input, [undefined]);

		// A key on a route that has not adopted the convention means nothing: the header is not read,
		// nothing is hashed and no key is claimed.
		expect(declarationOf(FulfillmentController, 'findAll')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('FulfillmentResolver — the mirrored create', () => {
	it('refuses a fulfilment that states no key, with the same code REST answers with', async () => {
		const surface = resource();
		const input = body();

		await expect(mutate(surface, 'createFulfillment', { input }, [{ input }])).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.service.create).not.toHaveBeenCalled();
	});

	it('replays the first fulfilment when the key and the input are repeated', async () => {
		const surface = resource();
		const input = { ...body(), idempotencyKey: CREATE_KEY };

		const sent = await mutate(surface, 'createFulfillment', { input }, [{ input }]);
		const replayed = await mutate(surface, 'createFulfillment', { input: { ...input } }, [{ input: { ...input } }]);

		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});
});
