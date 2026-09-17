import { DecimalString } from '@gauzy/contracts';
import { addDecimalStrings, compareDecimalStrings, subtractDecimalStrings } from '@gauzy/core';

/**
 * Exact quantity arithmetic for the fulfilment domain.
 *
 * A quantity on this platform is an exact decimal — `numeric(20,6)` on the order line and on the
 * shipment line — and it reads back as decimal text, so answering "how much of this line is still
 * outstanding?" by subtracting binary floating point numbers answers it with a rounding error at
 * exactly the boundary the answer is used on: `0.3 − 0.1` is `0.19999999999999998` in a double, and
 * the last partial shipment of a decimal quantity is then refused by the guard that compares a
 * requested quantity against the remainder.
 *
 * The arithmetic is not restated here. The platform's exact decimal primitives (`@gauzy/core`) are
 * the one implementation of it, and everything below is this domain's vocabulary over them: what is
 * left to ship, whether a stated quantity is positive at all, and what a counter becomes when a
 * shipment moves it. This is deliberately not the money layer — a quantity is a count of units, with
 * no currency, no minor unit and no rounding strategy — but the digits are the same digits, and a
 * quantity is never a float on this path.
 */

/** A quantity, as a column or a caller hands one over: exact decimal text, or the number form of one. */
export type Quantity = DecimalString | number | null | undefined;

/** The value every comparison and every clamp in this file is stated against. */
const ZERO: DecimalString = '0';

/**
 * Reads a quantity as exact decimal text.
 *
 * A counter that was not selected and a counter that has never been moved both arrive empty, and an
 * empty quantity is zero rather than an error. Anything else that is not a decimal — `NaN` included —
 * throws, because a guard that answers "is this a quantity?" with a silent `false` is what lets a
 * shipment nothing can reconcile through.
 *
 * @param value The quantity.
 * @returns The quantity as decimal text.
 * @throws Error when the value is not an exact decimal.
 */
function toQuantityText(value: Quantity): DecimalString {
	return value === null || value === undefined || value === '' ? ZERO : String(value).trim();
}

/**
 * @param value The quantity.
 * @returns True when the quantity is a finite number greater than zero.
 */
export function isPositiveQuantity(value: Quantity): boolean {
	const quantity = Number(value);

	// Every comparison with `NaN` is false, which is the whole reason the guard this serves is not
	// written as one: a quantity that is not a number at all has to be refused, not waved through.
	return Number.isFinite(quantity) && compareDecimalStrings(quantity, ZERO) > 0;
}

/**
 * @param ordered The quantity the order line was placed in.
 * @param taken What is no longer outstanding: what was written off, what a return dismissed, and what
 * a fulfilment already accounts for.
 * @returns The exact remainder, as decimal text — the form a comparison is made in, because a
 * `numeric(20,6)` carries more significant digits than a double does.
 */
export function remainingQuantity(ordered: Quantity, ...taken: Quantity[]): DecimalString {
	return taken.reduce<DecimalString>(
		(left, right) => subtractDecimalStrings(left, toQuantityText(right)),
		toQuantityText(ordered)
	);
}

/**
 * @param current The counter as it stands.
 * @param delta The signed quantity to move it by.
 * @returns The exact new value of the counter, as decimal text.
 */
export function addQuantities(current: Quantity, delta: Quantity): DecimalString {
	return addDecimalStrings(toQuantityText(current), toQuantityText(delta));
}

/**
 * @param value The quantity.
 * @returns True when the quantity is below zero.
 */
export function isNegativeQuantity(value: Quantity): boolean {
	return compareDecimalStrings(toQuantityText(value), ZERO) < 0;
}
