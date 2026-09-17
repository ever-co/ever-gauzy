import { DecimalString, RoundingMode } from '@gauzy/contracts';
import { Money } from './money';
import {
	DEFAULT_ROUNDING_STRATEGY_KEY,
	HalfUpRoundingStrategy,
	RoundingStrategy,
	RoundingStrategyRegistry,
	roundingStrategies
} from './rounding';

/**
 * The single rounding contract, and the only permitted way to split a whole into parts.
 *
 * Rounding is a boundary decision: an intermediate value carries the full working scale and only
 * crosses a boundary where the specification names one. The cases below pin the rule at each of
 * those boundaries — the half, the sign of a half, the regime that forbids implicit rounding, the
 * cash-rounding increment — and then pin the allocation algorithm, whose entire purpose is that the
 * parts sum back to the whole *exactly*.
 *
 * The controls compute the naive rule beside the mandated one. A rounding suite without them would
 * pass against `Math.round`, which is the thing it exists to keep out.
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

/** The sum of allocated parts, as an exact decimal. */
function sumOf(parts: readonly Money[]): Money {
	return parts.reduce((total, part) => total.add(part), Money.zero('USD'));
}

describe('the rounding rule', () => {
	it('rounds an exact half away from zero, whatever the sign', () => {
		expect(Money.of('1.005', 'USD').round().amount).toBe('1.01');
		expect(Money.of('2.5', 'USD').round(RoundingMode.HALF_UP, 0).amount).toBe('3');
		expect(Money.of('-1.005', 'USD').round().amount).toBe('-1.01');
		expect(Money.of('-2.5', 'USD').round(RoundingMode.HALF_UP, 0).amount).toBe('-3');

		// Control: the two ways this boundary is usually got wrong. A double holds `1.005` just below
		// the half, and `Math.round` resolves a negative half toward positive infinity.
		expect((1.005).toFixed(2)).toBe('1.00');
		expect(Math.round(-2.5)).toBe(-2);
		expect(Math.round(2.5)).toBe(3);
	});

	it('rounds to the even neighbour on a tie only when the regime asks for it', () => {
		expect(Money.of('2.5', 'USD').round(RoundingMode.HALF_EVEN, 0).amount).toBe('2');
		expect(Money.of('3.5', 'USD').round(RoundingMode.HALF_EVEN, 0).amount).toBe('4');
		expect(Money.of('-2.5', 'USD').round(RoundingMode.HALF_EVEN, 0).amount).toBe('-2');

		// The default is not half-even, so the same input keeps the customer's cent.
		expect(Money.of('2.5', 'USD').round(RoundingMode.HALF_UP, 0).amount).toBe('3');
	});

	it('rounds up and down by magnitude rather than by sign', () => {
		// "Down" means toward zero, which is not what `Math.floor` does to a negative value.
		expect(Money.of('-1.5', 'USD').floor(0).amount).toBe('-1');
		expect(Money.of('1.5', 'USD').floor(0).amount).toBe('1');
		expect(Money.of('-1.5', 'USD').ceil(0).amount).toBe('-2');
		expect(Money.of('1.5', 'USD').ceil(0).amount).toBe('2');
		expect(Money.of('1.004', 'USD').ceil().amount).toBe('1.01');

		// Control: the two JavaScript built-ins a value object must not be built on.
		expect(Math.floor(-1.5)).toBe(-2);
		expect(Math.ceil(-1.5)).toBe(-1);
	});

	it('refuses to round at all under a regime that forbids implicit rounding', () => {
		expect(refusalOf(() => Money.of('1.005', 'USD').round(RoundingMode.NONE))).toMatch(/^ROUNDING_REQUIRED/);

		// A value that is already exact at the target scale is not a rounding.
		expect(Money.of('1.5', 'USD').round(RoundingMode.NONE).amount).toBe('1.5');
		expect(Money.of('10', 'JPY').round(RoundingMode.NONE).amount).toBe('10');
	});

	it('leaves an already-rounded value alone', () => {
		const once = Money.of('1.005', 'USD').round();

		expect(once.round().amount).toBe(once.amount);
		expect(once.round().amount).toBe('1.01');
		expect(Money.of('10', 'JPY').round().round().amount).toBe('10');
		expect(refusalOf(() => Money.of('1.01', 'USD').round(RoundingMode.NONE))).toBeUndefined();
	});

	it('keeps an intermediate value at the working scale until a boundary is asked for', () => {
		// Three units of a third of a cent do not make a cent until the caller says so.
		expect(Money.of('0.333333', 'USD').multiply('3').amount).toBe('0.999999');
		expect(Money.of('0.333333', 'USD').multiply('3').round().amount).toBe('1');

		// Control: rounding each unit, or formatting the product, invents a cent that is not there.
		expect(Number((0.333333 * 3).toFixed(2))).toBe(1);

		expect(Money.of('10', 'USD').divide('3', { scale: 12 }).amount).toBe('3.333333333333');
		// Left to itself a quotient carries the working scale; the currency scale is the caller's
		// decision, taken where the value is stored or shown.
		expect(Money.of('10', 'USD').divide('3').amount).toBe('3.333333333333');
		expect(Money.of('10', 'USD').divide('3', { scale: 2 }).amount).toBe('3.33');
		expect(Money.of('10', 'USD').divide('3').round().amount).toBe('3.33');
		expect(refusalOf(() => Money.of('10', 'USD').divide(0))).toMatch(/^MONEY_DIVISION_BY_ZERO/);
		expect(refusalOf(() => Money.of('10', 'USD').divide('0.00'))).toMatch(/^MONEY_DIVISION_BY_ZERO/);
	});

	it('refuses a scale the money layer cannot carry', () => {
		expect(refusalOf(() => Money.of('1', 'USD').round(RoundingMode.HALF_UP, 13))).toMatch(/^MONEY_INVALID_SCALE/);
		expect(refusalOf(() => Money.of('1', 'USD').multiply('1', { scale: 13 }))).toMatch(/^MONEY_INVALID_SCALE/);
		expect(Money.of('1', 'USD').round(RoundingMode.HALF_UP, 12).amount).toBe('1');
	});
});

describe('cash rounding to an increment', () => {
	it('quantises the amount a customer pays and reports the correction to record', () => {
		const { rounded, difference } = Money.of('508.64', 'USD').roundToIncrement('0.05');

		expect(rounded.amount).toBe('508.65');
		expect(difference.amount).toBe('0.01');

		// The correction is what makes the paid total reach the grand total; without it the order
		// could never settle. It is also the only adjustment whose sign is free.
		expect(Money.of('508.64', 'USD').add(difference).amount).toBe(rounded.amount);

		const down = Money.of('508.62', 'USD').roundToIncrement('0.05');
		expect(down.rounded.toStorageString()).toBe('508.600000');
		expect(down.difference.amount).toBe('-0.02');
	});

	it('never corrects by more than half an increment, and always lands on one', () => {
		for (let cents = 0; cents < 100; cents += 1) {
			const amount = Money.of(`508.${String(cents).padStart(2, '0')}`, 'USD');
			const { rounded, difference } = amount.roundToIncrement('0.05');

			expect(rounded.toMinorUnits() % 5n).toBe(0n);
			expect(Number(difference.abs().toMinorUnits())).toBeLessThanOrEqual(2);
			expect(amount.add(difference).toStorageString()).toBe(rounded.toStorageString());
		}
	});

	it('refuses an increment that would make the quantisation meaningless', () => {
		expect(refusalOf(() => Money.of('1', 'USD').roundToIncrement('0'))).toMatch(
			/^MONEY_ROUNDING_INCREMENT_ZERO/
		);
		expect(refusalOf(() => Money.of('1', 'USD').roundToIncrement('0.00'))).toMatch(
			/^MONEY_ROUNDING_INCREMENT_ZERO/
		);
	});
});

describe('splitting a whole across weights', () => {
	it('gives every part a whole number of minor units that sum back to the whole', () => {
		// The worked example of the allocation algorithm: an order-level discount of 10.00 across
		// three lines whose discountable amounts are 19.99, 29.99 and 49.99.
		const parts = Money.of('10', 'USD').allocate(['19.99', '29.99', '49.99']);

		expect(parts.map((part) => part.amount)).toEqual(['2.00', '3.00', '5.00']);
		expect(sumOf(parts).toStorageString()).toBe('10.000000');
		expect(Money.of('10', 'USD').allocateBy([Money.of('19.99', 'USD'), Money.of('29.99', 'USD'), Money.of('49.99', 'USD')]).map(
			(part) => part.amount
		)).toEqual(['2.00', '3.00', '5.00']);
	});

	it('sums back to the whole for every amount and every weight', () => {
		// The property the algorithm exists for. Nothing here asserts *which* part receives a spare
		// minor unit — only that the spare lands somewhere and nowhere else.
		for (let cents = 1; cents <= 25; cents += 1) {
			const whole = Money.of(`0.${String(cents).padStart(2, '0')}`, 'USD');

			for (const weights of [['1', '1', '1'], ['1', '2', '3'], ['7', '11'], ['0.10', '0.20', '0.70']]) {
				const parts = whole.allocate(weights);
				const totalWeight = weights.reduce((sum, weight) => sum + Number(weight), 0);

				expect(parts).toHaveLength(weights.length);
				expect(sumOf(parts).toStorageString()).toBe(whole.toStorageString());

				// And every part is a whole number of minor units within one of its exact share, so no
				// part can drift: the remainder moved the parts by less than the smallest unit.
				weights.forEach((weight, index) => {
					const exactShare = (Number(whole.amount) * Number(weight)) / totalWeight;

					expect(parts[index].isNegative()).toBe(false);
					expect(Math.abs(Number(parts[index].amount) - exactShare)).toBeLessThan(0.01);
				});
			}
		}
	});

	it('hands the spare minor unit to the largest remainder, deterministically', () => {
		const parts = Money.of('100', 'USD').allocate(['1', '1', '1']);

		expect(parts.map((part) => part.amount)).toEqual(['33.34', '33.33', '33.33']);
		// The same input produces the same ledger on every run, which is what makes a stored
		// allocation reproducible.
		expect(Money.of('100', 'USD').allocate(['1', '1', '1']).map((part) => part.amount)).toEqual(
			parts.map((part) => part.amount)
		);
	});

	it('never creates or loses a minor unit that no weight can hold', () => {
		// Five cents across three equal shares: no exact part exists, and the whole still has to be
		// handed out.
		const parts = Money.of('0.05', 'USD').allocate(['1', '1', '1']);

		expect(parts.map((part) => part.amount)).toEqual(['0.02', '0.02', '0.01']);
		expect(sumOf(parts).toStorageString()).toBe('0.050000');

		// Control: splitting each exact share independently both creates and loses money — rounding
		// each share gives 0.06, and flooring each share gives 0.03.
		const exactShare = 0.05 / 3;
		expect(Number((exactShare).toFixed(2)) * 3).toBeCloseTo(0.06, 10);
		expect(Math.floor(exactShare * 100) / 100 * 3).toBeCloseTo(0.03, 10);
	});

	it('distributes equally when the caller supplies no weight at all', () => {
		// An amount that has to be distributed cannot vanish because the weights were empty.
		const equal = Money.of('10', 'USD').allocate(['0', '0', '0']);

		expect(equal.map((part) => part.amount)).toEqual(['3.34', '3.33', '3.33']);
		expect(sumOf(equal).toStorageString()).toBe('10.000000');
		expect(Money.of('10', 'USD').allocate([])).toEqual([]);
	});

	it('refuses a negative weight', () => {
		expect(refusalOf(() => Money.of('10', 'USD').allocate(['1', '-1']))).toMatch(
			/^MONEY_ALLOCATION_WEIGHT_NEGATIVE/
		);
	});

	it('preserves the sign of the whole and never produces a negative zero', () => {
		const parts = Money.of('-10', 'USD').allocate(['19.99', '29.99', '49.99']);

		expect(parts.map((part) => part.amount)).toEqual(['-2.00', '-3.00', '-5.00']);
		expect(sumOf(parts).toStorageString()).toBe('-10.000000');
		expect(parts.some((part) => part.isNegative() && part.isZero())).toBe(false);

		// A whole smaller than one minor unit cannot produce a part that is negative zero.
		const subCent = Money.of('-0.01', 'USD').allocate(['1', '1', '1']);
		expect(subCent.map((part) => part.amount)).toEqual(['-0.01', '0.00', '0.00']);
		expect(sumOf(subCent).toStorageString()).toBe('-0.010000');
		expect(subCent.filter((part) => part.isZero()).every((part) => !part.isNegative())).toBe(true);
	});

	it('allocates an amount that is not exact at the parts scale by rounding it once', () => {
		const parts = Money.of('10.005', 'USD').allocate(['1', '1']);

		expect(sumOf(parts).toStorageString()).toBe('10.010000');
		expect(parts.map((part) => part.amount)).toEqual(['5.01', '5.00']);
	});
});

describe('the rounding strategy registry', () => {
	const fixed: RoundingStrategy = {
		key: 'spec-fixed',
		round: (): DecimalString => '7.77',
		allocate: (amount: DecimalString, weights: readonly DecimalString[]): DecimalString[] =>
			weights.map(() => amount),
		roundToIncrement: (amount: DecimalString) => ({ rounded: amount, difference: '0' })
	};

	afterEach(() => {
		// The registry is installation-wide, so a case that switches it has to put it back.
		roundingStrategies.use(DEFAULT_ROUNDING_STRATEGY_KEY);
	});

	it('routes every boundary of a value through the active strategy', () => {
		roundingStrategies.register(fixed);
		roundingStrategies.use('spec-fixed');

		// Control: a value object that rounded through its own hard-coded policy would return 1.01 /
		// 5.00 here and silently ignore the installation's regime.
		expect(Money.of('1.005', 'USD').round().amount).toBe('7.77');
		expect(Money.of('10', 'USD').allocate(['1', '1']).map((part) => part.amount)).toEqual(['10', '10']);
	});

	it('resolves the strategy a key names and refuses a key that is not registered', () => {
		const registry = new RoundingStrategyRegistry();

		expect(registry.keys).toEqual([DEFAULT_ROUNDING_STRATEGY_KEY]);
		expect(registry.active.key).toBe(DEFAULT_ROUNDING_STRATEGY_KEY);
		expect(registry.resolve() instanceof HalfUpRoundingStrategy).toBe(true);
		expect(refusalOf(() => registry.use('nope'))).toMatch(/^MONEY_UNKNOWN_ROUNDING_STRATEGY/);
		expect(refusalOf(() => registry.resolve('nope'))).toMatch(/^MONEY_UNKNOWN_ROUNDING_STRATEGY/);
		expect(refusalOf(() => registry.register({ key: '' } as unknown as RoundingStrategy))).toMatch(
			/^MONEY_INVALID_ROUNDING_STRATEGY/
		);

		// Registering an existing key replaces it: the installation has the last word.
		registry.register(fixed);
		registry.use('spec-fixed');
		expect(registry.active.key).toBe('spec-fixed');
	});

	it('rounds half-up by default on a registry that was given another strategy first', () => {
		const registry = new RoundingStrategyRegistry([fixed, new HalfUpRoundingStrategy()]);

		expect(registry.active.key).toBe(DEFAULT_ROUNDING_STRATEGY_KEY);
		expect(registry.active.round('1.005', 2, RoundingMode.HALF_UP)).toBe('1.01');

		const onlyCustom = new RoundingStrategyRegistry([fixed]);
		expect(onlyCustom.active.key).toBe('spec-fixed');
	});
});
