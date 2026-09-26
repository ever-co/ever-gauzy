/**
 * The module boundaries are doubled, and retry safety is left real — the kernel's `Idempotent`
 * decorator, its metadata key and its interceptor, over an in-memory double of the key store — for the
 * reasons `payment-capture.controller.spec.ts` states in full. The resource under test is the real
 * one: the refund-reason controller and the refund-reason resolver over a stubbed kernel service.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	const decorator = () => () => undefined;

	class BaseEntity {}

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
		// `@UsePipes(new AbstractValidationPipe(...))` on the inherited mutating routes is
		// evaluated when the controller class is defined, and Nest requires a pipe to expose
		// `transform`, so the double has to as well.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
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
		Payment: class Payment {},
		Integration: class Integration {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class FeatureFlagGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
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
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		},
		isMySQL: () => false,
		isPostgres: () => true
	})
);

/**
 * The interceptor names `IdempotencyService` as its injected dependency, and a class used in a
 * constructor signature is emitted as a value, so the service is doubled at its own module: the
 * interceptor under test is the real one.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { RefundReasonController } from './refund-reason.controller';
import { RefundReasonResolver } from '../graphql/resolvers/refund-reason.resolver';

/**
 * The governed refund reasons — the retry contract of creating one (06 §6.7, §7.7).
 *
 * A reason is refused when its code is taken, so a duplicate is already harmless and the key is
 * **optional**: a client that lost the answer presents one and is answered from the record rather than
 * refused for a duplicate it did not intend. The suite pins that the option is real:
 *
 * - the route and the mutation that mirror each other declare the same scope, and neither requires a
 *   key;
 * - a request that presents none is untouched — no header is read and no claim is recorded;
 * - a request that presents one is answered from the record on a repeat, so the handler runs once;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`;
 * - a route that declares no scope stays untouched.
 */

const REASON = '00000000-0000-4000-8000-0000000000b2';
const REASON_KEY = 'reason-key-0001';

/** What a client sends as the body of a reason. */
const body = (overrides: Record<string, unknown> = {}) => ({
	code: 'damaged',
	label: 'Damaged',
	...overrides
});

/** The key store, doubled in memory, answering the vocabulary the interceptor reads. */
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
				responseBody: completion.responseBody
			})
		),
		fail: jest.fn(async (id: string, completion: any) =>
			Object.assign(byId(id), { status: 'FAILED', responseStatus: completion.responseStatus })
		)
	};
}

/** A response double, recording what an interceptor wrote onto it and the status it set. */
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

/** One request as the transport hands it to an interceptor. */
interface RequestDouble {
	method: string;
	originalUrl: string;
	query: Record<string, unknown>;
	body: unknown;
	headers: Record<string, string>;
}

/**
 * Calls one method of a controller or resolver on its own instance, without naming its signature: a
 * handler reached through the prototype is reached without its receiver.
 */
const invoke = (instance: object, handler: string, ...args: unknown[]): Promise<unknown> =>
	(instance as unknown as Record<string, (...rest: unknown[]) => Promise<unknown>>)[handler].call(
		instance,
		...args
	);

/** The retry declaration a handler carries, as the interceptor reads it. */
const declarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (surface.prototype as never)[handler]);

/** The resource over a stubbed kernel service and one in-memory key store. */
function resource() {
	const kernel = {
		createReason: jest.fn(async (entity: any) => ({ id: REASON, isActive: true, ...entity })),
		updateReason: jest.fn(async () => ({ id: REASON })),
		deactivateReason: jest.fn(async () => ({ id: REASON, isActive: false })),
		findReasons: jest.fn(async () => ({ items: [{ id: REASON }], total: 1 })),
		findReasonOrFail: jest.fn(async () => ({ id: REASON }))
	};
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new RefundReasonController(kernel as never),
		resolver: new RefundReasonResolver(kernel as never),
		interceptor: new IdempotencyInterceptor(store as never, new Reflector())
	};
}

/** Sends one HTTP request through the interceptor the way the application does. */
async function request(
	surface: ReturnType<typeof resource>,
	handler: string,
	input: RequestDouble
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	const context = {
		getType: () => 'http',
		getClass: () => RefundReasonController,
		getHandler: () => (RefundReasonController.prototype as never)[handler],
		switchToHttp: () => ({ getRequest: () => input, getResponse: () => response }),
		getArgByIndex: (index: number) => [null, input][index]
	} as unknown as ExecutionContext;

	const result = await lastValueFrom(
		surface.interceptor.intercept(context, {
			handle: () => from(invoke(surface.controller, handler, input.body))
		})
	);

	return { result, response };
}

type ResponseDouble = ReturnType<typeof responseDouble>;

/** The request a client creating a reason sends. */
const reason = (key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/refund-reasons',
	query: {},
	body: body(overrides),
	headers: key ? { 'idempotency-key': key } : {}
});

describe('the refund-reason route — the retry declaration (06 §6.7)', () => {
	it('honours a key without requiring one', () => {
		expect(declarationOf(RefundReasonController, 'create')).toEqual({
			scope: 'refund.reason.create',
			required: false,
			resourceType: 'refund_reason'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(RefundReasonResolver, 'createRefundReason')).toEqual(
			declarationOf(RefundReasonController, 'create')
		);
	});
});

describe('RefundReasonController — a reason with no key (06 §6.7)', () => {
	it('runs the handler and records nothing', async () => {
		const surface = resource();

		await expect(request(surface, 'create', reason())).resolves.toMatchObject({
			result: { id: REASON, isActive: true }
		});
		expect(surface.kernel.createReason).toHaveBeenCalledTimes(1);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('RefundReasonController — a reason under a key (06 §6.7)', () => {
	it('replays the first reason for the same key and the same body', async () => {
		const surface = resource();

		const first = await request(surface, 'create', reason(REASON_KEY));
		const second = await request(surface, 'create', reason(REASON_KEY));

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createReason).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different code under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'create', reason(REASON_KEY, { code: 'damaged' }));

		await expect(request(surface, 'create', reason(REASON_KEY, { code: 'lost' }))).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		expect(surface.kernel.createReason).toHaveBeenCalledTimes(1);
	});

	it('leaves a route that declares no scope untouched, key or no key', async () => {
		const surface = resource();

		await expect(request(surface, 'update', reason(REASON_KEY))).resolves.toMatchObject({
			result: { id: REASON }
		});

		expect(declarationOf(RefundReasonController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});
