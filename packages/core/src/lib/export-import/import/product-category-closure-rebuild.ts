import { EntityManager as TypeOrmEntityManager } from 'typeorm';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/knex';
import { ID } from '@gauzy/contracts';
import {
	IProductCategoryClosureRunner,
	mikroOrmClosureRunner,
	PRODUCT_CATEGORY_CLOSURE_TABLE,
	typeOrmClosureRunner
} from '../../product-category/product-category-closure';

/** The table whose rows the closure indexes, as the tenant import names it. */
export const PRODUCT_CATEGORY_TABLE = 'product_category';

/**
 * A closure runner that can also read: the rebuild counts what each pass wrote, and stops on the first
 * pass that wrote nothing.
 */
export interface IProductCategoryClosureRebuildRunner extends IProductCategoryClosureRunner {
	/** Runs one read; `?` marks each positional parameter, in order. Answers the rows. */
	select(sql: string, parameters: unknown[]): Promise<Record<string, unknown>[]>;
}

/**
 * The rebuild runner for a TypeORM entity manager — pass the transactional one.
 *
 * A TypeORM `query` answers a read's rows on every driver, so the read is the closure runner's own
 * statement, placeholders rewritten the same way.
 *
 * @param manager The manager whose connection (and transaction) the statements run on.
 * @returns The runner.
 */
export function typeOrmClosureRebuildRunner(manager: TypeOrmEntityManager): IProductCategoryClosureRebuildRunner {
	const runner = typeOrmClosureRunner(manager);

	return {
		...runner,
		select: async (sql, parameters) => (await runner.execute(sql, parameters)) as Record<string, unknown>[]
	};
}

/**
 * The rebuild runner for a MikroORM entity manager — pass the fork `transactional()` hands its callback.
 *
 * The closure runner executes in MikroORM's `run` mode, which answers a write's counters rather than a
 * read's rows, so the read asks for `all`.
 *
 * @param em The entity manager whose connection (and transaction) the statements run on.
 * @returns The runner.
 */
export function mikroOrmClosureRebuildRunner(em: MikroOrmEntityManager): IProductCategoryClosureRebuildRunner {
	return {
		...mikroOrmClosureRunner(em),
		select: (sql, parameters) => em.execute(sql, parameters, 'all')
	};
}

/**
 * Derives one tenant's `product_category_closure` pairs again from `product_category.parentId`.
 *
 * `ProductCategoryClosure` keeps the pairs in step one write at a time — a create, a move, a delete — and
 * each of its statements assumes the pairs it starts from are right. A bulk write that bypassed it, which
 * is what the tenant import is, leaves nothing that assumption holds for: rows with no pairs at all, or
 * with the pairs of a parent they no longer have. So the pairs are rebuilt rather than patched — the
 * level-by-level rebuild `1791000000555-RebuildProductCategoryClosure` runs over a whole database, narrowed
 * to one tenant: the tenant's pairs are removed, each of its categories gets its self-pair, and each pass
 * then adds one more level of ancestry until a pass adds nothing. No recursive query is used, which MySQL
 * 5.7 does not have, and the passes are bounded by the tenant's number of categories, the deepest a tree
 * of them can be.
 *
 * **The two repairs 555 makes are made here too, for the same reason** — a correct closure cannot be built
 * over either state: a `parentId` that names no category of the same tenant is cleared, and a loop is
 * broken by making every category on it a root (a category is on one exactly when it is an ancestor of
 * its own parent). An import can store both: a parent row removed since the archive was taken, and a loop
 * written by a re-import that points each parent at a row the first import already created.
 *
 * **Nothing outside the tenant is read or written.** The closure table carries no tenant of its own, so a
 * pair belongs to the tenant of its descendant: the pairs removed are the ones whose descendant is one of
 * the tenant's categories, the pairs written join both members to categories of the tenant, and both
 * repairs update the tenant's rows only. A category without a tenant only matches rows without one, which
 * is the rule `ProductCategoryClosure` applies.
 *
 * **Every statement is written for all four dialects,** in the forms `ProductCategoryClosure` and 555
 * already use: an `UPDATE` that reads its own table reads it through a derived table, which MySQL requires
 * and Postgres and SQLite accept unchanged, and every insert is guarded with `NOT EXISTS` rather than a
 * dialect's upsert clause. What differs between dialects — quoting and placeholders — is the runner's.
 */
export class ProductCategoryClosureRebuild {
	constructor(private readonly runner: IProductCategoryClosureRebuildRunner) {}

	/**
	 * Clears the tenant's dangling and foreign parents, rebuilds its pairs, and — when the rebuilt pairs
	 * show a loop — breaks it and rebuilds once more.
	 *
	 * Run it inside a transaction: between its first statement and its last, the tenant's tree is not
	 * readable.
	 *
	 * @param tenantId The tenant whose categories to rebuild.
	 */
	public async rebuild(tenantId: ID | null): Promise<void> {
		await this.clearForeignParents(tenantId);
		await this.writePairs(tenantId);

		if ((await this.countOnALoop(tenantId)) > 0) {
			await this.breakLoops(tenantId);
			await this.writePairs(tenantId);
		}
	}

	/**
	 * Clears a `parentId` of the tenant that names no category of the tenant.
	 *
	 * The candidates are read through a derived table: MySQL will not let an `UPDATE`'s subquery read the
	 * table being updated unless the subquery is materialized first.
	 */
	private async clearForeignParents(tenantId: ID | null): Promise<void> {
		const { category, id, parentId } = this.names();

		await this.runner.execute(
			`UPDATE ${category} SET ${parentId} = NULL ` +
				`WHERE ${this.tenantCondition(category, tenantId)} AND ${category}.${parentId} IS NOT NULL ` +
				`AND NOT EXISTS (SELECT 1 FROM (` +
				`SELECT existing_row.${id} AS ${this.q('existing_id')} FROM ${category} existing_row ` +
				`WHERE ${this.tenantCondition('existing_row', tenantId)}` +
				`) ${this.q('existing')} WHERE ${this.q('existing')}.${this.q('existing_id')} = ${category}.${parentId})`,
			[...this.tenantParameters(tenantId), ...this.tenantParameters(tenantId)]
		);
	}

	/**
	 * Removes the tenant's pairs and writes them again from `parentId`.
	 *
	 * Each pass adds, for every category of the tenant with a parent, a pair with every ancestor its parent
	 * already has — one more level of ancestry per pass — and the loop stops on the first pass that adds
	 * none.
	 */
	private async writePairs(tenantId: ID | null): Promise<void> {
		const { closure, category, ancestor, descendant, id, parentId } = this.names();
		const tenant = this.tenantParameters(tenantId);

		await this.runner.execute(
			`DELETE FROM ${closure} WHERE ${descendant} IN (` +
				`SELECT node.${id} FROM ${category} node WHERE ${this.tenantCondition('node', tenantId)})`,
			tenant
		);

		await this.runner.execute(
			`INSERT INTO ${closure} (${ancestor}, ${descendant}) ` +
				`SELECT node.${id}, node.${id} FROM ${category} node ` +
				`WHERE ${this.tenantCondition('node', tenantId)} ` +
				`AND NOT EXISTS (SELECT 1 FROM ${closure} existing ` +
				`WHERE existing.${ancestor} = node.${id} AND existing.${descendant} = node.${id})`,
			tenant
		);

		const categories = await this.count(
			`SELECT COUNT(*) AS ${this.q('total')} FROM ${category} node WHERE ${this.tenantCondition('node', tenantId)}`,
			tenant
		);
		let pairs = await this.countPairs(tenantId);

		// Bounded by the deepest a tree of `categories` rows can be, so a loop not broken yet still ends:
		// the closure of a loop is finite, and no pass after it is complete adds a pair.
		for (let pass = 0; pass < categories; pass++) {
			await this.runner.execute(
				`INSERT INTO ${closure} (${ancestor}, ${descendant}) ` +
					`SELECT DISTINCT above.${ancestor}, child.${id} ` +
					`FROM ${category} child ` +
					`INNER JOIN ${closure} above ON above.${descendant} = child.${parentId} ` +
					`INNER JOIN ${category} ancestor_row ON ancestor_row.${id} = above.${ancestor} ` +
					`WHERE ${this.tenantCondition('child', tenantId)} AND ${this.tenantCondition('ancestor_row', tenantId)} ` +
					`AND NOT EXISTS (SELECT 1 FROM ${closure} existing ` +
					`WHERE existing.${ancestor} = above.${ancestor} AND existing.${descendant} = child.${id})`,
				[...tenant, ...tenant]
			);

			const written = await this.countPairs(tenantId);

			if (written === pairs) {
				break;
			}

			pairs = written;
		}
	}

	/** How many of the tenant's categories are an ancestor of their own parent. */
	private async countOnALoop(tenantId: ID | null): Promise<number> {
		const { category } = this.names();

		return await this.count(
			`SELECT COUNT(*) AS ${this.q('total')} FROM ${category} node ` +
				`WHERE ${this.tenantCondition('node', tenantId)} AND ${this.onALoop('node')}`,
			this.tenantParameters(tenantId)
		);
	}

	/**
	 * Makes every category of the tenant that is on a loop a root — the only choice that does not pick one
	 * member of the loop over another. What hangs below the loop keeps its parent.
	 */
	private async breakLoops(tenantId: ID | null): Promise<void> {
		const { category, parentId } = this.names();

		await this.runner.execute(
			`UPDATE ${category} SET ${parentId} = NULL ` +
				`WHERE ${this.tenantCondition(category, tenantId)} AND ${this.onALoop(category)}`,
			this.tenantParameters(tenantId)
		);
	}

	/** A category with a parent that it is itself an ancestor of. */
	private onALoop(alias: string): string {
		const { closure, ancestor, descendant, id, parentId } = this.names();

		return (
			`${alias}.${parentId} IS NOT NULL AND EXISTS (SELECT 1 FROM ${closure} loop_pair ` +
			`WHERE loop_pair.${ancestor} = ${alias}.${id} AND loop_pair.${descendant} = ${alias}.${parentId})`
		);
	}

	/** How many pairs the tenant's categories are the descendant of. */
	private async countPairs(tenantId: ID | null): Promise<number> {
		const { closure, category, descendant, id } = this.names();

		return await this.count(
			`SELECT COUNT(*) AS ${this.q('total')} FROM ${closure} tree_pair ` +
				`INNER JOIN ${category} member_row ON member_row.${id} = tree_pair.${descendant} ` +
				`WHERE ${this.tenantCondition('member_row', tenantId)}`,
			this.tenantParameters(tenantId)
		);
	}

	/**
	 * Runs a `COUNT(*) AS total` read and answers the number, whatever type the driver returns it as
	 * (Postgres answers a string, MySQL and SQLite a number).
	 */
	private async count(sql: string, parameters: unknown[]): Promise<number> {
		const [row] = await this.runner.select(sql, parameters);

		return Number(row?.['total'] ?? (row ? Object.values(row)[0] : 0) ?? 0);
	}

	/** The quoted names every statement uses. */
	private names() {
		return {
			closure: this.q(PRODUCT_CATEGORY_CLOSURE_TABLE),
			category: this.q(PRODUCT_CATEGORY_TABLE),
			ancestor: this.q('id_ancestor'),
			descendant: this.q('id_descendant'),
			id: this.q('id'),
			parentId: this.q('parentId')
		};
	}

	/**
	 * The tenant condition on one `product_category` row, named by an alias or by the quoted table name.
	 * A category without a tenant only matches rows without one.
	 */
	private tenantCondition(alias: string, tenantId: ID | null): string {
		return tenantId ? `${alias}.${this.q('tenantId')} = ?` : `${alias}.${this.q('tenantId')} IS NULL`;
	}

	/** The parameter {@link tenantCondition} binds, if it binds one. */
	private tenantParameters(tenantId: ID | null): unknown[] {
		return tenantId ? [tenantId] : [];
	}

	private q(identifier: string): string {
		return this.runner.quote(identifier);
	}
}
