/**
 * A cursor walk over the fulfilment domain's three connections, on both ORMs, against a store that breaks
 * ties as it pleases.
 *
 * `fulfillments`, `shippingProfiles` and `shippingOptions` read their page through `findAll` with the row
 * offset the cursor resolved to, and label the page's edges from that same offset — so a cursor names a
 * *position*, and a position only means something in an order the store cannot rearrange between two reads.
 * All three fields used to state no order at all. On Postgres that is heap order, and an `UPDATE` — which
 * shipping, delivering or cancelling a shipment is — writes a new tuple at the end of the heap, so a shipment
 * on page one could reappear on page three while another was never shown; the other three dialects make no
 * promise either. The double below sorts by exactly the keys a read states and breaks every remaining tie in
 * a different arrangement on each read, the freedom a real store has, so a walk only answers every row once
 * when the order the resolver states is closed by the row's identity.
 *
 * `@gauzy/core` is the real barrel here, as it is in `soft-delete.spec.ts` beside this file and for the
 * reason `pricing/src/lib/graphql/pagination.spec.ts` gives: the kernel's `findAll` and its MikroORM option
 * parser are the code the order has to survive, and a double of them would assert this file's opinion of
 * them rather than the platform's behaviour. Only the two repositories each service holds are doubled, and
 * the order package, which the fulfilment service reaches for collaborators no listing reads — the same
 * substitution, for the same reason, that `soft-delete.spec.ts` makes.
 */

jest.mock('@gauzy/plugin-order', () => ({
	OrderLineService: class OrderLineService {},
	OrderTotalsService: class OrderTotalsService {}
}));

import { MultiORMEnum, RequestContext } from '@gauzy/core';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { ShippingOptionService } from '../shipping-option/shipping-option.service';
import { ShippingProfileService } from '../shipping-profile/shipping-profile.service';
import { FulfillmentResolver } from './fulfillment.resolver';
import { ShippingOptionResolver } from './shipping-option.resolver';

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000002';
const ORG = '00000000-0000-4000-8000-000000000003';

/** One row, as much of it as the walk reads. `priority` is the option's own; the other two tables ignore it. */
interface IRow {
	readonly id: string;
	readonly tenantId: string;
	readonly organizationId: string;
	readonly priority: number;
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
 * Rows written by one import — a carrier's service levels loaded from a sheet, a warehouse's backlog of
 * shipments created by one batch — so two priorities and two instants are shared among forty-five rows and
 * every key but the identity leaves each row tied with ten others.
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
		priority: index % 2 === 0 ? 10 : 0,
		createdAt: instants[Math.floor(index / 3) % 2]
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

/** Reads one page of a connection. */
type PageReader = (first: number, after?: string) => Promise<IPage>;

/**
 * The real `fulfillments` field over the real service, reading through the ORM a case names.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns A page reader for the field, and the store double.
 */
function fulfillments(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store('fulfillment', table);
	// The line, order-line, outbox and totals collaborators are the writes' — a listing reaches none of them.
	const service = readingThrough(
		new FulfillmentService(
			doubled.typeOrm as never,
			doubled.mikroOrm as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		),
		orm
	);
	const resolver = new FulfillmentResolver(service, {} as never);
	const read: PageReader = (first, after) =>
		resolver.fulfillments(undefined, undefined, undefined, undefined, { first, ...(after ? { after } : {}) });

	return { ...doubled, read };
}

/**
 * The real `shippingProfiles` field over the real service, reading through the ORM a case names.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns A page reader for the field, and the store double.
 */
function shippingProfiles(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store('shipping_profile', table);
	// The variant attachments are the profile resolution's collaborator, not the listing's.
	const service = readingThrough(
		new ShippingProfileService(doubled.typeOrm as never, doubled.mikroOrm as never, {} as never),
		orm
	);
	const resolver = new ShippingOptionResolver({} as never, service);
	const read: PageReader = (first, after) => resolver.shippingProfiles({ first, ...(after ? { after } : {}) });

	return { ...doubled, read };
}

/**
 * The real `shippingOptions` field over the real service, reading through the ORM a case names.
 *
 * @param orm The ORM the service reads through.
 * @param table The rows behind it.
 * @returns A page reader for the field, and the store double.
 */
function shippingOptions(orm: MultiORMEnum, table: IRow[]) {
	const doubled = store('shipping_option', table);
	const service = readingThrough(new ShippingOptionService(doubled.typeOrm as never, doubled.mikroOrm as never), orm);
	const resolver = new ShippingOptionResolver(service, {} as never);
	const read: PageReader = (first, after) => resolver.shippingOptions({ first, ...(after ? { after } : {}) });

	return { ...doubled, read };
}

/**
 * Walks a connection to its end, the way a client does: each page after the first starts after the last
 * cursor it was handed.
 *
 * @param read Reads one page.
 * @param first The page size.
 * @returns Every page the walk was answered.
 */
async function walk(read: PageReader, first: number): Promise<IPage[]> {
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

/** Newest first, the identity deciding among the rows of one instant. */
const NEWEST_FIRST = (left: IRow, right: IRow) =>
	compare(right.createdAt, left.createdAt) || compare(right.id, left.id);

/** The option's documented display order — lowest priority first — then the order they were configured in. */
const BY_PRIORITY = (left: IRow, right: IRow) =>
	compare(left.priority, right.priority) || compare(left.createdAt, right.createdAt) || compare(left.id, right.id);

/** Each field, the surface it is read through, the order it must state and the arrangement that order allows. */
const FIELDS = [
	['fulfillments', fulfillments, { createdAt: 'DESC', id: 'DESC' }, NEWEST_FIRST],
	['shippingProfiles', shippingProfiles, { createdAt: 'DESC', id: 'DESC' }, NEWEST_FIRST],
	['shippingOptions', shippingOptions, { priority: 'ASC', createdAt: 'ASC', id: 'ASC' }, BY_PRIORITY]
] as const;

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('the fulfilment connections over %s', (orm) => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user', tenantId: TENANT } as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(FIELDS)(
		'%s — a cursor walk answers every row of the tenant exactly once, in the order the field reads in',
		async (_, surface, order, arrangement) => {
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
			// allows, none of them twice and none of another tenant's.
			const expected = table
				.filter((row) => row.tenantId === TENANT)
				.sort(arrangement)
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
				).toEqual(Object.entries(order));
				expect(ask.where).toMatchObject({ tenantId: TENANT });
			}
		}
	);
});

describe('the store double — an order with ties is not one a cursor can page', () => {
	it('answers overlapping pages to an order that leaves ties, which is why the walk above closes it', async () => {
		// The instrument, checked: the double really does rearrange ties between reads, so the walk above
		// passing is evidence about the order the resolvers state rather than about a table that happened to
		// be sorted already. `priority` alone is the order the eligibility read sorts by.
		const { typeOrm } = store('shipping_option', rows(45));
		const where = { tenantId: TENANT };

		const [first] = await typeOrm.findAndCount({ where, order: { priority: 'ASC' }, skip: 0, take: 20 });
		const [second] = await typeOrm.findAndCount({ where, order: { priority: 'ASC' }, skip: 20, take: 20 });
		const seen = new Set(first.map((row) => row.id));

		expect(second.some((row) => seen.has(row.id))).toBe(true);
	});
});
