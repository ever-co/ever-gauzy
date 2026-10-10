import { BadRequestException } from '@nestjs/common';
import { DecimalString } from '@gauzy/contracts';

/**
 * Exact quantity arithmetic for the purchasing domain.
 *
 * Ordered, received and damaged quantities are stored as `numeric(20,6)` and read back as decimal
 * strings. The one comparison this domain turns on — "does this receipt push the line past what was
 * ordered?" — sits exactly on a boundary, so answering it with floating point arithmetic would make
 * the answer depend on a rounding error. Every value is therefore lifted into an exact integer at the
 * storage scale and compared there.
 *
 * This is deliberately not the money layer: a quantity is a count of units, with no currency, no
 * minor unit and no presentation scale to honour. Money on a purchase order and its lines goes
 * through `Money` instead.
 */

/** Fractional digits a quantity column carries: `numeric(20,6)`. */
export const QUANTITY_SCALE = 6;

/**
 * Fractional digits a unit conversion factor carries: `numeric(24,12)`.
 *
 * Twelve because a factor is never itself rounded — an inch is 25.4 millimetres exactly, and a pound
 * is 453.59237 grams exactly — while a quantity is rounded to its own storage scale. The two scales are
 * deliberately different, and a factor is not a quantity.
 */
export const UNIT_FACTOR_SCALE = 12;

/** The storage scale as a power of ten, which is what lifts a decimal into whole units. */
const SCALE = 10n ** BigInt(QUANTITY_SCALE);

/** Zero at the storage scale, as the value every accumulator starts from. */
const ZERO = 0n;

/**
 * A decimal literal: an optional sign, digits, and an optional fraction. Exponent notation is not a
 * decimal string a column can hold, so it is rejected rather than interpreted.
 */
const DECIMAL_LITERAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * Reads a decimal string into exact scaled units.
 *
 * A value carrying more precision than a column holds is rounded half-up rather than truncated, so a
 * quantity compares the way the column will store it.
 *
 * @param value The quantity, as it was supplied or read back.
 * @returns The quantity in units of `10^-QUANTITY_SCALE`.
 * @throws BadRequestException when the value is not a decimal number.
 */
export function toQuantityUnits(value: DecimalString | number | null | undefined): bigint {
	return toScaledUnits(value, QUANTITY_SCALE);
}

/**
 * Reads a decimal string into exact units at a stated scale.
 *
 * The one parser behind both scales this domain works in: a quantity at six decimals and a unit
 * conversion factor at twelve. A value carrying more precision than the scale is rounded half-up rather
 * than truncated, so a value compares the way the column will store it.
 *
 * @param value The value, as it was supplied or read back.
 * @param scale The fractional digits to read it at.
 * @returns The value in units of `10^-scale`.
 * @throws BadRequestException when the value is not a decimal number.
 */
function toScaledUnits(value: DecimalString | number | null | undefined, scale: number): bigint {
	if (value === null || value === undefined) {
		return ZERO;
	}

	const text = (typeof value === 'number' ? String(value) : value).trim();

	if (text === '') {
		return ZERO;
	}

	const parsed = DECIMAL_LITERAL.exec(text);

	if (!parsed) {
		throw new BadRequestException(`"${text}" is not a quantity.`);
	}

	const [, sign, whole = '', fraction = ''] = parsed;

	if (whole === '' && fraction === '') {
		throw new BadRequestException(`"${text}" is not a quantity.`);
	}

	// Pad the fraction past the scale so there is always a digit to round on.
	const padded = fraction.padEnd(scale + 1, '0');
	const kept = padded.slice(0, scale);
	const roundUp = Number(padded.charAt(scale)) >= 5;
	const units = BigInt(`${whole || '0'}${kept}`) + (roundUp ? 1n : 0n);

	return sign === '-' ? -units : units;
}

/**
 * @param units Exact scaled units.
 * @returns The quantity as a decimal string at the storage scale, which is what a column accepts.
 */
export function fromQuantityUnits(units: bigint): DecimalString {
	const sign = units < ZERO ? '-' : '';
	const digits = (units < ZERO ? -units : units).toString().padStart(QUANTITY_SCALE + 1, '0');
	const cut = digits.length - QUANTITY_SCALE;

	return `${sign}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/**
 * @param value The quantity.
 * @returns The quantity at the storage scale, which is the form it is written in.
 */
export function normalizeQuantity(value: DecimalString | number | null | undefined): DecimalString {
	return fromQuantityUnits(toQuantityUnits(value));
}

/**
 * Converts a quantity entered in a document line's own unit into the reference unit.
 *
 * A supplier who sells by the case of twelve while we stock eaches is the ordinary case, and the line
 * records both facts: the unit the buyer ordered in and the factor that was in force at entry. The
 * price break a vendor term states is a statement about **base** units, so the comparison against it
 * happens here, once, on the quantity the agreement is actually about.
 *
 * @param quantity The quantity as entered in the line's unit.
 * @param factor The line's conversion factor, at the factor's own scale.
 * @returns The quantity in reference units, at the quantity storage scale, rounded half-up.
 */
export function toBaseQuantity(
	quantity: DecimalString | number | null | undefined,
	factor: DecimalString | number | null | undefined
): DecimalString {
	const entered = toQuantityUnits(quantity);

	if (factor === undefined || factor === null || String(factor).trim() === '') {
		return fromQuantityUnits(entered);
	}

	const scaledFactor = toScaledUnits(factor, UNIT_FACTOR_SCALE);
	const divisor = 10n ** BigInt(UNIT_FACTOR_SCALE);
	const product = entered * scaledFactor;

	// Rounded half-up at the quantity scale, so a half-unit lands the way the column will store it.
	return fromQuantityUnits((product + divisor / 2n) / divisor);
}

/**
 * @param value The quantity.
 * @returns True when the quantity is strictly greater than zero.
 */
export function isPositiveQuantity(value: DecimalString | number | null | undefined): boolean {
	return toQuantityUnits(value) > ZERO;
}

/**
 * @param value The quantity.
 * @returns True when the quantity is zero or negative.
 */
export function isNonPositiveQuantity(value: DecimalString | number | null | undefined): boolean {
	return toQuantityUnits(value) <= ZERO;
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns The exact sum, at the storage scale.
 */
export function addQuantity(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): DecimalString {
	return fromQuantityUnits(toQuantityUnits(left) + toQuantityUnits(right));
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns The exact difference, at the storage scale. It may be negative.
 */
export function subtractQuantity(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): DecimalString {
	return fromQuantityUnits(toQuantityUnits(left) - toQuantityUnits(right));
}

/**
 * @param values The quantities to total.
 * @returns The exact total, at the storage scale.
 */
export function sumQuantity(values: Array<DecimalString | number | null | undefined>): DecimalString {
	let total = ZERO;

	for (const value of values) {
		total += toQuantityUnits(value);
	}

	return fromQuantityUnits(total);
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns -1 when the left is smaller, 0 when the two are equal, 1 when it is larger.
 */
export function compareQuantity(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): -1 | 0 | 1 {
	const a = toQuantityUnits(left);
	const b = toQuantityUnits(right);

	return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns True when the left is strictly greater than the right.
 */
export function isGreaterThanQuantity(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): boolean {
	return compareQuantity(left, right) > 0;
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns True when the left is greater than or equal to the right.
 */
export function isAtLeastQuantity(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): boolean {
	return compareQuantity(left, right) >= 0;
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns True when the two quantities are equal.
 */
export function isSameQuantity(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): boolean {
	return compareQuantity(left, right) === 0;
}

/**
 * @param value The quantity.
 * @returns The quantity with the opposite sign, at the storage scale. Used to express the inverse of a
 * movement or a received counter without a second subtraction.
 */
export function negateQuantity(value: DecimalString | number | null | undefined): DecimalString {
	return fromQuantityUnits(-toQuantityUnits(value));
}

/**
 * @param quantity The ordered quantity.
 * @param tolerance The fraction of the ordered quantity the receipt may exceed, as a decimal string.
 * @returns The largest total a line may reach, as an exact quantity.
 */
export function quantityWithTolerance(
	quantity: DecimalString | number | null | undefined,
	tolerance: DecimalString | number | null | undefined
): DecimalString {
	const ordered = toQuantityUnits(quantity);

	if (ordered <= ZERO || isNonPositiveQuantity(tolerance)) {
		return fromQuantityUnits(ordered);
	}

	// The tolerance is a fraction, so the allowance is computed as a fraction of the scaled total —
	// `ordered * tolerance` at the storage scale, without ever leaving exact arithmetic.
	const allowance = (ordered * toQuantityUnits(tolerance)) / SCALE;

	return fromQuantityUnits(ordered + allowance);
}
