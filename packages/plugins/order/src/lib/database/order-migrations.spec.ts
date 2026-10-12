/**
 * The tick that states the version column of the two versioned aggregates.
 *
 * A migration is judged by what it issues on a database in each of the states a real installation
 * reaches, so the runner below is a recording double rather than a database: the statements are
 * asserted, the catalogue probes are answered, and nothing is executed. What the suite pins is
 * therefore the whole of the file's contract — the column and its default are stated where they are
 * missing, nothing at all is issued where they are already there, the index creation tolerates a
 * database that carries it, `down` reverses exactly what `up` can have changed, and a dialect the file
 * has no statements for is refused rather than silently skipped.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites state: its
 * barrel boots the whole application graph, which importing the migration set would otherwise do. The
 * migration under test calls nothing in it.
 */
jest.mock('@gauzy/core', () => ({}));

import { DatabaseTypeEnum } from '@gauzy/config';
import { ALL_ORDER_MIGRATIONS } from './order-migrations';
import { AddOrderVersionedColumns1791000000560 } from './migrations/1791000000560-AddOrderVersionedColumns';

/**
 * A query runner that records what a migration asked for.
 *
 * @param state The dialect, the tables and columns the database has, the indexes its catalogue
 * carries, and the default the catalogue reports for a version column.
 */
function recordingRunner(state: {
	type: DatabaseTypeEnum;
	tables?: string[];
	columns?: Record<string, string[]>;
	indexes?: string[];
	versionDefault?: string;
}) {
	const statements: string[] = [];
	const tables = state.tables ?? ['order', 'order_change'];
	const columns = state.columns ?? { order: ['version'], order_change: ['version'] };
	const indexes = state.indexes ?? ['IDX_order_change_version'];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasTable: async (table: string) => tables.includes(table),
		hasColumn: async (table: string, column: string) => (columns[table] ?? []).includes(column),
		query: async (sql: string) => {
			statements.push(sql);

			// The catalogue probes are the only reads. The index probe answers with a row when the index
			// is there; the default probe answers with what the dialect stores — PostgreSQL reports an
			// integer default as the expression `'1'::integer`.
			if (/FROM (pg_indexes|sqlite_master|information_schema\.statistics)/.test(sql)) {
				return indexes.length ? [{ present: 1 }] : [];
			}

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

describe('AddOrderVersionedColumns1791000000560 — what it issues', () => {
	it('adds the order’s version column, and its default, only where the database carries neither', async () => {
		const runner = recordingRunner({
			type: DatabaseTypeEnum.postgres,
			columns: { order: [], order_change: ['version'] },
			indexes: []
		});

		await new AddOrderVersionedColumns1791000000560().up(runner as never);

		expect(ddlOf(runner)).toEqual([
			'ALTER TABLE "order" ADD COLUMN "version" integer NOT NULL DEFAULT 1',
			'ALTER TABLE "order" ALTER COLUMN "version" SET DEFAULT 1',
			'CREATE INDEX IF NOT EXISTS "IDX_order_change_version" ON "order_change" ("orderId", "version")'
		]);
	});

	it('leaves the change’s version column exactly as the create tick declared it', async () => {
		// That column is the order version a change produces, not a lock, so this tick states no default
		// and no type change for it: a default would be a fact the design does not hold, and the column
		// is written by the change's own creation.
		const runner = recordingRunner({
			type: DatabaseTypeEnum.postgres,
			columns: { order: ['version'], order_change: ['version'] },
			indexes: [],
			versionDefault: "'1'::integer"
		});

		await new AddOrderVersionedColumns1791000000560().up(runner as never);

		expect(ddlOf(runner).some((statement) => statement.startsWith('ALTER TABLE "order_change"'))).toBe(false);
		expect(ddlOf(runner)).toEqual([
			'CREATE INDEX IF NOT EXISTS "IDX_order_change_version" ON "order_change" ("orderId", "version")'
		]);
	});

	it('issues no DDL at all on a database that already carries the column and the index', async () => {
		// The property that makes `up` safe to run twice, and safe on a database whose schema the ORM
		// synchronised before the migration reached it. The catalogue reports the default the way
		// PostgreSQL stores it, which is the form the comparison has to read.
		const runner = recordingRunner({
			type: DatabaseTypeEnum.postgres,
			versionDefault: "'1'::integer"
		});

		await new AddOrderVersionedColumns1791000000560().up(runner as never);
		await new AddOrderVersionedColumns1791000000560().up(runner as never);

		expect(ddlOf(runner)).toEqual([]);
		expect(runner.statements.length).toBeGreaterThan(0);
	});

	it('states the default in each dialect’s own form, and skips it where the dialect cannot', async () => {
		const mysql = recordingRunner({
			type: DatabaseTypeEnum.mysql,
			columns: { order: [], order_change: ['version'] },
			indexes: []
		});

		await new AddOrderVersionedColumns1791000000560().up(mysql as never);

		expect(ddlOf(mysql)).toContain('ALTER TABLE `order` MODIFY COLUMN `version` int NOT NULL DEFAULT 1');
		// MySQL has no `IF NOT EXISTS` for an index; the catalogue probe is what makes the statement safe.
		expect(ddlOf(mysql)).toContain('CREATE INDEX `IDX_order_change_version` ON `order_change` (`orderId`, `version`)');

		const sqlite = recordingRunner({
			type: DatabaseTypeEnum.betterSqlite3,
			columns: { order: [], order_change: ['version'] },
			indexes: []
		});

		await new AddOrderVersionedColumns1791000000560().up(sqlite as never);

		expect(ddlOf(sqlite)).toContain('ALTER TABLE "order" ADD COLUMN "version" integer NOT NULL DEFAULT 1');
		expect(ddlOf(sqlite).some((statement) => statement.includes('ALTER COLUMN'))).toBe(false);
	});

	it('reverses the default and the index, and leaves the column the create tick owns', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres });

		await new AddOrderVersionedColumns1791000000560().down(runner as never);

		expect(ddlOf(runner)).toEqual([
			'DROP INDEX "IDX_order_change_version"',
			'ALTER TABLE "order" ALTER COLUMN "version" DROP DEFAULT'
		]);
		// `order.version` is the totals-version pointer the create tick declares and the summary rows are
		// keyed by, so dropping it would destroy a fact this tick never created.
		expect(ddlOf(runner).some((statement) => statement.startsWith('ALTER TABLE "order" DROP'))).toBe(false);
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddOrderVersionedColumns1791000000560().up(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('is the last tick of the plugin’s set', () => {
		// A migration's timestamp is frozen once it has shipped, so this one runs after every file the
		// set already holds and cannot be inserted between two of them.
		expect(ALL_ORDER_MIGRATIONS[ALL_ORDER_MIGRATIONS.length - 1]).toBe(AddOrderVersionedColumns1791000000560);
		expect(ALL_ORDER_MIGRATIONS).toContain(AddOrderVersionedColumns1791000000560);
	});
});
