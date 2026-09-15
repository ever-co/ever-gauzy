import { ValueTransformer } from 'typeorm';
import { isNotNullOrUndefined } from '@gauzy/utils';

/**
 * Half-up rounding that does not use binary `toFixed` (e.g. `1.005` → `1.01`, not `1.00`).
 */
export function roundToScale(value: unknown, scale = 2): number {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return 0;
	}
	return Number(Math.round(Number(`${n}e${scale}`)) + `e-${scale}`);
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
	 */
	to(value: number): number | null {
		if (!isNotNullOrUndefined(value)) {
			return null;
		}
		return this.scale == null ? value : roundToScale(value, this.scale);
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
