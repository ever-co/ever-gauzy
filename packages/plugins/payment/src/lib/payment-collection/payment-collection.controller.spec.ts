/**
 * The module boundaries are doubled, and retry safety is left real — the kernel's `Idempotent`
 * decorator, its metadata key and its interceptor, over an in-memory double of the key store — for the
 * reasons `payment-capture.controller.spec.ts` states in full. The resource under test is the real
 * one: the collection controller and the collection resolver over a stubbed kernel service.
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
import { PaymentCollectionController } from './payment-collection.controller';
import { PaymentCollectionResolver } from '../graphql/resolvers/payment-collection.resolver';

/**
 * The collection of an order or a cart — the retry contract of creating one (06 §6.3, §7.3).
 *
 * An order or a cart has one collection and the service refuses a second one, so the key is
 * **optional**: a client that lost the answer is answered from the record rather than from a refusal
 * it would have to interpret. The suite pins that the option is real:
 *
 * - the route and the mutation that mirror each other declare the same scope, and neither requires a
 *   key;
 * - a request that presents none is untouched — no header is read and no claim is recorded;
 * - a request that presents one is answered from the record on a repeat, so the handler runs once;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`;
 * - a route that declares no scope stays untouched.
 */

const COLLECTION = '00000000-0000-4000-8000-0000000000f1';
const ORDER = '00000000-0000-4000-8000-0000000000a3';
const COLLECTION_KEY = 'collection-key-0001';

/** What a client sends as the body of a collection. */
const body = (overrides: Record<string, unknown> = {}) => ({
	orderId: ORDER,
	amount: '10.000000',
	currency: 'USD',
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
		createCollection: jest.fn(async (entity: any) => ({ id: COLLECTION, status: 'NOT_PAID', ...entity })),
		updateCollection: jest.fn(async () => ({ id: COLLECTION })),
		findCollections: jest.fn(async () => ({ items: [{ id: COLLECTION }], total: 1 })),
		findCollectionOrFail: jest.fn(async () => ({ id: COLLECTION }))
	};
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new PaymentCollectionController(kernel as never),
		resolver: new PaymentCollectionResolver(kernel as never),
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
		getClass: () => PaymentCollectionController,
		getHandler: () => (PaymentCollectionController.prototype as never)[handler],
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
		getClass: () => PaymentCollectionResolver,
		getHandler: () => (PaymentCollectionResolver.prototype as never)[handler],
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

/** The request a client creating a collection sends. */
const collection = (key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/payment-collections',
	query: {},
	body: body(overrides),
	headers: key ? { 'idempotency-key': key } : {}
});

describe('the collection route — the retry declaration (06 §6.3)', () => {
	it('honours a key without requiring one', () => {
		expect(declarationOf(PaymentCollectionController, 'create')).toEqual({
			scope: 'payment.collection.create',
			required: false,
			resourceType: 'payment_collection'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(PaymentCollectionResolver, 'createPaymentCollection')).toEqual(
			declarationOf(PaymentCollectionController, 'create')
		);
	});
});

describe('PaymentCollectionController — a collection with no key (06 §6.3)', () => {
	it('runs the handler and records nothing', async () => {
		const surface = resource();

		await expect(request(surface, 'create', collection())).resolves.toMatchObject({
			result: { id: COLLECTION, status: 'NOT_PAID' }
		});
		expect(surface.kernel.createCollection).toHaveBeenCalledTimes(1);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentCollectionController — a collection under a key (06 §6.3)', () => {
	it('replays the first collection for the same key and the same body', async () => {
		const surface = resource();

		const first = await request(surface, 'create', collection(COLLECTION_KEY));
		const second = await request(surface, 'create', collection(COLLECTION_KEY));

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createCollection).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different amount under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'create', collection(COLLECTION_KEY, { amount: '10.000000' }));

		await expect(
			request(surface, 'create', collection(COLLECTION_KEY, { amount: '20.000000' }))
		).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
		expect(surface.kernel.createCollection).toHaveBeenCalledTimes(1);
	});

	it('leaves a route that declares no scope untouched, key or no key', async () => {
		const surface = resource();

		await expect(request(surface, 'update', collection(COLLECTION_KEY))).resolves.toMatchObject({
			result: { id: COLLECTION }
		});

		expect(declarationOf(PaymentCollectionController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentCollectionResolver — the mirrored mutation (17-graphql-api-specification.md §6.1)', () => {
	it('runs the mutation when the input states no key', async () => {
		const surface = resource();

		await expect(mutate(surface, 'createPaymentCollection', { input: body() })).resolves.toMatchObject({
			result: { paymentCollection: { id: COLLECTION } }
		});
		expect(surface.store.claim).not.toHaveBeenCalled();
	});

	it('replays the first collection when the key and the input are repeated', async () => {
		const surface = resource();
		const input = { ...body(), idempotencyKey: COLLECTION_KEY };

		const first = await mutate(surface, 'createPaymentCollection', { input });
		const second = await mutate(surface, 'createPaymentCollection', { input: { ...input } });

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createCollection).toHaveBeenCalledTimes(1);
	});
});
