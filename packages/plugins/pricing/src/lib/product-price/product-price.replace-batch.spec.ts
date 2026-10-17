import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PriceBulkMode, PriceStatus } from '../pricing.types';
import { ProductPriceService } from './product-price.service';

/**
 * R2-26: what a `REPLACE` batch retires.
 *
 * `REPLACE` retires the rows of the `(variant, price list)` pairs the batch wrote that the batch did
 * not supply. Three ways that rule went wrong are pinned here:
 *
 * - an **open-scoped** row (no variant) left the variant out of the retirement condition, which then
 *   matched every row of the list, so one such row retired the whole price list;
 * - an **update** answered with the driver's result instead of the row, so the row it had just
 *   written had no identifier in the written set and was retired by its own batch;
 * - a pair whose row was **refused** still had its other rows retired, which left the variant
 *   unpriced in the list while the replacement had not been written.
 *
 * The write path itself (`createOne` / `updateOne`) is stubbed: it is covered by its own suites, and
 * what is under test is which rows the batch retires afterwards. The repository double implements the
 * `where` clause the service states — equality, `In`, `IsNull` and `Not` — because the retirement is
 * narrowed in SQL and a double that matched everything would make the cases vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const VARIANT_A = '00000000-0000-4000-8000-000000000010';
const VARIANT_B = '00000000-0000-4000-8000-000000000011';
const LIST = '00000000-0000-4000-8000-000000000100';

interface IRow {
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
}

const row = (overrides: Partial<IRow> & { id: string }): IRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	currency: 'USD',
	amount: '10.000000',
	status: PriceStatus.ACTIVE,
	...overrides
});

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

function matches(stored: object, where: Record<string, unknown> | undefined): boolean {
	const fields = stored as Record<string, unknown>;

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

		// TypeORM drops an `undefined` member from the condition rather than matching nothing — which is
		// exactly the behaviour that turned an open-scoped row into "every row of the list".
		return expected === undefined || same(expected, value);
	});
}

function serviceUnderTest(rows: IRow[]) {
	const retired: string[] = [];
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			rows.filter((one) => matches(one, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			rows.find((one) => matches(one, options?.where)) ?? null,
		update: async (ids: string[], patch: { status?: PriceStatus }) => {
			if (patch.status === PriceStatus.INACTIVE) {
				retired.push(...ids.map(String));
			}

			return { affected: ids.length };
		}
	};
	const service = new ProductPriceService(repository as never, {} as never, {} as never, {} as never);
	let created = 0;

	// The write path: a create answers with the stored row, an update with the driver's result — the
	// shape both ORMs actually return — and a read-back answers with the stored row.
	jest.spyOn(service, 'createOne').mockImplementation(async (payload) => {
		if ((payload as unknown as IRow).amount === 'refuse') {
			throw new Error('PRICE_INVALID_DECIMAL: amount must be an exact decimal.');
		}

		const stored = {
			...(payload as unknown as IRow),
			id: `new-${++created}`,
			tenantId: TENANT,
			organizationId: ORG
		};
		rows.push(stored);

		return stored as never;
	});
	jest.spyOn(service, 'updateOne').mockImplementation(async (_id, payload) => {
		if ((payload as unknown as IRow).amount === 'refuse') {
			throw new Error('PRICE_INVALID_DECIMAL: amount must be an exact decimal.');
		}

		return { generatedMaps: [], raw: [], affected: 1 } as never;
	});
	jest.spyOn(service, 'findOneByIdString').mockImplementation(
		async (id) => rows.find((one) => same(one.id, id)) as never
	);

	return { service, retired };
}

describe('ProductPriceService.bulkUpsert — what a REPLACE batch retires (R2-26)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('retires only the open-scoped rows of the list when the batch writes an open-scoped row', async () => {
		const rows = [
			row({ id: 'variant-a', variantId: VARIANT_A, priceListId: LIST }),
			row({ id: 'variant-b', variantId: VARIANT_B, priceListId: LIST }),
			row({ id: 'open-old', priceListId: LIST, minQuantity: '10.000000' })
		];
		const { service, retired } = serviceUnderTest(rows);

		const result = await service.bulkUpsert({
			mode: PriceBulkMode.REPLACE,
			items: [{ priceListId: LIST, currency: 'USD', amount: '9.000000' }]
		});

		expect(result.failed).toEqual([]);
		// The other open-scoped row of the list is the only one the batch replaces.
		expect(retired).toEqual(['open-old']);
		// The rows priced per variant are not part of the open-scoped pair and stay in force.
		expect(retired).not.toContain('variant-a');
		expect(retired).not.toContain('variant-b');
	});

	it('does not retire the rows it updated, and answers with the stored rows', async () => {
		const rows = [
			row({ id: 'a-1', variantId: VARIANT_A, priceListId: LIST }),
			row({ id: 'b-1', variantId: VARIANT_B, priceListId: LIST })
		];
		const { service, retired } = serviceUnderTest(rows);

		// The same matrix imported again: every item addresses a row that exists, so every write is an
		// update and nothing may be retired.
		const result = await service.bulkUpsert({
			mode: PriceBulkMode.REPLACE,
			items: [
				{ variantId: VARIANT_A, priceListId: LIST, currency: 'USD', amount: '11.000000' },
				{ variantId: VARIANT_B, priceListId: LIST, currency: 'USD', amount: '12.000000' }
			]
		});

		expect(retired).toEqual([]);
		expect(result.succeeded.map((written) => written.id)).toEqual(['a-1', 'b-1']);
	});

	it('retires nothing in a pair whose replacement row was refused', async () => {
		const rows = [
			row({ id: 'a-low', variantId: VARIANT_A, priceListId: LIST, maxQuantity: '9.000000' }),
			row({ id: 'a-high', variantId: VARIANT_A, priceListId: LIST, minQuantity: '10.000000' }),
			row({ id: 'b-old', variantId: VARIANT_B, priceListId: LIST, maxQuantity: '9.000000' })
		];
		const { service, retired } = serviceUnderTest(rows);

		const result = await service.bulkUpsert({
			mode: PriceBulkMode.REPLACE,
			items: [
				// Variant A: the low band is written, the high band is refused.
				{
					variantId: VARIANT_A,
					priceListId: LIST,
					currency: 'USD',
					amount: '8.000000',
					maxQuantity: '9.000000'
				},
				{
					variantId: VARIANT_A,
					priceListId: LIST,
					currency: 'USD',
					amount: 'refuse',
					minQuantity: '10.000000'
				},
				// Variant B: a new band replaces the old one.
				{
					variantId: VARIANT_B,
					priceListId: LIST,
					currency: 'USD',
					amount: '7.000000',
					minQuantity: '1.000000'
				}
			]
		});

		expect(result.failed.map((failure) => failure.index)).toEqual([1]);
		// A's high band keeps its price until its replacement is written.
		expect(retired).not.toContain('a-high');
		expect(retired).not.toContain('a-low');
		// Control: B's pair was fully written, so its row it did not supply is retired as REPLACE promises.
		expect(retired).toEqual(['b-old']);
	});

	it('retires the row it did not supplys of a pair the batch wrote (control)', async () => {
		const rows = [
			row({ id: 'a-old', variantId: VARIANT_A, priceListId: LIST, maxQuantity: '9.000000' }),
			row({ id: 'default-a', variantId: VARIANT_A })
		];
		const { service, retired } = serviceUnderTest(rows);

		await service.bulkUpsert({
			mode: PriceBulkMode.REPLACE,
			items: [
				{
					variantId: VARIANT_A,
					priceListId: LIST,
					currency: 'USD',
					amount: '8.000000',
					minQuantity: '1.000000'
				}
			]
		});

		expect(retired).toEqual(['a-old']);
		// The default price is another pair — (variant, no list) — and the batch did not mention it.
		expect(retired).not.toContain('default-a');
	});

	it('retires nothing in UPSERT mode', async () => {
		const rows = [row({ id: 'a-old', variantId: VARIANT_A, priceListId: LIST, maxQuantity: '9.000000' })];
		const { service, retired } = serviceUnderTest(rows);

		await service.bulkUpsert({
			mode: PriceBulkMode.UPSERT,
			items: [
				{
					variantId: VARIANT_A,
					priceListId: LIST,
					currency: 'USD',
					amount: '8.000000',
					minQuantity: '1.000000'
				}
			]
		});

		expect(retired).toEqual([]);
	});
});
