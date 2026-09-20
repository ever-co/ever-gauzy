/**
 * The module boundaries are doubled for the reason the package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel and `@gauzy/config` reads the environment at import
 * time, neither of which a resource needs.
 *
 * **Retry safety is the one seam left real.** The `Idempotent` decorator, the metadata key it writes
 * under and the interceptor that acts on it are the kernel's own — the first two are pulled from their
 * modules with `requireActual`, the third is imported from its module while the service it injects is
 * doubled — so the declaration a route carries and the decision made from it are the platform's.
 *
 * The resource under test is the real one: the refund controller and the refund resolver over a
 * stubbed kernel service, with the real context doubles a Nest interceptor is handed.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

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
		// The money kernel is pulled through the seam, so the amounts a stub answers with are the
		// platform's own type rather than a second one.
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
		// The refund-line service reads the dialect at import time to pick a column type.
		isMySQL: () => false,
		isPostgres: () => true
	}),
	{ virtual: true }
);

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
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { RefundController } from './refund.controller';
import { RefundResolver } from '../graphql/resolvers/refund.resolver';

/**
 * Money given back — the retry contract of recording a refund (06-api-specification.md §6.6, §7.6).
 *
 * The suite pins the property the mechanism exists for: **one key, one refund**.
 *
 * - the route and the mutation that mirror each other declare the same scope, and both require a key;
 * - a request without one is refused with `IDEMPOTENCY_KEY_REQUIRED`, before the service is reached;
 * - the same key with the same body replays the first answer and records one refund;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, and neither body is
 *   recorded;
 * - a route that declares no scope is untouched: no key is read, no claim is recorded.
 *
 * The interceptor, the plan it decides from and the refusal it throws are the platform's own; only the
 * request, the response and the key store are doubles.
 */

const REFUND = '00000000-0000-4000-8000-0000000000d1';
const ORDER = '00000000-0000-4000-8000-0000000000a2';
const REFUND_KEY = 'refund-key-0001';

/** What a client sends as the body of a refund. */
const body = (overrides: Record<string, unknown> = {}) => ({
	orderId: ORDER,
	amount: '10.000000',
	currency: 'USD',
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

type ResponseDouble = ReturnType<typeof responseDouble>;

/** One request as the transport hands it to an interceptor. */
interface RequestDouble {
	method: string;
	originalUrl: string;
	query: Record<string, unknown>;
	body: unknown;
	headers: Record<string, string>;
}

/**
 * Calls one method of a controller or resolver on its own instance, without naming its signature.
 *
 * A handler reached through the prototype is reached without its receiver, and every handler in this
 * package reads its collaborators from `this`, so the instance is what the call is made on.
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
		createRefund: jest.fn(async (entity: any) => ({ id: REFUND, status: 'PENDING', ...entity })),
		update: jest.fn(async () => ({ id: REFUND })),
		findRefunds: jest.fn(async () => ({ items: [{ id: REFUND }], total: 1 })),
		findRefundOrFail: jest.fn(async () => ({ id: REFUND })),
		findRefundLines: jest.fn(async () => [])
	};
	const lines = { findLines: jest.fn(async () => []) };
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new RefundController(kernel as never),
		resolver: new RefundResolver(kernel as never, lines as never),
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
		getClass: () => RefundController,
		getHandler: () => (RefundController.prototype as never)[handler],
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
		getClass: () => RefundResolver,
		getHandler: () => (RefundResolver.prototype as never)[handler],
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

/** The request a client retrying a refund sends. */
const refund = (key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/refunds',
	query: {},
	body: body(overrides),
	headers: key ? { 'idempotency-key': key } : {}
});

describe('the refund route — the retry declaration (06 §6.6)', () => {
	it('requires a key, under the scope the operation is named by', () => {
		expect(declarationOf(RefundController, 'create')).toEqual({
			scope: 'refund.create',
			required: true,
			resourceType: 'refund'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(RefundResolver, 'createRefund')).toEqual(declarationOf(RefundController, 'create'));
	});
});

describe('RefundController — recording a refund (06 §6.6)', () => {
	it('refuses a refund that presents no key, naming IDEMPOTENCY_KEY_REQUIRED', async () => {
		const surface = resource();

		await expect(request(surface, 'create', refund())).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.kernel.createRefund).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});

	it('replays the first refund for the same key and the same body, recording one refund', async () => {
		const surface = resource();

		const first = await request(surface, 'create', refund(REFUND_KEY));
		const second = await request(surface, 'create', refund(REFUND_KEY));

		expect(first.result).toMatchObject({ id: REFUND, status: 'PENDING' });
		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createRefund).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different amount under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'create', refund(REFUND_KEY, { amount: '10.000000' }));

		await expect(request(surface, 'create', refund(REFUND_KEY, { amount: '99.000000' }))).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		expect(surface.kernel.createRefund).toHaveBeenCalledTimes(1);
	});

	it('leaves a route that declares no scope untouched', async () => {
		const surface = resource();

		await expect(request(surface, 'update', refund(REFUND_KEY))).resolves.toMatchObject({
			result: { id: REFUND }
		});

		expect(declarationOf(RefundController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('RefundResolver — the mirrored mutation (17-graphql-api-specification.md §6.2)', () => {
	it('refuses a refund that states no key, with the same code REST answers with', async () => {
		const surface = resource();

		await expect(mutate(surface, 'createRefund', { input: body() })).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.kernel.createRefund).not.toHaveBeenCalled();
	});

	it('replays the first refund when the key and the input are repeated', async () => {
		const surface = resource();
		const input = { ...body(), idempotencyKey: REFUND_KEY };

		const first = await mutate(surface, 'createRefund', { input });
		const second = await mutate(surface, 'createRefund', { input: { ...input } });

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.createRefund).toHaveBeenCalledTimes(1);
	});
});
