/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a commission calculator needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the calculator under test is the real one**, together with the real money helper it computes
 * through: the assertions below are about the amounts it produces and never about which methods it
 * called.
 *
 * `@gauzy/config` is read at import time by other packages of the workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => ({
	Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
	// The decimal comparison the commission bands are decided by is the kernel's own, so the double
	// hands over the real one: a comparison doubled here would agree with the service about arithmetic
	// the platform never performs.
	compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => null,
		currentOrganizationId: () => null,
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { BadRequestException } from '@nestjs/common';
import {
	CommissionBasis,
	CommissionSource,
	CurrencyCode,
	ICommissionComputationInput,
	ICommissionTier,
	IResolvedCommission,
	RoundingMode
} from '@gauzy/contracts';
import { Money } from '@gauzy/core';
import { SellerCommissionService } from './seller-commission.service';

/**
 * The platform's commission on a seller-owned line (doc 20 §4).
 *
 * The specification states the commission model as arithmetic and worked scenarios, and this suite
 * pins it exactly:
 *
 * - **the resolution is total per field, not per group** (doc 20 §4.2): a seller that sets only a
 *   rate inherits the platform's basis rather than silently producing a zero commission, and a
 *   half-configured participant cannot turn the platform's fee off by omission;
 * - **there is no implicit zero** (§4.2 step 4): a seller-owned line with no resolvable rate is
 *   refused rather than sold at a rate nobody agreed to;
 * - **two answers to one question is a defect, not a policy** (§4.3): a tiered basis that also
 *   declares a rate is refused, and a schedule whose bands overlap or leave a gap is refused;
 * - **bands are half open — `from <= x < to`** (§4.1), and a graduated schedule gives the whole
 *   amount the band's rate rather than applying the bands marginally (§4.4 S5);
 * - **the commission is rounded once, per row, at the currency's precision, half-up** (§4.3 B10),
 *   and `netAmount` is then an exact subtraction of two already-rounded values, so
 *   `netAmount + commissionAmount` equals the line's captured amount with no residue (MK-7, MK-8);
 * - **a platform-funded discount never reduces the basis** (§4.1, §11.3), while the seller's own
 *   discount reduces it on the two bases that say so;
 * - **a sale never leaves a seller with a negative net unless its policy allows it** (MK-23).
 *
 * The scenarios S1–S6 of §4.4 are used verbatim as the golden values: an order on `WEB-EU` in EUR at
 * two decimal places, so every amount below is a major unit a reader can check by hand.
 */

const EUR = 'EUR' as CurrencyCode;
const DECIMALS = 2;

const service = new SellerCommissionService();

/** One line's own amounts, in the line's currency. */
function lineInput(overrides: Partial<ICommissionComputationInput> = {}): ICommissionComputationInput {
	return {
		sellerId: 'seller-1',
		grossAmount: '100.00',
		taxAmount: '18.05',
		sellerDiscountAmount: '-5.00',
		platformDiscountAmount: '0.00',
		quantity: '4',
		currency: EUR,
		currencyDecimals: DECIMALS,
		...overrides
	} as ICommissionComputationInput;
}

/** A resolved commission, as `resolve` would hand it back. */
function resolved(overrides: Partial<IResolvedCommission> = {}): IResolvedCommission {
	return {
		rate: '0.15',
		basis: CommissionBasis.DISCOUNTED_SUBTOTAL,
		source: CommissionSource.SELLER,
		commissionOnShipping: true,
		...overrides
	} as IResolvedCommission;
}

const TIERS_AMOUNT: ICommissionTier[] = [
	{ from: 0, to: 100, rate: '0.12' },
	{ from: 100, to: 500, rate: '0.09' },
	{ from: 500, to: null, rate: '0.07' }
];
const TIERS_QUANTITY: ICommissionTier[] = [
	{ from: 1, to: 3, rate: '0.15' },
	{ from: 3, to: 10, rate: '0.12' },
	{ from: 10, to: null, rate: '0.08' }
];

describe('SellerCommissionService — resolving which commission applies (doc 20 §4.2, §4.3)', () => {
	it('takes each field from the most specific source that states it', () => {
		// "It is total per field, not per group" (§4.2 property 1): the rate is the seller's and the basis
		// is the platform's, and neither source silently blanks the other's contribution.
		const outcome = service.resolve(
			undefined,
			{ rate: '0.15', source: CommissionSource.SELLER },
			{ basis: CommissionBasis.INCLUDING_TAX, source: CommissionSource.PLATFORM }
		);

		expect(outcome).toMatchObject({
			rate: '0.15',
			basis: CommissionBasis.INCLUDING_TAX,
			source: CommissionSource.SELLER
		});
	});

	it('lets the offering override the seller, field by field', () => {
		const outcome = service.resolve(
			{ rate: '0.05' },
			{ rate: '0.15', basis: CommissionBasis.ITEM_SUBTOTAL },
			{ rate: '0.20', basis: CommissionBasis.INCLUDING_TAX }
		);

		expect(outcome).toMatchObject({ rate: '0.05', basis: CommissionBasis.ITEM_SUBTOTAL, source: CommissionSource.OFFERING });
	});

	it('falls back to the documented basis when no source states one', () => {
		const outcome = service.resolve(undefined, { rate: '0.15' }, undefined);

		expect(outcome.basis).toBe(CommissionBasis.ITEM_SUBTOTAL);
	});

	it('refuses a seller-owned line with no resolvable rate, because there is no implicit zero', () => {
		// §4.2 step 4: the marketplace does not price itself, and a line sold at a rate nobody agreed to is
		// worse than a line that fails to sell.
		expect(() => service.resolve(undefined, undefined, undefined)).toThrow(BadRequestException);
		expect(() => service.resolve(undefined, {}, {})).toThrow(/No commission rate could be resolved/);
	});

	it('labels the source of the rate so a statement can explain itself', () => {
		expect(service.resolve(undefined, undefined, { rate: '0.20' }).source).toBe(CommissionSource.PLATFORM);
		expect(service.resolve(undefined, { rate: '0.20' }, { rate: '0.30' }).source).toBe(CommissionSource.SELLER);
	});

	it('defaults commission-on-shipping to true and takes an explicit value from the chain', () => {
		const outcome = service.resolve({ rate: '0.09' }, { commissionOnShipping: false } as never, undefined);

		expect(outcome).toMatchObject({ rate: '0.09', source: CommissionSource.OFFERING, commissionOnShipping: false });
		// A seller and an offering that say nothing about shipping take the platform's default, which is
		// that the commission applies to shipping revenue as it does to anything else charged for.
		expect(service.resolve(undefined, { rate: '0.09' }, undefined).commissionOnShipping).toBe(true);
	});

	it('refuses a tiered basis with no schedule', () => {
		expect(() => service.resolve({ basis: CommissionBasis.TIERED_AMOUNT }, undefined, undefined)).toThrow(
			/needs a tier schedule/
		);
	});

	it('refuses a tiered basis that also declares a rate, because two answers to one question is a defect', () => {
		expect(() =>
			service.resolve({ basis: CommissionBasis.TIERED_AMOUNT, tiers: TIERS_AMOUNT, rate: '0.09' }, undefined, undefined)
		).toThrow(/must not also declare a rate/);
	});

	// The defect: the two checks together make a tiered commission impossible to resolve, so a
	// `TIERED_AMOUNT` or `TIERED_QUANTITY` line can be neither published nor sold. Declaring a rate
	// alongside the schedule is refused as "two answers to one question" (doc 20 §4.3), and *not*
	// declaring one falls through to the "no implicit zero" refusal — but for a tiered basis the rate
	// is not missing at all: §4.1 puts it in `commissionTiers` ("the tier containing `grossAmount +
	// sellerDiscountAmount` sets the rate for the whole line amount"), and §4.4 S5/S6 compute with no
	// scalar rate anywhere. (`seller-commission.service.ts`, the tiered branch's rate refusal and the
	// `rate === undefined` check the same call then reaches.)
	it('[DEFECT] resolves a tiered schedule that states its rates in the schedule alone', () => {
		const outcome = service.resolve({ basis: CommissionBasis.TIERED_AMOUNT, tiers: TIERS_AMOUNT }, undefined, undefined);

		expect(outcome).toMatchObject({ basis: CommissionBasis.TIERED_AMOUNT, source: CommissionSource.OFFERING });
	});

	it('refuses a fixed-fee basis with no fee, and accepts one with it', () => {
		expect(() => service.resolve({ basis: CommissionBasis.FIXED_PER_ITEM }, undefined, undefined)).toThrow(
			/needs a fee per item/
		);
		expect(
			service.resolve({ basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '1.25' }, undefined, undefined)
		).toMatchObject({ basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '1.25' });
	});

	it.each([
		['a gap between two bands', [{ from: 0, to: 100, rate: '0.12' }, { from: 200, to: null, rate: '0.09' }], /gap or an overlap/],
		['an overlap between two bands', [{ from: 0, to: 150, rate: '0.12' }, { from: 100, to: null, rate: '0.09' }], /gap or an overlap/],
		['an open-ended band that is not the last one', [{ from: 0, to: null, rate: '0.12' }, { from: 100, to: 500, rate: '0.09' }], /must be the last one/],
		['a band that does not end after it starts', [{ from: 100, to: 100, rate: '0.09' }], /does not end after it starts/]
	])('refuses a schedule with %s', (_label, tiers, message) => {
		expect(() => service.assertTiers(tiers as ICommissionTier[])).toThrow(message as RegExp);
	});

	it('accepts a schedule that is a partition of the number line', () => {
		expect(() => service.assertTiers(TIERS_AMOUNT)).not.toThrow();
		expect(() => service.assertTiers(TIERS_QUANTITY)).not.toThrow();
	});
});

describe('SellerCommissionService — the worked scenarios of doc 20 §4.4', () => {
	it('S1 — a percentage of the item subtotal, with no discount', () => {
		// L3: gross 120.00, tax 8.40, basis 120.00, rate 0.10 → commission 12.00, net 116.40.
		const outcome = service.compute(
			lineInput({ grossAmount: '120.00', taxAmount: '8.40', sellerDiscountAmount: '0.00', quantity: '2' }),
			resolved({ rate: '0.10', basis: CommissionBasis.ITEM_SUBTOTAL })
		);

		expect(outcome).toMatchObject({
			basisAmount: '120.000000',
			rate: '0.100000',
			commissionAmount: '12.000000',
			netAmount: '116.400000'
		});
	});

	it('S2 — a percentage of the discounted subtotal, with a seller-funded discount', () => {
		// L1: basis 95.00 (100.00 − 5.00), commission 14.25, net 100.00 + 18.05 − 5.00 − 14.25 = 98.80,
		// and the row balances: 98.80 + 14.25 = 113.05, the buyer-captured share (MK-7, MK-8).
		const outcome = service.compute(lineInput(), resolved({ rate: '0.15', basis: CommissionBasis.DISCOUNTED_SUBTOTAL }));
		const captured = Money.of('100.00', EUR, DECIMALS)
			.add(Money.of('18.05', EUR, DECIMALS))
			.add(Money.of('-5.00', EUR, DECIMALS));

		expect(outcome).toMatchObject({
			basisAmount: '95.000000',
			commissionAmount: '14.250000',
			netAmount: '98.800000'
		});
		expect(
			Money.of(outcome.netAmount, EUR, DECIMALS).add(Money.of(outcome.commissionAmount, EUR, DECIMALS)).equals(captured)
		).toBe(true);
	});

	it('S3 — a percentage including tax, rounded once half-up at the currency’s precision', () => {
		// 113.05 × 0.15 = 16.9575, which is the documented rounding event B10: half-up gives 16.96, and the
		// residue lands on the platform's commission, never on the seller's net.
		const outcome = service.compute(
			lineInput(),
			resolved({ rate: '0.15', basis: CommissionBasis.INCLUDING_TAX })
		);

		expect(outcome).toMatchObject({
			basisAmount: '113.050000',
			commissionAmount: '16.960000',
			netAmount: '96.090000'
		});
		expect(Money.of(outcome.netAmount, EUR, DECIMALS).add(Money.of(outcome.commissionAmount, EUR, DECIMALS)).toStorageString()).toBe(
			'113.050000'
		);
	});

	it('S4 — a fixed fee per item, with no rate and no rounding event', () => {
		// 1.25 × 4 = 5.00; net = 113.05 − 5.00 = 108.05.
		const outcome = service.compute(
			lineInput(),
			resolved({ basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '1.25', rate: '0' })
		);

		expect(outcome).toMatchObject({
			basisAmount: '100.000000',
			commissionAmount: '5.000000',
			netAmount: '108.050000'
		});
	});

	it('S5 — a graduated schedule by amount applies the band’s rate to the whole amount', () => {
		// 120.00 falls in [100, 500), so the whole 120.00 takes 9 %: 10.80, and net = 120.00 + 8.40 − 10.80.
		const outcome = service.compute(
			lineInput({ grossAmount: '120.00', taxAmount: '8.40', sellerDiscountAmount: '0.00', quantity: '2' }),
			resolved({ basis: CommissionBasis.TIERED_AMOUNT, tiers: TIERS_AMOUNT, rate: '0' })
		);

		expect(outcome).toMatchObject({
			basisAmount: '120.000000',
			rate: '0.090000',
			commissionAmount: '10.800000',
			netAmount: '117.600000'
		});
	});

	it('S6 — a graduated schedule by quantity sets the rate for the line', () => {
		// Quantity 4 falls in [3, 10) → 12 %, applied once to the basis amount the convention states —
		// here the list amount of 100.00, because a tiered-quantity basis takes its amount from the line
		// rather than from a discount convention: 12.00, and net = 100.00 + 18.05 − 5.00 − 12.00.
		const outcome = service.compute(
			lineInput(),
			resolved({ basis: CommissionBasis.TIERED_QUANTITY, tiers: TIERS_QUANTITY, rate: '0' })
		);

		expect(outcome).toMatchObject({
			basisAmount: '100.000000',
			rate: '0.120000',
			commissionAmount: '12.000000',
			netAmount: '101.050000'
		});
	});
});

describe('SellerCommissionService — the band boundaries of a graduated schedule (doc 20 §4.1)', () => {
	const tiers = TIERS_AMOUNT;

	it.each([
		['the lower bound of the first band', '0.00', '0.120000'],
		['one minor unit below the second band', '99.99', '0.120000'],
		['the lower bound of the second band', '100.00', '0.090000'],
		['one minor unit below the third band', '499.99', '0.090000'],
		['the lower bound of the open-ended band', '500.00', '0.070000']
	])('takes the band containing %s', (_label, gross, rate) => {
		// Half open, `from <= x < to` (doc 20 §4.1): `to` belongs to the next band, never to both.
		const outcome = service.compute(
			lineInput({ grossAmount: gross, taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
			resolved({ basis: CommissionBasis.TIERED_AMOUNT, tiers, rate: '0' })
		);

		expect(outcome.rate).toBe(rate);
	});

	it('evaluates a shipping row’s quantity schedule at one rather than at the order’s quantity', () => {
		// §4.7: buying the band with the order's total quantity would let a large order move a seller's
		// shipping commission tier, which neither party would expect.
		const shipping = service.compute(
			lineInput({ grossAmount: '14.50', taxAmount: '1.02', sellerDiscountAmount: '0.00', quantity: '12', isShipping: true } as never),
			resolved({ basis: CommissionBasis.TIERED_QUANTITY, tiers: TIERS_QUANTITY, rate: '0' })
		);
		const line = service.compute(
			lineInput({ quantity: '12' }),
			resolved({ basis: CommissionBasis.TIERED_QUANTITY, tiers: TIERS_QUANTITY, rate: '0' })
		);

		expect(shipping.rate).toBe('0.150000');
		expect(line.rate).toBe('0.080000');
		expect(shipping.commissionAmount).toBe('2.180000');
		// 14.50 × 0.15 = 2.175, rounded once, half-up, at the currency's precision.
		expect(shipping.netAmount).toBe('13.340000');
	});

	it('refuses a value no band contains rather than inventing a rate', () => {
		expect(() =>
			service.compute(
				lineInput({ grossAmount: '120.00', sellerDiscountAmount: '0.00' }),
				resolved({ basis: CommissionBasis.TIERED_AMOUNT, tiers: [{ from: 0, to: 100, rate: '0.12' }], rate: '0' })
			)
		).toThrow(/no band containing/);
	});

	it('places a line by the exact digits of its basis, never by the double the basis parses into', () => {
		// A `numeric(20,6)` column used at its declared width. `Number('10000000000.000001')` **is**
		// `10000000000.000002` — the two are one double — so the old comparison read the basis as equal to
		// the upper band's lower bound and gave the line the band above the one it belongs to. The rate is
		// then snapshotted onto the ledger row and is a fact from that point on, so a seller is charged the
		// wrong commission permanently and nothing anywhere reports it.
		const boundary = 10000000000.000002;
		const tiers: ICommissionTier[] = [
			{ from: 0, to: boundary, rate: '0.12' },
			{ from: boundary, to: null, rate: '0.09' }
		];

		expect(Number('10000000000.000001')).toBe(boundary);

		const outcome = service.compute(
			lineInput({
				grossAmount: '10000000000.000001',
				taxAmount: '0.00',
				sellerDiscountAmount: '0.00',
				quantity: '1'
			}),
			resolved({ basis: CommissionBasis.TIERED_AMOUNT, tiers, rate: '0' })
		);

		// Below the boundary by one millionth, so the lower band's rate is the one that applies.
		expect(outcome.rate).toBe('0.120000');
	});

	it('partitions a schedule by exact comparison, so two boundaries a double cannot tell apart are two', () => {
		// The boundaries are stated as exact decimals here. `ICommissionTier` types them as `number` today,
		// which is the remaining half of this defect and lives in `@gauzy/contracts`: a schedule whose
		// bands meet below a double's resolution cannot be *expressed* through that type, so the widening
		// to `DecimalString | number` is what makes the gap below reachable from a real tenant's data. The
		// comparison itself is already exact, which is what this pins.
		const exact = [
			{ from: '0', to: '10000000000.000001', rate: '0.12' },
			{ from: '10000000000.000002', to: null, rate: '0.09' }
		] as unknown as ICommissionTier[];
		const partition = [
			{ from: '0', to: '10000000000.000001', rate: '0.12' },
			{ from: '10000000000.000001', to: null, rate: '0.09' }
		] as unknown as ICommissionTier[];

		expect(() => service.assertTiers(exact)).toThrow(/gap or an overlap/);
		expect(() => service.assertTiers(partition)).not.toThrow();
	});
});

describe('SellerCommissionService — one multiplication, one rounding, no residue (doc 20 §4.3 B10, MK-7)', () => {
	it('rounds the commission half-up exactly once, at the currency’s precision', () => {
		// A rate with a repeating decimal: 10.00 × 0.333333 = 3.33333 → 3.33, and the seller keeps the
		// remaining 6.67. A second rounding anywhere would move a minor unit off one side or the other.
		const outcome = service.compute(
			lineInput({ grossAmount: '10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
			resolved({ rate: '0.333333', basis: CommissionBasis.ITEM_SUBTOTAL })
		);

		expect(outcome.commissionAmount).toBe('3.330000');
		expect(outcome.netAmount).toBe('6.670000');
		expect(Money.of(outcome.netAmount, EUR, DECIMALS).add(Money.of(outcome.commissionAmount, EUR, DECIMALS)).toStorageString()).toBe(
			'10.000000'
		);
	});

	it('rounds a half minor unit up, which is the documented direction', () => {
		// 0.125 at two decimals is exactly half a minor unit: HALF_UP gives 0.13 and never 0.12.
		const outcome = service.compute(
			lineInput({ grossAmount: '1.00', taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
			resolved({ rate: '0.125', basis: CommissionBasis.ITEM_SUBTOTAL })
		);

		expect(outcome.commissionAmount).toBe('0.130000');
		expect(outcome.netAmount).toBe('0.870000');
		expect(RoundingMode.HALF_UP).toBeDefined();
	});

	it('takes a zero rate as no commission at all and leaves the whole captured amount to the seller', () => {
		const outcome = service.compute(
			lineInput(),
			resolved({ rate: '0', basis: CommissionBasis.DISCOUNTED_SUBTOTAL })
		);

		expect(outcome.commissionAmount).toBe('0.000000');
		expect(outcome.netAmount).toBe('113.050000');
	});

	it('takes a hundred-percent rate as the whole basis, leaving the seller the tax and the discounts', () => {
		// The other end of the rate range: the platform takes the entire basis, so what the seller keeps is
		// exactly the tax and its own discount — 18.05 − 5.00.
		const outcome = service.compute(
			lineInput(),
			resolved({ rate: '1', basis: CommissionBasis.DISCOUNTED_SUBTOTAL })
		);

		expect(outcome.commissionAmount).toBe('95.000000');
		expect(outcome.netAmount).toBe('18.050000');
	});

	it('keeps every amount a whole number of minor units when the line’s own amounts are', () => {
		// "all five amounts are whole minor units" (MK-7): the commission and the seller's net carry
		// nothing below the currency's precision, so no column ever holds a fraction the currency cannot
		// represent and no residue appears between the two sides of the row.
		const outcome = service.compute(
			lineInput({ grossAmount: '33.33', taxAmount: '7.78', sellerDiscountAmount: '-1.11' }),
			resolved({ rate: '0.0777', basis: CommissionBasis.INCLUDING_TAX })
		);

		expect(outcome.basisAmount).toBe('40.000000');
		expect(outcome.commissionAmount).toBe('3.110000');
		expect(outcome.netAmount).toBe('36.890000');
		for (const amount of [outcome.commissionAmount, outcome.netAmount]) {
			expect(String(amount)).toMatch(/^-?\d+\.\d{2}0{4}$/);
		}
		// 40.000 × 0.0777 = 3.108 → 3.11, and the seller's net plus the platform's commission is the whole
		// captured amount with nothing lost between them (MK-7, MK-8).
		expect(
			Money.of(outcome.netAmount, EUR, DECIMALS).add(Money.of(outcome.commissionAmount, EUR, DECIMALS)).toStorageString()
		).toBe('40.000000');
	});

	it('normalises the rate to the storage scale, so `0.15` and `0.150000` are one value', () => {
		const outcome = service.compute(lineInput(), resolved({ rate: 0.15 as unknown as string }));

		expect(outcome.rate).toBe('0.150000');
	});
});

describe('SellerCommissionService — who funds a discount (doc 20 §4.1, §4.5, §11.3)', () => {
	it('never lets the platform’s own discount reduce the basis', () => {
		// "The platform chose to fund that discount and should not thereby reduce its own fee, and a basis
		// that moved with someone else's promotion would make a seller's commission unpredictable through
		// no act of its own" (§4.1).
		const withoutPlatformDiscount = service.compute(
			lineInput({ platformDiscountAmount: '0.00' }),
			resolved({ rate: '0.15', basis: CommissionBasis.DISCOUNTED_SUBTOTAL })
		);
		const withPlatformDiscount = service.compute(
			lineInput({ platformDiscountAmount: '-15.00' }),
			resolved({ rate: '0.15', basis: CommissionBasis.DISCOUNTED_SUBTOTAL })
		);

		expect(withPlatformDiscount.basisAmount).toBe(withoutPlatformDiscount.basisAmount);
		expect(withPlatformDiscount.commissionAmount).toBe(withoutPlatformDiscount.commissionAmount);
		// The seller's net is unchanged too: the platform paid for its own promotion.
		expect(withPlatformDiscount.netAmount).toBe(withoutPlatformDiscount.netAmount);
	});

	it('lets the seller’s own discount reduce the basis on the two bases that say so and not on the others', () => {
		const discounted = service.compute(lineInput(), resolved({ basis: CommissionBasis.DISCOUNTED_SUBTOTAL }));
		const list = service.compute(lineInput(), resolved({ basis: CommissionBasis.ITEM_SUBTOTAL }));
		const includingTax = service.compute(lineInput(), resolved({ basis: CommissionBasis.INCLUDING_TAX }));

		expect(discounted.basisAmount).toBe('95.000000');
		expect(list.basisAmount).toBe('100.000000');
		expect(includingTax.basisAmount).toBe('113.050000');
	});
});

describe('SellerCommissionService — the negative-net boundary (MK-23, doc 20 §11.4)', () => {
	it('refuses a sale whose commission would leave the seller with a negative net', () => {
		expect(() =>
			service.compute(
				lineInput({ grossAmount: '10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
				resolved({ rate: '0.15', basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '25.00' })
			)
		).toThrow(/does not allow a negative net/);
	});

	it('allows the same row when the seller’s policy permits a negative net', () => {
		const outcome = service.compute(
			lineInput({ grossAmount: '10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
			resolved({ rate: '0.15', basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '25.00' }),
			{ allowNegativeNet: true }
		);

		expect(outcome.commissionAmount).toBe('25.000000');
		expect(outcome.netAmount).toBe('-15.000000');
	});

	it('applies the rule to a sale and not to a reversal', () => {
		// "a sale never leaves a seller with a negative net unless the seller or the offering allows it"
		// (MK-23): a reversal is negative by construction, which is the whole point of one.
		const outcome = service.compute(
			lineInput({ grossAmount: '-10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
			resolved({ rate: '0.15', basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '25.00' }),
			{ isSale: false }
		);

		expect(outcome.netAmount).toBe('-35.000000');
	});

	it('treats a net of exactly zero as permitted', () => {
		// The boundary itself: a seller made exactly whole is not a seller left out of pocket.
		const outcome = service.compute(
			lineInput({ grossAmount: '10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00', quantity: '1' }),
			resolved({ basis: CommissionBasis.FIXED_PER_ITEM, fixedFeePerItem: '10.00', rate: '0' })
		);

		expect(outcome.netAmount).toBe('0.000000');
	});
});
