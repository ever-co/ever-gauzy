/**
 * The module boundaries are doubled, and retry safety is left real — the kernel's `Idempotent`
 * decorator, its metadata key and its interceptor, over an in-memory double of the key store — for the
 * reasons `payment-capture.controller.spec.ts` states in full. The resource under test is the real
 * one: the callback controller and the callback resolver over a stubbed kernel service.
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
import { PaymentWebhookEventController } from './payment-webhook-event.controller';
import { PaymentWebhookEventResolver } from '../graphql/resolvers/payment-webhook-event.resolver';

/**
 * The inbound provider callback log — the retry contract of re-running an event (06 §6.9, §7.9).
 *
 * Re-processing re-applies an effect to money, and the service already refuses an event that succeeded
 * unless the caller forces it, so the key is **optional**: a client that presents one is answered from
 * the record rather than from a second application of the same event. The suite pins that the option is
 * real:
 *
 * - the route and the mutation that mirror each other declare the same scope, and neither requires a
 *   key;
 * - a request that presents none is untouched — no header is read and no claim is recorded;
 * - a request that presents one is answered from the record on a repeat, so the handler runs once,
 *   which is the property that matters for an event that already moved money;
 * - the same key with a different body is refused with `IDEMPOTENCY_KEY_REUSED`, so a key cannot be
 *   made to cover a second event;
 * - a route that declares no scope stays untouched.
 */

const EVENT = '00000000-0000-4000-8000-0000000000c2';
const CALLBACK_KEY = 'callback-key-0001';

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
	/** The arguments the handler is called with: this route names its event in the path as well. */
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
		reprocess: jest.fn(async (id: string, force: boolean) => ({ id, status: force ? 'PROCESSED' : 'RECEIVED' })),
		update: jest.fn(async () => ({ id: EVENT })),
		findEvents: jest.fn(async () => ({ items: [{ id: EVENT }], total: 1 })),
		findEventOrFail: jest.fn(async () => ({ id: EVENT }))
	};
	const store = keyStore();

	return {
		kernel,
		store,
		controller: new PaymentWebhookEventController(kernel as never),
		resolver: new PaymentWebhookEventResolver(kernel as never),
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
		getClass: () => PaymentWebhookEventController,
		getHandler: () => (PaymentWebhookEventController.prototype as never)[handler],
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

/** The request a client re-running an event sends. */
const reprocess = (key?: string, force = true): RequestDouble => ({
	method: 'POST',
	originalUrl: `/api/payment-webhook-events/${EVENT}/reprocess`,
	query: {},
	body: { force },
	headers: key ? { 'idempotency-key': key } : {},
	args: [EVENT, { force }]
});

describe('the callback re-processing route — the retry declaration (06 §6.9)', () => {
	it('honours a key without requiring one', () => {
		expect(declarationOf(PaymentWebhookEventController, 'reprocess')).toEqual({
			scope: 'payment.callback.reprocess',
			required: false,
			resourceType: 'payment_webhook_event'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(PaymentWebhookEventResolver, 'reprocessPaymentWebhookEvent')).toEqual(
			declarationOf(PaymentWebhookEventController, 'reprocess')
		);
	});
});

describe('PaymentWebhookEventController — re-processing with no key (06 §6.9)', () => {
	it('runs the handler and records nothing', async () => {
		const surface = resource();

		await expect(request(surface, 'reprocess', reprocess())).resolves.toMatchObject({
			result: { id: EVENT, status: 'PROCESSED' }
		});
		expect(surface.kernel.reprocess).toHaveBeenCalledWith(EVENT, true);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('PaymentWebhookEventController — re-processing under a key (06 §6.9)', () => {
	it('replays the first answer for the same key and the same body, applying the event once', async () => {
		const surface = resource();

		const first = await request(surface, 'reprocess', reprocess(CALLBACK_KEY));
		const second = await request(surface, 'reprocess', reprocess(CALLBACK_KEY));

		expect(second.result).toEqual(first.result);
		expect(surface.kernel.reprocess).toHaveBeenCalledTimes(1);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different force flag under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();

		await request(surface, 'reprocess', reprocess(CALLBACK_KEY, true));

		await expect(request(surface, 'reprocess', reprocess(CALLBACK_KEY, false))).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		expect(surface.kernel.reprocess).toHaveBeenCalledTimes(1);
	});

	it('leaves a route that declares no scope untouched, key or no key', async () => {
		const surface = resource();

		await expect(request(surface, 'update', reprocess(CALLBACK_KEY))).resolves.toMatchObject({
			result: { id: EVENT }
		});

		expect(declarationOf(PaymentWebhookEventController, 'update')).toBeUndefined();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});
