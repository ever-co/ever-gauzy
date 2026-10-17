import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceBaseSource, PriceComputeMode, PriceStatus } from '../pricing.types';
import { ProductPriceService } from './product-price.service';

/**
 * R2-30 (pricing): the write rules of a price row and of an atomic batch.
 *
 * - **The lists a row names are live lists of the caller's organization.** The foreign key only proves
 *   that a list row exists, so a list of another organization, or a soft-deleted one, was accepted.
 * - **Only rows that can compete block a band.** The overlap check compared every row of the tuple
 *   whatever its status and window, so a price change scheduled for the same band was refused and a
 *   retired row blocked a new one.
 * - **Guard rails are fractions a price can honour.** A margin floor of 100 % or more, or a discount
 *   ceiling outside 0..1, was accepted on write.
 * - **An atomic batch is checked as the matrix it leaves behind.** Rows were checked against the
 *   database only: two rows of the batch overlapping each other both passed (and the second failed
 *   mid-write), while a batch that re-bands a stored row was refused although its writes succeed.
 *
 * The repository double implements the `where` clause the service states — equality, `In`, `IsNull`
 * and `Not` — and the list lookup the way the database answers it: by tenant, organization and live row.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const LIVE_LIST = '00000000-0000-4000-8000-000000000100';
const OTHER_ORG_LIST = '00000000-0000-4000-8000-000000000101';
const DELETED_LIST = '00000000-0000-4000-8000-000000000102';
const FEB_1 = new Date('2026-02-01T00:00:00.000Z');

interface IListRow {
	id: string;
	tenantId: string;
	organizationId: string;
	deletedAt?: Date;
}

interface IPriceRow {
	id: string;
	tenantId: string;
	organizationId: string;
	variantId?: string;
	priceListId?: string;
	currency: string;
	amount: string;
	status: PriceStatus;
	minQuantity?: string;
	maxQuantity?: string;
	startsAt?: Date;
	endsAt?: Date;
}

const LISTS: IListRow[] = [
	{ id: LIVE_LIST, tenantId: TENANT, organizationId: ORG },
	{ id: OTHER_ORG_LIST, tenantId: TENANT, organizationId: OTHER_ORG },
	{ id: DELETED_LIST, tenantId: TENANT, organizationId: ORG, deletedAt: new Date('2026-01-10T00:00:00.000Z') }
];

const stored = (overrides: Partial<IPriceRow> & { id: string }): IPriceRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'CAD',
	amount: '19.990000',
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

function serviceUnderTest(prices: IPriceRow[]) {
	const written: unknown[] = [];
	const repository = {
		written,
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			prices.find((row) => matches(row, options?.where)) ?? null,
		findOneBy: async (where?: Record<string, unknown>) => prices.find((row) => matches(row, where)) ?? null,
		create: (partial: IPriceRow) => ({ ...partial }),
		save: async (entity: IPriceRow) => {
			written.push(entity);

			return entity;
		},
		update: async () => ({ affected: 1 }),
		manager: {
			// The list lookup: the caller's tenant and organization, live rows only.
			findOne: async (_entity: unknown, options?: { where?: Record<string, unknown> }) =>
				LISTS.find((list) => !list.deletedAt && matches(list, options?.where)) ?? null,
			find: async () => []
		}
	};
	const service = new ProductPriceService(
		repository as never,
		{} as never,
		{ resolveTaxInclusivity: async () => null } as never,
		{} as never
	);

	return { service, written };
}

describe('ProductPriceService — write rules (R2-30)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the lists a row names', () => {
		it('refuses a list of another organization of the tenant', async () => {
			const { service, written } = serviceUnderTest([]);

			await expect(
				service.createOne({
					variantId: VARIANT,
					currency: 'CAD',
					amount: '9.000000',
					priceListId: OTHER_ORG_LIST
				})
			).rejects.toThrow(/PRICE_LIST_NOT_FOUND/);
			expect(written).toHaveLength(0);
		});

		it('refuses a soft-deleted list', async () => {
			const { service, written } = serviceUnderTest([]);

			await expect(
				service.createOne({
					variantId: VARIANT,
					currency: 'CAD',
					amount: '9.000000',
					priceListId: DELETED_LIST
				})
			).rejects.toThrow(/PRICE_LIST_NOT_FOUND/);
			expect(written).toHaveLength(0);
		});

		it('refuses a derivation that reads a list of another organization', async () => {
			const { service } = serviceUnderTest([]);

			await expect(
				service.createOne({
					variantId: VARIANT,
					currency: 'CAD',
					priceListId: LIVE_LIST,
					computeMode: PriceComputeMode.PERCENT_OFF,
					percent: '0.100000',
					baseSource: PriceBaseSource.PRICE_LIST,
					basePriceListId: OTHER_ORG_LIST
				})
			).rejects.toThrow(/PRICE_LIST_NOT_FOUND: basePriceListId/);
		});

		it('accepts a live list of the organization (control)', async () => {
			const { service, written } = serviceUnderTest([]);

			await service.createOne({
				variantId: VARIANT,
				currency: 'CAD',
				amount: '9.000000',
				priceListId: LIVE_LIST
			});

			expect(written).toHaveLength(1);
		});
	});

	describe('which rows block a band', () => {
		it('accepts a price change scheduled for the same band once the current price ends', async () => {
			const { service, written } = serviceUnderTest([stored({ id: 'p-current', endsAt: FEB_1 })]);

			await service.createOne({ variantId: VARIANT, currency: 'CAD', amount: '21.000000', startsAt: FEB_1 });

			expect(written).toHaveLength(1);
		});

		it('does not let a retired row block a new band', async () => {
			const { service, written } = serviceUnderTest([stored({ id: 'p-retired', status: PriceStatus.INACTIVE })]);

			await service.createOne({ variantId: VARIANT, currency: 'CAD', amount: '21.000000' });

			expect(written).toHaveLength(1);
		});

		it('still refuses a band that overlaps an active row in force at the same time (control)', async () => {
			const { service, written } = serviceUnderTest([stored({ id: 'p-current', endsAt: FEB_1 })]);

			await expect(
				service.createOne({
					variantId: VARIANT,
					currency: 'CAD',
					amount: '21.000000',
					startsAt: new Date('2026-01-15T00:00:00.000Z')
				})
			).rejects.toThrow(/PRICE_TIER_OVERLAP/);
			expect(written).toHaveLength(0);
		});
	});

	describe('guard rails', () => {
		it('refuses a margin floor of 100 % or more even without a cost', async () => {
			const { service } = serviceUnderTest([]);

			await expect(
				service.createOne({
					variantId: VARIANT,
					currency: 'CAD',
					amount: '9.000000',
					minMarginPercent: '1.500000'
				})
			).rejects.toThrow(/PRICE_MARGIN_RANGE/);
		});

		it('refuses a discount ceiling that is a percentage rather than a fraction', async () => {
			const { service } = serviceUnderTest([]);

			await expect(
				service.createOne({ variantId: VARIANT, currency: 'CAD', amount: '9.000000', maxDiscountPercent: '30' })
			).rejects.toThrow(/PRICE_DISCOUNT_RANGE/);
		});
	});

	describe('an atomic batch', () => {
		/** The write path is stubbed: what is under test is whether the pre-flight lets the batch through. */
		function stubWrites(service: ProductPriceService) {
			const created = jest.spyOn(service, 'createOne').mockImplementation(async (payload) => payload as never);
			const updated = jest
				.spyOn(service, 'updateOne')
				.mockImplementation(async () => ({ generatedMaps: [], raw: [], affected: 1 }) as never);
			jest.spyOn(service, 'findOneByIdString').mockImplementation(async (id) => ({ id }) as never);

			return { created, updated };
		}

		it('refuses two rows of the batch that overlap each other before writing either', async () => {
			const { service } = serviceUnderTest([]);
			const { created } = stubWrites(service);

			await expect(
				service.bulkUpsert({
					atomic: true,
					items: [
						{
							variantId: VARIANT,
							currency: 'CAD',
							amount: '10.000000',
							minQuantity: '1.000000',
							maxQuantity: '9.000000'
						},
						{ variantId: VARIANT, currency: 'CAD', amount: '9.000000', minQuantity: '5.000000' }
					]
				})
			).rejects.toThrow(/PRICE_BULK_INVALID: row 1 .*PRICE_TIER_OVERLAP/);
			expect(created).not.toHaveBeenCalled();
		});

		it('lets a batch re-band a stored row it retires in the same batch', async () => {
			const { service } = serviceUnderTest([
				stored({ id: 'p-1-9', minQuantity: '1.000000', maxQuantity: '9.000000' })
			]);
			const { created, updated } = stubWrites(service);

			const result = await service.bulkUpsert({
				atomic: true,
				items: [
					// The stored 1–9 band is retired by the batch …
					{
						variantId: VARIANT,
						currency: 'CAD',
						amount: '10.000000',
						minQuantity: '1.000000',
						maxQuantity: '9.000000',
						status: PriceStatus.INACTIVE
					},
					// … and replaced by two narrower ones.
					{
						variantId: VARIANT,
						currency: 'CAD',
						amount: '11.000000',
						minQuantity: '1.000000',
						maxQuantity: '4.000000'
					},
					{ variantId: VARIANT, currency: 'CAD', amount: '9.000000', minQuantity: '5.000000' }
				]
			});

			expect(result.failed).toEqual([]);
			expect(updated).toHaveBeenCalledTimes(1);
			expect(created).toHaveBeenCalledTimes(2);
		});
	});
});
