import { randomUUID } from 'node:crypto';
import {
	Collection,
	CreateOptions,
	EntityProperty,
	EntityRepository,
	Platform,
	ReferenceKind,
	RequiredEntityData,
	Utils,
	UuidType
} from '@mikro-orm/core';
import { PostgreSqlPlatform } from '@mikro-orm/postgresql';
import { stateRelationsFromMirrors } from './mikro-orm-scope-column.helper';

/**
 * Whether the database fills in a new row's primary key when the INSERT leaves it out.
 *
 * `BaseEntity.id` is mapped for MikroORM with `defaultRaw: 'gen_random_uuid()'`, so MikroORM leaves the
 * column out of the INSERT and expects the database to supply it. Only PostgreSQL has that function, and only
 * there do the platform's migrations give the column that default — which is also exactly where TypeORM's
 * `@PrimaryGeneratedColumn('uuid')` defers to the database and nowhere else: on MySQL and on SQLite TypeORM
 * generates the uuid itself. On those dialects the INSERT MikroORM sends is refused (`NOT NULL constraint
 * failed: <table>.id` on SQLite, "Field 'id' doesn't have a default value" on MySQL).
 *
 * @param platform The platform MikroORM is connected through.
 * @param primaryKey The entity's single primary-key property.
 * @returns True only when the dialect evaluates the default the mapping declares.
 */
export function databaseSuppliesPrimaryKey(platform: Platform, primaryKey: EntityProperty): boolean {
	return !!primaryKey.defaultRaw && platform instanceof PostgreSqlPlatform;
}

/**
 * Whether a primary key holds a uuid, which is the only kind this module generates client-side. An integer or
 * other key without a value is left to the database, as before.
 *
 * @param primaryKey The entity's single primary-key property.
 */
function isUuidKey(primaryKey: EntityProperty): boolean {
	return primaryKey.customType instanceof UuidType || String(primaryKey.type ?? '').toLowerCase() === 'uuid';
}

/**
 * Whether a stated primary-key value is a value at all. `create()` has always treated an empty id as "no id"
 * when deciding between its update and insert paths, so the insert path reads it the same way.
 *
 * @param value The value the payload carried.
 */
export function isStated(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

/**
 * Whether a repository is a MikroORM repository whose mapping can be read, rather than a stand-in (the scripted
 * doubles unit tests hand the services), which is used as it is.
 *
 * @param repository The repository the service was given.
 */
export function isMikroOrmRepository(repository: unknown): boolean {
	const candidate = repository as { getEntityManager?: unknown; getEntityName?: unknown } | undefined;
	return typeof candidate?.getEntityManager === 'function' && typeof candidate.getEntityName === 'function';
}

/**
 * Builds the entity MikroORM will INSERT for a new row: the payload's graph created the way `CrudService` has
 * always created it, and a primary key MikroORM will actually write.
 *
 * **Why the primary key is left out of `create()` and stated afterwards.** `CrudService` creates entities with
 * `{ managed: true }`, and has to: a managed create resolves every nested `{ id }` in the payload — the
 * `tenant: { id }` the tenant-aware base stamps, an `organization: { id }` from a request body — as a
 * reference to the existing row. An unmanaged create (`managed: false`) builds those nested objects as NEW
 * entities instead, and the flush then tries to INSERT the caller's tenant again. But a managed create of a
 * payload that carries its own primary key registers the entity as already loaded from the database, so the
 * flush computes no change set for it and nothing is inserted at all: the call answered with the entity it
 * was given and the row never existed. MikroORM treats an entity it was handed without a primary key as new,
 * so the key is set after the graph is built, and the INSERT carries it.
 *
 * **Where the key comes from.** A key the payload stated is kept. Without one, the database supplies it where
 * it can ({@link databaseSuppliesPrimaryKey}); elsewhere a uuid is generated here, as TypeORM generates one
 * for the same column on the same dialects.
 *
 * An entity whose key is composite, or that has none, is created exactly as before; so is one handed a
 * stand-in that is not a MikroORM repository (the scripted doubles unit tests use), which has no mapping
 * to read. Every repository the platform injects is a MikroORM repository.
 *
 * @param repository The MikroORM repository of the entity.
 * @param data The payload the new row is built from.
 * @param options The options `create()` is called with.
 * @returns The new entity, not yet flushed.
 */
export function createNewMikroOrmEntity<T extends object>(
	repository: EntityRepository<T>,
	data: object,
	options: CreateOptions<boolean>
): T {
	if (!isMikroOrmRepository(repository)) {
		return repository.create(data as RequiredEntityData<T>, options);
	}

	const em = repository.getEntityManager();
	const meta = em.getMetadata(repository.getEntityName());
	const primaryKeys = meta.getPrimaryProps();

	// A foreign key stated only by its relation-id mirror (`{ userId }`) is written by the relation beside it,
	// which `em.create()` would otherwise leave unset (see `stateRelationsFromMirrors`).
	data = stateRelationsFromMirrors(meta, data);

	if (primaryKeys.length !== 1) {
		return repository.create(data as RequiredEntityData<T>, options);
	}

	const [primaryKey] = primaryKeys;
	const { [primaryKey.name]: stated, ...graph } = data as Record<string, unknown>;

	// An embedded object the payload leaves out is created empty. TypeORM writes an absent embedded object as NULL in
	// each of its columns; MikroORM refuses the row instead ("Value for OrganizationProject.customFields is
	// required"), so a tag, an employee or a project created without `customFields` — which callers never state —
	// failed under DB_ORM=mikro-orm. An empty embeddable writes the same NULLs.
	for (const property of meta.props) {
		if (
			property.kind === ReferenceKind.EMBEDDED &&
			!property.nullable &&
			!property.array &&
			!property.embedded &&
			graph[property.name] === undefined
		) {
			graph[property.name] = {};
		}
	}

	// To-many relations are set after the entity exists. A managed create leaves a collection uninitialised — as
	// if it were a stored row's, not yet loaded — so the rows the payload names were silently not linked (a
	// product's tags: no pivot row written), or the create failed with `Collection<Tag> … not initialized`.
	const collections = meta.relations.filter(
		(relation) =>
			(relation.kind === ReferenceKind.MANY_TO_MANY || relation.kind === ReferenceKind.ONE_TO_MANY) &&
			graph[relation.name] !== undefined
	);
	const toMany: Record<string, unknown> = {};
	for (const relation of collections) {
		// An item that states its key is a reference to the stored row, as a nested `{ id }` is for a to-one
		// relation under the managed create; `assign()` would insert it as a new row instead.
		const target = em.getMetadata().find(relation.type);
		const targetKey = target?.primaryKeys?.length === 1 ? target.primaryKeys[0] : undefined;
		const value = graph[relation.name];
		toMany[relation.name] =
			Array.isArray(value) && target && targetKey
				? value.map((item) =>
						item && typeof item === 'object' && !Utils.isEntity(item) && isStated((item as any)[targetKey])
							? em.getReference(target.class, (item as any)[targetKey])
							: item
					)
				: value;
		delete graph[relation.name];
	}

	const entity = repository.create(graph as RequiredEntityData<T>, options);

	if (isStated(stated)) {
		(entity as Record<string, unknown>)[primaryKey.name] = stated;
	} else if (isUuidKey(primaryKey) && !databaseSuppliesPrimaryKey(em.getPlatform(), primaryKey)) {
		(entity as Record<string, unknown>)[primaryKey.name] = randomUUID();
	}

	if (collections.length) {
		// A new row's collections hold nothing yet: say so, then link what the payload names.
		for (const relation of collections) {
			(entity as Record<string, Collection<object>>)[relation.name]?.hydrate([], true);
		}
		em.assign(entity, toMany as never);
	}

	return entity;
}

/**
 * The payload MikroORM's `upsert` is handed by `save()`, with the primary key a new row needs.
 *
 * TypeORM's `save()` of an object without a primary key inserts it with a generated uuid. MikroORM's `upsert`
 * sends the row without one — `insert into feature_organization (featureId, …) … on conflict (id) do update` —
 * which PostgreSQL fills from the `gen_random_uuid()` default and SQLite and MySQL refuse
 * (`NOT NULL constraint failed: feature_organization.id`): every organization feature toggle under MikroORM, among
 * others. Without a key there is nothing for the upsert to conflict on, so the row is new: the key is generated
 * here exactly where {@link createNewMikroOrmEntity} generates one. A payload that states its key, an entity
 * instance, a composite or non-uuid key, and a stand-in that is not a MikroORM repository are passed on as they are.
 *
 * @param repository The MikroORM repository of the entity.
 * @param data The payload.
 * @returns The payload, with a generated primary key when it is a new row on a dialect without a default.
 */
export function withPrimaryKeyForUpsert<T extends object, D>(repository: EntityRepository<T>, data: D): D {
	if (!data || typeof data !== 'object' || Utils.isEntity(data) || !isMikroOrmRepository(repository)) {
		return data;
	}

	const em = repository.getEntityManager();
	const primaryKeys = em.getMetadata(repository.getEntityName()).getPrimaryProps();
	if (primaryKeys.length !== 1) {
		return data;
	}

	const [primaryKey] = primaryKeys;
	if (
		isStated((data as Record<string, unknown>)[primaryKey.name]) ||
		!isUuidKey(primaryKey) ||
		databaseSuppliesPrimaryKey(em.getPlatform(), primaryKey)
	) {
		return data;
	}

	return { ...(data as object), [primaryKey.name]: randomUUID() } as D;
}

/**
 * A payload spread from an entity (`{ ...entity }`, which the tenant-aware `save()` does to every payload) carries
 * its to-many relations as MikroORM `Collection` objects, which `assign()` and `em.create()` do not take as
 * values. An initialised collection becomes the array of its items, which both take; one never loaded is left
 * out, since it states nothing about the rows it would hold.
 *
 * @param data The payload.
 * @returns The payload with collections as arrays, or the payload itself when it holds none.
 */
export function withCollectionsAsItems<D extends Record<string, unknown>>(data: D): D {
	let converted: Record<string, unknown> | undefined;

	for (const [key, value] of Object.entries(data)) {
		if (!Utils.isCollection(value)) {
			continue;
		}

		converted ??= { ...data };
		if (value.isInitialized()) {
			converted[key] = value.getItems(false);
		} else {
			delete converted[key];
		}
	}

	return (converted ?? data) as D;
}
