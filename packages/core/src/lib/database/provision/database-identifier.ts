import { DatabaseProvisionError } from './database-provisioner';

/**
 * Quoting a database name for `CREATE DATABASE`.
 *
 * `CREATE DATABASE` takes an identifier, never a bind parameter, so the name is quoted instead: wrapped in the
 * engine's identifier quote with every quote inside it doubled. That is the whole of the SQL rule, and it is what
 * `pg`'s own `escapeIdentifier` does; a name quoted this way is always read back as exactly one identifier, whatever
 * it contains (spaces, dots, semicolons, quotes, upper case), so it can neither break out of the statement nor be
 * folded to lower case.
 */

/** PostgreSQL keeps 63 bytes of an identifier (NAMEDATALEN - 1) and silently cuts the rest. */
export const POSTGRES_MAX_DATABASE_NAME_BYTES = 63;

/** MySQL refuses database names longer than 64 characters. */
export const MYSQL_MAX_DATABASE_NAME_LENGTH = 64;

/**
 * Checks that `name` can be a database name before it reaches `CREATE DATABASE`.
 *
 * A NUL byte cannot be part of any identifier, and an over-long PostgreSQL name would be created under a truncated
 * name the connection then does not find, so both are refused with a message naming the setting to fix.
 *
 * @throws {DatabaseProvisionError} (stage `config`) when the name is empty, too long or contains a NUL byte.
 */
export function assertValidDatabaseName(name: string, limit: { maxBytes?: number; maxLength?: number }): void {
	if (typeof name !== 'string' || name.length === 0) {
		throw new DatabaseProvisionError('DB_NAME is empty: there is no database to create.', 'config');
	}
	if (name.includes('\0')) {
		throw new DatabaseProvisionError('DB_NAME contains a NUL character, which no database name may contain.', 'config');
	}
	if (limit.maxBytes !== undefined && Buffer.byteLength(name, 'utf8') > limit.maxBytes) {
		throw new DatabaseProvisionError(
			`DB_NAME "${name}" is longer than ${limit.maxBytes} bytes, the longest database name the server keeps.`,
			'config'
		);
	}
	if (limit.maxLength !== undefined && [...name].length > limit.maxLength) {
		throw new DatabaseProvisionError(
			`DB_NAME "${name}" is longer than ${limit.maxLength} characters, the longest database name the server accepts.`,
			'config'
		);
	}
}

/** A PostgreSQL identifier: `"name"`, with every `"` inside doubled. */
export function quotePostgresIdentifier(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

/** A MySQL identifier: `` `name` ``, with every `` ` `` inside doubled. Dots stay inside the one identifier. */
export function quoteMySqlIdentifier(name: string): string {
	return `\`${name.replace(/`/g, '``')}\``;
}
