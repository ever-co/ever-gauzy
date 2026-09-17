import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceListStatus, PriceListType, PriceStatus, PriceSource } from '../pricing.types';
import { ProductPriceService } from '../product-price/product-price.service';
import { PriceListService } from './price-list.service';

/**
 * The lifecycle of a price list, and the dry run of one.
 *
 * A list is the unit an operator publishes, so the suite pins the two transitions that change what
 * the storefront charges — a list whose window has closed cannot be activated, and a withdrawn list
 * keeps its rows — plus the rule that a *partial* edit is validated against the stored half of the
 * window rather than against nothing.
 *
 * The dry run is exercised through the real resolution rather than through a spy: the same rows are
 * resolved twice, once live and once simulated, and the draft list's price must be invisible to the
 * first and visible to the second. That is the whole point of previewing a list.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const LIST = '00000000-0000-4000-8000-000000000120';

/** The programme's frozen clock. */
const AT = new Date('2026-01-15T12:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');
const NEXT_YEAR = new Date('2027-06-01T00:00:00.000Z');

interface IListRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	name: string;
	code: string;
	type: PriceListType;
	status: PriceListStatus;
	priority: number;
	currency?: string;
	isTaxInclusive?: boolean;
	startsAt?: Date;
	endsAt?: Date;
}

interface IPriceRow {
	id: string;
	tenantId: string;
	organizationId: string;
	variantId: string;
	priceListId?: string;
	currency: string;
	amount: string;
	status: PriceStatus;
}

const priceList = (overrides: Partial<IListRow> = {}): IListRow => ({
	id: LIST,
	tenantId: TENANT,
	organizationId: ORG,
	name: 'Summer sale',
	code: 'SUMMER',
	type: PriceListType.SALE,
	status: PriceListStatus.DRAFT,
	priority: 0,
	...overrides
});

const priceRow = (overrides: Partial<IPriceRow> = {}): IPriceRow => ({
	id: 'p-list',
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	priceListId: LIST,
	currency: 'CAD',
	amount: '14.990000',
	status: PriceStatus.ACTIVE,
	...overrides
});

function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		const value = fields[field];

		if (expected instanceof FindOperator) {
			switch (expected.type) {
				case 'in':
					return (expected.value as unknown[]).some((one) => same(one, value));
				case 'isNull':
					return value === null || value === undefined;
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || same(expected, value);
	});
}

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * @param lists The `price_list` rows.
 * @param prices The `product_price` rows.
 * @returns A list service over the double, with the prices service the dry run goes through.
 */
function serviceUnderTest(lists: IListRow[], prices: IPriceRow[] = []) {
	const softDeleted: string[] = [];
	const hardDeleted: string[] = [];

	const typeOrmPriceListRepository = {
		softDeleted,
		hardDeleted,
		find: async (options?: { where?: Record<string, unknown> }) =>
			lists.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			lists.filter((row) => matches(row, options?.where))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) => lists.filter((row) => matches(row, where))[0] ?? null,
		create: (partial: IListRow) => ({ ...partial }),
		save: async (entity: IListRow) => {
			lists.push(entity);

			return entity;
		},
		update: async (id: string, partial: Partial<IListRow>) => {
			const row = lists.find((one) => same(one.id, id));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: 1 };
		},
		softDelete: async (criteria: string | { id?: string }) => {
			softDeleted.push(String(typeof criteria === 'string' ? criteria : criteria?.id));

			return { affected: 1 };
		},
		delete: async (criteria: string | { id?: string }) => {
			hardDeleted.push(String(typeof criteria === 'string' ? criteria : criteria?.id));

			return { affected: 1 };
		}
	};

	const typeOrmProductPriceRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices
				.filter((row) => matches(row, options?.where))
				.map((row) => ({
					...row,
					priceList: row.priceListId ? lists.find((list) => same(list.id, row.priceListId)) : undefined
				})),
		findOne: async () => null,
		findOneBy: async () => null,
		manager: { find: async () => [] }
	};

	const productPriceService = new ProductPriceService(
		typeOrmProductPriceRepository as never,
		{} as never,
		{ resolveTaxInclusivity: async () => null } as never,
		// A `LIST` derivation converts through the rate in force and fails closed when there is none; no
		// fixture in this file derives its price, so a converter that refuses is the honest stub.
		{
			convert: async () => {
				throw new Error('no rate covers the pair');
			}
		} as never
	);

	return {
		repository: typeOrmPriceListRepository,
		productPriceService,
		service: new PriceListService(typeOrmPriceListRepository as never, {} as never, productPriceService)
	};
}

describe('PriceListService — the window and the scope a list is stored with (doc 08 §4.2, §4.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a window that ends before it starts, because such a list is never eligible', async () => {
		const { service } = serviceUnderTest([]);

		await expect(
			service.createOne({ name: 'Broken', code: 'BROKEN', startsAt: NEXT_YEAR, endsAt: LAST_YEAR } as never)
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_LIST_WINDOW_INVALID') });
	});

	it('refuses a list with no name or no code', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.createOne({ code: 'NO-NAME' } as never)).rejects.toMatchObject({
			message: expect.stringContaining('PRICE_LIST_NAME_REQUIRED')
		});
		await expect(service.createOne({ name: 'No code' } as never)).rejects.toMatchObject({
			message: expect.stringContaining('PRICE_LIST_CODE_REQUIRED')
		});
	});

	it('validates a partial edit against the stored half of the window', async () => {
		// Only `startsAt` is being changed, and it lands after the stored `endsAt`: the two bounds are one
		// window, so the change has to be refused even though the caller stated only one of them.
		const { service } = serviceUnderTest([priceList({ status: PriceListStatus.ACTIVE, endsAt: LAST_YEAR })]);

		await expect(
			service.updateOne(LIST, { name: 'Summer sale', code: 'SUMMER', startsAt: AT } as never)
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_LIST_WINDOW_INVALID') });
	});

	it('normalises the currency of a list', async () => {
		const { service } = serviceUnderTest([]);

		const created = await service.createOne({ name: 'US retail', code: 'US', currency: 'usd' } as never);

		expect(created.currency).toBe('USD');
	});

	it('refuses a currency that is not a three-letter code', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.createOne({ name: 'Bad', code: 'BAD', currency: 'DOLLARS' } as never)).rejects.toMatchObject(
			{ message: expect.stringContaining('PRICE_INVALID_CURRENCY') }
		);
	});
});

describe('PriceListService — activation and withdrawal (doc 08 §4.1, §4.3, §4.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.useFakeTimers({ now: AT });
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('activates a list whose window is still open', async () => {
		const { service } = serviceUnderTest([priceList({ status: PriceListStatus.DRAFT, endsAt: NEXT_YEAR })]);

		const activated = await service.activate(LIST);

		expect(activated.status).toBe(PriceListStatus.ACTIVE);
	});

	it('refuses to activate a list whose window has already closed', async () => {
		// Activating it would publish prices that can never be charged.
		const { service } = serviceUnderTest([priceList({ status: PriceListStatus.DRAFT, endsAt: LAST_YEAR })]);

		await expect(service.activate(LIST)).rejects.toMatchObject({
			message: expect.stringContaining('PRICE_LIST_WINDOW_CLOSED')
		});
	});

	it('withdraws a list without deleting it and keeps its prices queryable', async () => {
		const { service, repository } = serviceUnderTest(
			[priceList({ status: PriceListStatus.ACTIVE })],
			[priceRow({})]
		);

		const expired = await service.expire(LIST);

		expect(expired.status).toBe(PriceListStatus.INACTIVE);
		expect(repository.softDeleted).toEqual([]);
		expect(repository.hardDeleted).toEqual([]);
	});

	it('soft-deletes a list that has prices and hard-deletes one only when the caller forces it', async () => {
		const soft = serviceUnderTest([priceList({ status: PriceListStatus.INACTIVE })], [priceRow({})]);
		await soft.service.deletePriceList(LIST);

		expect(soft.repository.softDeleted).toEqual([LIST]);
		expect(soft.repository.hardDeleted).toEqual([]);

		const hard = serviceUnderTest([priceList({ status: PriceListStatus.INACTIVE })], [priceRow({})]);
		await hard.service.deletePriceList(LIST, { force: true });

		expect(hard.repository.hardDeleted).toEqual([LIST]);
	});
});

describe('PriceListService.simulate — the dry run of one list (doc 08 §4.3, §7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('resolves a DRAFT list in the dry run and leaves it ineligible for the live resolution', async () => {
		// The same rows, resolved twice: a draft list is invisible to the storefront and is exactly what
		// `simulate` exists to preview. Resolution is restricted to the list asked about, so the default
		// price is not what comes back.
		const draft = priceList({ status: PriceListStatus.DRAFT });
		const rows = [priceRow({ id: 'p-draft', priceListId: LIST }), priceRow({ id: 'p-default', priceListId: undefined, amount: '19.990000' })];
		const { service, productPriceService } = serviceUnderTest([draft], rows);

		const live = await productPriceService.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT });
		const simulated = await service.simulate(LIST, { variantIds: [VARIANT], currency: 'CAD', date: AT });

		expect(live).toHaveLength(1);
		expect(live[0].amount).toBe('19.990000');
		expect(live[0].source).toBe(PriceSource.DEFAULT_PRICE);

		expect(simulated).toHaveLength(1);
		expect(simulated[0].amount).toBe('14.990000');
		expect(simulated[0].priceListId).toBe(LIST);
	});

	it('writes nothing when it simulates', async () => {
		const { service, repository } = serviceUnderTest([priceList({ status: PriceListStatus.ACTIVE })], [priceRow({})]);

		await service.simulate(LIST, { variantIds: [VARIANT], currency: 'CAD', date: AT });

		expect(repository.softDeleted).toEqual([]);
		expect(repository.hardDeleted).toEqual([]);
	});

	it('refuses to simulate a list the caller cannot see', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.simulate(LIST, { variantIds: [VARIANT], currency: 'CAD', date: AT })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
});
