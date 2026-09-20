/**
 * The module boundaries are doubled, and retry safety is left real — the kernel's `Idempotent`
 * decorator, its metadata key and its interceptor, over an in-memory double of the key store — for the
 * reasons `payment-capture.controller.spec.ts` states in full. The resource under test is the real
 * one: the provider controller and the provider resolver over a stubbed kernel service.
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
import { PaymentProviderController } from './payment-provider.controller';
import { PaymentProviderResolver } from '../graphql/resolvers/payment-provider.resolver';

/**
 * The provider registry — the retry contract of a registration (06-api-specification.md §6.2, §7.2).
 *
 * A registration is not money, and the code it is keyed by already makes a duplicate harmless, so the
 * key is **optional** here. What the suite pins is that the option is real rather than decorative:
 *
 * - the route and the mutation that mirror each other declare the same scope, and neither requires a
 *   key;
 * - a request that presents none is untouched — no header is read and no claim is recorded;
 * - a request that presents one is answered from the record on a repeat, so the handler runs once;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, because a key covers
 *   one request and not two;
 * - a route that declares no scope stays untouched whatever a client presents.
 */

const PROVIDER = '00000000-0000-4000-8000-0000000000e1';
const PROVIDER_KEY = 'provider-key-0001';

/** What a client sends as the body of a registration. */
const body = (overrides: Record<string, unknown> = {}) => ({
	code: 'a-provider',
	name: 'A Provider',
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
	/** The arguments the handler is called with, when they are not just the body. */
	args?: unknown[];
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
		createProvider: jest.fn(async (entity: any) => ({ id: PROVIDER, ...entity })),
		updateProvider: jest.fn(async () => ({ id: PROVIDER })),
		findProviders: jest.fn(async () => ({ items: [{ id: PROVIDER }], total: 1 })),
		findProviderOrFail: jest.fn(async () => ({ id: PROVIDER }))
	};
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new PaymentProviderController(kernel as never),
		resolver: new PaymentProviderResolver(kernel as never),
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
		getClass: () => PaymentProviderController,
		getHandler: () => (PaymentProviderController.prototype as never)[handler],
		switchToHttp: () => ({ getRequest: () => input, getResponse: () => response }),
		getArgByIndex: (index: number) => [null, input][index]
	} as unknown as ExecutionContext;

	const result = await lastValueFrom(
		surface.interceptor.intercept(context, {
			handle: () => from(invoke(surface.controller, handler, ...(input.args ?? [input.body])))
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
		getClass: () => PaymentProviderResolver,
		getHandler: () => (PaymentProviderResolver.prototype as never)[handler],
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

/** The request a client making a registration sends. */
const registration = (key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/payment-providers',
	query: {},
	body: body(overrides),
	headers: key ? { 'idempotency-key': key } : {}
});

describe('the provider route — the retry declaration (06 §6.2)', () => {
	it('honours a key without requiring one', () => {
		expect(declarationOf(PaymentProviderController, 'create')).toEqual({
			scope: 'payment.provider.create',
			required: false,
			resourceType: 'payment_provider'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(PaymentProviderResolver, 'createPaymentProvider')).toEqual(
			declarationOf(PaymentProviderController, 'create')
		);
	});
});

describe('PaymentProviderController — a registration with no key (06 §6.2)', () => {
	it('runs the handler and records nothing', async () => {
		const surface = resource();

		await expect(request(surface, 'create', registration())).resolves.toMatchObject({
			result: { id: PROVIDER, code: 'a-provider' }
		});
		expect(surface.kernel.createProvider).toHaveBeenCalledTimes(1);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentProviderController — a registration under a key (06 §6.2)', () => {
	it('replays the first registration for the same key and the same body', async () => {
		const surface = resource();

		const first = await request(surface, 'create', registration(PROVIDER_KEY));
		const second = await request(surface, 'create', registration(PROVIDER_KEY));

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createProvider).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'create', registration(PROVIDER_KEY, { code: 'a-provider' }));

		await expect(
			request(surface, 'create', registration(PROVIDER_KEY, { code: 'another-provider' }))
		).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
		expect(surface.kernel.createProvider).toHaveBeenCalledTimes(1);
	});

	it('leaves a route that declares no scope untouched, key or no key', async () => {
		const surface = resource();

		await expect(request(surface, 'update', registration(PROVIDER_KEY))).resolves.toMatchObject({
			result: { id: PROVIDER }
		});

		expect(declarationOf(PaymentProviderController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentProviderResolver — the mirrored mutation (17-graphql-api-specification.md §6.1)', () => {
	it('runs the mutation when the input states no key', async () => {
		const surface = resource();

		await expect(mutate(surface, 'createPaymentProvider', { input: body() })).resolves.toMatchObject({
			result: { paymentProvider: { id: PROVIDER } }
		});
		expect(surface.store.claim).not.toHaveBeenCalled();
	});

	it('replays the first registration when the key and the input are repeated', async () => {
		const surface = resource();
		const input = { ...body(), idempotencyKey: PROVIDER_KEY };

		const first = await mutate(surface, 'createPaymentProvider', { input });
		const second = await mutate(surface, 'createPaymentProvider', { input: { ...input } });

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createProvider).toHaveBeenCalledTimes(1);
	});
});
