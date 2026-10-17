/**
 * The four things a raw statement has to get right to run on all four dialects.
 *
 * Every case here stands for a failure that reached this branch. MySQL reads a double-quoted
 * identifier as a string literal, so `SET quantity = "quantity" + 1` wrote `1` over an aggregate and
 * reported success. A statement written with `:name` and handed an array bound nothing, so coupon
 * redemption and every campaign ceiling raised a syntax error away from SQLite. And an affected-row
 * count read for one driver's result shape reads as zero on the other three, which turns a write
 * that landed into a version conflict the caller is told to retry.
 *
 * The dialect is a process-wide decision read from the environment at import time, so it is a module
 * mock here rather than a booted configuration — which is also what lets one run assert all four.
 */
let mockDialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres';

jest.mock('@gauzy/config', () => ({
	isMySQL: () => mockDialect === 'mysql',
	isPostgres: () => mockDialect === 'postgres'
}));

import { PostgreSqlPlatform } from '@mikro-orm/postgresql';
import {
	booleanLiteral,
	currentTimestampExpression,
	prepareSQLQuery,
	quoteIdentifier,
	readAffectedRows,
	toPositionalStatement
} from './database.helper';

afterEach(() => {
	mockDialect = 'postgres';
});

describe('quoting an identifier', () => {
	it('uses the quoting the dialect reads as an identifier', () => {
		mockDialect = 'postgres';
		expect(quoteIdentifier('quantity')).toBe('"quantity"');

		mockDialect = 'sqlite';
		expect(quoteIdentifier('quantity')).toBe('"quantity"');

		mockDialect = 'mysql';
		// The case that made this necessary: MySQL reads `"quantity"` as the string `quantity`, so a
		// self-referencing increment silently became an assignment of a constant.
		expect(quoteIdentifier('quantity')).toBe('`quantity`');
	});

	it('leaves a whole statement to the existing rewrite, which is a different job', () => {
		mockDialect = 'mysql';
		// Control: `prepareSQLQuery` rewrites every double quote in a statement, which is right for a
		// statement written once and wrong for a fragment assembled from parts.
		expect(prepareSQLQuery('SELECT "id" FROM "coupon"')).toBe('SELECT `id` FROM `coupon`');
	});
});

describe('the literals the dialects spell differently', () => {
	it('writes a timestamp the dialect understands at the precision the platform carries', () => {
		mockDialect = 'postgres';
		expect(currentTimestampExpression()).toBe('now()');

		mockDialect = 'mysql';
		expect(currentTimestampExpression()).toBe('CURRENT_TIMESTAMP(6)');
	});

	it('writes a boolean as the column stores it', () => {
		mockDialect = 'postgres';
		expect(booleanLiteral(true)).toBe('true');
		expect(booleanLiteral(false)).toBe('false');

		mockDialect = 'mysql';
		// MySQL has no boolean type; the column is a `tinyint(1)` and the literal is written as one.
		expect(booleanLiteral(true)).toBe('1');
		expect(booleanLiteral(false)).toBe('0');
	});
});

describe('binding a statement written with named parameters', () => {
	it('numbers the placeholders for Postgres and marks them for the others', () => {
		mockDialect = 'postgres';
		expect(toPositionalStatement('UPDATE c SET n = n + 1 WHERE id = :id', { id: 'c-1' })).toEqual({
			sql: 'UPDATE c SET n = n + 1 WHERE id = $1',
			parameters: ['c-1']
		});

		mockDialect = 'mysql';
		expect(toPositionalStatement('UPDATE c SET n = n + 1 WHERE id = :id', { id: 'c-1' })).toEqual({
			sql: 'UPDATE c SET n = n + 1 WHERE id = ?',
			parameters: ['c-1']
		});

		mockDialect = 'sqlite';
		expect(toPositionalStatement('UPDATE c SET n = n + 1 WHERE id = :id', { id: 'c-1' })).toEqual({
			sql: 'UPDATE c SET n = n + 1 WHERE id = ?',
			parameters: ['c-1']
		});
	});

	it('binds a name used twice once per occurrence, in the order they appear', () => {
		mockDialect = 'postgres';
		// The statement that needs it: a ceiling compares `used + :amount` and then adds the same
		// `:amount` to the column, so one named value is two placeholders carrying the same figure.
		expect(
			toPositionalStatement('UPDATE b SET used = used + :amount WHERE used + :amount <= cap AND id = :id', {
				amount: 5,
				id: 'b-1'
			})
		).toEqual({
			sql: 'UPDATE b SET used = used + $1 WHERE used + $2 <= cap AND id = $3',
			parameters: [5, 5, 'b-1']
		});
	});

	it('marks every placeholder with ? for MikroORM, on Postgres too (#10678)', () => {
		// MikroORM's `Connection.execute()` fills `?` into the statement itself and sends it with no
		// bindings, so a `$1` reached Postgres unbound: "there is no parameter $1".
		mockDialect = 'postgres';
		expect(
			toPositionalStatement(
				'UPDATE b SET used = used + :amount WHERE used + :amount <= cap AND id = :id',
				{ amount: 5, id: 'b-1' },
				{ questionMarks: true }
			)
		).toEqual({
			sql: 'UPDATE b SET used = used + ? WHERE used + ? <= cap AND id = ?',
			parameters: [5, 5, 'b-1']
		});

		// The flag changes nothing where `?` is already the driver's placeholder.
		for (const dialect of ['mysql', 'sqlite'] as const) {
			mockDialect = dialect;
			expect(toPositionalStatement('SELECT 1 WHERE id = :id', { id: 'x' }, { questionMarks: true })).toEqual(
				toPositionalStatement('SELECT 1 WHERE id = :id', { id: 'x' })
			);
		}
	});

	it('keeps $n on Postgres when the flag is off or absent — the TypeORM path', () => {
		mockDialect = 'postgres';
		for (const options of [undefined, {}, { questionMarks: false }]) {
			expect(
				toPositionalStatement('SELECT 1 WHERE id = :id AND kind = :kind', { id: 'x', kind: 'y' }, options)
			).toEqual({ sql: 'SELECT 1 WHERE id = $1 AND kind = $2', parameters: ['x', 'y'] });
		}
	});

	it('gives MikroORM’s Postgres formatter a statement whose every value it binds', () => {
		mockDialect = 'postgres';
		// The formatter `Connection.execute()` runs before it sends the statement with no bindings.
		const platform = new PostgreSqlPlatform();
		const sql = 'SELECT * FROM bin WHERE "tenantId" = :tenantId AND "binId" = :binId';
		const parameters = { tenantId: 't-1', binId: 'b-1' };

		const forMikroOrm = toPositionalStatement(sql, parameters, { questionMarks: true });
		expect(platform.formatQuery(forMikroOrm.sql, forMikroOrm.parameters)).toBe(
			`SELECT * FROM bin WHERE "tenantId" = 't-1' AND "binId" = 'b-1'`
		);

		// Control: the TypeORM form leaves `$1` in the statement MikroORM sends, which Postgres cannot bind.
		const forTypeOrm = toPositionalStatement(sql, parameters);
		expect(platform.formatQuery(forTypeOrm.sql, forTypeOrm.parameters)).toContain('$1');
	});

	it('leaves alone a colon that is not a parameter', () => {
		mockDialect = 'postgres';
		// A `::` cast and a name nobody supplied are both colons that must survive untouched: binding
		// them to `undefined` would rewrite the statement into one the driver cannot run.
		expect(toPositionalStatement(`SELECT "amount"::numeric WHERE id = :id AND kind = :kind`, { id: 'x' })).toEqual({
			sql: `SELECT "amount"::numeric WHERE id = $1 AND kind = :kind`,
			parameters: ['x']
		});
	});
});

describe('reading how many rows a write changed', () => {
	it('reads the count out of every shape the four drivers answer with', () => {
		// MikroORM's `execute(..., 'run')`.
		expect(readAffectedRows(3)).toBe(3);
		// `pg`.
		expect(readAffectedRows({ rowCount: 2 })).toBe(2);
		// TypeORM's `UpdateResult`.
		expect(readAffectedRows({ affected: 1 })).toBe(1);
		// TypeORM's raw query on MySQL and on SQLite: `[rows, affected]`.
		expect(readAffectedRows([[], 4])).toBe(4);
		// The MySQL driver's own header.
		expect(readAffectedRows([{ affectedRows: 5 }])).toBe(5);
		// `better-sqlite3`'s own result object, in both the bare and the wrapped shape.
		expect(readAffectedRows({ changes: 6, lastInsertRowid: 12 })).toBe(6);
		expect(readAffectedRows([{ changes: 7 }])).toBe(7);
	});

	it('answers zero rather than a guess when the shape carries no count', () => {
		// Control: a guess here is worse than a zero, because a conditional write reads this count as
		// the whole answer — but a zero that is really "I could not tell" must not be invented from a
		// truthy object either.
		expect(readAffectedRows(null)).toBe(0);
		expect(readAffectedRows(undefined)).toBe(0);
		expect(readAffectedRows({})).toBe(0);
		expect(readAffectedRows([])).toBe(0);
		expect(readAffectedRows(Number.NaN)).toBe(0);
	});
});
