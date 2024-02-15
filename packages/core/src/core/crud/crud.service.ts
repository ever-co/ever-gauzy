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
	EntityRepository,
	FindOneOptions as MikroFindOneOptions,
	FindOptions as MikroFindOptions,
	FilterQuery as MikroFilterQuery,
	RequiredEntityData,
	DeleteOptions,
	FindOneOrFailOptions,
	FilterQuery
} from '@mikro-orm/core';
import { of as observableOf, throwError } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { IPagination } from '@gauzy/contracts';
import { BaseEntity } from '../entities/internal';
import { MultiORM, MultiORMEnum, flatten, getORMType, praseMikroORMEntityToJson } from './../../core/utils';
import {
	ICountByOptions,
	ICountOptions,
	ICrudService,
	IFindManyOptions,
	IFindOneOptions,
	IFindWhereOptions,
	IMikroOptions,
	IPartialEntity,
	IUpdateCriteria
} from './icrud.service';
import { ITryRequest } from './try-request';

//
const ormType: MultiORM = getORMType();

export abstract class CrudService<T extends BaseEntity> implements ICrudService<T> {
	constructor(
		protected readonly repository: Repository<T>,
		protected readonly mikroRepository?: EntityRepository<T>
	) { }

	/**
	 * Get the table name from the repository metadata.
	 * @returns {string} The table name.
	 */
	protected get tableName(): string {
		return this.repository.metadata.tableName;
	}

	/**
	 * Get the alias for pagination CRUD operations.
	 * By default, it uses the table name.
	 * @returns {string} The alias.
	 */
	protected get alias(): string {
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
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async count(options?: ICountOptions<T>): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroRepository.count(options as MikroFilterQuery<T>);
			case MultiORMEnum.TypeORM:
				return await this.repository.count(options as FindManyOptions<T>);
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
				return await this.mikroRepository.count(options as MikroFilterQuery<T>);
			case MultiORMEnum.TypeORM:
				return await this.repository.countBy(options as FindOptionsWhere<T>);
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
	public async findAll(options?: ICountOptions<T>): Promise<IPagination<T>> {
		let total: number;
		let items: T[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				[items, total] = await this.mikroRepository.findAndCount(
					options?.where as MikroFilterQuery<T>,
					options as MikroFindOptions<T>
				);
				items = praseMikroORMEntityToJson(items);
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
				const items = await this.mikroRepository.find(
					options.where as MikroFilterQuery<T>,
					options as MikroFindOptions<T>
				);

				return praseMikroORMEntityToJson(items);
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
					[items, total] = await this.mikroRepository.findAndCount(
						options?.where as MikroFilterQuery<T>,
						{
							skip: options && options.skip ? options.take * (options.skip - 1) : 0,
							take: options && options.take ? options.take : 10,
							...options
						} as MikroFindOptions<T>
					);

					items = praseMikroORMEntityToJson(items);
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
						...(options && options.join
							? {
								join: options.join
							}
							: {}),
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
					// return await this.mikroRepository.find(options.where as MikroFilterQuery<T>, options as MikroFindOptions<T>);
					options = options as IMikroOptions<T>;

					let where: MikroFilterQuery<T>;
					if (options?.where instanceof Array) {
						where = options.where.concat({ id } as any);
					} else {
						where = {
							id,
							...(options?.where ? options.where : ({} as any))
						};
					}

					record = await this.mikroRepository.findOneOrFail(where, options as FindOneOrFailOptions<T>);
					record = praseMikroORMEntityToJson(record);
					break;

				case MultiORMEnum.TypeORM:
					options = options as FindOneOptions<T>;
					record = await this.repository.findOneOrFail({
						...(options && options.select
							? {
								select: options.select
							}
							: {}),
						where: {
							id,
							...(options && options.where ? options.where : {})
						},
						...(options && options.relations ? { relations: options.relations } : []),
						...(options && options.order ? { order: options.order } : {})
					} as FindOneOptions<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			return {
				success: true,
				record
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
					record = await this.mikroRepository.findOneOrFail(
						options.where as MikroFilterQuery<T>,
						options as FindOneOrFailOptions<T>
					);
					record = praseMikroORMEntityToJson(record);
					break;
				case MultiORMEnum.TypeORM:
					record = await this.repository.findOneOrFail(options as FindOneOptions<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record
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
					record = await this.mikroRepository.findOneOrFail(options as MikroFilterQuery<T>);
					record = praseMikroORMEntityToJson(record);
					break;
				case MultiORMEnum.TypeORM:
					record = await this.repository.findOneByOrFail(options as FindOptionsWhere<T>);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
			return {
				success: true,
				record
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
				// return await this.mikroRepository.find(options.where as MikroFilterQuery<T>, options as MikroFindOptions<T>);
				options = options as IMikroOptions<T>;

				let where: MikroFilterQuery<T>;
				if (options?.where instanceof Array) {
					where = options.where.concat({ id } as any);
				} else {
					where = {
						id,
						...(options?.where ? options.where : ({} as any))
					};
				}

				record = await this.mikroRepository.findOne(where, options as MikroFindOneOptions<T>);

				record = praseMikroORMEntityToJson(record);
				break;
			case MultiORMEnum.TypeORM:
				options = options as FindOneOptions<T>;
				record = await this.repository.findOne({
					...(options && options.select ? { select: options.select } : {}),
					where: {
						id,
						...(options && options.where ? options.where : {})
					},
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

		return record;
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
				const mikroOptions = options as any;
				const mikroFilterQuery: MikroFilterQuery<T> = options.where as FilterQuery<T>;
				const mikroFindOneOptions: MikroFindOneOptions<T> = {
					...(mikroOptions.relations ? { populate: flatten(mikroOptions.relations) } : {}),
					...(mikroOptions.order ? { orderBy: mikroOptions.order } : {})
				};
				record = await this.mikroRepository.findOne(mikroFilterQuery, mikroFindOneOptions);

				record = praseMikroORMEntityToJson(record);
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

		return record;
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
				record = await this.mikroRepository.findOne(options as MikroFilterQuery<T>);
				record = praseMikroORMEntityToJson(record);
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

		return record;
	}

	public async create(entity: IPartialEntity<T>): Promise<T> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				try {
					const row = this.mikroRepository.create(entity as RequiredEntityData<T>);
					return await this.mikroRepository.upsert(row);
				} catch (err /*: WriteError*/) {
					throw new BadRequestException(err);
				}

			case MultiORMEnum.TypeORM:
				const obj = this.repository.create(entity as DeepPartial<T>);
				try {
					// https://github.com/Microsoft/TypeScript/issues/21592
					return await this.repository.save(obj as any);
				} catch (err /*: WriteError*/) {
					throw new BadRequestException(err);
				}

			default:
				throw new Error(`Not implemented for ${this.ormType}`);
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

					return {
						affected: updatedRow
					} as UpdateResult;

				case MultiORMEnum.TypeORM:
					return await this.repository.update(
						id as string | number | FindOptionsWhere<T>,
						partialEntity as QueryDeepPartialEntity<T>
					);

				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
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
	public async delete(criteria: string | number | FindOptionsWhere<T>, ...options: any[]): Promise<DeleteResult> {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					let where: MikroFilterQuery<T>;
					if (typeof criteria === 'string' || typeof criteria === 'number') {
						where = { id: criteria } as any;
					}
					const result = await this.mikroRepository.nativeDelete(where, criteria as DeleteOptions<T>);
					return { affected: result } as DeleteResult;
				case MultiORMEnum.TypeORM:
					return await this.repository.delete(criteria);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new NotFoundException(`The record was not found`, error);
		}

		// try {
		// 	return await this.repository.delete(criteria);
		// } catch (error) {
		// 	console.log(error)
		// 	throw new NotFoundException(`The record was not found`, error);
		// }
	}

	/**
	 * e.g., findOneById(id).pipe(map(entity => entity.id), entityNotFound())
	 */
	private entityNotFound() {
		return (stream$) =>
			stream$.pipe(
				mergeMap((signal) => {
					if (!signal) {
						return throwError(() => new NotFoundException(`The requested record was not found`));
					}
					return observableOf(signal);
				})
			);
	}
}
