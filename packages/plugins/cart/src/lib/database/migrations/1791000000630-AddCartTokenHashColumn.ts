import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Gives a cart a guest-access token, stored as its digest.
 *
 * A buyer who is not signed in has no other handle on the cart they built, so the create answers with a
 * random token and `cartByToken` / `GET /carts/by-token/:token` find the cart by it. The table keeps the
 * token's SHA-256 digest (64 hex characters), never the token, so a database read, a backup or an export
 * never yields a token that opens a cart.
 *
 * The column is nullable because every cart created before this migration has no token and cannot be
 * given one after the fact — a token nobody was ever answered with reaches nobody. The unique index is
 * what makes a digest name one cart; it is partial on Postgres and SQLite (`WHERE "tokenHash" IS NOT
 * NULL`), so the carts that have no token are exempt by statement rather than by accident, and on MySQL,
 * which has no partial index, the same exemption is MySQL's own rule that a unique index never compares
 * two `NULL`s.
 *
 * Every statement is guarded the way the version-column migration of this set guards its own: the column
 * is added only where it is absent and the index only where it is not already defined, so a re-run, or a
 * replay onto a database restored from a snapshot taken after the first run, changes nothing rather than
 * failing.
 */
export class AddCartTokenHashColumn1791000000630 implements MigrationInterface {
	name = 'AddCartTokenHashColumn1791000000630';

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
		await this.addTokenHashColumn(
			queryRunner,
			`ALTER TABLE "commerce_cart" ADD COLUMN "tokenHash" character varying(64)`
		);
		await this.addTokenHashIndex(
			queryRunner,
			`CREATE UNIQUE INDEX "UQ_commerce_cart_token_hash" ON "commerce_cart" ("tokenHash") WHERE "tokenHash" IS NOT NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropTokenHashIndex(queryRunner, `DROP INDEX "UQ_commerce_cart_token_hash"`);
		await this.dropTokenHashColumn(queryRunner, `ALTER TABLE "commerce_cart" DROP COLUMN "tokenHash"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addTokenHashColumn(queryRunner, `ALTER TABLE "commerce_cart" ADD COLUMN "tokenHash" varchar(64)`);
		await this.addTokenHashIndex(
			queryRunner,
			`CREATE UNIQUE INDEX "UQ_commerce_cart_token_hash" ON "commerce_cart" ("tokenHash") WHERE "tokenHash" IS NOT NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropTokenHashIndex(queryRunner, `DROP INDEX "UQ_commerce_cart_token_hash"`);
		await this.dropTokenHashColumn(queryRunner, `ALTER TABLE "commerce_cart" DROP COLUMN "tokenHash"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addTokenHashColumn(
			queryRunner,
			`ALTER TABLE \`commerce_cart\` ADD COLUMN \`tokenHash\` varchar(64) NULL`
		);
		// MySQL has no partial index. A unique index there never compares two NULLs, which is the same
		// exemption the predicate states on the other two dialects: a cart with no token is not a duplicate.
		await this.addTokenHashIndex(
			queryRunner,
			`CREATE UNIQUE INDEX \`UQ_commerce_cart_token_hash\` ON \`commerce_cart\` (\`tokenHash\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropTokenHashIndex(queryRunner, `DROP INDEX \`UQ_commerce_cart_token_hash\` ON \`commerce_cart\``);
		await this.dropTokenHashColumn(queryRunner, `ALTER TABLE \`commerce_cart\` DROP COLUMN \`tokenHash\``);
	}

	/**
	 * Adds the digest column, unless the cart table already carries it.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `ALTER TABLE ... ADD COLUMN`.
	 */
	private async addTokenHashColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		if (await queryRunner.hasColumn('commerce_cart', 'tokenHash')) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Drops the digest column, unless it is already gone.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `ALTER TABLE ... DROP COLUMN`.
	 */
	private async dropTokenHashColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		if (!(await queryRunner.hasColumn('commerce_cart', 'tokenHash'))) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Adds the unique index over the digest, unless it is already defined.
	 *
	 * The index is read off the table rather than created with an `IF NOT EXISTS` clause, which two of the
	 * three dialects do not have.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `CREATE UNIQUE INDEX`.
	 */
	private async addTokenHashIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = await queryRunner.getTable('commerce_cart');

		if (table?.indices.some((index) => index.name === 'UQ_commerce_cart_token_hash')) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Drops the unique index over the digest, unless it is already gone.
	 *
	 * The index is dropped before the column on purpose: SQLite refuses to drop a column an index still
	 * names, and the two statements belong to the one migration that introduced both.
	 *
	 * @param queryRunner
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropTokenHashIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = await queryRunner.getTable('commerce_cart');

		if (!table?.indices.some((index) => index.name === 'UQ_commerce_cart_token_hash')) {
			return;
		}

		await queryRunner.query(statement);
	}
}
