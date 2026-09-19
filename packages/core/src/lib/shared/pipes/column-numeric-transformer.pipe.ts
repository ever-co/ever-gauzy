import { BadRequestException } from '@nestjs/common';
import { ValueTransformer } from 'typeorm';
import { isNotNullOrUndefined } from '@gauzy/utils';

/**
 * Rounds half away from zero, as Postgres `numeric` and MySQL `decimal` do, without binary
 * `toFixed` (e.g. `1.005` → `1.01`, not `1.00`; `-1.005` → `-1.01`).
 *
 * Returns `NaN` when `Number(value)` is not finite, rather than a made-up `0`. Callers parse input
 * first (`Number('')` is `0`), as `ColumnNumericTransformerPipe.to()` and the employee DTO do.
 */
export function roundToScale(value: unknown, scale = 2): number {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return NaN;
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
 * Convert Non-integer numbers string to integer
 *
 * From https://github.com/typeorm/typeorm/issues/873#issuecomment-502294597
 *
 * Pass `scale` (for money, 2) so SQLite REAL and skipped class-transform still persist
 * the declared decimal places.
 */
export class ColumnNumericTransformerPipe implements ValueTransformer {
	constructor(private readonly scale?: number) {}

	/**
	 * Converts a number for storage in the database.
	 * If the value is not defined, it returns null.
	 *
	 * @param value - The number to convert.
	 * @returns The number itself, or null if undefined.
	 * @throws BadRequestException when a `scale` is set and the value is not a finite number.
	 */
	to(value: number): number | null {
		if (!isNotNullOrUndefined(value)) {
			return null;
		}
		if (this.scale == null) {
			return value;
		}
		// Parse strings like the DTO transform does, and refuse anything else instead of storing 0:
		// routes that skip DTO validation (e.g. employee create) must not turn 'abc' into a rate.
		const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
		const rounded = roundToScale(n, this.scale);
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
		const parsed = parseFloat(value as string);
		if (!Number.isFinite(parsed)) {
			return null;
		}
		return this.scale == null ? parsed : roundToScale(parsed, this.scale);
	}
}
