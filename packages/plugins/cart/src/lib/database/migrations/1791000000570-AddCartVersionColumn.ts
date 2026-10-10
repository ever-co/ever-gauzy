import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Brings the cart's optimistic lock into the schema of every installation.
 *
 * The column is the one a cart's concurrent writers are separated by: a caller states the version it
 * read as an `If-Match` header, and the write that follows is predicated on it, so a change based on
 * a cart that has moved on is refused instead of overwriting what moved it.
 *
 * Every statement here is guarded, and for two reasons. The table-creating migration of this set
 * already declares `version`, so on a database created by it the column is present and the
 * `ALTER TABLE` must not run; and a migration that is re-run, or replayed onto a database restored
 * from a snapshot taken after it first ran, must change nothing rather than fail. The guards are what
 * make both of those true on all three dialects — the column is added only where it is absent, and
 * the index only where it is not already defined — which is why the dialect branches below state
 * plain SQL and let the shared guards decide whether to run it.
 */
export class AddCartVersionColumn1791000000570 implements MigrationInterface {
	name = 'AddCartVersionColumn1791000000570';

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
			`ALTER TABLE "commerce_cart" ADD COLUMN "version" integer NOT NULL DEFAULT 1`
		);
		await this.addVersionIndex(
			queryRunner,
			`CREATE INDEX "IDX_commerce_cart_version" ON "commerce_cart" ("version")`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionIndex(queryRunner, `DROP INDEX "IDX_commerce_cart_version"`);
		await this.dropVersionColumn(queryRunner, `ALTER TABLE "commerce_cart" DROP COLUMN "version"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE "commerce_cart" ADD COLUMN "version" integer NOT NULL DEFAULT (1)`
		);
		await this.addVersionIndex(
			queryRunner,
			`CREATE INDEX "IDX_commerce_cart_version" ON "commerce_cart" ("version")`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionIndex(queryRunner, `DROP INDEX "IDX_commerce_cart_version"`);
		await this.dropVersionColumn(queryRunner, `ALTER TABLE "commerce_cart" DROP COLUMN "version"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE \`commerce_cart\` ADD COLUMN \`version\` int NOT NULL DEFAULT 1`
		);
		await this.addVersionIndex(
			queryRunner,
			`CREATE INDEX \`IDX_commerce_cart_version\` ON \`commerce_cart\` (\`version\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionIndex(queryRunner, `DROP INDEX \`IDX_commerce_cart_version\` ON \`commerce_cart\``);
		await this.dropVersionColumn(queryRunner, `ALTER TABLE \`commerce_cart\` DROP COLUMN \`version\``);
	}

	/**
	 * Adds the version column, unless the cart table already carries it.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `ALTER TABLE ... ADD COLUMN`.
	 */
	private async addVersionColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		if (await queryRunner.hasColumn('commerce_cart', 'version')) {
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
		if (!(await queryRunner.hasColumn('commerce_cart', 'version'))) {
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
		const table = await queryRunner.getTable('commerce_cart');

		if (table?.indices.some((index) => index.name === 'IDX_commerce_cart_version')) {
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
		const table = await queryRunner.getTable('commerce_cart');

		if (!table?.indices.some((index) => index.name === 'IDX_commerce_cart_version')) {
			return;
		}

		await queryRunner.query(statement);
	}
}
