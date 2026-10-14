import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Scopes `UQ_collection_org_slug` to merchandising collections (R5-06).
 *
 * A collection is either a **merchandising collection** (`customerId` null), whose slug is unique within
 * its organization, or a buyer's **saved list** (`customerId` set), whose slug is unique for that buyer —
 * `UQ_collection_customer_slug`, created beside it. `CollectionService.assertSlugIsAvailable` checks
 * exactly those two scopes. `1791000000100` gave the organization index no `customerId` predicate, so it
 * covered saved lists as well: the second buyer of an organization to save a list called `favorites`, or a
 * buyer whose list shared its slug with a merchandising collection, passed the service's check and was then
 * refused by the database. The index is rebuilt here with the predicate; `1791000000100` itself is never
 * edited, because installations have recorded it as run.
 *
 * - **Postgres and SQLite**: the same partial index, with `"customerId" IS NULL` added to its predicate.
 * - **MySQL** has no partial index, so the predicate is a generated key column joining the tuple, per the
 *   convention `1791000000000-CreateSequenceTable` documents: `noCustomerKey` is `'0'` on a merchandising
 *   collection, so those compete on `(organizationKey, slug)` exactly as before, and the row's own `id` on a
 *   saved list, which nothing else can equal. It is **VIRTUAL**, not STORED: `customerId` is the base column
 *   of `FK_collection_customer … ON DELETE CASCADE`, and MySQL refuses a cascading foreign key on a base
 *   column of a STORED generated column (`3104` / `1215`), while InnoDB indexes a VIRTUAL one like any other.
 *
 * Narrowing a unique index cannot fail on existing data: every set of rows the old index accepted, the new
 * one accepts. Widening it again on the way down can — once two buyers hold lists of one slug, the old rule
 * no longer holds for the data, and `down` fails rather than deleting either list.
 */
export class ScopeCollectionOrgSlugToMerchandising1791000000627 implements MigrationInterface {
	name = 'ScopeCollectionOrgSlugToMerchandising1791000000627';

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
		await this.partialIndexUp(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.partialIndexDown(queryRunner);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.partialIndexUp(queryRunner);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.partialIndexDown(queryRunner);
	}

	/**
	 * Postgres and SQLite Up Migration — the two dialects spell this partial index identically.
	 *
	 * @param queryRunner
	 */
	private async partialIndexUp(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_collection_org_slug"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_org_slug" ON "collection" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "slug") WHERE "customerId" IS NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * Postgres and SQLite Down Migration — the index as `1791000000100` created it.
	 *
	 * @param queryRunner
	 */
	private async partialIndexDown(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_collection_org_slug"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_org_slug" ON "collection" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "slug") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`collection\` ADD \`noCustomerKey\` varchar(36) GENERATED ALWAYS AS (IF(\`customerId\` IS NULL, '0', \`id\`)) VIRTUAL`
		);
		await queryRunner.query(`DROP INDEX \`UQ_collection_org_slug\` ON \`collection\``);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_org_slug\` ON \`collection\` (\`organizationKey\`, \`slug\`, \`noCustomerKey\`, \`deletedKey\`)`
		);
	}

	/**
	 * MySQL Down Migration — the index as `1791000000100` created it, then the key column it no longer uses.
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`UQ_collection_org_slug\` ON \`collection\``);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_org_slug\` ON \`collection\` (\`organizationKey\`, \`slug\`, \`deletedKey\`)`
		);
		await queryRunner.query(`ALTER TABLE \`collection\` DROP COLUMN \`noCustomerKey\``);
	}
}
