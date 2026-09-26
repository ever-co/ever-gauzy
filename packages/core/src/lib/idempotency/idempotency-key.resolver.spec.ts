/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 */
import '../core/entities/internal';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { IdempotencyStatus, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IdempotencyKeyController } from './idempotency-key.controller';
import { IdempotencyKeyResolver } from './idempotency-key.resolver';
import type { IdempotencyService } from './idempotency.service';

/**
 * The stored retry keys over GraphQL (GraphQL specification §3.3, §3.1).
 *
 * REST and GraphQL are two views of one resource, so this resolver owns no business logic of its own
 * and the suite pins the half of that doctrine which is easy to get quietly wrong:
 *
 * - **every field reaches the same `IdempotencyService` method the REST route behind it reaches.** The
 *   list is the one field whose argument is not the route's: this surface has no query string to bind,
 *   so the read runs with the route's own defaults and the connection protocol applies the caller's
 *   `filter` to the rows the read was handed — one evaluation path rather than two that could come to
 *   disagree;
 * - **the connection contract** — a `filter` narrows the rows, a `sort` and a page are applied, and
 *   `totalCount` counts the narrowed set rather than the page or the read's own `total`;
 * - **the node field answers `null` for a row the service reports as missing**, because that is what a
 *   field with no row answers in this protocol — and it answers `null` for that and nothing else, so a
 *   read that failed is raised rather than reported as an empty one;
 * - **the permission of every field is the permission of the route it mirrors**, read from both sides'
 *   own metadata rather than restated here: a table of permission names would agree with the resolver
 *   while disagreeing with the controller, which is the failure this half of the doctrine exists to
 *   catch;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, carried as the
 *   imported code rather than as a literal — a drifted literal names a code no catalogue row carries,
 *   which the guard resolves as disabled, so every field would answer `Cannot query field <name>` for
 *   every caller with nothing red anywhere.
 *
 * The service is doubled, so the resolver is the only thing under test.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHECKOUT_KEY = '00000000-0000-4000-8000-0000000000a1';
const CAPTURE_KEY = '00000000-0000-4000-8000-0000000000a2';
const FAILED_KEY = '00000000-0000-4000-8000-0000000000a3';
const MISSING_KEY = '00000000-0000-4000-8000-0000000000af';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: newest
 * first.
 *
 * Two of them belong to one operation and differ by lifecycle, which is the shape an operator reads
 * when a client is stuck — narrowing by the scope leaves the pair, and the status says which of the two
 * is the live claim. The third is another operation's, so a filter on `scope` has something to leave
 * out.
 */
const KEYS = [
	{
		id: FAILED_KEY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		key: 'key-24681357',
		scope: 'checkout.complete',
		requestHash: 'c3d4e5f6',
		status: IdempotencyStatus.FAILED,
		responseStatus: 422,
		resourceType: 'payment',
		resourceId: '00000000-0000-4000-8000-0000000000d3',
		expiresAt: new Date('2026-03-02T12:00:00.000Z'),
		lockedAt: new Date('2026-03-01T12:00:00.000Z'),
		createdAt: new Date('2026-03-01T12:00:00.000Z'),
		updatedAt: new Date('2026-03-01T12:05:00.000Z')
	},
	{
		id: CAPTURE_KEY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		key: 'key-87654321',
		scope: 'order.capture',
		requestHash: 'b2c3d4e5',
		status: IdempotencyStatus.IN_PROGRESS,
		responseStatus: null,
		resourceType: null,
		resourceId: null,
		expiresAt: new Date('2026-03-02T11:00:00.000Z'),
		lockedAt: new Date('2026-03-01T11:00:00.000Z'),
		createdAt: new Date('2026-03-01T11:00:00.000Z'),
		updatedAt: new Date('2026-03-01T11:00:00.000Z')
	},
	{
		id: CHECKOUT_KEY,
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
	}
];

/**
 * The page the delivered list read answers.
 *
 * `total` is the rows the read selected — all three — so a connection that reported the read's own
 * total as its `totalCount` would answer `3` where the narrowed set is `2`, and the case below catches
 * exactly that.
 */
const PAGE = { items: KEYS, total: KEYS.length };

/** The three members of `IdempotencyService` this resolver reaches, doubled. */
type ServiceStub = Record<'listKeys' | 'findKeyOrFail' | 'release', jest.Mock>;

/**
 * The resolver over a scripted service, so every field's delegation is visible.
 *
 * Every member the fields reach is stated, so a field that called something else fails loudly rather
 * than silently passing through an automock.
 */
function surfaces() {
	const idempotencyService: ServiceStub = {
		listKeys: jest.fn().mockResolvedValue(PAGE),
		findKeyOrFail: jest.fn().mockResolvedValue(KEYS[2]),
		release: jest.fn().mockResolvedValue(KEYS[1])
	};

	return {
		idempotencyService,
		resolver: new IdempotencyKeyResolver(idempotencyService as unknown as IdempotencyService)
	};
}

/** This domain's own two documents, as the boot loader globs them. */
const ownSdl = ['idempotency-key.type.gql', 'idempotency-key.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The handlers of the controller, which is where the guards' reflector reads their metadata. */
function handlersOf(): Record<string, object> {
	return IdempotencyKeyController.prototype as unknown as Record<string, object>;
}

/** The fields of the resolver, which is where the guards' reflector reads their metadata. */
function fieldsOf(): Record<string, object> {
	return IdempotencyKeyResolver.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf()[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, IdempotencyKeyController)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	return Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf()[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	return Reflect.getMetadata('__guards__', fieldsOf()[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf()[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'idempotencyKeys', route: 'list' },
	{ field: 'idempotencyKey', route: 'findById' },
	{ field: 'releaseIdempotencyKey', route: 'release' }
];

describe('IdempotencyKeyResolver — the schema declares what the fields answer', () => {
	it('declares the three root fields the routes serve, and the nullability each answer has', () => {
		// The node read answers a nullable type, which is what makes the field's `null` a statement of
		// the contract rather than a hole in the schema; the list answers a connection and the release
		// answers the row it removed, both non-null, because neither has an "absent" answer.
		expect(ownSdl).toMatch(/idempotencyKeys\([\s\S]*?\): IdempotencyKeyConnection!/);
		expect(ownSdl).toMatch(/idempotencyKey\(id: ID!\): IdempotencyKey(?![\w!])/);
		expect(ownSdl).toMatch(/releaseIdempotencyKey\(id: ID!\): IdempotencyKey!/);
	});

	it('states the narrowing and the page the connection takes, so a field reads what it declares', () => {
		// The arguments a client states on the list field. They are what the connection protocol applies
		// to the rows the read answered — and the field below makes that read with none of them — so the
		// declaration is where a client meets them, and where they are asserted.
		expect(ownSdl).toContain('filter: IdempotencyKeyFilter');
		expect(ownSdl).toContain('sort: [IdempotencyKeySort!]');
		expect(ownSdl).toContain('page: PageInput');
	});
});

describe('IdempotencyKeyResolver — the connection contract', () => {
	it('answers the list through the same service method the REST list route calls, with the route’s defaults', async () => {
		const { resolver, idempotencyService } = surfaces();

		const connection = await resolver.idempotencyKeys();

		// The read is the route's own, with no narrowing: the connection protocol applies the caller's
		// `filter` to the rows the read was handed rather than pushing a second narrowing down a second
		// evaluation path that could come to disagree with the route's.
		expect(idempotencyService.listKeys).toHaveBeenCalledWith();
		// The default order is the read's own — newest first — with the identifier making it total,
		// because a cursor names a row and not a position among rows that compare equal.
		expect(connection.nodes.map((node) => node.id)).toEqual([FAILED_KEY, CAPTURE_KEY, CHECKOUT_KEY]);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so a walk started here resumes over REST as well.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FAILED_KEY);
	});

	it('narrows the rows the read answered, and counts the narrowed set', async () => {
		const { resolver } = surfaces();

		const narrowed = await resolver.idempotencyKeys({ scope: { eq: 'checkout.complete' } });

		expect(narrowed.nodes.map((node) => node.id)).toEqual([FAILED_KEY, CHECKOUT_KEY]);
		// Control: the read answered three rows and reported `total: 3`, so a connection that measured
		// its `totalCount` from the read's own total — rather than from the rows the filter selected —
		// would answer `3` here. `2` is the only answer that says the filter was applied to the count.
		expect(narrowed.totalCount).toBe(2);
	});

	it('orders by the fields the sort enum offers, and pages the ordered rows', async () => {
		const { resolver } = surfaces();

		const oldest = await resolver.idempotencyKeys(undefined, [{ field: 'createdAt', direction: 'ASC' }]);

		// Control for the default order above: the same rows under the other direction, which is what
		// says the sort is applied rather than the rows answered in whatever order they arrived.
		expect(oldest.nodes.map((node) => node.id)).toEqual([CHECKOUT_KEY, CAPTURE_KEY, FAILED_KEY]);

		const first = await resolver.idempotencyKeys(undefined, undefined, { first: 1 });

		expect(first.nodes.map((node) => node.id)).toEqual([FAILED_KEY]);
		expect(first.pageInfo.hasNextPage).toBe(true);
		// The total is the filtered set rather than the page: a connection that counted its own page
		// would answer `1` here and a different number for the same question at another page size.
		expect(first.totalCount).toBe(3);

		const second = await resolver.idempotencyKeys(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([CAPTURE_KEY]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a filter field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// The tenant is applied to the read from the credential, so a caller stating one is refused
		// rather than quietly narrowed to its own — and the refusal is the code a REST client branches on.
		const error = await resolver.idempotencyKeys({ tenantId: { eq: TENANT } }).catch((thrown) => thrown);

		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('IdempotencyKeyResolver — one resource, two protocols, the same operations', () => {
	it('reads one key through the same service method the REST node route calls, with the argument', async () => {
		const { resolver, idempotencyService } = surfaces();

		expect(await resolver.idempotencyKey(CHECKOUT_KEY)).toBe(KEYS[2]);
		// The scoped read is the service's: the field states the identifier and nothing else, so the
		// tenant and the organization are applied where every other read of this domain applies them.
		expect(idempotencyService.findKeyOrFail).toHaveBeenCalledWith(CHECKOUT_KEY);
	});

	it('answers null for a key the service reports as missing, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, idempotencyService } = surfaces();

		idempotencyService.findKeyOrFail.mockRejectedValueOnce(
			new NotFoundException(`RESOURCE_NOT_FOUND: no idempotency key '${MISSING_KEY}' is stored.`)
		);

		// A field that may have no row has one answer for "no such row" in this protocol, and the REST
		// route's `404` is the same fact stated in the other one.
		expect(await resolver.idempotencyKey(MISSING_KEY)).toBeNull();
	});

	it('raises a failure that is not a miss rather than answering null', async () => {
		// Control for the case above: a field that answered `null` for every failure would report a read
		// that could not run as a key that does not exist, and a client would treat a store that is down
		// as an empty answer — the failure would be invisible on the surface an operator reads.
		const failure = new Error('connection terminated unexpectedly');
		const { resolver, idempotencyService } = surfaces();

		idempotencyService.findKeyOrFail.mockRejectedValueOnce(failure);

		await expect(resolver.idempotencyKey(CHECKOUT_KEY)).rejects.toBe(failure);
	});

	it('releases a key through the same service method the REST removal route calls, with the argument', async () => {
		const { resolver, idempotencyService } = surfaces();

		const released = await resolver.releaseIdempotencyKey(CAPTURE_KEY);

		expect(idempotencyService.release).toHaveBeenCalledWith(CAPTURE_KEY);
		// The answer is the row as it stood, so a caller reads what was removed rather than assuming the
		// move happened — the same answer, and the same projection, as the route's.
		expect(released).toBe(KEYS[1]);
	});

	it('answers the release’s refusal rather than a row, naming the catalogue code', async () => {
		const refusal = new ApiException(
			HttpStatus.CONFLICT,
			ApiErrorCode.IDEMPOTENCY_IN_PROGRESS,
			'A request with this idempotency key is still in progress, so releasing it would let the work run twice.',
			{ scope: 'order.capture', retryAfterMs: 30_000 }
		);
		const { resolver, idempotencyService } = surfaces();

		idempotencyService.release.mockRejectedValueOnce(refusal);

		// Control: the field converts a *miss* into `null` and nothing else, so a live claim's refusal
		// reaches the caller as a refusal. A field that answered `null` here would tell an operator the
		// release happened.
		await expect(resolver.releaseIdempotencyKey(CAPTURE_KEY)).rejects.toBe(refusal);
	});
});

describe('IdempotencyKeyResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', IdempotencyKeyResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', IdempotencyKeyController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller
		// with no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every field under the guard chain the controller’s routes run under', () => {
		const stated = (Reflect.getMetadata('__guards__', IdempotencyKeyResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', IdempotencyKeyController) ?? [];
			const restated = guardsOfHandler(route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every field here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IdempotencyKeyResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, IdempotencyKeyController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IdempotencyKeyController)).toEqual([
			PermissionsEnum.IDEMPOTENCY_KEYS_VIEW
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf()[field]) ?? [];
		const routePermissions = permissionOfRoute(route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(route));
	});

	it('carries the view permission on the reads and the delete permission on the release', () => {
		// The catalogue's own split: `IDEMPOTENCY_KEYS_VIEW` is what an auditor holds and
		// `IDEMPOTENCY_KEYS_DELETE` is what an operator who may unblock a retry holds.
		expect(permissionOfField('idempotencyKeys')).toEqual([PermissionsEnum.IDEMPOTENCY_KEYS_VIEW]);
		expect(permissionOfField('idempotencyKey')).toEqual([PermissionsEnum.IDEMPOTENCY_KEYS_VIEW]);
		expect(permissionOfField('releaseIdempotencyKey')).toEqual([PermissionsEnum.IDEMPOTENCY_KEYS_DELETE]);
	});

	it('refuses the release to a caller who holds only the view permission', () => {
		// The field removes a row that is occupying the unique tuple, which is a different capability
		// from reading it: a release field carrying the view permission would be a door the permission
		// model did not intend, on the one operation of this resource that destroys anything.
		const stated = Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf()['releaseIdempotencyKey']) ?? [];

		expect(stated).not.toContain(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW);
		expect(stated).toEqual([PermissionsEnum.IDEMPOTENCY_KEYS_DELETE]);
	});

	it('declares the capability the catalogue declares for this surface, as the imported code', () => {
		// The value has to agree with the catalogue's `code` and nothing checks one string against
		// another, so the assertion is against the imported constant rather than against a third copy of
		// the same text: a resolver whose code drifted names a code no catalogue row carries, which the
		// guard resolves as disabled — every field would then answer `Cannot query field <name>` for
		// every caller, with the build green, the boot clean and the schema complete.
		expect(Reflect.getMetadata(FEATURE_METADATA, IdempotencyKeyResolver)).toBe(FEATURE_GRAPHQL);
		// One statement on the class, read by the guard with `getAllAndOverride` over the handler and
		// then the class, so every field is behind it.
		expect(Reflect.getMetadata('__guards__', IdempotencyKeyResolver)).toContain(FeatureFlagGuard);
	});
});
