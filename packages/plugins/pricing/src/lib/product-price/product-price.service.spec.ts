import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceListStatus, PriceListType, PriceStatus, PriceSource } from '../pricing.types';
import { ProductPriceService } from './product-price.service';

/**
 * Price resolution: which of a variant's price rows is the one that is charged.
 *
 * This is the single answer to "what does this cost", so the suite asserts the *precedence* the
 * domain fixes (doc 08 §3.2, §3.5, §4.2, §5) rather than one example of it: an eligible `OVERRIDE`
 * list wins outright, a lower priority loses to a higher one even when it is cheaper, a
 * list-scoped price beats the unmanaged default, the quantity band is inclusive on both edges, and
 * a variant with no price at all falls back rather than resolving to zero.
 *
 * The service is constructed directly with an in-memory double of its repository. The double
 * implements the `where` clause the service states — equality, `In`, `IsNull` and `Not` — because
 * the candidate set is narrowed in SQL, and a double that returned every row regardless would make
 * the currency and tenancy cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const SOLO_VARIANT = '00000000-0000-4000-8000-000000000011';
const MISSING_VARIANT = '00000000-0000-4000-8000-000000000012';
const CHANNEL_WEB = '00000000-0000-4000-8000-000000000020';
const CHANNEL_MARKETPLACE = '00000000-0000-4000-8000-000000000021';
const REGION_CA_ON = '00000000-0000-4000-8000-000000000030';
const GROUP_WHOLESALE = '00000000-0000-4000-8000-000000000040';
const GROUP_VIP = '00000000-0000-4000-8000-000000000041';

/** The programme's frozen clock: nothing here may depend on the wall clock. */
const AT = new Date('2026-01-15T12:00:00.000Z');
const LATER = new Date('2026-06-01T00:00:00.000Z');
const EARLIER = new Date('2025-12-01T00:00:00.000Z');

/** One `price_list` row, as the resolution reads it. */
interface IListRow {
	id: string;
	name: string;
	code: string;
	type: PriceListType;
	status: PriceListStatus;
	priority: number;
	currency?: string;
	channelId?: string;
	regionId?: string;
	customerGroupId?: string;
	startsAt?: Date;
	endsAt?: Date;
	isTaxInclusive?: boolean;
}

/** One `product_price` row. */
interface IPriceRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	variantId: string;
	priceListId?: string;
	currency: string;
	amount: string;
	status: PriceStatus;
	minQuantity?: string;
	maxQuantity?: string;
	startsAt?: Date;
	endsAt?: Date;
	taxInclusive?: boolean;
	compareAtAmount?: string;
	costAmount?: string;
	minMarginPercent?: string;
}

/** One legacy `product_variant_price` row: the fallback a variant with no price row resolves to. */
interface ILegacyRow {
	id: string;
	tenantId: string;
	organizationId: string;
	retailPrice: string;
	retailPriceCurrency?: string;
	unitCost?: string;
	productVariant: { id: string };
}

/** A live `SALE` list: the fixture default, so each case states only what it is about. */
const saleList = (overrides: Partial<IListRow> & { id: string; code: string }): IListRow => ({
	name: overrides.code,
	type: PriceListType.SALE,
	status: PriceListStatus.ACTIVE,
	priority: 0,
	...overrides
});

/** A price row of the fixture variant, active and untiered unless the case says otherwise. */
const priceRow = (overrides: Partial<IPriceRow> & { id: string; amount: string }): IPriceRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'CAD',
	status: PriceStatus.ACTIVE,
	...overrides
});

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row.
 */
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

		// TypeORM drops an `undefined` member from the condition rather than matching nothing.
		return expected === undefined || same(expected, value);
	});
}

/** Identifier-aware equality: a fixture writes ids as strings and so does the service. */
function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * The repository double: the two tables the resolution reads, plus the legacy one it falls back to.
 *
 * @param prices The `product_price` rows.
 * @param lists The `price_list` rows.
 * @param legacy The `product_variant_price` rows.
 * @returns The double, with the rows it was asked to write.
 */
function repository(prices: IPriceRow[], lists: IListRow[], legacy: ILegacyRow[]) {
	const written: unknown[] = [];

	const attach = (row: IPriceRow) => ({
		...row,
		priceList: row.priceListId ? lists.find((list) => list.id === row.priceListId) : undefined
	});

	return {
		written,
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)).map(attach),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)).map(attach)[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) =>
			prices.filter((row) => matches(row, where)).map(attach)[0] ?? null,
		create: (partial: IPriceRow) => ({ ...partial }),
		save: async (entity: IPriceRow) => {
			written.push(entity);

			return entity;
		},
		update: async () => ({ affected: 1 }),
		findOneByOrFail: async (where?: Record<string, unknown>) => {
			const row = prices.filter((one) => matches(one, where)).map(attach)[0];

			if (!row) {
				throw new Error('the fixture has no such price');
			}

			return row;
		},
		manager: {
			// `findLegacyPrices` reads the legacy table through the manager, keyed by the variants it was
			// asked about.
			find: async (_entity: unknown, options?: { where?: Record<string, unknown> }) => {
				const scope = (options?.where ?? {}) as { productVariant?: { id?: FindOperator<string[]> } };

				return legacy.filter((row) => {
					const variants = scope.productVariant?.id;

					return !(variants instanceof FindOperator)
						? true
						: (variants.value as string[]).some((one) => same(one, row.productVariant.id));
				});
			}
		}
	};
}

/**
 * @param prices The `product_price` rows.
 * @param lists The `price_list` rows.
 * @param legacy The legacy rows.
 * @returns A service wired to the double, resolving inside the fixture organization.
 */
function serviceUnderTest(prices: IPriceRow[], lists: IListRow[] = [], legacy: ILegacyRow[] = []) {
	const typeOrmProductPriceRepository = repository(prices, lists, legacy);

	return {
		repository: typeOrmProductPriceRepository,
		service: new ProductPriceService(
			typeOrmProductPriceRepository as never,
			{} as never,
			{ resolveTaxInclusivity: async () => null } as never
		)
	};
}

describe('ProductPriceService.resolvePrices — precedence (doc 08 §3.2, §3.5, §4.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('charges an eligible OVERRIDE list outright, even when the default price is lower', () => {
		// Scenario 2, and the rule of §4.5: contract pricing is a commercial commitment, not a
		// discount, so 24.50 is charged although the default price is 19.99.
		const contract = saleList({
			id: '00000000-0000-4000-8000-000000000101',
			code: 'WHOLESALE-2026',
			type: PriceListType.OVERRIDE,
			customerGroupId: GROUP_WHOLESALE
		});
		const { service } = serviceUnderTest(
			[priceRow({ id: 'p-default', amount: '19.990000' }), priceRow({ id: 'p-contract', amount: '24.500000', priceListId: contract.id })],
			[contract]
		);

		return service
			.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT, customerGroupIds: [GROUP_WHOLESALE] })
			.then(([resolved]) => {
				expect(resolved.amount).toBe('24.500000');
				expect(resolved.source).toBe(PriceSource.PRICE_LIST);
				expect(resolved.priceListId).toBe(contract.id);
			});
	});

	it('does not apply a customer-group list to a customer outside the group', () => {
		// The same rows, the same instant, one member of the group and one guest: the override is a
		// candidate for the first and invisible to the second, which is what "scoped" means.
		const contract = saleList({
			id: '00000000-0000-4000-8000-000000000102',
			code: 'WHOLESALE-2026',
			type: PriceListType.OVERRIDE,
			customerGroupId: GROUP_WHOLESALE
		});
		const rows = [
			priceRow({ id: 'p-default', amount: '19.990000' }),
			priceRow({ id: 'p-contract', amount: '24.500000', priceListId: contract.id })
		];

		return Promise.all([
			serviceUnderTest(rows, [contract]).service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: AT,
				customerGroupIds: [GROUP_VIP]
			}),
			serviceUnderTest(rows, [contract]).service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT })
		]).then(([[otherGroup], [guest]]) => {
			expect(otherGroup.amount).toBe('19.990000');
			expect(otherGroup.source).toBe(PriceSource.DEFAULT_PRICE);
			expect(guest.amount).toBe('19.990000');
		});
	});

	it('does not apply a channel- or region-scoped list outside its channel or region', () => {
		const scoped = saleList({
			id: '00000000-0000-4000-8000-000000000103',
			code: 'MARKETPLACE-ONLY',
			channelId: CHANNEL_MARKETPLACE,
			regionId: REGION_CA_ON
		});
		const rows = [
			priceRow({ id: 'p-default', amount: '19.990000' }),
			priceRow({ id: 'p-scoped', amount: '14.990000', priceListId: scoped.id })
		];

		return Promise.all([
			serviceUnderTest(rows, [scoped]).service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: AT,
				channelId: CHANNEL_MARKETPLACE,
				regionId: REGION_CA_ON
			}),
			serviceUnderTest(rows, [scoped]).service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: AT,
				channelId: CHANNEL_WEB,
				regionId: REGION_CA_ON
			}),
			serviceUnderTest(rows, [scoped]).service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: AT,
				channelId: CHANNEL_MARKETPLACE
			})
		]).then(([[matching], [otherChannel], [otherRegion]]) => {
			expect(matching.amount).toBe('14.990000');
			expect(otherChannel.amount).toBe('19.990000');
			expect(otherRegion.amount).toBe('19.990000');
		});
	});

	it('breaks a tie between two eligible SALE lists by priority, not by amount', () => {
		// Scenario 5. `VIP` is the dearer offer and still the winner: priority is the operator's
		// explicit ordering, and this is the control case — a resolver that took the cheapest
		// candidate would return 17.50 and pass every other case in this file.
		const spring = saleList({ id: '00000000-0000-4000-8000-000000000104', code: 'SPRING', priority: 10 });
		const vip = saleList({
			id: '00000000-0000-4000-8000-000000000105',
			code: 'VIP',
			priority: 20,
			customerGroupId: GROUP_VIP
		});
		const { service } = serviceUnderTest(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-spring', amount: '17.500000', priceListId: spring.id }),
				priceRow({ id: 'p-vip', amount: '18.250000', priceListId: vip.id })
			],
			[spring, vip]
		);

		return service
			.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT, customerGroupIds: [GROUP_VIP] })
			.then(([resolved]) => {
				expect(resolved.amount).toBe('18.250000');
				expect(resolved.priceListId).toBe(vip.id);
				// Control: the naive "cheapest eligible price wins" answer.
				expect(resolved.amount).not.toBe('17.500000');
			});
	});

	it('breaks a tie inside one priority by the lower amount', () => {
		// Scenario 7: same priority, so the cheaper of the two is what the customer is charged.
		const a = saleList({ id: '00000000-0000-4000-8000-000000000106', code: 'A', priority: 10 });
		const b = saleList({ id: '00000000-0000-4000-8000-000000000107', code: 'B', priority: 10 });
		const { service } = serviceUnderTest(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-a', amount: '16.500000', priceListId: a.id }),
				priceRow({ id: 'p-b', amount: '17.250000', priceListId: b.id })
			],
			[a, b]
		);

		return service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }).then(([resolved]) => {
			expect(resolved.amount).toBe('16.500000');
		});
	});

	it('resolves the same winner however the rows happen to be ordered', () => {
		// Determinism (P13): two rows that agree on every criterion are separated by identifier, so
		// the answer cannot depend on the order the database returned them in.
		const a = saleList({ id: '00000000-0000-4000-8000-000000000108', code: 'A', priority: 10 });
		const b = saleList({ id: '00000000-0000-4000-8000-000000000109', code: 'B', priority: 10 });
		const rows = [
			priceRow({ id: 'p-b', amount: '16.500000', priceListId: b.id }),
			priceRow({ id: 'p-a', amount: '16.500000', priceListId: a.id })
		];

		return Promise.all([
			serviceUnderTest(rows, [a, b]).service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }),
			serviceUnderTest([...rows].reverse(), [a, b]).service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: AT
			})
		]).then(([[first], [second]]) => {
			expect(first.priceId).toBe('p-a');
			expect(second.priceId).toBe('p-a');
		});
	});

	it('refuses two eligible OVERRIDE lists at one priority rather than choosing one silently', () => {
		const one = saleList({
			id: '00000000-0000-4000-8000-000000000110',
			code: 'CONTRACT-A',
			type: PriceListType.OVERRIDE,
			priority: 10,
			customerGroupId: GROUP_WHOLESALE
		});
		const two = saleList({
			id: '00000000-0000-4000-8000-000000000111',
			code: 'CONTRACT-B',
			type: PriceListType.OVERRIDE,
			priority: 10,
			customerGroupId: GROUP_VIP
		});
		const { service } = serviceUnderTest(
			[
				priceRow({ id: 'p-a', amount: '20.000000', priceListId: one.id }),
				priceRow({ id: 'p-b', amount: '21.000000', priceListId: two.id })
			],
			[one, two]
		);

		return expect(
			service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: AT,
				customerGroupIds: [GROUP_WHOLESALE, GROUP_VIP]
			})
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_OVERRIDE_AMBIGUOUS') });
	});

	it('ignores a list that is not ACTIVE and a list whose window has closed', () => {
		const draft = saleList({
			id: '00000000-0000-4000-8000-000000000112',
			code: 'DRAFT',
			status: PriceListStatus.DRAFT
		});
		const ended = saleList({
			id: '00000000-0000-4000-8000-000000000113',
			code: 'SEASON-OVER',
			startsAt: EARLIER,
			endsAt: AT
		});
		const { service } = serviceUnderTest(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-draft', amount: '9.990000', priceListId: draft.id }),
				priceRow({ id: 'p-ended', amount: '8.990000', priceListId: ended.id })
			],
			[draft, ended]
		);

		return service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }).then(([resolved]) => {
			expect(resolved.amount).toBe('19.990000');
			expect(resolved.source).toBe(PriceSource.DEFAULT_PRICE);
		});
	});

	it('treats a price window as half-open: in force at its start, out of force at its end', () => {
		const closing = priceRow({ id: 'p-closing', amount: '15.000000', startsAt: EARLIER, endsAt: AT });
		const opening = priceRow({ id: 'p-opening', amount: '17.000000', startsAt: AT });

		// The default row is the one the two windows have to beat, so both cases are decided by the
		// window and not by the absence of anything else.
		const rows = [priceRow({ id: 'p-default', amount: '19.990000' }), closing, opening];

		return Promise.all([
			serviceUnderTest(rows).service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }),
			serviceUnderTest(rows).service.resolvePrices({
				variantIds: [VARIANT],
				currency: 'CAD',
				date: new Date(AT.getTime() - 1)
			})
		]).then(([[atTheEnd], [justBefore]]) => {
			// At its end instant the closing price is already out of force; the opening one is in force.
			expect(atTheEnd.priceId).toBe('p-opening');
			expect(justBefore.priceId).toBe('p-closing');
		});
	});

	it('never shows a strike-through price that is not higher than what is charged', () => {
		// Scenario 4: the sale is dearer than the default, so the default is charged and there is no
		// "was" price to render — a strike-through that is not a reduction is worse than none.
		const member = saleList({ id: '00000000-0000-4000-8000-000000000114', code: 'MEMBER-PRICE' });
		const { service } = serviceUnderTest(
			[priceRow({ id: 'p-default', amount: '19.990000' }), priceRow({ id: 'p-member', amount: '22.000000', priceListId: member.id })],
			[member]
		);

		return service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }).then(([resolved]) => {
			expect(resolved.amount).toBe('19.990000');
			expect(resolved.originalAmount).toBeUndefined();
		});
	});

	it('reports the list price as the "was" amount when a sale undercuts it', () => {
		// Scenario 3: 19.99 is what it would have cost, 14.99 is what it costs.
		const blackFriday = saleList({ id: '00000000-0000-4000-8000-000000000115', code: 'BLACK-FRIDAY' });
		const { service } = serviceUnderTest(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-sale', amount: '14.990000', priceListId: blackFriday.id })
			],
			[blackFriday]
		);

		return service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }).then(([resolved]) => {
			expect(resolved.amount).toBe('14.990000');
			expect(resolved.originalAmount).toBe('19.990000');
		});
	});
});

describe('ProductPriceService.resolvePrices — quantity tiers (doc 08 §5.1, §3.5 scenario 8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The three bands of scenario 8, plus the open-ended band a larger order falls into. */
	const tiered = () => [
		priceRow({ id: 'p-1-4', amount: '19.990000', minQuantity: '1.000000', maxQuantity: '4.000000' }),
		priceRow({ id: 'p-5-9', amount: '16.990000', minQuantity: '5.000000', maxQuantity: '9.000000' }),
		priceRow({ id: 'p-10-', amount: '14.990000', minQuantity: '10.000000' })
	];

	const resolveAt = (quantity: string) =>
		serviceUnderTest(tiered()).service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', quantity, date: AT });

	it('charges the band below the break, at the break and above it', async () => {
		// The interval is inclusive on both edges, so 4 is in the lower band, 5 is in the middle one
		// and 10 is in the open-ended one. An off-by-one at either edge prices an order wrongly and
		// silently.
		const [four] = await resolveAt('4');
		const [five] = await resolveAt('5');
		const [nine] = await resolveAt('9');
		const [ten] = await resolveAt('10');

		expect(four.amount).toBe('19.990000');
		expect(five.amount).toBe('16.990000');
		expect(nine.amount).toBe('16.990000');
		expect(ten.amount).toBe('14.990000');
	});

	it('compares a fractional quantity exactly rather than rounding it into a band', async () => {
		// 4.5 units is neither "four" nor "five". The band is chosen by an exact comparison, so a
		// quantity that falls between two bands must not be silently rounded into the cheaper or the
		// dearer one — it is a gap, and here there is no row to answer it.
		const [between] = await resolveAt('4.500000');
		expect(between).toBeUndefined();

		// A quantity just inside the next band is priced by that band, so the comparison is exact on
		// both sides of the break rather than a rounding of it.
		const [justInside] = await resolveAt('5.000001');
		expect(justInside.amount).toBe('16.990000');
	});

	it('falls back to the legacy retail price when no band covers the quantity', async () => {
		// A gap between bands is allowed by the schema and covered by the fallback chain: the variant
		// must be priced, never resolved to zero.
		const rows = [
			priceRow({ id: 'p-1-4', amount: '19.990000', minQuantity: '1.000000', maxQuantity: '4.000000' }),
			priceRow({ id: 'p-5-9', amount: '16.990000', minQuantity: '5.000000', maxQuantity: '9.000000' })
		];
		const legacy = [
			{
				id: 'legacy-1',
				tenantId: TENANT,
				organizationId: ORG,
				retailPrice: '29.950000',
				retailPriceCurrency: 'CAD',
				productVariant: { id: VARIANT }
			}
		];
		const { service } = serviceUnderTest(rows, [], legacy);

		const [resolved] = await service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', quantity: '12', date: AT });

		expect(resolved.amount).toBe('29.950000');
		expect(resolved.source).toBe(PriceSource.VARIANT_RETAIL_PRICE);
		expect(resolved.amount).not.toBe('0.000000');
	});
});

describe('ProductPriceService.resolvePrices — fallback and currency (doc 08 §3.4, §4.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('resolves a variant with no price row to its legacy retail price, reported as the fallback', () => {
		// F-32: the installation that never created a price list keeps pricing exactly as it did.
		const legacy = [
			{
				id: 'legacy-2',
				tenantId: TENANT,
				organizationId: ORG,
				retailPrice: '29.950000',
				retailPriceCurrency: 'CAD',
				productVariant: { id: SOLO_VARIANT }
			}
		];
		const { service } = serviceUnderTest([], [], legacy);

		return service.resolvePrices({ variantIds: [SOLO_VARIANT], currency: 'CAD', date: AT }).then((resolved) => {
			expect(resolved).toHaveLength(1);
			expect(resolved[0].amount).toBe('29.950000');
			expect(resolved[0].currency).toBe('CAD');
			expect(resolved[0].source).toBe(PriceSource.VARIANT_RETAIL_PRICE);
		});
	});

	it('omits a variant that has neither a price row nor a legacy price instead of pricing it at zero', () => {
		// F-33: a missing price is a configuration gap the caller reports; it is never a free product.
		const { service } = serviceUnderTest([priceRow({ id: 'p-other', amount: '19.990000' })]);

		return service.resolvePrices({ variantIds: [MISSING_VARIANT], currency: 'CAD', date: AT }).then((resolved) => {
			expect(resolved).toEqual([]);
		});
	});

	it('never returns a price of another currency as though it were the requested one', async () => {
		// A USD row is not a CAD price. The resolution asks the database for the requested currency
		// only, and the legacy row states its own currency, so the answer is 29.95 CAD — never the
		// 9.99 USD row, and never 9.99 labelled CAD.
		const legacy = [
			{
				id: 'legacy-3',
				tenantId: TENANT,
				organizationId: ORG,
				retailPrice: '29.950000',
				retailPriceCurrency: 'CAD',
				productVariant: { id: VARIANT }
			}
		];
		const { service } = serviceUnderTest(
			[priceRow({ id: 'p-usd', amount: '9.990000', currency: 'USD' })],
			[],
			legacy
		);

		const [resolved] = await service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT });

		expect(resolved.currency).toBe('CAD');
		expect(resolved.amount).toBe('29.950000');
		expect(resolved.source).toBe(PriceSource.VARIANT_RETAIL_PRICE);
	});

	it('does not apply a list priced in another currency to the cart currency', async () => {
		// The list's own currency narrows it: a USD list never prices a CAD cart.
		const usdList = saleList({
			id: '00000000-0000-4000-8000-000000000120',
			code: 'US-RETAIL',
			currency: 'USD'
		});
		const { service } = serviceUnderTest(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-list', amount: '9.990000', priceListId: usdList.id, currency: 'USD' })
			],
			[usdList]
		);

		const [resolved] = await service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT });

		expect(resolved.amount).toBe('19.990000');
		expect(resolved.currency).toBe('CAD');
	});

	it('does not resolve a price row that belongs to another organization', () => {
		const { service } = serviceUnderTest([
			priceRow({ id: 'p-foreign', amount: '1.000000', organizationId: OTHER_ORG })
		]);

		return service.resolvePrices({ variantIds: [VARIANT], currency: 'CAD', date: AT }).then((resolved) => {
			expect(resolved).toEqual([]);
		});
	});

	it('normalises the requested currency rather than treating "cad" as another currency', () => {
		const { service } = serviceUnderTest([priceRow({ id: 'p-default', amount: '19.990000' })]);

		return service.resolvePrices({ variantIds: [VARIANT], currency: 'cad' as never, date: AT }).then(([resolved]) => {
			expect(resolved.amount).toBe('19.990000');
			expect(resolved.currency).toBe('CAD');
		});
	});
});

describe('ProductPriceService writes — the guard rails a price cannot be stored without (doc 08 §4.3, §5.3, §6.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a quantity band that overlaps one already stored for the same tuple', async () => {
		// Overlapping bands make the answer depend on row order, which the database cannot see.
		const existing = [priceRow({ id: 'p-1-4', amount: '19.990000', minQuantity: '1.000000', maxQuantity: '4.000000' })];
		const { service } = serviceUnderTest(existing);

		await expect(
			service.createOne({
				variantId: VARIANT,
				currency: 'CAD',
				amount: '17.000000',
				minQuantity: '3.000000',
				maxQuantity: '9.000000'
			} as never)
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_TIER_OVERLAP') });
	});

	it('accepts a band that starts where the previous one ends, because both bounds are inclusive', async () => {
		const existing = [priceRow({ id: 'p-1-4', amount: '19.990000', minQuantity: '1.000000', maxQuantity: '4.000000' })];
		const { service, repository: repo } = serviceUnderTest(existing);

		const created = await service.createOne({
			variantId: VARIANT,
			currency: 'CAD',
			amount: '16.990000',
			minQuantity: '5.000000',
			maxQuantity: '9.000000'
		} as never);

		expect(created.amount).toBe('16.990000');
		expect(repo.written).toHaveLength(1);
	});

	it('refuses an amount that a money column could not hold without rounding it', async () => {
		const { service } = serviceUnderTest([]);

		await expect(
			service.createOne({ variantId: VARIANT, currency: 'CAD', amount: '19.9999999' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses an amount that is the accumulation of binary floating point', async () => {
		// Control: `0.1 + 0.2` is `0.30000000000000004` in a double. A price is an exact decimal, and
		// a service that stored this would store a number nobody can charge.
		const float = 0.1 + 0.2;
		const { service } = serviceUnderTest([]);

		await expect(service.createOne({ variantId: VARIANT, currency: 'CAD', amount: float } as never)).rejects.toMatchObject(
			{ message: expect.stringContaining('PRICE_INVALID_DECIMAL') }
		);
	});

	it('refuses a negative amount', async () => {
		const { service } = serviceUnderTest([]);

		await expect(
			service.createOne({ variantId: VARIANT, currency: 'CAD', amount: '-1.000000' } as never)
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_AMOUNT_NEGATIVE') });
	});

	it('measures the margin floor as a gross margin, not as a markup', async () => {
		// A 25 % floor on a cost of 10.00 is 10.00 / 0.75 = 13.33, not the 12.50 a markup would give:
		// the platform's guard rail is "the price a margin of 25 % needs", and the difference is a
		// price that erodes the margin it was set to protect.
		const { service } = serviceUnderTest([]);

		await expect(
			service.createOne({
				variantId: VARIANT,
				currency: 'CAD',
				amount: '13.000000',
				costAmount: '10.000000',
				minMarginPercent: '0.250000'
			} as never)
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_BELOW_MIN_MARGIN') });

		const accepted = await service.createOne({
			variantId: VARIANT,
			currency: 'CAD',
			amount: '13.340000',
			costAmount: '10.000000',
			minMarginPercent: '0.250000'
		} as never);

		expect(accepted.amount).toBe('13.340000');
	});

	it('refuses a margin floor that no price could satisfy', async () => {
		const { service } = serviceUnderTest([]);

		await expect(
			service.createOne({
				variantId: VARIANT,
				currency: 'CAD',
				amount: '100.000000',
				costAmount: '10.000000',
				minMarginPercent: '1.000000'
			} as never)
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
