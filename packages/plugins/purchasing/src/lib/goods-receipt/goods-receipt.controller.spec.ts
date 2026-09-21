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
 * The resource under test is the real goods-receipt controller, reached through its own prototype
 * method, over a stubbed service. Its sibling declaration — the mutation that mirrors the route — is
 * read from the resolver whose own module is imported for that purpose alone.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const decimals = jest.requireActual('@gauzy/core/src/lib/money/decimal');

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
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		compareDecimalStrings: decimals.compareDecimalStrings,
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
		// The platform's decorator is `UsePipes(new ValidationPipe(options))`, so the double is that same
		// line rather than a no-op.
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
import { GoodsReceiptController } from './goods-receipt.controller';
import { GoodsReceiptResolver } from '../graphql/resolvers/goods-receipt.resolver';

/**
 * The goods-receipt resource's retry contract.
 *
 * A delivery is what moves stock and what the order's counters are moved by, so the suite pins the
 * property the mechanism exists for: **one key, one booking**.
 *
 * - recording a delivery demands a key, and the mutation that mirrors it declares the same scope;
 * - a receipt without a key is refused with `IDEMPOTENCY_KEY_REQUIRED`, before the service is reached;
 * - the same key with the same body replays the first receipt and does not book the stock twice;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, and neither body is
 *   applied — the request hash covers the whole body, so two identical requests hash the same however
 *   often they are sent.
 *
 * The interceptor, the plan it decides from and the refusal it throws are the platform's own; only the
 * request, the response, the key store and the service are doubles.
 */

const RECEIPT = '00000000-0000-4000-8000-0000000000c1';
const ORDER = '00000000-0000-4000-8000-0000000000c2';
const WAREHOUSE = '00000000-0000-4000-8000-0000000000c3';
const ORDER_LINE = '00000000-0000-4000-8000-0000000000c4';
const RECEIVE_KEY = 'goods-receipt-0001';

/** What a client sends as the body of a delivery. */
const body = (overrides: Record<string, unknown> = {}) => ({
	purchaseOrderId: ORDER,
	warehouseId: WAREHOUSE,
	lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '5.000000' }],
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
}

/** The resource over a stubbed service and one in-memory key store. */
function resource() {
	const service = {
		receive: jest.fn(async (entity: any) => ({ id: RECEIPT, number: 'GR-000001', ...entity })),
		findAll: jest.fn(async () => ({ items: [{ id: RECEIPT }], total: 1 }))
	};
	const store = keyStore();
	const reflector = new Reflector();

	return {
		service,
		store,
		controller: new GoodsReceiptController(service as never),
		interceptor: new IdempotencyInterceptor(store as never, reflector)
	};
}

type Surface = ReturnType<typeof resource>;

/** One request to record a delivery, with the key when one is given. */
const request = (payload: unknown, key?: string): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/goods-receipts',
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
		getClass: () => GoodsReceiptController,
		getHandler: () => (GoodsReceiptController.prototype as any)[handler],
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

describe('the goods-receipt route — the retry declaration', () => {
	it('demands a key, under the scope the operation is named by', () => {
		expect(declarationOf(GoodsReceiptController, 'create')).toEqual({
			scope: 'purchase_order.receive',
			required: true,
			resourceType: 'goods_receipt'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		// One operation, two protocols: a key presented over GraphQL and the same key presented over REST
		// name the same operation, so a client may retry on either without booking the stock twice.
		expect(declarationOf(GoodsReceiptResolver, 'createGoodsReceipt')).toEqual(
			declarationOf(GoodsReceiptController, 'create')
		);
	});

	it('leaves the reversal alone, because ending a receipt twice ends it once', () => {
		expect(declarationOf(GoodsReceiptController, 'cancel')).toBeUndefined();
	});
});

describe('GoodsReceiptController — a delivery without a key', () => {
	it('refuses the request, naming IDEMPOTENCY_KEY_REQUIRED, before the service is reached', async () => {
		const surface = resource();
		const input = request(body());

		await expect(send(surface, 'create', input, [input.body, undefined])).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.service.receive).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('GoodsReceiptController — a retried delivery', () => {
	it('replays the first receipt for the same key and the same body, booking the stock once', async () => {
		const surface = resource();
		const first = request(body(), RECEIVE_KEY);
		const second = request(body(), RECEIVE_KEY);

		const sent = await send(surface, 'create', first, [first.body, undefined]);
		const replayed = await send(surface, 'create', second, [second.body, undefined]);

		expect(sent.result).toMatchObject({ id: RECEIPT, number: 'GR-000001' });
		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.receive).toHaveBeenCalledTimes(1);
		// The replay carries the answer the first attempt produced, status included, and says so.
		expect(replayed.response.headers['Idempotency-Replayed']).toBe('true');
		expect(replayed.response.statuses).toEqual([201]);
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();
		const first = request(body(), RECEIVE_KEY);
		const different = request(body({ lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '2.000000' }] }), RECEIVE_KEY);

		await send(surface, 'create', first, [first.body, undefined]);

		await expect(send(surface, 'create', different, [different.body, undefined])).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// Neither delivery was booked a second time: the key covers one receipt and only one.
		expect(surface.service.receive).toHaveBeenCalledTimes(1);
	});
});
