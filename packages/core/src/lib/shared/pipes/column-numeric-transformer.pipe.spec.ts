import { BadRequestException } from '@nestjs/common';
import { ColumnNumericTransformerPipe, roundToScale } from './column-numeric-transformer.pipe';

describe('roundToScale', () => {
	it('keeps two decimal places', () => {
		expect(roundToScale('10.49')).toBe(10.49);
	});

	it('rounds 10.499 to 10.5', () => {
		expect(roundToScale(10.499)).toBe(10.5);
	});

	it('rounds half-cents up (1.005 → 1.01), unlike Number#toFixed', () => {
		expect((1.005).toFixed(2)).toBe('1.00');
		expect(roundToScale(1.005)).toBe(1.01);
	});

	it('does not return NaN for exponent-notation input', () => {
		expect(roundToScale(1e-7)).toBe(0);
	});

	it('rounds negative half-cents away from zero, as Postgres numeric and MySQL decimal do', () => {
		expect(roundToScale(-1.005)).toBe(-1.01);
		expect(roundToScale(-2.675)).toBe(-2.68);
		expect(Object.is(roundToScale(-0.001), 0)).toBe(true);
	});

	it('returns NaN instead of a made-up 0 for non-numeric input', () => {
		expect(roundToScale('abc')).toBeNaN();
		expect(roundToScale(Infinity)).toBeNaN();
	});

	it('leaves doubles too large to hold cents unchanged instead of drifting or overflowing', () => {
		expect(roundToScale(1e21)).toBe(1e21);
		expect(roundToScale(Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
		expect(roundToScale(999999999999.99)).toBe(999999999999.99);
	});
});

describe('ColumnNumericTransformerPipe scale-aware persistence', () => {
	const money = new ColumnNumericTransformerPipe(2);

	it('rounds 10.499 to two decimals before SQLite REAL storage', () => {
		expect(money.to(10.499)).toBe(10.5);
	});

	it('rounds 1.005 to 1.01 on write', () => {
		expect(money.to(1.005)).toBe(1.01);
	});

	it('leaves null unset', () => {
		expect(money.to(null as unknown as number)).toBeNull();
	});

	it('parses numeric strings the way the DTO transform does', () => {
		expect(money.to('10.49' as unknown as number)).toBe(10.49);
		expect(money.to('12abc' as unknown as number)).toBe(12);
	});

	it.each(['abc', '', 'Infinity', true, {}, [], NaN])(
		'refuses %p instead of storing 0 (routes that skip DTO validation)',
		(value) => {
			expect(() => money.to(value as unknown as number)).toThrow(BadRequestException);
		}
	);

	it('does not round when no scale is configured', () => {
		expect(new ColumnNumericTransformerPipe().to(10.499)).toBe(10.499);
	});
});
