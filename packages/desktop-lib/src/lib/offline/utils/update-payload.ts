/**
 * What an UPDATE of the local database really writes.
 *
 * Knex leaves `undefined` values out of an UPDATE and throws "Empty .update() call detected!" when none is left
 * (#7811). The timer models serialize every field, set or not (`new Timer({ id }).toObject()` holds 19 keys, all
 * `undefined`), so counting keys never caught such an update: it reached Knex and failed the timer start.
 */

/** The column the local tables are addressed by. An update never rewrites it. */
export const PRIMARY_KEY_COLUMN = 'id';

/**
 * `values` without the keys whose value is `undefined` (Knex drops them anyway) and without `keyColumns` (the row is
 * addressed by them, so an update does not rewrite them). `null` is kept: it is a real write that clears a column.
 */
export function definedValues<T extends object>(
	values: T | null | undefined,
	keyColumns: readonly string[] = [PRIMARY_KEY_COLUMN]
): Partial<T> {
	const result: Partial<T> = {};
	if (!values) {
		return result;
	}
	for (const key of Object.keys(values) as Array<keyof T & string>) {
		if (values[key] !== undefined && !keyColumns.includes(key)) {
			result[key] = values[key];
		}
	}
	return result;
}

/**
 * The values an UPDATE of one row should write, or `null` when there is nothing to write and the update must be
 * skipped (Knex would throw on it).
 */
export function toUpdatePayload<T extends object>(
	values: T | null | undefined,
	keyColumns: readonly string[] = [PRIMARY_KEY_COLUMN]
): Partial<T> | null {
	const payload = definedValues(values, keyColumns);
	return Object.keys(payload).length > 0 ? payload : null;
}

/** Logs an update skipped by {@link toUpdatePayload}: nothing to write is not an error, but worth a trace. */
export function warnEmptyUpdate(scope: string, id: unknown): void {
	console.warn(`WARN[${scope}]: nothing to update for row ${id}, update skipped`);
}
