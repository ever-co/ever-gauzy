import { MoneySymbolPosition } from '@gauzy/contracts';
import { Money } from './money';

/**
 * The monetary value.
 *
 * Money is the one type every amount on the platform is computed through, so the cases below assert
 * the properties the domain needs rather than the text the implementation happens to produce today:
 * an amount is an exact decimal and never a binary float, a cent can neither appear nor disappear,
 * two currencies are never combined, and a value that has not crossed a rounding boundary is refused
 * at the column boundary instead of being rounded behind the caller's back.
 *
 * Three cases carry a **control**: the naive or previously-broken behaviour is computed in the test
 * beside the assertion and shown to disagree with it, so the case cannot pass against the
 * implementation it exists to catch.
 */

/** The message of the error a call raises, or `undefined` when the call does not raise. */
function refusalOf(call: () => unknown): string | undefined {
	try {
		call();
		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('the monetary value', () => {
	it('is an exact decimal, so a tenth plus two tenths is three tenths', () => {
		expect(Money.of('0.1', 'USD').add(Money.of('0.2', 'USD')).amount).toBe('0.3');

		// Control: the same sum through binary floating point, which is what the value object exists
		// to keep out of the platform.
		expect(0.1 + 0.2).not.toBe(0.3);
		expect(String(0.1 + 0.2)).toBe('0.30000000000000004');
	});

	it('refuses a number that only a binary float could have produced', () => {
		expect(refusalOf(() => Money.of(0.1 + 0.2, 'USD'))).toMatch(/^MONEY_NOT_DECIMAL_STRING/);
		expect(refusalOf(() => Money.of(1e-7, 'USD'))).toMatch(/^MONEY_NOT_DECIMAL_STRING/);
		expect(refusalOf(() => Money.of(Number.NaN, 'USD'))).toMatch(/^MONEY_NOT_DECIMAL_STRING/);
		expect(refusalOf(() => Money.of(Number.POSITIVE_INFINITY, 'USD'))).toMatch(/^MONEY_NOT_DECIMAL_STRING/);

		// A number whose shortest round-trip form is already the exact decimal is accepted: a
		// quantity or a rate legitimately arrives as one.
		expect(Money.of(0.1, 'USD').amount).toBe('0.1');
		expect(Money.of(25, 'USD').amount).toBe('25');
		expect(Money.of(1499n, 'USD').amount).toBe('1499');
	});

	it('carries a large amount without losing its last minor unit', () => {
		const large = Money.of('99999999999999.99', 'USD');

		expect(large.amount).toBe('99999999999999.99');
		expect(large.toStorageString()).toBe('99999999999999.990000');
		expect(large.toMinorUnits()).toBe(9999999999999999n);
		expect(large.toDisplayString()).toBe('99,999,999,999,999.99');

		// Control: the same amount as a double is one minor unit short, which is the cent the ledger
		// would be out by if the value ever travelled as a number.
		expect(String(Number('99999999999999.99'))).toBe('99999999999999.98');
		expect(Math.round(Number('99999999999999.99') * 100)).toBe(9999999999999998);
	});

	it('refuses an amount wider than the column that stores it', () => {
		// A money column holds fourteen integer digits and six fractional ones.
		expect(refusalOf(() => Money.of('100000000000000', 'USD'))).toMatch(/^MONEY_NOT_DECIMAL_STRING/);
		expect(refusalOf(() => Money.of('1.0000000000001', 'USD'))).toMatch(/^MONEY_NOT_DECIMAL_STRING/);
		expect(Money.of('99999999999999.999999', 'USD').amount).toBe('99999999999999.999999');
	});

	it('refuses to write a value that has not crossed a rounding boundary', () => {
		// Handing this to the database would let it round, which hides the defect rather than
		// reporting it.
		expect(refusalOf(() => Money.of('1.0000001', 'USD').toStorageString())).toMatch(
			/^MONEY_NOT_ROUNDED_FOR_STORAGE/
		);

		// Control: the database's own rounding would silently drop a tenth of a cent.
		expect(Number('1.0000001').toFixed(6)).toBe('1.000000');
	});

	it('refuses a minor-unit reading of a value that is not at the currency scale', () => {
		expect(refusalOf(() => Money.of('1.005', 'USD').toMinorUnits())).toMatch(/^MONEY_SCALE_LOSS/);

		// Once the value has crossed its boundary, the reading is exact.
		expect(Money.of('1.005', 'USD').round().toMinorUnits()).toBe(101n);
	});

	it('refuses to combine two currencies rather than coercing one of them', () => {
		const dollars = Money.of('10', 'USD');
		const euros = Money.of('10', 'EUR');

		expect(refusalOf(() => dollars.add(euros))).toMatch(/^MONEY_CURRENCY_MISMATCH/);
		expect(refusalOf(() => dollars.subtract(euros))).toMatch(/^MONEY_CURRENCY_MISMATCH/);
		expect(refusalOf(() => dollars.compare(euros))).toMatch(/^MONEY_CURRENCY_MISMATCH/);
		expect(refusalOf(() => dollars.allocateBy([euros]))).toMatch(/^MONEY_CURRENCY_MISMATCH/);
		expect(refusalOf(() => Money.sum([dollars, euros], 'USD'))).toMatch(/^MONEY_CURRENCY_MISMATCH/);
		expect(
			refusalOf(() => dollars.add({ amount: '10', currency: 'USD', decimals: 2 } as unknown as Money))
		).toMatch(/^MONEY_INVALID_OPERAND/);

		expect(dollars.isSameCurrency(euros)).toBe(false);
		expect(dollars.equals(euros)).toBe(false);
		expect(dollars.equals(Money.of('10.00', 'USD'))).toBe(true);
	});

	it('normalises the currency code and reads the currency table for its scale', () => {
		expect(Money.of('1', ' usd ').currency).toBe('USD');
		expect(Money.of('1', 'usd').decimals).toBe(2);

		// A currency whose minor unit is the currency itself, and one divided into thousandths.
		expect(Money.of('1', 'JPY').decimals).toBe(0);
		expect(Money.of('1', 'KWD').decimals).toBe(3);

		// A currency the platform has not been told about falls back to the ISO default.
		expect(Money.of('1', 'ZZZ').decimals).toBe(2);

		expect(refusalOf(() => Money.of('1', ''))).toMatch(/^MONEY_INVALID_CURRENCY/);
		expect(refusalOf(() => Money.of('1', 'USD', 13))).toMatch(/^MONEY_INVALID_SCALE/);
		expect(refusalOf(() => Money.of('1', 'USD', -1))).toMatch(/^MONEY_INVALID_SCALE/);
	});

	it('never produces a negative zero', () => {
		const zero = Money.of('-0.00', 'USD');

		expect(zero.amount).toBe('0');
		expect(zero.isNegative()).toBe(false);
		expect(zero.isZero()).toBe(true);
		expect(Money.zero('USD').negate().amount).toBe('0');
		expect(Money.of('0', 'USD').subtract(Money.of('0', 'USD')).amount).toBe('0');
	});

	it('keeps the sign of a difference instead of clamping it', () => {
		const difference = Money.of('10', 'USD').subtract(Money.of('25', 'USD'));

		// The caller decides what an excess means; a value that clamped itself to zero could not
		// report it.
		expect(difference.amount).toBe('-15');
		expect(difference.isNegative()).toBe(true);
		expect(difference.abs().amount).toBe('15');
		expect(difference.negate().amount).toBe('15');
		expect(Money.of('-10', 'USD').negate().amount).toBe('10');
	});

	it('renders a value at the currency scale, with grouping and an optional symbol', () => {
		const value = Money.of('1234567.891', 'USD');

		expect(value.toDisplayString()).toBe('1,234,567.89');
		expect(value.toDisplayString({ grouping: false })).toBe('1234567.89');
		expect(value.toDisplayString({ withSymbol: true, symbol: '$' })).toBe('$ 1,234,567.89');
		expect(value.toDisplayString({ withSymbol: true, symbol: 'USD', symbolPosition: MoneySymbolPosition.SUFFIX })).toBe(
			'1,234,567.89 USD'
		);
		expect(
			value.toDisplayString({
				withSymbol: true,
				symbol: 'USD',
				symbolPosition: MoneySymbolPosition.SUFFIX,
				spaceBetweenSymbolAndAmount: false
			})
		).toBe('1,234,567.89USD');
		expect(Money.of('-1234.5', 'USD').toDisplayString()).toBe('-1,234.50');
		expect(Money.of('0.05', 'USD').toDisplayString()).toBe('0.05');

		// A zero-decimal currency shows no invented fraction.
		expect(Money.of('1234', 'JPY').toDisplayString()).toBe('1,234');
		expect(Money.of('1234.5', 'JPY').toDisplayString()).toBe('1,235');
	});

	it('reads a stored value from either the column text or the number the transformer parsed', () => {
		expect(Money.fromStorage(null, 'USD').amount).toBe('0');
		expect(Money.fromStorage(undefined, 'USD').amount).toBe('0');
		expect(Money.fromStorage('', 'USD').amount).toBe('0');
		expect(Money.fromStorage('12.345678', 'USD').amount).toBe('12.345678');
		expect(Money.fromStorage(12.5, 'USD').amount).toBe('12.5');
		expect(Money.fromStorage(0n, 'USD').amount).toBe('0');

		// A null column is zero *in the owner's currency*, not in a currency of its own.
		expect(Money.fromStorage(null, 'JPY').currency).toBe('JPY');
		expect(Money.fromStorage(null, 'JPY').decimals).toBe(0);
	});

	it('sums, compares and bounds a set of values exactly', () => {
		expect(Money.sum([], 'USD').amount).toBe('0');
		expect(Money.sum([Money.of('0.1', 'USD'), Money.of('0.2', 'USD'), Money.of('-0.05', 'USD')], 'USD').amount).toBe(
			'0.25'
		);

		expect(Money.min(Money.of('1', 'USD'), Money.of('2', 'USD')).amount).toBe('1');
		expect(Money.max(Money.of('1', 'USD'), Money.of('2', 'USD')).amount).toBe('2');
		expect(Money.of('1', 'USD').lessThan(Money.of('2', 'USD'))).toBe(true);
		expect(Money.of('2', 'USD').greaterThanOrEqual(Money.of('2', 'USD'))).toBe(true);
		expect(Money.of('1', 'USD').compareToZero()).toBe(1);
		expect(Money.of('-1', 'USD').compareToZero()).toBe(-1);
		expect(Money.of('0', 'USD').isPositive()).toBe(false);
	});

	it('serialises without inventing a scale or a currency', () => {
		const value = Money.of('1.50', 'USD');

		expect(value.toJSON()).toEqual({ amount: '1.5', currency: 'USD', decimals: 2 });
		expect(value.toString()).toBe('1.5 USD');
		expect(JSON.stringify(value)).toBe('{"amount":"1.5","currency":"USD","decimals":2}');
		expect(Money.of('1', 'JPY').toString()).toBe('1 JPY');
	});
});
