import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import {
	PriceBaseSource,
	PriceComputeMode,
	PriceListStatus,
	PriceListType,
	PriceSource,
	PriceStatus
} from '../pricing.types';
import { ProductPriceService } from './product-price.service';

/**
 * R2-28: a derived row's `percent` is a signed **fraction** of its base.
 *
 * The public contracts say so — the REST DTO documents `percent` as "Signed fraction of the base:
 * 0.25 is 25 % off" and the GraphQL `CreateProductPriceInput.percent` adds "-0.15 is a 15 % markup" —
 * while the resolver divided the share by 100, so the documented `0.25` took a quarter of a percent
 * off. These cases pin the documented reading, the storage boundary a six-decimal share needs, the
 * write-time ceiling of 1, and what happens to a row stored with a percentage before the fix.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const SALE_LIST = '00000000-0000-4000-8000-000000000100';
const AT = new Date('2026-01-15T12:00:00.000Z');

interface IPriceRow {
	id: string;
	tenantId: string;
	organizationId: string;
	variantId: string;
	priceListId?: string;
	currency: string;
	amount?: string | null;
	status: PriceStatus;
	computeMode?: PriceComputeMode;
	percent?: string;
	baseSource?: PriceBaseSource;
	roundTo?: string;
	costAmount?: string;
}

const derivedRow = (overrides: Partial<IPriceRow> & { id: string; percent: string }): IPriceRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'USD',
	amount: null,
	status: PriceStatus.ACTIVE,
	computeMode: PriceComputeMode.PERCENT_OFF,
	baseSource: PriceBaseSource.LIST,
	...overrides
});

const saleList = {
	id: SALE_LIST,
	tenantId: TENANT,
	organizationId: ORG,
	name: 'Distributor',
	code: 'DISTRIBUTOR',
	type: PriceListType.SALE,
	status: PriceListStatus.ACTIVE,
	priority: 0
};

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

/**
 * @param prices The `product_price` rows.
 * @param retailPrice The legacy variant retail price a `LIST` derivation starts from.
 */
function serviceUnderTest(prices: IPriceRow[], retailPrice = '20.000000') {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices
				.filter((row) => matches(row, options?.where))
				.map((row) => ({ ...row, priceList: row.priceListId === SALE_LIST ? saleList : undefined })),
		findOne: async () => null,
		manager: {
			find: async () => [
				{
					tenantId: TENANT,
					organizationId: ORG,
					retailPrice,
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

const resolve = (service: ProductPriceService) =>
	service.resolvePrices({ variantIds: [VARIANT], currency: 'USD', date: AT });

describe('ProductPriceService — `percent` is a signed fraction of the base (R2-28)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('takes 25 % off for a share of 0.25, as the DTO and the GraphQL input document', async () => {
		const [resolved] = await resolve(serviceUnderTest([derivedRow({ id: 'p-derived', percent: '0.250000' })]));

		// 20.00 − 25 % = 15.00. The percentage reading charged 19.95.
		expect(resolved.amount).toBe('15.000000');
		expect(resolved.baseAmount).toBe('20.000000');
		expect(resolved.computation).toMatchObject({ computeMode: PriceComputeMode.PERCENT_OFF, percent: '0.250000' });
	});

	it('marks a cost up by 15 % for a share of -0.15', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([
				derivedRow({
					id: 'p-cost-plus',
					percent: '-0.150000',
					baseSource: PriceBaseSource.COST,
					costAmount: '10.000000'
				})
			])
		);

		// 10.00 + 15 % = 11.50. The percentage reading charged 10.015.
		expect(resolved.amount).toBe('11.500000');
	});

	it('rounds a share that does not divide the base to the storage scale instead of refusing the resolution', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([derivedRow({ id: 'p-third', percent: '0.333333' })], '19.990000')
		);

		// 19.99 × 0.333333 = 6.66332667, so 19.99 − 6.66332667 = 13.32667333, half-up at six decimals.
		expect(resolved.amount).toBe('13.326673');
	});

	it('applies the price ending after the share', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([derivedRow({ id: 'p-ending', percent: '0.250000', roundTo: '0.050000' })], '21.990000')
		);

		// 21.99 − 25 % = 16.4925 → 16.49 at the currency scale → the nearest 0.05 is 16.50.
		expect(resolved.amount).toBe('16.500000');
	});

	it('refuses to write a share above 1, which would make the price negative', async () => {
		const service = serviceUnderTest([]);

		const write = service.createOne({
			variantId: VARIANT,
			currency: 'USD',
			computeMode: PriceComputeMode.PERCENT_OFF,
			baseSource: PriceBaseSource.LIST,
			percent: '25'
		});

		await expect(write).rejects.toBeInstanceOf(BadRequestException);
		await expect(write).rejects.toThrow(/PRICE_PERCENT_RANGE/);
	});

	it('eliminates a row stored with a percentage instead of charging the negative price it computes to', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([
				{
					id: 'p-default',
					tenantId: TENANT,
					organizationId: ORG,
					variantId: VARIANT,
					currency: 'USD',
					amount: '19.990000',
					status: PriceStatus.ACTIVE,
					computeMode: PriceComputeMode.AMOUNT
				},
				// Written before the fix as "25 %": as a fraction it takes 25 × the base off.
				derivedRow({ id: 'p-legacy-percentage', percent: '25.000000', priceListId: SALE_LIST })
			])
		);

		expect(resolved.priceId).toBe('p-default');
		expect(resolved.amount).toBe('19.990000');
		expect(resolved.source).toBe(PriceSource.DEFAULT_PRICE);
		expect(resolved.notices?.some((notice) => notice.startsWith('PRICE_PERCENT_RANGE'))).toBe(true);
	});

	it('eliminates a share just above 1 even when the price ending would round its negative price to zero', async () => {
		const [resolved] = await resolve(
			serviceUnderTest(
				[
					{
						id: 'p-default',
						tenantId: TENANT,
						organizationId: ORG,
						variantId: VARIANT,
						currency: 'USD',
						amount: '0.990000',
						status: PriceStatus.ACTIVE,
						computeMode: PriceComputeMode.AMOUNT
					},
					// 1.00 − 1.01 × 1.00 = −0.01, which the 0.05 ending rounds to 0.00: a free product.
					derivedRow({ id: 'p-free', percent: '1.010000', roundTo: '0.050000', priceListId: SALE_LIST })
				],
				'1.000000'
			)
		);

		expect(resolved.priceId).toBe('p-default');
		expect(resolved.amount).toBe('0.990000');
		expect(resolved.notices?.some((notice) => notice.startsWith('PRICE_PERCENT_RANGE'))).toBe(true);
	});

	it('carries the reason into the legacy fallback when the only row is eliminated', async () => {
		const [resolved] = await resolve(
			serviceUnderTest([derivedRow({ id: 'p-legacy-percentage', percent: '25.000000', priceListId: SALE_LIST })])
		);

		expect(resolved.source).toBe(PriceSource.VARIANT_RETAIL_PRICE);
		expect(resolved.amount).toBe('20.000000');
		expect(resolved.notices?.some((notice) => notice.startsWith('PRICE_PERCENT_RANGE'))).toBe(true);
		expect(resolved.explain).toContain('PRICE_PERCENT_RANGE');
	});
});
