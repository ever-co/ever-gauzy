// Modified code from https://github.com/xmlking/ngx-starter-kit.
// Original license: MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Original copyright: Copyright (c) 2018 Sumanth Chinthagunta

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
	DeepPartial,
	DeleteResult,
	FindManyOptions,
	FindOneOptions,
	FindOptionsWhere,
	Repository,
	SaveOptions,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CreateOptions, FilterQuery as MikroFilterQuery, RequiredEntityData, wrap } from '@mikro-orm/core';
import { AssignOptions } from '@mikro-orm/knex';
import { IPagination } from '@gauzy/contracts';
import { BaseEntity } from '../entities/internal';
import { multiORMCreateQueryBuilder } from '../../core/orm/query-builder/query-builder.factory';
import { IQueryBuilder } from '../../core/orm/query-builder/iquery-builder';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import {
	MultiORM,
	MultiORMEnum,
	concatIdToWhere,
	getORMType,
	parseTypeORMFindToMikroOrm
} from './../../core/utils';
import { parseTypeORMFindCountOptions } from './utils';
import {
	ICountByOptions,
	ICountOptions,
	ICrudService,
	IFindManyOptions,
	IFindOneOptions,
	IFindWhereOptions,
	IPartialEntity,
	IUpdateCriteria
} from './icrud.service';
import { ITryRequest } from './try-request';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

export abstract class CrudService<T extends BaseEntity> implements ICrudService<T> {

	constructor(
		protected readonly typeOrmRepository: Repository<T>,
		protected readonly mikroOrmRepository: MikroOrmBaseEntityRepository<T>
	) { }

	/**
	 * Get the table name from the repository metadata.
	 * @returns {string} The table name.
	 */
	public get tableName(): string {
		return this.typeOrmRepository.metadata.tableName;
	}

	/**
	 * Get the ORM type.
	 * @returns {MultiORM} The ORM type.
	 */
	public get ormType(): MultiORM {
		return ormType;
	}

	/**
	 * Creates an ORM-specific query builder for the repository, supporting MikroORM and TypeORM.
	 *
	 * @param alias - Optional alias for the primary table in the query.
	 * @returns An `IQueryBuilder<T>` instance suitable for the repository's ORM type.
	 * @throws Error if the ORM type is not implemented.
	 */
	public createQueryBuilder(alias?: string): IQueryBuilder<T> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return multiORMCreateQueryBuilder<T>(this.mikroOrmRepository as any, this.ormType as MultiORMEnum, alias);

			case MultiORMEnum.TypeORM:
				return multiORMCreateQueryBuilder<T>(this.typeOrmRepository, this.ormType as MultiORMEnum, alias);

			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Count the number of entities based on the provided options.
	 *
	 * @param options - Options for counting entities.
	 * @returns A Promise that resolves to the count of entities.
	 */
	public async count(options?: ICountOptions<T>): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				return await this.mikroOrmRepository.count(where, mikroOptions);
			case MultiORMEnum.TypeORM:
				const typeormOptions = parseTypeORMFindCountOptions<T>(options as FindManyOptions);
				return await this.typeOrmRepository.count(typeormOptions as FindManyOptions);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async countBy(options?: ICountByOptions<T>): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: options } as FindManyOptions);
				return await this.mikroOrmRepository.count(where, mikroOptions);
			case MultiORMEnum.TypeORM:
				const typeormOptions = parseTypeORMFindCountOptions<T>({ where: options } as FindManyOptions);
				return await this.typeOrmRepository.count(typeormOptions as FindManyOptions);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * but ignores pagination settings (from and take options).
	 *
	 * @param options
	 * @returns
	 */
	public async findAll(options?: IFindManyOptions<T>): Promise<IPagination<T>> {
		let total: number;
		let items: T[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				[items, total] = await this.mikroOrmRepository.findAndCount(where, mikroOptions) as any;
				items = items.map((entity: T) => this.serialize(entity)) as T[];
				break;
			case MultiORMEnum.TypeORM:
				[items, total] = await this.typeOrmRepository.findAndCount(options as FindManyOptions<T>);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		return { items, total };
	}

	/**
	 * Finds entities that match given find options.
	 *
	 * @param options
	 * @returns
	 */
	public async find(options?: IFindManyOptions<T>): Promise<T[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				const items = await this.mikroOrmRepository.find(where, mikroOptions);
				return items.map((entity: T) => this.serialize(entity)) as T[];
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.find(options as FindManyOptions<T>);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * But includes pagination settings
	 *
	 * @param options
	 * @returns
	 */
	public async paginate(options?: FindManyOptions<T>): Promise<IPagination<T>> {
		try {
			let total: number;
			let items: T[];

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					[items, total] = await this.mikroOrmRepository.findAndCount(where, mikroOptions) as any;
					items = items.map((entity) => this.serialize(entity)) as T[];
					break;
				case MultiORMEnum.TypeORM:
					[items, total] = await this.typeOrmRepository.findAndCount({
						skip: options && options.skip ? options.take * (options.skip - 1) : 0,
						take: options && options.take ? options.take : 10,
						/**
						 * Specifies what relations should be loaded.
						 *
						 * @deprecated
						 */
						...(options && options.join ? { join: options.join } : {}),
						...(options && options.select ? { select: options.select } : {}),
						...(options && options.relations ? { relations: options.relations } : {}),
						...(options && options.where ? { where: options.where } : {}),
						...(options && options.order ? { order: options.order } : {})
					});
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			return { items, total };
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| @FindOneOrFail
	|--------------------------------------------------------------------------
	*/

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByIdString(id: string, options?: IFindOneOptions<T>): Promise<ITryRequest<T>> {
		try {
			let record: T;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					record = await this.mikroOrmRepository.findOneOrFail(concatIdToWhere(id, where), mikroOptions) as any;
					break;
				case MultiORMEnum.TypeORM:
					options = options as FindOneOptions<T>;
					record = await this.typeOrmRepository.findOneOrFail({
						where: {
							id,
							...(options && options.where ? options.where : {})
						},
						...(options && options.select ? { select: options.select } : {}),
						...(options && options.relations ? { relations: options.relations } : []),
						...(options && options.order ? { order: options.order } : {})
					} as FindOneOptions<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record: this.serialize(record)
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByOptions(options: IFindOneOptions<T>): Promise<ITryRequest<T>> {
		try {
			let record: T;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					record = await this.mikroOrmRepository.findOneOrFail(where, mikroOptions) as any;
					break;
				case MultiORMEnum.TypeORM:
					record = await this.typeOrmRepository.findOneOrFail(options as FindOneOptions<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record: this.serialize(record)
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	/**
	 * Finds first entity that matches given where condition.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByWhereOptions(options: IFindWhereOptions<T>): Promise<ITryRequest<T>> {
		try {
			let record: T;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
					record = await this.mikroOrmRepository.findOneOrFail(where, mikroOptions) as any;
					break;
				case MultiORMEnum.TypeORM:
					record = await this.typeOrmRepository.findOneByOrFail(options as FindOptionsWhere<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record: this.serialize(record)
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	/*
	|--------------------------------------------------------------------------
	| @FindOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - returns null.
	 *
	 * @param id {string}
	 * @param options
	 * @returns
	 */
	public async findOneByIdString(id: T['id'], options?: IFindOneOptions<T>): Promise<T> {
		let record: T;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				record = await this.mikroOrmRepository.findOne(concatIdToWhere<T>(id, where), mikroOptions) as any;
				break;
			case MultiORMEnum.TypeORM:
				options = options as FindOneOptions<T>;
				record = await this.typeOrmRepository.findOne({
					where: {
						id,
						...(options && options.where ? options.where : {})
					},
					...(options && options.select ? { select: options.select } : {}),
					...(options && options.relations ? { relations: options.relations } : []),
					...(options && options.order ? { order: options.order } : {}),
					...(options && options.withDeleted ? { withDeleted: options.withDeleted } : {}),
				} as FindOneOptions<T>);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}

		return this.serialize(record);
	}

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByOptions(options: IFindOneOptions<T>): Promise<T | null> {
		let record: T;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>(options as FindManyOptions);
				record = await this.mikroOrmRepository.findOne(where, mikroOptions) as any;
				break;
			case MultiORMEnum.TypeORM:
				record = await this.typeOrmRepository.findOne(options as FindOneOptions<T>);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}

		return this.serialize(record);
	}

	/**
	 * Finds first entity that matches given where condition.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByWhereOptions(options: IFindWhereOptions<T>): Promise<T | null> {
		let record: T;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: options } as FindManyOptions);
				record = await this.mikroOrmRepository.findOne(where, mikroOptions) as any;
				break;
			case MultiORMEnum.TypeORM:
				record = await this.typeOrmRepository.findOneBy(options as FindOptionsWhere<T>);
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		return this.serialize(record);
	}

	/**
	 * Creates a new entity or updates an existing one based on the provided entity data.
	 *
	 * @param entity The partial entity data for creation or update.
	 * @param createOptions Options for the creation of the entity in MikroORM.
	 * @param upsertOptions Options for the upsert operation in MikroORM.
	 * @returns The created or updated entity.
	 */
	public async create(
		partialEntity: IPartialEntity<T>,
		createOptions: CreateOptions<boolean> = {
			/** This option disables the strict typing which requires all mandatory properties to have value, it has no effect on runtime */
			partial: true,
			/** Creates a managed entity instance instead, bypassing the constructor call */
			managed: true
		},
		assignOptions: AssignOptions<boolean> = {
			updateNestedEntities: false,
			onlyOwnProperties: true
		}
	): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					try {
						if (partialEntity['id']) {
							// Try to load the existing entity
							const entity = await this.mikroOrmRepository.findOne(partialEntity['id']);
							if (entity) {
								// If the entity has an ID, perform an upsert operation
								this.mikroOrmRepository.assign(entity, partialEntity as any, assignOptions);
								await this.mikroOrmRepository.flush();

								return this.serialize(entity);
							}
						}
						// If the entity doesn't have an ID, it's new and should be persisted
						// Create a new entity using MikroORM
						const newEntity = this.mikroOrmRepository.create(partialEntity as RequiredEntityData<T>, createOptions);

						// Persist new entity and flush
						await this.mikroOrmRepository.persistAndFlush(newEntity); // This will also persist the relations
						return this.serialize(newEntity);
					} catch (error) {
						console.error('Error during mikro orm create crud transaction:', error);
					}
				case MultiORMEnum.TypeORM:
					const newEntity = this.typeOrmRepository.create(partialEntity as DeepPartial<T>);
					return await this.typeOrmRepository.save(newEntity);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error('Error in crud service create method:', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Saves a given entity in the database.
	 * If entity does not exist in the database then inserts, otherwise updates.
	 *
	 * @param entity
	 * @returns
	 */
	public async save(entity: IPartialEntity<T>): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					return await this.mikroOrmRepository.upsert(entity as T);
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.save(entity as DeepPartial<T>);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error('Error in crud service save method:', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Updates entity partially. Entity can be found by a given conditions.
	 * Unlike save method executes a primitive operation without cascades, relations and other operations included.
	 * Executes fast and efficient UPDATE query.
	 * Does not check if entity exist in the database.
	 *
	 * @param id
	 * @param partialEntity
	 * @returns
	 */
	public async update(id: IUpdateCriteria<T>, partialEntity: QueryDeepPartialEntity<T>): Promise<UpdateResult | T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					let where: MikroFilterQuery<T>;
					if (typeof id === 'string') {
						where = { id } as any;
					} else {
						where = id as MikroFilterQuery<T>;
					}
					const row = partialEntity as RequiredEntityData<T>;
					const updatedRow = await this.mikroOrmRepository.nativeUpdate(where, row as T);
					return { affected: updatedRow } as UpdateResult;
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.update(
						id as string | number | FindOptionsWhere<T>,
						partialEntity as QueryDeepPartialEntity<T>
					);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Deletes a record based on the given criteria.
	 * Criteria can be an ID (string or number) or a complex object with conditions.
	 * Supports multiple ORM types, and throws if the ORM type is unsupported.
	 *
	 * @param criteria - Identifier or condition to delete specific record(s).
	 * @returns {Promise<DeleteResult>} - Result indicating the number of affected records.
	 */
	public async delete(
		criteria: string | number | FindOptionsWhere<T>
	): Promise<DeleteResult> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Determine the appropriate filter for MikroORM based on the criteria type
					let filter: MikroFilterQuery<T>;
					if (typeof criteria === 'object') {
						filter = criteria as MikroFilterQuery<T>;
					} else {
						filter = { id: criteria } as MikroFilterQuery<T>;
					}

					// Convert the filter to MikroORM-specific where and options
					let { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: filter } as FindManyOptions);

					// Execute delete operation with MikroORM
					const affected = await this.mikroOrmRepository.nativeDelete(where, mikroOptions);
					return { affected } as DeleteResult;
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.delete(criteria);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The record was not found`, error);
		}
	}

	/**
	 * Softly deletes entities by a given criteria.
	 * This method sets a flag or timestamp indicating the entity is considered deleted.
	 * It does not actually remove the entity from the database, allowing for recovery or audit purposes.
	 *
	 * @param criteria - Entity ID or condition to identify which entities to soft-delete.
	 * @param options - Additional options for the operation.
	 * @returns {Promise<UpdateResult | DeleteResult>} - Result indicating success or failure.
	 */
	public async softDelete(
		criteria: string | number | FindOptionsWhere<T>
	): Promise<UpdateResult | T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Determine the appropriate filter for MikroORM based on the criteria type
					let filter: MikroFilterQuery<T>;
					if (typeof criteria === 'object') {
						filter = criteria as MikroFilterQuery<T>;
					} else {
						filter = { id: criteria } as MikroFilterQuery<T>;
					}

					// Convert the filter to MikroORM-specific where and options
					let { where, mikroOptions } = parseTypeORMFindToMikroOrm<T>({ where: filter } as FindManyOptions);

					// Find the entity and perform soft delete
					const entity = await this.mikroOrmRepository.findOne(where, mikroOptions) as any;

					// Use "em.remove" for MikroORM with a transactional approach to ensure changes are persisted properly
					this.mikroOrmRepository.remove(entity);
					await this.mikroOrmRepository.flush();

					// Return the serialized version of the soft-deleted entity
					return this.serialize(entity);
				case MultiORMEnum.TypeORM:
					// Perform soft delete using TypeORM
					return await this.typeOrmRepository.softDelete(criteria);
				default:
					throw new Error(`Soft delete not implemented for ORM type: ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The record was not found or could not be soft-deleted`, error);
		}
	}

	/**
	 * Softly removes an entity from the database.
	 *
	 * This method handles soft removal of a given entity using different ORM strategies, based on the configured ORM type.
	 * For MikroORM, it uses the `remove` method followed by a `flush` to persist changes.
	 * For TypeORM, it utilizes the `softRemove` method to perform a soft deletion.
	 * If the ORM type is not supported, an error is thrown.
	 *
	 * @param entity - The entity to be softly removed.
	 * @param options - Optional parameters for the removal operation (applicable to TypeORM).
	 * @returns A promise that resolves to the removed entity.
	 * @throws NotFoundException if any error occurs during the soft removal process.
	 */
	public async softRemove(entity: T, options?: SaveOptions): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					// Use "em.remove" for MikroORM with a transactional approach to ensure changes are persisted properly
					this.mikroOrmRepository.remove(entity);
					await this.mikroOrmRepository.flush();
					// Return the serialized version of the soft-deleted entity
					return this.serialize(entity);
				}
				case MultiORMEnum.TypeORM: {
					// TypeORM soft removes entities via its repository
					return await this.typeOrmRepository.softRemove<T>(entity, options);
				}
				default:
					throw new Error(`Unsupported database type: ${this.ormType}`);
			}
		} catch (error) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`An error occurred during soft removal: ${error.message}`, error);
		}
	}

	/**
	 * Soft-recover a previously soft-deleted entity.
	 *
	 * Depending on the ORM, this method restores a soft-deleted entity by resetting its deletion indicator.
	 *
	 * @param entity - The soft-deleted entity to recover.
	 * @param options - Optional settings for database save operations.
	 * @returns A promise that resolves with the recovered entity.
	 */
	public async softRecover(entity: T, options?: SaveOptions): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					// Reset the soft-deleted flag and persist changes
					entity['deletedAt'] = null;
					await this.mikroOrmRepository.persistAndFlush(entity);

					// Return the restored entity, serialized if needed
					return this.serialize(entity);
				}
				case MultiORMEnum.TypeORM: {
					// Use TypeORM's recover method to restore the entity
					return await this.typeOrmRepository.recover(entity, options);
				}
				default:
					throw new Error(`Unsupported database type: ${this.ormType}`);
			}
		} catch (error) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`An error occurred during restoring entity: ${error.message}`);
		}
	}

	/**
	 * Serializes the provided entity based on the ORM type.
	 * @param entity The entity to be serialized.
	 * @returns The serialized entity.
	 */
	protected serialize(entity: T): T {
		if (this.ormType === MultiORMEnum.MikroORM) {
			// If using MikroORM, use wrap(entity).toJSON() for serialization
			return wrap(entity).toJSON() as T;
		}
		// If using other ORM types, return the entity as is
		return entity;
	}
}
