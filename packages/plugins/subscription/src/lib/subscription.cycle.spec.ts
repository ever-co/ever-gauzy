/**
 * `@gauzy/core` boots the whole application graph from its barrel, and the calendar and the
 * arithmetic of a subscription need none of it: the three names this module imports are taken from
 * their own source files, exactly as the service suites in this package do.
 */
jest.mock('@gauzy/core', () => ({
	Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
	divideDecimalUnits: jest.requireActual('@gauzy/core/src/lib/money/decimal').divideDecimalUnits,
	formatDecimalUnits: jest.requireActual('@gauzy/core/src/lib/money/decimal').formatDecimalUnits
}));

import { Money } from '@gauzy/core';
import { SubscriptionBillingPeriod } from './subscription.types';
import { addCalendarMonths, addDays, endOfPeriod, periodLengthMs, prorate, ratioOf, remainingMs } from './subscription.cycle';

/**
 * The calendar and the arithmetic a recurring subscription is billed by.
 *
 * Three properties are asserted, all of them ones the module states about itself:
 *
 * - **period arithmetic is calendar arithmetic**: a monthly subscription anchored on the 31st bills on
 *   the last day of a shorter month and returns to the 31st afterwards, rather than sliding backwards
 *   one month at a time;
 * - **the arithmetic is on UTC instants**, so a period that spans a daylight-saving boundary is the
 *   same length as one that does not and no customer is billed for an hour more or less than another;
 * - **the proration share is an exact decimal**, not a binary division rounded at the end, and the
 *   three amounts `prorate` answers with always satisfy `net = charge - credit`.
 *
 * There is no database, no service and no clock here: every case is a function of its arguments.
 */
describe('ratioOf — the share of a period that is left', () => {
	it('divides on the digits rather than on a double', () => {
		// The defect this pins: `part / whole` is binary floating point and `toFixed` rounds the *binary*
		// value. Ten days of thirty came out as `0.333333333333`, which is 3.33e-13 below the exact third
		// — and that share multiplies a recurring amount that may be six figures.
		const day = 24 * 60 * 60 * 1000;

		expect(ratioOf(10 * day, 30 * day)).toBe('0.333333333333');
		expect(ratioOf(20 * day, 30 * day)).toBe('0.666666666666');
		expect(ratioOf(1, 3)).toBe('0.333333333333');
		// Two thirds truncates rather than rounding up, so `a/c + b/c` never exceeds `(a+b)/c`: the two
		// halves of a proration can never sum to more than the whole they were taken from.
		expect(ratioOf(2, 3)).toBe('0.666666666666');
	});

	it('answers the exact fractions exactly', () => {
		expect(ratioOf(1, 2)).toBe('0.500000000000');
		expect(ratioOf(1, 4)).toBe('0.250000000000');
		expect(ratioOf(3, 3)).toBe('1.000000000000');
	});

	it('clamps into the period and refuses a whole that cannot be divided by', () => {
		expect(ratioOf(-5, 10)).toBe('0.000000000000');
		expect(ratioOf(50, 10)).toBe('1.000000000000');
		expect(ratioOf(1, 0)).toBe('0');
		expect(ratioOf(Number.NaN, 10)).toBe('0');
		expect(ratioOf(1, Number.POSITIVE_INFINITY)).toBe('0');
	});
});

describe('prorate — what a mid-cycle change is worth', () => {
	const period = { start: new Date('2026-03-01T00:00:00.000Z'), end: new Date('2026-04-01T00:00:00.000Z') };

	it('splits the remaining time between the plan being left and the one being taken up', () => {
		// Doc 11 §10.8's own worked example: 120.00 a month upgraded to 300.00 on 16 March.
		const { credit, charge, net } = prorate({
			oldRecurring: Money.of('120.000000', 'EUR'),
			newRecurring: Money.of('300.000000', 'EUR'),
			period,
			at: new Date('2026-03-16T00:00:00.000Z')
		});

		expect(credit.toStorageString()).toBe('61.940000');
		expect(charge.toStorageString()).toBe('154.840000');
		expect(net.toStorageString()).toBe('92.900000');
	});

	it('answers three values that balance, because the net is the difference of the two that rounded', () => {
		// `credit` and `charge` each cross exactly one boundary, and the net is their difference rather
		// than a third rounding of it — so a caller that posts all three to a ledger posts a balanced
		// triple whatever the amounts are.
		for (const [oldAmount, newAmount] of [
			['99.990000', '149.990000'],
			['0.010000', '0.030000'],
			['1234.560000', '0.990000'],
			['120.000000', '60.000000']
		]) {
			const { credit, charge, net } = prorate({
				oldRecurring: Money.of(oldAmount, 'EUR'),
				newRecurring: Money.of(newAmount, 'EUR'),
				period,
				at: new Date('2026-03-16T12:34:56.000Z')
			});

			expect(net.toStorageString()).toBe(charge.subtract(credit).toStorageString());
		}
	});

	it('is worth nothing once the period has run out', () => {
		const { credit, charge, net } = prorate({
			oldRecurring: Money.of('120.000000', 'EUR'),
			newRecurring: Money.of('300.000000', 'EUR'),
			period,
			at: new Date('2026-05-01T00:00:00.000Z')
		});

		expect(credit.toStorageString()).toBe('0.000000');
		expect(charge.toStorageString()).toBe('0.000000');
		expect(net.toStorageString()).toBe('0.000000');
	});
});

describe('the billing anchor across month ends and daylight saving', () => {
	it('keeps a month-end anchor rather than sliding it backwards', () => {
		// A subscription anchored on the 31st bills on the last day of a shorter month and RETURNS to the
		// 31st: clamping the day of the month each time, from the original anchor, is what makes January
		// 31 → February 28 → March 31 rather than → February 28 → March 28.
		const anchor = new Date('2026-01-31T09:00:00.000Z');

		expect(addCalendarMonths(anchor, 1).toISOString()).toBe('2026-02-28T09:00:00.000Z');
		expect(addCalendarMonths(anchor, 2).toISOString()).toBe('2026-03-31T09:00:00.000Z');
		expect(addCalendarMonths(anchor, 13).toISOString()).toBe('2027-02-28T09:00:00.000Z');
		// A leap February takes the 29th.
		expect(addCalendarMonths(new Date('2028-01-31T09:00:00.000Z'), 1).toISOString()).toBe(
			'2028-02-29T09:00:00.000Z'
		);
	});

	it('adds a year to 29 February without rolling into March', () => {
		expect(addCalendarMonths(new Date('2028-02-29T00:00:00.000Z'), 12).toISOString()).toBe(
			'2029-02-28T00:00:00.000Z'
		);
	});

	it('measures a period in UTC, so a daylight-saving boundary changes no length', () => {
		// Every instant here is UTC and every span is exact milliseconds, so the European clock change on
		// 29 March 2026 and the American one on 8 March are both invisible to the calendar. A monthly
		// period that contains one is exactly as long as the same month in a year that does not.
		const across = { start: new Date('2026-03-01T00:00:00.000Z'), end: new Date('2026-04-01T00:00:00.000Z') };
		const clear = { start: new Date('2026-05-01T00:00:00.000Z'), end: new Date('2026-06-01T00:00:00.000Z') };

		expect(periodLengthMs(across)).toBe(31 * 24 * 60 * 60 * 1000);
		expect(periodLengthMs(clear)).toBe(31 * 24 * 60 * 60 * 1000);
		expect(addDays(new Date('2026-03-28T23:00:00.000Z'), 1).toISOString()).toBe('2026-03-29T23:00:00.000Z');
	});

	it('computes the next period from the period start, never from the moment the job ran', () => {
		// A billing run that is six hours late produces the same next period as one that is on time, so
		// lateness never accumulates into a drifting calendar.
		const start = new Date('2026-01-31T00:00:00.000Z');
		const cadence = { period: SubscriptionBillingPeriod.MONTHLY, interval: 1 };

		expect(endOfPeriod(start, cadence).toISOString()).toBe('2026-02-28T00:00:00.000Z');
		expect(endOfPeriod(new Date('2026-02-28T00:00:00.000Z'), cadence).toISOString()).toBe(
			'2026-03-28T00:00:00.000Z'
		);
		// Weekly and daily add exact days, because a day is a day.
		expect(
			endOfPeriod(start, { period: SubscriptionBillingPeriod.WEEKLY, interval: 2 }).toISOString()
		).toBe('2026-02-14T00:00:00.000Z');
		expect(
			endOfPeriod(start, { period: SubscriptionBillingPeriod.DAILY, interval: 3 }).toISOString()
		).toBe('2026-02-03T00:00:00.000Z');
	});

	it('clamps the remaining time into the period it is measured against', () => {
		const period = { start: new Date('2026-03-01T00:00:00.000Z'), end: new Date('2026-04-01T00:00:00.000Z') };

		expect(remainingMs(period, new Date('2026-02-01T00:00:00.000Z'))).toBe(periodLengthMs(period));
		expect(remainingMs(period, new Date('2026-05-01T00:00:00.000Z'))).toBe(0);
		expect(remainingMs(period, new Date('2026-03-16T00:00:00.000Z'))).toBe(16 * 24 * 60 * 60 * 1000);
	});
});
