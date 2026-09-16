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

	it('does not round when no scale is configured', () => {
		expect(new ColumnNumericTransformerPipe().to(10.499)).toBe(10.499);
	});
});
