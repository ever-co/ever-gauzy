import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, RequestContext } from '@gauzy/core';
import { TaxRateService } from './tax-rate.service';

/**
 * What a line is taxed at: doc 07 §4.4–§4.7, §5.1–§5.3.
 *
 * Every case here asserts a property the domain requires rather than the number this implementation
 * happens to produce:
 *
 * - an exclusive line is taxed on the base it is actually charged on (the discounted one);
 * - an inclusive line's net and tax are *extracted* from the gross it already is, with the residual
 *   rule, so `net + tax === gross` exactly — including at the half-cent where the two possible splits
 *   disagree (E2);
 * - a compound rate is assessed on the already-rounded amount of the rate before it, not on the net
 *   (E4/§5.3);
 * - a zero-rated supply produces a `0.000000` tax line rather than no tax line;
 * - the tax of a set of lines is the exact sum of the per-line tax, and the per-line boundary is not
 *   the per-rate one — the one cent that separates them is the control case.
 *
 * The service is constructed with an in-memory double of its repository; there is no database, no
 * network and no wall clock.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CATEGORY = '00000000-0000-4000-8000-000000000050';

/** The programme's frozen clock. */
const AT = new Date('2026-01-15T12:00:00.000Z');
const LONG_AGO = new Date('2020-01-01T00:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');

/** One `tax_rate` row. */
interface IRateRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	taxCategoryId: string;
	code?: string;
	name: string;
	rate: number;
	isCompound?: boolean;
	isInclusive?: boolean;
	isDefault?: boolean;
	isActive?: boolean;
	priority?: number;
	regionId?: string;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	startsAt?: Date;
	endsAt?: Date;
	updatedAt?: Date;
}

const rate = (overrides: Partial<IRateRow> & { id: string; rate: number }): IRateRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	taxCategoryId: CATEGORY,
	name: overrides.id,
	isCompound: false,
	isActive: true,
	priority: 0,
	...overrides
});

/**
 * The Canadian chain of doc 07 §5.3 and §10: 5 % on the net, then 9.975 % on the net plus the 5 %.
 *
 * The priorities are the ones the specification's own worked example states — the compound rate has
 * the *higher* priority — because the order the rates are applied in is not the order they are ranked
 * in: the rates that do not compound come first whatever their priority, so that the second rate's
 * base is the first rate's amount.
 */
const canadianChain = (): IRateRow[] => [
	rate({ id: 'r-gst', code: 'GST', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON', priority: 10 }),
	rate({
		id: 'r-qst',
		code: 'QST',
		name: 'QST',
		rate: 0.09975,
		countryCode: 'CA',
		provinceCode: 'ON',
		isCompound: true,
		priority: 20
	})
];

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

function serviceUnderTest(rates: IRateRow[]) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			rates.filter((row) => matches(row, options?.where)),
		findOneBy: async (where?: Record<string, unknown>) => rates.filter((row) => matches(row, where))[0] ?? null
	};

	const taxCategoryService = {
		findOneByIdString: async (id: string) => (id === CATEGORY ? { id: CATEGORY, code: 'STANDARD' } : null),
		findDefault: async () => null
	};

	// No rate declares parts and none belongs to a regime, which is what an installation that uses
	// neither looks like; the regime resolver therefore selects the general set.
	const taxRatePartService = {
		listForRates: async () => [],
		listForRate: async () => []
	};

	const taxRegimeService = {
		resolveRegime: async () => undefined,
		filterRegimeMembers: async (rates: unknown[]) => rates
	};

	return new TaxRateService(
		repository as never,
		{} as never,
		taxCategoryService as never,
		taxRatePartService as never,
		taxRegimeService as never
	);
}

/** A calculation request for one line of `amount`, at the fixture destination. */
const request = (rates: IRateRow[], amounts: string[], overrides: Record<string, unknown> = {}) =>
	serviceUnderTest(rates).calculate({
		currency: 'CAD',
		taxCategoryId: CATEGORY,
		countryCode: 'CA',
		provinceCode: 'ON',
		now: AT,
		lines: amounts.map((amount, index) => ({ referenceId: `L${index + 1}`, amount })),
		...overrides
	} as never);

describe('TaxRateService.calculate — exclusive and inclusive lines (doc 07 §4.5, §5.1–§5.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('taxes an exclusive line on the base it is charged on, not on the list price', async () => {
		// Fixture `tax.exclusive-single-rate`. The line arrives already discounted, and the tax has to
		// follow the discounted base: taxing the undiscounted 74.97 would collect 1.25 too much.
		const discounted = await request([rate({ id: 'r-gst', code: 'GST', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON' })], [
			'49.980000'
		]);
		const listed = await request([rate({ id: 'r-gst', code: 'GST', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON' })], [
			'74.970000'
		]);

		expect(discounted.lines[0].netAmount).toBe('49.980000');
		expect(discounted.lines[0].taxAmount).toBe('2.500000');
		expect(discounted.lines[0].grossAmount).toBe('52.480000');
		expect(discounted.lines[0].taxLines).toHaveLength(1);
		expect(discounted.lines[0].taxLines[0]).toMatchObject({
			code: 'GST',
			rate: '0.050000',
			baseAmount: '49.980000',
			amount: '2.500000',
			isInclusive: false,
			isCompound: false
		});
		// The undiscounted base is taxed differently, which is what makes the assertion above mean
		// something: 74.97 x 5 % is 3.75.
		expect(listed.lines[0].taxAmount).toBe('3.750000');
		expect(discounted.lines[0].taxAmount).not.toBe(listed.lines[0].taxAmount);
	});

	it('extracts the net and the tax of an inclusive line so that net plus tax is the gross exactly', async () => {
		// Doc 07 §5.2: 59.99 / 1.05 = 57.1333…, net 57.13, tax the residual 2.86.
		const result = await request(
			[rate({ id: 'r-gst', code: 'GST', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON', isInclusive: true })],
			['59.990000']
		);
		const line = result.lines[0];

		expect(line.netAmount).toBe('57.130000');
		expect(line.taxAmount).toBe('2.860000');
		expect(line.grossAmount).toBe('59.990000');
		expect(line.taxLines[0].baseAmount).toBe('57.130000');
		expect(line.taxLines[0].amount).toBe('2.860000');

		// The invariant, asserted through the money layer rather than by comparing strings.
		const net = Money.of(line.netAmount, 'CAD');
		const tax = Money.of(line.taxAmount, 'CAD');
		expect(net.add(tax).toStorageString()).toBe(line.grossAmount);
	});

	it('lands the residual on the last tax line when the split falls on a half cent', async () => {
		// E2: gross 0.15 at 20 %. The mandated split is the residual one, 0.13 / 0.02. Applying the
		// rate to the rounded net would give 0.12 / 0.03 — a cent of tax that is not in the price —
		// and that is the control.
		const result = await request(
			[rate({ id: 'r-vat', code: 'VAT', name: 'VAT', rate: 0.2, countryCode: 'CA', provinceCode: 'ON', isInclusive: true })],
			['0.150000']
		);
		const line = result.lines[0];

		expect(line.netAmount).toBe('0.130000');
		expect(line.taxAmount).toBe('0.020000');
		expect(line.grossAmount).toBe('0.150000');
		expect(Money.of(line.netAmount, 'CAD').add(Money.of(line.taxAmount, 'CAD')).toStorageString()).toBe(
			'0.150000'
		);

		// Control: the split a rate-applied implementation produces.
		expect(line.netAmount).not.toBe('0.120000');
		expect(line.taxAmount).not.toBe('0.030000');
	});

	it('reports the tax of an inclusive line as the sum of its own tax lines', async () => {
		// `net + tax = gross` is carried by the drafts, so the ledger and the line agree.
		const result = await request(
			[rate({ id: 'r-vat', code: 'VAT', name: 'VAT', rate: 0.2, countryCode: 'CA', provinceCode: 'ON', isInclusive: true })],
			['0.150000']
		);
		const line = result.lines[0];
		const drafted = Money.sum(
			line.taxLines.map((draft) => Money.of(draft.amount, 'CAD')),
			'CAD'
		);

		expect(drafted.toStorageString()).toBe(line.taxAmount);
	});

	it('rounds at the currency\u2019s own scale, not at two decimals', async () => {
		// 100 JPY at 7.5 % is 7.5, and a currency whose minor unit is the currency itself cannot charge
		// half of one: the boundary is the currency's scale.
		const result = await request(
			[rate({ id: 'r-jct', code: 'JCT', name: 'Consumption tax', rate: 0.075, countryCode: 'CA', provinceCode: 'ON' })],
			['100'],
			{ currency: 'JPY' }
		);

		expect(result.lines[0].netAmount).toBe('100.000000');
		expect(result.lines[0].taxAmount).toBe('8.000000');
		expect(result.lines[0].grossAmount).toBe('108.000000');
	});

	it('rounds a half cent away from zero', async () => {
		// Fixture `rounding.half-up-at-exact-half`: 0.10 at 5 % is exactly 0.005, which is 0.01 under
		// the platform's mode. A half-to-even implementation would charge nothing.
		const result = await request(
			[rate({ id: 'r-gst', code: 'GST', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON' })],
			['0.100000']
		);

		expect(result.lines[0].taxAmount).toBe('0.010000');
		expect(result.lines[0].grossAmount).toBe('0.110000');
	});
});

describe('TaxRateService.calculate — several rates on one line (doc 07 §4.4, §5.3, §3.4 E4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('assesses a compound rate on the already-rounded amount of the rate before it', async () => {
		// §5.3: 100.00 → GST 5.00, QST base 105.00 → 10.47, total 15.47. Assessing both on the net
		// would collect 14.98 and under-collect 0.49 per 100.00, which is the control.
		const result = await request(canadianChain(), ['100.000000']);
		const line = result.lines[0];

		expect(line.taxLines).toHaveLength(2);
		expect(line.taxLines[0]).toMatchObject({ code: 'GST', baseAmount: '100.000000', amount: '5.000000' });
		expect(line.taxLines[1]).toMatchObject({
			code: 'QST',
			baseAmount: '105.000000',
			amount: '10.470000',
			isCompound: true
		});
		expect(line.taxAmount).toBe('15.470000');
		expect(line.grossAmount).toBe('115.470000');

		// Control: the parallel (non-compound) total.
		expect(line.taxAmount).not.toBe('14.980000');
	});

	it('sums the per-line tax exactly, and is not the tax of the summed base', async () => {
		// E4. Three lines of 10.00, the same two rates: per line and per rate, the two boundaries differ
		// by one minor unit (4.65 against 4.64). The platform rounds per line and per rate, and the
		// total is the exact sum of what was rounded — never a rounding of the total.
		const result = await request(canadianChain(), ['10.000000', '10.000000', '10.000000']);

		expect(result.lines.map((line) => line.taxAmount)).toEqual(['1.550000', '1.550000', '1.550000']);
		expect(result.netTotal).toBe('30.000000');
		expect(result.taxTotal).toBe('4.650000');
		expect(result.grossTotal).toBe('34.650000');

		// The sum of the parts is the total, exactly.
		const summed = Money.sum(
			result.lines.map((line) => Money.of(line.taxAmount, 'CAD')),
			'CAD'
		);
		expect(summed.toStorageString()).toBe(result.taxTotal);

		// Control: rounding once per rate over the whole document gives 1.50 + 3.14 = 4.64.
		expect(result.taxTotal).not.toBe('4.640000');
	});

	it('gives every line its own tax lines and its own reference', async () => {
		const result = await request(canadianChain(), ['10.000000', '20.000000']);

		expect(result.lines.map((line) => line.referenceId)).toEqual(['L1', 'L2']);
		expect(result.lines[1].taxLines.map((draft) => draft.baseAmount)).toEqual(['20.000000', '21.000000']);
		// The compounding base of the second line follows that line, not the document: 1.00 + 2.09.
		expect(result.lines[1].taxAmount).toBe('3.090000');
	});
});

describe('TaxRateService.calculate — zero-rated, exempt and ended rates (doc 07 §4.2, §4.6, §5.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('produces a zero tax line for a zero-rated supply rather than no tax line', async () => {
		// Fixture `tax.zero-rated-category`, and P3.4: the row is the audit trail of the decision, so
		// `0.000000` is written rather than the row being omitted or the amount being left null.
		const zero = rate({
			id: 'r-zero',
			code: 'ZERO-RATED',
			name: 'Zero-rated books',
			rate: 0,
			countryCode: 'CA',
			provinceCode: 'ON'
		});
		const fallback = rate({ id: 'r-default', code: 'STD', name: 'Standard', rate: 0.19, isDefault: true });

		const result = await request([zero, fallback], ['49.980000']);
		const line = result.lines[0];

		expect(line.taxLines).toHaveLength(1);
		expect(line.taxLines[0]).toMatchObject({ code: 'ZERO-RATED', rate: '0.000000', amount: '0.000000' });
		expect(line.taxAmount).toBe('0.000000');
		expect(line.grossAmount).toBe('49.980000');
		// The ladder stopped at the explicit zero: the 19 % fallback was not applied.
		expect(result.taxTotal).not.toBe('9.500000');
	});

	it('taxes a line at nothing when the catalogue is deliberately untaxed', async () => {
		// §4.6/P3.5: an exempt supply keeps its amounts and carries no tax line at all, which is what a
		// caller reports as `EXEMPT`.
		const result = await request([], ['49.980000'], { allowUntaxedCatalog: true });
		const line = result.lines[0];

		expect(line.taxLines).toEqual([]);
		expect(line.taxAmount).toBe('0.000000');
		expect(line.netAmount).toBe('49.980000');
		expect(line.grossAmount).toBe('49.980000');
		expect(result.taxTotal).toBe('0.000000');
		expect(result.grossTotal).toBe('49.980000');
	});

	it('refuses the calculation when no rate matches and an untaxed catalogue is not allowed', async () => {
		// §4.2 T7: silence is not an option — the caller either allows an untaxed catalogue or is told
		// that the rate is missing.
		await expect(request([], ['49.980000'])).rejects.toBeInstanceOf(BadRequestException);
	});

	it('does not apply a rate whose validity window has passed', async () => {
		// An ended rate is history. The destination falls to the next rate in force, and here that is
		// the category default.
		const ended = rate({
			id: 'r-ended',
			code: 'OLD',
			name: 'Ended rate',
			rate: 0.05,
			countryCode: 'CA',
			provinceCode: 'ON',
			startsAt: LONG_AGO,
			endsAt: LAST_YEAR
		});
		const fallback = rate({ id: 'r-default', code: 'STD', name: 'Standard', rate: 0.19, isDefault: true });

		const result = await request([ended, fallback], ['100.000000']);

		expect(result.lines[0].taxLines.map((draft) => draft.code)).toEqual(['STD']);
		expect(result.lines[0].taxAmount).toBe('19.000000');
	});
});
