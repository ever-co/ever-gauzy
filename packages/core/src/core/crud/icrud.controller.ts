import { IPagination } from '@gauzy/contracts';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export interface ICrudController<T> {
	/**
	 * Counts entities that match given options.
	 *
	 * @param options
	 */
	getCount(options: FindOptionsWhere<T>): Promise<number | void>;

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 *
	 * @param filter
	 * @param options
	 */
	pagination(filter: FindManyOptions<T>, ...options: any[]): Promise<IPagination<T>>;

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * but ignores pagination settings (from and take options).
	 * @param options
	 */
	findAll(options: FindManyOptions<T>): Promise<IPagination<T>>;

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - returns null.
	 *
	 * @param id
	 * @param options
	 */
	findById(id: any, ...options: any[]): Promise<T>;

	/**
	 * Creates a new entity instance and copies all entity properties from this object into a new entity.
	 * Saves a given entity in the database.
	 * Note that it copies only properties that are present in entity schema.
	 *
	 * @param entity
	 */
	create(entity: DeepPartial<T>): Promise<T>;

	/**
	 * Updates entity partially. Entity can be found by a given conditions.
	 *
	 * @param id
	 * @param entity
	 * @param options
	 */
	update(id: any, entity: QueryDeepPartialEntity<T>, ...options: any[]): Promise<UpdateResult | T>;

	/**
	 * Deletes entities by a given criteria.
	 * Does not check if entity exist in the database.
	 *
	 * @param id
	 * @param options
	 */
	delete(id: any, ...options: any[]): Promise<DeleteResult>;
}
