/**
 * A cursor walk over a pricing connection, on both ORMs, against a store that breaks ties as it pleases.
 *
 * Two defects are pinned here, and both are the kind nothing reports:
 *
 * - **the window is a row offset on both ORMs.** `readConnection` hands the service `skip` as the row the
 *   page starts at, which is what `findAll` takes, and labels the page's edges from that same offset. Under
 *   `DB_ORM=mikro-orm` the kernel used to read that `skip` as a page *number* — `offset = take × (skip − 1)`
 *   — so `priceLists(page: { first: 20, after: <offset 19> })` asked the store for row 380, answered an
 *   empty page and still said `hasNextPage`; with `first: 1` it answered row 0 a second time. The walk below
 *   therefore runs through the real `PriceListService` and the kernel's real `CrudService`, with only the
 *   repositories doubled, once per ORM, and asserts both what the store was asked for and what the client
 *   was given;
 * - **the order is total.** An offset cursor names a position, and a position only means something in an
 *   order the store cannot rearrange between two reads. The double below sorts by exactly the keys it is
 *   handed and breaks every remaining tie in a different arrangement on each read — which is what a planner
 *   choosing another plan as the offset grows, or a Postgres `UPDATE` moving a tuple to the end of the heap,
 *   does to a real read. A list ordered by `priority` alone repeats rows across pages under it; the same list
 *   closed by `id` walks every row exactly once.
 *
 * `@gauzy/core` is the real barrel here, as it is in this package's service suites: the kernel's `findAll`
 * and its MikroORM option parser are the code under test, so doubling them would assert this file's
 * opinion of them rather than the platform's behaviour.
 */

import { MultiORMEnum, RequestContext } from '@gauzy/core';
import { PriceListService } from '../price-list/price-list.service';
import { PriceListResolver } from './resolvers/price-list.resolver';
import { ConnectionReadOrder, totalOrder } from './pagination';

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000002';
const ORG = '00000000-0000-4000-8000-000000000003';

/** One `price_list` row, as much of it as the walk reads. */
interface IRow {
	readonly id: string;
	readonly tenantId: string;
	readonly organizationId: string;
	readonly priority: number;
	readonly createdAt: Date;
}

/** One read the double answered, in the shape the ORM that issued it states it. */
interface IAsked {
	readonly orm: 'typeorm' | 'mikro-orm';
	readonly where: Record<string, unknown>;
	readonly order: Record<string, string>;
	readonly offset: number;
	readonly limit: number | undefined;
}

/**
 * The price lists of a tenant that imported them in one batch: two priorities, one instant, so the order
 * the resource reads in by default — priority, then creation — leaves every row tied with twenty others.
 *
 * @param count How many rows the caller's tenant holds.
 * @returns The caller's rows, followed by five of another tenant that no page may ever contain.
 */
function rows(count: number): IRow[] {
	const createdAt = new Date('2026-01-15T12:00:00.000Z');
	const own = Array.from({ length: count }, (_, index) => ({
		id: `00000000-0000-4000-8000-${String(1000 + index).padStart(12, '0')}`,
		tenantId: TENANT,
		organizationId: ORG,
		priority: index % 2 === 0 ? 10 : 0,
		createdAt
	}));
	const theirs = Array.from({ length: 5 }, (_, index) => ({
		id: `00000000-0000-4000-8000-${String(9000 + index).padStart(12, '0')}`,
		tenantId: OTHER_TENANT,
		organizationId: ORG,
		priority: 10,
		createdAt
	}));

	return [...own, ...theirs];
}

/**
 * @param left One value of a sort key.
 * @param right The other.
 * @returns Their comparison, as a database compares a number, an instant or an identifier.
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
 * A `price_list` table behind both repositories the service holds.
 *
 * The rows are sorted by the keys a read states and nothing else. Every tie those keys leave is broken by
 * the arrangement the table happens to be in, and that arrangement is reversed after every read — the
 * freedom a real store has, and the one that makes an order with ties unsafe to page.
 *
 * The MikroORM repository answers what the kernel hands `EntityRepository.findAndCount` — the filter, then
 * `{ orderBy, offset, limit }` — and its rows are wrapped entities, because the kernel serialises what that
 * ORM answers through `wrap(entity).toJSON()`.
 *
 * @param table The rows.
 * @returns The two repositories, and every read they answered.
 */
function store(table: IRow[]) {
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
				tableName: 'price_list',
				hasColumnWithPropertyPath: (path: string) => path === 'tenantId' || path === 'organizationId'
			},
			findAndCount: async (options: any) =>
				answer({
					orm: 'typeorm',
					where: options?.where ?? {},
					order: options?.order ?? {},
					offset: options?.skip ?? 0,
					limit: options?.take
				})
		},
		mikroOrm: {
			findAndCount: async (where: any, options: any) => {
				const [page, total] = answer({
					orm: 'mikro-orm',
					where: where ?? {},
					order: options?.orderBy ?? {},
					offset: options?.offset ?? 0,
					limit: options?.limit
				});

				// A MikroORM entity serialises itself; the kernel reads it through `toJSON`, not as a plain object.
				return [page.map((row) => ({ ...row, toJSON: () => ({ ...row }) })), total];
			}
		}
	};
}

/**
 * The real resolver over the real service, reading through the ORM a case names.
 *
 * The ORM is chosen on the instance: the kernel reads it through `this.ormType`, which is resolved once per
 * process from `DB_ORM`, so a suite that ran one ORM per process could never compare the two.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns The resolver and the store double.
 */
function surface(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store(table);
	const service = new PriceListService(doubled.typeOrm as never, doubled.mikroOrm as never, {} as never);

	Object.defineProperty(service, 'ormType', { get: () => orm });

	return { ...doubled, resolver: new PriceListResolver(service) };
}

/**
 * Walks a connection to its end, the way a client does: each page after the first starts after the last
 * cursor it was handed.
 *
 * @param resolver The resolver to walk.
 * @param first The page size.
 * @returns Every page the walk was answered.
 */
async function walk(resolver: PriceListResolver, first: number) {
	const pages = [];
	let after: string | undefined;

	for (let guard = 0; guard < 100; guard++) {
		const page = await resolver.priceLists(undefined, undefined, { first, ...(after ? { after } : {}) });

		pages.push(page);

		if (!page.pageInfo.hasNextPage) {
			return pages;
		}

		after = page.pageInfo.endCursor ?? undefined;
	}

	throw new Error('the walk did not end: a page kept saying there was another one');
}

describe('totalOrder — the order a store-paged connection reads in', () => {
	it('closes the order it was given with the row’s identity, in the direction of the leading key', () => {
		expect(totalOrder({ priority: 'DESC', createdAt: 'DESC' })).toEqual({
			priority: 'DESC',
			createdAt: 'DESC',
			id: 'DESC'
		});
		expect(Object.keys(totalOrder({ attribute: 'ASC', value: 'ASC' }))).toEqual(['attribute', 'value', 'id']);
		expect(totalOrder({ attribute: 'ASC', value: 'ASC' }).id).toBe('ASC');
	});

	it('leaves an order that already names the identity as it is, and orders an unordered read by it', () => {
		const ordered: ConnectionReadOrder = { id: 'ASC', code: 'DESC' };

		expect(totalOrder(ordered)).toEqual(ordered);
		expect(totalOrder(ordered)).not.toBe(ordered);
		expect(totalOrder({})).toEqual({ id: 'ASC' });
	});
});

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'priceLists over %s — a cursor walk answers every row once',
	(orm) => {
		beforeEach(() => {
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user', tenantId: TENANT } as never);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		});

		afterEach(() => jest.restoreAllMocks());

		it('reads the page after `first: 20` from row 20, and labels it from row 20', async () => {
			const table = rows(45);
			const { resolver, asked } = surface(orm, table);

			const first = await resolver.priceLists(undefined, undefined, { first: 20 });
			const second = await resolver.priceLists(undefined, undefined, {
				first: 20,
				after: first.pageInfo.endCursor ?? undefined
			});

			// What the store was asked: rows 0–19, then rows 20–39. Under MikroORM the second read used to be
			// `offset: 380` — twenty read as a page number — which is an empty page past the end of the table.
			expect(asked.map((ask) => [ask.orm, ask.offset, ask.limit])).toEqual([
				[orm, 0, 20],
				[orm, 20, 20]
			]);

			// What the client was given: twenty rows, then the next twenty, none of them twice.
			expect(first.nodes).toHaveLength(20);
			expect(second.nodes).toHaveLength(20);
			expect(new Set([...first.nodes, ...second.nodes].map((node) => node.id)).size).toBe(40);
			expect(second.totalCount).toBe(45);
			expect(second.pageInfo.hasPreviousPage).toBe(true);
			expect(second.pageInfo.hasNextPage).toBe(true);
		});

		it('walks every row of the tenant exactly once, in the order the resource reads in', async () => {
			const table = rows(45);
			const { resolver, asked } = surface(orm, table);

			const pages = await walk(resolver, 20);
			const walked = pages.flatMap((page) => page.nodes.map((node) => node.id));

			// Priority first, as the field documents, and the identity after it: the ties the batch import left
			// are broken the same way on every read, so the three pages are three slices of one arrangement.
			const expected = table
				.filter((row) => row.tenantId === TENANT)
				.sort((left, right) => right.priority - left.priority || compare(right.id, left.id))
				.map((row) => row.id);

			expect(pages).toHaveLength(3);
			expect(walked).toEqual(expected);
			expect(pages.every((page) => page.totalCount === 45)).toBe(true);

			// Every read states the order it was cut from, closed by `id`, and is scoped to the caller's tenant —
			// which is why the other tenant's five rows are in neither the pages nor the count.
			for (const ask of asked) {
				expect(Object.keys(ask.order)).toEqual(['priority', 'createdAt', 'id']);
				expect(ask.where).toMatchObject({ tenantId: TENANT });
			}
		});

		it('resumes one row on after `first: 1`, rather than answering the first row again', async () => {
			const { resolver, asked } = surface(orm, rows(3));

			const first = await resolver.priceLists(undefined, undefined, { first: 1 });
			const second = await resolver.priceLists(undefined, undefined, {
				first: 1,
				after: first.pageInfo.endCursor ?? undefined
			});

			// `after: <offset 0>` is row 1. Read as a page number it was `offset: 1 × (1 − 1) = 0` — row 0 again,
			// under a cursor that said it was row 1.
			expect(asked[1].offset).toBe(1);
			expect(second.nodes[0].id).not.toBe(first.nodes[0].id);
		});
	}
);

describe('the store double — an order with ties is not one a cursor can page', () => {
	it('answers overlapping pages to an order that leaves ties, which is why the walk above closes it', async () => {
		// The instrument, checked: the double really does rearrange ties between reads, so the walk above
		// passing is evidence about the order the resolver states rather than about a table that happened to
		// be sorted already.
		const { typeOrm } = store(rows(45));
		const where = { tenantId: TENANT };

		const [first] = await typeOrm.findAndCount({ where, order: { priority: 'DESC' }, skip: 0, take: 20 });
		const [second] = await typeOrm.findAndCount({ where, order: { priority: 'DESC' }, skip: 20, take: 20 });
		const seen = new Set(first.map((row) => row.id));

		expect(second.some((row) => seen.has(row.id))).toBe(true);
	});
});
