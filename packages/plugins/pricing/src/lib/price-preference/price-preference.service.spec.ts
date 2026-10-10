import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PricePreferenceAttribute } from '../pricing.types';
import { PricePreferenceService } from './price-preference.service';

/**
 * Tax-inclusivity preferences: the last answer before the caller's own default.
 *
 * The service is small and its precedence is the whole of its behaviour — a currency preference beats
 * a region preference beats a channel preference — so the suite asserts the chain as a table rather
 * than one lookup, and asserts the identity rule that makes `usd` and `USD` one scope instead of two
 * rows that disagree about the same currency.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const REGION_CA_ON = '00000000-0000-4000-8000-000000000030';

interface IPreferenceRow {
	id: string;
	tenantId: string;
	organizationId: string;
	attribute: PricePreferenceAttribute;
	value: string;
	isTaxInclusive: boolean;
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

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

function serviceUnderTest(preferences: IPreferenceRow[]) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			preferences.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			preferences.filter((row) => matches(row, options?.where))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) =>
			preferences.filter((row) => matches(row, where))[0] ?? null,
		create: (partial: IPreferenceRow) => ({ ...partial }),
		save: async (entity: IPreferenceRow) => {
			preferences.push(entity);

			return entity;
		}
	};

	return new PricePreferenceService(repository as never, {} as never);
}

const preference = (
	attribute: PricePreferenceAttribute,
	value: string,
	isTaxInclusive: boolean
): IPreferenceRow => ({
	id: `pref-${attribute}-${value}`,
	tenantId: TENANT,
	organizationId: ORG,
	attribute,
	value,
	isTaxInclusive
});

describe('PricePreferenceService.resolveTaxInclusivity — the precedence chain (doc 08 §4.2, doc 07 §4.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers by currency, then by region, then by channel', async () => {
		// Each answer is the opposite of the one below it, so a resolver that consulted the wrong rung
		// would return the wrong boolean rather than merely the wrong row.
		const rows = [
			preference(PricePreferenceAttribute.CURRENCY, 'CAD', true),
			preference(PricePreferenceAttribute.REGION, REGION_CA_ON, false),
			preference(PricePreferenceAttribute.CHANNEL, 'web', false)
		];

		const service = serviceUnderTest(rows);
		const all = { currency: 'CAD' as never, regionId: REGION_CA_ON, channelCode: 'web' };
		const withoutCurrency = { regionId: REGION_CA_ON, channelCode: 'web' };
		const channelOnly = { channelCode: 'web' };

		expect(await service.resolveTaxInclusivity(all)).toBe(true);
		expect(await serviceUnderTest([rows[1], rows[2]]).resolveTaxInclusivity(withoutCurrency)).toBe(false);
		expect(await serviceUnderTest([{ ...rows[2], isTaxInclusive: true }]).resolveTaxInclusivity(channelOnly)).toBe(
			true
		);
	});

	it('reports that no scope has an answer rather than guessing one', async () => {
		// `null` is the caller's cue to fall back to its own default; a preference service that answered
		// `false` here would decide for every installation that never configured one.
		const service = serviceUnderTest([preference(PricePreferenceAttribute.REGION, REGION_CA_ON, true)]);

		expect(await service.resolveTaxInclusivity({ currency: 'CAD' as never })).toBeNull();
		expect(await service.resolveTaxInclusivity({})).toBeNull();
	});

	it('skips a scope the question does not name', async () => {
		const service = serviceUnderTest([preference(PricePreferenceAttribute.CURRENCY, 'CAD', true)]);

		expect(await service.resolveTaxInclusivity({ channelCode: 'web' })).toBeNull();
	});

	it('treats a currency preference as one scope however the code was written', async () => {
		// `usd` and `USD` are the same currency; two rows for it would make a displayed price depend on
		// row order, so the value is canonicalised on the way in and on the way out.
		const service = serviceUnderTest([preference(PricePreferenceAttribute.CURRENCY, 'USD', true)]);

		expect(await service.resolveTaxInclusivity({ currency: 'usd' as never })).toBe(true);

		await expect(
			service.createOne({ attribute: PricePreferenceAttribute.CURRENCY, value: 'usd', isTaxInclusive: false } as never)
		).rejects.toMatchObject({ message: expect.stringContaining('PRICE_PREFERENCE_EXISTS') });
	});

	it('refuses a preference with no scope value', async () => {
		const service = serviceUnderTest([]);

		await expect(
			service.createOne({ attribute: PricePreferenceAttribute.CHANNEL, value: '   ' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
