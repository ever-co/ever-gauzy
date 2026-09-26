/**
 * The cart's two adoption conventions, asserted through the routes that adopt them.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a controller spec needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, as the cart
 * service spec doubles it, and everything the conventions are made of is the *real* thing: the
 * idempotency interceptor, the version guard, the version interceptor and the metadata the decorators
 * write. What is asserted is therefore the behaviour a caller meets at the route, not a restatement of
 * it.
 *
 * Four properties are pinned, one per thing that would go wrong without the convention:
 *
 * - a route that requires a key refuses a request that presents none, and the handler never runs;
 * - the same key with the same body is answered from the first attempt's record, so the work behind it
 *   happens exactly once;
 * - a write that states a version the cart no longer holds is refused with the platform's own conflict
 *   code, naming both versions;
 * - a response that carries a version publishes it as an `ETag`, which is the header the next write
 *   states back.
 */
/**
 * The store itself is doubled rather than mocked: the interceptor asks it three questions and the
 * double below answers them, so the class behind it — which drags in the ORM, the request context and
 * a module barrel this suite has no use for — must not be loaded at all. The interceptor names it in
 * its constructor, and the metadata its `@Injectable()` emits names it as a value, so the module is
 * substituted here rather than left to resolve.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

/**
 * The service the controller names is substituted rather than loaded.
 *
 * The controller reaches for it twice: as the delegate every route calls, and as the resource
 * `@Versioned()` resolves to compare a version. Neither needs the class itself — the double below
 * answers the routes and the guard's registry double answers the version read — while loading it
 * would drag in the entities, both ORM repositories and the whole money graph behind them.
 */
jest.mock('./commerce-cart.service', () => ({ CommerceCartService: class CommerceCartService {} }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a database or a module graph. */
	const decorator = () => () => undefined;

	/**
	 * The two metadata keys, taken from the kernel's own constant list rather than restated as string
	 * literals here: a spec that spelled them out would keep passing after the decorator and the guard
	 * stopped agreeing on the key they use.
	 */
	const { VERSIONED_METADATA_KEY, VERSION_EXPECTATION_PROPERTY } = jest.requireActual(
		'@gauzy/core/src/lib/concurrency/version.util'
	);

	/** The base controller, reduced to what a route inherits: the service it delegates to. */
	class CrudController {
		constructor(protected readonly service: any) {}
	}

	/** Every base class the request DTOs extend, declared but never mapped onto anything. */
	class BaseEntity {}

	return {
		VERSIONED_METADATA_KEY,
		VERSION_EXPECTATION_PROPERTY,
		CrudController,
		Permissions: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// The soft-delete and recover routes construct this pipe at class-definition time, so the
		// double has to export the class those routes build, carrying the `transform` Nest insists on.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		VersionedColumn: decorator,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		MultiORMEntity: decorator,
		MultiORMColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnIndex: decorator,
		ColumnNumericTransformerPipe: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		IdempotencyInterceptor: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.interceptor')
			.IdempotencyInterceptor,
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		VersionGuard: jest.requireActual('@gauzy/core/src/lib/concurrency/version.guard').VersionGuard,
		VersionInterceptor: jest.requireActual('@gauzy/core/src/lib/concurrency/version.interceptor')
			.VersionInterceptor,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf
	};
});

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, of } from 'rxjs';
import {
	IDEMPOTENT_METADATA_KEY,
	IdempotencyInterceptor,
	VERSIONED_METADATA_KEY,
	VERSION_EXPECTATION_PROPERTY,
	VersionGuard,
	VersionInterceptor
} from '@gauzy/core';
import { CommerceCartController } from './commerce-cart.controller';

/** The cart every request in this suite acts on, and the version it currently holds. */
const CART_ID = 'cart-1';
const CURRENT_VERSION = 3;

/**
 * A request as the interceptors and the guard read it.
 *
 * The three things they reach for are the method, the path and the body of the idempotency fingerprint,
 * the headers a key or a precondition rides in, and the route parameters a versioned write is
 * identified by. Nothing else about Express is modelled, because nothing else is read.
 *
 * @param options.method The HTTP method.
 * @param options.path The path the request was sent to.
 * @param options.body The request body.
 * @param options.headers The headers, keyed as Express keys them.
 */
function request(options: {
	method: string;
	path: string;
	body?: Record<string, unknown>;
	headers?: Record<string, unknown>;
}): any {
	return {
		method: options.method,
		url: options.path,
		originalUrl: options.path,
		query: {},
		params: { id: CART_ID },
		body: options.body ?? {},
		headers: options.headers ?? {}
	};
}

/** The response headers were written to, and the status it was given. */
function response(): any {
	return { headers: {} as Record<string, string>, statusCode: 0, setHeader: jest.fn(), status: jest.fn() };
}

/**
 * An execution context over one controller method.
 *
 * @param handler The method the router dispatched to; the metadata the conventions are read from lives
 * on it, which is why this is the prototype's own method and not a stand-in.
 * @param controller The controller class.
 * @param req The request.
 * @param res The response.
 */
function contextFor(handler: any, controller: any, req: any, res: any): ExecutionContext {
	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => controller,
		switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
		getArgByIndex: () => undefined
	} as unknown as ExecutionContext;
}

/**
 * A stand-in for the platform's idempotency store.
 *
 * It models the two things the interceptor depends on: the unique `(scope, key)` tuple, which is what
 * makes one attempt the owner of a key, and the recorded response, which is what a repeat of that key
 * is answered with. The row's own columns are not modelled — nothing the interceptor does reads them.
 */
function idempotencyStore() {
	const rows = new Map<string, any>();
	let sequence = 0;

	return {
		rows,
		service: {
			claim: async (input: { scope: string; key: string; requestHash: string }) => {
				const identity = `${input.scope}:${input.key}`;
				const existing = rows.get(identity);

				if (!existing) {
					const record = { id: `claim-${++sequence}`, requestHash: input.requestHash, createdAt: new Date() };
					rows.set(identity, { record, status: 'IN_PROGRESS' });

					return { outcome: 'CLAIMED', record };
				}

				if (existing.status === 'COMPLETED') {
					return { outcome: 'REPLAYED', record: existing.record, response: existing.response };
				}

				// A key another attempt still holds. The interceptor must refuse rather than run the work.
				return { outcome: 'IN_FLIGHT', record: existing.record, retryAfterMs: 1_500 };
			},
			complete: async (recordId: string, completion: any) => {
				for (const row of rows.values()) {
					if (row.record.id === recordId) {
						row.status = 'COMPLETED';
						row.response = { status: completion.responseStatus, body: completion.responseBody };
					}
				}
			},
			fail: async (recordId: string, failure: any) => {
				for (const row of rows.values()) {
					if (row.record.id === recordId) {
						row.status = 'FAILED';
						row.response = { status: failure.responseStatus };
					}
				}
			}
		}
	};
}

/** The cart service the controller under test delegates to, reduced to the writes these routes make. */
function cartServiceDouble(overrides: Record<string, unknown> = {}) {
	return {
		create: jest.fn(async (entity: any) => ({ id: CART_ID, version: 1, ...entity })),
		complete: jest.fn(async () => ({
			cart: { id: CART_ID, version: CURRENT_VERSION },
			orderId: 'order-1',
			orderNumber: 'ORD-1'
		})),
		applyChanges: jest.fn(async (id: string, changes: any) => ({ id, version: CURRENT_VERSION, ...changes })),
		...overrides
	};
}

describe('CommerceCartController — a route that requires an idempotency key', () => {
	it('refuses a checkout that presents no key, and never reaches the handler', async () => {
		const store = idempotencyStore();
		const service = cartServiceDouble();
		const controller = new CommerceCartController(service as any);
		const interceptor = new IdempotencyInterceptor(store.service as any, new Reflector());
		const req = request({ method: 'POST', path: `/api/carts/${CART_ID}/complete`, body: { paymentSessionId: 'ps-1' } });
		let handled = 0;
		const next: CallHandler = {
			handle: () => {
				handled++;

				return from(controller.complete(CART_ID, req.body, req));
			}
		};

		await expect(
			lastValueFrom(
				interceptor.intercept(contextFor(CommerceCartController.prototype.complete, CommerceCartController, req, response()), next)
			)
		).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED', status: 400 });

		expect(handled).toBe(0);
		expect(service.complete).not.toHaveBeenCalled();
	});

	it('answers a second attempt with the first one’s response, so the order is placed once', async () => {
		const store = idempotencyStore();
		const service = cartServiceDouble();
		const controller = new CommerceCartController(service as any);
		const interceptor = new IdempotencyInterceptor(store.service as any, new Reflector());
		let handled = 0;
		let current: any;
		const next: CallHandler = {
			handle: () => {
				handled++;

				return from(controller.complete(CART_ID, current.body, current));
			}
		};
		const attempt = () => {
			const req = request({
				method: 'POST',
				path: `/api/carts/${CART_ID}/complete`,
				body: { paymentSessionId: 'ps-1' },
				headers: { 'idempotency-key': 'checkout-key-0001' }
			});
			const res = response();

			// What the version guard leaves on the request before the handler runs. This case is about
			// the retry key, so the version is simply already accepted.
			req[VERSION_EXPECTATION_PROPERTY] = { wildcard: false, versions: [CURRENT_VERSION] };
			current = req;

			return {
				req,
				res,
				run: lastValueFrom(
					interceptor.intercept(
						contextFor(CommerceCartController.prototype.complete, CommerceCartController, req, res),
						next
					)
				)
			};
		};

		const first = await attempt().run;
		const replay = attempt();
		const second = await replay.run;

		expect(handled).toBe(1);
		expect(service.complete).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
		expect(replay.res.setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
	});

	it('refuses a concurrent attempt that holds the same key', async () => {
		const store = idempotencyStore();
		const service = cartServiceDouble();
		const controller = new CommerceCartController(service as any);
		const interceptor = new IdempotencyInterceptor(store.service as any, new Reflector());
		const req = request({
			method: 'POST',
			path: `/api/carts/${CART_ID}/complete`,
			body: { paymentSessionId: 'ps-1' },
			headers: { 'idempotency-key': 'checkout-key-0002' }
		});
		req[VERSION_EXPECTATION_PROPERTY] = { wildcard: false, versions: [CURRENT_VERSION] };
		// The first attempt claims the key and never settles it, which is what an attempt still running
		// looks like from the second one's side.
		store.service.claim = async () => ({ outcome: 'IN_FLIGHT', record: { id: 'claim-live' }, retryAfterMs: 1_500 });
		let handled = 0;
		const next: CallHandler = {
			handle: () => {
				handled++;

				return from(controller.complete(CART_ID, req.body, req));
			}
		};
		const res = response();

		await expect(
			lastValueFrom(
				interceptor.intercept(contextFor(CommerceCartController.prototype.complete, CommerceCartController, req, res), next)
			)
		).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS', status: 409 });

		expect(handled).toBe(0);
		expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
	});
});

describe('CommerceCartController — the versioned write', () => {
	it('refuses a write based on a version the cart has moved on from', async () => {
		const service = cartServiceDouble();
		const guard = new VersionGuard(new Reflector(), {
			get: () => ({ findOneByIdString: async () => ({ id: CART_ID, version: CURRENT_VERSION }) })
		} as any);
		const req = request({
			method: 'PUT',
			path: `/api/carts/${CART_ID}`,
			body: { note: 'Deliver after six.' },
			headers: { 'if-match': `"${CURRENT_VERSION - 1}"` }
		});

		await expect(
			guard.canActivate(contextFor(CommerceCartController.prototype.update, CommerceCartController, req, response()))
		).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT',
			status: 409,
			details: { expectedVersion: CURRENT_VERSION - 1, actualVersion: CURRENT_VERSION }
		});
	});

	it('demands a version of a write that states none', async () => {
		const guard = new VersionGuard(new Reflector(), {
			get: () => ({ findOneByIdString: async () => ({ id: CART_ID, version: CURRENT_VERSION }) })
		} as any);
		const req = request({ method: 'PUT', path: `/api/carts/${CART_ID}`, body: { note: 'x' } });

		await expect(
			guard.canActivate(contextFor(CommerceCartController.prototype.update, CommerceCartController, req, response()))
		).rejects.toMatchObject({ code: 'VERSION_REQUIRED', status: 428 });
	});

	it('accepts a write that states the version the cart holds', async () => {
		const guard = new VersionGuard(new Reflector(), {
			get: () => ({ findOneByIdString: async () => ({ id: CART_ID, version: CURRENT_VERSION }) })
		} as any);
		const req = request({
			method: 'PUT',
			path: `/api/carts/${CART_ID}`,
			body: { note: 'x' },
			headers: { 'if-match': `"${CURRENT_VERSION}"` }
		});

		await expect(
			guard.canActivate(contextFor(CommerceCartController.prototype.update, CommerceCartController, req, response()))
		).resolves.toBe(true);
	});

	it('publishes the version a response carries as its entity tag', async () => {
		const interceptor = new VersionInterceptor(new Reflector());
		const req = request({ method: 'PUT', path: `/api/carts/${CART_ID}`, body: { note: 'x' } });
		const res = response();

		const result = await lastValueFrom(
			interceptor.intercept(contextFor(CommerceCartController.prototype.update, CommerceCartController, req, res), {
				handle: () => of({ id: CART_ID, version: CURRENT_VERSION, note: 'x' })
			})
		);

		expect(res.setHeader).toHaveBeenCalledWith('ETag', `"${CURRENT_VERSION}"`);
		expect(result.version).toBe(CURRENT_VERSION);
	});

	it('carries the version requirement and the retry scope on the routes the design names', () => {
		const routes = CommerceCartController.prototype;
		const idempotent = (method: string) => Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (routes as any)[method]);
		const versioned = (method: string) => Reflect.getMetadata(VERSIONED_METADATA_KEY, (routes as any)[method]);

		expect(idempotent('complete')).toMatchObject({ scope: 'checkout.complete', required: true, resourceType: 'order' });
		expect(idempotent('create')).toMatchObject({ scope: 'cart.create', required: false });
		expect(idempotent('merge')).toMatchObject({ scope: 'cart.merge', required: false });
		expect(idempotent('addLine')).toMatchObject({ scope: 'cart.line.create', required: false });
		expect(idempotent('setShippingMethod')).toMatchObject({ scope: 'cart.shipping.set', required: false });
		expect(idempotent('applyPromotion')).toMatchObject({ scope: 'cart.promotion.apply', required: false });

		for (const method of [
			'update',
			'recalculate',
			'complete',
			'abandon',
			'merge',
			'addLine',
			'updateLine',
			'removeLine',
			'setShippingMethod',
			'applyPromotion',
			'removePromotion'
		]) {
			expect(versioned(method)?.resource).toBeDefined();
		}

		// A cart is created here rather than edited, so the route publishes the created revision without
		// demanding one of its caller.
		expect(versioned('create')).toMatchObject({ required: false });

		// A read states no version: no guard is mounted on the two read routes at all.
		expect(versioned('findById')).toBeUndefined();
		expect(versioned('validate')).toBeUndefined();
		expect(idempotent('findById')).toBeUndefined();
	});
});
