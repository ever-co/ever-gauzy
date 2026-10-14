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
 * no longer holds for the data, and `down` fails rather than deleting either list. It fails with the current
 * index still in place on every dialect: Postgres and SQLite roll the migration's DDL back, and on MySQL,
 * which commits each DDL statement, the replacement index is built before the current one is dropped.
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
	 * MySQL commits every DDL statement on its own, so the migration's transaction cannot put back an index
	 * that a statement dropped before a later one failed. The replacement is therefore built under a
	 * temporary name first and swapped in only once it exists: whichever statement fails, the collection is
	 * never left without a slug rule. The key column is only added when it is missing, so a retried run
	 * continues where the failed one stopped.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasColumn('collection', 'noCustomerKey'))) {
			await queryRunner.query(
				`ALTER TABLE \`collection\` ADD \`noCustomerKey\` varchar(36) GENERATED ALWAYS AS (IF(\`customerId\` IS NULL, '0', \`id\`)) VIRTUAL`
			);
		}
		await this.mysqlSwapIndex(queryRunner, `(\`organizationKey\`, \`slug\`, \`noCustomerKey\`, \`deletedKey\`)`);
	}

	/**
	 * MySQL Down Migration — the index as `1791000000100` created it, then the key column it no longer uses.
	 *
	 * The wider index is built under a temporary name before the current one is dropped. When the data no
	 * longer satisfies the old rule (two buyers' lists of one slug), the run fails on that `CREATE` with
	 * `1062` and the current index is still in place.
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.mysqlSwapIndex(queryRunner, `(\`organizationKey\`, \`slug\`, \`deletedKey\`)`);
		if (await queryRunner.hasColumn('collection', 'noCustomerKey')) {
			await queryRunner.query(`ALTER TABLE \`collection\` DROP COLUMN \`noCustomerKey\``);
		}
	}

	/**
	 * Replaces `UQ_collection_org_slug` by an index over `columns`: built as `UQ_collection_org_slug_next`,
	 * then the current index is dropped and the new one renamed into its place.
	 *
	 * A run interrupted part-way (MySQL commits each statement) is picked up where it stopped, and at no
	 * point is the collection left without a slug rule:
	 * - stopped after building `_next` and before dropping the current index: the current index still holds
	 *   the rule, and `_next`, which may be of either shape, is dropped and rebuilt;
	 * - stopped after dropping the current index and before the rename: `_next` is the only rule left, so it
	 *   takes the current name back first, and the swap then runs as usual.
	 *
	 * @param queryRunner
	 * @param columns The new index's column list, parenthesised.
	 */
	private async mysqlSwapIndex(queryRunner: QueryRunner, columns: string): Promise<void> {
		const exists = async (name: string): Promise<boolean> =>
			(
				await queryRunner.query(
					`SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collection' AND INDEX_NAME = ? LIMIT 1`,
					[name]
				)
			).length > 0;

		if (await exists('UQ_collection_org_slug_next')) {
			if (await exists('UQ_collection_org_slug')) {
				await queryRunner.query(`DROP INDEX \`UQ_collection_org_slug_next\` ON \`collection\``);
			} else {
				await queryRunner.query(
					`ALTER TABLE \`collection\` RENAME INDEX \`UQ_collection_org_slug_next\` TO \`UQ_collection_org_slug\``
				);
			}
		}

		if (!(await exists('UQ_collection_org_slug'))) {
			// Nothing to keep in place while the new index is built.
			await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_collection_org_slug\` ON \`collection\` ${columns}`);
			return;
		}

		await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_collection_org_slug_next\` ON \`collection\` ${columns}`);
		await queryRunner.query(`DROP INDEX \`UQ_collection_org_slug\` ON \`collection\``);
		await queryRunner.query(
			`ALTER TABLE \`collection\` RENAME INDEX \`UQ_collection_org_slug_next\` TO \`UQ_collection_org_slug\``
		);
	}
}
