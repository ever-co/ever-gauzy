/**
 * The stored retry keys over REST (API specification §12.1).
 *
 * A key is written by the retry-safety interceptor from a request that carried one and never by a
 * caller, so this resource is an operator's and every route on it is a recovery move: read what a
 * stuck client is holding, and — when the client has lost its key — take the row away so the next
 * attempt is a true first attempt. The suite pins the four things a controller owes and a service
 * cannot state for it:
 *
 * - **the permission of every route**, read on the metadata a guard actually reads —
 *   `Reflect.getMetadata(PERMISSIONS_METADATA, handler)` — rather than from the decorator's prose. The
 *   two reads carry `IDEMPOTENCY_KEYS_VIEW` and the removal carries `IDEMPOTENCY_KEYS_DELETE`. This is
 *   the assertion the file exists for: a removal route that carried the *view* permission would be a
 *   door the permission model did not intend — a caller who may look at a stuck client's key could
 *   remove the row and let the retry run a second time — and nothing else in the build would catch it,
 *   because the decorator, the guard, the route table and the schema all stay green;
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is refused before a handler runs;
 * - **the routes themselves** — each is called and its delegation asserted, with the identifier the
 *   path carried, and the row the service answers is the row the route answers;
 * - **the miss and the refusal** — the node route lets the service's `NotFoundException` through
 *   unchanged, which is the `404` it declares, and the removal lets `IDEMPOTENCY_IN_PROGRESS` through,
 *   because a route that answered `undefined` to either would answer `200` for a row that is not there
 *   or a row that is still claimed.
 *
 * The service is doubled, so the controller is the only thing under test: a route that stopped
 * delegating — or delegated somewhere else — fails here rather than being accommodated.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// The gate on the GraphQL surface: the entity barrel this suite loads first reaches a module whose
	// resolver applies this third guard, and a decorator evaluated against an undefined token fails the
	// suite at load rather than at an assertion.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('./idempotency.service', () => ({
	// The state machine lives in the service and is asserted by its own suite; this one is about the
	// routes. Doubling the module also keeps the service's graph — the ORM, the repositories, the
	// request context — out of a suite that never reaches a database.
	IdempotencyService: class IdempotencyService {}
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 */
import '../core/entities/internal';

import { HttpException, HttpStatus, NotFoundException, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IdempotencyStatus, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IdempotencyKeyController } from './idempotency-key.controller';
import type { IdempotencyService } from './idempotency.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const KEY = '00000000-0000-4000-8000-0000000000a1';
const SECOND_KEY = '00000000-0000-4000-8000-0000000000a2';

/**
 * The row a scripted service answers with, as an operator reads it: the operation, the client's own
 * key, how far the attempt got and what it points at — and never the response the attempt produced,
 * which is why the projection both protocols answer drops that member in the service.
 */
const STORED = {
	id: KEY,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	key: 'key-12345678',
	scope: 'checkout.complete',
	requestHash: 'a1b2c3d4',
	status: IdempotencyStatus.COMPLETED,
	responseStatus: 201,
	resourceType: 'order',
	resourceId: '00000000-0000-4000-8000-0000000000d1',
	expiresAt: new Date('2026-03-02T10:00:00.000Z'),
	lockedAt: new Date('2026-03-01T10:00:00.000Z'),
	createdAt: new Date('2026-03-01T10:00:00.000Z'),
	updatedAt: new Date('2026-03-01T10:00:00.000Z')
};

/** The page the delivered list read answers: the newest row first, with the filtered total. */
const PAGE = {
	items: [STORED, { ...STORED, id: SECOND_KEY, key: 'key-87654321', scope: 'order.capture' }],
	total: 2
};

/** The three members of `IdempotencyService` this resource's routes reach, doubled. */
type ServiceStub = Record<'listKeys' | 'findKeyOrFail' | 'release', jest.Mock>;

/**
 * The controller over a scripted service, so every route's delegation is visible.
 *
 * Every member the routes reach is stated, so a route that called something else fails loudly rather
 * than silently passing through an automock.
 */
function surfaces(overrides: Partial<ServiceStub> = {}) {
	const idempotencyService: ServiceStub = {
		listKeys: jest.fn().mockResolvedValue(PAGE),
		findKeyOrFail: jest.fn().mockResolvedValue(STORED),
		release: jest.fn().mockResolvedValue(STORED),
		...overrides
	};

	return {
		idempotencyService,
		controller: new IdempotencyKeyController(idempotencyService as unknown as IdempotencyService)
	};
}

/** The handlers of the controller, which is where the guards' reflector reads their metadata. */
function handlers(): Record<string, object> {
	return IdempotencyKeyController.prototype as unknown as Record<string, object>;
}

/** The route one handler declares, as Nest's own metadata states it. */
function routeOf(handler: string): { path: string; method: RequestMethod } {
	return {
		path: Reflect.getMetadata(PATH_METADATA, handlers()[handler]),
		method: Reflect.getMetadata(METHOD_METADATA, handlers()[handler])
	};
}

describe('IdempotencyKeyController — the routes (API specification §12.1)', () => {
	it('answers one page of keys, and hands the caller’s narrowing over unchanged', async () => {
		const { controller, idempotencyService } = surfaces();
		const narrowing = {
			scope: 'checkout.complete',
			key: 'key-12345678',
			status: IdempotencyStatus.IN_PROGRESS,
			resourceType: 'order',
			take: 5,
			skip: 10
		};

		const page = await controller.list(narrowing);

		expect(idempotencyService.listKeys).toHaveBeenCalledWith(narrowing);
		// Identity rather than equality: a route that rebuilt the narrowing member by member could drop
		// `skip` or re-spell `take` and still pass an assertion that only compared values.
		expect(idempotencyService.listKeys.mock.calls[0][0]).toBe(narrowing);
		// The envelope is the service's, `total` included — the connection's own `total` is the count on
		// this resource, so a route that recomputed one would be a second count that could disagree.
		expect(page).toBe(PAGE);
	});

	it('answers the row the service answers, without reading it a second time', async () => {
		const { controller, idempotencyService } = surfaces();

		const key = await controller.findById(KEY);

		// The scoped read and the projection that drops the stored response are the service's, so the
		// field states the identifier and nothing else: a route that looked the row up by identifier
		// itself would be a second read that could disagree with the scope the service applies.
		expect(idempotencyService.findKeyOrFail).toHaveBeenCalledWith(KEY);
		expect(key).toBe(STORED);
	});

	it('lets the service’s miss through as the 404 it declares, rather than converting it to an empty answer', async () => {
		const refusal = new NotFoundException(`RESOURCE_NOT_FOUND: no idempotency key '${KEY}' is stored.`);
		const { controller } = surfaces({ findKeyOrFail: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.findById(KEY).catch((thrown) => thrown);

		// The route is a delegation and declares `@ApiResponse({ status: 404 })`, so the miss reaches the
		// client exactly as the service stated it. The assertion is identity, which is what makes it a
		// test: a route that re-wrapped the miss in a `NotFoundException` of its own, or that answered
		// `undefined` under a `200`, tells a client the read succeeded and the row held nothing — and the
		// second of those is what the GraphQL field behind this route answers *in its own vocabulary*.
		expect(error).toBe(refusal);
		expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
	});

	it('releases a key through the service, with the identifier the path carried', async () => {
		const { controller, idempotencyService } = surfaces();

		const released = await controller.release(KEY);

		// The argument is the row id the path carried and never the key the client presented: the client
		// key is not unique on its own, so releasing by it would take whichever row matched first.
		expect(idempotencyService.release).toHaveBeenCalledWith(KEY);
		// The answer is the row as it stood, so an operator reads what was removed instead of assuming
		// the removal happened.
		expect(released).toBe(STORED);
	});

	it('answers the removal’s refusal rather than a row, naming the catalogue code', async () => {
		const refusal = new ApiException(
			HttpStatus.CONFLICT,
			ApiErrorCode.IDEMPOTENCY_IN_PROGRESS,
			'A request with this idempotency key is still in progress, so releasing it would let the work run twice.',
			{ scope: 'checkout.complete', retryAfterMs: 30_000 }
		);
		const { controller } = surfaces({ release: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.release(KEY).catch((thrown) => thrown);

		// A release refused while a claim is live is the one outcome the key exists to prevent, so it
		// must reach the caller as a refusal. Control: a route that swallowed it would answer `200` for a
		// row that is still there, and the operator would believe the retry had been unblocked.
		expect(error).toBe(refusal);
		expect((error as ApiException).getStatus()).toBe(HttpStatus.CONFLICT);
		expect((error as ApiException).code).toBe(ApiErrorCode.IDEMPOTENCY_IN_PROGRESS);
	});
});

describe('IdempotencyKeyController — the guard chain and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', IdempotencyKeyController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('states the read permission on the class, which is what a route stating none inherits', () => {
		// The class statement is the fallback the guards' reflector applies, so it is the permission a
		// route that forgot its own would run under — and on this resource a forgotten statement must
		// never be the delete permission.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IdempotencyKeyController)).toEqual([
			PermissionsEnum.IDEMPOTENCY_KEYS_VIEW
		]);
	});

	it('gives every route the permission its own capability needs', () => {
		const expected: Array<[string, PermissionsEnum]> = [
			['list', PermissionsEnum.IDEMPOTENCY_KEYS_VIEW],
			['findById', PermissionsEnum.IDEMPOTENCY_KEYS_VIEW],
			['release', PermissionsEnum.IDEMPOTENCY_KEYS_DELETE]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlers()[route])).toEqual([permission]);
		}
	});

	it('refuses the removal to a caller who holds only the view permission', () => {
		// The assertion this file exists for. `IDEMPOTENCY_KEYS_VIEW` is what an auditor holds and
		// `IDEMPOTENCY_KEYS_DELETE` is what an operator who may unblock a retry holds; the removal
		// deletes a row that is occupying the unique tuple, which is a different capability from reading
		// it. A removal carrying the view permission is a door the permission model did not intend, and
		// nothing else in the build would catch it.
		const stated = Reflect.getMetadata(PERMISSIONS_METADATA, handlers()['release']) ?? [];

		expect(stated).not.toContain(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW);
		expect(stated).toEqual([PermissionsEnum.IDEMPOTENCY_KEYS_DELETE]);
	});

	it('declares the path, the verb and the status of every route it serves', () => {
		// A route that lost its decorator is an endpoint that quietly stops existing, so the paths are
		// read from the metadata Nest routes on rather than from the method names.
		expect(Reflect.getMetadata(PATH_METADATA, IdempotencyKeyController)).toBe('/idempotency-keys');
		expect(routeOf('list')).toEqual({ path: '/', method: RequestMethod.GET });
		expect(routeOf('findById')).toEqual({ path: '/:id', method: RequestMethod.GET });
		expect(routeOf('release')).toEqual({ path: '/:id', method: RequestMethod.DELETE });
		// The removal answers the row it removed, so it states the body-bearing status rather than the
		// `204` a removal that answered nothing would state.
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, handlers()['release'])).toBe(HttpStatus.OK);
	});
});
