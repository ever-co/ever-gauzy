import {
	CurrencyCode,
	DecimalString,
	IMoney,
	IMoneyDisplayOptions,
	MoneySymbolPosition,
	RoundingMode
} from '@gauzy/contracts';
import { currencyPrecision } from './currency-precision';
import {
	MAX_INTEGER_DIGITS,
	STORAGE_SCALE,
	WORKING_SCALE,
	addDecimalStrings,
	assertDecimalString,
	compareDecimalStrings,
	divideDecimalUnits,
	formatDecimalUnits,
	multiplyDecimalUnits,
	normalizeDecimalString,
	parseDecimalString,
	pow10,
	subtractDecimalStrings,
	toUnitsAtScale
} from './decimal';
import { RoundingStrategy, roundingStrategies } from './rounding';

/**
 * The platform's monetary value.
 *
 * One type, everywhere: a cart line, an invoice, a payroll run and an expense all compute through
 * this class, so rounding and currency precision are decided in one place rather than in each
 * service's own arithmetic. The value holds the *exact* decimal its currency is expressed in and the
 * currency's decimal-place count snapshotted at construction, so a later change to a currency's
 * precision cannot retroactively alter an amount that was already recorded.
 *
 * Arithmetic never rounds. `add`, `subtract`, `multiply` and `divide` carry the full working scale
 * and only `round`, `floor`, `ceil`, `allocate` and `roundToIncrement` cross a boundary — which is
 * what makes a total reproducible from its parts.
 */

/** Thousands separator used by the built-in display formatting. */
const GROUPING_SEPARATOR = ',';

/**
 * Fractional digits a quotient carries beyond the scale it is rounded to, so that a quotient that was
 * truncated rather than computed to the last digit cannot present itself to the strategy as an exact
 * tie. Capped by the working scale in `divide` below.
 */
const DIVISION_GUARD_DIGITS = 4;

/**
 * @param currency The currency code to normalise.
 * @returns The code, trimmed and upper-cased.
 */
function normalizeCurrency(currency: CurrencyCode): CurrencyCode {
	if (typeof currency !== 'string' || currency.trim() === '') {
		throw new Error('MONEY_INVALID_CURRENCY: a monetary value needs a currency code.');
	}

	return currency.trim().toUpperCase();
}

/**
 * @param currency The currency code.
 * @param decimals The decimal places the caller stated, when it stated any.
 * @returns The decimal places to snapshot on the value.
 */
function resolveDecimals(currency: CurrencyCode, decimals?: number): number {
	if (decimals === undefined) {
		return currencyPrecision.decimalsFor(currency);
	}

	if (!Number.isInteger(decimals) || decimals < 0 || decimals > WORKING_SCALE) {
		throw new Error(`MONEY_INVALID_SCALE: ${currency} cannot carry ${decimals} decimal places.`);
	}

	return decimals;
}

/**
 * @param scale The scale an arithmetic boundary was asked for.
 * @returns The scale, when it is one a value can be carried at.
 * @throws Error when the scale is outside the range the money layer carries.
 */
function resolveScale(scale: number): number {
	if (!Number.isInteger(scale) || scale < 0 || scale > WORKING_SCALE) {
		throw new Error(`MONEY_INVALID_SCALE: ${scale} is not a scale between 0 and ${WORKING_SCALE}.`);
	}

	return scale;
}

/**
 * Inserts thousands separators into an integer digit string.
 *
 * @param digits The integer digits, without a sign.
 * @returns The grouped digits.
 */
function groupThousands(digits: string): string {
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUPING_SEPARATOR);
}

export class Money implements IMoney {
	/** The widest scale an intermediate value may carry. */
	static readonly WORKING_SCALE = WORKING_SCALE;

	/** The scale of every money column: `numeric(20,6)`. */
	static readonly STORAGE_SCALE = STORAGE_SCALE;

	/** Integer digits a money column holds. */
	static readonly MAX_INTEGER_DIGITS = MAX_INTEGER_DIGITS;

	readonly amount: DecimalString;
	readonly currency: CurrencyCode;
	readonly decimals: number;

	private constructor(amount: DecimalString, currency: CurrencyCode, decimals: number) {
		this.amount = amount;
		this.currency = currency;
		this.decimals = decimals;
	}

	/*
	|--------------------------------------------------------------------------
	| Construction
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param amount The exact amount.
	 * @param currency The currency it is expressed in.
	 * @param decimals The currency's decimal places; read from the precision table when omitted.
	 * @returns The value.
	 * @throws Error when the amount is not an exact decimal. A `number` in exponential notation, an
	 * `Infinity` and a `NaN` are all rejected rather than coerced.
	 */
	static of(amount: DecimalString | number | bigint, currency: CurrencyCode, decimals?: number): Money {
		const code = normalizeCurrency(currency);
		const scale = resolveDecimals(code, decimals);

		// The contract is enforced here, at the boundary: a value with more digits than a monetary value
		// may carry is rejected rather than quietly truncated.
		return new Money(normalizeDecimalString(assertDecimalString(amount, 'amount')), code, scale);
	}

	/**
	 * @param currency The currency the zero is expressed in.
	 * @param decimals The currency's decimal places.
	 * @returns Zero in that currency.
	 */
	static zero(currency: CurrencyCode, decimals?: number): Money {
		return Money.of('0', currency, decimals);
	}

	/**
	 * Reads a value that came back from a money column.
	 *
	 * The platform's money columns are `numeric(20,6)` read through the platform's numeric
	 * transformer, so the value arrives either as the driver's exact decimal text or as the number
	 * that transformer parsed it into; both are accepted here, and the normalisation is what makes the
	 * two indistinguishable to the arithmetic above.
	 *
	 * @param amount The stored amount, or null when the column is null.
	 * @param currency The currency it is expressed in.
	 * @param decimals The currency's decimal places.
	 * @returns The value, zero when the column is null.
	 */
	static fromStorage(
		amount: DecimalString | number | bigint | null | undefined,
		currency: CurrencyCode,
		decimals?: number
	): Money {
		if (amount === null || amount === undefined || amount === '') {
			return Money.zero(currency, decimals);
		}

		return Money.of(amount, currency, decimals);
	}

	/**
	 * @param minor The amount in minor units.
	 * @param currency The currency they are expressed in.
	 * @param decimals The currency's decimal places.
	 * @returns The value.
	 */
	static fromMinorUnits(minor: bigint, currency: CurrencyCode, decimals?: number): Money {
		const code = normalizeCurrency(currency);
		const scale = resolveDecimals(code, decimals);

		return new Money(formatDecimalUnits(minor, scale), code, scale);
	}

	/**
	 * @param values The values to total.
	 * @param currency The currency they are expressed in.
	 * @param decimals The currency's decimal places.
	 * @returns The exact sum. Adding values that are already rounded cannot introduce a half-way
	 * value, so the result needs no further rounding.
	 */
	static sum(values: readonly Money[], currency: CurrencyCode, decimals?: number): Money {
		let total = Money.zero(currency, decimals);

		for (const value of values) {
			total = total.add(value);
		}

		return total;
	}

	/**
	 * @param left One value.
	 * @param right Another value.
	 * @returns The smaller of the two.
	 */
	static min(left: Money, right: Money): Money {
		return left.lessThanOrEqual(right) ? left : right;
	}

	/**
	 * @param left One value.
	 * @param right Another value.
	 * @returns The larger of the two.
	 */
	static max(left: Money, right: Money): Money {
		return left.greaterThanOrEqual(right) ? left : right;
	}

	/*
	|--------------------------------------------------------------------------
	| Arithmetic — no boundary is crossed here
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param other The value to add.
	 * @returns The exact sum.
	 * @throws Error when the two values are in different currencies. They are never coerced: a
	 * conversion is an explicit step with a rate behind it.
	 */
	add(other: Money): Money {
		this.assertSameCurrency(other, 'add');

		return new Money(
			normalizeDecimalString(addDecimalStrings(this.amount, other.amount)),
			this.currency,
			Math.max(this.decimals, other.decimals)
		);
	}

	/**
	 * @param other The value to subtract.
	 * @returns The exact difference.
	 */
	subtract(other: Money): Money {
		this.assertSameCurrency(other, 'subtract');

		return new Money(
			normalizeDecimalString(subtractDecimalStrings(this.amount, other.amount)),
			this.currency,
			Math.max(this.decimals, other.decimals)
		);
	}

	/**
	 * @param factor The multiplier; a quantity or a rate.
	 * @param options.scale The scale the product is rounded to; the working scale by default.
	 * @param options.mode How the product is resolved at that scale.
	 * @returns The product, rounded at the requested scale. The result is not rounded to the
	 * currency's decimals: that is a boundary decision, and it belongs to the caller that knows which
	 * boundary it is at.
	 */
	multiply(factor: DecimalString | number, options: { scale?: number; mode?: RoundingMode } = {}): Money {
		const scale = resolveScale(options.scale ?? WORKING_SCALE);
		const product = multiplyDecimalUnits(parseDecimalString(this.amount), parseDecimalString(factor));

		return new Money(
			normalizeDecimalString(
				this.strategy.round(formatDecimalUnits(product.units, product.scale), scale, this.mode(options.mode))
			),
			this.currency,
			this.decimals
		);
	}

	/**
	 * @param divisor The divisor.
	 * @param options.scale The scale the quotient is rounded to; the working scale by default.
	 * @param options.mode How the quotient is resolved at that scale.
	 * @returns The quotient.
	 * @throws Error when the divisor is zero.
	 */
	divide(divisor: DecimalString | number, options: { scale?: number; mode?: RoundingMode } = {}): Money {
		const scale = resolveScale(options.scale ?? WORKING_SCALE);
		const parsedDivisor = parseDecimalString(divisor);
		// The quotient is carried with guard digits and then handed to the strategy, so the strategy still
		// owns the boundary. The guard is capped by the working scale: a value never carries more digits
		// than that while it is in flight.
		const guardScale = Math.min(WORKING_SCALE, scale + DIVISION_GUARD_DIGITS);
		const quotientUnits = divideDecimalUnits(parseDecimalString(this.amount), parsedDivisor, guardScale);
		const quotient = formatDecimalUnits(quotientUnits, guardScale);

		return new Money(
			normalizeDecimalString(this.strategy.round(quotient, scale, this.mode(options.mode))),
			this.currency,
			this.decimals
		);
	}

	/**
	 * @returns The value with the opposite sign.
	 */
	negate(): Money {
		const { units, scale } = parseDecimalString(this.amount);

		return new Money(formatDecimalUnits(-units, scale), this.currency, this.decimals);
	}

	/**
	 * @returns The value without its sign.
	 */
	abs(): Money {
		return this.isNegative() ? this.negate() : this;
	}

	/*
	|--------------------------------------------------------------------------
	| Allocation
	|--------------------------------------------------------------------------
	*/

	/**
	 * Splits the value across weights so that the parts sum back to it exactly.
	 *
	 * @param ratios The weights. A zero total falls back to an equal split.
	 * @returns One part per weight, each a whole number of the currency's minor units.
	 * @throws Error when a weight is negative.
	 */
	allocate(ratios: readonly (number | DecimalString)[]): Money[] {
		const weights = ratios.map((ratio) => normalizeDecimalString(ratio));
		const parts = this.strategy.allocate(this.amount, weights, this.decimals, RoundingMode.HALF_UP);

		return parts.map((part) => new Money(part, this.currency, this.decimals));
	}

	/**
	 * @param weights The prior amounts the value is distributed in proportion to.
	 * @returns One part per weight.
	 */
	allocateBy(weights: readonly Money[]): Money[] {
		for (const weight of weights) {
			this.assertSameCurrency(weight, 'allocate by');
		}

		return this.allocate(weights.map((weight) => weight.amount));
	}

	/*
	|--------------------------------------------------------------------------
	| Comparison
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param other The value to compare with.
	 * @returns -1, 0 or 1. The comparison is exact and never subtracts two `number`s.
	 */
	compare(other: Money): -1 | 0 | 1 {
		this.assertSameCurrency(other, 'compare');

		return compareDecimalStrings(this.amount, other.amount);
	}

	/**
	 * @returns -1, 0 or 1 as the value is below, equal to or above zero.
	 */
	compareToZero(): -1 | 0 | 1 {
		return compareDecimalStrings(this.amount, '0');
	}

	/**
	 * @param other The value to compare with.
	 * @returns True when both values are in the same currency and represent the same amount.
	 */
	equals(other: Money): boolean {
		return this.isSameCurrency(other) && this.compare(other) === 0;
	}

	/**
	 * @param other The value to compare with.
	 * @returns True when this value is strictly greater.
	 */
	greaterThan(other: Money): boolean {
		return this.compare(other) > 0;
	}

	/**
	 * @param other The value to compare with.
	 * @returns True when this value is greater or equal.
	 */
	greaterThanOrEqual(other: Money): boolean {
		return this.compare(other) >= 0;
	}

	/**
	 * @param other The value to compare with.
	 * @returns True when this value is strictly smaller.
	 */
	lessThan(other: Money): boolean {
		return this.compare(other) < 0;
	}

	/**
	 * @param other The value to compare with.
	 * @returns True when this value is smaller or equal.
	 */
	lessThanOrEqual(other: Money): boolean {
		return this.compare(other) <= 0;
	}

	/**
	 * @param other The value to compare with.
	 * @returns True when both values carry the same currency.
	 */
	isSameCurrency(other: Money): boolean {
		return other instanceof Money && other.currency === this.currency;
	}

	/** @returns True when the value is exactly zero. */
	isZero(): boolean {
		return this.compareToZero() === 0;
	}

	/** @returns True when the value is below zero. */
	isNegative(): boolean {
		return this.compareToZero() < 0;
	}

	/** @returns True when the value is above zero. */
	isPositive(): boolean {
		return this.compareToZero() > 0;
	}

	/*
	|--------------------------------------------------------------------------
	| Rounding — the boundaries
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param mode How a value that is not exact at the target scale is resolved.
	 * @param decimals The target scale; the currency's by default.
	 * @returns The rounded value.
	 * @throws Error under `RoundingMode.NONE` when the value is not already exact.
	 */
	round(mode: RoundingMode = RoundingMode.HALF_UP, decimals: number = this.decimals): Money {
		return new Money(
			normalizeDecimalString(this.strategy.round(this.amount, decimals, mode)),
			this.currency,
			this.decimals
		);
	}

	/**
	 * @param decimals The target scale.
	 * @returns The value rounded toward zero.
	 */
	floor(decimals: number = this.decimals): Money {
		return this.round(RoundingMode.DOWN, decimals);
	}

	/**
	 * @param decimals The target scale.
	 * @returns The value rounded away from zero.
	 */
	ceil(decimals: number = this.decimals): Money {
		return this.round(RoundingMode.UP, decimals);
	}

	/**
	 * Quantises the value to a multiple of an increment, which is how the amount a customer physically
	 * pays is reached on a currency with cash rounding.
	 *
	 * @param increment The step to quantise to.
	 * @param mode How a value between two increments is resolved.
	 * @returns The quantised amount and the correction, which the caller records as a rounding
	 * adjustment so that the paid total can reach the grand total.
	 */
	roundToIncrement(increment: DecimalString, mode: RoundingMode = RoundingMode.HALF_UP): {
		rounded: Money;
		difference: Money;
	} {
		const { rounded, difference } = this.strategy.roundToIncrement(this.amount, increment, this.decimals, mode);
		const scale = Math.max(this.decimals, parseDecimalString(increment).scale);

		return {
			rounded: Money.of(rounded, this.currency, scale),
			difference: Money.of(difference, this.currency, scale)
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Serialisation
	|--------------------------------------------------------------------------
	*/

	/**
	 * @returns The value at the storage scale, for a `numeric(20,6)` column.
	 * @throws Error when the value carries a digit below the storage scale. A value that has not
	 * crossed a boundary is a defect, and letting the database round it would hide the defect.
	 */
	toStorageString(): DecimalString {
		const { units, scale } = parseDecimalString(this.amount);

		if (scale > STORAGE_SCALE) {
			throw new Error(
				`MONEY_NOT_ROUNDED_FOR_STORAGE: ${this.amount} carries more digits than a money column ` +
					`(scale ${STORAGE_SCALE}) and must cross a rounding boundary first.`
			);
		}

		return formatDecimalUnits(units * pow10(STORAGE_SCALE - scale), STORAGE_SCALE);
	}

	/**
	 * @returns The value in the currency's minor units.
	 */
	toMinorUnits(): bigint {
		return toUnitsAtScale(this.amount, this.decimals);
	}

	/**
	 * Renders the value for a person.
	 *
	 * @param options How to render it.
	 * @returns The rendered value at the currency's scale. Nothing below that scale is ever shown, and
	 * nothing above it is invented.
	 */
	toDisplayString(options: IMoneyDisplayOptions = {}): string {
		const {
			withSymbol = false,
			symbol,
			symbolPosition = MoneySymbolPosition.PREFIX,
			spaceBetweenSymbolAndAmount = true,
			grouping = true
		} = options;

		const units = toUnitsAtScale(this.round(RoundingMode.HALF_UP).amount, this.decimals);
		const negative = units < 0n;
		const digits = (negative ? -units : units).toString().padStart(this.decimals + 1, '0');
		const integerDigits = this.decimals === 0 ? digits : digits.slice(0, digits.length - this.decimals);
		const fractionDigits = this.decimals === 0 ? '' : digits.slice(digits.length - this.decimals);
		const body = `${negative ? '-' : ''}${grouping ? groupThousands(integerDigits) : integerDigits}${
			fractionDigits ? `.${fractionDigits}` : ''
		}`;

		if (!withSymbol || !symbol) {
			return body;
		}

		const separator = spaceBetweenSymbolAndAmount ? ' ' : '';

		return symbolPosition === MoneySymbolPosition.SUFFIX
			? `${body}${separator}${symbol}`
			: `${symbol}${separator}${body}`;
	}

	/**
	 * @param options How to render the value.
	 * @returns The same string as `toDisplayString`.
	 */
	format(options: IMoneyDisplayOptions = {}): string {
		return this.toDisplayString(options);
	}

	/**
	 * @returns The value in its serialisable form.
	 */
	toJSON(): IMoney {
		return { amount: this.amount, currency: this.currency, decimals: this.decimals };
	}

	/**
	 * @returns The value as `amount currency`.
	 */
	toString(): string {
		return `${this.amount} ${this.currency}`;
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/** The rounding strategy every boundary of this value goes through. */
	private get strategy(): RoundingStrategy {
		return roundingStrategies.active;
	}

	/**
	 * @param mode The mode the caller asked for.
	 * @returns The mode to round with.
	 */
	private mode(mode?: RoundingMode): RoundingMode {
		return mode ?? RoundingMode.HALF_UP;
	}

	/**
	 * @param other The other operand.
	 * @param operation The operation being attempted, named in the error.
	 * @throws Error when the operands are not two values of one currency.
	 */
	private assertSameCurrency(other: Money, operation: string): void {
		if (!(other instanceof Money)) {
			throw new Error(`MONEY_INVALID_OPERAND: ${operation} expects another monetary value.`);
		}

		if (other.currency !== this.currency) {
			throw new Error(
				`MONEY_CURRENCY_MISMATCH: cannot ${operation} ${this.currency} and ${other.currency}. ` +
					'Convert the value explicitly before combining it.'
			);
		}
	}
}
