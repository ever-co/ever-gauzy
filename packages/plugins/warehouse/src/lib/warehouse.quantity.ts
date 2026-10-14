import { BadRequestException } from '@nestjs/common';
import { DecimalString } from '@gauzy/contracts';

/**
 * Exact quantity arithmetic for the warehouse domain.
 *
 * Every quantity of this domain — a requested pick, a picked quantity, a capacity, a weight — is
 * stored as an exact decimal and read back as a decimal string, so comparing two of them as floating
 * point numbers would answer "did the picker take more than the list asked for?" with a rounding
 * error exactly at the boundary where the answer matters. The helpers below lift a decimal into an
 * exact integer at the storage scale and do every comparison there.
 *
 * This is deliberately not the money layer: a quantity is a count of units and a weight is a
 * measurement, neither has a currency, and neither is rounded to minor units.
 */

/** Fractional digits a quantity column carries. */
export const QUANTITY_SCALE = 6;

/** A decimal string with an optional sign, an optional whole part and an optional fraction. */
const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * Lifts a quantity into exact scaled units.
 *
 * Digits below the storage scale are rounded half-up rather than truncated, so a quantity written
 * with more precision than a column holds compares the way the column will store it.
 *
 * @param value The quantity, as it was stored or supplied.
 * @returns The quantity in units of `10^-QUANTITY_SCALE`.
 * @throws BadRequestException when the value is not a decimal number.
 */
export function toQuantityUnits(value: DecimalString | number | null | undefined): bigint {
	const text = (typeof value === 'number' ? String(value) : `${value ?? ''}`).trim();

	if (text === '') {
		return 0n;
	}

	const match = DECIMAL_PATTERN.exec(text);

	if (!match) {
		throw new BadRequestException(`"${text}" is not a quantity.`);
	}

	const [, sign, whole = '', fraction = ''] = match;

	if (whole === '' && fraction === '') {
		throw new BadRequestException(`"${text}" is not a quantity.`);
	}

	const padded = `${fraction}${'0'.repeat(QUANTITY_SCALE + 1)}`;
	const kept = padded.slice(0, QUANTITY_SCALE);
	const next = Number(padded.charAt(QUANTITY_SCALE));
	let units = BigInt(`${whole || '0'}${kept}`);

	if (next >= 5) {
		units += 1n;
	}

	return sign === '-' ? -units : units;
}

/**
 * @param units Scaled units.
 * @returns The quantity as a decimal string at the storage scale, which is what a column accepts.
 */
export function fromQuantityUnits(units: bigint): DecimalString {
	const negative = units < 0n;
	const digits = (negative ? -units : units).toString().padStart(QUANTITY_SCALE + 1, '0');
	const whole = digits.slice(0, digits.length - QUANTITY_SCALE);
	const fraction = digits.slice(digits.length - QUANTITY_SCALE);

	return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * @param value The quantity.
 * @returns The quantity as a decimal string at the storage scale.
 */
export function normalizeQuantity(value: DecimalString | number | null | undefined): DecimalString {
	return fromQuantityUnits(toQuantityUnits(value));
}

/**
 * @param value The quantity.
 * @returns True when the quantity is greater than zero.
 */
export function isPositiveQuantity(value: DecimalString | number | null | undefined): boolean {
	return toQuantityUnits(value) > 0n;
}

/**
 * @param value The quantity.
 * @returns True when the quantity is less than zero.
 */
export function isNegativeQuantity(value: DecimalString | number | null | undefined): boolean {
	return toQuantityUnits(value) < 0n;
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns The exact sum, as a decimal string.
 */
export function addQuantities(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): DecimalString {
	return fromQuantityUnits(toQuantityUnits(left) + toQuantityUnits(right));
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns The exact difference, as a decimal string.
 */
export function subtractQuantities(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): DecimalString {
	return fromQuantityUnits(toQuantityUnits(left) - toQuantityUnits(right));
}

/**
 * @param values The quantities to total.
 * @returns The exact total, as a decimal string.
 */
export function sumQuantities(values: Array<DecimalString | number | null | undefined>): DecimalString {
	return fromQuantityUnits(values.reduce<bigint>((total, value) => total + toQuantityUnits(value), 0n));
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns True when the left quantity is strictly greater than the right one.
 */
export function isGreaterThan(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): boolean {
	return toQuantityUnits(left) > toQuantityUnits(right);
}

/**
 * @param left One quantity.
 * @param right Another quantity.
 * @returns True when the left quantity is greater than or equal to the right one.
 */
export function isAtLeast(
	left: DecimalString | number | null | undefined,
	right: DecimalString | number | null | undefined
): boolean {
	return toQuantityUnits(left) >= toQuantityUnits(right);
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
	return toQuantityUnits(left) === toQuantityUnits(right);
}
