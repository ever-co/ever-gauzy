/**
 * The statements `CreatePricingTables1791000000120` issues on each dialect (review R2-25).
 *
 * The MySQL branch declared `deletedKey` — the stored generated column that stands in for a partial unique
 * index there — inside each of four `CREATE TABLE` statements, and then ran `ALTER TABLE … ADD COLUMN deletedKey`
 * on the same four tables. MySQL refuses the second declaration (`1060 Duplicate column name 'deletedKey'`), so a
 * fresh MySQL installation stopped at boot on the first one. SQLite and PostgreSQL never execute that branch, and no
 * CI job runs the migration chain on MySQL, so nothing saw it.
 *
 * The migration is run here against a query runner that records each statement instead of executing it, once per
 * dialect, and the columns every table ends up with are derived from what was recorded: a column declared twice on
 * one table is a statement the database refuses, on every dialect. The real-MySQL run that reproduced the 1060 and
 * proved the fix is in the pull request that added this suite.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));

import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { CreatePricingTables1791000000120 } from './1791000000120-CreatePricingTables';

/** The statements one direction of the migration issues on one dialect. */
async function statementsOf(type: DatabaseTypeEnum, direction: 'up' | 'down' = 'up'): Promise<string[]> {
	const statements: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		query: async (sql: string) => {
			statements.push(sql);
			return [];
		}
	} as unknown as QueryRunner;

	const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	try {
		await new CreatePricingTables1791000000120()[direction](queryRunner);
	} finally {
		log.mockRestore();
	}

	return statements;
}

/** An identifier with its dialect's quotes taken off. */
const unquote = (identifier: string) => identifier.replace(/^[`"]|[`"]$/g, '');

/** Splits the body of a CREATE TABLE at its top-level commas. */
function topLevelParts(body: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let current = '';

	for (const char of body) {
		if (quote) {
			quote = char === quote ? null : quote;
		} else if (char === "'") {
			quote = char;
		} else if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
		} else if (char === ',' && depth === 0) {
			parts.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}
	parts.push(current.trim());

	return parts;
}

const CONSTRAINT_KEYWORDS = /^(CONSTRAINT|PRIMARY|INDEX|KEY|UNIQUE|FOREIGN|CHECK|FULLTEXT|SPATIAL)\b/i;

/**
 * Every column each table is given, in the order the statements give them, with a repeat kept as a repeat.
 *
 * @param statements What the migration issued.
 * @returns The column names declared per table.
 */
function declaredColumns(statements: string[]): Map<string, string[]> {
	const tables = new Map<string, string[]>();

	for (const sql of statements) {
		const create = /^CREATE TABLE (?:IF NOT EXISTS )?([`"]?\w+[`"]?)\s*\(([\s\S]*)\)[^)]*$/i.exec(sql.trim());
		if (create) {
			const columns = topLevelParts(create[2])
				.filter((part) => !CONSTRAINT_KEYWORDS.test(part))
				.map((part) => unquote(part.split(/\s+/)[0]));
			tables.set(unquote(create[1]), columns);
			continue;
		}

		const add = /^ALTER TABLE ([`"]?\w+[`"]?)\s+ADD (?:COLUMN )?([`"]\w+[`"])/i.exec(sql.trim());
		if (add) {
			const table = unquote(add[1]);
			tables.set(table, [...(tables.get(table) ?? []), unquote(add[2])]);
		}
	}

	return tables;
}

/** The columns a table is given more than once. */
const repeated = (columns: string[]) => columns.filter((column, index) => columns.indexOf(column) !== index);

describe('CreatePricingTables1791000000120 — the statements each dialect runs (R2-25)', () => {
	const PRICING_TABLES = ['price_list', 'product_price', 'price_preference', 'exchange_rate'];

	it.each([DatabaseTypeEnum.mysql, DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite])(
		'%s: creates the four tables and declares no column of any of them twice',
		async (type) => {
			const tables = declaredColumns(await statementsOf(type));

			expect([...tables.keys()].sort()).toEqual([...PRICING_TABLES].sort());
			for (const [table, columns] of tables) {
				expect({ table, repeated: repeated(columns) }).toEqual({ table, repeated: [] });
			}
		}
	);

	it('mysql: each table declares its `deletedKey` once, before the unique index that keys on it', async () => {
		const statements = await statementsOf(DatabaseTypeEnum.mysql);
		const tables = declaredColumns(statements);

		for (const table of PRICING_TABLES) {
			expect({
				table,
				deletedKey: tables.get(table)?.filter((column) => column === 'deletedKey').length
			}).toEqual({
				table,
				deletedKey: 1
			});
		}

		// No statement adds the column a second time, and every unique index that names it comes after the
		// CREATE TABLE that declared it.
		expect(statements.filter((sql) => /ADD COLUMN `deletedKey`/.test(sql))).toEqual([]);
		for (const index of statements.filter((sql) => /^CREATE UNIQUE INDEX .*`deletedKey`/.test(sql))) {
			const table = /ON `(\w+)`/.exec(index)?.[1];
			const created = statements.findIndex((sql) => sql.startsWith(`CREATE TABLE \`${table}\``));

			expect(created).toBeGreaterThanOrEqual(0);
			expect(created).toBeLessThan(statements.indexOf(index));
		}
	});

	it('mysql: no column a cascading foreign key writes is the base of a STORED generated column', async () => {
		// MySQL refuses `ON DELETE CASCADE` / `SET NULL` on a base column of a STORED generated column
		// (`1215 Cannot add foreign key constraint`) — the error the run on MySQL 8.0.22 met next, once the duplicate
		// `deletedKey` was gone: `product_price.priceListId` cascades with its list and fed the STORED `priceListKey`.
		const statements = await statementsOf(DatabaseTypeEnum.mysql);
		const storedBases = new Map<string, Set<string>>();

		for (const sql of statements) {
			const create = /^CREATE TABLE `(\w+)`\s*\(([\s\S]*)\)[^)]*$/.exec(sql.trim());
			if (!create) {
				continue;
			}
			const bases = new Set<string>();
			for (const part of topLevelParts(create[2]).filter((one) =>
				/GENERATED ALWAYS AS[\s\S]*\bSTORED$/i.test(one)
			)) {
				const expression = part.slice(part.search(/GENERATED ALWAYS AS/i));
				for (const [, column] of expression.matchAll(/`(\w+)`/g)) {
					bases.add(column);
				}
			}
			storedBases.set(create[1], bases);
		}

		const offending = statements
			.map((sql) =>
				/^ALTER TABLE `(\w+)` ADD CONSTRAINT `\w+` FOREIGN KEY \(`(\w+)`\)[\s\S]*ON (?:DELETE|UPDATE) (?:CASCADE|SET NULL)/.exec(
					sql
				)
			)
			.filter((match): match is RegExpExecArray => !!match && !!storedBases.get(match[1])?.has(match[2]))
			.map((match) => `${match[1]}.${match[2]}`);

		expect(offending).toEqual([]);
	});

	it('mysql: the down migration drops the four tables', async () => {
		const statements = await statementsOf(DatabaseTypeEnum.mysql, 'down');

		for (const table of PRICING_TABLES) {
			expect(statements.some((sql) => new RegExp(`^DROP TABLE \`${table}\``).test(sql))).toBe(true);
		}
	});
});
