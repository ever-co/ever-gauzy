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
	description: { table?: boolean; columns?: string[]; checks?: string[] } = {}
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
