/**
 * The offering batch over REST, as the route runs it.
 *
 * The endpoint table declares one bulk route — `POST /api/seller-offerings/bulk`, "bulk publish, pause,
 * withdraw or re-price" — and this specification pins what a controller owes a batch that a service
 * cannot state for it:
 *
 * - **the batch is the platform's**, run by the real `BulkExecutor` over the route's own
 *   `@BulkOperation` declaration, so the resource, the cap, the permission and the members an item must
 *   carry are read from that declaration rather than restated in the route body;
 * - **atomic means atomic.** A batch that asks for it writes nothing when one item fails and names the
 *   item that refused it; a batch that does not keeps what applied and reports the rest — which is the
 *   whole difference the flag exists to state;
 * - **the whole request is one authorisation decision**, made before the first item, with the edit
 *   permission the endpoint table declares;
 * - **the retry declaration is one scope**, so a batch re-sent with the same `Idempotency-Key` is answered
 *   from its first attempt instead of moving its listings again;
 * - **every item carries the seller scope the guard resolved**, so a seller-scoped caller reaches its own
 *   offerings through the batch exactly as it reaches them through the single-item routes.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which this seam needs, so it is doubled at the module boundary
 * exactly as the package's other specifications do. Three pieces are the kernel's own rather than a copy:
 * the retry-safety decorator and its interceptor, and the bulk decorator, its reader and the executor the
 * route runs — because those are what is under test here.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		CrudService: class {},
		CrudController: class {},
		TenantAwareCrudService,
		MikroOrmBaseEntityRepository: class {},
		EventBus: class {},
		BaseEvent: class {},
		EventOutboxService: class {},
		EventOutboxModule: class {},
		RolePermissionModule: class {},
		SequenceService: class {},
		SequenceModule: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		ColumnIndex: decorator,
		JsonColumn: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		IsSecret: decorator,
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The decimal comparison the commission bands and the settlement's discrepancy are decided by is
		// the kernel's own, so the double hands over the real one: a comparison doubled here would agree
		// with the service about arithmetic the platform never performs.
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		// The kernel is the subject here, so its own modules answer rather than a second copy of them.
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		UseValidationPipe: () => () => undefined,
		UUIDValidationPipe: class {},
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IdempotencyInterceptor: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.interceptor')
			.IdempotencyInterceptor,
		BulkOperation: jest.requireActual('@gauzy/core/src/lib/api/bulk.decorator').BulkOperation,
		readBulkOperation: jest.requireActual('@gauzy/core/src/lib/api/bulk.decorator').readBulkOperation,
		bulkOptionsOf: jest.requireActual('@gauzy/core/src/lib/api/bulk.decorator').bulkOptionsOf,
		BulkExecutor: jest.requireActual('@gauzy/core/src/lib/api/bulk-executor.service').BulkExecutor
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

/**
 * The batch executor names the field-visibility service in its constructor, and importing that class
 * reaches the whole core persistence layer — the request context, its configuration and the token
 * libraries — none of which a batch needs. The seam doubles the module behind the name as well, exactly as
 * the payout surface's specification doubles the kernel's key store: the executor is the real one here, and
 * the visibility it authorises through is the in-memory predicate the fixture builds.
 */
jest.mock('@gauzy/core/src/lib/api/field-visibility.service', () => ({ FieldVisibility: class {} }));

/**
 * The interceptor names the kernel's key store in its constructor, and importing that class reaches the
 * persistence layer for the same reason. The fixture supplies the in-memory store below instead, so what
 * is under test is the kernel's *decision* and not how a key row is written.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({ IdempotencyService: class {} }));

import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import type { ID, IIdempotencyClaim, IIdempotencyKey, JsonData } from '@gauzy/contracts';
import { IdempotencyOutcome, IdempotencyStatus, PermissionsEnum } from '@gauzy/contracts';
import {
	ApiErrorCode,
	ApiException,
	BulkExecutor,
	IDEMPOTENT_METADATA_KEY,
	IdempotencyInterceptor,
	bulkOptionsOf,
	readBulkOperation
} from '@gauzy/core';
import type { FieldVisibility, IdempotencyService } from '@gauzy/core';
import { defer, lastValueFrom } from 'rxjs';
import { SellerOfferingController } from './seller-offering.controller';
import type { SellerOfferingService } from './seller-offering.service';
import {
	IBulkSellerOfferingItem,
	SELLER_OFFERING_BULK_REQUIRED_KEYS,
	SellerOfferingBulkOperation
} from './seller-offering.bulk';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SELLER = '00000000-0000-4000-8000-000000000003';
const OFFERING_ONE = '00000000-0000-4000-8000-000000000010';
const OFFERING_TWO = '00000000-0000-4000-8000-000000000011';
const KEY = 'offering-bulk-00000001';

/** The offering an item moved, as the service answers with it. */
const MOVED = { id: OFFERING_ONE, sellerId: SELLER, tenantId: TENANT, organizationId: ORGANIZATION, status: 'ACTIVE' };

/* ------------------------------------------------------------------------------------------------
 * The route, over a scripted service and the platform's own executor
 * ---------------------------------------------------------------------------------------------- */

/**
 * The batch, as the route runs it.
 *
 * The service is scripted and the executor is the platform's own, so what is asserted below is the route's
 * half of the contract: that its declaration configures the executor, that it supplies the transaction the
 * service owns, that every item is handed the manager that transaction opened together with the scope the
 * guard resolved, and that the executor's rollback is allowed to be the whole outcome of an atomic batch.
 *
 * The service records what it applied the way a database records it: a transaction that threw leaves
 * nothing behind, which is what makes "an atomic batch writes nothing" an assertion about behaviour rather
 * than about a call count.
 *
 * @param options The grants the field-visibility double answers.
 * @returns The controller and everything the assertions read.
 */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const granted = options.granted ?? [PermissionsEnum.SELLER_OFFERINGS_EDIT];
	const writes: string[] = [];
	const commits: string[][] = [];
	const managers: unknown[] = [];
	const scopes: unknown[] = [];
	const manager = { connection: 'the batch transaction' };

	const sellerOfferingService = {
		applyBulkItem: jest.fn(async (item: IBulkSellerOfferingItem, scope?: unknown, receivedManager?: unknown) => {
			managers.push(receivedManager);
			scopes.push(scope);

			if (item.id === OFFERING_TWO) {
				throw new ApiException(
					409,
					ApiErrorCode.CONCURRENT_MODIFICATION,
					'The offering is not in a state this operation serves.',
					{ field: 'operation' }
				);
			}

			writes.push(`${item.operation}:${item.id}`);

			return { ...MOVED, id: item.id };
		}),
		transaction: jest.fn(async (work: (transactional: unknown) => Promise<unknown>) => {
			const before = [...writes];

			try {
				const result = await work(manager);

				commits.push([...writes]);

				return result;
			} catch (error) {
				writes.splice(0, writes.length, ...before);

				throw error;
			}
		})
	};
	// The executor authorises the whole request through the platform's field visibility, so the double
	// answers a permission exactly as that service does: a caller who does not hold it is refused.
	const visibility = {
		assertCanSee: jest.fn((permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}),
		canSee: jest.fn().mockReturnValue(granted.length > 0)
	} as unknown as FieldVisibility;

	return {
		writes,
		commits,
		managers,
		scopes,
		manager,
		sellerOfferingService,
		visibility,
		controller: new SellerOfferingController(
			sellerOfferingService as unknown as SellerOfferingService,
			new BulkExecutor(visibility)
		)
	};
}

/** The route one handler declares, as Nest's own metadata states it. */
function routeOf(handler: string): { path: string; method: RequestMethod } {
	const prototype = SellerOfferingController.prototype as unknown as Record<string, object>;

	return {
		path: Reflect.getMetadata(PATH_METADATA, prototype[handler]),
		method: Reflect.getMetadata(METHOD_METADATA, prototype[handler])
	};
}

/** A request as the guard leaves it: the resolved seller scope rides on the request. */
const request = { sellerScope: { sellerId: SELLER, staff: false } };

/** The two items a batch of this fixture carries: the first applies, the second is refused. */
const batch = (atomic?: boolean) => ({
	...(atomic === undefined ? {} : { atomic }),
	items: [
		{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.PUBLISH, channelIds: ['channel-1'] },
		{ id: OFFERING_TWO, operation: SellerOfferingBulkOperation.PAUSE }
	]
});

describe('SellerOfferingController — the batch applies what it can, or nothing at all', () => {
	it('applies a batch that is not atomic item by item, and reports the failures beside the successes', async () => {
		const { controller, writes } = surfaces();

		const result = await controller.bulk(request, batch());

		expect(result.total).toBe(2);
		expect(result.succeededCount).toBe(1);
		expect(result.failedCount).toBe(1);
		expect(result.succeededCount + result.failedCount).toBe(result.total);
		expect(result.succeeded).toEqual([{ index: 0, id: OFFERING_ONE, resource: 'seller_offering' }]);
		expect(result.failed[0]).toMatchObject({
			index: 1,
			id: OFFERING_TWO,
			code: ApiErrorCode.CONCURRENT_MODIFICATION,
			details: { field: 'operation' }
		});
		// Control: the item that applied stands. A batch without the flag is a sequence of writes, and the
		// item that was refused does not undo the one before it — which is what distinguishes it from the
		// atomic case below.
		expect(writes).toEqual([`${SellerOfferingBulkOperation.PUBLISH}:${OFFERING_ONE}`]);
	});

	it('writes nothing when one item of an atomic batch fails, and names the item that failed', async () => {
		const { controller, writes, commits } = surfaces();

		const refusal = await controller.bulk(request, batch(true)).catch((thrown) => thrown);

		// The failure is the failing item's own code, which is what the caller branches on, and the complete
		// per-item report travels beside it.
		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.CONCURRENT_MODIFICATION);
		expect((refusal as ApiException).getStatus()).toBe(409);
		expect((refusal as ApiException).details).toMatchObject({ failedCount: 1, total: 2 });
		expect(((refusal as ApiException).details.items as Array<Record<string, unknown>>)[0]).toMatchObject({
			index: 1,
			id: OFFERING_TWO
		});
		// Nothing is committed and nothing survives the rollback: that is the whole of what the flag asks.
		// Control: the batch did run — the writes were attempted and then undone — so this cannot pass by the
		// route having applied nothing at all.
		expect(commits).toHaveLength(0);
		expect(writes).toEqual([]);
	});

	it('runs an atomic batch inside the service’s own transaction, and hands every item its manager', async () => {
		const { controller, sellerOfferingService, manager, managers, commits } = surfaces();
		const applies = { ...batch(true) };
		applies.items = [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.PUBLISH }];

		const result = await controller.bulk(request, applies);

		expect(result.succeededCount).toBe(1);
		// Control: the executor refuses an atomic batch the route supplied no transaction for, so this asserts
		// the route handed it the service's runner rather than none — and that every item was given the
		// manager that runner opened, which is what makes an item's write part of the batch.
		expect(sellerOfferingService.transaction).toHaveBeenCalledTimes(1);
		expect(managers).toEqual([manager]);
		expect(commits).toHaveLength(1);
	});

	it('hands every item the seller scope the guard resolved', async () => {
		const { controller, scopes } = surfaces();

		await controller.bulk(request, batch());

		// Control: the scope is the guard's answer rather than a second resolution, so a request that carries
		// none hands the service none — which is what a staff caller's request looks like — and a seller-scoped
		// request hands over exactly what the guard resolved.
		expect(scopes).toEqual([request.sellerScope, request.sellerScope]);
		await controller.bulk({}, { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.PAUSE }] });
		expect(scopes).toEqual([request.sellerScope, request.sellerScope, undefined]);
	});

	it('authorises the whole batch once, before the first item, with the offering’s edit permission', async () => {
		const { controller, sellerOfferingService, visibility } = surfaces({ granted: [] });

		const refusal = await controller
			.bulk(request, { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.WITHDRAW }] })
			.catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect((refusal as ApiException).getStatus()).toBe(403);
		expect(sellerOfferingService.applyBulkItem).not.toHaveBeenCalled();
		// One decision for the request: a page of listings is not one authorisation answer per listing.
		expect(visibility.assertCanSee).toHaveBeenCalledTimes(1);
		expect(visibility.assertCanSee).toHaveBeenCalledWith(PermissionsEnum.SELLER_OFFERINGS_EDIT, {
			resource: 'seller_offering',
			mode: 'write'
		});
	});

	it('refuses an item that names no operation before any item is applied', async () => {
		const { controller, sellerOfferingService } = surfaces();

		const refusal = await controller
			.bulk(request, { items: [{ id: OFFERING_ONE } as never] })
			.catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ALL_ITEMS_FAILED);
		expect((refusal as ApiException).details).toMatchObject({
			items: [
				{
					index: 0,
					code: ApiErrorCode.VALIDATION_REQUIRED_FIELD,
					details: { field: 'operation' }
				}
			]
		});
		expect(sellerOfferingService.applyBulkItem).not.toHaveBeenCalled();
	});

	it('refuses an item that names no offering before any item is applied', async () => {
		const { controller, sellerOfferingService } = surfaces();

		const refusal = await controller
			.bulk(request, { items: [{ operation: SellerOfferingBulkOperation.PAUSE } as never] })
			.catch((thrown) => thrown);

		// Control: no operation of this batch creates a row, so an item that names none is reported rather
		// than applied to whichever offering happened to be at hand.
		expect((refusal as ApiException).details).toMatchObject({
			items: [
				{
					index: 0,
					code: ApiErrorCode.VALIDATION_REQUIRED_FIELD,
					details: { field: 'id' }
				}
			]
		});
		expect(sellerOfferingService.applyBulkItem).not.toHaveBeenCalled();
	});

	it('refuses a batch that asks for a dry run, applying nothing', async () => {
		const { controller, sellerOfferingService, writes } = surfaces();

		const refusal = await controller.bulk(request, { ...batch(), dryRun: true } as never).catch((thrown) => thrown);

		// Control: the executor honours a dry run by applying every item with no transaction, so a route that
		// ignored the member would answer a "validate and write nothing" request with the writes it asked not
		// to make. This route declares no such pass and says so instead.
		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect((refusal as ApiException).details).toEqual({ field: 'dryRun' });
		expect(sellerOfferingService.applyBulkItem).not.toHaveBeenCalled();
		expect(writes).toEqual([]);
	});
});

describe('SellerOfferingController — the route declarations the executor and the kernel read', () => {
	it('declares the batch as a POST on its own path, beside the four single-item moves', () => {
		expect(routeOf('bulk')).toEqual({ path: '/bulk', method: RequestMethod.POST });
		expect(routeOf('publish')).toEqual({ path: '/:id/publish', method: RequestMethod.POST });
		expect(routeOf('unpublish')).toEqual({ path: '/:id/unpublish', method: RequestMethod.POST });
		expect(routeOf('withdraw')).toEqual({ path: '/:id', method: RequestMethod.DELETE });
	});

	it('declares the batch the executor is configured from: the resource, the cap and the permission', () => {
		expect(readBulkOperation(SellerOfferingController.prototype.bulk)).toEqual({
			resource: 'seller_offering',
			maxItems: 200,
			permission: PermissionsEnum.SELLER_OFFERINGS_EDIT
		});
		// Control: the reader refuses a route that declares no batch at all, so this is the one declaration
		// both surfaces run the batch from rather than a second copy written into a route body — and it is read
		// off the route's own metadata, not restated here.
		expect(bulkOptionsOf(SellerOfferingController, 'bulk')).toEqual({
			resource: 'seller_offering',
			cap: 200,
			permission: PermissionsEnum.SELLER_OFFERINGS_EDIT
		});
		expect(() => bulkOptionsOf(SellerOfferingController, 'publish')).toThrow(/declares no @BulkOperation/);
	});

	it('requires every item to name its offering and its operation, whichever kind it declares', () => {
		// The batch's own pre-pass is configured from this, so a member missing here is a member the executor
		// would let through and the service would then have to refuse item by item.
		expect(SELLER_OFFERING_BULK_REQUIRED_KEYS()).toEqual(['id', 'operation']);
	});

	it('declares the retry scope the platform stores keys under, and does not demand a key', () => {
		// A batch is safe to retry under a key and is not refused without one, which is what the endpoint
		// table states: the route honours a key and does not require it.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, SellerOfferingController.prototype.bulk)).toEqual({
			scope: 'seller_offering.bulk',
			required: false,
			resourceType: 'seller_offering'
		});
	});

	it('carries the edit permission the endpoint table declares, and no other', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SellerOfferingController.prototype.bulk)).toEqual([
			PermissionsEnum.SELLER_OFFERINGS_EDIT
		]);
	});
});

/* ------------------------------------------------------------------------------------------------
 * The retry key, through the kernel's own interceptor
 * ---------------------------------------------------------------------------------------------- */

/**
 * The kernel's storage half, doubled over a map.
 *
 * It answers the four outcomes the interceptor decides from and nothing else: a free key is claimed, a held
 * key is in flight, a key whose recorded request differs is a reuse, and a key that finished is replayed
 * from the answer it stored.
 */
function createKeyStore() {
	const rows = new Map<string, IIdempotencyKey & { id: string }>();
	let sequence = 0;

	const find = (recordId: ID) => [...rows.values()].find((row) => row.id === (recordId as unknown as string));

	return {
		rows,
		claim: async (input: { scope: string; key: string; requestHash: string }): Promise<IIdempotencyClaim> => {
			const slot = `${input.scope}\u0000${input.key}`;
			const existing = rows.get(slot);

			if (!existing) {
				const record = {
					id: `key-${++sequence}`,
					key: input.key,
					scope: input.scope,
					requestHash: input.requestHash,
					status: IdempotencyStatus.IN_PROGRESS,
					expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
					createdAt: new Date(),
					lockedAt: new Date()
				} as IIdempotencyKey & { id: string };

				rows.set(slot, record);

				return { outcome: IdempotencyOutcome.CLAIMED, record };
			}

			if (existing.status === IdempotencyStatus.IN_PROGRESS) {
				return { outcome: IdempotencyOutcome.IN_FLIGHT, record: existing, retryAfterMs: 1000 };
			}

			if (existing.requestHash !== input.requestHash) {
				return { outcome: IdempotencyOutcome.REUSED_KEY, record: existing };
			}

			return {
				outcome: IdempotencyOutcome.REPLAYED,
				record: existing,
				response: { status: existing.responseStatus, body: existing.responseBody }
			};
		},
		complete: async (
			recordId: ID,
			completion: { responseStatus?: number; responseBody?: JsonData }
		): Promise<void> => {
			const found = find(recordId);
			if (!found) return;

			found.status = IdempotencyStatus.COMPLETED;
			found.responseStatus = completion.responseStatus;
			found.responseBody = completion.responseBody;
		},
		fail: async (recordId: ID, completion: { responseStatus?: number }): Promise<void> => {
			const found = find(recordId);
			if (!found) return;

			found.status = IdempotencyStatus.FAILED;
			found.responseStatus = completion.responseStatus;
		}
	};
}

/** The Express response, reduced to the headers the interceptor writes to. */
function createResponse(): any {
	const headers: Record<string, string> = {};

	return {
		headers,
		setHeader: (name: string, value: string) => {
			headers[name] = value;
		},
		status: () => undefined
	};
}

/**
 * The execution context one HTTP route call runs in.
 *
 * The interceptor reads the type, the handler, the class, the request and the response, so the double
 * states exactly those: reaching the decision under test needs no Nest container and no server.
 */
function httpContext(handler: any, incoming: any, response: any): ExecutionContext {
	return {
		getType: () => 'http',
		getClass: () => SellerOfferingController,
		getHandler: () => handler,
		getArgs: () => [],
		getArgByIndex: () => undefined,
		switchToHttp: () => ({
			getRequest: () => incoming,
			getResponse: () => response
		})
	} as unknown as ExecutionContext;
}

/**
 * The bulk route over the scripted service, under the kernel's own interceptor.
 *
 * `call` runs one route call the way the application runs it — the interceptor in front of the handler —
 * and answers either the result or the error, so a refusal is asserted on rather than thrown past the
 * assertion that explains it.
 */
function bulkRouteFixture() {
	const store = createKeyStore();
	const interceptor = new IdempotencyInterceptor(store as unknown as IdempotencyService, new Reflector());
	const batchSurfaces = surfaces();

	const call = async (options: {
		body: unknown;
		key?: string;
	}): Promise<{ result?: any; error?: any; response: any }> => {
		const response = createResponse();
		const incoming = {
			method: 'POST',
			url: '/api/seller-offerings/bulk',
			originalUrl: '/api/seller-offerings/bulk',
			query: {},
			body: options.body,
			rawBody: JSON.stringify(options.body ?? null),
			headers: options.key ? { 'idempotency-key': options.key } : {},
			sellerScope: request.sellerScope
		};
		// The handler is the method itself rather than a bound copy of it, because the declaration the
		// interceptor decides from is metadata on that function: a bound copy carries none, and the call would
		// then run as though the route had never adopted the convention.
		const handler = (batchSurfaces.controller as any).bulk;
		const next = {
			handle: () => defer(() => handler.call(batchSurfaces.controller, incoming, options.body))
		};

		try {
			const result = await lastValueFrom(interceptor.intercept(httpContext(handler, incoming, response), next));

			return { result, response };
		} catch (error) {
			return { error, response };
		}
	};

	return { store, call, ...batchSurfaces };
}

describe('SellerOfferingController — the same key replayed does not move the listings twice', () => {
	it('answers a repeat of one key and one body from the first attempt, applying the batch once', async () => {
		const fixture = bulkRouteFixture();
		const body = { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.PUBLISH }] };

		const first = await fixture.call({ body, key: KEY });
		const second = await fixture.call({ body, key: KEY });

		expect(first.error).toBeUndefined();
		expect(second.error).toBeUndefined();
		expect(second.result).toEqual(first.result);
		// One key, one side effect: the listing moves once, and the second request is answered from the
		// response the first attempt recorded. Control: the response is compared as well as the count, so a
		// replayed answer that carried a different body would fail here.
		expect(fixture.sellerOfferingService.applyBulkItem).toHaveBeenCalledTimes(1);
		expect(fixture.store.rows.size).toBe(1);
	});

	it('marks a replayed answer, so a client can tell it from a first one', async () => {
		const fixture = bulkRouteFixture();
		const body = { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.WITHDRAW }] };

		const first = await fixture.call({ body, key: KEY });
		const second = await fixture.call({ body, key: KEY });

		expect(first.response.headers['Idempotency-Replayed']).toBeUndefined();
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
		expect(second.response.headers['Idempotency-Original-Request']).toBeDefined();
	});

	it('runs a batch that presents no key, because the route honours one and does not demand it', async () => {
		const fixture = bulkRouteFixture();
		const body = { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.PAUSE }] };

		const first = await fixture.call({ body });
		const second = await fixture.call({ body });

		expect(first.error).toBeUndefined();
		expect(second.error).toBeUndefined();
		// Control: the key is required on the route that moves money and on no other, so this asserts the
		// batch was applied on both attempts and claimed no key — a route that demanded one would refuse here
		// with `IDEMPOTENCY_KEY_REQUIRED`.
		expect(fixture.sellerOfferingService.applyBulkItem).toHaveBeenCalledTimes(2);
		expect(fixture.store.rows.size).toBe(0);
	});

	it('refuses the same key presented with a different batch', async () => {
		const fixture = bulkRouteFixture();
		const body = { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.PAUSE }] };

		await fixture.call({ body, key: KEY });
		const reused = await fixture.call({
			body: { items: [{ id: OFFERING_ONE, operation: SellerOfferingBulkOperation.WITHDRAW }] },
			key: KEY
		});

		// Answering the second request from the first attempt would answer a question the caller never asked,
		// so the kernel refuses it rather than replaying.
		expect(reused.error).toBeInstanceOf(ApiException);
		expect(reused.error.code).toBe(ApiErrorCode.IDEMPOTENCY_KEY_REUSED);
		expect(fixture.sellerOfferingService.applyBulkItem).toHaveBeenCalledTimes(1);
	});
});
