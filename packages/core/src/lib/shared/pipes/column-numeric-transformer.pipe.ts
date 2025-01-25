import { ValueTransformer } from 'typeorm';
import { isNotNullOrUndefined } from '@gauzy/utils';

/**
 * Convert Non-integer numbers string to integer
 *
 * From https://github.com/typeorm/typeorm/issues/873#issuecomment-502294597
 */
export class ColumnNumericTransformerPipe implements ValueTransformer {
	/**
	 * Converts a number for storage in the database.
	 * If the value is not defined, it returns null.
	 *
	 * @param value - The number to convert.
	 * @returns The number itself, or null if undefined.
	 */
	to(value: number): number | null {
		return isNotNullOrUndefined(value) ? value : null; // Return the number for storage
	}

	/**
	 * Transforms a string to the entity property value.
	 *
	 * @param value - The input string.
	 * @returns The transformed number or null if the input is invalid.
	 */
	from(value?: string | null): number | null {
		return isNotNullOrUndefined(value) ? parseFloat(value) : null; // Convert string to number
	}
}
