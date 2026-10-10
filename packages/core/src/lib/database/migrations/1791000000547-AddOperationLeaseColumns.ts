import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '../check-constraint.helper';

/**
 * Moves the durable-operation lease out of `operation.state` and into columns, and states the rule that
 * comes with it.
 *
 * ## Why the lease cannot stay in a JSON document
 *
 * The runtime takes an operation as a lease while a worker drives it, and a worker that dies stops
 * renewing it; the operation is then recovered by whoever sweeps next. That sweep has to answer "whose
 * lease has lapsed" over the whole table, and a value inside `state` carries **no index on any of the
 * three dialects** — so the sweep reads every operation ever run to find the few that are stuck. The three
 * columns below are that question made indexable: `lockedAt` is when the lease was taken, `lockedBy` is
 * who holds it, and `leaseExpiresAt` is when it lapses, and `IDX_operation_lease` is partial on exactly the
 * sweep's predicate (a live status and a lapsed lease) so the read touches the stuck rows rather than the
 * history.
 *
 * ## The rule the table gains with them
 *
 * `CHK_operation_status_terminal` — **a terminal operation holds no lease**, stated as
 * `lockedAt IS NULL OR status NOT IN ('COMPLETED', 'FAILED', 'COMPENSATED', 'CANCELED')`. A finished
 * operation that still carried a lease is one the sweep would reclaim and run a second time, which is the
 * outcome the exclusivity rule of the same table exists to prevent. The four terminal statuses are named
 * rather than the three live ones so that a status added later is not silently treated as finished, and the
 * runtime clears the three columns in the same write that settles the status — one patch, so the rule holds
 * at every instant rather than after a second write.
 *
 * ## Backfill
 *
 * Nothing to backfill: every existing row has no lease, which is what three nullable columns mean. An
 * operation whose lease currently sits inside `state` is one whose worker is running *this* build; the
 * `state.lease` member is no longer read or written, so the stale member is left where it is rather than
 * being migrated — a document rewritten by a migration is a document nobody can audit.
 *
 * ## Dialects
 *
 * Every dialect adds a nullable column and creates an index, so the columns and the index are created
 * everywhere (the index without its predicate on MySQL, which has no filtered index). The check constraint
 * is stated through the shared helper, which reports the embedded dialect as the documented no-op it is:
 * there the rule rests on the runtime, which clears the columns in the settling write, and on the audit.
 *
 * ## Ordering
 *
 * The constraint needs the columns, and the helper probes for them, so the two live in one tick: the
 * `ALTER`s run first and the constraint is created in the same `up()`.
 */
export class AddOperationLeaseColumns1791000000547 implements MigrationInterface {
	name = 'AddOperationLeaseColumns1791000000547';

	/** The table this tick extends, and the index the sweep reads. */
	private static readonly TABLE = 'operation';
	private static readonly INDEX = 'IDX_operation_lease';

	/** The rule that comes with the columns. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'operation',
			name: 'CHK_operation_status_terminal',
			columns: ['lockedAt', 'status'],
			postgres: `ALTER TABLE "operation" ADD CONSTRAINT "CHK_operation_status_terminal" CHECK ("lockedAt" IS NULL OR "status" NOT IN ('COMPLETED', 'FAILED', 'COMPENSATED', 'CANCELED'))`,
			mysql: `ALTER TABLE \`operation\` ADD CONSTRAINT \`CHK_operation_status_terminal\` CHECK (\`lockedAt\` IS NULL OR \`status\` NOT IN ('COMPLETED', 'FAILED', 'COMPENSATED', 'CANCELED'))`
		}
	];

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, 'sqlite');
		await this.addIndex(
			queryRunner,
			`CREATE INDEX "${AddOperationLeaseColumns1791000000547.INDEX}" ON "operation" ("leaseExpiresAt") WHERE "leaseExpiresAt" IS NOT NULL AND "status" IN ('PENDING', 'RUNNING', 'COMPENSATING')`
		);
		await this.addAll(queryRunner);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
		await this.dropIndex(queryRunner, `DROP INDEX IF EXISTS "${AddOperationLeaseColumns1791000000547.INDEX}"`);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, 'postgres');
		await this.addIndex(
			queryRunner,
			`CREATE INDEX "IDX_operation_lease" ON "operation" ("leaseExpiresAt") WHERE "leaseExpiresAt" IS NOT NULL AND "status" IN ('PENDING', 'RUNNING', 'COMPENSATING')`
		);
		await this.addAll(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
		await this.dropIndex(queryRunner, `DROP INDEX IF EXISTS "IDX_operation_lease"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the index is created without its predicate: the sweep still narrows
	 * by the expiry, and the rows whose lease is null are not asked for.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, 'mysql');
		await this.addIndex(
			queryRunner,
			'CREATE INDEX `IDX_operation_lease` ON `operation` (`leaseExpiresAt`)'
		);
		await this.addAll(queryRunner);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
		await this.dropIndex(queryRunner, 'DROP INDEX `IDX_operation_lease` ON `operation`');
	}

	/**
	 * Adds the three columns, each when the table is there and the column is not.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its timestamp form and its quoting.
	 */
	private async addColumns(queryRunner: QueryRunner, dialect: 'sqlite' | 'postgres' | 'mysql'): Promise<void> {
		const quote = dialect === 'mysql' ? '`' : '"';
		const timestamp = dialect === 'mysql' ? 'datetime NULL' : 'TIMESTAMP';
		const columns: Array<[string, string]> = [
			['lockedAt', timestamp],
			['lockedBy', 'varchar(128) NULL'],
			['leaseExpiresAt', timestamp]
		];

		if (!(await queryRunner.hasTable(AddOperationLeaseColumns1791000000547.TABLE))) return;

		for (const [column, type] of columns) {
			if (await queryRunner.hasColumn(AddOperationLeaseColumns1791000000547.TABLE, column)) continue;

			await queryRunner.query(
				`ALTER TABLE ${quote}${AddOperationLeaseColumns1791000000547.TABLE}${quote} ADD COLUMN ${quote}${column}${quote} ${type}`
			);
			console.log(chalk.yellow(`${this.name}: added operation.${column}.`));
		}
	}

	/**
	 * Adds the rule the columns carry.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async addAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddOperationLeaseColumns1791000000547.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops the rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddOperationLeaseColumns1791000000547.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}

	/**
	 * Creates the sweep's index, tolerating one that is already there.
	 *
	 * The idempotence matters: a migration runs inside the platform's retry wrapper, and a `CREATE INDEX`
	 * that throws on the second attempt is a set that can never record itself — which shows up as a boot
	 * that never finishes rather than as a message.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `CREATE INDEX`.
	 */
	private async addIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = AddOperationLeaseColumns1791000000547.TABLE;

		if (!(await queryRunner.hasTable(table))) return;
		if (!(await queryRunner.hasColumn(table, 'leaseExpiresAt'))) return;

		try {
			await queryRunner.query(statement);
			console.log(chalk.yellow(`${this.name}: created ${AddOperationLeaseColumns1791000000547.INDEX}.`));
		} catch (error) {
			if (!/already exists|Duplicate key name/i.test(String((error as Error)?.message))) {
				throw error;
			}
		}
	}

	/**
	 * Drops the sweep's index, tolerating its absence.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		try {
			await queryRunner.query(statement);
		} catch {
			// An index that is not there is the state this method is trying to reach.
		}
	}
}
