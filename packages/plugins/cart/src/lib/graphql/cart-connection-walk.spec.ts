/**
 * A cursor walk over the cart package's two connections, on both ORMs, against a store that breaks ties as
 * it pleases.
 *
 * `carts` and `checkoutSessions` read their page through `findAll` with the row offset the cursor resolved
 * to, and label the page's edges from that same offset — so a cursor names a *position*, and a position only
 * means something in an order the store cannot rearrange between two reads. Both fields used to state no
 * order at all. On Postgres that is heap order, and an `UPDATE` — which every cart write is, because a cart
 * carries a version and its totals — writes a new tuple at the end of the heap, so a cart on page one could
 * reappear on page three while another was never shown; the other three dialects make no promise either.
 * The double below sorts by exactly the keys a read states and breaks every remaining tie in a different
 * arrangement on each read, the freedom a real store has, so a walk only answers every row once when the
 * order the resolver states is closed by the row's identity.
 *
 * `@gauzy/core` is the real barrel here, unlike this directory's other suites, for the reason
 * `pricing/src/lib/graphql/pagination.spec.ts` gives: the kernel's `findAll` and its MikroORM option parser
 * are the code the order has to survive, and a double of them would assert this file's opinion of them
 * rather than the platform's behaviour. Only the two repositories each service holds are doubled.
 */

import { MultiORMEnum, RequestContext } from '@gauzy/core';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCheckoutSessionService } from '../commerce-checkout-session/commerce-checkout-session.service';
import { CommerceCartResolver } from './commerce-cart.resolver';
import { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000002';
const ORG = '00000000-0000-4000-8000-000000000003';

/** One row, as much of it as the walk reads. */
interface IRow {
	readonly id: string;
	readonly tenantId: string;
	readonly organizationId: string;
	readonly createdAt: Date;
}

/** One read the double answered, in the shape the ORM that issued it states it. */
interface IAsked {
	readonly where: Record<string, unknown>;
	readonly order: Record<string, string>;
	readonly offset: number;
	readonly limit: number | undefined;
}

/** One page of a connection, as much of it as the walk reads. */
interface IPage {
	readonly nodes: ReadonlyArray<{ id?: string }>;
	readonly totalCount: number;
	readonly pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

/**
 * Rows written by one burst — a storefront's traffic spike, a checkout retried by many buyers — so they
 * share two instants between them and the creation time alone leaves every row tied with twenty others.
 *
 * @param count How many rows the caller's tenant holds.
 * @returns The caller's rows, followed by five of another tenant that no page may ever contain.
 */
function rows(count: number): IRow[] {
	const instants = [new Date('2026-01-15T12:00:00.000Z'), new Date('2026-01-15T12:00:01.000Z')];
	const row = (tenantId: string, index: number): IRow => ({
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		tenantId,
		organizationId: ORG,
		createdAt: instants[index % 2]
	});

	return [
		...Array.from({ length: count }, (_, index) => row(TENANT, 1000 + index)),
		...Array.from({ length: 5 }, (_, index) => row(OTHER_TENANT, 9000 + index))
	];
}

/**
 * @param left One value of a sort key.
 * @param right The other.
 * @returns Their comparison, as a database compares an instant or an identifier.
 */
function compare(left: unknown, right: unknown): number {
	const a = left instanceof Date ? left.getTime() : left;
	const b = right instanceof Date ? right.getTime() : right;

	if (a === b) {
		return 0;
	}

	return (a as number | string) < (b as number | string) ? -1 : 1;
}

/**
 * A table behind both repositories a service holds.
 *
 * Rows are sorted by the keys a read states and nothing else; every remaining tie is broken by the
 * arrangement the table is in, and that arrangement is reversed after every read. The MikroORM repository
 * answers what the kernel hands `EntityRepository.findAndCount` — the filter, then `{ orderBy, offset,
 * limit }` — with rows that serialise themselves, because the kernel reads that ORM's rows through
 * `wrap(entity).toJSON()`.
 *
 * @param tableName The table the TypeORM metadata names.
 * @param table The rows.
 * @returns The two repositories, and every read they answered.
 */
function store(tableName: string, table: IRow[]) {
	const asked: IAsked[] = [];
	let arrangement = [...table];

	/** Answers one read: the tenant's rows, in the stated order, from the stated row, as many as asked for. */
	function answer(ask: IAsked): [IRow[], number] {
		asked.push(ask);

		const matching = arrangement.filter(
			(row) => ask.where.tenantId === undefined || row.tenantId === ask.where.tenantId
		);
		const ordered = [...matching].sort((left, right) => {
			for (const [key, direction] of Object.entries(ask.order)) {
				const compared = compare((left as any)[key], (right as any)[key]);

				if (compared !== 0) {
					return String(direction).toUpperCase() === 'DESC' ? -compared : compared;
				}
			}

			return 0;
		});

		arrangement = [...arrangement].reverse();

		return [
			ordered.slice(ask.offset, ask.limit === undefined ? undefined : ask.offset + ask.limit),
			matching.length
		];
	}

	return {
		asked,
		typeOrm: {
			metadata: {
				tableName,
				hasColumnWithPropertyPath: (path: string) => path === 'tenantId' || path === 'organizationId'
			},
			findAndCount: async (options: any) =>
				answer({
					where: options?.where ?? {},
					order: options?.order ?? {},
					offset: options?.skip ?? 0,
					limit: options?.take
				})
		},
		mikroOrm: {
			findAndCount: async (where: any, options: any) => {
				const [page, total] = answer({
					where: where ?? {},
					order: options?.orderBy ?? {},
					offset: options?.offset ?? 0,
					limit: options?.limit
				});

				return [page.map((row) => ({ ...row, toJSON: () => ({ ...row }) })), total];
			}
		}
	};
}

/**
 * Chooses the ORM a service reads through.
 *
 * The kernel reads it through `this.ormType`, which is resolved once per process from `DB_ORM`, so a suite
 * that ran one ORM per process could never compare the two.
 *
 * @param service The service.
 * @param orm The ORM it reads through.
 * @returns The service.
 */
function readingThrough<T extends object>(service: T, orm: MultiORMEnum): T {
	Object.defineProperty(service, 'ormType', { get: () => orm });

	return service;
}

/**
 * The real `carts` field over the real service, reading through the ORM a case names.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns A page reader for the field, and the store double.
 */
function carts(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store('commerce_cart', table);
	// The collaborators the cart service holds beyond its own table are not reached by a listing.
	const service = readingThrough(
		new CommerceCartService(
			doubled.typeOrm as never,
			doubled.mikroOrm as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		),
		orm
	);
	const resolver = new CommerceCartResolver(service);

	return {
		...doubled,
		read: (first: number, after?: string): Promise<IPage> =>
			resolver.carts(undefined, undefined, undefined, { first, ...(after ? { after } : {}) })
	};
}

/**
 * The real `checkoutSessions` field over the real service, reading through the ORM a case names.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns A page reader for the field, and the store double.
 */
function checkoutSessions(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store('commerce_checkout_session', table);
	const service = readingThrough(
		new CommerceCheckoutSessionService(doubled.typeOrm as never, doubled.mikroOrm as never),
		orm
	);
	// The cart service is the version guard's resource and the completion's writer; a listing reaches neither.
	const resolver = new CommerceCheckoutSessionResolver({} as never, service);

	return {
		...doubled,
		read: (first: number, after?: string): Promise<IPage> =>
			resolver.checkoutSessions(undefined, undefined, { first, ...(after ? { after } : {}) })
	};
}

/**
 * Walks a connection to its end, the way a client does: each page after the first starts after the last
 * cursor it was handed.
 *
 * @param read Reads one page.
 * @param first The page size.
 * @returns Every page the walk was answered.
 */
async function walk(read: (first: number, after?: string) => Promise<IPage>, first: number): Promise<IPage[]> {
	const pages: IPage[] = [];
	let after: string | undefined;

	for (let guard = 0; guard < 10; guard++) {
		const page = await read(first, after);

		pages.push(page);

		if (!page.pageInfo.hasNextPage) {
			return pages;
		}

		after = page.pageInfo.endCursor ?? undefined;
	}

	throw new Error('the walk did not end: a page kept saying there was another one');
}

/** The two fields, and the surface each is read through. */
const FIELDS = [
	['carts', carts],
	['checkoutSessions', checkoutSessions]
] as const;

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('the cart connections over %s', (orm) => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user', tenantId: TENANT } as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(FIELDS)(
		'%s — a cursor walk answers every row of the tenant exactly once, newest first',
		async (_, surface) => {
			const table = rows(45);
			const { read, asked } = surface(orm, table);

			const pages = await walk(read, 20);

			// What the store was asked: rows 0–19, 20–39 and 40–44, each read cut from the same stated order.
			expect(asked.map((ask) => [ask.offset, ask.limit])).toEqual([
				[0, 20],
				[20, 20],
				[40, 20]
			]);

			// What the client was given: the tenant's forty-five rows in the one arrangement the stated order
			// allows — the later instant first, and the identity deciding among the rows of one instant — none of
			// them twice and none of another tenant's.
			const expected = table
				.filter((row) => row.tenantId === TENANT)
				.sort((left, right) => compare(right.createdAt, left.createdAt) || compare(right.id, left.id))
				.map((row) => row.id);

			expect(pages.map((page) => page.nodes.length)).toEqual([20, 20, 5]);
			expect(pages.flatMap((page) => page.nodes.map((node) => node.id))).toEqual(expected);
			expect(pages.every((page) => page.totalCount === 45)).toBe(true);

			// Every read states the order it was cut from, closed by `id`, and is scoped to the caller's tenant.
			// The keys are compared in sequence and the directions without regard to case, because the kernel's
			// MikroORM parser lowers them — `desc` is the same order as `DESC`.
			for (const ask of asked) {
				expect(
					Object.entries(ask.order).map(([key, direction]) => [key, String(direction).toUpperCase()])
				).toEqual([
					['createdAt', 'DESC'],
					['id', 'DESC']
				]);
				expect(ask.where).toMatchObject({ tenantId: TENANT });
			}
		}
	);
});

describe('the store double — an order with ties is not one a cursor can page', () => {
	it('answers overlapping pages to an order that leaves ties, which is why the walk above closes it', async () => {
		// The instrument, checked: the double really does rearrange ties between reads, so the walk above
		// passing is evidence about the order the resolvers state rather than about a table that happened to
		// be sorted already.
		const { typeOrm } = store('commerce_cart', rows(45));
		const where = { tenantId: TENANT };

		const [first] = await typeOrm.findAndCount({ where, order: { createdAt: 'DESC' }, skip: 0, take: 20 });
		const [second] = await typeOrm.findAndCount({ where, order: { createdAt: 'DESC' }, skip: 20, take: 20 });
		const seen = new Set(first.map((row) => row.id));

		expect(second.some((row) => seen.has(row.id))).toBe(true);
	});
});
