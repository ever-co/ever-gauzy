/**
 * `@gauzy/config` reads the process environment at import time, which a migration that only needs the
 * dialect enum does not — so the module is doubled at its boundary, exactly as this package's other
 * specs do, and **the migration under test is the real one**: its dialect routing, its statements and
 * its probes are the platform's, over a query runner that records what it was asked for.
 */
jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { AddOrderReturnVersionColumn1791000000590 } from './migrations/1791000000590-AddOrderReturnVersionColumn';

/**
 * The return's version column.
 *
 * The column is what the return's conditional writes are predicated on, so the suite pins the three
 * properties a migration of this shape owes: **every dialect receives the column**, stated in that
 * dialect's own quoting and default form; **the column is `int NOT NULL DEFAULT 1`**, because every row
 * that already exists has to be given the version the entity declares rather than a null the counter
 * cannot move on from; and **running the tick twice changes nothing**, because a migration runs inside
 * the platform's retry wrapper and one that throws on its second attempt is a set that never records
 * itself — which shows up as a boot that never finishes rather than as a message.
 */

/** What the runner was asked, and what it answered. */
interface IRunnerOptions {
	/** The dialect the connection reports. */
	type: DatabaseTypeEnum;
	/** Whether the table is there, which the probes ask before every statement. */
	hasTable?: boolean;
	/** Whether the column is there, which is what a second run of the tick finds. */
	hasColumn?: boolean;
}

/**
 * The query runner, doubled.
 *
 * @param options The dialect and what the probes should answer.
 * @returns The runner and the statements it was asked to run.
 */
function runner(options: IRunnerOptions): { queryRunner: QueryRunner; executed: string[] } {
	const executed: string[] = [];
	const queryRunner = {
		connection: { options: { type: options.type } },
		hasTable: jest.fn(async () => options.hasTable !== false),
		hasColumn: jest.fn(async () => options.hasColumn === true),
		query: jest.fn(async (sql: string) => {
			executed.push(sql);

			return [];
		})
	} as unknown as QueryRunner;

	return { queryRunner, executed };
}

/** The dialect's own statement for adding the column. */
const ADD: Record<string, RegExp> = {
	sqlite: /^ALTER TABLE "order_return" ADD COLUMN "version" int NOT NULL DEFAULT \(1\)$/,
	postgres: /^ALTER TABLE "order_return" ADD COLUMN "version" int NOT NULL DEFAULT 1$/,
	mysql: /^ALTER TABLE `order_return` ADD COLUMN `version` int NOT NULL DEFAULT 1$/
};

/** The dialect's own statement for dropping it. */
const DROP: Record<string, RegExp> = {
	sqlite: /^ALTER TABLE "order_return" DROP COLUMN "version"$/,
	postgres: /^ALTER TABLE "order_return" DROP COLUMN "version"$/,
	mysql: /^ALTER TABLE `order_return` DROP COLUMN `version`$/
};

describe('AddOrderReturnVersionColumn1791000000590', () => {
	let migration: AddOrderReturnVersionColumn1791000000590;

	beforeEach(() => {
		migration = new AddOrderReturnVersionColumn1791000000590();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(['sqlite', 'postgres', 'mysql'] as const)(
		'adds a defaulted, non-null version column on %s',
		async (dialect) => {
			const { queryRunner, executed } = runner({ type: DatabaseTypeEnum[dialect] });

			await migration.up(queryRunner);

			expect(executed).toHaveLength(1);
			expect(executed[0]).toMatch(ADD[dialect]);
		}
	);

	it('is idempotent: a column that is already there is left alone', async () => {
		// The second run of the tick finds the column and states nothing, which is what lets the set
		// record itself.
		const { queryRunner, executed } = runner({ type: DatabaseTypeEnum.postgres, hasColumn: true });

		await migration.up(queryRunner);

		expect(executed).toEqual([]);
	});

	it('states nothing on a database whose table is not there', async () => {
		// A plugin's migrations run with every other package's, and a deployment that never created the
		// table has nothing for this tick to extend.
		const { queryRunner, executed } = runner({ type: DatabaseTypeEnum.postgres, hasTable: false });

		await migration.up(queryRunner);

		expect(executed).toEqual([]);
	});

	it.each(['sqlite', 'postgres', 'mysql'] as const)('reverses the one statement on %s', async (dialect) => {
		const { queryRunner, executed } = runner({ type: DatabaseTypeEnum[dialect], hasColumn: true });

		await migration.down(queryRunner);

		expect(executed).toHaveLength(1);
		expect(executed[0]).toMatch(DROP[dialect]);
	});

	it('reverses nothing when the column was never added', async () => {
		const { queryRunner, executed } = runner({ type: DatabaseTypeEnum.mysql });

		await migration.down(queryRunner);

		expect(executed).toEqual([]);
	});

	it('refuses a database it has no statements for', async () => {
		// A dialect this tick cannot express is named rather than silently skipped: a schema that
		// silently lacks the column is a versioned write with no version behind it.
		const { queryRunner } = runner({ type: DatabaseTypeEnum.mongodb });

		await expect(migration.up(queryRunner)).rejects.toThrow(/Unsupported database/);
		await expect(migration.down(queryRunner)).rejects.toThrow(/Unsupported database/);
	});
});
