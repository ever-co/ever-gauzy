import { QueryRunner } from 'typeorm';
import { CreateTaxRatePartTable1791000000145 } from './1791000000145-CreateTaxRatePartTable';
import { CreateTaxRegimeTables1791000000146 } from './1791000000146-CreateTaxRegimeTables';

/**
 * node-postgres binds parameters as `$1`, `$2`, …; a `?` reaches the server as SQL and is a syntax error there. The
 * tax migrations' `hasForeignKey` used `?` on PostgreSQL, so the API stopped on every PostgreSQL database at
 * `CreateTaxRatePartTable1791000000145` (`QueryFailedError: syntax error at or near "AND"`, upgrade test run
 * 38525121055) — SQLite and MySQL, which do bind `?`, never showed it.
 *
 * The runner below answers the way PostgreSQL does: a parameterised statement must use `$n` placeholders, exactly as
 * many as there are parameters.
 */
function postgresRunner(): { runner: QueryRunner; statements: string[] } {
	const statements: string[] = [];
	const runner = {
		connection: { options: { type: 'postgres' } },
		hasColumn: async () => false,
		query: async (sql: string, parameters?: unknown[]) => {
			statements.push(sql);
			if (parameters?.length) {
				const code = sql.replace(/'(?:[^']|'')*'/g, "''");
				if (code.includes('?')) {
					throw new Error(`syntax error at or near "?": a "?" placeholder reached PostgreSQL in: ${sql}`);
				}
				const highest = Math.max(0, ...[...code.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])));
				if (highest !== parameters.length) {
					throw new Error(`$1..$${highest} placeholders for ${parameters.length} parameters in: ${sql}`);
				}
			}
			return [];
		}
	} as unknown as QueryRunner;

	return { runner, statements };
}

describe('tax migrations on PostgreSQL bind their parameters as $n', () => {
	it.each([
		['CreateTaxRatePartTable1791000000145', () => new CreateTaxRatePartTable1791000000145()],
		['CreateTaxRegimeTables1791000000146', () => new CreateTaxRegimeTables1791000000146()]
	])('%s runs up and down', async (_name, create) => {
		const migration = create();
		const { runner, statements } = postgresRunner();

		await expect(migration.up(runner)).resolves.toBeUndefined();
		await expect(migration.down(runner)).resolves.toBeUndefined();

		// The foreign-key existence checks are among the statements that ran, so the case covers the helper.
		expect(statements.some((sql) => /information_schema\.table_constraints/i.test(sql))).toBe(true);
	});
});
