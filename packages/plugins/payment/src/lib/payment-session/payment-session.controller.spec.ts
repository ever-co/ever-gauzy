/**
 * The module boundaries are doubled, and retry safety is left real — the kernel's `Idempotent`
 * decorator, its metadata key and its interceptor, over an in-memory double of the key store — for the
 * reasons `payment-capture.controller.spec.ts` states in full. The resource under test is the real
 * one: the session controller and the session resolver over a stubbed kernel service.
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
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
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
	}),
	{ virtual: true }
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
import { PaymentSessionController } from './payment-session.controller';
import { PaymentSessionResolver } from '../graphql/resolvers/payment-session.resolver';

/**
 * The attempts made at collecting a collection — the retry contract of the three acts that carry one
 * (06-api-specification.md §6.4, §7.4).
 *
 * Opening an attempt reserves nothing and switches the pair rather than opening a second attempt;
 * authorising one reserves the amount and is refused once the attempt is already authorised; and
 * cancelling one releases the authorisation it holds. None of the three needs a key to stay correct,
 * so the key is **optional** on all of them — and the suite pins that the option is real:
 *
 * - each route and the mutation that mirrors it declare the same scope, and none of them requires a
 *   key;
 * - a request that presents none is untouched — no header is read and no claim is recorded;
 * - a request that presents one is answered from the record on a repeat, so the handler runs once,
 *   which is what stops a retried cancel from releasing an authorisation twice;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`;
 * - a route that declares no scope stays untouched.
 */

const SESSION = '00000000-0000-4000-8000-0000000000d2';
const COLLECTION = '00000000-0000-4000-8000-0000000000a4';
const PROVIDER = '00000000-0000-4000-8000-0000000000e2';
const SESSION_KEY = 'session-key-0001';
const CANCEL_KEY = 'cancel-key-0001';

/** What a client sends as the body of an attempt. */
const body = (overrides: Record<string, unknown> = {}) => ({
	collectionId: COLLECTION,
	providerId: PROVIDER,
	amount: '10.000000',
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
	/** The arguments the handler is called with, because two of the three routes name their session. */
	args: unknown[];
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
		openSession: jest.fn(async (entity: any) => ({ id: SESSION, status: 'PENDING', ...entity })),
		authorizeSession: jest.fn(async (id: string, entity: any) => ({ id, status: 'AUTHORIZED', ...entity })),
		voidSession: jest.fn(async (id: string) => ({ id, status: 'CANCELED' })),
		refreshSession: jest.fn(async (id: string) => ({ id })),
		update: jest.fn(async () => ({ id: SESSION })),
		findSessions: jest.fn(async () => ({ items: [{ id: SESSION }], total: 1 })),
		findSessionOrFail: jest.fn(async () => ({ id: SESSION }))
	};
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new PaymentSessionController(kernel as never),
		resolver: new PaymentSessionResolver(kernel as never),
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
		getClass: () => PaymentSessionController,
		getHandler: () => (PaymentSessionController.prototype as never)[handler],
		switchToHttp: () => ({ getRequest: () => input, getResponse: () => response }),
		getArgByIndex: (index: number) => [null, input][index]
	} as unknown as ExecutionContext;

	const result = await lastValueFrom(
		surface.interceptor.intercept(context, {
			handle: () => from(invoke(surface.controller, handler, ...input.args))
		})
	);

	return { result, response };
}

type ResponseDouble = ReturnType<typeof responseDouble>;

/** Runs one GraphQL mutation through the interceptor, with the arguments a resolver receives. */
async function mutate(
	surface: ReturnType<typeof resource>,
	handler: string,
	args: unknown
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	const info = { operation: { operation: 'mutation' }, fieldName: handler };
	const values = [null, args, { res: response }, info];
	const context = {
		getType: () => 'graphql',
		getClass: () => PaymentSessionResolver,
		getHandler: () => (PaymentSessionResolver.prototype as never)[handler],
		getArgs: () => values,
		getArgByIndex: (index: number) => values[index],
		switchToHttp: () => {
			throw new Error('a GraphQL operation has no HTTP request of its own');
		}
	} as unknown as ExecutionContext;

	const result = await lastValueFrom(
		surface.interceptor.intercept(context, {
			handle: () => from(invoke(surface.resolver, handler, args))
		})
	);

	return { result, response };
}

/** The request a client opening an attempt sends. */
const opened = (key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/payment-sessions',
	query: {},
	body: body(overrides),
	headers: key ? { 'idempotency-key': key } : {},
	args: [body(overrides)]
});

/** The request a client recording an approval sends. */
const authorized = (key: string, data: Record<string, unknown> = { approved: true }): RequestDouble => ({
	method: 'POST',
	originalUrl: `/api/payment-sessions/${SESSION}/authorize`,
	query: {},
	body: data,
	headers: { 'idempotency-key': key },
	args: [SESSION, data]
});

/** The request a client cancelling an attempt sends. */
const canceled = (key: string): RequestDouble => ({
	method: 'DELETE',
	originalUrl: `/api/payment-sessions/${SESSION}`,
	query: {},
	body: undefined,
	headers: { 'idempotency-key': key },
	args: [SESSION]
});

describe('the session routes — the retry declarations (06 §6.4)', () => {
	it('honours a key on opening, authorising and cancelling without requiring one', () => {
		expect(declarationOf(PaymentSessionController, 'create')).toEqual({
			scope: 'payment.session.create',
			required: false,
			resourceType: 'payment_session'
		});
		expect(declarationOf(PaymentSessionController, 'authorize')).toEqual({
			scope: 'payment.session.authorize',
			required: false,
			resourceType: 'payment_session'
		});
		// The cancellation of an attempt is the payment domain's cancel act, so it carries the scope
		// that names the act rather than the route that happens to carry it.
		expect(declarationOf(PaymentSessionController, 'delete')).toEqual({
			scope: 'payment.cancel',
			required: false,
			resourceType: 'payment_session'
		});
	});

	it('declares the same scopes on the mutations that mirror them', () => {
		expect(declarationOf(PaymentSessionResolver, 'openPaymentSession')).toEqual(
			declarationOf(PaymentSessionController, 'create')
		);
		expect(declarationOf(PaymentSessionResolver, 'authorizePaymentSession')).toEqual(
			declarationOf(PaymentSessionController, 'authorize')
		);
		expect(declarationOf(PaymentSessionResolver, 'voidPaymentSession')).toEqual(
			declarationOf(PaymentSessionController, 'delete')
		);
	});
});

describe('PaymentSessionController — an attempt with no key (06 §6.4)', () => {
	it('runs the handler and records nothing', async () => {
		const surface = resource();

		await expect(request(surface, 'create', opened())).resolves.toMatchObject({
			result: { id: SESSION, status: 'PENDING' }
		});
		expect(surface.kernel.openSession).toHaveBeenCalledTimes(1);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentSessionController — an attempt under a key (06 §6.4)', () => {
	it('replays the first attempt for the same key and the same body', async () => {
		const surface = resource();

		const first = await request(surface, 'create', opened(SESSION_KEY));
		const second = await request(surface, 'create', opened(SESSION_KEY));

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.openSession).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'create', opened(SESSION_KEY, { amount: '10.000000' }));

		await expect(
			request(surface, 'create', opened(SESSION_KEY, { amount: '30.000000' }))
		).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
		expect(surface.kernel.openSession).toHaveBeenCalledTimes(1);
	});

	it('releases an authorisation once when the cancel is retried under one key', async () => {
		const surface = resource();

		const first = await request(surface, 'delete', canceled(CANCEL_KEY));
		const second = await request(surface, 'delete', canceled(CANCEL_KEY));

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.voidSession).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('answers a repeated approval from the record, so the amount is reserved once', async () => {
		const surface = resource();

		await request(surface, 'authorize', authorized('authorize-key-0001'));
		await request(surface, 'authorize', authorized('authorize-key-0001'));

		expect(surface.kernel.authorizeSession).toHaveBeenCalledTimes(1);
	});

	it('leaves a route that declares no scope untouched, key or no key', async () => {
		const surface = resource();

		await expect(request(surface, 'update', opened(SESSION_KEY))).resolves.toMatchObject({
			result: { id: SESSION }
		});

		expect(declarationOf(PaymentSessionController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentSessionResolver — the mirrored mutations (17-graphql-api-specification.md §6.2)', () => {
	it('runs a mutation whose input states no key', async () => {
		const surface = resource();

		await expect(mutate(surface, 'openPaymentSession', { input: body() })).resolves.toMatchObject({
			result: { paymentSession: { id: SESSION } }
		});
		expect(surface.store.claim).not.toHaveBeenCalled();
	});

	it('replays a voided attempt when the key and the input are repeated', async () => {
		const surface = resource();
		const input = { id: SESSION, reason: 'abandoned', idempotencyKey: CANCEL_KEY };

		const first = await mutate(surface, 'voidPaymentSession', { input });
		const second = await mutate(surface, 'voidPaymentSession', { input: { ...input } });

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.voidSession).toHaveBeenCalledTimes(1);
	});
});
