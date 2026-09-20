/**
 * The module boundaries are doubled for the reason this package's other specs state: `@gauzy/core`
 * boots the whole application graph from its barrel — and its nested `uuid` is ESM-only, so reading one
 * entity under jest fails — and `@gauzy/common` is read by the feature-flag decorator.
 *
 * **Retry safety is the one seam left real.** `Idempotent`, its metadata key and the interceptor that
 * acts on it are pulled from the kernel's own modules with `requireActual`, so the declaration the route
 * carries and the decision made from it are the platform's, and only the key store is an in-memory
 * double of the kernel service.
 *
 * The resource under test is the real shipping-profile controller, reached through its own prototype
 * method, over a stubbed service.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');

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
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		Warehouse: class Warehouse {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENCY_METADATA_KEY,
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
import { ShippingProfileController } from './shipping-profile.controller';
import { ShippingOptionResolver } from '../graphql/shipping-option.resolver';

/**
 * The shipping-profile resource's retry contract.
 *
 * Creating a profile is a configuration write, so the key is **offered rather than demanded**: a caller
 * that retries is answered with the profile the first attempt wrote — which is what stops a retry from
 * being refused for a code the first attempt already took — while a caller that never sends a key is
 * unaffected.
 */

const PROFILE = '00000000-0000-4000-8000-0000000000b1';
const CREATE_KEY = 'shipping-profile-0001';

/** What a client sends as the body of a profile. */
const body = (overrides: Record<string, unknown> = {}) => ({
	name: 'Standard shipping',
	code: 'STANDARD',
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
				responseBody: completion.responseBody
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
		create: jest.fn(async (entity: any) => ({ id: PROFILE, ...entity })),
		findAll: jest.fn(async () => ({ items: [{ id: PROFILE }], total: 1 }))
	};
	const store = keyStore();
	const reflector = new Reflector();

	return {
		service,
		store,
		controller: new ShippingProfileController(service as never),
		resolver: new ShippingOptionResolver({} as never, service as never),
		interceptor: new IdempotencyInterceptor(store as never, reflector)
	};
}

type Surface = ReturnType<typeof resource>;

/** One request to create a profile, with the key when one is given. */
const request = (payload: unknown, key?: string): RequestDouble => ({
	method: 'POST',
	originalUrl: '/api/shipping-profiles',
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
		getClass: () => ShippingProfileController,
		getHandler: () => (ShippingProfileController.prototype as any)[handler],
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

describe('the shipping-profile route — the retry declaration', () => {
	it('offers a key on a create, because a repeat is refused by the code the profile already took', () => {
		expect(declarationOf(ShippingProfileController, 'create')).toEqual({
			scope: 'shipping_profile.create',
			required: false,
			resourceType: 'shipping_profile'
		});
	});

	it('declares the same scope on the mutation that mirrors it', () => {
		expect(declarationOf(ShippingOptionResolver, 'createShippingProfile')).toEqual(
			declarationOf(ShippingProfileController, 'create')
		);
	});

	it('leaves the membership routes alone, because setting the same default twice is already one state', () => {
		expect(declarationOf(ShippingProfileController, 'assignVariants')).toBeUndefined();
		expect(declarationOf(ShippingProfileController, 'setDefault')).toBeUndefined();
	});
});

describe('ShippingProfileController — a create that presents no key', () => {
	it('runs, because the route offers the key rather than demanding it', async () => {
		const surface = resource();
		const input = request(body());

		await expect(send(surface, 'create', input, [input.body])).resolves.toMatchObject({
			result: { id: PROFILE, code: 'STANDARD' }
		});
		expect(surface.service.create).toHaveBeenCalledTimes(1);
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('ShippingProfileController — a retried create', () => {
	it('replays the first profile for the same key and the same body, creating once', async () => {
		const surface = resource();
		const first = request(body(), CREATE_KEY);
		const second = request(body(), CREATE_KEY);

		const sent = await send(surface, 'create', first, [first.body]);
		const replayed = await send(surface, 'create', second, [second.body]);

		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.create).toHaveBeenCalledTimes(1);
		expect(replayed.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('refuses a different body under the same key, naming IDEMPOTENCY_KEY_REUSED', async () => {
		const surface = resource();
		const first = request(body(), CREATE_KEY);
		const different = request(body({ name: 'Express shipping' }), CREATE_KEY);

		await send(surface, 'create', first, [first.body]);

		await expect(send(surface, 'create', different, [different.body])).rejects.toMatchObject({
			status: 409,
			code: 'IDEMPOTENCY_KEY_REUSED'
		});
		// Neither profile was written again: the key covers one create and only one.
		expect(surface.service.create).toHaveBeenCalledTimes(1);
	});
});
