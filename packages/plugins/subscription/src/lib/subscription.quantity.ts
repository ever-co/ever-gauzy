import { BadRequestException } from '@nestjs/common';
import { DecimalString } from '@gauzy/contracts';

/**
 * Exact quantity arithmetic for the subscription domain.
 *
 * A recurring quantity is a count of units, not an amount of money: it has no currency, no minor unit
 * and no cash-rounding rule to honour. It is stored in a column that declares its own scale —
 * `subscription_item.quantity` is `numeric(20,6)` with a default of 1 (doc 05 §15.3) — and that scale
 * is the only boundary a quantity crosses.
 *
 * Measuring a quantity with the money layer would round it at the *currency's* minor unit instead,
 * which is a different boundary: half a unit in a currency with no minor unit would be stored as one
 * unit, and the customer would be billed for twice what they agreed to. The helpers below therefore
 * scale a decimal string into an exact integer (`bigint`) at the column's scale and answer there, so a
 * quantity never passes through a floating point number on its way to storage.
 */

/** Fractional digits the quantity column carries. */
export const QUANTITY_SCALE = 6;

/** A decimal string with an optional sign, an optional whole part and an optional fraction. */
const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * Lifts a quantity into exact scaled units.
 *
 * Digits below the storage scale are rounded half-up rather than truncated, so a quantity written with
 * more precision than the column holds is stored as the column would hold it.
 *
 * @param value The quantity, as it was supplied or stored.
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
 * @returns The quantity as a decimal string at the column's scale, which is what the column accepts.
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
 * @returns The quantity as a decimal string at the column's scale, which is where it is stored.
 */
export function normalizeQuantity(value: DecimalString | number | null | undefined): DecimalString {
	return fromQuantityUnits(toQuantityUnits(value));
}
