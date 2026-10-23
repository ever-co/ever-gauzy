import { DecimalString } from '@gauzy/contracts';
import { CurrencyPrecision, DEFAULT_CURRENCY_DECIMALS, currencyPrecision } from './currency-precision';

/**
 * How many decimal places a currency's amounts carry.
 *
 * The count decides where a value is presented and what a minor unit means, so it is the input to
 * every boundary in the money layer. The cases below pin the built-in table, the fallback for a
 * currency the platform has not been told about, the registration an installation performs at boot,
 * and the reading of an amount as whole minor units — which is where a value that is not a multiple
 * of the minor unit has to round rather than truncate.
 *
 * A control accompanies the minor-unit reading: the same conversion through a double is a cent
 * short on the canonical example.
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

describe('the currency precision table', () => {
	it('knows a currency whose minor unit is the currency itself', () => {
		expect(currencyPrecision.decimalsFor('JPY')).toBe(0);
		expect(currencyPrecision.decimalsFor('KRW')).toBe(0);
		expect(currencyPrecision.decimalsFor('VND')).toBe(0);
		expect(currencyPrecision.fromMinorUnits(1234n, 'JPY')).toBe('1234');
	});

	it('knows a currency divided into thousandths', () => {
		expect(currencyPrecision.decimalsFor('KWD')).toBe(3);
		expect(currencyPrecision.decimalsFor('BHD')).toBe(3);
		expect(currencyPrecision.fromMinorUnits(1234n, 'KWD')).toBe('1.234');
	});

	it('falls back to the ISO default for a currency it has not been told about', () => {
		expect(DEFAULT_CURRENCY_DECIMALS).toBe(2);
		expect(currencyPrecision.decimalsFor('USD')).toBe(2);
		expect(currencyPrecision.decimalsFor('ZZZ')).toBe(2);
		expect(currencyPrecision.decimalsFor('')).toBe(2);
		expect(currencyPrecision.decimalsFor(undefined as unknown as DecimalString)).toBe(2);

		// A code is read case-insensitively and trimmed, so a column that stored `usd ` still
		// resolves.
		expect(currencyPrecision.decimalsFor(' jpy ')).toBe(0);
	});

	it('reads an amount as whole minor units, rounding to the currency scale first', () => {
		expect(currencyPrecision.toMinorUnits('24.99', 'USD')).toBe(2499n);
		expect(currencyPrecision.toMinorUnits('1.005', 'USD')).toBe(101n);
		expect(currencyPrecision.toMinorUnits('1234.6', 'JPY')).toBe(1235n);

		// Control: the same conversion through a double loses the half-cent, because `1.005` is
		// stored just below it and `Math.round` resolves the half upward only by luck.
		expect(Math.round(Number('1.005') * 100)).toBe(100);
	});

	it('reads a value back at the currency scale', () => {
		expect(currencyPrecision.fromMinorUnits(2499n, 'USD')).toBe('24.99');
		expect(currencyPrecision.toCurrencyScale('24.999', 'USD')).toBe('25.00');
		expect(currencyPrecision.toCurrencyScale('24.994', 'USD')).toBe('24.99');
		expect(currencyPrecision.toCurrencyScale('24.999', 'JPY')).toBe('25');
	});

	it('answers whether a value carries more digits than the currency does', () => {
		expect(currencyPrecision.isAtCurrencyScale('1.5', 'USD')).toBe(true);
		expect(currencyPrecision.isAtCurrencyScale('1.50', 'USD')).toBe(true);
		expect(currencyPrecision.isAtCurrencyScale('1.005', 'USD')).toBe(false);
		expect(currencyPrecision.isAtCurrencyScale('1.5', 'JPY')).toBe(false);
		expect(currencyPrecision.isAtCurrencyScale('1.234', 'KWD')).toBe(true);

		// A number is never a monetary value, and an exponential form is not a decimal.
		expect(currencyPrecision.isAtCurrencyScale(1.5, 'USD')).toBe(false);
		expect(currencyPrecision.isAtCurrencyScale('1e-7', 'USD')).toBe(false);
		expect(currencyPrecision.isAtCurrencyScale(null, 'USD')).toBe(false);
	});
});

describe('registering a currency an installation defines', () => {
	it('overrides the built-in precision and is used by every later reading', () => {
		const precision = new CurrencyPrecision();

		expect(precision.register('BTC', 8)).toBe(precision);
		expect(precision.decimalsFor('btc')).toBe(8);
		expect(precision.toMinorUnits('1.00000001', 'BTC')).toBe(100000001n);
		expect(precision.fromMinorUnits(100000001n, 'BTC')).toBe('1.00000001');

		// A currency the table already knows can be restated by the installation.
		const overridden = new CurrencyPrecision({ USD: 4 });
		expect(overridden.decimalsFor('USD')).toBe(4);
		expect(currencyPrecision.decimalsFor('USD')).toBe(2);
	});

	it('refuses a precision the money layer cannot carry, and a code that is not one', () => {
		const precision = new CurrencyPrecision();

		expect(refusalOf(() => precision.register('USD', -1))).toMatch(/^MONEY_INVALID_CURRENCY_DECIMALS/);
		expect(refusalOf(() => precision.register('USD', 1.5))).toMatch(/^MONEY_INVALID_CURRENCY_DECIMALS/);
		expect(refusalOf(() => precision.register('USD', 13))).toMatch(/^MONEY_INVALID_CURRENCY_DECIMALS/);
		expect(refusalOf(() => precision.register('  ', 2))).toMatch(/^MONEY_INVALID_CURRENCY/);
		expect(refusalOf(() => new CurrencyPrecision({ USD: 13 }))).toMatch(/^MONEY_INVALID_CURRENCY_DECIMALS/);

		// A failed registration leaves the table as it was.
		expect(precision.decimalsFor('USD')).toBe(2);
	});
});
