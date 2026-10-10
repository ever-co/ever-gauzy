/**
 * A cursor walk over a catalog connection, on both ORMs, against a store that breaks ties as it pleases.
 *
 * The package's list fields read their page through `findAll` with the row offset the cursor resolved to,
 * and label the page's edges from that same offset. Two things have to hold for the walk a client makes —
 * `first: 20`, then `after: endCursor` — to answer every row once, and neither is visible in a suite that
 * doubles the kernel:
 *
 * - **`findAll` reads `skip` as a row offset on both ORMs.** Under `DB_ORM=mikro-orm` the kernel used to
 *   parse it as a page *number* — `offset = take × (skip − 1)` — so the page after the first twenty
 *   collections was read from row 380, and the move from `paginate` to `findAll` in this package changed
 *   nothing on that ORM, because both went through the same parser;
 * - **the order is total.** The store double below sorts by exactly the keys it is handed and breaks every
 *   remaining tie in a different arrangement on each read — the freedom a real store has once the planner
 *   changes plan or an `UPDATE` moves a tuple — so a walk only answers every row once when the order the
 *   resolver states is closed by the row's identity.
 *
 * `@gauzy/core` is the real barrel here, unlike `catalog-connections.spec.ts` beside it, for the reason
 * `resolvers/soft-delete.spec.ts` gives: the kernel's `findAll` and its MikroORM option parser are the code
 * under test, and a double of them would assert this file's opinion rather than the platform's behaviour.
 * Only the two repositories are doubled.
 */

import { MultiORMEnum, RequestContext } from '@gauzy/core';
import { CollectionService } from '../collection/collection.service';
import { CollectionResolver } from './resolvers/collection.resolver';

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000002';
const ORG = '00000000-0000-4000-8000-000000000003';

/** One `collection` row, as much of it as the walk reads. */
interface IRow {
	readonly id: string;
	readonly tenantId: string;
	readonly organizationId: string;
	readonly sortOrder: number;
	readonly createdAt: Date;
}

/** One read the double answered, in the shape the ORM that issued it states it. */
interface IAsked {
	readonly where: Record<string, unknown>;
	readonly order: Record<string, string>;
	readonly offset: number;
	readonly limit: number | undefined;
}

/**
 * Collections created by one import: every one at the default position and in the same instant, so the
 * merchandiser's order leaves all of them tied and only the identity tells them apart.
 *
 * @param count How many rows the caller's tenant holds.
 * @returns The caller's rows, followed by five of another tenant that no page may ever contain.
 */
function rows(count: number): IRow[] {
	const createdAt = new Date('2026-01-15T12:00:00.000Z');
	const row = (tenantId: string, index: number): IRow => ({
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		tenantId,
		organizationId: ORG,
		sortOrder: 0,
		createdAt
	});

	return [
		...Array.from({ length: count }, (_, index) => row(TENANT, 1000 + index)),
		...Array.from({ length: 5 }, (_, index) => row(OTHER_TENANT, 9000 + index))
	];
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
 * A `collection` table behind both repositories the service holds.
 *
 * Rows are sorted by the keys a read states and nothing else; every remaining tie is broken by the
 * arrangement the table is in, and that arrangement is reversed after every read. The MikroORM repository
 * answers what the kernel hands `EntityRepository.findAndCount` — the filter, then `{ orderBy, offset,
 * limit }` — with rows that serialise themselves, because the kernel reads that ORM's rows through
 * `wrap(entity).toJSON()`.
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
				tableName: 'collection',
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
 * The real resolver over the real service, reading through the ORM a case names.
 *
 * The ORM is chosen on the instance because the kernel resolves `ormType` once per process from `DB_ORM`.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns The resolver and the store double.
 */
function surface(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store(table);
	const eventBus = { ofType: () => ({ pipe: () => null }), publish: () => undefined };
	const service = new CollectionService(doubled.typeOrm as never, doubled.mikroOrm as never, eventBus as never);

	Object.defineProperty(service, 'ormType', { get: () => orm });

	return { ...doubled, resolver: new CollectionResolver(service, eventBus as never) };
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'collections over %s — a cursor walk answers every row once',
	(orm) => {
		beforeEach(() => {
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user', tenantId: TENANT } as never);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		});

		afterEach(() => jest.restoreAllMocks());

		it('reads the page after `first: 20` from row 20, and walks every row of the tenant once', async () => {
			const table = rows(45);
			const { resolver, asked } = surface(orm, table);

			const pages = [];
			let after: string | undefined;

			for (let guard = 0; guard < 10; guard++) {
				const page = await resolver.collections(undefined, undefined, undefined, {
					first: 20,
					...(after ? { after } : {})
				});

				pages.push(page);

				if (!page.pageInfo.hasNextPage) {
					break;
				}

				after = page.pageInfo.endCursor ?? undefined;
			}

			// What the store was asked: rows 0–19, 20–39 and 40–44. Under MikroORM the second read used to be
			// `offset: 380` — twenty read as a page number — which is past the end of the table.
			expect(asked.map((ask) => [ask.offset, ask.limit])).toEqual([
				[0, 20],
				[20, 20],
				[40, 20]
			]);

			// What the client was given: the tenant's forty-five collections, in the one arrangement the
			// stated order allows, none of them twice and none of another tenant's.
			const expected = table
				.filter((row) => row.tenantId === TENANT)
				.map((row) => row.id)
				.sort();

			expect(pages.map((page) => page.nodes.length)).toEqual([20, 20, 5]);
			expect(pages.flatMap((page) => page.nodes.map((node) => node.id))).toEqual(expected);
			expect(pages.every((page) => page.totalCount === 45)).toBe(true);

			for (const ask of asked) {
				expect(Object.keys(ask.order)).toEqual(['sortOrder', 'createdAt', 'id']);
				expect(ask.where).toMatchObject({ tenantId: TENANT });
			}
		});
	}
);
