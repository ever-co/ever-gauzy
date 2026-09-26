import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Brings the right's optimistic lock into the schema of every installation.
 *
 * The column is what separates the writers of one right: a caller states the version it read as an
 * `If-Match` header, and the write that follows is predicated on it, so a change based on a right that
 * has moved on is refused rather than overwriting what moved it. Every route that writes a right, and
 * every GraphQL mutation that mirrors one, therefore depends on this column existing.
 *
 * Every statement here is guarded, because a migration is replayed as often as it is run: a database
 * restored from a snapshot taken after this migration first ran already carries the column and the
 * index, an installation whose schema was created from the entity definitions already carries the
 * column the entity declares, and a re-run must change nothing on either rather than fail on an
 * object that exists. The guards are what make that true on all three dialects — the column is added
 * only where it is absent and the index only where it is not already defined — which is why the
 * dialect branches below state plain SQL and let the shared guards decide whether to run it.
 */
export class AddEntitlementVersionColumn1791000000580 implements MigrationInterface {
	name = 'AddEntitlementVersionColumn1791000000580';

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
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE "entitlement" ADD COLUMN "version" integer NOT NULL DEFAULT 1`
		);
		await this.addVersionIndex(
			queryRunner,
			`CREATE INDEX "IDX_entitlement_version" ON "entitlement" ("version")`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionIndex(queryRunner, `DROP INDEX "IDX_entitlement_version"`);
		await this.dropVersionColumn(queryRunner, `ALTER TABLE "entitlement" DROP COLUMN "version"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE "entitlement" ADD COLUMN "version" integer NOT NULL DEFAULT (1)`
		);
		await this.addVersionIndex(
			queryRunner,
			`CREATE INDEX "IDX_entitlement_version" ON "entitlement" ("version")`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionIndex(queryRunner, `DROP INDEX "IDX_entitlement_version"`);
		await this.dropVersionColumn(queryRunner, `ALTER TABLE "entitlement" DROP COLUMN "version"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE \`entitlement\` ADD COLUMN \`version\` int NOT NULL DEFAULT 1`
		);
		await this.addVersionIndex(
			queryRunner,
			`CREATE INDEX \`IDX_entitlement_version\` ON \`entitlement\` (\`version\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionIndex(queryRunner, `DROP INDEX \`IDX_entitlement_version\` ON \`entitlement\``);
		await this.dropVersionColumn(queryRunner, `ALTER TABLE \`entitlement\` DROP COLUMN \`version\``);
	}

	/**
	 * Adds the version column, unless the entitlement table already carries it.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `ALTER TABLE ... ADD COLUMN`.
	 */
	private async addVersionColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		if (await queryRunner.hasColumn('entitlement', 'version')) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Drops the version column, unless it is already gone.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `ALTER TABLE ... DROP COLUMN`.
	 */
	private async dropVersionColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		if (!(await queryRunner.hasColumn('entitlement', 'version'))) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Adds the index over the version column, unless it is already defined.
	 *
	 * The version is the second half of the predicate every conditional write to this table states, so
	 * the column is indexed from this migration onwards. The index is read off the table rather than
	 * created with an `IF NOT EXISTS` clause, which two of the three dialects do not have.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `CREATE INDEX`.
	 */
	private async addVersionIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = await queryRunner.getTable('entitlement');

		if (table?.indices.some((index) => index.name === 'IDX_entitlement_version')) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Drops the index over the version column, unless it is already gone.
	 *
	 * The index is dropped before the column on purpose: SQLite refuses to drop a column an index still
	 * names, and the two statements belong to the one migration that introduced both.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropVersionIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = await queryRunner.getTable('entitlement');

		if (!table?.indices.some((index) => index.name === 'IDX_entitlement_version')) {
			return;
		}

		await queryRunner.query(statement);
	}
}
