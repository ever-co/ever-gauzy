/**
 * The module boundaries are doubled for the reason this package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel — and its nested `uuid` is ESM-only, so reading one
 * entity under jest fails — while `@gauzy/config` reads the process environment at import time and
 * `@gauzy/common` is read by the feature-flag decorator.
 *
 * **Retry safety is the one seam left real.** `Idempotent`, its metadata key and the interceptor that
 * acts on it are pulled from the kernel's own modules with `requireActual`, so the declaration the route
 * carries and the decision made from it are the platform's, and only the key store is an in-memory
 * double of the kernel service.
 *
 * The resource under test is the real purchase-order controller, reached through its own prototype
 * method, over stubbed services.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;
	// The order service reaches the kernel's conditional write by name through this barrel, so a
	// factory that replaces the barrel has to answer for it even where no transition is exercised.
	const { ApiErrorCode, commitVersionedUpdate } = require('../testing/versioned-write.double');

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
		ApiErrorCode,
		commitVersionedUpdate,
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
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		// The CRUD base's soft-delete routes decorate with `new AbstractValidationPipe(...)`, so the
		// controller resolves this name at import — and `@UsePipes()` refuses a pipe with no `transform`,
		// which is the only member the declaration needs here.
		AbstractValidationPipe: class AbstractValidationPipe {
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Organization: class Organization {},
		OrganizationVendor: class OrganizationVendor {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		Warehouse: class Warehouse {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
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
 * constructor signature is emitted as a value — so the interceptor cannot be loaded without the service
 * module, whose own import chain is the whole core entity graph.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderResolver } from '../graphql/resolvers/purchase-order.resolver';

/**
 * The purchase-order resource's retry contract.
 *
 * Raising an order is the operation a client retries after losing a response, and the suite pins both
 * halves of what that costs:
 *
 * - the key is **offered rather than demanded**, so every existing caller keeps working and a route that
 *   never saw a key behaves exactly as it did before the convention existed;
 * - a caller that does present one is answered, on a retry of the identical body, with the order the
 *   first attempt raised — the same order id, and one document rather than two;
 * - a *different* body under the same key is refused with `IDEMPOTENCY_KEY_REUSED`, because the key
 *   covers the request it was claimed for and not whatever is sent under it next;
 * - the mutation that mirrors the route declares the same scope, so the two protocols answer
 *   identically.
 *
 * The request hash is taken from the bytes the client sent — the platform stashes them on the request
 * for signature verification, and the fingerprint prefers them over a re-serialization of the parsed
 * body — so two identical requests hash the same however often they are sent, while a body that was
 * rebuilt with its members in another order is a different request and is refused as a key reuse rather
 * than answered with the first attempt's order.
 *
 * The interceptor, the plan it decides from and the refusal it throws are the platform's own; only the
 * request, the response, the key store and the service are doubles.
 */

const ORDER = '00000000-0000-4000-8000-0000000000d1';
const VENDOR = '00000000-0000-4000-8000-0000000000d2';
const WAREHOUSE = '00000000-0000-4000-8000-0000000000d3';
const VARIANT = '00000000-0000-4000-8000-0000000000d4';
const CREATE_KEY = 'purchase-order-0001';

/** What a client sends as the body of an order. */
const body = (overrides: Record<string, unknown> = {}) => ({
	vendorId: VENDOR,
	warehouseId: WAREHOUSE,
	currency: 'USD',
	lines: [{ variantId: VARIANT, quantity: '10.000000', unitCost: '2.000000' }],
	...overrides
});

/** The key store, doubled in memory, keyed the way the kernel keys a row. */
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
	/** The bytes the client sent, which the platform stashes and the fingerprint is taken from. */
	rawBody?: Buffer;
}

/** The resource over stubbed services and one in-memory key store. */
function resource() {
	const service = {
		create: jest.fn(async (entity: any) => ({ id: ORDER, number: 'PO-000001', version: 1, ...entity })),
		findAll: jest.fn(async () => ({ items: [{ id: ORDER }], total: 1 }))
	};
	const store = keyStore();
	const reflector = new Reflector();

	return {
		service,
		store,
		controller: new PurchaseOrderController(service as never, {} as never),
		interceptor: new IdempotencyInterceptor(store as never, reflector)
	};
}

type Surface = ReturnType<typeof resource>;

/** One request to raise an order, with the key when one is given. */
const request = (payload: unknown, key?: string): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/purchase-orders',
	params: {},
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
		getClass: () => PurchaseOrderController,
		getHandler: () => (PurchaseOrderController.prototype as any)[handler],
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

/** The retry declaration a handler carries, as the interceptor reads it. */
const declarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (surface.prototype as any)[handler]);

describe('the purchase-order route — the retry declaration', () => {
	it('offers a key on a create rather than demanding one', () => {
		// The endpoint table does not list raising an order among the routes that demand a key, and a
		// route that started demanding one would refuse every existing caller.
		expect(declarationOf(PurchaseOrderController, 'create')).toEqual({
			scope: 'purchase_order.create',
			required: false,
			resourceType: 'purchase_order'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(PurchaseOrderResolver, 'createPurchaseOrder')).toEqual(
			declarationOf(PurchaseOrderController, 'create')
		);
	});

	it('leaves the transitions alone, because each of them takes its own version precondition', () => {
		expect(declarationOf(PurchaseOrderController, 'send')).toBeUndefined();
		expect(declarationOf(PurchaseOrderController, 'approve')).toBeUndefined();
		expect(declarationOf(PurchaseOrderController, 'receive')).toBeUndefined();
	});
});

describe('PurchaseOrderController — a create that presents no key', () => {
	it('runs, because the route offers the key rather than demanding it', async () => {
		const surface = resource();
		const input = request(body());

		await expect(send(surface, 'create', input, [input.body])).resolves.toMatchObject({
			result: { id: ORDER, number: 'PO-000001' }
		});
		expect(surface.service.create).toHaveBeenCalledTimes(1);
		// Nothing was claimed, because no key was presented: a route that has adopted the convention
		// reads no header it was not given.
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PurchaseOrderController — a retried create', () => {
	it('answers a replay of the identical body with the order the first attempt raised', async () => {
		const surface = resource();
		const first = request(body(), CREATE_KEY);
		const second = request(body(), CREATE_KEY);

		const sent = await send(surface, 'create', first, [first.body]);
		const replayed = await send(surface, 'create', second, [second.body]);

		// The same order id, and one document rather than two.
		expect(sent.result).toMatchObject({ id: ORDER });
		expect(replayed.result).toMatchObject({ id: ORDER });
		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.create).toHaveBeenCalledTimes(1);
		expect(replayed.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('replays when the bytes the client sent are the same bytes, however often it sends them', async () => {
		// The fingerprint is taken from the raw request bytes, which the platform stashes on every
		// request, so an identical retry is recognised as the same request and answered from the record.
		const surface = resource();
		const raw = JSON.stringify(body());
		const first = { ...request(body(), CREATE_KEY), rawBody: Buffer.from(raw) };
		const second = { ...request(body(), CREATE_KEY), rawBody: Buffer.from(raw) };

		await send(surface, 'create', first, [first.body]);

		await expect(send(surface, 'create', second, [second.body])).resolves.toMatchObject({
			result: { id: ORDER }
		});
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});

	it('answers the same body sent as different bytes from the first attempt, because it is the same request', async () => {
		// This case used to pin the opposite, and the opposite was the defect. Key order, whitespace and
		// number formatting do not survive a parse-and-reserialize round trip, so an SDK, a proxy or a
		// gateway that rebuilds the body sends different bytes for the same request — and the fingerprint
		// hashed the bytes. A client that lost its response and retried was therefore answered `409
		// IDEMPOTENCY_KEY_REUSED`, which is the one outcome it cannot recover from: it has no response
		// and it may not ask again. The fingerprint canonicalizes the parsed body now, so the retry is
		// recognised and replayed, and the order is still created exactly once.
		const surface = resource();
		const first = { ...request(body(), CREATE_KEY), rawBody: Buffer.from(JSON.stringify(body())) };
		const rebuilt = {
			...request(body(), CREATE_KEY),
			rawBody: Buffer.from(
				JSON.stringify({ lines: body().lines, currency: 'USD', warehouseId: WAREHOUSE, vendorId: VENDOR })
			)
		};

		await send(surface, 'create', first, [first.body]);

		await expect(send(surface, 'create', rebuilt, [rebuilt.body])).resolves.toMatchObject({
			result: { id: ORDER }
		});
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});

	it('refuses bytes that are not JSON and do not match, because those are all there is to compare', async () => {
		// The other half of the same rule: a body no parser can read has no canonical form, so the raw
		// bytes are the fingerprint — and two different ones under one key are two different requests.
		const surface = resource();
		const first = { ...request(undefined, CREATE_KEY), rawBody: Buffer.from('variant=VARIANT&quantity=20') };
		const different = { ...request(undefined, CREATE_KEY), rawBody: Buffer.from('variant=VARIANT&quantity=21') };

		await send(surface, 'create', first, [first.body]);

		await expect(send(surface, 'create', different, [different.body])).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// The property that matters either way: one key, one side effect.
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();
		const first = request(body(), CREATE_KEY);
		const different = request(body({ lines: [{ variantId: VARIANT, quantity: '20.000000', unitCost: '2.000000' }] }), CREATE_KEY);

		await send(surface, 'create', first, [first.body]);

		await expect(send(surface, 'create', different, [different.body])).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// Neither order was raised a second time: the key covers one create and only one.
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});

	it('treats two keys on the same body as two attempts at one operation', async () => {
		const surface = resource();
		const first = request(body(), CREATE_KEY);
		const second = request(body(), 'purchase-order-0002');

		await send(surface, 'create', first, [first.body]);
		await send(surface, 'create', second, [second.body]);

		expect(surface.service.create).toHaveBeenCalledTimes(2);
	});
});
