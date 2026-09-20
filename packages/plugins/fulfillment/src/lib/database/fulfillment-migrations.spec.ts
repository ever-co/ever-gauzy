/**
 * The tick that states the version column of the fulfilment aggregate.
 *
 * A migration is judged by what it issues on a database in each of the states a real installation
 * reaches, so the runner below is a recording double rather than a database: the statements are
 * asserted, the catalogue probes are answered, and nothing is executed. What the suite pins is
 * therefore the whole of the file's contract — the column and its default are stated where they are
 * missing, nothing at all is issued where they are already there, `down` reverses exactly what `up`
 * can have changed, and a dialect the file has no statements for is refused rather than silently
 * skipped.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites state: its
 * barrel boots the whole application graph, which importing the migration set would otherwise do. The
 * migration under test calls nothing in it.
 */
jest.mock('@gauzy/core', () => ({}));

import { DatabaseTypeEnum } from '@gauzy/config';
import { ALL_FULFILLMENT_MIGRATIONS } from './fulfillment-migrations';
import { AddFulfillmentVersionColumn1791000000610 } from './migrations/1791000000610-AddFulfillmentVersionColumn';

/**
 * A query runner that records what a migration asked for.
 *
 * @param state The dialect, the tables and columns the database has, and the default its catalogue
 * reports for the version column.
 */
function recordingRunner(state: {
	type: DatabaseTypeEnum;
	tables?: string[];
	columns?: Record<string, string[]>;
	versionDefault?: string;
}) {
	const statements: string[] = [];
	const tables = state.tables ?? ['fulfillment'];
	const columns = state.columns ?? { fulfillment: ['version'] };

	return {
		statements,
		connection: { options: { type: state.type } },
		hasTable: async (table: string) => tables.includes(table),
		hasColumn: async (table: string, column: string) => (columns[table] ?? []).includes(column),
		query: async (sql: string) => {
			statements.push(sql);

			// The default probe is the only read this file makes. It answers with what the dialect
			// stores — PostgreSQL reports an integer default as the expression `'1'::integer` — or with
			// nothing at all when the column carries no default.
			if (/FROM information_schema\.columns/.test(sql)) {
				return state.versionDefault === undefined ? [] : [{ column_default: state.versionDefault }];
			}

			return [];
		}
	};
}

/**
 * The statements that change the schema, with the catalogue reads left out.
 *
 * A probe is a read and not a change, and the file's own contract is that `up` run twice issues probes
 * and no DDL — which is only assertable when the two are told apart.
 *
 * @param runner The recording runner.
 * @returns The statements that are not catalogue reads.
 */
const ddlOf = (runner: { statements: string[] }): string[] =>
	runner.statements.filter((statement) => !statement.startsWith('SELECT '));

describe('AddFulfillmentVersionColumn1791000000610 — what it issues', () => {
	it('adds the version column, and its default, only where the database carries neither', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, columns: { fulfillment: [] } });

		await new AddFulfillmentVersionColumn1791000000610().up(runner as never);

		expect(ddlOf(runner)).toEqual([
			'ALTER TABLE "fulfillment" ADD COLUMN "version" integer NOT NULL DEFAULT 1',
			'ALTER TABLE "fulfillment" ALTER COLUMN "version" SET DEFAULT 1'
		]);
	});

	it('issues no DDL at all on a database that already carries the column and its default', async () => {
		// The state every installation the create tick has reached is in, and the property that makes
		// `up` safe to run twice. The catalogue reports the default the way PostgreSQL stores it, which
		// is the form the comparison has to read.
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, versionDefault: "'1'::integer" });

		await new AddFulfillmentVersionColumn1791000000610().up(runner as never);
		await new AddFulfillmentVersionColumn1791000000610().up(runner as never);

		expect(ddlOf(runner)).toEqual([]);
		expect(runner.statements.length).toBeGreaterThan(0);
	});

	it('states the default in each dialect’s own form, and skips it where the dialect cannot', async () => {
		const mysql = recordingRunner({ type: DatabaseTypeEnum.mysql, columns: { fulfillment: [] } });

		await new AddFulfillmentVersionColumn1791000000610().up(mysql as never);

		expect(ddlOf(mysql)).toContain('ALTER TABLE `fulfillment` MODIFY COLUMN `version` int NOT NULL DEFAULT 1');

		const sqlite = recordingRunner({ type: DatabaseTypeEnum.betterSqlite3, columns: { fulfillment: [] } });

		await new AddFulfillmentVersionColumn1791000000610().up(sqlite as never);

		expect(ddlOf(sqlite)).toContain('ALTER TABLE "fulfillment" ADD COLUMN "version" integer NOT NULL DEFAULT 1');
		// SQLite has no `ALTER COLUMN` at all, and the entity's declaration is what a row receives there.
		expect(ddlOf(sqlite).some((statement) => statement.includes('ALTER COLUMN'))).toBe(false);
	});

	it('leaves a database without the table entirely alone', async () => {
		// A set may be run against a database whose tables an earlier tick of the same set has not
		// created yet in a partial restore; issuing DDL against a table that is not there is the one
		// failure a guard of this kind exists to avoid.
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, tables: [] });

		await new AddFulfillmentVersionColumn1791000000610().up(runner as never);

		expect(ddlOf(runner)).toEqual([]);
	});

	it('reverses the default, and leaves the column the create tick owns', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres });

		await new AddFulfillmentVersionColumn1791000000610().down(runner as never);

		expect(ddlOf(runner)).toEqual(['ALTER TABLE "fulfillment" ALTER COLUMN "version" DROP DEFAULT']);
		// `fulfillment.version` is the counter the create tick declares and every transition increments,
		// so dropping it would destroy a fact this tick never created.
		expect(ddlOf(runner).some((statement) => statement.includes('DROP COLUMN'))).toBe(false);
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddFulfillmentVersionColumn1791000000610().up(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('is the last tick of the plugin’s set', () => {
		// A migration's timestamp is frozen once it has shipped, so this one runs after every file the
		// set already holds and cannot be inserted between two of them.
		expect(ALL_FULFILLMENT_MIGRATIONS[ALL_FULFILLMENT_MIGRATIONS.length - 1]).toBe(
			AddFulfillmentVersionColumn1791000000610
		);
		expect(ALL_FULFILLMENT_MIGRATIONS).toContain(AddFulfillmentVersionColumn1791000000610);
	});
});
