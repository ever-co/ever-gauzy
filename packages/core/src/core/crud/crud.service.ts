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
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	CreateOptions,
	EntityRepository,
	FilterQuery as MikroFilterQuery,
	RequiredEntityData,
	UpsertOptions,
	wrap
} from '@mikro-orm/core';
import { IPagination } from '@gauzy/contracts';
import { BaseEntity } from '../entities/internal';
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
import { multiORMCreateQueryBuilder } from 'core/orm/query-builder/query-builder.factory';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

export abstract class CrudService<T extends BaseEntity> implements ICrudService<T> {
	constructor(
		protected readonly repository: Repository<T>,
		protected readonly mikroRepository: EntityRepository<T>
	) { }

	/**
	 * Get the table name from the repository metadata.
	 * @returns {string} The table name.
	 */
	protected get tableName(): string {
		return this.repository.metadata.tableName;
	}

	/**
	 * Get the ORM type.
	 * @returns {MultiORM} The ORM type.
	 */
	protected get ormType(): MultiORM {
		return ormType;
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	createQueryBuilder(entity?: any) {
		console.log('this.mikroRepository.getEntityManager', this.mikroRepository.getEntityName());
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return multiORMCreateQueryBuilder<T>(this.repository, this.ormType as MultiORMEnum);
			case MultiORMEnum.TypeORM:
				return multiORMCreateQueryBuilder<T>(this.mikroRepository as any, this.ormType as MultiORMEnum);
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
				return await this.mikroRepository.count(where, mikroOptions);
			case MultiORMEnum.TypeORM:
				const typeormOptions = parseTypeORMFindCountOptions<T>(options as FindManyOptions);
				return await this.repository.count(typeormOptions as FindManyOptions);
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
				return await this.mikroRepository.count(where, mikroOptions);
			case MultiORMEnum.TypeORM:
				const typeormOptions = parseTypeORMFindCountOptions<T>({ where: options } as FindManyOptions);
				return await this.repository.count(typeormOptions as FindManyOptions);
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
				[items, total] = await this.mikroRepository.findAndCount(where, mikroOptions) as any;
				items = items.map((entity: T) => this.serialize(entity)) as T[];
				break;
			case MultiORMEnum.TypeORM:
				[items, total] = await this.repository.findAndCount(options as FindManyOptions<T>);
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
				const items = await this.mikroRepository.find(where, mikroOptions);
				return items.map((entity: T) => this.serialize(entity)) as T[];
			case MultiORMEnum.TypeORM:
				return await this.repository.find(options as FindManyOptions<T>);
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
					[items, total] = await this.mikroRepository.findAndCount(where, mikroOptions) as any;
					items = items.map((entity) => this.serialize(entity)) as T[];
					break;
				case MultiORMEnum.TypeORM:
					[items, total] = await this.repository.findAndCount({
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
					record = await this.mikroRepository.findOneOrFail(concatIdToWhere(id, where), mikroOptions) as any;
					break;
				case MultiORMEnum.TypeORM:
					options = options as FindOneOptions<T>;
					record = await this.repository.findOneOrFail({
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
					record = await this.mikroRepository.findOneOrFail(where, mikroOptions) as any;
					break;
				case MultiORMEnum.TypeORM:
					record = await this.repository.findOneOrFail(options as FindOneOptions<T>);
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
					record = await this.mikroRepository.findOneOrFail(where, mikroOptions) as any;
					break;
				case MultiORMEnum.TypeORM:
					record = await this.repository.findOneByOrFail(options as FindOptionsWhere<T>);
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
				record = await this.mikroRepository.findOne(concatIdToWhere<T>(id, where), mikroOptions) as any;
				break;
			case MultiORMEnum.TypeORM:
				options = options as FindOneOptions<T>;
				record = await this.repository.findOne({
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
				record = await this.mikroRepository.findOne(where, mikroOptions) as any;
				break;
			case MultiORMEnum.TypeORM:
				record = await this.repository.findOne(options as FindOneOptions<T>);
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
				record = await this.mikroRepository.findOne(where, mikroOptions) as any;
				break;
			case MultiORMEnum.TypeORM:
				record = await this.repository.findOneBy(options as FindOptionsWhere<T>);
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
		entity: IPartialEntity<T>,
		createOptions: CreateOptions = {
			/** This option disables the strict typing which requires all mandatory properties to have value, it has no effect on runtime */
			partial: true,
			/** Creates a managed entity instance instead, bypassing the constructor call */
			managed: true
		},
		upsertOptions: UpsertOptions<T> = {
			onConflictFields: ['id'], // specify a manual set of fields pass to the on conflict clause
			onConflictExcludeFields: ['createdAt'],
		}
	): Promise<T> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					// Returns the name of the entity associated with this repository.
					const entityName = this.mikroRepository.getEntityName();

					// Returns the underlying EntityManager instance from the repository.
					const em = this.mikroRepository.getEntityManager();

					// Create a new entity using MikroORM
					const newEntity = em.create(entityName, entity as RequiredEntityData<T>, createOptions);

					// If the entity doesn't have an ID, it's new and should be persisted
					if (!entity['id']) {
						await em.flush();
						return this.serialize(newEntity);
					}

					// If the entity has an ID, perform an upsert operation
					// This block will only be reached if the entity is existing
					const upsertedEntity = await em.upsert(
						entityName,
						newEntity,
						upsertOptions
					);
					return this.serialize(upsertedEntity);
				case MultiORMEnum.TypeORM:
					const obj = this.repository.create(entity as DeepPartial<T>);
					return await this.repository.save(obj);
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
					return await this.mikroRepository.upsert(entity as T);
				case MultiORMEnum.TypeORM:
					return await this.repository.save(entity as DeepPartial<T>);
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
					const updatedRow = await this.mikroRepository.nativeUpdate(where, row as T);
					return { affected: updatedRow } as UpdateResult;
				case MultiORMEnum.TypeORM:
					return await this.repository.update(
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
	 * Deletes entities by a given criteria.
	 * Unlike save method executes a primitive operation without cascades, relations and other operations included.
	 * Executes fast and efficient DELETE query.
	 * Does not check if entity exist in the database.
	 *
	 * @param criteria
	 * @param options
	 * @returns
	 */
	public async delete(criteria: string | number | FindOptionsWhere<T>, ...options: any): Promise<DeleteResult> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					let where: MikroFilterQuery<T>;
					if (typeof criteria === 'string' || typeof criteria === 'number') {
						where = { id: criteria } as any;
					}
					const result = await this.mikroRepository.nativeDelete(where);
					return { affected: result } as DeleteResult;
				case MultiORMEnum.TypeORM:
					return await this.repository.delete(criteria);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The record was not found`, error);
		}
	}

	/**
	 * Serializes the provided entity based on the ORM type.
	 * @param entity The entity to be serialized.
	 * @returns The serialized entity.
	 */
	private serialize(entity: T): T {
		if (this.ormType === MultiORMEnum.MikroORM) {
			// If using MikroORM, use wrap(entity).toJSON() for serialization
			return wrap(entity).toJSON() as T;
		}
		// If using other ORM types, return the entity as is
		return entity;
	}
}
