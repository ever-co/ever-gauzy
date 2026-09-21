/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a guard needs and none of which is available outside a
 * running application. The seam is therefore doubled at the module boundary and **the guard under test
 * is the real one**: every assertion below is about the scope it resolves, never about which method ran.
 *
 * `@nestjs/graphql` is left real. The whole point of half of this file is that the guard reads the same
 * request on both transports, and a doubled `GqlExecutionContext` would agree with the guard about a
 * shape the server never builds.
 *
 * `@gauzy/config` is read at import time by other packages of the workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		TenantAwareCrudService: class {},
		CrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The decimal comparison the commission bands and the settlement's discrepancy are decided by is
		// the kernel's own, so the double hands over the real one: a comparison doubled here would agree
		// with the service about arithmetic the platform never performs.
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
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

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ISellerMembershipResolver, SellerAccessGuard } from './seller-access.guard';
import { ISellerScope } from './seller-scope';

/**
 * The seller scope a marketplace request runs under (doc 20 §9, README "Seller isolation").
 *
 * Three properties are pinned here, and each one was a defect:
 *
 * - **A seller's own person can be narrowed at all.** Staffness used to be "holds any one of the
 *   sixteen marketplace permissions", and `PermissionGuard` refuses a caller that holds none of the
 *   route's — so every caller that reached this guard answered that question "yes" and the guard could
 *   never produce a seller-narrowed scope for anybody. Membership is resolved first now.
 * - **Staffness is per route.** A caller holding only `SELLERS_VIEW` is not staff on a payout route.
 * - **The guard runs on both transports.** A GraphQL field is executed with the root, the arguments,
 *   the context and the field info in the positions the HTTP accessor reads, so `request.query` on a
 *   resolver threw a `TypeError` for every field.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SELLER = 'seller-nord';
const OTHER_SELLER = 'seller-sud';
const PARTY = 'contact-nord';
const CALLER = 'user-1';
const CHANNEL = 'channel-1';

type Row = Record<string, any>;

/** The subset of conditions the guard states, matched the way the database would. */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([field, expected]) =>
		expected === undefined ? true : String(row[field] ?? '') === String(expected)
	);
}

/** The seller row the guard translates into a party. */
const sellerRow = (overrides: Row = {}) => ({
	id: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	code: 'NORD',
	contactId: PARTY,
	...overrides
});

/** A controller and a handler, which is what the reflector reads the declared permission off. */
class PayoutRoutes {
	cancel(): void {
		return undefined;
	}
	list(): void {
		return undefined;
	}
}

/**
 * Declares a route's permission the way `@Permissions` does, so the guard reads the platform's own
 * metadata rather than a second copy of it.
 */
function declarePermission(target: any, permission?: PermissionsEnum): void {
	if (permission) {
		Reflect.defineMetadata(PERMISSIONS_METADATA, [permission], target);
	}
}

/** An HTTP execution context carrying one request. */
function httpContext(request: any, handler: any = PayoutRoutes.prototype.cancel): ExecutionContext {
	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => PayoutRoutes,
		switchToHttp: () => ({ getRequest: () => request })
	} as unknown as ExecutionContext;
}

/**
 * A GraphQL execution context, in the four argument positions a resolver is called with.
 *
 * `GqlExecutionContext.create` reads them by index — root, arguments, context, info — which is exactly
 * why the HTTP accessor hands back the root on a resolver.
 */
function graphqlContext(
	args: Row,
	gqlContext: any,
	handler: any = PayoutRoutes.prototype.cancel
): ExecutionContext {
	const positions = [undefined, args, gqlContext, undefined];

	return {
		getType: () => 'graphql',
		getHandler: () => handler,
		getClass: () => PayoutRoutes,
		getArgs: () => positions,
		getArgByIndex: (index: number) => positions[index],
		switchToHttp: () => ({
			// What a GraphQL execution context really does with the HTTP accessor: it answers the root.
			getRequest: () => positions[0]
		})
	} as unknown as ExecutionContext;
}

/**
 * Builds the guard over an in-memory seller table.
 *
 * @param options.sellers The rows the seller table holds.
 * @param options.role What the membership resolver answers, or undefined for no resolver at all.
 */
function guardFixture(options: { sellers?: Row[]; role?: string | null } = {}) {
	const sellers = options.sellers ?? [sellerRow()];
	const asked: Array<{ contactId: string; callerUserId?: string }> = [];

	const sellerRepository: any = {
		findOne: async ({ where }: any = {}) => sellers.find((row) => matches(row, where)) ?? null
	};

	const membershipResolver: ISellerMembershipResolver | undefined =
		options.role === undefined
			? undefined
			: {
					resolveRole: async (contactId, callerUserId) => {
						asked.push({ contactId: String(contactId), callerUserId: callerUserId as string });

						return options.role ?? null;
					}
				};

	return {
		guard: new SellerAccessGuard(sellerRepository, new Reflector(), membershipResolver),
		asked
	};
}

describe('SellerAccessGuard — membership before staffness (doc 20 §9.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: CALLER } as any);
		declarePermission(PayoutRoutes.prototype.cancel, PermissionsEnum.SELLER_PAYOUTS_CANCEL);
		declarePermission(PayoutRoutes.prototype.list, PermissionsEnum.SELLER_PAYOUTS_VIEW);
	});

	afterEach(() => jest.restoreAllMocks());

	it('narrows a caller the membership resolver recognises, although it also holds the route permission', async () => {
		// The defect this replaces: holding the route's permission made the caller staff before the
		// membership was ever asked about, and `{ staff: true }` short-circuits `assertSellerScope` in
		// every service — so a seller-side credential read every seller's rows.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		const fixture = guardFixture({ role: 'OWNER' });
		const request: any = { query: { sellerId: SELLER } };

		expect(await fixture.guard.canActivate(httpContext(request))).toBe(true);
		expect(request.sellerScope).toEqual({
			sellerId: SELLER,
			contactId: PARTY,
			role: 'OWNER',
			staff: false,
			channelId: undefined
		} as ISellerScope);
	});

	it('asks the resolver about the seller’s party, not about the seller row’s own id', async () => {
		// The interface documents the first parameter as "the party whose membership is being asked
		// about", and the guard used to hand it the seller id — an identifier the contact package has
		// never seen, so a genuine member was refused by name on every seller-scoped route.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const fixture = guardFixture({ role: 'STAFF' });

		await fixture.guard.canActivate(httpContext({ headers: { 'x-seller-id': SELLER } }));

		expect(fixture.asked).toEqual([{ contactId: PARTY, callerUserId: CALLER }]);
	});

	it('is staff when it holds the route’s own permission and no membership resolves', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.SELLER_PAYOUTS_CANCEL
		);
		const fixture = guardFixture({ role: null });
		const request: any = { query: { sellerId: SELLER, channelId: CHANNEL } };

		expect(await fixture.guard.canActivate(httpContext(request))).toBe(true);
		expect(request.sellerScope).toEqual({ sellerId: SELLER, staff: true, channelId: CHANNEL } as ISellerScope);
	});

	it('is not staff on a payout route for a caller holding only a seller read permission', async () => {
		// Per-route staffness: the sixteen marketplace grants used to be one pool, so `SELLERS_VIEW`
		// made a support credential staff for every payout route in the package.
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.SELLERS_VIEW
		);
		const fixture = guardFixture({ role: null });

		await expect(fixture.guard.canActivate(httpContext({ query: { sellerId: SELLER } }))).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(fixture.guard.canActivate(httpContext({ query: { sellerId: SELLER } }))).rejects.toThrow(
			new RegExp(`not valid for seller '${SELLER}'`)
		);
	});

	it('falls back to the marketplace permissions for a handler that declares none', async () => {
		// Nothing is removed by narrowing: a handler with no permission of its own is judged by the same
		// package-wide set the guard always used.
		class Unguarded {
			read(): void {
				return undefined;
			}
		}
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.SELLER_SETTLEMENTS_VIEW
		);
		const fixture = guardFixture({ role: null });
		const request: any = { query: { sellerId: SELLER } };

		expect(await fixture.guard.canActivate(httpContext(request, Unguarded.prototype.read))).toBe(true);
		expect(request.sellerScope).toMatchObject({ staff: true });
	});

	it('refuses a caller with no membership and no permission, naming the seller it guessed', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const fixture = guardFixture({ role: null });

		await expect(fixture.guard.canActivate(httpContext({ query: { sellerId: OTHER_SELLER } }))).rejects.toThrow(
			new RegExp(`not valid for seller '${OTHER_SELLER}'`)
		);
	});

	it('refuses a caller that names no seller and holds nothing, without naming one', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const fixture = guardFixture({ role: null });

		await expect(fixture.guard.canActivate(httpContext({}))).rejects.toThrow(/not valid for any seller/);
	});

	it('resolves no membership at all when no resolver is registered, and falls through to staffness', async () => {
		// The seam is optional: an installation that registers no resolver must still serve the operator
		// surface, which is the behaviour every deployment of this package has today.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		const fixture = guardFixture();
		const request: any = { params: { sellerId: SELLER } };

		expect(await fixture.guard.canActivate(httpContext(request))).toBe(true);
		expect(request.sellerScope).toMatchObject({ staff: true, sellerId: SELLER });
	});
});

describe('SellerAccessGuard — the same scope on both transports', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: CALLER } as any);
		declarePermission(PayoutRoutes.prototype.cancel, PermissionsEnum.SELLER_PAYOUTS_CANCEL);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads the request behind a GraphQL field instead of dereferencing the resolver’s root', async () => {
		// `switchToHttp().getRequest()` answers the GraphQL root here, which is `undefined` for a root
		// field — the guard used to read `.query` off it and throw a TypeError on every field.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		const fixture = guardFixture({ role: null });
		const request: any = { headers: { 'x-seller-id': SELLER } };

		expect(await fixture.guard.canActivate(graphqlContext({}, { req: request }))).toBe(true);
		expect(request.sellerScope).toMatchObject({ sellerId: SELLER, staff: true });
	});

	it('reads the seller a field names from the field’s own arguments', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const fixture = guardFixture({ role: 'OWNER' });
		const request: any = {};

		expect(
			await fixture.guard.canActivate(graphqlContext({ sellerId: SELLER, channelId: CHANNEL }, { req: request }))
		).toBe(true);
		expect(request.sellerScope).toMatchObject({ sellerId: SELLER, channelId: CHANNEL, staff: false, role: 'OWNER' });
	});

	it('attaches the scope to the context itself when the server carries no request', async () => {
		// A GraphQL server does not have to build a request; the resolver reads both places for that
		// reason, and a scope that reached neither would be a field silently running unscoped.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		const fixture = guardFixture({ role: null });
		const gqlContext: any = {};

		expect(await fixture.guard.canActivate(graphqlContext({ sellerId: SELLER }, gqlContext))).toBe(true);
		expect(gqlContext.sellerScope).toMatchObject({ sellerId: SELLER, staff: true });
	});

	it('refuses a GraphQL field the caller has no scope for, rather than failing inside the guard', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const fixture = guardFixture({ role: null });

		await expect(
			fixture.guard.canActivate(graphqlContext({ sellerId: OTHER_SELLER }, { req: {} }))
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});
