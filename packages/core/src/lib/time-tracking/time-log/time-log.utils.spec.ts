import { calculateBillableAmount } from './time-log.utils';

describe('calculateBillableAmount', () => {
	it('prices the duration at the hourly rate', () => {
		// 1.5 hours at 40
		expect(calculateBillableAmount(5400, 40)).toBe(60);
	});

	it('rounds the amount to cents', () => {
		// 1 hour 15 minutes at 12.50 is 15.625
		expect(calculateBillableAmount(4500, 12.5)).toBe(15.63);
		// 10 minutes at 10 is 1.666…
		expect(calculateBillableAmount(600, 10)).toBe(1.67);
	});

	it('rounds once, on the exact amount, so no cent is lost to floating point', () => {
		// Half an hour at 20.15 is exactly 10.075; a binary float holds it as 10.0749… and answered 10.07
		expect(calculateBillableAmount(1800, 20.15)).toBe(10.08);
		expect(calculateBillableAmount(1800, '20.15')).toBe(10.08);
		// A quarter of an hour at 8.54 is exactly 2.135, and at 33.98 exactly 8.495: both ties a float misses
		expect(calculateBillableAmount(900, 8.54)).toBe(2.14);
		expect(calculateBillableAmount(900, 33.98)).toBe(8.5);
		// Just under a tie stays below it: 21 minutes at 0.29 is 0.1015
		expect(calculateBillableAmount(1260, 0.29)).toBe(0.1);
	});

	it('prices a full week at a large rate without losing a cent', () => {
		// 168 hours at 9,999,999.99
		expect(calculateBillableAmount(604800, '9999999.99')).toBe(1679999998.32);
		// 168 hours at 2,147,483,647, the largest rate the API accepts
		expect(calculateBillableAmount(604800, 2147483647)).toBe(360777252696);
	});

	it("rounds to the currency's own minor unit", () => {
		// Half an hour at 1,501 yen is 750.5: yen has no minor unit
		expect(calculateBillableAmount(1800, 1501, 'JPY')).toBe(751);
		// 1,000 seconds at 7.25 dinars is 2.01388…: the Kuwaiti dinar has three decimals
		expect(calculateBillableAmount(1000, 7.25, 'KWD')).toBe(2.014);
		// A currency the platform does not list, or none, keeps two
		expect(calculateBillableAmount(1000, 7.25, 'EUR')).toBe(2.01);
		expect(calculateBillableAmount(1000, 7.25, null)).toBe(2.01);
	});

	it('reads a rate handed back as a numeric string', () => {
		expect(calculateBillableAmount(3600, '25.50')).toBe(25.5);
	});

	it('prices no time as zero when there is a rate', () => {
		expect(calculateBillableAmount(0, 30)).toBe(0);
		expect(calculateBillableAmount(undefined as unknown as number, 30)).toBe(0);
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['an empty string', ''],
		['zero', 0],
		['a negative rate', -5],
		['a non-numeric string', 'abc']
	])('answers null for %s, which is no rate to price at', (_label, rate) => {
		expect(calculateBillableAmount(3600, rate as number | string | null | undefined)).toBeNull();
	});
});
