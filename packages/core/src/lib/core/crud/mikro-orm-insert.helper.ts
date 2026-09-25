import { randomUUID } from 'node:crypto';
import {
	CreateOptions,
	EntityProperty,
	EntityRepository,
	Platform,
	RequiredEntityData,
	UuidType
} from '@mikro-orm/core';
import { PostgreSqlPlatform } from '@mikro-orm/postgresql';

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
function isStated(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
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
	if (typeof (repository as { getEntityManager?: unknown })?.getEntityManager !== 'function') {
		return repository.create(data as RequiredEntityData<T>, options);
	}

	const em = repository.getEntityManager();
	const meta = em.getMetadata(repository.getEntityName());
	const primaryKeys = meta.getPrimaryProps();

	if (primaryKeys.length !== 1) {
		return repository.create(data as RequiredEntityData<T>, options);
	}

	const [primaryKey] = primaryKeys;
	const { [primaryKey.name]: stated, ...graph } = data as Record<string, unknown>;

	const entity = repository.create(graph as RequiredEntityData<T>, options);

	if (isStated(stated)) {
		(entity as Record<string, unknown>)[primaryKey.name] = stated;
	} else if (isUuidKey(primaryKey) && !databaseSuppliesPrimaryKey(em.getPlatform(), primaryKey)) {
		(entity as Record<string, unknown>)[primaryKey.name] = randomUUID();
	}

	return entity;
}
