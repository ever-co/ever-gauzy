import { DecimalString, RoundingMode } from '@gauzy/contracts';
import { formatDecimalUnits, parseDecimalString, pow10, toUnitsAtScale, WORKING_SCALE } from './decimal';

/**
 * The single rounding contract of the platform.
 *
 * Rounding is a boundary decision, not an arithmetic one: an intermediate value carries the full
 * working scale and only crosses a boundary at a place the specification names. Routing every
 * boundary through one strategy is what makes a total reproducible — two runs over the same inputs
 * produce the same stored value, and a tenant under a different accounting regime swaps the strategy
 * without any service knowing.
 */

/** Key of the strategy an installation gets until it registers another one. */
export const DEFAULT_ROUNDING_STRATEGY_KEY = 'default';

/**
 * The outcome of quantising an amount to a multiple of a rounding increment.
 */
export interface IRoundedIncrement {
	/** The amount, quantised to a whole number of increments. */
	rounded: DecimalString;

	/** `rounded - amount`, the correction the caller records as a rounding adjustment. */
	difference: DecimalString;
}

/**
 * How an amount that is not exact at a target scale is resolved.
 *
 * The same three operations are needed everywhere: round one amount, split a whole into parts that
 * sum back to it, and quantise to an increment. They live on one interface so that a replacement
 * implementation cannot be correct at one boundary and wrong at another.
 */
export interface RoundingStrategy {
	/** Stable key a tenant selects the strategy by. */
	readonly key: string;

	/**
	 * @param amount The value to round.
	 * @param decimals The scale to round to.
	 * @param mode How a value that is not exact at that scale is resolved.
	 * @returns The rounded value.
	 */
	round(amount: DecimalString, decimals: number, mode: RoundingMode): DecimalString;

	/**
	 * Splits a whole across weights so that the parts sum back to the whole exactly.
	 *
	 * @param amount The whole being split.
	 * @param weights The shares, non-negative.
	 * @param decimals The scale of the parts.
	 * @param mode How the whole itself is resolved when it is not exact at that scale.
	 * @returns One part per weight, each a whole number of minor units.
	 */
	allocate(
		amount: DecimalString,
		weights: readonly DecimalString[],
		decimals: number,
		mode: RoundingMode
	): DecimalString[];

	/**
	 * @param amount The amount to quantise.
	 * @param increment The step to quantise to, for example a cash-rounding increment of `0.05`.
	 * @param decimals The currency scale.
	 * @param mode How a value that falls between two increments is resolved.
	 * @returns The quantised amount and the difference the caller has to record.
	 */
	roundToIncrement(
		amount: DecimalString,
		increment: DecimalString,
		decimals: number,
		mode: RoundingMode
	): IRoundedIncrement;
}

/**
 * Asserts a usable scale.
 *
 * @param decimals The scale to check.
 */
function assertScale(decimals: number): void {
	if (!Number.isInteger(decimals) || decimals < 0 || decimals > WORKING_SCALE) {
		throw new Error(`MONEY_INVALID_SCALE: ${decimals} is not a scale between 0 and ${WORKING_SCALE}.`);
	}
}

/**
 * The platform's default rounding: half away from zero, and the largest-remainder allocation.
 *
 * Half-up is the default because it is what a person checking the arithmetic by hand reproduces;
 * `HALF_EVEN` exists for the regimes that require it and `NONE` for the regimes that forbid any
 * implicit rounding at all.
 */
export class HalfUpRoundingStrategy implements RoundingStrategy {
	readonly key = DEFAULT_ROUNDING_STRATEGY_KEY;

	/**
	 * Rounds a value to a scale.
	 *
	 * The value is handled by magnitude and the sign is re-applied, so "up" always means "away from
	 * zero" and no path can produce a negative zero.
	 *
	 * @param amount The value to round.
	 * @param decimals The target scale.
	 * @param mode How the dropped digits are resolved.
	 * @returns The rounded value.
	 */
	round(amount: DecimalString, decimals: number, mode: RoundingMode = RoundingMode.HALF_UP): DecimalString {
		assertScale(decimals);

		const { units, scale } = parseDecimalString(amount);

		if (scale <= decimals) {
			return formatDecimalUnits(units * pow10(decimals - scale), decimals);
		}

		const drop = pow10(scale - decimals);
		const negative = units < 0n;
		const magnitude = negative ? -units : units;

		let kept = magnitude / drop;
		const dropped = magnitude % drop;

		if (dropped !== 0n) {
			switch (mode) {
				case RoundingMode.NONE:
					throw new Error(
						`ROUNDING_REQUIRED: ${amount} is not exact at scale ${decimals} and rounding is disabled.`
					);
				case RoundingMode.UP:
					kept += 1n;
					break;
				case RoundingMode.DOWN:
					break;
				case RoundingMode.HALF_EVEN:
					// A tie goes to the even neighbour so that a long run of roundings does not drift in
					// one direction.
					if (dropped * 2n > drop || (dropped * 2n === drop && kept % 2n !== 0n)) {
						kept += 1n;
					}
					break;
				case RoundingMode.HALF_UP:
				default:
					if (dropped * 2n >= drop) {
						kept += 1n;
					}
					break;
			}
		}

		return formatDecimalUnits(negative ? -kept : kept, decimals);
	}

	/**
	 * Splits a whole across weights by largest remainder.
	 *
	 * Every part is floored to a whole minor unit, and the minor units that the flooring left over
	 * are handed out one at a time to the parts with the largest remainder. That is what makes the
	 * parts sum back to the whole exactly — the property every discount allocation, gift-card split
	 * and budget attribution depends on.
	 *
	 * @param amount The whole being split.
	 * @param weights The shares.
	 * @param decimals The scale of the parts.
	 * @param mode How the whole is resolved when it is not exact at that scale.
	 * @returns One part per weight.
	 */
	allocate(
		amount: DecimalString,
		weights: readonly DecimalString[],
		decimals: number,
		mode: RoundingMode = RoundingMode.HALF_UP
	): DecimalString[] {
		assertScale(decimals);

		if (weights.length === 0) {
			return [];
		}

		// The whole has to be exact at the parts' scale before it can be split into whole minor units.
		// A value that is not is one that has not crossed its own boundary yet, so it is rounded here
		// rather than silently truncated.
		const whole = toUnitsAtScale(this.round(amount, decimals, mode), decimals);

		// Weights are compared as scaled integers: a fractional weight (a quantity, a rate) has to be
		// exact, and a double could not carry it.
		const parsedWeights = weights.map((weight) => parseDecimalString(weight));
		const weightScale = parsedWeights.reduce((widest, weight) => Math.max(widest, weight.scale), 0);

		let scaled = parsedWeights.map((weight) => weight.units * pow10(weightScale - weight.scale));

		if (scaled.some((weight) => weight < 0n)) {
			throw new Error('MONEY_ALLOCATION_WEIGHT_NEGATIVE: allocation weights cannot be negative.');
		}

		let total = scaled.reduce((sum, weight) => sum + weight, 0n);

		if (total === 0n) {
			// No weight at all means "share equally" rather than "share nothing": an amount that has to
			// be distributed cannot vanish because the caller supplied empty weights.
			scaled = scaled.map(() => 1n);
			total = BigInt(scaled.length);
		}

		const negative = whole < 0n;
		const magnitude = negative ? -whole : whole;
		const parts: bigint[] = [];
		const remainders: bigint[] = [];
		let allocated = 0n;

		for (const weight of scaled) {
			const numerator = magnitude * weight;
			const part = numerator / total;

			parts.push(part);
			remainders.push(numerator - part * total);
			allocated += part;
		}

		// Whatever the flooring left over is handed out highest-remainder first; a tie goes to the
		// larger weight and then to the earlier part, so the outcome is identical on every run.
		const order = parts.map((_, index) => index).sort((left, right) => {
			if (remainders[left] !== remainders[right]) {
				return remainders[left] > remainders[right] ? -1 : 1;
			}

			if (scaled[left] !== scaled[right]) {
				return scaled[left] > scaled[right] ? -1 : 1;
			}

			return left - right;
		});

		let shortfall = magnitude - allocated;

		for (const index of order) {
			if (shortfall <= 0n) {
				break;
			}

			parts[index] += 1n;
			shortfall -= 1n;
		}

		return parts.map((part) => formatDecimalUnits(negative ? -part : part, decimals));
	}

	/**
	 * Quantises an amount to a multiple of an increment.
	 *
	 * @param amount The amount to quantise.
	 * @param increment The step to quantise to.
	 * @param decimals The currency scale.
	 * @param mode How a value between two increments is resolved.
	 * @returns The quantised amount and the difference between it and the input.
	 */
	roundToIncrement(
		amount: DecimalString,
		increment: DecimalString,
		decimals: number,
		mode: RoundingMode = RoundingMode.HALF_UP
	): IRoundedIncrement {
		assertScale(decimals);

		const parsedIncrement = parseDecimalString(increment);

		if (parsedIncrement.units === 0n) {
			throw new Error('MONEY_ROUNDING_INCREMENT_ZERO: a rounding increment cannot be zero.');
		}

		// The working scale is the wider of the currency's and the increment's: quantising to the
		// currency scale first would discard the increment itself when it carries more digits than the
		// currency does.
		const scale = Math.max(decimals, parsedIncrement.scale);
		const incrementUnits = parsedIncrement.units * pow10(scale - parsedIncrement.scale);
		const amountUnits = toUnitsAtScale(this.round(amount, scale, mode), scale);

		// How many whole increments the amount covers, rounded with the same strategy. The quotient is
		// computed with guard digits so that a truncated division cannot look like an exact tie.
		const quotient = formatDecimalUnits((amountUnits * pow10(WORKING_SCALE)) / incrementUnits, WORKING_SCALE);
		const steps = BigInt(this.round(quotient, 0, mode));
		const roundedUnits = steps * incrementUnits;

		return {
			rounded: formatDecimalUnits(roundedUnits, scale),
			difference: formatDecimalUnits(roundedUnits - amountUnits, scale)
		};
	}
}

/**
 * The rounding strategies an installation may select between.
 *
 * A domain never instantiates a strategy: it asks the registry for the active one, so an installation
 * that switches to a different regime does so in one place, and a value rounded at one boundary
 * cannot be rounded by a different policy than a value rounded at the next.
 */
export class RoundingStrategyRegistry {
	private readonly strategies = new Map<string, RoundingStrategy>();
	private activeKey: string;

	constructor(initial: readonly RoundingStrategy[] = [new HalfUpRoundingStrategy()]) {
		for (const strategy of initial) {
			this.strategies.set(strategy.key, strategy);
		}

		this.activeKey = this.strategies.has(DEFAULT_ROUNDING_STRATEGY_KEY)
			? DEFAULT_ROUNDING_STRATEGY_KEY
			: this.strategies.keys().next().value ?? DEFAULT_ROUNDING_STRATEGY_KEY;
	}

	/**
	 * Registers a strategy.
	 *
	 * Registering a key that already exists replaces it: an installation that installs its own
	 * rounding policy does so deliberately, and the last word is the installation's.
	 *
	 * @param strategy The strategy to register.
	 */
	register(strategy: RoundingStrategy): void {
		if (!strategy?.key) {
			throw new Error('MONEY_INVALID_ROUNDING_STRATEGY: a rounding strategy must declare a key.');
		}

		this.strategies.set(strategy.key, strategy);
	}

	/**
	 * @param key The key to activate.
	 * @throws Error when no strategy is registered under the key.
	 */
	use(key: string): void {
		if (!this.strategies.has(key)) {
			throw new Error(`MONEY_UNKNOWN_ROUNDING_STRATEGY: no rounding strategy is registered as "${key}".`);
		}

		this.activeKey = key;
	}

	/**
	 * @param key The key to resolve; the active strategy when omitted.
	 * @returns The strategy.
	 */
	resolve(key?: string): RoundingStrategy {
		const resolved = key ? this.strategies.get(key) : this.strategies.get(this.activeKey);

		if (!resolved) {
			throw new Error(`MONEY_UNKNOWN_ROUNDING_STRATEGY: no rounding strategy is registered as "${key}".`);
		}

		return resolved;
	}

	/** @returns The active strategy. */
	get active(): RoundingStrategy {
		return this.resolve();
	}

	/** @returns The registered keys. */
	get keys(): string[] {
		return [...this.strategies.keys()];
	}
}

/**
 * The registry money code uses when it is not running inside Nest — a seed script, a migration or a
 * unit test still rounds through the same strategy as the API.
 */
export const roundingStrategies = new RoundingStrategyRegistry();
