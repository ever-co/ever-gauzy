import { MigrationInterface, QueryRunner } from 'typeorm';
import { CreateTaxRatePartTable1791000000145 } from './migrations/1791000000145-CreateTaxRatePartTable';
import { CreateTaxRegimeTables1791000000146 } from './migrations/1791000000146-CreateTaxRegimeTables';

/**
 * node-postgres binds parameters as `$1`, `$2`, …; a `?` reaches the server as SQL and is a syntax error there. The
 * tax migrations' `hasForeignKey` used `?` on PostgreSQL, so the API stopped on every PostgreSQL database at
 * `CreateTaxRatePartTable1791000000145` (`QueryFailedError: syntax error at or near "AND"`, upgrade test run
 * 38525121055) — SQLite and MySQL, which do bind `?`, never showed it.
 *
 * The runner below answers the way PostgreSQL does: a parameterised statement must use `$n` placeholders, exactly as
 * many as there are parameters. `columnsExist` decides what `hasColumn` answers, because both migrations branch on
 * it (146 probes its foreign keys on `up` only when the party columns are there).
 */
function postgresRunner(columnsExist: boolean): { runner: QueryRunner; statements: string[] } {
	let statements: string[] = [];
	const runner = {
		connection: { options: { type: 'postgres' } },
		hasColumn: async () => columnsExist,
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

const probesForeignKeys = (statements: string[]) =>
	statements.some((sql) => /information_schema\.table_constraints/i.test(sql));

const migrations: Array<[string, () => MigrationInterface]> = [
	['CreateTaxRatePartTable1791000000145', () => new CreateTaxRatePartTable1791000000145()],
	['CreateTaxRegimeTables1791000000146', () => new CreateTaxRegimeTables1791000000146()]
];

describe('tax migrations on PostgreSQL bind their parameters as $n', () => {
	describe.each([
		['columns absent', false],
		['columns present', true]
	])('%s', (_label, columnsExist) => {
		it.each(migrations)('%s up', async (_name, create) => {
			const { runner, statements } = postgresRunner(columnsExist);

			await expect(create().up(runner)).resolves.toBeUndefined();

			// With the columns present both migrations probe their foreign keys on the way up.
			if (columnsExist) expect(probesForeignKeys(statements)).toBe(true);
		});

		it.each(migrations)('%s down', async (_name, create) => {
			const { runner, statements } = postgresRunner(columnsExist);

			await expect(create().down(runner)).resolves.toBeUndefined();

			if (columnsExist) expect(probesForeignKeys(statements)).toBe(true);
		});
	});
});
