/**
 * The four probes a migration adds a `CHECK` through, exercised on their own.
 *
 * Every constraint migration in this programme funnels through this helper, and the failure it exists to
 * prevent is silent: a rule about a column the table does not have is an `ALTER` that either throws on
 * every installation or — worse — is skipped while the migration reports success. So the probes are
 * asserted one by one, against a query runner that answers what each dialect answers: the embedded one
 * cannot add a constraint to an existing table at all, PostgreSQL and MySQL can, a table that cannot be
 * described is never written to, and a constraint that is already there is left alone.
 */

import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import {
	addCheckConstraint,
	dropCheckConstraint,
	hasCheckConstraint,
	supportsCheckConstraints,
	ICheckConstraintDefinition
} from './check-constraint.helper';

type ExecutedQuery = { sql: string; parameters: any[] };

/**
 * A `QueryRunner` stand-in: it records the statements a migration issues and answers the three
 * questions the helper asks — is the table there, is the column there, is the constraint there —
 * from the description the test hands it.
 */
function runner(
	type: DatabaseTypeEnum,
	description: { table?: boolean; columns?: string[]; checks?: string[]; modifyingForeignKeys?: string[] } = {}
): { queryRunner: QueryRunner; executed: ExecutedQuery[]; described: string[] } {
	const executed: ExecutedQuery[] = [];
	const described: string[] = [];
	const table = {
		name: 'example',
		checks: (description.checks ?? []).map((name) => ({ name }))
	};

	const queryRunner = {
		connection: { options: { type } },
		query: async (sql: string, parameters: any[] = []) => {
			// The MySQL foreign-key probe is a read, answered from the description rather than recorded as a write.
			if (sql.includes('information_schema')) {
				return (description.modifyingForeignKeys ?? []).map((name) => ({ name }));
			}

			executed.push({ sql, parameters });

			return [];
		},
		hasTable: async () => description.table ?? true,
		hasColumn: async (_table: string, column: string) => (description.columns ?? []).includes(column),
		getTable: async (name: string) => {
			described.push(name);

			return table;
		}
	} as unknown as QueryRunner;

	return { queryRunner, executed, described };
}

/** The definition the tests add: a rule about one column. */
const DEFINITION: ICheckConstraintDefinition = {
	table: 'example',
	name: 'CHK_example_positive',
	columns: ['amount'],
	postgres: `ALTER TABLE "example" ADD CONSTRAINT "CHK_example_positive" CHECK ("amount" >= 0)`,
	mysql: 'ALTER TABLE `example` ADD CONSTRAINT `CHK_example_positive` CHECK (`amount` >= 0)'
};

describe('check constraint helper — which dialects can carry a rule', () => {
	it('answers that PostgreSQL and MySQL can, and the embedded dialect cannot', () => {
		expect(supportsCheckConstraints(runner(DatabaseTypeEnum.postgres).queryRunner)).toBe(true);
		expect(supportsCheckConstraints(runner(DatabaseTypeEnum.mysql).queryRunner)).toBe(true);
		expect(supportsCheckConstraints(runner(DatabaseTypeEnum.sqlite).queryRunner)).toBe(false);
		expect(supportsCheckConstraints(runner(DatabaseTypeEnum.betterSqlite3).queryRunner)).toBe(false);
	});

	it('skips the whole thing on the embedded dialect, and says why', async () => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const { queryRunner, executed } = runner(DatabaseTypeEnum.betterSqlite3, { columns: ['amount'] });

		const outcome = await addCheckConstraint(queryRunner, DEFINITION, 'TestMigration');

		expect(outcome).toBe('unsupported');
		expect(executed).toEqual([]);
		expect(log.mock.calls.flat().join(' ')).toContain('cannot add a constraint to an existing table');

		log.mockRestore();
	});
});

describe('check constraint helper — the probes', () => {
	it('adds the dialect’s own statement, once', async () => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const postgres = runner(DatabaseTypeEnum.postgres, { columns: ['amount'] });

		expect(await addCheckConstraint(postgres.queryRunner, DEFINITION, 'TestMigration')).toBe('added');
		expect(postgres.executed.map((one) => one.sql)).toEqual([DEFINITION.postgres]);

		const mysql = runner(DatabaseTypeEnum.mysql, { columns: ['amount'] });

		expect(await addCheckConstraint(mysql.queryRunner, DEFINITION, 'TestMigration')).toBe('added');
		expect(mysql.executed.map((one) => one.sql)).toEqual([DEFINITION.mysql]);

		log.mockRestore();
	});

	it('leaves a constraint that is already there alone, so a re-run is a no-op', async () => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const { queryRunner, executed } = runner(DatabaseTypeEnum.postgres, {
			columns: ['amount'],
			checks: [DEFINITION.name]
		});

		expect(await addCheckConstraint(queryRunner, DEFINITION, 'TestMigration')).toBe('present');
		expect(executed).toEqual([]);

		log.mockRestore();
	});

	it('adds nothing, and reports it, when the table or a column the rule reads is absent', async () => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

		const noTable = runner(DatabaseTypeEnum.postgres, { table: false, columns: ['amount'] });

		expect(await addCheckConstraint(noTable.queryRunner, DEFINITION, 'TestMigration')).toBe('not-ready');
		expect(noTable.executed).toEqual([]);

		// The case that matters: the table is there and the column the rule reads is not, which is a
		// statement that would be created on every installation and constrain nothing.
		const noColumn = runner(DatabaseTypeEnum.postgres, { columns: [] });

		expect(await addCheckConstraint(noColumn.queryRunner, DEFINITION, 'TestMigration')).toBe('not-ready');
		expect(noColumn.executed).toEqual([]);
		expect(log.mock.calls.flat().join(' ')).toContain('amount');

		log.mockRestore();
	});

	it('never writes to a table it could not describe', async () => {
		const broken = runner(DatabaseTypeEnum.postgres, { columns: ['amount'] });

		(broken.queryRunner as any).getTable = async () => {
			throw new Error('the table could not be described');
		};

		// A description that cannot be read answers "the constraint is there", so the migration adds
		// nothing rather than risking a duplicate.
		expect(await hasCheckConstraint(broken.queryRunner, 'example', DEFINITION.name)).toBe(true);
	});

	it('drops the constraint on the dialects that carry one, and nowhere else', async () => {
		const postgres = runner(DatabaseTypeEnum.postgres, { checks: [DEFINITION.name] });

		expect(await dropCheckConstraint(postgres.queryRunner, DEFINITION)).toBe(true);
		expect(postgres.executed.map((one) => one.sql)).toEqual([
			`ALTER TABLE "example" DROP CONSTRAINT "CHK_example_positive"`
		]);

		const mysql = runner(DatabaseTypeEnum.mysql, { checks: [DEFINITION.name] });

		expect(await dropCheckConstraint(mysql.queryRunner, DEFINITION)).toBe(true);
		expect(mysql.executed.map((one) => one.sql)).toEqual([
			'ALTER TABLE `example` DROP CONSTRAINT `CHK_example_positive`'
		]);

		// Nothing to drop: the constraint is absent.
		const absent = runner(DatabaseTypeEnum.postgres, { checks: [] });

		expect(await dropCheckConstraint(absent.queryRunner, DEFINITION)).toBe(false);
		expect(absent.executed).toEqual([]);

		// Nothing was ever added on the embedded dialect, so nothing is dropped.
		const embedded = runner(DatabaseTypeEnum.sqlite, { checks: [DEFINITION.name] });

		expect(await dropCheckConstraint(embedded.queryRunner, DEFINITION)).toBe(false);
		expect(embedded.executed).toEqual([]);
	});
});

describe('check constraint helper — a rule MySQL cannot hold beside a foreign-key action', () => {
	it('does not add a CHECK on MySQL over a column a foreign-key action modifies, and says why (3823)', async () => {
		// MySQL >= 8.0.16 refuses a CHECK over a column an `ON DELETE SET NULL` / `SET DEFAULT` or `ON UPDATE`
		// action rewrites (3823); adding it anyway stopped every MySQL installation at the migration.
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const mysql = runner(DatabaseTypeEnum.mysql, { columns: ['amount'], modifyingForeignKeys: ['FK_example_owner'] });

		expect(await addCheckConstraint(mysql.queryRunner, DEFINITION, 'TestMigration')).toBe('unsupported');
		expect(mysql.executed).toEqual([]);
		expect(log.mock.calls.map((call) => String(call[0])).join(' ')).toContain('FK_example_owner');
		log.mockRestore();
	});

	it('still adds it on PostgreSQL, which has no such restriction — control', async () => {
		const postgres = runner(DatabaseTypeEnum.postgres, { columns: ['amount'], modifyingForeignKeys: ['FK_example_owner'] });

		expect(await addCheckConstraint(postgres.queryRunner, DEFINITION, 'TestMigration')).toBe('added');
		expect(postgres.executed.map((one) => one.sql)).toEqual([DEFINITION.postgres]);
	});
});

/**
 * #10676: TypeORM's MySQL runner never loads `CHECK` constraints, so `getTable()` lists none there and the probe
 * has to ask `information_schema.TABLE_CONSTRAINTS`. This runner answers the two `information_schema` reads
 * separately (the constraint probe and the foreign-key probe), and lets a test make the drop statement fail the
 * way MySQL 8.0.16 to 8.0.18 do.
 */
function catalogRunner(
	type: DatabaseTypeEnum,
	catalog: {
		metadataChecks?: string[];
		tableConstraints?: string[];
		dropFailure?: unknown;
		probeFailure?: unknown;
	} = {}
): { queryRunner: QueryRunner; executed: ExecutedQuery[]; probes: ExecutedQuery[] } {
	const executed: ExecutedQuery[] = [];
	const probes: ExecutedQuery[] = [];

	const queryRunner = {
		connection: { options: { type } },
		query: async (sql: string, parameters: any[] = []) => {
			if (sql.includes('information_schema.TABLE_CONSTRAINTS')) {
				probes.push({ sql, parameters });

				if (catalog.probeFailure) {
					throw catalog.probeFailure;
				}

				// Answer like MySQL: only rows whose table and name match the bound parameters.
				const [table, name] = parameters;

				return table === 'example'
					? (catalog.tableConstraints ?? []).filter((one) => one === name).map((one) => ({ name: one }))
					: [];
			}
			if (sql.includes('information_schema')) {
				return [];
			}

			executed.push({ sql, parameters });

			if (catalog.dropFailure && sql.includes('DROP CONSTRAINT')) {
				throw catalog.dropFailure;
			}

			return [];
		},
		hasTable: async () => true,
		hasColumn: async () => true,
		getTable: async () => ({ name: 'example', checks: (catalog.metadataChecks ?? []).map((name) => ({ name })) })
	} as unknown as QueryRunner;

	return { queryRunner, executed, probes };
}

describe('check constraint helper — MySQL, whose table metadata never lists a CHECK (#10676)', () => {
	it('finds a CHECK the metadata does not list through information_schema.TABLE_CONSTRAINTS', async () => {
		const { queryRunner, probes } = catalogRunner(DatabaseTypeEnum.mysql, { tableConstraints: [DEFINITION.name] });

		expect(await hasCheckConstraint(queryRunner, 'example', DEFINITION.name)).toBe(true);
		expect(probes).toHaveLength(1);
		expect(probes[0].sql).toContain('CONSTRAINT_SCHEMA = DATABASE()');
		expect(probes[0].sql).toContain(`CONSTRAINT_TYPE = 'CHECK'`);
		expect(probes[0].parameters).toEqual(['example', DEFINITION.name]);
	});

	it('answers false when neither the metadata nor the catalog has it, and ignores other names', async () => {
		const absent = catalogRunner(DatabaseTypeEnum.mysql, { tableConstraints: ['CHK_example_other'] });

		expect(await hasCheckConstraint(absent.queryRunner, 'example', DEFINITION.name)).toBe(false);
	});

	it('does not ask the catalog when the metadata already lists it, nor on PostgreSQL', async () => {
		const listed = catalogRunner(DatabaseTypeEnum.mysql, { metadataChecks: [DEFINITION.name] });

		expect(await hasCheckConstraint(listed.queryRunner, 'example', DEFINITION.name)).toBe(true);
		expect(listed.probes).toEqual([]);

		// PostgreSQL's metadata does list checks, so its answer stays metadata-only.
		const postgres = catalogRunner(DatabaseTypeEnum.postgres, { tableConstraints: [DEFINITION.name] });

		expect(await hasCheckConstraint(postgres.queryRunner, 'example', DEFINITION.name)).toBe(false);
		expect(postgres.probes).toEqual([]);
	});

	it('leaves an existing MySQL CHECK alone on a re-run instead of adding it twice (3822)', async () => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const { queryRunner, executed } = catalogRunner(DatabaseTypeEnum.mysql, {
			tableConstraints: [DEFINITION.name]
		});

		expect(await addCheckConstraint(queryRunner, DEFINITION, 'TestMigration')).toBe('present');
		expect(executed).toEqual([]);

		log.mockRestore();
	});

	it('drops a MySQL CHECK that only the catalog knows about', async () => {
		const { queryRunner, executed } = catalogRunner(DatabaseTypeEnum.mysql, {
			tableConstraints: [DEFINITION.name]
		});

		expect(await dropCheckConstraint(queryRunner, DEFINITION)).toBe(true);
		expect(executed.map((one) => one.sql)).toEqual([
			'ALTER TABLE `example` DROP CONSTRAINT `CHK_example_positive`'
		]);
	});

	it('retries with DROP CHECK when MySQL 8.0.16 to 8.0.18 cannot parse DROP CONSTRAINT', async () => {
		// TypeORM's QueryFailedError copies the driver's `code` onto itself; a raw driver error carries it too.
		for (const dropFailure of [{ code: 'ER_PARSE_ERROR' }, { driverError: { code: 'ER_PARSE_ERROR' } }]) {
			const { queryRunner, executed } = catalogRunner(DatabaseTypeEnum.mysql, {
				tableConstraints: [DEFINITION.name],
				dropFailure
			});

			expect(await dropCheckConstraint(queryRunner, DEFINITION)).toBe(true);
			expect(executed.map((one) => one.sql)).toEqual([
				'ALTER TABLE `example` DROP CONSTRAINT `CHK_example_positive`',
				'ALTER TABLE `example` DROP CHECK `CHK_example_positive`'
			]);
		}
	});

	it('answers "present" when the catalog cannot be read, like a table that cannot be described', async () => {
		// The helper's contract: a constraint it cannot see the absence of is never added. The rule then rests on
		// the write path and the nightly audit, as for every rule the helper does not create.
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const { queryRunner, executed, probes } = catalogRunner(DatabaseTypeEnum.mysql, {
			probeFailure: new Error('information_schema could not be read')
		});

		expect(await hasCheckConstraint(queryRunner, 'example', DEFINITION.name)).toBe(true);
		expect(await addCheckConstraint(queryRunner, DEFINITION, 'TestMigration')).toBe('present');
		expect(probes).toHaveLength(2);
		expect(executed).toEqual([]);

		log.mockRestore();
	});

	it('rethrows any other drop failure, and a parse error outside MySQL, without retrying', async () => {
		const mysql = catalogRunner(DatabaseTypeEnum.mysql, {
			tableConstraints: [DEFINITION.name],
			dropFailure: { code: 'ER_LOCK_WAIT_TIMEOUT' }
		});

		await expect(dropCheckConstraint(mysql.queryRunner, DEFINITION)).rejects.toEqual({
			code: 'ER_LOCK_WAIT_TIMEOUT'
		});
		expect(mysql.executed).toHaveLength(1);

		const postgres = catalogRunner(DatabaseTypeEnum.postgres, {
			metadataChecks: [DEFINITION.name],
			dropFailure: { code: 'ER_PARSE_ERROR' }
		});

		await expect(dropCheckConstraint(postgres.queryRunner, DEFINITION)).rejects.toEqual({ code: 'ER_PARSE_ERROR' });
		expect(postgres.executed).toHaveLength(1);
	});
});
