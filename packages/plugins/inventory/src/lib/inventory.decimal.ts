import { DecimalString, RoundingMode } from '@gauzy/contracts';
import { STORAGE_SCALE, WORKING_SCALE, roundingStrategies } from '@gauzy/core';

/**
 * Presents an inventory valuation in the wire form the schema's `Decimal` promises: exact decimal text
 * with six fractional digits.
 *
 * **The platform registers no serializer for `Decimal`,** so whatever a resolver answers under a field
 * of that type is what the client receives. The package has three such fields — the valuation of a count
 * session's variance, the variance a closed session recorded, and the unit cost a transfer line carries —
 * and none of them arrives here as that text on every dialect:
 *
 * - the variance report sums exact decimal text at up to twelve fractional digits, which has to be
 *   rounded once, to the storage scale, before it is presented;
 * - the two `numeric(20,6)` columns are hydrated as whatever the driver answers: the string
 *   `'12.500000'` on Postgres and MySQL, the `number` `12.5` on SQLite, and either under MikroORM
 *   depending on how its decimal type is mapped. Passed through, the same field was a JSON string on one
 *   installation and a JSON float on another, and a float past sixteen significant digits
 *   (`12345678901234.123456`) is rounded by the server before the client ever sees it.
 *
 * A string is read as the exact digits it spells. A `number` is read through its shortest round-trip
 * form — the digits the driver meant, not the binary expansion `toFixed` would print — except where that
 * form is exponential (a magnitude below `1e-6`), which is written out at the working scale first. The
 * value is then rounded once, half up, through the platform's active rounding strategy: the boundary
 * where a figure is presented, and the same one every other money figure goes through.
 *
 * @param value The valuation as the read produced it.
 * @returns Its exact decimal text at the storage scale, or `null` when there is no value — which a
 * nullable field answers as it is, and a non-null one refuses exactly as it did before.
 * @throws Error when the value is present but is not a finite decimal, rather than inventing a figure.
 */
export function toDecimalWire(value: DecimalString | number | bigint): DecimalString;
export function toDecimalWire(value: DecimalString | number | bigint | null | undefined): DecimalString | null;
export function toDecimalWire(value: DecimalString | number | bigint | null | undefined): DecimalString | null {
	if (value === null || value === undefined) {
		return null;
	}

	return roundingStrategies.active.round(decimalTextOf(value), STORAGE_SCALE, RoundingMode.HALF_UP);
}

/**
 * @param value A decimal as a driver or an exact sum answered it.
 * @returns Its plain decimal text, never in exponential notation for a magnitude a column can hold.
 */
function decimalTextOf(value: DecimalString | number | bigint): DecimalString {
	if (typeof value === 'number') {
		const text = String(value);

		return Number.isFinite(value) && /e/i.test(text) ? value.toFixed(WORKING_SCALE) : text;
	}

	return typeof value === 'bigint' ? value.toString() : String(value).trim();
}
