import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceListStatus, PriceListType, PriceSource, PriceStatus } from '../pricing.types';
import { ProductPriceService } from './product-price.service';

/**
 * R2-27: the prices of a deleted price list stop resolving.
 *
 * `PriceListService.deletePriceList` soft-deletes a list by default, and the rows it carried stay
 * `ACTIVE` so the list can be reported on. The resolution reads each row with its list through the
 * relation join, and TypeORM's join filters a soft-deleted list (`deletedAt IS NULL`), so the row of a
 * deleted list arrives with **no list at all** — which the resolver used to read as "this row has no
 * list", i.e. the variant's default price. A deleted sale list therefore kept discounting as the
 * default price, and a variant priced only by a deleted list stayed priced by it.
 *
 * The double below loads the list exactly as that join does: a list carrying `deletedAt` is not
 * attached to its rows. It also loads a list of another organization when a row names one, which is
 * what the join does too (a relation join has no tenant condition of its own).
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const SALE_LIST = '00000000-0000-4000-8000-000000000100';
const AT = new Date('2026-01-15T12:00:00.000Z');

interface IListRow {
	id: string;
	tenantId: string;
	organizationId: string;
	name: string;
	code: string;
	type: PriceListType;
	status: PriceListStatus;
	priority: number;
	deletedAt?: Date;
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

const saleList = (overrides: Partial<IListRow> = {}): IListRow => ({
	id: SALE_LIST,
	tenantId: TENANT,
	organizationId: ORG,
	name: 'Summer sale',
	code: 'SUMMER',
	type: PriceListType.SALE,
	status: PriceListStatus.ACTIVE,
	priority: 0,
	...overrides
});

const priceRow = (overrides: Partial<IPriceRow> & { id: string; amount: string }): IPriceRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'USD',
	status: PriceStatus.ACTIVE,
	...overrides
});

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

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
				case 'not':
					return !same(expected.value, value);
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || same(expected, value);
	});
}

function serviceUnderTest(prices: IPriceRow[], lists: IListRow[], legacyRetailPrice?: string) {
	// The relation join: the list a row names, unless that list is soft-deleted.
	const attach = (row: IPriceRow) => ({
		...row,
		priceList: row.priceListId ? lists.find((list) => list.id === row.priceListId && !list.deletedAt) : undefined
	});
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)).map(attach),
		manager: {
			find: async () =>
				legacyRetailPrice === undefined
					? []
					: [
							{
								tenantId: TENANT,
								organizationId: ORG,
								retailPrice: legacyRetailPrice,
								retailPriceCurrency: 'USD',
								productVariant: { id: VARIANT }
							}
						]
		}
	};

	return new ProductPriceService(
		repository as never,
		{} as never,
		{ resolveTaxInclusivity: async () => null } as never,
		{} as never
	);
}

describe('ProductPriceService.resolvePrices — a deleted price list stops pricing (R2-27)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const rows = [
		priceRow({ id: 'p-default', amount: '19.990000' }),
		priceRow({ id: 'p-sale', amount: '14.990000', priceListId: SALE_LIST })
	];

	it('charges the sale list while it exists (control)', async () => {
		const [resolved] = await serviceUnderTest(rows, [saleList()]).resolvePrices({
			variantIds: [VARIANT],
			currency: 'USD',
			date: AT
		});

		expect(resolved.amount).toBe('14.990000');
		expect(resolved.source).toBe(PriceSource.PRICE_LIST);
		expect(resolved.priceListId).toBe(SALE_LIST);
	});

	it('does not charge the row of a soft-deleted list as the default price', async () => {
		const [resolved] = await serviceUnderTest(rows, [
			saleList({ deletedAt: new Date('2026-01-10T00:00:00.000Z') })
		]).resolvePrices({ variantIds: [VARIANT], currency: 'USD', date: AT });

		// The deleted sale's 14.99 used to win here as the "default" price, being the cheaper of two rows
		// with no list.
		expect(resolved.amount).toBe('19.990000');
		expect(resolved.priceId).toBe('p-default');
		expect(resolved.source).toBe(PriceSource.DEFAULT_PRICE);
	});

	it('falls back to the legacy price when the only row belongs to a soft-deleted list', async () => {
		const [resolved] = await serviceUnderTest(
			[priceRow({ id: 'p-sale', amount: '14.990000', priceListId: SALE_LIST })],
			[saleList({ deletedAt: new Date('2026-01-10T00:00:00.000Z') })],
			'21.000000'
		).resolvePrices({ variantIds: [VARIANT], currency: 'USD', date: AT });

		expect(resolved.source).toBe(PriceSource.VARIANT_RETAIL_PRICE);
		expect(resolved.amount).toBe('21.000000');
	});

	it('omits the variant when the only row belongs to a soft-deleted list and there is no legacy price', async () => {
		const resolved = await serviceUnderTest(
			[priceRow({ id: 'p-sale', amount: '14.990000', priceListId: SALE_LIST })],
			[saleList({ deletedAt: new Date('2026-01-10T00:00:00.000Z') })]
		).resolvePrices({ variantIds: [VARIANT], currency: 'USD', date: AT });

		expect(resolved).toEqual([]);
	});

	it('does not let a list of another organization price the row', async () => {
		const [resolved] = await serviceUnderTest(rows, [saleList({ organizationId: OTHER_ORG })]).resolvePrices({
			variantIds: [VARIANT],
			currency: 'USD',
			date: AT
		});

		expect(resolved.amount).toBe('19.990000');
		expect(resolved.source).toBe(PriceSource.DEFAULT_PRICE);
	});
});
