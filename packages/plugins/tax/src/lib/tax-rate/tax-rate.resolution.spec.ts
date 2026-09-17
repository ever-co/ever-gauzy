import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { TaxRate } from './tax-rate.entity';
import { TaxRateService, formatTaxRate } from './tax-rate.service';
import { TaxRateMatchLevel } from '../tax.types';

/**
 * Which tax rate applies where: the specificity ladder of doc 07 §4.2–§4.4.
 *
 * The ladder is the whole answer to "what is this taxed at", so the suite walks the *table* rather
 * than one rung of it — the same destination is priced five times, each time with the most specific
 * row removed, and the winner has to move down exactly one level each time. It also pins the two
 * rules the specification calls out as easy to get wrong: a level whose candidates are all excluded
 * by their own narrowing rules does not stop the descent, and an explicit zero rate is a winner that
 * terminates it.
 *
 * The service is constructed directly with an in-memory double of its repository. Nothing here
 * touches a database, a network or the wall clock.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CATEGORY = '00000000-0000-4000-8000-000000000050';
const OTHER_CATEGORY = '00000000-0000-4000-8000-000000000051';
const REGION_CA_ON = '00000000-0000-4000-8000-000000000030';

/** The programme's frozen clock. */
const AT = new Date('2026-01-15T12:00:00.000Z');
const IN_FORCE = new Date('2025-01-01T00:00:00.000Z');
const LONG_AGO = new Date('2020-01-01T00:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');

/** One `tax_rate` row, as the resolution reads it. */
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
	providerKey?: string;
}

/** A live rate of the fixture category. */
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
 * @param row A stored rate.
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
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || same(expected, value);
	});
}

/** Identifier-aware equality. */
function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * @param rates The `tax_rate` rows.
 * @returns A service wired to the double, resolving inside the fixture organization.
 */
function serviceUnderTest(rates: IRateRow[]) {
	const categories = [
		{ id: CATEGORY, code: 'STANDARD', name: 'Standard', isDefault: false },
		{ id: OTHER_CATEGORY, code: 'BOOKS', name: 'Books', isDefault: false },
		{ id: '00000000-0000-4000-8000-000000000052', code: 'DEFAULT', name: 'Default', isDefault: true }
	];

	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			rates.filter((row) => matches(row, options?.where)),
		findOneBy: async (where?: Record<string, unknown>) =>
			rates.filter((row) => matches(row, where))[0] ?? null,
		findOneByOrFail: async (where?: Record<string, unknown>) => {
			const row = rates.filter((one) => matches(one, where))[0];

			if (!row) {
				throw new Error('the fixture has no such rate');
			}

			return row;
		}
	};

	const taxCategoryService = {
		findOneByIdString: async (id: string) => categories.find((category) => category.id === id) ?? null,
		findDefault: async (organizationId?: string) =>
			organizationId ? categories.find((category) => category.isDefault) : null
	};

	// A rate declares its parts as separate rows and belongs to at most one regime. Neither is what
	// this suite is about, so both collaborators answer the way an installation that uses neither does:
	// no parts, and the general set rather than a regime.
	const taxRatePartService = {
		listForRates: async () => [],
		listForRate: async () => []
	};

	const taxRegimeService = {
		resolveRegime: async () => undefined,
		filterRegimeMembers: async (rates: TaxRate[]) => rates
	};

	return new TaxRateService(
		repository as never,
		{} as never,
		taxCategoryService as never,
		taxRatePartService as never,
		taxRegimeService as never
	);
}

/** The destination every case prices at unless it says otherwise. */
const DESTINATION = {
	taxCategoryId: CATEGORY,
	countryCode: 'CA',
	provinceCode: 'ON',
	postalCode: 'M5V 2T6',
	regionId: REGION_CA_ON,
	now: AT
};

describe('TaxRateService.resolve — the specificity ladder (doc 07 §4.2 T3/T4, §4.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/** One rate at each rung of the ladder, all eligible for {@link DESTINATION}. */
	const ladder = (): IRateRow[] => [
		rate({
			id: 'r-postal',
			name: 'Toronto',
			rate: 0.13,
			countryCode: 'CA',
			provinceCode: 'ON',
			postalCodePattern: '^M5V',
			priority: 10
		}),
		rate({ id: 'r-province', name: 'Ontario', rate: 0.12, countryCode: 'CA', provinceCode: 'ON', priority: 5 }),
		rate({ id: 'r-country', name: 'Canada', rate: 0.05, countryCode: 'CA', priority: 1 }),
		rate({ id: 'r-region', name: 'CA-ON region', rate: 0.11, regionId: REGION_CA_ON, priority: 9 }),
		rate({ id: 'r-default', name: 'Fallback', rate: 0.19, isDefault: true })
	];

	it('wins at the most specific level that has any candidate, all the way down the ladder', async () => {
		// Decision-table rows 1–5, walked as one table: each step removes the row that won the step
		// before it, and the winner must move down exactly one rung. A resolver that ranked by
		// priority across levels would pick the region row (priority 9) at the first step.
		const steps: Array<{ drop: number; level: TaxRateMatchLevel; id: string }> = [
			{ drop: -1, level: TaxRateMatchLevel.COUNTRY_PROVINCE_POSTAL, id: 'r-postal' },
			{ drop: 0, level: TaxRateMatchLevel.COUNTRY_PROVINCE, id: 'r-province' },
			{ drop: 1, level: TaxRateMatchLevel.COUNTRY, id: 'r-country' },
			{ drop: 2, level: TaxRateMatchLevel.REGION, id: 'r-region' },
			{ drop: 3, level: TaxRateMatchLevel.DEFAULT, id: 'r-default' }
		];

		for (const step of steps) {
			const rows = ladder().filter((_row, index) => index > step.drop);
			const [winner] = await serviceUnderTest(rows).resolve(DESTINATION);

			expect(winner.taxRateId).toBe(step.id);
			expect(winner.matchLevel).toBe(step.level);
			expect(winner.isWinner).toBe(true);
		}
	});

	it('matches a postal pattern written against the compact form of the code', async () => {
		// "M5V 2T6" and "M5V2T6" are the same destination, so a pattern written for either spelling has
		// to admit it; a resolver that compared the raw string only would untax every order whose
		// customer typed the space.
		const postal = rate({
			id: 'r-postal',
			name: 'Toronto',
			code: 'CA-ON-TORONTO',
			rate: 0.13,
			countryCode: 'CA',
			provinceCode: 'ON',
			postalCodePattern: '^M5V2T6$'
		});
		const fallback = rate({ id: 'r-default', name: 'Fallback', rate: 0.19, isDefault: true });

		const [winner] = await serviceUnderTest([postal, fallback]).resolve(DESTINATION);

		expect(winner.taxRateId).toBe('r-postal');
		expect(winner.code).toBe('CA-ON-TORONTO');
	});

	it('descends past a level whose candidates are all excluded by their own rules', async () => {
		// Decision-table row 6: rules narrow, they never widen, and a level that yields nothing does
		// not stop the ladder — otherwise one over-narrow rule would leave the destination untaxed.
		const [winner] = await serviceUnderTest(ladder()).resolve({
			...DESTINATION,
			matchesRules: async (candidate: TaxRate) => candidate.id === 'r-country' || candidate.id === 'r-default'
		});

		expect(winner.taxRateId).toBe('r-country');
		expect(winner.matchLevel).toBe(TaxRateMatchLevel.COUNTRY);
	});

	it('stops at an explicit zero rate instead of descending to the default', async () => {
		// Decision-table row 7. A zero-rated supply is deliberate; continuing past it would replace a
		// deliberate zero with the fallback rate and over-collect tax.
		const zeroRated = rate({
			id: 'r-zero-books',
			name: 'Zero-rated books',
			rate: 0,
			countryCode: 'CA',
			provinceCode: 'ON',
			priority: 0
		});
		const [winner] = await serviceUnderTest([zeroRated, rate({ id: 'r-default', name: 'Fallback', rate: 0.19, isDefault: true })]).resolve(
			DESTINATION
		);

		expect(winner.taxRateId).toBe('r-zero-books');
		expect(winner.rate).toBe('0.000000');
	});

	it('breaks a tie inside one level by priority, then by rate, then by the later window', async () => {
		// The tie-break chain of T4, each step reached by equalising the step before it.
		const byPriority = await serviceUnderTest([
			rate({ id: 'r-low', name: 'Low', rate: 0.2, countryCode: 'CA', priority: 1 }),
			rate({ id: 'r-high', name: 'High', rate: 0.05, countryCode: 'CA', priority: 9 })
		]).resolve(DESTINATION);
		expect(byPriority[0].taxRateId).toBe('r-high');

		const byRate = await serviceUnderTest([
			rate({ id: 'r-cheaper', name: 'Cheaper', rate: 0.05, countryCode: 'CA', priority: 5 }),
			rate({ id: 'r-dearer', name: 'Dearer', rate: 0.0725, countryCode: 'CA', priority: 5 })
		]).resolve(DESTINATION);
		expect(byRate[0].taxRateId).toBe('r-dearer');

		const byWindow = await serviceUnderTest([
			rate({ id: 'r-old', name: 'Old', rate: 0.05, countryCode: 'CA', priority: 5, updatedAt: LAST_YEAR }),
			rate({ id: 'r-new', name: 'New', rate: 0.05, countryCode: 'CA', priority: 5, updatedAt: IN_FORCE })
		]).resolve(DESTINATION);
		expect(byWindow[0].taxRateId).toBe('r-new');
	});

	it('ignores a rate whose validity window has passed', async () => {
		// An ended rate is history: the destination falls to the next rate in force, and with nothing
		// else in force it falls down the ladder rather than being taxed at a rate that no longer
		// exists.
		const ended = rate({
			id: 'r-ended',
			name: 'Ended',
			rate: 0.05,
			countryCode: 'CA',
			provinceCode: 'ON',
			startsAt: LONG_AGO,
			endsAt: LAST_YEAR
		});
		const live = rate({ id: 'r-default', name: 'Fallback', rate: 0.19, isDefault: true });

		const [winner] = await serviceUnderTest([ended, live]).resolve(DESTINATION);

		expect(winner.taxRateId).toBe('r-default');
		expect(winner.matchLevel).toBe(TaxRateMatchLevel.DEFAULT);
	});

	it('treats a window as half-open: in force at its start, out of force at its end', async () => {
		const opening = rate({ id: 'r-opening', name: 'Opening', rate: 0.05, countryCode: 'CA', startsAt: AT });
		const closing = rate({
			id: 'r-closing',
			name: 'Closing',
			rate: 0.07,
			countryCode: 'CA',
			startsAt: LONG_AGO,
			endsAt: AT
		});

		const [atTheEnd] = await serviceUnderTest([opening, closing]).resolve({ ...DESTINATION, now: AT });
		const [justBefore] = await serviceUnderTest([opening, closing]).resolve({
			...DESTINATION,
			now: new Date(AT.getTime() - 1)
		});

		expect(atTheEnd.taxRateId).toBe('r-opening');
		expect(justBefore.taxRateId).toBe('r-closing');
	});

	it('ignores a rate that is not active', async () => {
		const inactive = rate({ id: 'r-inactive', name: 'Inactive', rate: 0.05, countryCode: 'CA', isActive: false });
		const live = rate({ id: 'r-default', name: 'Fallback', rate: 0.19, isDefault: true });

		const [winner] = await serviceUnderTest([inactive, live]).resolve(DESTINATION);

		expect(winner.taxRateId).toBe('r-default');
	});

	it('refuses the resolution when nothing matches at any level', async () => {
		await expect(serviceUnderTest([rate({ id: 'r-de', name: 'Germany', rate: 0.19, countryCode: 'DE' })]).resolve(
			DESTINATION
		)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses the resolution when the category does not exist', async () => {
		await expect(
			serviceUnderTest([rate({ id: 'r-ca', name: 'Canada', rate: 0.05, countryCode: 'CA' })]).resolve({
				...DESTINATION,
				taxCategoryId: '00000000-0000-4000-8000-0000000000ff'
			})
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('carries a compound rate of the same level in the chain, after the rate it compounds on', async () => {
		// The chain is a set of rates, not one rate: a jurisdiction that compounds assesses the second
		// rate on the first one's base.
		const gst = rate({ id: 'r-gst', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON', priority: 30 });
		const qst = rate({
			id: 'r-qst',
			name: 'QST',
			rate: 0.09975,
			countryCode: 'CA',
			provinceCode: 'ON',
			isCompound: true,
			priority: 20
		});

		const chain = await serviceUnderTest([gst, qst]).resolve(DESTINATION);

		expect(chain.map((one) => one.taxRateId)).toEqual(['r-gst', 'r-qst']);
		expect(chain.map((one) => one.isWinner)).toEqual([true, false]);
		expect(chain.map((one) => one.isCompound)).toEqual([false, true]);
		expect(chain[0].rate).toBe('0.050000');
		expect(chain[1].rate).toBe('0.099750');
	});

	it('applies two rates of one level to one line (fixture tax.multi-rate-single-line)', () => {
		// Doc 07 §4.3 row 8: `GST 0.05` (non-compound, priority 10) and `QST 0.09975` (compound,
		// priority 10) both apply to the line, and the chain is ordered non-compound first so that the
		// compound rate accumulates on the federal one. A chain that kept one winner plus the other
		// *compound* rates would drop the 5 % federal rate whenever the provincial one outranked it,
		// which is the shape of the canonical Canadian pair (doc 07 §10 gives GST priority 10 and QST 20).
		const gst = rate({ id: 'r-gst', name: 'GST', rate: 0.05, countryCode: 'CA', provinceCode: 'ON', priority: 10 });
		const qst = rate({
			id: 'r-qst',
			name: 'QST',
			rate: 0.09975,
			countryCode: 'CA',
			provinceCode: 'ON',
			isCompound: true,
			priority: 10
		});

		return serviceUnderTest([gst, qst])
			.resolve(DESTINATION)
			.then((chain) => {
				expect(chain.map((one) => one.taxRateId)).toEqual(['r-gst', 'r-qst']);
				// The order is not cosmetic: the second rate's base is the first rate's amount.
				expect(chain.map((one) => one.isWinner)).toEqual([true, false]);
			});
	});
});

describe('formatTaxRate — the six-decimal wire form of a rate (doc 07 §1.2)', () => {
	it('renders a rate at the storage scale however it was read', () => {
		expect(formatTaxRate(0.2)).toBe('0.200000');
		expect(formatTaxRate(0.09975)).toBe('0.099750');
		expect(formatTaxRate('0.05')).toBe('0.050000');
		expect(formatTaxRate(0)).toBe('0.000000');
	});

	it('never lets a binary floating-point artefact reach the wire', () => {
		// Control: `0.1 + 0.2` is `0.30000000000000004` as a double, and a rate that reached a tax line
		// in that form would be rejected by every money column it is written to.
		expect(formatTaxRate(0.1 + 0.2)).toBe('0.300000');
		expect(formatTaxRate(0.1 + 0.2)).not.toContain('000000000000004');
	});
});
