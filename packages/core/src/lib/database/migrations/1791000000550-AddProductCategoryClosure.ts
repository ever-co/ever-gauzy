import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Delivers the closure table the category tree is walked through (schema §2.2, task CE-97).
 *
 * `product_category.parentId` was added by the kernel alteration before this, deliberately without its
 * constraint: a kernel migration adds columns and never waits for a table it does not own. The column
 * on its own makes the taxonomy a tree only in name — "every descendant of a category" is the read a
 * catalogue navigation performs on every request, and answering it from `parentId` alone means a
 * recursive walk, which SQLite and MySQL 5.7 do not express efficiently and which the embedded
 * database a demo runs on is exactly the case for. The closure table is the third option and the one
 * the schema chapter chose: one row per (ancestor, descendant) pair, including the self-pair, so the
 * read is one indexed join and a re-parent is a write the ORM makes.
 *
 * **The backfill is the part that is easy to forget and impossible to notice.** The ORM's tree reads
 * assume a self-pair row for every row — a category whose self-pair is missing is invisible to
 * `findTrees` and to every descendant query, and nothing about the schema would say so. The self-pairs
 * are therefore written here, in the same migration that creates the table, and the insert is written
 * so that running it again changes nothing. They are not the whole closure: `parentId` existed before
 * this migration, so a category may already have had a parent, and the (ancestor, descendant) pairs of
 * such a tree are written by `1791000000555-RebuildProductCategoryClosure`, which recomputes the whole
 * table from `parentId` and so also covers every database that ran this migration before it existed.
 *
 * **The self-referencing constraint on `parentId` is added on Postgres and MySQL and deferred on
 * SQLite**, which is a real difference rather than a convenience. SQLite cannot add a constraint to an
 * existing table: it has to be rebuilt — rename aside, recreate, copy, drop — and `product_category` is
 * a core table with five foreign keys of its own, eleven indexes and a translation table pointing at
 * it. A rebuild of that table belongs in a migration that is only a rebuild and has only that to
 * verify, not in the migration that introduces the tree; a wrong column list here would silently drop
 * data rather than fail. Until then, a category deleted on SQLite leaves its children named by a
 * `parentId` that no longer resolves, which the service's own re-parent handles — see
 * `ProductCategoryService.delete`, which detaches the children of the category it removes on every
 * dialect, so the behaviour the schema promises holds everywhere even where the constraint does not.
 *
 * **A `parentId` that names no category is cleared before the constraint is added.** The column had
 * no constraint until now, so a database may hold a child whose parent was removed; adding the
 * foreign key over such a row fails and stops the migration chain. Clearing it first is the outcome
 * the constraint's own `SET NULL` would have produced had it been there, and on a database without
 * such a row — every database that has already run this migration, since the constraint could not
 * have been added otherwise — the statement changes nothing.
 */
export class AddProductCategoryClosure1791000000550 implements MigrationInterface {
	name = 'AddProductCategoryClosure1791000000550';

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
		await queryRunner.query(
			`CREATE TABLE "product_category_closure" ("id_ancestor" uuid NOT NULL, "id_descendant" uuid NOT NULL, CONSTRAINT "PK_product_category_closure" PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_category_closure_ancestor" ON "product_category_closure" ("id_ancestor")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_category_closure_descendant" ON "product_category_closure" ("id_descendant")`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category_closure" ADD CONSTRAINT "FK_product_category_closure_ancestor" FOREIGN KEY ("id_ancestor") REFERENCES "product_category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category_closure" ADD CONSTRAINT "FK_product_category_closure_descendant" FOREIGN KEY ("id_descendant") REFERENCES "product_category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.backfill(queryRunner, '"', '"');
		await this.clearDanglingParents(queryRunner, '"', '"');

		// The self-referencing rule: a deleted parent makes its children roots rather than deleting them.
		await queryRunner.query(
			`ALTER TABLE "product_category" ADD CONSTRAINT "FK_product_category_parent" FOREIGN KEY ("parentId") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "product_category" DROP CONSTRAINT "FK_product_category_parent"`);
		await queryRunner.query(
			`ALTER TABLE "product_category_closure" DROP CONSTRAINT "FK_product_category_closure_descendant"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category_closure" DROP CONSTRAINT "FK_product_category_closure_ancestor"`
		);
		await queryRunner.query(`DROP TABLE "product_category_closure"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "product_category_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, CONSTRAINT "PK_product_category_closure" PRIMARY KEY ("id_ancestor", "id_descendant"), CONSTRAINT "FK_product_category_closure_ancestor" FOREIGN KEY ("id_ancestor") REFERENCES "product_category" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_product_category_closure_descendant" FOREIGN KEY ("id_descendant") REFERENCES "product_category" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_category_closure_ancestor" ON "product_category_closure" ("id_ancestor")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_category_closure_descendant" ON "product_category_closure" ("id_descendant")`
		);

		await this.backfill(queryRunner, '"', '"');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_product_category_closure_descendant"`);
		await queryRunner.query(`DROP INDEX "IDX_product_category_closure_ancestor"`);
		await queryRunner.query(`DROP TABLE "product_category_closure"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`product_category_closure\` (\`id_ancestor\` varchar(36) NOT NULL, \`id_descendant\` varchar(36) NOT NULL, INDEX \`IDX_product_category_closure_ancestor\` (\`id_ancestor\`), INDEX \`IDX_product_category_closure_descendant\` (\`id_descendant\`), PRIMARY KEY (\`id_ancestor\`, \`id_descendant\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_closure\` ADD CONSTRAINT \`FK_product_category_closure_ancestor\` FOREIGN KEY (\`id_ancestor\`) REFERENCES \`product_category\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_closure\` ADD CONSTRAINT \`FK_product_category_closure_descendant\` FOREIGN KEY (\`id_descendant\`) REFERENCES \`product_category\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.backfill(queryRunner, '`', '`');
		await this.clearDanglingParents(queryRunner, '`', '`');

		await queryRunner.query(
			`ALTER TABLE \`product_category\` ADD CONSTRAINT \`FK_product_category_parent\` FOREIGN KEY (\`parentId\`) REFERENCES \`product_category\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`product_category\` DROP FOREIGN KEY \`FK_product_category_parent\``);
		await queryRunner.query(
			`ALTER TABLE \`product_category_closure\` DROP FOREIGN KEY \`FK_product_category_closure_descendant\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_closure\` DROP FOREIGN KEY \`FK_product_category_closure_ancestor\``
		);
		await queryRunner.query(`DROP TABLE \`product_category_closure\``);
	}

	/**
	 * Writes the self-pair of every category that exists.
	 *
	 * A category with no self-pair is invisible to the tree reads, so this is what makes the tree answer
	 * for the rows that were already there. `WHERE NOT EXISTS` is written out rather than left to the
	 * primary key: a migration that is re-run after a partial failure would otherwise die on the
	 * duplicate key and stop the chain, which is a worse answer than doing nothing twice.
	 *
	 * @param queryRunner The runner.
	 * @param open The dialect's identifier quote.
	 * @param close The dialect's identifier quote.
	 */
	private async backfill(queryRunner: QueryRunner, open: string, close: string): Promise<void> {
		const category = `${open}product_category${close}`;
		const closure = `${open}product_category_closure${close}`;

		await queryRunner.query(
			`INSERT INTO ${closure} (${open}id_ancestor${close}, ${open}id_descendant${close}) ` +
				`SELECT category.${open}id${close}, category.${open}id${close} FROM ${category} AS category ` +
				`WHERE NOT EXISTS (SELECT 1 FROM ${closure} AS existing ` +
				`WHERE existing.${open}id_ancestor${close} = category.${open}id${close} ` +
				`AND existing.${open}id_descendant${close} = category.${open}id${close})`
		);
	}

	/**
	 * Clears every `parentId` that names no category, so the self-referencing constraint can be added.
	 *
	 * The ids that exist are read through a derived table rather than straight from `product_category`:
	 * MySQL refuses an `UPDATE` whose subquery reads the table being updated unless that subquery is
	 * materialized first, and the derived table is what materializes it. Postgres accepts the same form
	 * unchanged, so one statement serves both dialects that add the constraint.
	 *
	 * @param queryRunner The runner.
	 * @param open The dialect's identifier quote.
	 * @param close The dialect's identifier quote.
	 */
	private async clearDanglingParents(queryRunner: QueryRunner, open: string, close: string): Promise<void> {
		const category = `${open}product_category${close}`;
		const parentId = `${open}parentId${close}`;
		const existingId = `${open}existing_id${close}`;

		await queryRunner.query(
			`UPDATE ${category} SET ${parentId} = NULL ` +
				`WHERE ${parentId} IS NOT NULL AND ${parentId} NOT IN (` +
				`SELECT ${existingId} FROM (SELECT ${open}id${close} AS ${existingId} FROM ${category}) ${open}existing${close})`
		);
	}
}
