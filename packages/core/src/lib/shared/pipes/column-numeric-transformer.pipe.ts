import { BadRequestException } from '@nestjs/common';
import { ValueTransformer } from 'typeorm';
import { isNotNullOrUndefined } from '@gauzy/utils';

/**
 * Rounds half away from zero, as Postgres `numeric` and MySQL `decimal` do, without binary
 * `toFixed` (e.g. `1.005` → `1.01`, not `1.00`; `-1.005` → `-1.01`).
 *
 * Returns `NaN` when `Number(value)` is not finite, rather than a made-up `0`. Callers parse input
 * first (`Number('')` is `0`), as `ColumnNumericTransformerPipe.to()` and `toBillingRate` do.
 */
export function roundToScale(value: unknown, scale = 2): number {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return Number.NaN;
	}
	const magnitude = Math.abs(n);
	// Past 2^53 at this scale a double has no fractional digits left to round; shifting would only drift or overflow.
	if (magnitude * 10 ** scale >= Number.MAX_SAFE_INTEGER) {
		return n;
	}
	let rounded = Number(Math.round(Number(`${magnitude}e${scale}`)) + `e-${scale}`);
	// `${magnitude}e${scale}` is not a number when `magnitude` itself prints in exponent form (e.g. 1e-7).
	if (!Number.isFinite(rounded)) {
		rounded = Math.round(magnitude * 10 ** scale) / 10 ** scale;
	}
	return n < 0 && rounded !== 0 ? -rounded : rounded;
}

/**
 * A number as is, a string through `parseFloat` (as `toBillingRate` does), anything
 * else `NaN`.
 */
function parseNumeric(value: unknown): number {
	if (typeof value === 'number') {
		return value;
	}
	return typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
}

/**
 * Keeps a numeric column a number on the way in, and a number on the way out.
 *
 * Convert Non-integer numbers string to integer
 *
 * From https://github.com/typeorm/typeorm/issues/873#issuecomment-502294597
 *
 * Pass `scale` (for money, 2) so SQLite REAL and skipped class-transform still persist
 * the declared decimal places.
 *
 * ## Why an undefined value is passed through rather than turned into `null`
 *
 * A column the caller did not state has to be **left out of the statement**, because that is the only
 * way the column's own default can apply: TypeORM omits an `undefined` property from the `INSERT`, and
 * the database then writes the `default` the migration declared. Returning `null` here instead put an
 * explicit `NULL` into the statement, which overrode that default — so every `numeric` column declared
 * `NOT NULL DEFAULT 0` refused the insert whenever a caller created the row without naming the field,
 * and the caller saw a validation error about a member no request is supposed to state. A party's
 * `creditUsed` and `loyaltyPoints` are the case that surfaced it; every other numeric column with a
 * default had the same behaviour. It is a defect in the transformer rather than in its callers: a
 * default exists precisely so that the field may be omitted.
 *
 * A `null` the caller *did* state is still a `null` — clearing a nullable column is a legitimate write.
 */
export class ColumnNumericTransformerPipe implements ValueTransformer {
	constructor(private readonly scale?: number) {}

	/**
	 * Converts a number for storage in the database.
	 *
	 * @param value - The number to store, `null` to clear the column, or `undefined` to leave it out
	 * of the statement so the column's own default applies. Typed `unknown`: routes that skip DTO
	 * validation (e.g. employee create) pass the raw request value through.
	 * @returns The number itself, `null`, or `undefined`.
	 * @throws BadRequestException when a `scale` is set and the value is not a finite number.
	 */
	to(value?: unknown): number | null | undefined {
		if (value === undefined) {
			// Deliberately undefined rather than null: see the class comment.
			return undefined;
		}
		if (value === null) {
			return null;
		}
		if (this.scale == null) {
			return value as number;
		}
		// Raw input from routes that skip DTO validation (create, bulk, import): a blank string means
		// "no value", like null. (Validated routes turn '' into 0 before it gets here.)
		if (typeof value === 'string' && value.trim() === '') {
			return null;
		}
		// Refuse anything that does not parse instead of storing 0: 'abc' must not become a rate.
		const rounded = roundToScale(parseNumeric(value), this.scale);
		if (!Number.isFinite(rounded)) {
			throw new BadRequestException('Invalid numeric value: expected a finite number.');
		}
		return rounded;
	}

	/**
	 * Transforms a string to the entity property value.
	 *
	 * @param value - The input string.
	 * @returns The transformed number or null if the input is invalid.
	 */
	from(value?: string | null): number | null {
		if (!isNotNullOrUndefined(value)) {
			return null;
		}
		const parsed = Number.parseFloat(value as string);
		if (!Number.isFinite(parsed)) {
			return null;
		}
		return this.scale == null ? parsed : roundToScale(parsed, this.scale);
	}
}
