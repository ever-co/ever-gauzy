import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, RequestContext } from '@gauzy/core';
import { PriceBaseSource, PriceComputeMode, PriceSource, PriceStatus } from '../pricing.types';
import { ProductPriceService } from './product-price.service';

/**
 * R2-30 (pricing): a cost is used in the currency of the price it is measured against.
 *
 * The legacy variant price carries `unitCost` in `unitCostCurrency`. A `COST` derivation and the margin
 * floor read that number as if it were in the row's currency, so a USD cost became the base — or the
 * floor — of a EUR price. The column also defaults to `0` for a variant whose cost was never recorded,
 * which priced a cost-plus row at zero. And a stored floor of 100 % or more threw out of the resolution,
 * failing every variant of the call. The cases below pin the conversion, the fail-closed answer when no
 * rate covers the pair, the unknown cost, and the floor that is reported rather than thrown.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const AT = new Date('2026-01-15T12:00:00.000Z');

interface IPriceRow {
	id: string;
	tenantId: string;
	organizationId: string;
	variantId: string;
	currency: string;
	amount: string | null;
	status: PriceStatus;
	computeMode: PriceComputeMode;
	percent?: string;
	baseSource?: PriceBaseSource;
	costAmount?: string;
	minMarginPercent?: string;
}

interface ILegacyCost {
	unitCost: number;
	unitCostCurrency: string;
}

const amountRow = (overrides: Partial<IPriceRow> & { id: string; amount: string }): IPriceRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'EUR',
	status: PriceStatus.ACTIVE,
	computeMode: PriceComputeMode.AMOUNT,
	...overrides
});

const costPlusRow = (overrides: Partial<IPriceRow> = {}): IPriceRow => ({
	id: 'p-cost-plus',
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'EUR',
	amount: null,
	status: PriceStatus.ACTIVE,
	computeMode: PriceComputeMode.PERCENT_OFF,
	// A 20 % markup on cost.
	percent: '-0.200000',
	baseSource: PriceBaseSource.COST,
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
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || same(expected, value);
	});
}

/**
 * @param prices The `product_price` rows.
 * @param cost The legacy unit cost and its currency.
 * @returns A service whose exchange-rate table holds one rate: 1 USD = 0.5 EUR.
 */
function serviceUnderTest(prices: IPriceRow[], cost: ILegacyCost) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)).map((row) => ({ ...row, priceList: undefined })),
		manager: {
			find: async () => [
				{
					tenantId: TENANT,
					organizationId: ORG,
					retailPrice: '30.000000',
					retailPriceCurrency: 'EUR',
					unitCost: cost.unitCost,
					unitCostCurrency: cost.unitCostCurrency,
					productVariant: { id: VARIANT }
				}
			]
		}
	};
	const exchangeRateService = {
		convert: async (amount: string | number, from: string, to: string) => {
			if (from === 'USD' && to === 'EUR') {
				return Money.of(amount, 'EUR').multiply('0.5').round();
			}

			throw new Error(`no ${from}/${to} rate`);
		}
	};

	return new ProductPriceService(
		repository as never,
		{} as never,
		{ resolveTaxInclusivity: async () => null } as never,
		exchangeRateService as never
	);
}

const resolve = (service: ProductPriceService) =>
	service.resolvePrices({ variantIds: [VARIANT], currency: 'EUR', date: AT });

describe('ProductPriceService — a cost is used in the price’s currency (R2-30)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('converts a legacy unit cost stated in another currency before deriving from it', async () => {
		const [resolved] = await resolve(serviceUnderTest([costPlusRow()], { unitCost: 10, unitCostCurrency: 'USD' }));

		// 10 USD = 5.00 EUR, plus 20 % = 6.00 EUR. Read as a number, the cost made it 12.00 EUR.
		expect(resolved.amount).toBe('6.000000');
		expect(resolved.baseAmount).toBe('5.000000');
	});

	it('uses a legacy unit cost already in the row’s currency as it is (control)', async () => {
		const [resolved] = await resolve(serviceUnderTest([costPlusRow()], { unitCost: 10, unitCostCurrency: 'EUR' }));

		expect(resolved.amount).toBe('12.000000');
	});

	it('fails closed when no rate covers the cost’s currency, as a LIST base does', async () => {
		await expect(
			resolve(serviceUnderTest([costPlusRow()], { unitCost: 10, unitCostCurrency: 'GBP' }))
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			resolve(serviceUnderTest([costPlusRow()], { unitCost: 10, unitCostCurrency: 'GBP' }))
		).rejects.toThrow(/PRICE_BASE_CURRENCY_MISMATCH/);
	});

	it('does not price a cost-plus row at zero when the variant has no recorded cost', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([amountRow({ id: 'p-default', amount: '25.000000' }), costPlusRow()], {
				unitCost: 0,
				unitCostCurrency: 'EUR'
			})
		);

		// The column's default 0 is "no cost", not a cost of zero: the derived row is eliminated.
		expect(resolved.priceId).toBe('p-default');
		expect(resolved.amount).toBe('25.000000');
		expect(resolved.source).toBe(PriceSource.DEFAULT_PRICE);
		expect(resolved.notices?.some((notice) => notice.startsWith('PRICE_BASE_UNRESOLVED'))).toBe(true);
	});

	it('measures the margin floor against the cost converted into the price’s currency', async () => {
		// A 25 % floor on 10 USD = 5.00 EUR is 6.67 EUR, which 12.00 EUR clears. Read as 10 EUR, the
		// floor was 13.33 and the price was reported below it.
		const [resolved] = await resolve(
			serviceUnderTest([amountRow({ id: 'p-default', amount: '12.000000', minMarginPercent: '0.250000' })], {
				unitCost: 10,
				unitCostCurrency: 'USD'
			})
		);

		expect(resolved.amount).toBe('12.000000');
		expect(resolved.notices ?? []).toEqual([]);
	});

	it('reports an unchecked margin when no rate covers the legacy cost of a fixed-amount row', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([amountRow({ id: 'p-default', amount: '12.000000', minMarginPercent: '0.250000' })], {
				unitCost: 10,
				unitCostCurrency: 'GBP'
			})
		);

		// The price is still charged: the margin check reports, it never refuses.
		expect(resolved.amount).toBe('12.000000');
		expect(resolved.notices?.some((notice) => notice.startsWith('MARGIN_UNCHECKED'))).toBe(true);
	});

	it('reports a stored margin floor no price can satisfy instead of failing the resolution', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([amountRow({ id: 'p-default', amount: '12.000000', minMarginPercent: '1.000000' })], {
				unitCost: 10,
				unitCostCurrency: 'EUR'
			})
		);

		expect(resolved.amount).toBe('12.000000');
		expect(resolved.notices?.some((notice) => notice.startsWith('MARGIN_UNCHECKED'))).toBe(true);
	});
});
