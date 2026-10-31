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
