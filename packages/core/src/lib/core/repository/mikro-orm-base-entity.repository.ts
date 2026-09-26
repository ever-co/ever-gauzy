import { Inject, Injectable, Optional } from '@nestjs/common';
import { EntityName, MetadataStorage } from '@mikro-orm/core';
import { EntityManager, EntityRepository, AnyEntity } from '@mikro-orm/knex';

/**
 * The token of a constructor argument no provider supplies: an entity name is never injected, it is passed by
 * MikroORM (`em.getRepository(Entity)`) or resolved from the repository class (see below).
 */
export const MIKRO_ORM_REPOSITORY_ENTITY_NAME = Symbol('MIKRO_ORM_REPOSITORY_ENTITY_NAME');

/**
 * Resolves the entity a repository class serves, from MikroORM's decorator metadata: the entity whose
 * `@MultiORMEntity(..., { mikroOrmRepository: () => Repository })` names it, or else the entity the
 * `MikroOrm<Entity>Repository` naming convention names.
 *
 * @param repository The repository class.
 * @returns The entity class.
 * @throws If neither finds an entity, naming the repository — a clearer failure than MikroORM's own.
 */
export function resolveMikroOrmRepositoryEntity<T extends object>(repository: Function): EntityName<T> {
	const metadata = Object.values(MetadataStorage.getMetadata());

	const linked = metadata.find((meta) => {
		try {
			return typeof meta.repository === 'function' && meta.repository() === repository;
		} catch {
			return false;
		}
	});
	if (linked?.class) return linked.class as EntityName<T>;

	const conventional = /^MikroOrm(\w+)Repository$/.exec(repository.name)?.[1];
	const named = conventional ? metadata.find((meta) => meta.className === conventional && meta.class) : undefined;
	if (named?.class) return named.class as EntityName<T>;

	throw new Error(
		`${repository.name} serves no MikroORM entity: link it with \`@MultiORMEntity(..., { mikroOrmRepository: () => ${repository.name} })\`, or name it MikroOrm<Entity>Repository.`
	);
}

/**
 * The base of every MikroORM repository on the platform.
 *
 * **It can be constructed by Nest.** Every module lists its `MikroOrm*Repository` classes in `providers` beside
 * `MikroOrmModule.forFeature([...])`, and a module's own provider wins over the one `forFeature` registers
 * (`em.getRepository(Entity)`). Nest therefore built each repository itself, and with no injectable constructor
 * it called `new Repository()`: `em` and `entityName` were `undefined`, and under `DB_ORM=mikro-orm` the first
 * call on any of them failed — `Cannot read properties of undefined (reading 'findOne')` from
 * `EmployeeService.findOneByWhereOptions`, `(reading 'transactional')` from the login's writes — so nobody
 * could sign in. Only `MikroOrmUserRepository`, which declares `constructor(em: EntityManager)`, worked.
 *
 * Nest now injects the application's `EntityManager` (the global one, which forks per request through
 * MikroORM's request context, as `MikroOrmUserRepository`'s always has), and the entity is resolved from the
 * repository class on first use. MikroORM's own `em.getRepository(Entity)` passes both, as before. Both
 * arguments are optional, so a module without MikroORM (a unit test's) still constructs the class as it did.
 * Under `DB_ORM=typeorm` nothing reads these repositories.
 */
@Injectable()
export class MikroOrmBaseEntityRepository<T extends object> extends EntityRepository<T> {
	constructor(
		@Optional() em?: EntityManager,
		@Optional() @Inject(MIKRO_ORM_REPOSITORY_ENTITY_NAME) entityName?: EntityName<T>
	) {
		super(em, entityName);

		if (!entityName) {
			// Resolved on first read and then kept: the entity decorators may not all have run when Nest
			// constructs the repository.
			Object.defineProperty(this, 'entityName', {
				configurable: true,
				enumerable: true,
				get: () => {
					const resolved = resolveMikroOrmRepositoryEntity<T>(this.constructor);
					Object.defineProperty(this, 'entityName', { value: resolved, enumerable: true });
					return resolved;
				}
			});
		}
	}

	/**
	 * Persists the given entity or array of entities in the database.
	 * This method schedules the entities for insertion into the database but does not execute
	 * the database operation immediately. It returns the EntityManager instance for further chaining.
	 *
	 * @param entity - The entity or array of entities to persist.
	 * @returns The EntityManager instance.
	 */
	persist(entity: AnyEntity | AnyEntity[]): EntityManager {
		return this.em.persist(entity);
	}

	/**
	 * Persists the given entity or array of entities in the database and immediately
	 * executes the database operation to insert them. This method is asynchronous.
	 *
	 * @param entity - The entity or array of entities to persist and flush.
	 */
	async persistAndFlush(entity: AnyEntity | AnyEntity[]): Promise<void> {
		await this.em.persist(entity).flush();
	}

	/**
	 * Schedules the given entity for removal from the database.
	 * Similar to 'persist', this method does not immediately execute the removal operation.
	 * It returns the EntityManager instance for further operations or chaining.
	 *
	 * @param entity - The entity to remove.
	 * @returns The EntityManager instance.
	 */
	remove(entity: AnyEntity): EntityManager {
		return this.em.remove(entity);
	}

	/**
	 * Schedules the given entity for removal and immediately executes the database operation
	 * to remove it. This method is asynchronous, ensuring the entity is removed
	 * from the database once the promise resolves.
	 *
	 * @param entity - The entity to remove and flush.
	 */
	async removeAndFlush(entity: AnyEntity): Promise<void> {
		await this.em.remove(entity).flush();
	}

	/**
	 * Executes all scheduled database operations like insertions, updates, and deletions
	 * that are queued in the EntityManager. This method is asynchronous and ensures
	 * that all changes are persisted in the database once the promise resolves.
	 */
	async flush(): Promise<void> {
		return this.em.flush();
	}
}
