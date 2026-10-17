import { randomUUID } from 'node:crypto';
import { EntityManager, ObjectLiteral, Repository } from 'typeorm';
import {
	Collection,
	EntityManager as MikroOrmEntityManager,
	EntityMetadata,
	LockMode,
	Reference,
	ReferenceKind,
	wrap
} from '@mikro-orm/core';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { IOutboxWriteInput } from '@gauzy/contracts';
import { EventOutboxService, MultiORMEnum, convertTypeORMWhereToMikroORM, parseOrderOptions } from '@gauzy/core';

/**
 * How this package reaches its rows under `DB_ORM=mikro-orm`.
 *
 * **Why the package needs it.** Both ORMs are opened whatever `DB_ORM` says, but only the configured
 * one carries this package's columns: `@MultiORMColumn` and the relation decorators apply the active
 * ORM's decorator alone, so under MikroORM the TypeORM entity for `entitlement` has the base entity's
 * columns and nothing else. Every lifecycle write in this package — the grant, putting a right into
 * force, suspending, resuming, extending, reducing, revoking and expiring it, and taking, releasing and
 * revoking a slot or a key — ran through `typeOrm…Repository.manager.transaction(...)`, the row lock's
 * query builder and the transaction manager's `find`, `update` and `save`, so on that ORM every one of
 * them failed on its first statement, or wrote a row with no status, no version and no tenant.
 *
 * **The shape of the answer.** Those transactions are written against a small part of TypeORM's
 * `EntityManager` — `find`, `findOne`, `count`, `update`, `create` and `save`, with plain equality
 * criteria, TypeORM's `Not`, an `order` and `relations` — and every helper they call takes the manager as
 * a parameter. {@link MikroOrmEntitlementManager} answers exactly that part through a MikroORM entity
 * manager, so the **same** transaction bodies run on both ORMs: the state they decide from, the version
 * predicate their writes carry, the row lock and the outbox row are one implementation rather than two
 * that could drift. Under TypeORM nothing here is reached: {@link runEntitlementTransaction} opens the
 * transaction the services always opened, on the manager they always opened it on, and hands the body
 * TypeORM's own manager — so the statements that reach the database are the ones they always were.
 *
 * Three things are not part of TypeORM's manager and are answered beside it: the locking read
 * (`lockEntitlement` asks {@link MikroOrmEntitlementManager.lockOne}), the outbox append, which the
 * platform's own `append` writes through the transaction's MikroORM fork ({@link appendEntitlementEvent}),
 * and the reads made outside any transaction ({@link entitlementRowsOf}).
 */

/** A MikroORM repository, reduced to the one member this module reaches it through. */
export interface IMikroOrmEntityManagerSource {
	getEntityManager(): MikroOrmEntityManager;
}

/** The read options the lifecycle states, in TypeORM's find-options vocabulary. */
export interface IEntitlementFindOptions {
	where?: Record<string, unknown>;
	order?: Record<string, unknown>;
	relations?: Record<string, boolean>;
	take?: number;
}

/**
 * TypeORM's `EntityManager`, as far as this package's transactions use it, answered through MikroORM.
 *
 * Each member reproduces what TypeORM's does, including the parts that are easy to lose on the way
 * across:
 *
 * - **a read is a read of the table, never of an identity map.** Every read runs with the identity map
 *   disabled, so a row read after a native update inside the same transaction is the row as the update
 *   left it — which is what the version predicate, the seat count and the read-back of a transition are
 *   decided from — and nothing read here is merged into, or flushed from, the caller's context;
 * - **a read excludes a retired row and a write does not.** TypeORM's `find`, `findOne` and `count` skip a
 *   soft-deleted row and its `update` reaches one; MikroORM's soft-delete filter applies to all four, so
 *   it is lifted for the update and left in place for the reads;
 * - **a relation id is written through its relation.** `tenantId`, `organizationId`, `customerId`,
 *   `entitlementId`, `entitlementKeyId` and the base entity's user ids are `relationId` columns, which
 *   MikroORM maps `persist: false` beside the relation that owns the column. A write names the relation,
 *   read off the entity's own metadata, so the value lands whatever MikroORM does with the mirror, and the
 *   column is never named twice in one statement;
 * - **what TypeORM fills in, this fills in.** An update moves `updatedAt`, as TypeORM's update-date column
 *   does; an insert states the identifier, the two timestamps and the two base flags, because the id is a
 *   column default on Postgres alone and a native insert runs none of the hooks a flush would.
 *
 * The affected-row count of an update is answered in TypeORM's `{ affected }` shape, which is what the
 * version-predicated write reads to tell a transition that landed from one that lost the race.
 */
export class MikroOrmEntitlementManager {
	constructor(readonly em: MikroOrmEntityManager) {}

	/**
	 * @param entity The entity to read.
	 * @param options The read, in TypeORM's vocabulary.
	 * @returns The rows, as the table holds them.
	 */
	async find<T extends object>(entity: new () => T, options: IEntitlementFindOptions = {}): Promise<T[]> {
		const rows = await this.em.find(entity as any, this.criteria(options.where), {
			...this.readOptions(options),
			...(options.take ? { limit: options.take } : {})
		} as any);

		return rows.map((row) => this.toRow(row, populated(options)) as T);
	}

	/**
	 * @param entity The entity to read.
	 * @param options The read, in TypeORM's vocabulary.
	 * @returns The first row that matches, or null.
	 */
	async findOne<T extends object>(entity: new () => T, options: IEntitlementFindOptions = {}): Promise<T | null> {
		const row = await this.em.findOne(
			entity as any,
			this.criteria(options.where),
			this.readOptions(options) as any
		);

		return row ? (this.toRow(row, populated(options)) as T) : null;
	}

	/**
	 * Reads one row under a write lock, where the dialect has one.
	 *
	 * The lock is taken by the same statement that reads, on Postgres and MySQL; the embedded dialect
	 * serialises its writers, so there the surrounding transaction is the lock and none is requested —
	 * the rule the TypeORM half of `lockEntitlement` applies.
	 *
	 * @param entity The entity to read.
	 * @param where The criteria, in TypeORM's vocabulary.
	 * @param locking Whether the dialect takes a row lock.
	 * @returns The row, or null.
	 */
	async lockOne<T extends object>(
		entity: new () => T,
		where: Record<string, unknown>,
		locking: boolean
	): Promise<T | null> {
		const row = await this.em.findOne(entity as any, this.criteria(where), {
			disableIdentityMap: true,
			...(locking ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {})
		} as any);

		return row ? (this.toRow(row, []) as T) : null;
	}

	/**
	 * @param entity The entity to count.
	 * @param options The criteria, in TypeORM's vocabulary.
	 * @returns How many live rows match.
	 */
	async count<T extends object>(entity: new () => T, options: IEntitlementFindOptions = {}): Promise<number> {
		return await this.em.count(entity as any, this.criteria(options.where));
	}

	/**
	 * Writes a patch onto the rows the criteria select, as TypeORM's `update` does.
	 *
	 * @param entity The entity to write.
	 * @param criteria The rows to write — an id, or equality criteria.
	 * @param patch The columns to set.
	 * @returns How many rows the statement changed, in TypeORM's shape.
	 */
	async update<T extends object>(
		entity: new () => T,
		criteria: string | Record<string, unknown>,
		patch: Record<string, unknown>
	): Promise<{ affected: number }> {
		const meta = this.metadataOf(entity);
		const where = typeof criteria === 'string' ? { id: criteria } : criteria;
		const columns = this.toColumns(meta, patch);

		if (meta.properties['updatedAt'] && columns['updatedAt'] === undefined) {
			columns['updatedAt'] = new Date();
		}

		const affected = await this.em.nativeUpdate(
			entity as any,
			this.criteria(where),
			columns as any,
			{
				filters: { [SOFT_DELETABLE_FILTER]: false }
			} as any
		);

		return { affected };
	}

	/**
	 * Builds a row that has not been written yet, as TypeORM's `create` does.
	 *
	 * @param _entity The entity the row is for.
	 * @param values The row's columns.
	 * @returns The row, unwritten.
	 */
	create<T extends object>(_entity: new () => T, values: Partial<T>): T {
		return { ...(values as object) } as T;
	}

	/**
	 * Inserts a new row and answers it as the table holds it, as TypeORM's `save` does for a new entity.
	 *
	 * Every row this package saves is a new one — a grant, an activation, an issued key — so this is an
	 * insert, and the row is read back so the caller sees the identifier and every column the database
	 * defaulted, exactly as TypeORM's save hands them back.
	 *
	 * @param entity The entity to write.
	 * @param row The row to insert.
	 * @returns The stored row.
	 */
	async save<T extends object>(entity: new () => T, row: Partial<T>): Promise<T> {
		const meta = this.metadataOf(entity);
		const id = (row as Record<string, unknown>)['id'] ?? randomUUID();

		await this.em.insert(entity as any, this.insertable(meta, { ...(row as Record<string, unknown>), id }) as any);

		return (await this.findOne(entity, { where: { id } })) as T;
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
	private readOptions(options: IEntitlementFindOptions): Record<string, unknown> {
		const populate = populated(options);

		return {
			disableIdentityMap: true,
			...(options.order ? { orderBy: parseOrderOptions(options.order as any) } : {}),
			...(populate.length ? { populate } : {})
		};
	}

	/**
	 * Answers a row MikroORM read in the shape TypeORM answers it: the row's columns, its relation ids, and
	 * the relations the read asked for — nothing else.
	 *
	 * A MikroORM entity carries every many-to-one as a reference whether the read asked for it or not, and
	 * serialises through its own metadata. Handed on as it is, a transition's answer would carry a `tenant`,
	 * an `organization` and a `customer` no TypeORM read ever returned, and a field resolver that returns a
	 * relation it finds on the row would return a reference with nothing but its key. So the answer is a
	 * plain object of the columns, each relation id is taken from the column — or, where MikroORM hydrated
	 * only the relation, from the reference's key — and a relation appears only when the read populated it,
	 * a collection as an array, as TypeORM loads one.
	 *
	 * @param entity A row MikroORM read.
	 * @param populate The relations the read asked for.
	 * @returns The row.
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

	/**
	 * @param meta The entity's metadata.
	 * @param values A new row's columns.
	 * @returns The columns MikroORM inserts, with what a flush would have filled in.
	 */
	private insertable(meta: EntityMetadata, values: Record<string, unknown>): Record<string, unknown> {
		const now = new Date();
		const columns = this.toColumns(meta, values);

		for (const [column, value] of [
			['createdAt', now],
			['updatedAt', now],
			['isActive', true],
			['isArchived', false]
		] as const) {
			if (meta.properties[column] && columns[column] === undefined) {
				columns[column] = value;
			}
		}

		return columns;
	}

	/**
	 * Names each relation id by the relation that owns its column, and drops what states no value.
	 *
	 * @param meta The entity's metadata.
	 * @param values Columns as TypeORM would take them.
	 * @returns The same columns as MikroORM writes them.
	 */
	private toColumns(meta: EntityMetadata, values: Record<string, unknown>): Record<string, unknown> {
		const mirrors = relationIdMirrors(meta);
		const columns: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(values)) {
			if (value === undefined) {
				continue;
			}

			columns[mirrors.get(key) ?? key] = value;
		}

		return columns;
	}

	/**
	 * @param entity An entity class.
	 * @returns Its MikroORM metadata.
	 */
	private metadataOf(entity: new () => object): EntityMetadata {
		return this.em.getMetadata().get(entity.name);
	}
}

/**
 * @param options A read, in TypeORM's vocabulary.
 * @returns The relations it asks to be loaded.
 */
function populated(options: IEntitlementFindOptions): string[] {
	return Object.entries(options.relations ?? {})
		.filter(([, wanted]) => wanted)
		.map(([relation]) => relation);
}

/**
 * The relation ids an entity carries, each with the relation that owns its column.
 *
 * A `relationId` scalar is mapped `persist: false` beside a many-to-one (or an owning one-to-one) whose
 * join column is the same column; the pair is recognised by that shared column rather than by name, so
 * a relation id is found however its relation is called.
 *
 * @param meta The entity's metadata.
 * @returns Mirror property → owning relation property.
 */
export function relationIdMirrors(meta: EntityMetadata): Map<string, string> {
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

/**
 * Whether a manager handed to one of this package's transaction bodies is the MikroORM one.
 *
 * @param manager The manager a body was handed.
 * @returns True when it answers through MikroORM.
 */
export function isMikroOrmEntitlementManager(manager: unknown): manager is MikroOrmEntitlementManager {
	return manager instanceof MikroOrmEntitlementManager;
}

/**
 * Runs one lifecycle transaction on the ORM the installation runs.
 *
 * Under TypeORM this is the transaction every lifecycle write always opened — `manager.transaction(work)`
 * on the repository's own manager — and the body is handed TypeORM's transactional manager. Under
 * MikroORM it is `transactional()` on the repository's entity manager, and the body is handed the fork
 * that transaction runs on, wrapped so it answers the same calls: a throw from the body rolls back every
 * statement it issued, the outbox row included.
 *
 * Each ORM's manager is reached only on its own arm, so a TypeORM installation never touches the MikroORM
 * repository and a MikroORM one never touches the TypeORM repository.
 *
 * @param ormType The ORM the installation runs.
 * @param typeOrm The TypeORM manager the transaction is opened on.
 * @param mikroOrm The MikroORM repository whose entity manager the transaction is opened on.
 * @param work The transaction body.
 * @returns What the body answers.
 */
export async function runEntitlementTransaction<R>(
	ormType: string,
	typeOrm: () => EntityManager,
	mikroOrm: () => IMikroOrmEntityManagerSource,
	work: (manager: EntityManager) => Promise<R>
): Promise<R> {
	if (ormType === MultiORMEnum.MikroORM) {
		return await mikroOrm()
			.getEntityManager()
			.transactional(async (em) => await work(new MikroOrmEntitlementManager(em) as unknown as EntityManager));
	}

	return await typeOrm().transaction(work);
}

/**
 * The manager a read outside any transaction goes through under MikroORM.
 *
 * A fork of the repository's entity manager: its own identity map, so the read is a read of the table,
 * and a context of its own, so a caller that runs outside a request — an event consumer, the expiry pass —
 * is not refused the global manager MikroORM keeps for context-free work.
 *
 * @param repository A MikroORM repository of this package.
 * @returns The manager.
 */
export function mikroOrmEntitlementReader(repository: IMikroOrmEntityManagerSource): MikroOrmEntitlementManager {
	return new MikroOrmEntitlementManager(repository.getEntityManager().fork());
}

/**
 * The repository a service reads one of this package's tables through, outside any transaction.
 *
 * Under TypeORM it **is** the TypeORM repository the service always read through, so a read that goes
 * through here is the call it always was, on the object it always was. Under MikroORM it is the same
 * three calls — `find`, `findOne` and `count`, in TypeORM's find-options vocabulary — plus `update`,
 * answered by {@link MikroOrmEntitlementManager} on a fresh fork (see {@link mikroOrmEntitlementReader}),
 * so the tenant and organization predicates a caller states are the ones that reach the table on both.
 *
 * @param ormType The ORM the installation runs.
 * @param entity The table's entity.
 * @param typeOrm The TypeORM repository, reached only under TypeORM.
 * @param mikroOrm A MikroORM repository of this package, reached only under MikroORM.
 * @returns The repository to read through.
 */
export function entitlementRowsOf<T extends ObjectLiteral>(
	ormType: string,
	entity: new () => T,
	typeOrm: () => Repository<T>,
	mikroOrm: () => IMikroOrmEntityManagerSource
): Pick<Repository<T>, 'find' | 'findOne' | 'count' | 'update'> {
	if (ormType !== MultiORMEnum.MikroORM) {
		return typeOrm();
	}

	const reader = () => mikroOrmEntitlementReader(mikroOrm());

	return {
		find: (options: IEntitlementFindOptions = {}) => reader().find(entity, options),
		findOne: (options: IEntitlementFindOptions = {}) => reader().findOne(entity, options),
		count: (options: IEntitlementFindOptions = {}) => reader().count(entity, options),
		update: (criteria: string | Record<string, unknown>, patch: Record<string, unknown>) =>
			reader().update(entity, criteria, patch)
	} as unknown as Pick<Repository<T>, 'find' | 'findOne' | 'count' | 'update'>;
}

/**
 * Appends one event to the platform outbox, in the transaction the manager belongs to.
 *
 * Under TypeORM this is the platform's own `append`, handed the transaction's manager exactly as every
 * lifecycle write always handed it. Under MikroORM the platform's `append` is handed the transaction's own
 * MikroORM fork — the entity manager `transactional()` gave the body — and writes the row through it, so
 * the row commits with the transition it describes and a rollback removes both. The outbox row is the
 * platform's to write on either ORM; this package never states its columns itself.
 *
 * @param outbox The platform outbox.
 * @param manager The transaction's manager.
 * @param input What changed.
 */
export async function appendEntitlementEvent(
	outbox: EventOutboxService,
	manager: EntityManager,
	input: IOutboxWriteInput
): Promise<void> {
	if (isMikroOrmEntitlementManager(manager)) {
		await outbox.append(manager.em as unknown as EntityManager, input);

		return;
	}

	await outbox.append(manager, input);
}
