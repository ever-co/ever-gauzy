import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceListStatus, PriceListType, PriceStatus } from '../pricing.types';
import { ProductPriceService } from '../product-price/product-price.service';
import { RecurringPriceService } from './recurring-price.service';

/**
 * The price of one period, as a caller that bills on a schedule receives it.
 *
 * The number itself is the ordinary resolution's, so this suite is about the four things the seam
 * adds to it, each of which would be wrong in a way that costs money if it were wrong here:
 *
 * - **The amount is passed through untouched.** No rounding, no reformatting, no arithmetic: an
 *   amount that a float could not hold comes back as the exact decimal the resolution produced.
 * - **A resolution in another currency is refused rather than returned.** The port asks for the
 *   currency the caller bills in, and the one resolution that can answer in a different currency —
 *   the legacy variant price — would otherwise be relabelled as the currency that was asked for.
 * - **An unpriced variant is a refusal, not a zero.** A price list that resolves to nothing means
 *   the price is unknown, and a recurring line priced at zero is indistinguishable from a free plan.
 * - **The resolution runs in the caller's own organization.** Two organizations may price one
 *   variant differently, and the answer is always the caller's own — asserted here through the real
 *   price service, so it is the pipeline's scoping that is being checked and not a stub's.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const UNPRICED_VARIANT = '00000000-0000-4000-8000-000000000011';
const CUSTOMER = '00000000-0000-4000-8000-000000000020';
const GROUP = '00000000-0000-4000-8000-000000000030';
const OVERRIDE_LIST = '00000000-0000-4000-8000-000000000100';
const GROUP_LIST = '00000000-0000-4000-8000-000000000101';

/** One `product_price` row, as the resolution reads it. */
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

/** One `price_list` row. */
interface IListRow {
	id: string;
	name: string;
	code: string;
	type: PriceListType;
	status: PriceListStatus;
	priority: number;
	customerGroupId?: string;
}

/** A price list that wins outright for a context, which is what a contract price is. */
const overrideList: IListRow = {
	id: OVERRIDE_LIST,
	name: 'Negotiated 2026',
	code: 'NEGOTIATED-2026',
	type: PriceListType.OVERRIDE,
	status: PriceListStatus.ACTIVE,
	priority: 0
};

/** A list scoped to a customer group, which is the only customer scoping the schema expresses. */
const groupList: IListRow = {
	id: GROUP_LIST,
	name: 'Wholesale',
	code: 'WHOLESALE',
	type: PriceListType.SALE,
	status: PriceListStatus.ACTIVE,
	priority: 10,
	customerGroupId: GROUP
};

const priceRow = (overrides: Partial<IPriceRow> & { id: string; amount: string }): IPriceRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	currency: 'CAD',
	status: PriceStatus.ACTIVE,
	...overrides
});

/**
 * A stub resolution, for the cases that are about what this seam does with an answer rather than
 * about how the answer is computed.
 *
 * @param resolutions The answers to hand back, in call order.
 * @returns The resolver and the contexts it was asked with.
 */
function resolver(...resolutions: unknown[]) {
	const contexts: Array<Record<string, unknown>> = [];

	return {
		contexts,
		service: {
			resolvePrices: async (context: Record<string, unknown>) => {
				contexts.push(context);

				return resolutions.shift() ?? [];
			}
		}
	};
}

/**
 * @param rows A stored row.
 * @param where The condition the resolution stated.
 * @returns Whether the database would have returned the row.
 */
function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		const value = fields[field];

		if (expected instanceof FindOperator) {
			if (expected.type === 'in') {
				return (expected.value as unknown[]).some((one) => String(one) === String(value));
			}

			throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
		}

		return expected === undefined || String(expected ?? '') === String(value ?? '');
	});
}

/**
 * @param prices The `product_price` rows.
 * @param lists The `price_list` rows.
 * @returns A repository double that narrows by the stated `where` and attaches the list relation.
 */
function repository(prices: IPriceRow[], lists: IListRow[]) {
	const attach = (row: IPriceRow) => ({
		...row,
		priceList: row.priceListId ? lists.find((list) => list.id === row.priceListId) : undefined
	});

	return {
		find: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)).map(attach),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			prices.filter((row) => matches(row, options?.where)).map(attach)[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) =>
			prices.filter((row) => matches(row, where)).map(attach)[0] ?? null,
		update: async () => ({ affected: 1 }),
		// No legacy variant price exists in these fixtures: the fallback is the price service's own
		// subject, and this suite is about the organization the resolution reads in.
		manager: { find: async () => [] }
	};
}

/**
 * @param prices The `product_price` rows.
 * @param lists The `price_list` rows.
 * @returns The service under test, resolving through the real price service over those rows.
 */
function pipeline(prices: IPriceRow[], lists: IListRow[] = []) {
	const productPriceService = new ProductPriceService(
		repository(prices, lists) as never,
		{} as never,
		{ resolveTaxInclusivity: async () => null } as never,
		{
			convert: async () => {
				throw new Error('no rate covers the pair');
			}
		} as never
	);

	return new RecurringPriceService(productPriceService);
}

describe('RecurringPriceService — what one period is billed at', () => {
	it("returns the resolution's amount, currency and list unchanged", async () => {
		const { service } = resolver([
			{
				variantId: VARIANT,
				priceId: 'price-1',
				priceListId: OVERRIDE_LIST,
				currency: 'CAD',
				amount: '24.500000'
			}
		]);

		const resolved = await new RecurringPriceService(service as never).resolveRecurringPrice({
			variantId: VARIANT,
			currency: 'CAD'
		});

		expect(resolved).toEqual({ unitPrice: '24.500000', currency: 'CAD', priceListId: OVERRIDE_LIST });
	});

	it('asks for exactly what the request states, and asks for nothing else', async () => {
		// The context is the whole input of the resolution, so this is the case that proves the seam
		// neither widens the search — no price list, no instant, no quantity — nor narrows it.
		const { service, contexts } = resolver([
			{ variantId: VARIANT, currency: 'CAD', amount: '10.000000', priceListId: OVERRIDE_LIST }
		]);

		await new RecurringPriceService(service as never).resolveRecurringPrice({
			variantId: VARIANT,
			customerId: CUSTOMER,
			currency: 'CAD',
			previousAmount: '9.000000'
		});

		expect(contexts).toEqual([{ variantIds: [VARIANT], currency: 'CAD', customerId: CUSTOMER }]);
	});

	it('reports a default price without inventing a price list for it', async () => {
		const { service } = resolver([{ variantId: VARIANT, currency: 'CAD', amount: '12.500000' }]);

		const resolved = await new RecurringPriceService(service as never).resolveRecurringPrice({
			variantId: VARIANT,
			currency: 'CAD'
		});

		expect(resolved.unitPrice).toBe('12.500000');
		expect('priceListId' in resolved).toBe(false);
	});

	it('passes an amount that a float cannot hold through untouched', async () => {
		// The amount is a decimal string end to end: reformatting it through a number here would be the
		// one place a period's price could drift from the price the resolution decided.
		const { service } = resolver([{ variantId: VARIANT, currency: 'CAD', amount: '1234.567891' }]);

		const resolved = await new RecurringPriceService(service as never).resolveRecurringPrice({
			variantId: VARIANT,
			currency: 'CAD'
		});

		expect(resolved.unitPrice).toBe('1234.567891');
		expect(typeof resolved.unitPrice).toBe('string');
	});
});

describe('RecurringPriceService — what it refuses to answer', () => {
	it('refuses when no variant was named', async () => {
		const { service, contexts } = resolver();

		await expect(
			new RecurringPriceService(service as never).resolveRecurringPrice({ currency: 'CAD' } as never)
		).rejects.toThrow(/RECURRING_PRICE_VARIANT_REQUIRED/);
		expect(contexts).toEqual([]);
	});

	it('refuses when no currency was named', async () => {
		const { service, contexts } = resolver();

		await expect(
			new RecurringPriceService(service as never).resolveRecurringPrice({ variantId: VARIANT } as never)
		).rejects.toThrow(/RECURRING_PRICE_CURRENCY_REQUIRED/);
		expect(contexts).toEqual([]);
	});

	it('refuses an unpriced variant instead of billing a period at zero', async () => {
		const { service } = resolver([]);

		const refusal = await new RecurringPriceService(service as never)
			.resolveRecurringPrice({ variantId: UNPRICED_VARIANT, currency: 'CAD' })
			.catch((error: Error) => error);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect((refusal as Error).message).toMatch(/RECURRING_PRICE_NOT_FOUND/);
		expect((refusal as Error).message).toContain(UNPRICED_VARIANT);
		expect((refusal as Error).message).toContain('CAD');
	});

	it('refuses an amount resolved in another currency rather than relabelling it', async () => {
		// The boundary the port names: the price must be expressed in the currency the caller bills in.
		// The one resolution that can answer in a different one is the legacy variant price, and an
		// amount is never returned under a currency it is not in.
		const { service } = resolver([{ variantId: VARIANT, currency: 'EUR', amount: '19.000000' }]);

		await expect(
			new RecurringPriceService(service as never).resolveRecurringPrice({ variantId: VARIANT, currency: 'CAD' })
		).rejects.toThrow(/RECURRING_PRICE_CURRENCY_MISMATCH/);
	});
});

describe('RecurringPriceService — resolved through the real price pipeline', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers with the caller organization price and not another organization price', async () => {
		const prices = [
			priceRow({ id: 'p-mine', amount: '20.000000' }),
			priceRow({ id: 'p-theirs', organizationId: OTHER_ORG, amount: '80.000000' })
		];

		const mine = await pipeline(prices).resolveRecurringPrice({ variantId: VARIANT, currency: 'CAD' });

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const theirs = await pipeline(prices).resolveRecurringPrice({ variantId: VARIANT, currency: 'CAD' });

		expect(mine.unitPrice).toBe('20.000000');
		expect(theirs.unitPrice).toBe('80.000000');
	});

	it('answers with the price the ordinary precedence decided, not a column it read itself', async () => {
		// An eligible OVERRIDE list wins outright, whichever of the two amounts is lower. The seam adds
		// no rule of its own: it reports the winner and the list it came from.
		const service = pipeline(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-contract', amount: '24.500000', priceListId: OVERRIDE_LIST })
			],
			[overrideList]
		);

		const resolved = await service.resolveRecurringPrice({ variantId: VARIANT, currency: 'CAD' });

		expect(resolved.unitPrice).toBe('24.500000');
		expect(resolved.priceListId).toBe(OVERRIDE_LIST);
	});

	it('cannot apply a group-scoped list, because the request names a customer and not a group', async () => {
		// What the port can express is a customer; what the pipeline scopes a list by is a group. A
		// caller on a group list therefore resolves the default price, which is the honest answer to
		// the context it was able to state.
		const service = pipeline(
			[
				priceRow({ id: 'p-default', amount: '19.990000' }),
				priceRow({ id: 'p-group', amount: '14.000000', priceListId: GROUP_LIST })
			],
			[groupList]
		);

		const resolved = await service.resolveRecurringPrice({
			variantId: VARIANT,
			customerId: CUSTOMER,
			currency: 'CAD'
		});

		expect(resolved.unitPrice).toBe('19.990000');
		expect(resolved.priceListId).toBeUndefined();
	});

	it('refuses a variant whose price exists only in another currency', async () => {
		const service = pipeline([priceRow({ id: 'p-eur', currency: 'EUR', amount: '19.990000' })]);

		await expect(service.resolveRecurringPrice({ variantId: VARIANT, currency: 'CAD' })).rejects.toThrow(
			/RECURRING_PRICE_NOT_FOUND/
		);
	});
});
