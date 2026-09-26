import { EntityManager as TypeOrmEntityManager } from 'typeorm';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/knex';
import { ID } from '@gauzy/contracts';

/** The table the closure lives in, as `1791000000550-AddProductCategoryClosure` creates it. */
export const PRODUCT_CATEGORY_CLOSURE_TABLE = 'product_category_closure';

/**
 * Runs one closure statement on the connection — and inside the transaction — the caller is writing
 * through.
 *
 * The statements are written once, with `?` marking each positional parameter, and each ORM supplies
 * the two things that differ between dialects: how an identifier is quoted and how a parameter is
 * written. That is what lets the same maintenance run under `DB_ORM=typeorm` and `DB_ORM=mikro-orm`,
 * on every dialect, rather than being a TypeORM feature the other ORM silently lacks.
 */
export interface IProductCategoryClosureRunner {
	/** Quotes an identifier the way the connection's dialect does. */
	quote(identifier: string): string;

	/** Runs one statement; `?` marks each positional parameter, in order. */
	execute(sql: string, parameters: unknown[]): Promise<unknown>;
}

/**
 * The runner for a TypeORM entity manager — pass the transactional one to write inside a transaction.
 *
 * TypeORM hands the SQL to the driver as written, so the placeholders are rewritten into the driver's
 * own form: `$1, $2, …` on Postgres, `?` on MySQL and both SQLite drivers.
 *
 * @param manager The manager whose connection (and transaction) the statements run on.
 * @returns The runner.
 */
export function typeOrmClosureRunner(manager: TypeOrmEntityManager): IProductCategoryClosureRunner {
	const driver = manager.connection.driver;

	return {
		quote: (identifier) => driver.escape(identifier),
		execute: (sql, parameters) => {
			let index = 0;

			return manager.query(
				sql.replace(/\?/g, () => driver.createParameter(`closure_${index}`, index++)),
				parameters
			);
		}
	};
}

/**
 * The runner for a MikroORM entity manager — pass the fork `transactional()` hands its callback to
 * write inside that transaction.
 *
 * MikroORM formats `?` parameters itself on every dialect, so the SQL is passed through unchanged.
 *
 * @param em The entity manager whose connection (and transaction) the statements run on.
 * @returns The runner.
 */
export function mikroOrmClosureRunner(em: MikroOrmEntityManager): IProductCategoryClosureRunner {
	return {
		quote: (identifier) => em.getPlatform().quoteIdentifier(identifier),
		execute: (sql, parameters) => em.execute(sql, parameters, 'run')
	};
}

/**
 * The (ancestor, descendant) pairs of the category tree, kept in step with `product_category.parentId`.
 *
 * `parentId` is the truth; the closure table is the index that answers "every category below this one"
 * in one join. It stays true only if every write that changes the tree changes it too, and the writes
 * that do are exactly three: a category is created (it gains its self-pair and a pair with each of
 * its ancestors), a category is moved (its subtree loses the pairs to its old ancestors and gains
 * the pairs to its new ones), and a category is removed (the pairs through it go, so each child's
 * subtree becomes a tree of its own). Each of the three is one method here.
 *
 * **Why the service does this itself.** TypeORM's closure strategy writes the pairs of a row it
 * inserts only when the entity carries the `parent` *relation* — a row created from `parentId`, which
 * is what both API surfaces send, receives its self-pair and nothing else — and it rewrites them on
 * a move only when that relation is loaded and changed; it never touches them on a delete. MikroORM
 * has no closure strategy at all. A derived table that only one ORM maintains, and only for one
 * payload shape, is wrong on the other path without anything saying so. So a TypeORM create hands the
 * relation to the insert — TypeORM's executor then writes the new row's pairs inside the insert's own
 * transaction — and every other write that changes the tree, on both ORMs, runs the statements here:
 * a MikroORM create ({@link attach}), and every move ({@link move}) and delete ({@link detach}).
 *
 * **Every statement is written for all four dialects.** The self-referencing deletes select their
 * members through a derived table (`IN (SELECT … FROM (SELECT …) AS …)`), which MySQL requires before
 * it lets a `DELETE` read the table it deletes from and which Postgres and SQLite accept unchanged —
 * TypeORM's own closure executor uses the same form for the same reason. The inserts are guarded
 * with `NOT EXISTS` rather than a dialect's upsert clause, so running one twice writes nothing twice.
 *
 * **Every statement is scoped to the tenant.** The ids a caller hands in have been read through the
 * tenant-scoped service before they reach here, and the statements scope once more by joining each
 * member to `product_category` under the same tenant, so a pair can never be written to — or taken
 * from — a row of another tenant even if an id were somehow foreign.
 */
export class ProductCategoryClosure {
	constructor(private readonly runner: IProductCategoryClosureRunner) {}

	/**
	 * Records a category that was just created: its self-pair, and a pair with its parent and with each
	 * of the parent's ancestors. Both inserts are no-ops for a pair that is already there, so it is safe
	 * over a row whose insert already wrote some of them.
	 *
	 * @param categoryId The new category.
	 * @param parentId Its parent, or null for a root.
	 * @param tenantId The tenant both belong to.
	 */
	public async attach(categoryId: ID, parentId: ID | null, tenantId: ID | null): Promise<void> {
		await this.ensureSelfPair(categoryId, tenantId);

		if (parentId) {
			await this.link(categoryId, parentId, tenantId);
		}
	}

	/**
	 * Moves a category, and its whole subtree with it, under another parent.
	 *
	 * The pairs that tie the subtree to anything outside it are removed first — they are the old
	 * ancestors — and the subtree is then tied to the new parent and to each of its ancestors. The
	 * pairs inside the subtree are left alone: a move does not change who is below whom within it.
	 *
	 * @param categoryId The category being moved.
	 * @param parentId The new parent, or null to make the category a root.
	 * @param tenantId The tenant the category belongs to.
	 */
	public async move(categoryId: ID, parentId: ID | null, tenantId: ID | null): Promise<void> {
		await this.unlink(categoryId, tenantId);
		await this.ensureSelfPair(categoryId, tenantId);

		if (parentId) {
			await this.link(categoryId, parentId, tenantId);
		}
	}

	/**
	 * Takes a category that is about to be removed out of the tree.
	 *
	 * Its children become roots — the `SET NULL` rule — so every pair that runs from the category, or
	 * from one of its ancestors, into the levels below it is removed, and so is every pair that names
	 * the category itself. What is left below it is each child's own subtree, intact. The pairs naming
	 * the category are deleted here rather than left to the foreign key's `CASCADE`, so the outcome
	 * does not depend on the dialect enforcing it.
	 *
	 * @param categoryId The category being removed.
	 * @param tenantId The tenant it belongs to.
	 */
	public async detach(categoryId: ID, tenantId: ID | null): Promise<void> {
		const { closure, category, ancestor, descendant, id } = this.names();

		await this.runner.execute(
			`DELETE FROM ${closure} ` +
				`WHERE ${descendant} IN (SELECT ${this.q('member_id')} FROM (` +
				`SELECT below.${descendant} AS ${this.q('member_id')} FROM ${closure} below ` +
				`INNER JOIN ${category} member_row ON member_row.${id} = below.${descendant} ` +
				`WHERE below.${ancestor} = ? AND below.${descendant} <> ? AND ${this.tenantCondition('member_row', tenantId)}` +
				`) ${this.q('subtree')}) ` +
				`AND ${ancestor} IN (SELECT ${this.q('member_id')} FROM (` +
				`SELECT above.${ancestor} AS ${this.q('member_id')} FROM ${closure} above WHERE above.${descendant} = ?` +
				`) ${this.q('supertree')})`,
			[categoryId, categoryId, ...this.tenantParameters(tenantId), categoryId]
		);

		await this.runner.execute(
			`DELETE FROM ${closure} WHERE (${ancestor} = ? OR ${descendant} = ?) ` +
				`AND EXISTS (SELECT 1 FROM ${category} node WHERE node.${id} = ? AND ${this.tenantCondition('node', tenantId)})`,
			[categoryId, categoryId, categoryId, ...this.tenantParameters(tenantId)]
		);
	}

	/**
	 * Writes the self-pair of a category that has none.
	 *
	 * Every category needs one — the tree reads join through it, so a row without it is invisible to
	 * them. TypeORM writes it for every row it inserts; MikroORM does not, which is why this runs on
	 * both and why it is a no-op when the pair is already there.
	 */
	private async ensureSelfPair(categoryId: ID, tenantId: ID | null): Promise<void> {
		const { closure, category, ancestor, descendant, id } = this.names();

		await this.runner.execute(
			`INSERT INTO ${closure} (${ancestor}, ${descendant}) ` +
				`SELECT node.${id}, node.${id} FROM ${category} node ` +
				`WHERE node.${id} = ? AND ${this.tenantCondition('node', tenantId)} ` +
				`AND NOT EXISTS (SELECT 1 FROM ${closure} existing ` +
				`WHERE existing.${ancestor} = node.${id} AND existing.${descendant} = node.${id})`,
			[categoryId, ...this.tenantParameters(tenantId)]
		);
	}

	/**
	 * Ties a subtree to a parent: one pair for every (ancestor-or-self of the parent, member of the
	 * subtree), each written only if it is not there yet.
	 */
	private async link(categoryId: ID, parentId: ID, tenantId: ID | null): Promise<void> {
		const { closure, category, ancestor, descendant, id } = this.names();

		await this.runner.execute(
			`INSERT INTO ${closure} (${ancestor}, ${descendant}) ` +
				`SELECT DISTINCT above.${ancestor}, below.${descendant} ` +
				`FROM ${closure} above CROSS JOIN ${closure} below ` +
				`INNER JOIN ${category} ancestor_row ON ancestor_row.${id} = above.${ancestor} ` +
				`INNER JOIN ${category} member_row ON member_row.${id} = below.${descendant} ` +
				`WHERE above.${descendant} = ? AND below.${ancestor} = ? ` +
				`AND ${this.tenantCondition('ancestor_row', tenantId)} AND ${this.tenantCondition('member_row', tenantId)} ` +
				`AND NOT EXISTS (SELECT 1 FROM ${closure} existing ` +
				`WHERE existing.${ancestor} = above.${ancestor} AND existing.${descendant} = below.${descendant})`,
			[parentId, categoryId, ...this.tenantParameters(tenantId), ...this.tenantParameters(tenantId)]
		);
	}

	/**
	 * Cuts a subtree from everything outside it: every pair whose descendant is in the subtree and whose
	 * ancestor is not.
	 *
	 * "Not in the subtree" rather than "one of the old ancestors" is deliberate — it is the formulation
	 * that stays correct even for a row whose pairs were written wrongly before, because it removes
	 * every tie from outside rather than only the ones it expects to find.
	 */
	private async unlink(categoryId: ID, tenantId: ID | null): Promise<void> {
		const { closure, category, ancestor, descendant, id } = this.names();

		await this.runner.execute(
			`DELETE FROM ${closure} ` +
				`WHERE ${descendant} IN (SELECT ${this.q('member_id')} FROM (` +
				`SELECT below.${descendant} AS ${this.q('member_id')} FROM ${closure} below ` +
				`INNER JOIN ${category} member_row ON member_row.${id} = below.${descendant} ` +
				`WHERE below.${ancestor} = ? AND ${this.tenantCondition('member_row', tenantId)}` +
				`) ${this.q('subtree')}) ` +
				`AND ${ancestor} NOT IN (SELECT ${this.q('member_id')} FROM (` +
				`SELECT inside.${descendant} AS ${this.q('member_id')} FROM ${closure} inside WHERE inside.${ancestor} = ?` +
				`) ${this.q('subtree_members')})`,
			[categoryId, ...this.tenantParameters(tenantId), categoryId]
		);
	}

	/** The quoted names every statement uses. */
	private names() {
		return {
			closure: this.q(PRODUCT_CATEGORY_CLOSURE_TABLE),
			category: this.q('product_category'),
			ancestor: this.q('id_ancestor'),
			descendant: this.q('id_descendant'),
			id: this.q('id')
		};
	}

	/**
	 * The tenant condition on one joined `product_category` row. A category without a tenant only
	 * matches rows without one, which is the same rule the service's reads apply.
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
