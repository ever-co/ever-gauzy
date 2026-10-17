import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, RequestContext } from '@gauzy/core';
import { TaxRateService } from './tax-rate.service';

/**
 * R2-29: the net of an inclusive line is computed exactly, whatever the chain.
 *
 * A single whole rate was always extracted by one division. Every other chain — a compound rate, two
 * rates on one line, a part on a reduced base, a fixed amount — was walked from the gross downward and
 * the walk stopped after four passes. Its error only shrinks by the chain's effective rate per pass, so
 * the result was a net that does not contain the tax it claims to (5 % + 9.975 % on a gross of 10 000.00
 * landed 0.76 off), and a chain whose rates add up to 100 % or more never converged at all.
 *
 * Each case states the net the arithmetic requires, worked by hand in the comment, and checks the
 * invariant the residual rule exists for: `net + tax = gross`.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CATEGORY = '00000000-0000-4000-8000-000000000050';
const AT = new Date('2026-01-15T12:00:00.000Z');

interface IRateRow {
	id: string;
	tenantId: string;
	organizationId: string;
	taxCategoryId: string;
	code: string;
	name: string;
	rate: number;
	isCompound: boolean;
	isInclusive: boolean;
	isActive: boolean;
	priority: number;
	countryCode: string;
	provinceCode: string;
	amountType?: string;
}

interface IPartRow {
	id: string;
	taxRateId: string;
	sequence: number;
	partType?: string;
	factorPercent?: number;
	baseFactor?: number;
	amountType?: string;
	fixedAmount?: number;
}

const rate = (overrides: Partial<IRateRow> & { id: string; rate: number }): IRateRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	taxCategoryId: CATEGORY,
	code: overrides.id.toUpperCase(),
	name: overrides.id,
	isCompound: false,
	isInclusive: true,
	isActive: true,
	priority: 0,
	countryCode: 'CA',
	provinceCode: 'ON',
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

function calculate(rates: IRateRow[], gross: string, parts: IPartRow[] = []) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			rates.filter((row) => matches(row, options?.where)),
		findOneBy: async (where?: Record<string, unknown>) => rates.filter((row) => matches(row, where))[0] ?? null
	};
	const taxCategoryService = {
		findOneByIdString: async (id: string) => (id === CATEGORY ? { id: CATEGORY, code: 'STANDARD' } : null),
		findDefault: async () => null
	};
	const taxRatePartService = {
		listForRates: async (ids: string[]) =>
			parts
				.filter((part) => ids.some((id) => same(id, part.taxRateId)))
				.sort((left, right) => left.sequence - right.sequence),
		listForRate: async (id: string) =>
			parts.filter((part) => same(id, part.taxRateId)).sort((left, right) => left.sequence - right.sequence)
	};
	const taxRegimeService = {
		resolveRegime: async () => undefined,
		filterRegimeMembers: async (candidates: unknown[]) => candidates
	};

	return new TaxRateService(
		repository as never,
		{} as never,
		taxCategoryService as never,
		taxRatePartService as never,
		taxRegimeService as never
	).calculate({
		currency: 'CAD',
		taxCategoryId: CATEGORY,
		countryCode: 'CA',
		provinceCode: 'ON',
		now: AT,
		lines: [{ referenceId: 'L1', amount: gross }]
	} as never);
}

/** `net + tax = gross`, through the money layer rather than by comparing strings. */
function expectNetPlusTaxIsGross(line: { netAmount: string; taxAmount: string; grossAmount: string }) {
	expect(Money.of(line.netAmount, 'CAD').add(Money.of(line.taxAmount, 'CAD')).toStorageString()).toBe(
		line.grossAmount
	);
}

describe('TaxRateService.calculate — exact extraction of an inclusive net (R2-29)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('extracts the net of a compound chain exactly, where four passes stopped 0.76 short', async () => {
		// tax(net) = 0.05 net + 0.09975 × 1.05 net = 0.1547375 net, so net = 10 000 / 1.1547375
		// = 8 659.9768… → 8 659.98. GST 433.00 (432.999), QST on 9 092.98 = 907.02 (907.0248), and
		// 8 659.98 + 433.00 + 907.02 = 10 000.00. The four-pass walk answered 8 660.74.
		const result = await calculate(
			[
				rate({ id: 'gst', rate: 0.05, priority: 10 }),
				rate({ id: 'qst', rate: 0.09975, isCompound: true, priority: 20 })
			],
			'10000.000000'
		);
		const line = result.lines[0];

		expect(line.netAmount).toBe('8659.980000');
		expect(line.taxLines.map((draft) => [draft.code, draft.baseAmount, draft.amount])).toEqual([
			['GST', '8659.980000', '433.000000'],
			['QST', '9092.980000', '907.020000']
		]);
		expect(line.taxAmount).toBe('1340.020000');
		expectNetPlusTaxIsGross(line);
	});

	it('extracts the net of a chain whose rates add up to more than 100 %, which the walk never reached', async () => {
		// Two rates on the net, 100 % and 20 %: tax(net) = 1.2 net, so net = 2 200 / 2.2 = 1 000.00.
		const result = await calculate(
			[rate({ id: 'excise', rate: 1, priority: 10 }), rate({ id: 'vat', rate: 0.2, priority: 0 })],
			'2200.000000'
		);
		const line = result.lines[0];

		expect(line.netAmount).toBe('1000.000000');
		expect(line.taxLines.map((draft) => draft.amount)).toEqual(['1000.000000', '200.000000']);
		expectNetPlusTaxIsGross(line);
	});

	it('extracts the net of a rate assessed on a reduced base', async () => {
		// 20 % on half the net: tax(net) = 0.1 net, so net = 1 100 / 1.1 = 1 000.00 exactly. The walk
		// stopped at 1 000.01 (990 → 1 001 → 999.90 → 1 000.01).
		const result = await calculate([rate({ id: 'vat', rate: 0.2 })], '1100.000000', [
			{ id: 'part-1', taxRateId: 'vat', sequence: 1, factorPercent: 100, baseFactor: 0.5 }
		]);
		const line = result.lines[0];

		expect(line.netAmount).toBe('1000.000000');
		expect(line.taxLines[0].baseAmount).toBe('500.000000');
		expect(line.taxLines[0].amount).toBe('100.000000');
		expectNetPlusTaxIsGross(line);
	});

	it('takes a fixed amount out of the gross before the percentage, including under compounding', async () => {
		// A fixed 2.00 excise, then 20 % compound on net + excise: tax(net) = 2 + 0.2 (net + 2) =
		// 0.2 net + 2.4, so net = (122.40 − 2.40) / 1.2 = 100.00. The walk stopped at 100.04.
		const result = await calculate(
			[
				rate({ id: 'excise', rate: 0, amountType: 'FIXED', priority: 10 }),
				rate({ id: 'vat', rate: 0.2, isCompound: true, priority: 20 })
			],
			'122.400000',
			[
				{
					id: 'excise-part',
					taxRateId: 'excise',
					sequence: 1,
					factorPercent: 100,
					baseFactor: 1,
					amountType: 'FIXED',
					fixedAmount: 2
				}
			]
		);
		const line = result.lines[0];

		expect(line.netAmount).toBe('100.000000');
		expect(line.taxLines.map((draft) => [draft.code, draft.baseAmount, draft.amount])).toEqual([
			['EXCISE', '100.000000', '2.000000'],
			['VAT', '102.000000', '20.400000']
		]);
		expectNetPlusTaxIsGross(line);
	});

	it('takes out the fixed amount the draft posts, rounded, not the unrounded one', async () => {
		// A fixed 0.005 posts as 0.01 at the currency's scale, so the gross 1.00 contains a net of 0.99.
		// Taking out the unrounded 0.005 gave a net of 1.00 and the residual rule then zeroed the tax.
		const result = await calculate([rate({ id: 'levy', rate: 0, amountType: 'FIXED' })], '1.000000', [
			{
				id: 'levy-part',
				taxRateId: 'levy',
				sequence: 1,
				factorPercent: 100,
				baseFactor: 1,
				amountType: 'FIXED',
				fixedAmount: 0.005
			}
		]);
		const line = result.lines[0];

		expect(line.netAmount).toBe('0.990000');
		expect(line.taxAmount).toBe('0.010000');
		expect(line.taxLines[0].amount).toBe('0.010000');
		expectNetPlusTaxIsGross(line);
	});

	it('keeps the single whole rate on its one exact division (control)', async () => {
		// Doc 07 §5.2: 59.99 / 1.05 = 57.1333… → 57.13, tax the residual 2.86.
		const result = await calculate([rate({ id: 'gst', rate: 0.05 })], '59.990000');

		expect(result.lines[0].netAmount).toBe('57.130000');
		expect(result.lines[0].taxAmount).toBe('2.860000');
	});

	it('refuses a chain that takes the whole net or more instead of answering a meaningless net', async () => {
		// A share of −100 % of a 100 % rate: tax(net) = −net, so net + tax is zero for every net and no
		// net is contained in a gross of 50.00.
		const result = calculate([rate({ id: 'withholding', rate: 1 })], '50.000000', [
			{ id: 'part-1', taxRateId: 'withholding', sequence: 1, factorPercent: -100, baseFactor: 1 }
		]);

		await expect(result).rejects.toBeInstanceOf(BadRequestException);
		await expect(result).rejects.toThrow(/TAX_INCLUSIVE_NO_NET/);
	});
});
