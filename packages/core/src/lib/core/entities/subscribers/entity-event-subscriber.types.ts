import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { EntityManager as TypeOrmEntityManager } from 'typeorm';

export { MikroOrmEntityManager, TypeOrmEntityManager };

export type MultiOrmEntityManager = MikroOrmEntityManager | TypeOrmEntityManager;

export interface IEntityEventSubscriber<Entity> {
	/**
	 * Optional method to specify the entity class that this subscriber listens to.
	 * It should return either a constructor function (a class) or a string representing the name of the entity.
	 *
	 * @returns {Function | string} The entity class or its name.
	 */
	listenTo?(): Function | string;

	/**
	 * Optional method that is called before an entity is created.
	 * Implement this method to define specific logic to be executed just before the creation of an entity
	 *
	 * @param entity The entity that is about to be created.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 * @returns {Promise<void>}
	 */
	beforeEntityCreate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Optional method that is called before an entity is updated.
	 * Implement this method to define specific logic to be executed just before the update of an entity
	 *
	 * @param entity The entity that is about to be updated.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 * @returns {Promise<void>}
	 */
	beforeEntityUpdate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Optional method that is called after an entity is updated.
	 * Implement this method to define specific logic to be executed just before the update of an entity
	 *
	 * @param entity The entity that is about to be updated.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 * @returns {Promise<void>}
	 */
	afterEntityUpdate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Optional method that is called after an entity is created.
	 * Implement this method to define specific logic to be executed after an entity creation event.
	 *
	 * @param entity The entity that was created.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 * @returns {Promise<void>}
	 */
	afterEntityCreate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Optional method that is called after an entity is loaded.
	 * Implement this method to define specific logic to be executed after an entity loading event.
	 *
	 * @param entity The entity that was loaded.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 * @returns {Promise<void>}
	 */
	afterEntityLoad(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Optional method that is called after an entity is deleted.
	 * Implement this method to define specific logic to be executed after an entity deletion event.
	 *
	 * @param entity The entity that has been deleted.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 * @returns {Promise<void>}
	 */
	afterEntityDelete(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Optional method that is called after an entity is soft removed.
	 * Implement this method to define specific logic to be executed after an entity soft removal event.
	 *
	 * @param entity The entity that has been soft removed.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM, used for further database operations if needed.
	 */
	afterEntitySoftRemove(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;
}
