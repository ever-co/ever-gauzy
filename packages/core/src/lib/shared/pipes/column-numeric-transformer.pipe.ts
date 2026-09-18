import { ValueTransformer } from 'typeorm';
import { isNotNullOrUndefined } from '@gauzy/utils';

/**
 * Keeps a numeric column a number on the way in, and a number on the way out.
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
 *
 * The conversion itself is the platform's own, kept from the original.
 */
export class ColumnNumericTransformerPipe implements ValueTransformer {
	/**
	 * Converts a number for storage in the database.
	 *
	 * @param value The number to store, `null` to clear the column, or `undefined` to leave it out of
	 * the statement so the column's own default applies.
	 * @returns The number itself, `null`, or `undefined`.
	 */
	to(value?: number | null): number | null | undefined {
		if (value === undefined) {
			// Deliberately undefined rather than null: see the class comment.
			return undefined;
		}

		return isNotNullOrUndefined(value) ? value : null;
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
