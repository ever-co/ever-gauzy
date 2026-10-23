import { DecimalString, RoundingMode } from '@gauzy/contracts';
import { Money } from './money';
import { MoneyService } from './money.service';
import { DEFAULT_ROUNDING_STRATEGY_KEY, RoundingStrategy, roundingStrategies } from './rounding';

/**
 * The injectable face of the money layer.
 *
 * The value object itself needs no container; the service exists for the two decisions that are
 * configuration rather than arithmetic — which rounding strategy is active, and how many decimal
 * places a currency carries. Both are installation-wide, and the cases below assert exactly that:
 * a strategy selected through the service governs every value the platform constructs, not only the
 * ones the service produced, and a currency registered through it is read by a value constructed
 * afterwards.
 *
 * A control accompanies the first case: a service that kept its own registry would leave the value
 * object rounding through the default and the installation's regime would silently not apply.
 */

/** A strategy whose answer is unmistakable, so it is obvious which one a value went through. */
const fixed: RoundingStrategy = {
	key: 'spec-fixed',
	round: (): DecimalString => '7.77',
	allocate: (amount: DecimalString, weights: readonly DecimalString[]): DecimalString[] =>
		weights.map(() => amount),
	roundToIncrement: (amount: DecimalString) => ({ rounded: amount, difference: '0' })
};

/** The message of the error a call raises, or `undefined` when the call does not raise. */
function refusalOf(call: () => unknown): string | undefined {
	try {
		call();
		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

afterEach(() => {
	// The registry and the precision table are installation-wide, so a case that changed them has to
	// put the default back for the cases after it.
	roundingStrategies.use(DEFAULT_ROUNDING_STRATEGY_KEY);
});

describe('MoneyService', () => {
	it('selects the rounding strategy every value rounds through', () => {
		const service = new MoneyService();

		expect(service.roundingStrategy.key).toBe(DEFAULT_ROUNDING_STRATEGY_KEY);
		expect(service.round('1.005', 'USD').amount).toBe('1.01');

		service.registerRoundingStrategy(fixed);
		service.useRoundingStrategy('spec-fixed');

		// Control: a strategy held by the service alone would leave this at 1.01.
		expect(service.roundingStrategy.key).toBe('spec-fixed');
		expect(service.round('1.005', 'USD').amount).toBe('7.77');
		expect(Money.of('1.005', 'USD').round().amount).toBe('7.77');
		expect(service.strategies.keys).toContain('spec-fixed');
		expect(refusalOf(() => service.useRoundingStrategy('nope'))).toMatch(/^MONEY_UNKNOWN_ROUNDING_STRATEGY/);
	});

	it('registers the decimal places a currency carries, for every value built afterwards', () => {
		const service = new MoneyService();

		expect(service.decimalsFor('JPY')).toBe(0);
		expect(service.decimalsFor('USD')).toBe(2);
		expect(service.of('1.00', 'USD').decimals).toBe(2);

		service.registerCurrencyPrecision('XAU', 6);

		expect(service.decimalsFor('XAU')).toBe(6);
		expect(service.of('1.000001', 'XAU').decimals).toBe(6);
		expect(service.precision.toCurrencyScale('1.0000005', 'XAU')).toBe('1.000001');
		expect(refusalOf(() => service.registerCurrencyPrecision('XAU', 13))).toMatch(
			/^MONEY_INVALID_CURRENCY_DECIMALS/
		);
	});

	it('mirrors the value object rather than computing anything of its own', () => {
		const service = new MoneyService();

		expect(service.zero('USD').amount).toBe(Money.zero('USD').amount);
		expect(service.fromStorage(null, 'USD').amount).toBe('0');
		expect(service.fromStorage('12.345678', 'USD').amount).toBe('12.345678');
		expect(service.sum([service.of('0.1', 'USD'), service.of('0.2', 'USD')], 'USD').amount).toBe('0.3');
		expect(service.allocate('10', 'USD', ['19.99', '29.99', '49.99']).map((part) => part.amount)).toEqual([
			'2.00',
			'3.00',
			'5.00'
		]);
		expect(service.compare('10', '9.999999', 'USD')).toBe(1);
		expect(service.format(service.of('1234.5', 'USD'), { withSymbol: true, symbol: '$' })).toBe('$ 1,234.50');
		expect(service.round('1.005', 'USD', RoundingMode.HALF_UP).amount).toBe('1.01');
		expect(refusalOf(() => service.round('1.005', 'USD', RoundingMode.NONE))).toMatch(/^ROUNDING_REQUIRED/);
	});
});
