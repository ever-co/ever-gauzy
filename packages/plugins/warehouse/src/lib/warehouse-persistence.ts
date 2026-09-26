import { ObjectLiteral, Repository } from 'typeorm';
import {
	Collection,
	EntityManager as MikroOrmEntityManager,
	EntityMetadata,
	Reference,
	ReferenceKind,
	wrap
} from '@mikro-orm/core';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { MultiORMEnum, convertTypeORMWhereToMikroORM, parseOrderOptions } from '@gauzy/core';

/**
 * How this package reads and edits its rows under `DB_ORM=mikro-orm`.
 *
 * **Why the package needs it.** Both ORMs are opened whatever `DB_ORM` says, but only the configured
 * one carries this package's columns: `@MultiORMColumn` and the relation decorators apply the active
 * ORM's decorator alone, so under MikroORM the TypeORM entity for `warehouse_bin` has the base entity's
 * columns and nothing else. The services read through their TypeORM repositories with no ORM branch —
 * the scoped read every route starts from, the guards a delete is refused by, the pick path, the tree —
 * so on that ORM each of those reads failed, or answered a bin with no zone, no parent and no tenant.
 *
 * **The shape of the answer.** {@link warehouseRowsOf} hands a service the repository it reads a table
 * through. Under TypeORM it **is** the TypeORM repository the service always read through, so a call that
 * goes through it is the call it always was, on the object it always was. Under MikroORM it answers the
 * same four calls — `find`, `findOne`, `count` and `update`, in TypeORM's find-options vocabulary — through
 * a fork of the repository's entity manager, and answers each row in the shape TypeORM answers it.
 */

/** A MikroORM repository, reduced to the one member this module reaches it through. */
export interface IMikroOrmEntityManagerSource {
	getEntityManager(): MikroOrmEntityManager;
}

/** A read, in TypeORM's find-options vocabulary, as far as this package states one. */
export interface IWarehouseFindOptions {
	where?: Record<string, unknown>;
	order?: Record<string, unknown>;
	relations?: Record<string, boolean>;
	take?: number;
	skip?: number;
	withDeleted?: boolean;
}

/** The repository calls this package reads and edits a table through. */
export type TWarehouseRows<T extends ObjectLiteral> = Pick<Repository<T>, 'find' | 'findOne' | 'count' | 'update'>;

/**
 * The repository a service reads and edits one of this package's tables through, on the ORM the
 * installation runs.
 *
 * Each ORM's repository is reached only on its own arm, so a TypeORM installation never touches MikroORM
 * and a MikroORM one never touches TypeORM.
 *
 * @param ormType The ORM the installation runs.
 * @param entity The table's entity.
 * @param typeOrm The TypeORM repository, reached only under TypeORM.
 * @param mikroOrm A MikroORM repository of this package, reached only under MikroORM; its entity manager
 * reaches every table, so the repository of another table serves as well.
 * @returns The repository.
 */
export function warehouseRowsOf<T extends ObjectLiteral>(
	ormType: string,
	entity: new () => T,
	typeOrm: () => Repository<T>,
	mikroOrm: () => IMikroOrmEntityManagerSource
): TWarehouseRows<T> {
	if (ormType !== MultiORMEnum.MikroORM) {
		return typeOrm();
	}

	const rows = () => new MikroOrmWarehouseRows<T>(mikroOrm().getEntityManager().fork(), entity);

	return {
		find: (options: IWarehouseFindOptions = {}) => rows().find(options),
		findOne: (options: IWarehouseFindOptions = {}) => rows().findOne(options),
		count: (options: IWarehouseFindOptions = {}) => rows().count(options),
		update: (criteria: string | Record<string, unknown>, patch: Record<string, unknown>) =>
			rows().update(criteria, patch)
	} as unknown as TWarehouseRows<T>;
}

/**
 * One table's `find`, `findOne`, `count` and `update`, answered through MikroORM as TypeORM answers them.
 *
 * - **a read is a read of the table, never of an identity map**, and runs on a fork of its own, so a
 *   caller outside any request — a job, a consumer — is not refused MikroORM's global manager;
 * - **a read skips a retired row unless it states `withDeleted`, and an update reaches one**, as
 *   TypeORM's do: MikroORM's soft-delete filter is lifted for `withDeleted` and for every update;
 * - **`skip` is a row offset**, as TypeORM reads it;
 * - **a relation id is written through its relation.** `tenantId`, `organizationId`, `warehouseId` and
 *   `zoneId` are `relationId` columns, which MikroORM maps `persist: false` beside the relation that owns
 *   the column; an update names the relation, read off the entity's own metadata;
 * - **an update moves `updatedAt`**, as TypeORM's update-date column does, and answers TypeORM's
 *   `{ affected }`;
 * - **a row is answered in TypeORM's shape**: a plain object of the row's columns and relation ids, with a
 *   relation only when the read asked for it and a collection as an array. A MikroORM entity would carry
 *   every many-to-one as a bare reference — which a field resolver that returns the relation it finds on
 *   the row would hand on with nothing but its key — and would serialise through its metadata, dropping
 *   anything the caller attached to the row afterwards.
 */
export class MikroOrmWarehouseRows<T extends ObjectLiteral> {
	constructor(
		private readonly em: MikroOrmEntityManager,
		private readonly entity: new () => T
	) {}

	/**
	 * @param options The read, in TypeORM's vocabulary.
	 * @returns The rows.
	 */
	async find(options: IWarehouseFindOptions = {}): Promise<T[]> {
		const rows = await this.em.find(this.entity as any, this.criteria(options.where), {
			...this.readOptions(options),
			...(options.take ? { limit: options.take } : {}),
			...(options.skip ? { offset: options.skip } : {})
		} as any);

		return rows.map((row) => this.toRow(row, populated(options)) as T);
	}

	/**
	 * @param options The read, in TypeORM's vocabulary.
	 * @returns The first row that matches, or null.
	 */
	async findOne(options: IWarehouseFindOptions = {}): Promise<T | null> {
		const row = await this.em.findOne(
			this.entity as any,
			this.criteria(options.where),
			this.readOptions(options) as any
		);

		return row ? (this.toRow(row, populated(options)) as T) : null;
	}

	/**
	 * @param options The criteria, in TypeORM's vocabulary.
	 * @returns How many rows match — live rows, or every row when the read states `withDeleted`.
	 */
	async count(options: IWarehouseFindOptions = {}): Promise<number> {
		return await this.em.count(this.entity as any, this.criteria(options.where), {
			...(options.withDeleted ? { filters: { [SOFT_DELETABLE_FILTER]: false } } : {})
		} as any);
	}

	/**
	 * @param criteria The rows to write — an id, or equality criteria.
	 * @param patch The columns to set.
	 * @returns How many rows the statement changed, in TypeORM's shape.
	 */
	async update(
		criteria: string | Record<string, unknown>,
		patch: Record<string, unknown>
	): Promise<{ affected: number }> {
		const meta = this.em.getMetadata().get(this.entity.name);
		const mirrors = relationIdMirrors(meta);
		const columns: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(patch)) {
			if (value !== undefined) {
				columns[mirrors.get(key) ?? key] = value;
			}
		}

		if (meta.properties['updatedAt'] && columns['updatedAt'] === undefined) {
			columns['updatedAt'] = new Date();
		}

		const affected = await this.em.nativeUpdate(
			this.entity as any,
			this.criteria(typeof criteria === 'string' ? { id: criteria } : criteria),
			columns as any,
			{ filters: { [SOFT_DELETABLE_FILTER]: false } } as any
		);

		return { affected };
	}

	/**
	 * @param where Criteria in TypeORM's vocabulary: plain equality, or TypeORM's operators.
	 * @returns The same criteria in MikroORM's, through the platform's own translation.
	 */
	private criteria(where: Record<string, unknown> = {}): any {
		return convertTypeORMWhereToMikroORM(where as any);
	}

	/**
	 * @param options The read, in TypeORM's vocabulary.
	 * @returns MikroORM's options for it.
	 */
	private readOptions(options: IWarehouseFindOptions): Record<string, unknown> {
		const populate = populated(options);

		return {
			disableIdentityMap: true,
			...(options.order ? { orderBy: parseOrderOptions(options.order as any) } : {}),
			...(populate.length ? { populate } : {}),
			...(options.withDeleted ? { filters: { [SOFT_DELETABLE_FILTER]: false } } : {})
		};
	}

	/**
	 * @param entity A row MikroORM read.
	 * @param populate The relations the read asked for.
	 * @returns The row in TypeORM's shape: its columns, its relation ids, and the relations asked for.
	 */
	private toRow(entity: object, populate: readonly string[]): Record<string, unknown> {
		const meta = this.em.getMetadata().find(entity.constructor.name);
		const record = entity as Record<string, any>;

		if (!meta) {
			return { ...record };
		}

		const row: Record<string, unknown> = {};

		for (const prop of meta.props) {
			if (prop.kind === ReferenceKind.SCALAR || prop.kind === ReferenceKind.EMBEDDED) {
				if (record[prop.name] !== undefined) {
					row[prop.name] = record[prop.name];
				}

				continue;
			}

			if (!populate.includes(prop.name)) {
				continue;
			}

			const value = Reference.unwrapReference(record[prop.name]);

			if (value instanceof Collection) {
				row[prop.name] = value.isInitialized() ? value.getItems().map((item) => this.toRow(item, [])) : [];
			} else {
				row[prop.name] = value ? this.toRow(value, []) : null;
			}
		}

		for (const [mirror, relation] of relationIdMirrors(meta)) {
			if (row[mirror] !== undefined) {
				continue;
			}

			const reference = Reference.unwrapReference(record[relation]);

			if (reference === null) {
				row[mirror] = null;
			} else if (reference !== undefined) {
				row[mirror] = wrap(reference, true).getPrimaryKey();
			}
		}

		return row;
	}
}

/**
 * Runs one raw statement through MikroORM's connection, written the way the package writes them for
 * TypeORM: `:name` parameters and identifiers already quoted for the dialect.
 *
 * MikroORM formats `?` parameters itself, on every dialect, before the statement reaches the driver, so
 * each `:name` becomes a `?` bound in the order the names appear — a name used twice is bound twice — and
 * the Postgres numbering TypeORM's driver needs is not wanted here. A `::` cast is left alone, and so is a
 * `:name` no value is supplied for, exactly as the platform's `toPositionalStatement` treats them.
 *
 * @param source A MikroORM repository of this package.
 * @param sql The statement, dialect-quoted, with `:name` parameters.
 * @param parameters The values, keyed by name.
 * @returns The rows a read answered, or what the driver answered for a write.
 */
export async function runMikroOrmStatement(
	source: IMikroOrmEntityManagerSource,
	sql: string,
	parameters: Record<string, unknown>
): Promise<any> {
	const values: unknown[] = [];
	const positional = sql.replace(/(?<!:):(\w+)\b/g, (match: string, name: string) => {
		if (!Object.prototype.hasOwnProperty.call(parameters, name)) {
			return match;
		}

		values.push(parameters[name]);

		return '?';
	});

	return await source
		.getEntityManager()
		.getConnection()
		.execute(positional, values, /^\s*select\b/i.test(positional) ? 'all' : 'run');
}

/**
 * @param options A read, in TypeORM's vocabulary.
 * @returns The relations it asks to be loaded.
 */
function populated(options: IWarehouseFindOptions): string[] {
	return Object.entries(options.relations ?? {})
		.filter(([, wanted]) => wanted)
		.map(([relation]) => relation);
}

/**
 * The relation ids an entity carries, each with the relation that owns its column.
 *
 * A `relationId` scalar is mapped `persist: false` beside a many-to-one (or an owning one-to-one) whose
 * join column is the same column; the pair is recognised by that shared column rather than by name.
 *
 * @param meta The entity's metadata.
 * @returns Mirror property → owning relation property.
 */
function relationIdMirrors(meta: EntityMetadata): Map<string, string> {
	const mirrors = new Map<string, string>();

	for (const prop of meta.props) {
		if (prop.kind !== ReferenceKind.SCALAR || prop.persist !== false || !prop.fieldNames?.length) {
			continue;
		}

		const owner = meta.relations.find(
			(relation) =>
				(relation.kind === ReferenceKind.MANY_TO_ONE ||
					(relation.kind === ReferenceKind.ONE_TO_ONE && relation.owner)) &&
				relation.fieldNames?.[0] === prop.fieldNames[0]
		);

		if (owner) {
			mirrors.set(prop.name, owner.name);
		}
	}

	return mirrors;
}
