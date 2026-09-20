/**
 * Retry safety on the payout surface, as the execution route states it.
 *
 * `POST /api/seller-payouts/:id/pay` is the one route in this package where a retry moves money: a
 * client that loses the response has no way to know whether the provider was instructed, so it retries
 * — and without a key the seller is paid twice. This specification drives the **real kernel** over the
 * **real controller**: the real `@Idempotent()` decorator, the real interceptor and the real decision
 * policy, with only the payout service and the kernel's storage half doubled. Four answers are pinned:
 *
 * - a request that states no key is refused with `IDEMPOTENCY_KEY_REQUIRED` rather than executed, and
 *   nothing is claimed, so the refusal leaves no row behind;
 * - one key with one body replays the first attempt's answer and the handler runs exactly once;
 * - one key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, because answering it from
 *   the first attempt would answer a question the caller never asked;
 * - a route that has not adopted the convention reads no key, claims nothing and runs every time.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which this seam needs, so it is doubled at the module
 * boundary exactly as the package's other specifications do. The retry-safety kernel is the exception
 * and is taken from its own modules, because the kernel is what is under test here.
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
		Permissions: () => () => undefined,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		UseValidationPipe: () => () => undefined,
		UUIDValidationPipe: class {},
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		// The kernel is the subject here, so its own modules answer rather than a second copy of them.
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IdempotencyInterceptor: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.interceptor')
			.IdempotencyInterceptor
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
 * The interceptor names the kernel's storage service in its constructor, and importing that class
 * reaches the whole core persistence layer — every entity, the ORM wiring and the configuration the
 * columns are mapped from. This seam replaces that service with the in-memory store below, so the
 * module behind the name is doubled as well: the kernel's *decision* is what is under test here, not
 * how a row is persisted.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({ IdempotencyService: class {} }));

import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
	ID,
	IIdempotencyClaim,
	IIdempotencyKey,
	IdempotencyOutcome,
	IdempotencyStatus,
	JsonData,
	SellerPayoutStatus
} from '@gauzy/contracts';
import { ApiErrorCode, ApiException, IdempotencyInterceptor, IDEMPOTENT_METADATA_KEY } from '@gauzy/core';
import type { IdempotencyService } from '@gauzy/core';
import { defer, lastValueFrom } from 'rxjs';
import { SellerPayoutController } from './seller-payout.controller';
import { SellerPayoutService } from './seller-payout.service';

const PAYOUT_ID = '00000000-0000-4000-8000-0000000000a1' as ID;
const KEY = 'payout-pay-00000001';
const BODY = { paid: true, providerKey: 'acquirer', providerTransferId: 'tr_0001' };

/* ------------------------------------------------------------------------------------------------
 * The two doubles: the key store and the response
 * ---------------------------------------------------------------------------------------------- */

/**
 * The kernel's storage half, doubled over a map.
 *
 * It answers the four outcomes the interceptor decides from and nothing else: a free key is claimed, a
 * held key is in flight, a key whose recorded request differs is a reuse, and a key that finished is
 * replayed from the answer it stored. Keeping it this small is what makes the assertions below about
 * the interceptor's decisions rather than about a database.
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
		complete: async (recordId: ID, completion: { responseStatus?: number; responseBody?: JsonData }): Promise<void> => {
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

/** The Express response, reduced to the status and the headers the interceptor writes to. */
function createResponse(): any {
	const headers: Record<string, string> = {};
	let code: number | undefined;
	const response: any = {
		headers,
		statusCode: () => code,
		setHeader: (name: string, value: string) => {
			headers[name] = value;
		},
		status: (value: number) => {
			code = value;

			return response;
		}
	};

	return response;
}

/* ------------------------------------------------------------------------------------------------
 * Running one call of a route
 * ---------------------------------------------------------------------------------------------- */

/**
 * The execution context one HTTP route call runs in.
 *
 * The interceptor reads the type, the handler, the class, the request and the response, so the double
 * states exactly those: reaching the decision under test needs no Nest container and no server.
 */
function httpContext(handler: any, request: any, response: any): ExecutionContext {
	return {
		getType: () => 'http',
		getClass: () => SellerPayoutController,
		getHandler: () => handler,
		getArgs: () => [],
		getArgByIndex: () => undefined,
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => response
		})
	} as unknown as ExecutionContext;
}

/**
 * The payout controller over doubled services, under the real interceptor.
 *
 * `call` runs one route call the way the application runs it — the interceptor in front of the handler
 * — and answers either the result or the error, so a refusal is asserted on rather than thrown past the
 * assertion that explains it.
 */
function payRouteFixture() {
	const store = createKeyStore();
	const interceptor = new IdempotencyInterceptor(store as unknown as IdempotencyService, new Reflector());
	const recordExecution = jest.fn(async () => ({ id: PAYOUT_ID, status: SellerPayoutStatus.PAID }));
	const approve = jest.fn(async () => ({ id: PAYOUT_ID, status: SellerPayoutStatus.APPROVED }));
	const controller = new SellerPayoutController({
		recordExecution,
		approve
	} as unknown as SellerPayoutService);

	const call = async (options: {
		method: 'pay' | 'approve';
		body?: unknown;
		key?: string;
	}): Promise<{ result?: any; error?: any; response: any }> => {
		const response = createResponse();
		const request = {
			method: 'POST',
			url: `/api/seller-payouts/${PAYOUT_ID}/pay`,
			originalUrl: `/api/seller-payouts/${PAYOUT_ID}/pay`,
			query: {},
			body: options.body,
			rawBody: JSON.stringify(options.body ?? null),
			headers: options.key ? { 'idempotency-key': options.key } : {}
		};
		const handler = (controller as any)[options.method];
		const next = { handle: () => defer(() => handler.call(controller, PAYOUT_ID, options.body)) };

		try {
			const result = await lastValueFrom(interceptor.intercept(httpContext(handler, request, response), next));

			return { result, response };
		} catch (error) {
			return { error, response };
		}
	};

	return { store, call, recordExecution, approve };
}

/* ------------------------------------------------------------------------------------------------
 * The invariants
 * ---------------------------------------------------------------------------------------------- */

describe('SellerPayoutController — the execution route (seller.payout.pay)', () => {
	it('declares itself retry-safe and states what the key holds', () => {
		// The scope is the operation's identity, and `required` is what turns a client that forgot a key
		// into a refusal rather than a second transfer.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, SellerPayoutController.prototype.pay)).toEqual({
			scope: 'seller.payout.pay',
			required: true,
			resourceType: 'seller_payout'
		});
	});

	it('refuses a request that states no key, running no handler and claiming nothing', async () => {
		const fixture = payRouteFixture();

		const attempt = await fixture.call({ method: 'pay', body: BODY });

		expect(attempt.error).toBeInstanceOf(ApiException);
		expect(attempt.error.code).toBe(ApiErrorCode.IDEMPOTENCY_KEY_REQUIRED);
		expect(attempt.error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
		expect(fixture.recordExecution).not.toHaveBeenCalled();
		expect(fixture.store.rows.size).toBe(0);
	});

	it('answers a repeat of one key and one body from the first attempt, running the handler once', async () => {
		const fixture = payRouteFixture();

		const first = await fixture.call({ method: 'pay', body: BODY, key: KEY });
		const second = await fixture.call({ method: 'pay', body: BODY, key: KEY });

		expect(first.error).toBeUndefined();
		expect(second.error).toBeUndefined();
		expect(second.result).toEqual(first.result);
		// One key, one side effect: the provider is instructed once, and the second request is answered
		// from the response the first attempt recorded.
		expect(fixture.recordExecution).toHaveBeenCalledTimes(1);
		expect(fixture.store.rows.size).toBe(1);
	});

	it('marks a replayed answer, so a client can tell it from a first one', async () => {
		const fixture = payRouteFixture();

		const first = await fixture.call({ method: 'pay', body: BODY, key: KEY });
		const second = await fixture.call({ method: 'pay', body: BODY, key: KEY });

		expect(first.response.headers['Idempotency-Replayed']).toBeUndefined();
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
		expect(second.response.headers['Idempotency-Original-Request']).toBeDefined();
	});

	it('refuses the same key presented with a different body', async () => {
		const fixture = payRouteFixture();

		await fixture.call({ method: 'pay', body: BODY, key: KEY });
		const reused = await fixture.call({
			method: 'pay',
			body: { ...BODY, providerTransferId: 'tr_0002' },
			key: KEY
		});

		expect(reused.error).toBeInstanceOf(ApiException);
		expect(reused.error.code).toBe(ApiErrorCode.IDEMPOTENCY_KEY_REUSED);
		expect(reused.error.getStatus()).toBe(HttpStatus.CONFLICT);
		expect(fixture.recordExecution).toHaveBeenCalledTimes(1);
	});
});

describe('SellerPayoutController — a route that has not adopted the convention', () => {
	it('declares no scope on the approval route', () => {
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, SellerPayoutController.prototype.approve)).toBeUndefined();
	});

	it('reads no key, claims nothing and runs the handler on every call', async () => {
		const fixture = payRouteFixture();

		await fixture.call({ method: 'approve', key: KEY });
		await fixture.call({ method: 'approve', key: KEY });

		expect(fixture.approve).toHaveBeenCalledTimes(2);
		expect(fixture.store.rows.size).toBe(0);
	});
});
