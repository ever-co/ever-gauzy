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
 * The resource under test is the real one: the capture controller and the capture resolver over a
 * stubbed kernel service, with the real context and response doubles a Nest interceptor is handed.
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
		// The platform's decorator is `UsePipes(new ValidationPipe(options))`, so the double is that same
		// line rather than a no-op: a route's pipes are otherwise not what this suite asserts.
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
		}
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
import { PaymentCaptureController } from './payment-capture.controller';
import { PaymentCaptureResolver } from '../graphql/resolvers/payment-capture.resolver';

/**
 * The capture ledger's retry contract (06-api-specification.md §6.5, §7.5).
 *
 * A capture is money taken, so the suite pins the property the whole mechanism exists for — **one key,
 * one capture**:
 *
 * - the route and the mutation that mirror each other declare the same scope, and both require a key;
 * - a request without one is refused with `IDEMPOTENCY_KEY_REQUIRED`, before the service is reached;
 * - the same key with the same body replays the first answer and does not capture twice;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, and neither body is
 *   applied;
 * - the routes that declare no scope are untouched: no key is read, no claim is recorded, and the
 *   handler runs exactly as it did before the convention existed.
 *
 * The interceptor, the plan it decides from and the refusal it throws are the platform's own; only the
 * request, the response and the key store are doubles.
 */

const CAPTURE = '00000000-0000-4000-8000-0000000000c1';
const PAYMENT = '00000000-0000-4000-8000-0000000000a1';
const CAPTURE_KEY = 'capture-key-0001';
const OTHER_KEY = 'capture-key-0002';

/** What a client sends as the body of a capture. */
const body = (overrides: Record<string, unknown> = {}) => ({
	paymentId: PAYMENT,
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
				// Same key, different request: the kernel refuses rather than answering a question the
				// caller did not ask.
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
		complete: jest.fn(async (id: string, completion: any) => {
			const row = byId(id);

			return Object.assign(row, {
				status: 'COMPLETED',
				responseStatus: completion.responseStatus,
				responseBody: completion.responseBody,
				resourceType: completion.resourceType,
				resourceId: completion.resourceId
			});
		}),
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
	query: Record<string, unknown>;
	body: unknown;
	headers: Record<string, string>;
}

/** The resource over a stubbed kernel service and one in-memory key store. */
function resource() {
	const kernel = {
		capture: jest.fn(async (entity: any) => ({ id: CAPTURE, ...entity })),
		update: jest.fn(async () => ({ id: CAPTURE })),
		findCaptures: jest.fn(async () => ({ items: [{ id: CAPTURE }], total: 1 })),
		findCaptureOrFail: jest.fn(async () => ({ id: CAPTURE }))
	};
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new PaymentCaptureController(kernel as never),
		resolver: new PaymentCaptureResolver(kernel as never),
		interceptor: new IdempotencyInterceptor(store as never, new Reflector())
	};
}

/**
 * Sends one HTTP request through the interceptor the way the application does.
 *
 * The handler is the controller's own prototype method, so the declaration under test is read from the
 * route rather than restated here, and the work the interceptor runs is the controller's real method
 * over the stubbed kernel.
 */
async function request(
	surface: ReturnType<typeof resource>,
	handler: string,
	input: RequestDouble
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	const context = {
		getType: () => 'http',
		getClass: () => PaymentCaptureController,
		getHandler: () => (PaymentCaptureController.prototype as never)[handler],
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

/** The request a client retrying a capture sends. */
const capture = (key?: string, overrides: Record<string, unknown> = {}): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/payment-captures',
	query: {},
	body: body(overrides),
	headers: key ? { 'idempotency-key': key } : {}
});

/**
 * Runs one GraphQL mutation through the interceptor, with the arguments a resolver receives.
 *
 * The context is the shape a GraphQL root field is executed with: the root value, the arguments, the
 * GraphQL context and the field info, which is what the kernel reads the operation and the retry key
 * from.
 */
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
		getClass: () => PaymentCaptureResolver,
		getHandler: () => (PaymentCaptureResolver.prototype as never)[handler],
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

/** The retry declaration a handler carries, as the interceptor reads it. */
const declarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (surface.prototype as never)[handler]);

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

describe('the capture route — the retry declaration (06 §6.5)', () => {
	it('requires a key, under the scope the operation is named by', () => {
		expect(declarationOf(PaymentCaptureController, 'create')).toEqual({
			scope: 'payment.capture',
			required: true,
			resourceType: 'payment'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		// One operation, two protocols: a key presented over GraphQL and the same key presented over REST
		// name the same operation, so a client may retry on either without retrying the capture itself.
		expect(declarationOf(PaymentCaptureResolver, 'capturePayment')).toEqual(
			declarationOf(PaymentCaptureController, 'create')
		);
	});
});

describe('PaymentCaptureController — a capture without a key (06 §6.5)', () => {
	it('refuses the request, naming IDEMPOTENCY_KEY_REQUIRED, before the service is reached', async () => {
		const surface = resource();

		await expect(request(surface, 'create', capture())).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.kernel.capture).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentCaptureController — a retried capture (06 §6.5)', () => {
	it('replays the first capture for the same key and the same body, capturing once', async () => {
		const surface = resource();

		const first = await request(surface, 'create', capture(CAPTURE_KEY));
		const second = await request(surface, 'create', capture(CAPTURE_KEY));

		expect(first.result).toMatchObject({ id: CAPTURE, amount: '10.000000' });
		expect(second.result).toEqual(first.result);
		expect(surface.kernel.capture).toHaveBeenCalledTimes(1);
		// The replay carries the answer the first attempt produced, status included, and says so.
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
		expect(second.response.statuses).toEqual([201]);
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'create', capture(CAPTURE_KEY, { amount: '10.000000' }));

		await expect(
			request(surface, 'create', capture(CAPTURE_KEY, { amount: '25.000000' }))
		).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// Neither amount was applied a second time: the key covers one capture and only one.
		expect(surface.kernel.capture).toHaveBeenCalledTimes(1);
	});

	it('treats two keys on the same body as two attempts at one operation', async () => {
		const surface = resource();

		await request(surface, 'create', capture(CAPTURE_KEY));
		await request(surface, 'create', capture(OTHER_KEY));

		expect(surface.kernel.capture).toHaveBeenCalledTimes(2);
	});
});

describe('PaymentCaptureController — the routes that declare no scope (06 §6.5)', () => {
	it('leaves an undeclared route untouched, key or no key', async () => {
		const surface = resource();

		await expect(request(surface, 'update', capture(undefined))).resolves.toMatchObject({
			result: { id: CAPTURE }
		});
		// A key on a route that has not adopted the convention means nothing: the header is not read,
		// nothing is hashed and no key is claimed.
		await expect(request(surface, 'update', capture(CAPTURE_KEY))).resolves.toMatchObject({
			result: { id: CAPTURE }
		});

		expect(declarationOf(PaymentCaptureController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentCaptureResolver — the mirrored mutation (17-graphql-api-specification.md §6.2)', () => {
	it('refuses a capture that states no key, with the same code REST answers with', async () => {
		const surface = resource();

		await expect(mutate(surface, 'capturePayment', { input: body() })).rejects.toMatchObject({
			status: 400,
			code: 'IDEMPOTENCY_KEY_REQUIRED'
		});
		expect(surface.kernel.capture).not.toHaveBeenCalled();
	});

	it('replays the first capture when the key and the input are repeated', async () => {
		const surface = resource();
		const input = { ...body(), idempotencyKey: CAPTURE_KEY };

		const first = await mutate(surface, 'capturePayment', { input });
		const second = await mutate(surface, 'capturePayment', { input: { ...input } });

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.capture).toHaveBeenCalledTimes(1);
	});
});
