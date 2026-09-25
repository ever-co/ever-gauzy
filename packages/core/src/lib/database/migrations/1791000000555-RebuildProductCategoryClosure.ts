import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Recomputes `product_category_closure` from `product_category.parentId`, on every database.
 *
 * `1791000000550-AddProductCategoryClosure` created the closure table and wrote one self-pair per
 * category — and nothing else. Two things left the table short of the tree it is meant to index:
 *
 * - **`parentId` is older than the table.** The kernel alteration added the column first, so a
 *   database could already hold categories with parents when 550 ran, and 550 wrote none of their
 *   (ancestor, descendant) pairs.
 * - **Categories created since were written without their pairs.** Both API surfaces name a parent by
 *   `parentId`, and TypeORM's closure executor reads the `parent` relation instead, so a category
 *   created under TypeORM received its self-pair only; under MikroORM, which has no closure strategy,
 *   it received no pair at all. Every descendant read, and the cycle guard that reads the same pairs,
 *   saw each such category as a root.
 *
 * The service now keeps the table in step on every create, move and delete (see
 * `ProductCategoryClosure`), so what remains is to bring the existing rows to that state. The pairs
 * are **derived** — `parentId` is the truth — so the table is emptied and rebuilt rather than patched:
 * one self-pair per category, then one more level of ancestry per pass until a pass adds nothing. The
 * passes use no recursive query, which MySQL 5.7 does not have, and the loop is bounded by the number
 * of categories, which is the deepest a tree of them can be.
 *
 * **Two repairs happen on the way, because a correct closure cannot be built over either state.**
 *
 * - A `parentId` that names no category of the category's own tenant is cleared — the outcome the
 *   constraint's `SET NULL` produces on Postgres and MySQL for a parent that is gone, and the one
 *   SQLite, which has no such constraint, never got. A parent in another tenant is treated the same
 *   way, because it is one no read of this tenant's tree can see and the service refuses to assign.
 * - A cycle is broken. The service refused a parent inside the category's own subtree only by reading
 *   the pairs this migration exists to write, so on SQLite a loop could be stored; a category is on one
 *   exactly when it is an ancestor of its own parent, and every such category is made a root. That is
 *   the only choice that does not pick one member of the loop over another.
 *
 * On a database with neither, both statements change nothing, and a second run of the whole migration
 * produces the same table.
 */
export class RebuildProductCategoryClosure1791000000555 implements MigrationInterface {
	name = 'RebuildProductCategoryClosure1791000000555';

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
		await this.rebuild(queryRunner, '"', '"');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * Nothing to revert: the pairs are derived from `parentId`, and the rebuilt table is the one the
	 * service maintains from here on. The two repairs are not undone — the `parentId` values they cleared
	 * named a category that does not exist or closed a loop, and restoring either would restore a state
	 * no read of the tree can answer correctly.
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		return;
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.rebuild(queryRunner, '"', '"');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * Nothing to revert — see {@link postgresDownQueryRunner}.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		return;
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.rebuild(queryRunner, '`', '`');
	}

	/**
	 * MySQL Down Migration
	 *
	 * Nothing to revert — see {@link postgresDownQueryRunner}.
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		return;
	}

	/**
	 * Clears dangling parents, rebuilds the pairs, and — when the rebuilt pairs show a loop — breaks it
	 * and rebuilds once more.
	 *
	 * @param queryRunner The runner.
	 * @param open The dialect's identifier quote.
	 * @param close The dialect's identifier quote.
	 */
	private async rebuild(queryRunner: QueryRunner, open: string, close: string): Promise<void> {
		const q = (identifier: string) => `${open}${identifier}${close}`;
		const category = q('product_category');
		const closure = q('product_category_closure');

		// 1. A parent that does not exist in the category's own tenant. Read through a derived table:
		//    MySQL will not let an UPDATE's subquery read the table being updated unless the subquery is
		//    materialized first.
		await queryRunner.query(
			`UPDATE ${category} SET ${q('parentId')} = NULL ` +
				`WHERE ${q('parentId')} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM (` +
				`SELECT ${q('id')} AS ${q('existing_id')}, ${q('tenantId')} AS ${q('existing_tenant')} FROM ${category}` +
				`) ${q('existing')} ` +
				`WHERE ${q('existing')}.${q('existing_id')} = ${category}.${q('parentId')} ` +
				`AND (${q('existing')}.${q('existing_tenant')} = ${category}.${q('tenantId')} ` +
				`OR (${q('existing')}.${q('existing_tenant')} IS NULL AND ${category}.${q('tenantId')} IS NULL)))`
		);

		await this.writePairs(queryRunner, q);

		// 2. A loop: a category that is an ancestor of its own parent. Counted first, so a database
		//    without one is not rebuilt twice.
		const onALoop =
			`${q('parentId')} IS NOT NULL AND EXISTS (SELECT 1 FROM ${closure} ${q('loop_pair')} ` +
			`WHERE ${q('loop_pair')}.${q('id_ancestor')} = ${category}.${q('id')} ` +
			`AND ${q('loop_pair')}.${q('id_descendant')} = ${category}.${q('parentId')})`;

		const looped = await this.count(queryRunner, `SELECT COUNT(*) AS ${q('total')} FROM ${category} WHERE ${onALoop}`);

		if (looped > 0) {
			console.log(chalk.yellow(`${this.name}: ${looped} categories on a parent loop are made roots.`));

			await queryRunner.query(`UPDATE ${category} SET ${q('parentId')} = NULL WHERE ${onALoop}`);
			await this.writePairs(queryRunner, q);
		}
	}

	/**
	 * Empties the closure table and writes it again from `parentId`.
	 *
	 * Each pass adds, for every category with a parent, a pair with every ancestor its parent already
	 * has — one more level of ancestry per pass — and the loop stops on the first pass that adds none.
	 *
	 * @param queryRunner The runner.
	 * @param q Quotes an identifier for the dialect.
	 */
	private async writePairs(queryRunner: QueryRunner, q: (identifier: string) => string): Promise<void> {
		const category = q('product_category');
		const closure = q('product_category_closure');
		const ancestor = q('id_ancestor');
		const descendant = q('id_descendant');
		const id = q('id');

		await queryRunner.query(`DELETE FROM ${closure}`);
		await queryRunner.query(
			`INSERT INTO ${closure} (${ancestor}, ${descendant}) SELECT ${q('node')}.${id}, ${q('node')}.${id} FROM ${category} ${q('node')}`
		);

		const categories = await this.count(queryRunner, `SELECT COUNT(*) AS ${q('total')} FROM ${category}`);
		let pairs = categories;

		// Bounded by the deepest a tree of `categories` rows can be, so a loop the repair has not broken
		// yet still ends: the closure of a loop is finite, and no pass after it is complete adds a pair.
		for (let pass = 0; pass < categories; pass++) {
			await queryRunner.query(
				`INSERT INTO ${closure} (${ancestor}, ${descendant}) ` +
					`SELECT DISTINCT ${q('above')}.${ancestor}, ${q('child')}.${id} ` +
					`FROM ${category} ${q('child')} ` +
					`INNER JOIN ${closure} ${q('above')} ON ${q('above')}.${descendant} = ${q('child')}.${q('parentId')} ` +
					`WHERE NOT EXISTS (SELECT 1 FROM ${closure} ${q('existing')} ` +
					`WHERE ${q('existing')}.${ancestor} = ${q('above')}.${ancestor} ` +
					`AND ${q('existing')}.${descendant} = ${q('child')}.${id})`
			);

			const written = await this.count(queryRunner, `SELECT COUNT(*) AS ${q('total')} FROM ${closure}`);

			if (written === pairs) {
				break;
			}

			pairs = written;
		}
	}

	/**
	 * Runs a `COUNT(*) AS total` query and answers the number, whatever type the driver returns it as
	 * (Postgres answers a string, MySQL and SQLite a number).
	 */
	private async count(queryRunner: QueryRunner, sql: string): Promise<number> {
		const [row] = await queryRunner.query(sql);

		return Number(row?.total ?? (row ? Object.values(row)[0] : 0) ?? 0);
	}
}
