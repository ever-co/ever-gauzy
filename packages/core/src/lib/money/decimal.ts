import { DecimalString } from '@gauzy/contracts';

/**
 * Exact decimal primitives, with no rounding policy of their own.
 *
 * Every monetary operation on the platform is arithmetic on the digits of a decimal, never on a
 * binary floating point number: `0.1 + 0.2` is `0.3` here and `0.30000000000000004` in a double, and
 * that difference becomes a wrong cent the moment a total is persisted. The functions in this file
 * are the arithmetic; where a value is allowed to cross a rounding boundary is decided by the
 * rounding strategy, not here.
 */

/**
 * The string form of an exact decimal: an optional sign, up to fourteen integer digits and up to
 * twelve fractional digits.
 */
export const DECIMAL_STRING_PATTERN = /^-?\d{1,14}(\.\d{1,12})?$/;

/**
 * The syntax of a decimal, without the width limits of the public contract.
 *
 * Arithmetic legitimately produces values that a caller is not allowed to *supply*: multiplying two
 * working-scale values lands at twice the working scale, and a division is carried at guard digits
 * before it is rounded. The contract is enforced where a value enters the platform (`Money.of`, a DTO,
 * a stored column); inside the arithmetic the only requirement is that the digits are decimal.
 */
const DECIMAL_SYNTAX_PATTERN = /^[+-]?\d+(\.\d+)?$/;

/** The widest scale an intermediate value may carry. */
export const WORKING_SCALE = 12;

/** The scale of every money column: `numeric(20,6)`. */
export const STORAGE_SCALE = 6;

/** Integer digits a money column holds. */
export const MAX_INTEGER_DIGITS = 14;

/**
 * A decimal split into the integer it scales to, and the scale it is expressed at.
 */
export interface IParsedDecimal {
	/** The signed value multiplied by `10 ** scale`. */
	units: bigint;

	/** Number of fractional digits `units` is expressed at. */
	scale: number;
}

/**
 * @param exponent A non-negative exponent.
 * @returns Ten to that power, as an exact integer.
 */
export function pow10(exponent: number): bigint {
	if (!Number.isInteger(exponent) || exponent < 0) {
		throw new Error(`MONEY_INVALID_SCALE: ${exponent} is not a valid decimal scale.`);
	}
	return 10n ** BigInt(exponent);
}

/**
 * Reads the text of a decimal value.
 *
 * A `number` is accepted because callers legitimately hold one — a quantity, a rate read from a
 * column — but only its shortest round-trip form is used, and an exponential form (`1e-7`) is
 * rejected rather than expanded: a value that has to be written in exponential notation is not a
 * value that should be reaching money code as a `number` at all.
 *
 * @param value The value to read.
 * @returns The decimal text, or null when the value is not a finite decimal.
 */
function toDecimalText(value: DecimalString | number | bigint): string | null {
	if (typeof value === 'bigint') {
		return value.toString();
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : null;
	}

	if (typeof value === 'string') {
		return value.trim();
	}

	return null;
}

/**
 * @param value The value to test.
 * @returns True when the value is the string form of an exact decimal.
 */
export function isValidDecimalString(value: unknown): value is DecimalString {
	if (typeof value !== 'string') {
		return false;
	}

	return DECIMAL_STRING_PATTERN.test(value.trim());
}

/**
 * Asserts the money contract where a value enters the platform.
 *
 * @param value The value to assert.
 * @param what What the value represents, used in the message.
 * @returns The value as decimal text.
 * @throws Error when the value is not an exact decimal, or carries more integer or fractional digits
 * than a monetary value may. A `number` is not coerced, because coercion is exactly where precision is
 * lost.
 */
export function assertDecimalString(value: unknown, what = 'value'): DecimalString {
	const text = toDecimalText(value as DecimalString | number | bigint);

	if (text === null || !DECIMAL_STRING_PATTERN.test(text)) {
		throw new Error(`MONEY_NOT_DECIMAL_STRING: ${what} is not an exact decimal (${String(value)}).`);
	}

	return text;
}

/**
 * Splits a decimal into signed scaled units.
 *
 * Only the syntax is enforced here — see `DECIMAL_SYNTAX_PATTERN`. Use `assertDecimalString` where a
 * value crosses the platform boundary and the contract has to hold.
 *
 * @param value The value to parse.
 * @returns The units and the scale they are expressed at.
 * @throws Error when the value is not written as a decimal.
 */
export function parseDecimalString(value: DecimalString | number | bigint): IParsedDecimal {
	const text = toDecimalText(value);

	if (text === null || !DECIMAL_SYNTAX_PATTERN.test(text)) {
		throw new Error(`MONEY_NOT_DECIMAL_STRING: ${String(value)} is not an exact decimal.`);
	}

	const negative = text.startsWith('-');
	const unsigned = negative || text.startsWith('+') ? text.slice(1) : text;
	const [integerPart, fractionPart = ''] = unsigned.split('.');
	// Leading zeroes carry no value and would otherwise be read back as significant digits.
	const digits = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '');
	const units = BigInt(digits === '' ? '0' : digits);

	return { units: negative ? -units : units, scale: fractionPart.length };
}

/**
 * @param units The signed value scaled by `10 ** scale`.
 * @param scale The scale the units are expressed at.
 * @returns The decimal text of the value.
 */
export function formatDecimalUnits(units: bigint, scale: number): DecimalString {
	const negative = units < 0n;
	const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
	const sign = negative ? '-' : '';

	if (scale === 0) {
		return `${sign}${digits}`;
	}

	return `${sign}${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
}

/**
 * The canonical form of a decimal: no leading zeroes, no redundant trailing fractional zeroes.
 *
 * Normalising is what makes two values that represent the same amount compare equal as text, which
 * in turn is what keeps a re-run of the same computation from producing a different ledger row.
 *
 * @param value The value to normalise.
 * @returns The canonical decimal text.
 */
export function normalizeDecimalString(value: DecimalString | number | bigint): DecimalString {
	let { units, scale } = parseDecimalString(value);

	while (scale > 0 && units % 10n === 0n) {
		units /= 10n;
		scale -= 1;
	}

	return formatDecimalUnits(units, scale);
}

/**
 * Brings two decimals to a common scale.
 *
 * @param left The left value.
 * @param right The right value.
 * @returns Both values scaled alike, and the scale they share.
 */
function alignScales(left: IParsedDecimal, right: IParsedDecimal): { left: bigint; right: bigint; scale: number } {
	const scale = Math.max(left.scale, right.scale);

	return {
		left: left.units * pow10(scale - left.scale),
		right: right.units * pow10(scale - right.scale),
		scale
	};
}

/**
 * @param left The left value.
 * @param right The right value.
 * @returns -1, 0 or 1 as the left value is below, equal to or above the right one. The comparison is
 * made on scaled integers, never by subtracting two `number`s.
 */
export function compareDecimalStrings(
	left: DecimalString | number | bigint,
	right: DecimalString | number | bigint
): -1 | 0 | 1 {
	const aligned = alignScales(parseDecimalString(left), parseDecimalString(right));

	if (aligned.left === aligned.right) {
		return 0;
	}

	return aligned.left < aligned.right ? -1 : 1;
}

/**
 * @param left The left value.
 * @param right The right value.
 * @returns The exact sum of the two values.
 */
export function addDecimalStrings(
	left: DecimalString | number | bigint,
	right: DecimalString | number | bigint
): DecimalString {
	const aligned = alignScales(parseDecimalString(left), parseDecimalString(right));

	return formatDecimalUnits(aligned.left + aligned.right, aligned.scale);
}

/**
 * @param left The left value.
 * @param right The value to subtract.
 * @returns The exact difference of the two values.
 */
export function subtractDecimalStrings(
	left: DecimalString | number | bigint,
	right: DecimalString | number | bigint
): DecimalString {
	const aligned = alignScales(parseDecimalString(left), parseDecimalString(right));

	return formatDecimalUnits(aligned.left - aligned.right, aligned.scale);
}

/**
 * Multiplies two decimals exactly.
 *
 * @param left The left value.
 * @param right The right value.
 * @returns The exact product, at the sum of the two scales. Nothing is dropped: the caller decides
 * where the result crosses a boundary.
 */
export function multiplyDecimalUnits(left: IParsedDecimal, right: IParsedDecimal): IParsedDecimal {
	return { units: left.units * right.units, scale: left.scale + right.scale };
}

/**
 * Divides one decimal by another at a fixed scale, truncating toward zero.
 *
 * @param dividend The value being divided.
 * @param divisor The value dividing it.
 * @param scale The scale of the truncated quotient.
 * @returns The quotient's units at `scale`.
 * @throws Error when the divisor is zero.
 */
export function divideDecimalUnits(dividend: IParsedDecimal, divisor: IParsedDecimal, scale: number): bigint {
	if (divisor.units === 0n) {
		throw new Error('MONEY_DIVISION_BY_ZERO: a monetary value cannot be divided by zero.');
	}

	// Shifting the numerator or the denominator by the difference of the scales is what makes the
	// integer division below exact at `scale` rather than at whatever scale the inputs happened to
	// carry.
	const shift = scale + divisor.scale - dividend.scale;
	const numerator = shift >= 0 ? dividend.units * pow10(shift) : dividend.units;
	const denominator = shift >= 0 ? divisor.units : divisor.units * pow10(-shift);

	return numerator / denominator;
}

/**
 * @param value The value to read.
 * @param scale The scale to express it at.
 * @returns The value's units at `scale`.
 * @throws Error when the value carries a digit below `scale`. A money value is only ever written to
 * a column after it has crossed an explicit boundary, so a value that does not fit is a defect
 * rather than something to round silently.
 */
export function toUnitsAtScale(value: DecimalString | number | bigint, scale: number): bigint {
	const parsed = parseDecimalString(value);

	if (parsed.scale > scale) {
		const drop = pow10(parsed.scale - scale);

		if (parsed.units % drop !== 0n) {
			throw new Error(`MONEY_SCALE_LOSS: ${parsed.units}e-${parsed.scale} is not exact at scale ${scale}.`);
		}

		return parsed.units / drop;
	}

	return parsed.units * pow10(scale - parsed.scale);
}
