import { isMySQL, isPostgres } from '@gauzy/config';

/**
 * Driver-conditional column types shared by the Documents entities.
 *
 * The mapping is intentionally identical to the inline `isPostgres() ? … : isMySQL() ? … : …`
 * expressions these helpers replace — a different resolution for ANY driver silently changes
 * the generated schema, so the fallback branch (SQLite / better-sqlite3 / anything else) must
 * stay the catch-all it has always been.
 *
 * `isPostgres()` / `isMySQL()` read module-load-time constants derived from `DB_TYPE`, so a
 * helper call resolves exactly like the inline ternary did at decorator-evaluation time.
 *
 * | driver          | {@link jsonColumnType} | {@link binaryColumnType} | {@link floatColumnType} |
 * | --------------- | ---------------------- | ------------------------ | ----------------------- |
 * | postgres        | `jsonb`                | `bytea`                  | `double precision`      |
 * | mysql           | `json`                 | `longblob`               | `double`                |
 * | sqlite          | `text`                 | `blob`                   | `real`                  |
 * | better-sqlite3  | `text`                 | `blob`                   | `real`                  |
 */

/**
 * Column type of a JSON document payload.
 *
 * Stored as `jsonb` (PostgreSQL) / `json` (MySQL) / `text` (SQLite — subscriber-serialized).
 *
 * @returns The JSON column type of the active driver.
 */
export function jsonColumnType(): 'jsonb' | 'json' | 'text' {
	if (isPostgres()) {
		return 'jsonb';
	}
	if (isMySQL()) {
		return 'json';
	}
	return 'text';
}

/**
 * Column type of a raw binary payload (the CRDT state columns).
 *
 * @returns The binary column type of the active driver.
 */
export function binaryColumnType(): 'bytea' | 'longblob' | 'blob' {
	if (isPostgres()) {
		return 'bytea';
	}
	if (isMySQL()) {
		return 'longblob';
	}
	return 'blob';
}

/**
 * Column type of a double-precision floating point value.
 *
 * @returns The float column type of the active driver.
 */
export function floatColumnType(): 'double precision' | 'double' | 'real' {
	if (isPostgres()) {
		return 'double precision';
	}
	if (isMySQL()) {
		return 'double';
	}
	return 'real';
}
