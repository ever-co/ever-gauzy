import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table the optimistic-lock column belongs to. */
const SUBSCRIPTION_TABLE = 'subscription';

/** The column an optimistic lock is carried in, on that table. */
const VERSION_COLUMN = 'version';

/** The index over the column, named the way every other index on the table is named. */
const VERSION_INDEX = 'IDX_subscription_version';

/**
 * Adds the optimistic-lock column to the subscription table, and the index that reads it.
 *
 * The column is what makes a write to a subscription conditional: a caller states the version it
 * read, and the statement that writes the row is predicated on it — `UPDATE … WHERE id = :id AND
 * version = :expected` — so a second editor's change is refused rather than applied over a value it
 * never saw. Every existing row starts at one, which is the value the convention gives a new row.
 *
 * Every statement is guarded, because this migration can meet a database that already carries what
 * it adds: an installation that has run a later release, a database restored from one, or this
 * migration re-run after an interrupted release. The column and the index are therefore each probed
 * before they are named, so a re-run issues no DDL at all, and a database that already has both is
 * left exactly as it was rather than failing halfway through.
 *
 * All three dialects are written by hand, and the down migration reverses the statements in the
 * opposite order — an index cannot outlive the column it indexes.
 */
export class AddSubscriptionVersionColumn1791000000575 implements MigrationInterface {
	name = 'AddSubscriptionVersionColumn1791000000575';

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
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_TABLE, VERSION_COLUMN))) {
			await queryRunner.query(
				`ALTER TABLE "subscription" ADD COLUMN "version" integer NOT NULL DEFAULT 1`
			);
		}

		if (!(await this.hasVersionIndex(queryRunner))) {
			await queryRunner.query(`CREATE INDEX "IDX_subscription_version" ON "subscription" ("version")`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (await this.hasVersionIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX "IDX_subscription_version"`);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_TABLE, VERSION_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "version"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite takes a `NOT NULL` column with a constant default on an existing table, which is what
	 * lets the column be added to a table that already holds subscriptions: every row it already has
	 * is given the value the convention starts a subscription at.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_TABLE, VERSION_COLUMN))) {
			await queryRunner.query(
				`ALTER TABLE "subscription" ADD COLUMN "version" integer NOT NULL DEFAULT 1`
			);
		}

		if (!(await this.hasVersionIndex(queryRunner))) {
			await queryRunner.query(`CREATE INDEX "IDX_subscription_version" ON "subscription" ("version")`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (await this.hasVersionIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX "IDX_subscription_version"`);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_TABLE, VERSION_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "version"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * The index is created after the column and only when it is not already there, because MySQL has
	 * no `CREATE INDEX IF NOT EXISTS` and a re-run that named an existing index would abort the
	 * migration rather than leave the database as it found it.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_TABLE, VERSION_COLUMN))) {
			await queryRunner.query(
				`ALTER TABLE \`subscription\` ADD COLUMN \`version\` int NOT NULL DEFAULT 1`
			);
		}

		if (!(await this.hasVersionIndex(queryRunner))) {
			await queryRunner.query(`CREATE INDEX \`IDX_subscription_version\` ON \`subscription\` (\`version\`)`);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (await this.hasVersionIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX \`IDX_subscription_version\` ON \`subscription\``);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_TABLE, VERSION_COLUMN)) {
			await queryRunner.query(`ALTER TABLE \`subscription\` DROP COLUMN \`version\``);
		}
	}

	/**
	 * Whether the version index is already there.
	 *
	 * The catalogue is asked rather than the dialect: the dialects this platform runs disagree about
	 * whether an index can be created or dropped conditionally, and the table's own index list is the
	 * one answer all three give.
	 *
	 * @param queryRunner The query runner.
	 * @returns True when the index exists.
	 */
	private async hasVersionIndex(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(SUBSCRIPTION_TABLE);

		return (table?.indices ?? []).some((index) => index.name === VERSION_INDEX);
	}
}
