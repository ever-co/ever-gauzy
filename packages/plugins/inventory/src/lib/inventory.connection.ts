import { Injectable, Optional } from '@nestjs/common';
import { EntityManager as MikroOrmEntityManager, MikroORM } from '@mikro-orm/core';
import { DataSource } from 'typeorm';
import {
	MultiORMEnum,
	getORMType,
	prepareSQLQuery,
	toPositionalStatement
} from '@gauzy/core';

/**
 * The relational connection this package's read seams answer from, over whichever ORM is configured.
 *
 * **Why this exists.** Both of the package's capability seams — what may be sold of a variant, and
 * the ledger as another package reads it — were written against TypeORM's query builder, joining
 * through entity metadata. Under `DB_ORM=mikro-orm` that metadata used not to be there: `@MultiORMColumn`
 * and `@MultiORMManyToOne` emitted the TypeORM decorator only when `getORMType()` named TypeORM, so on
 * the other ORM the TypeORM entity for `warehouse_product_variant` carried the base columns and
 * nothing else. A read that filtered on `level.variantId` then raised
 * `EntityPropertyNotFoundError: Property "variantId" was not found`, and a join through
 * `level.warehouseProduct` raised for the relation. Both seams are what cart, order and warehouse
 * bind to, so the failure propagated out of this package into theirs. The kernel now registers
 * TypeORM's metadata under both ORMs (d739d81b25), so that failure is gone; the seams still read
 * through the configured ORM's connection, which is the one the request's writes go through.
 *
 * The answer is the pattern `MeasurementAuditConnection` already establishes in the kernel: both ORMs
 * expose a global module, both are injected optionally, and exactly one of them is used — the
 * configured one where it is there, and the other as the fallback, so an installation whose `DB_ORM`
 * names one ORM while both connections were started still reads through the connection it actually
 * has.
 *
 * **What travels over it is a statement, not an entity.** A read expressed here is raw SQL, because
 * that is the one language both ORMs speak identically — and it is written once, in the one spelling
 * a reader can check against the migration that created the table. The dialect differences are not
 * hand-rolled: `prepareSQLQuery` rewrites the identifiers for MySQL, which reads a double quote as
 * the start of a string literal rather than of a column name, and `toPositionalStatement` rewrites
 * the named parameters into the form the configured driver binds — `$1` on Postgres, `?` everywhere
 * else. Nothing below `QueryBuilder` substitutes a named parameter, so a statement that skipped that
 * rewrite would bind nothing on any of the four supported databases.
 *
 * It is deliberately a read surface only. Every quantity change on this platform funnels through
 * `StockLevelService.applyMovement`, and a second write path over a second connection is exactly the
 * shape that lets a level and its ledger be written apart.
 */
@Injectable()
export class InventoryOrmConnection {
	constructor(
		@Optional() private readonly dataSource?: DataSource,
		@Optional() private readonly mikroOrm?: MikroORM
	) {}

	/**
	 * Whether the MikroORM arm is the one in use.
	 *
	 * @returns True when the configured ORM is MikroORM and its connection was injected, or when it is
	 * the only connection there is.
	 */
	get usesMikroOrm(): boolean {
		if (!this.mikroOrm) {
			return false;
		}

		return getORMType() === MultiORMEnum.MikroORM || !this.dataSource;
	}

	/**
	 * A MikroORM entity manager of this read's own.
	 *
	 * **It is a fork rather than the shared one.** A seam is reached from inside a request on one path
	 * and from a queue consumer on another, and MikroORM refuses context-specific calls on the global
	 * instance; a fork also has an identity map of its own, so a reconciliation walking every level of
	 * a location does not accumulate one that outlives the answer. This is the same reason the search
	 * package's own source connection forks.
	 *
	 * @returns The forked manager.
	 * @throws Error when the MikroORM arm is not the one in use, which is a caller mistake rather than
	 * a configuration: every caller checks {@link usesMikroOrm} first.
	 */
	fork(): MikroOrmEntityManager {
		if (!this.mikroOrm) {
			throw new Error('INVENTORY_NO_CONNECTION: the MikroORM connection is not available to the inventory seams.');
		}

		return this.mikroOrm.em.fork();
	}

	/**
	 * Runs one read and answers with its rows.
	 *
	 * @param sql The statement, with `:name` parameters and double-quoted identifiers.
	 * @param parameters The values, keyed by name.
	 * @returns The rows, as the driver returned them. A driver that answers a single object rather
	 * than an array is normalised to one row, because a caller that reads `rows[0]` must not have to
	 * know which driver answered.
	 * @throws Error when neither ORM is available, which is a misconfiguration rather than an empty
	 * result: answering `[]` would report "this variant is not stocked anywhere" for a connection that
	 * was never asked.
	 */
	async rows<T = Record<string, unknown>>(sql: string, parameters: Record<string, unknown> = {}): Promise<T[]> {
		const bound = toPositionalStatement(prepareSQLQuery(sql), parameters);
		const answered = this.usesMikroOrm
			? await this.mikroOrm.em.getConnection().execute(bound.sql, bound.parameters as unknown[])
			: await this.query(bound.sql, bound.parameters as unknown[]);

		if (Array.isArray(answered)) {
			return answered as T[];
		}

		return answered === null || answered === undefined ? [] : ([answered] as T[]);
	}

	/**
	 * Runs the statement on the TypeORM connection.
	 *
	 * @param sql The statement, already in the driver's placeholder form.
	 * @param parameters The values, in the order the placeholders appear.
	 * @returns Whatever the driver answered.
	 */
	private async query(sql: string, parameters: unknown[]): Promise<unknown> {
		if (!this.dataSource) {
			throw new Error('INVENTORY_NO_CONNECTION: neither ORM is available to the inventory read seams.');
		}

		return await this.dataSource.query(sql, parameters);
	}
}
