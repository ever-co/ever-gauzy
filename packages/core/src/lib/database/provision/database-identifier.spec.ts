import {
	assertValidDatabaseName,
	MYSQL_MAX_DATABASE_NAME_LENGTH,
	POSTGRES_MAX_DATABASE_NAME_BYTES,
	quoteMySqlIdentifier,
	quotePostgresIdentifier
} from './database-identifier';
import { DatabaseProvisionError } from './database-provisioner';

describe('database identifier quoting', () => {
	it('wraps a PostgreSQL name in double quotes and doubles the quotes inside it', () => {
		expect(quotePostgresIdentifier('gauzy')).toBe('"gauzy"');
		expect(quotePostgresIdentifier('Gauzy Dev')).toBe('"Gauzy Dev"');
		expect(quotePostgresIdentifier('a"; DROP DATABASE x; --')).toBe('"a""; DROP DATABASE x; --"');
	});

	it('wraps a MySQL name in backticks, doubles the backticks inside it and keeps dots in the one identifier', () => {
		expect(quoteMySqlIdentifier('gauzy')).toBe('`gauzy`');
		expect(quoteMySqlIdentifier('my.db')).toBe('`my.db`');
		expect(quoteMySqlIdentifier('a`; DROP DATABASE x; --')).toBe('`a``; DROP DATABASE x; --`');
	});
});

describe('assertValidDatabaseName', () => {
	function stageOf(fn: () => void): string | undefined {
		try {
			fn();
			return undefined;
		} catch (error) {
			expect(error).toBeInstanceOf(DatabaseProvisionError);
			return (error as DatabaseProvisionError).stage;
		}
	}

	it('accepts ordinary names, including ones that need quoting', () => {
		expect(() => assertValidDatabaseName('gauzy', { maxBytes: POSTGRES_MAX_DATABASE_NAME_BYTES })).not.toThrow();
		expect(() =>
			assertValidDatabaseName('Gauzy Dev-1', { maxLength: MYSQL_MAX_DATABASE_NAME_LENGTH })
		).not.toThrow();
	});

	it('refuses an empty name and a NUL byte as a configuration error', () => {
		expect(stageOf(() => assertValidDatabaseName('', {}))).toBe('config');
		expect(stageOf(() => assertValidDatabaseName('ga\0uzy', {}))).toBe('config');
	});

	it('refuses a PostgreSQL name over 63 bytes, counting bytes rather than characters', () => {
		expect(stageOf(() => assertValidDatabaseName('a'.repeat(63), { maxBytes: 63 }))).toBeUndefined();
		expect(stageOf(() => assertValidDatabaseName('a'.repeat(64), { maxBytes: 63 }))).toBe('config');
		// 32 two-byte characters are 64 bytes.
		expect(stageOf(() => assertValidDatabaseName('é'.repeat(32), { maxBytes: 63 }))).toBe('config');
	});

	it('refuses a MySQL name over 64 characters', () => {
		expect(stageOf(() => assertValidDatabaseName('é'.repeat(64), { maxLength: 64 }))).toBeUndefined();
		expect(stageOf(() => assertValidDatabaseName('a'.repeat(65), { maxLength: 64 }))).toBe('config');
	});
});
