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

	/**
	 * The CRUD base, as a class the controller can extend.
	 *
	 * Its own routes are not what this suite pins, with one exception: the pair the controller overrides
	 * only to state a permission keeps the base's behaviour here, so the soft routes can be driven the
	 * way the application drives them and compared with the mutations that mirror them. The base hands
	 * the option list its own handler parameters collected to the service, which is what the double does.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}

		async softRemove(id: any, ...options: any[]): Promise<any> {
			return this.crudService.softRemove(id, options);
		}

		async softRecover(id: any, ...options: any[]): Promise<any> {
			return this.crudService.softRecover(id, options);
		}
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
	})
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
import { PERMISSIONS_METADATA } from '@gauzy/constants';
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
		// `receive` used to be listed here. It is not a transition of the order: it books a delivery
		// through `GoodsReceiptService.receive`, which posts a new receipt on every call and has no
		// natural dedupe, so a retried partial delivery was booked twice. It now demands the key its
		// sibling `POST /goods-receipts` demands — pinned in the block below.
	});
});

/**
 * Receiving against an order — the retry key and the version precondition, on both surfaces.
 *
 * `POST /purchase-orders/:id/receipts`, `receivePurchaseOrder`, `POST /goods-receipts` and
 * `createGoodsReceipt` all reach `GoodsReceiptService.receive`. The last two demanded a key under
 * `purchase_order.receive`; the first two demanded none, so a client that re-sent a partial delivery
 * (five of ten) after a timeout booked it twice — two receipts, two sets of inbound movements, ten on
 * hand — and nothing refused the second, because it was still inside the ordered quantity. The field also
 * had no way to state the order version the route reads from `If-Match`.
 *
 * The interceptor, the plan it decides from and the refusal it throws are the platform's own; the key
 * store and the receipt service are doubles, and the receipt service counts the bookings it was asked
 * for, which is the thing a retry must not double.
 */
describe('receiving against an order — one booking per retry, and the version the caller read', () => {
	const RECEIVE_KEY = 'receipt-0001';
	const DELIVERY = {
		note: 'first lorry',
		lines: [{ purchaseOrderLineId: '00000000-0000-4000-8000-0000000000d5', quantity: '5.000000' }]
	};

	/** The two surfaces over one counting receipt service and one key store. */
	function receiving() {
		let bookings = 0;
		const receiptService = {
			receive: jest.fn(async () => ({ id: `receipt-${++bookings}`, number: `GR-00000${bookings}` }))
		};
		const store = keyStore();
		const reflector = new Reflector();

		return {
			receiptService,
			store,
			controller: new PurchaseOrderController({} as never, receiptService as never),
			resolver: new PurchaseOrderResolver({} as never, {} as never, receiptService as never),
			interceptor: new IdempotencyInterceptor(store as never, reflector)
		};
	}

	type Receiving = ReturnType<typeof receiving>;

	/** One `POST /purchase-orders/:id/receipts`, through the interceptor, with the key when one is given. */
	async function overRest(surface: Receiving, key?: string, ifMatch?: string) {
		const input: RequestDouble = {
			method: 'POST',
			originalUrl: `/api/purchase-orders/${ORDER}/receipts`,
			params: { id: ORDER },
			query: {},
			body: DELIVERY,
			headers: key === undefined ? {} : { 'idempotency-key': key }
		};
		const response = responseDouble();
		const context = {
			getType: () => 'http',
			getClass: () => PurchaseOrderController,
			getHandler: () => PurchaseOrderController.prototype.receive,
			switchToHttp: () => ({ getRequest: () => input, getResponse: () => response }),
			getArgByIndex: (index: number) => [null, input][index]
		} as unknown as ExecutionContext;

		return await lastValueFrom(
			surface.interceptor.intercept(context, {
				handle: () => from(surface.controller.receive(ORDER, DELIVERY as never, ifMatch))
			})
		);
	}

	/** One `receivePurchaseOrder`, through the interceptor, with the arguments a root field is run with. */
	async function overGraphql(surface: Receiving, input: Record<string, unknown>) {
		const values = [
			null,
			{ id: ORDER, input },
			{ req: {}, res: responseDouble() },
			{ operation: { operation: 'mutation' }, fieldName: 'receivePurchaseOrder' }
		];
		const context = {
			getType: () => 'graphql',
			getClass: () => PurchaseOrderResolver,
			getHandler: () => PurchaseOrderResolver.prototype.receivePurchaseOrder,
			getArgs: () => values,
			getArgByIndex: (index: number) => values[index],
			switchToHttp: () => {
				throw new Error('a GraphQL operation has no HTTP request of its own');
			}
		} as unknown as ExecutionContext;

		return await lastValueFrom(
			surface.interceptor.intercept(context, {
				handle: () => from(surface.resolver.receivePurchaseOrder(ORDER, input as never))
			})
		);
	}

	it('declares the scope and the demand the standalone booking declares, on the route and on the field', () => {
		const declared = { scope: 'purchase_order.receive', required: true, resourceType: 'goods_receipt' };

		expect(declarationOf(PurchaseOrderController, 'receive')).toEqual(declared);
		expect(declarationOf(PurchaseOrderResolver, 'receivePurchaseOrder')).toEqual(declared);
	});

	it('refuses a keyless booking over REST, and books nothing', async () => {
		const surface = receiving();

		await expect(overRest(surface)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
		expect(surface.receiptService.receive).not.toHaveBeenCalled();
	});

	it('refuses a keyless booking over GraphQL, and books nothing', async () => {
		const surface = receiving();

		await expect(overGraphql(surface, { ...DELIVERY })).rejects.toMatchObject({
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.receiptService.receive).not.toHaveBeenCalled();
	});

	it('answers a REST retry of the same delivery with the first receipt instead of booking it twice', async () => {
		const surface = receiving();

		const first = await overRest(surface, RECEIVE_KEY);
		const retried = await overRest(surface, RECEIVE_KEY);

		expect(surface.receiptService.receive).toHaveBeenCalledTimes(1);
		expect(retried).toEqual(first);
	});

	it('answers a GraphQL retry of the same delivery with the first receipt instead of booking it twice', async () => {
		const surface = receiving();
		const input = { ...DELIVERY, idempotencyKey: RECEIVE_KEY };

		const first = await overGraphql(surface, input);
		const retried = await overGraphql(surface, input);

		expect(surface.receiptService.receive).toHaveBeenCalledTimes(1);
		expect(retried).toEqual(first);
		expect(first.userErrors).toEqual([]);
	});

	it('hands the service the order version the caller read, as the route does from If-Match', async () => {
		const surface = receiving();

		await overRest(surface, 'receipt-rest', '"4"');
		await overGraphql(surface, { ...DELIVERY, version: 4, idempotencyKey: 'receipt-graphql' });

		expect(surface.receiptService.receive).toHaveBeenCalledTimes(2);

		for (const [call] of surface.receiptService.receive.mock.calls as unknown as Array<[Record<string, unknown>]>) {
			expect(call).toMatchObject({ purchaseOrderId: ORDER, expectedVersion: 4, lines: DELIVERY.lines });
		}
	});

	it('states no version when the caller stated none, on either surface', async () => {
		const surface = receiving();

		await overRest(surface, 'receipt-rest');
		await overGraphql(surface, { ...DELIVERY, version: null, idempotencyKey: 'receipt-graphql' });

		for (const [call] of surface.receiptService.receive.mock.calls as unknown as Array<[Record<string, unknown>]>) {
			expect(call.expectedVersion).toBeUndefined();
		}
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

/**
 * The mutations a client can reach that mirror routes the resolver did not serve (doc 17 §3.1).
 *
 * §3.1 asks for **capability parity**: one mutation per REST write route, stating the permission that
 * route states and making the call that route makes. Five routes of this resource were served over REST
 * only — acknowledging a sent order, approving one internally, receiving goods against it, and the two
 * routes the CRUD base inherits, `DELETE /:id/soft` and `PUT /:id/recover` — so a client on the GraphQL
 * surface could raise an order, send it and close it, but could not record what the supplier said, could
 * not release it, could not book what arrived, and could not withdraw or restore it at all.
 *
 * Each case below drives both surfaces over one stubbed service and compares what the service was asked
 * to do, so the field is asserted to be the route's capability in the other protocol rather than a
 * second implementation of it. The permission is read from the metadata a guard reads, on both surfaces,
 * so the two cannot disagree about which grant an operation needs.
 */

/** The date a supplier confirmed, and the note that came with it. */
const CONFIRMED_AT = new Date('2026-01-05T09:00:00.000Z');
const ACKNOWLEDGEMENT_NOTE = 'Supplier confirmed the revised date.';

/** The quantities that arrived, as the body of the receiving route states them. */
const RECEIVED_LINES = [{ purchaseOrderLineId: '00000000-0000-4000-8000-0000000000d5', quantity: '4.000000' }];

/** The receipt the recording answers with. */
const RECEIPT = '00000000-0000-4000-8000-0000000000d6';

/**
 * What each operation answers with, as one object per operation.
 *
 * The stubs resolve with a fixed row rather than a fresh literal so the two surfaces can be compared by
 * identity: "the field answers the same thing the route answers" is a stronger statement than a deep
 * equality of two objects that happen to have the same members, and it is the statement the parity rule
 * makes.
 */
const ACKNOWLEDGED = { id: ORDER, status: 'ACKNOWLEDGED', note: ACKNOWLEDGEMENT_NOTE };
const APPROVED = { id: ORDER, status: 'DRAFT', approvedAt: CONFIRMED_AT };
const RECORDED = { id: RECEIPT, receivedAt: CONFIRMED_AT };
const WITHDRAWN = { id: ORDER, deletedAt: CONFIRMED_AT };
const RESTORED = { id: ORDER, deletedAt: null };

/**
 * Each route and the mutation that mirrors it, with the permission both of them state.
 *
 * The values are the permission strings themselves rather than the enumeration's members, because a
 * string is what the guard compares: an enumeration that was renamed without the catalogue moving with
 * it would leave both surfaces agreeing with each other and disagreeing with the guard.
 *
 * The receiving route is the one that states a grant from the other resource of this plugin
 * (`GOODS_RECEIPTS_CREATE`, not a purchase-order permission) — the operation writes stock movements and
 * the order's received counters, so it is the receiving authority rather than an edit to a document. The
 * table states it as the route does, which is the whole point of reading the permission off both
 * surfaces rather than off one of them.
 */
const MIRRORED: Array<{ route: keyof PurchaseOrderController; field: keyof PurchaseOrderResolver; permission: string }> = [
	{ route: 'acknowledge', field: 'acknowledgePurchaseOrder', permission: 'PURCHASE_ORDERS_EDIT' },
	{ route: 'approve', field: 'approvePurchaseOrder', permission: 'PURCHASE_ORDERS_APPROVE' },
	{ route: 'receive', field: 'receivePurchaseOrder', permission: 'GOODS_RECEIPTS_CREATE' },
	{ route: 'softRemove', field: 'softDeletePurchaseOrder', permission: 'PURCHASE_ORDERS_EDIT' },
	{ route: 'softRecover', field: 'recoverPurchaseOrder', permission: 'PURCHASE_ORDERS_EDIT' }
];

/** The controller and the resolver over one stubbed set of services. */
function mirrored() {
	const orderService = {
		acknowledge: jest.fn().mockResolvedValue(ACKNOWLEDGED),
		approve: jest.fn().mockResolvedValue(APPROVED),
		softRemove: jest.fn().mockResolvedValue(WITHDRAWN),
		softRecover: jest.fn().mockResolvedValue(RESTORED)
	};
	const receiptService = { receive: jest.fn().mockResolvedValue(RECORDED) };

	return {
		orderService,
		receiptService,
		controller: new PurchaseOrderController(orderService as never, receiptService as never),
		resolver: new PurchaseOrderResolver(orderService as never, {} as never, receiptService as never)
	};
}

describe('the purchase-order mutations — the routes they mirror (doc 17 §3.1)', () => {
	it('states the permission each of its routes states, on both surfaces', () => {
		for (const entry of MIRRORED) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, PurchaseOrderController.prototype[entry.route])).toEqual([
				entry.permission
			]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, PurchaseOrderResolver.prototype[entry.field])).toEqual([
				entry.permission
			]);
		}

		// Both classes carry the read grant, so every one of these has to state its own: a handler that
		// declared none would be reachable by any caller who may look at an order — which is the shape of
		// the defect the soft routes were overridden to close, and the reason the fields state it too.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PurchaseOrderController)).toEqual(['PURCHASE_ORDERS_VIEW']);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PurchaseOrderResolver)).toEqual(['PURCHASE_ORDERS_VIEW']);
	});

	it('acknowledges through the same service method the route calls, with the same body', async () => {
		const { orderService, controller, resolver } = mirrored();

		const overRest = await controller.acknowledge(ORDER, { expectedAt: CONFIRMED_AT, note: ACKNOWLEDGEMENT_NOTE }, undefined);
		const overGraphql = await resolver.acknowledgePurchaseOrder(ORDER, CONFIRMED_AT, ACKNOWLEDGEMENT_NOTE);

		expect(orderService.acknowledge).toHaveBeenCalledTimes(2);

		for (const call of orderService.acknowledge.mock.calls) {
			expect(call[0]).toBe(ORDER);
			expect(call[1]).toMatchObject({ expectedAt: CONFIRMED_AT, note: ACKNOWLEDGEMENT_NOTE });
		}

		// The version is absent on both: the route read none because the request carried no `If-Match`,
		// and the field never states one, because a field has no header to read it from.
		expect(orderService.acknowledge.mock.calls[0][1].expectedVersion).toBeUndefined();
		expect(orderService.acknowledge.mock.calls[1][1]).not.toHaveProperty('expectedVersion');
		// One answer, one implementation: the payload carries the order the route itself returns.
		expect(overGraphql.purchaseOrder).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('approves through the same service method the route calls, under the approval grant', async () => {
		const { orderService, controller, resolver } = mirrored();

		const overRest = await controller.approve(ORDER, { note: ACKNOWLEDGEMENT_NOTE }, undefined);
		const overGraphql = await resolver.approvePurchaseOrder(ORDER, ACKNOWLEDGEMENT_NOTE);

		expect(orderService.approve).toHaveBeenCalledTimes(2);
		expect(orderService.approve.mock.calls.map((call) => call[0])).toEqual([ORDER, ORDER]);
		expect(orderService.approve.mock.calls.map((call) => call[1])).toEqual([
			ACKNOWLEDGEMENT_NOTE,
			ACKNOWLEDGEMENT_NOTE
		]);
		expect(overGraphql.purchaseOrder).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('receives through the same service method the route calls, under the receiving grant', async () => {
		const { receiptService, controller, resolver } = mirrored();
		const delivery = {
			receivedAt: CONFIRMED_AT,
			overReceiptTolerance: '0.050000',
			note: ACKNOWLEDGEMENT_NOTE,
			lines: RECEIVED_LINES
		};

		const overRest = await controller.receive(ORDER, delivery as never, undefined);
		const overGraphql = await resolver.receivePurchaseOrder(ORDER, delivery as never);

		expect(receiptService.receive).toHaveBeenCalledTimes(2);

		for (const call of receiptService.receive.mock.calls) {
			expect(call[0]).toMatchObject({
				// The order is stated the way each surface can state it: in the route's path, and as the
				// field's own argument here.
				purchaseOrderId: ORDER,
				receivedAt: CONFIRMED_AT,
				overReceiptTolerance: '0.050000',
				note: ACKNOWLEDGEMENT_NOTE,
				lines: RECEIVED_LINES
			});
		}

		// The same answer the route gives, carried in the payload this plugin's mutations answer with: the
		// field is the route's capability, and the shape it reports it in is the protocol's.
		expect(overGraphql.goodsReceipt).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('withdraws and restores through the inherited routes’ own service calls', async () => {
		const { orderService, controller, resolver } = mirrored();

		const overRest = await controller.softRemove(ORDER);
		const overGraphql = await resolver.softDeletePurchaseOrder(ORDER);

		expect(orderService.softRemove).toHaveBeenCalledTimes(2);
		expect(orderService.softRemove.mock.calls.map((call) => call[0])).toEqual([ORDER, ORDER]);
		// The route forwards the (empty) option list its own handler parameters collected; the field
		// collects no parameters, so it forwards none — the service reads both as "no options", and this is
		// how every other inherited soft removal of the platform is bound.
		expect(orderService.softRemove.mock.calls[1]).toEqual([ORDER]);
		expect(overGraphql).toBe(overRest);

		const restoredOverRest = await controller.softRecover(ORDER);
		const restoredOverGraphql = await resolver.recoverPurchaseOrder(ORDER);

		expect(orderService.softRecover).toHaveBeenCalledTimes(2);
		expect(orderService.softRecover.mock.calls.map((call) => call[0])).toEqual([ORDER, ORDER]);
		expect(restoredOverGraphql).toBe(restoredOverRest);
	});

	it('declares on each mirrored mutation the retry key its route declares, and no other', () => {
		// This used to assert that none of the mirrored mutations declares a key, on the ground that the
		// order path booked a delivery without one. That was the defect: `receive` reaches the same
		// `GoodsReceiptService.receive` the key-demanding `POST /goods-receipts` does, and a retried partial
		// delivery was booked twice. The route and the field now both demand the key; the transitions still
		// declare none — each takes its own version precondition instead — so the parity rule is what is
		// pinned here, with the one declaration spelled out so an empty read on both sides cannot pass.
		for (const entry of MIRRORED) {
			expect(declarationOf(PurchaseOrderResolver, entry.field)).toEqual(
				declarationOf(PurchaseOrderController, entry.route)
			);
		}

		expect(declarationOf(PurchaseOrderResolver, 'receivePurchaseOrder')).toEqual({
			scope: 'purchase_order.receive',
			required: true,
			resourceType: 'goods_receipt'
		});

		for (const entry of MIRRORED.filter(({ field }) => field !== 'receivePurchaseOrder')) {
			expect(declarationOf(PurchaseOrderResolver, entry.field)).toBeUndefined();
		}
	});
});
