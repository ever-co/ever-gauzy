// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
	DeepPartial,
	DeleteResult,
	FindManyOptions,
	FindOneOptions,
	FindOptionsWhere,
	Repository,
	SelectQueryBuilder,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import * as moment from 'moment';
import { of as observableOf, throwError } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { IPagination } from '@gauzy/contracts';
import { BaseEntity } from '../entities/internal';
import { ICrudService } from './icrud.service';
import { ITryRequest } from './try-request';
import { filterQuery } from './query-builder';
import { RequestContext } from './../../core/context';

export abstract class CrudService<T extends BaseEntity>
	implements ICrudService<T> {

	protected constructor(
		protected readonly repository: Repository<T>
	) {}

	/**
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async count(options?: FindManyOptions<T>): Promise<number> {
		return await this.repository.count(options);
	}

	/**
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async countBy(options?: FindOptionsWhere<T>): Promise<number> {
		return await this.repository.countBy(options);
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * but ignores pagination settings (from and take options).
	 *
	 * @param options
	 * @returns
	 */
	public async findAll(options?: FindManyOptions<T>): Promise<IPagination<T>> {
		const total = await this.repository.count(options);
		const items = await this.repository.find(options);
		return { items, total };
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * But includes pagination settings
	 *
	 * @param filter
	 * @returns
	 */
	public async paginate(filter?: any): Promise<IPagination<T>> {
		try {
			let options: FindManyOptions = {};
			options.skip = filter && filter.skip ? (filter.take * (filter.skip - 1)) : 0;
			options.take = filter && filter.take ? (filter.take) : 10;
			if (filter) {
				if (filter.orderBy && filter.order) {
					options.order = {
						[filter.orderBy]: filter.order
					}
				} else if (filter.orderBy) {
					options.order = filter.orderBy;
				}
				if (filter.relations) {
					options.relations = filter.relations;
				}
				if (filter.join) {
					options.join = filter.join;
				}
			}
			options.where = (qb: SelectQueryBuilder<T>) => {
				if (filter && (filter.filters || filter.where)) {
					if (filter.where) {
						const wheres: any = {}
						for (const field in filter.where) {
							if (Object.prototype.hasOwnProperty.call(filter.where, field)) {
								wheres[field] = filter.where[field];
							}
						}
						filterQuery(qb, wheres);
					}
				}
				const tenantId = RequestContext.currentTenantId();
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
			}
			console.log(filter, options, moment().format('DD.MM.YYYY HH:mm:ss'));
			const [items, total] = await this.repository.findAndCount(options);
			return { items, total };
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByIdString(
		id: string,
		options?: FindOneOptions<T>
	): Promise<ITryRequest<T>> {
		try {
			const record = await this.repository.findOneOrFail({
				select: options.select,
				where: {
					id: id,
					...options.where
				},
				relations: options.relations,
			} as FindOneOptions<T>);
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
    | @FindOneOrFail
    |--------------------------------------------------------------------------
    */

	/**
	 * Finds first entity by a given find options.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByOptions(
		options: FindOneOptions<T>
	): Promise<ITryRequest<T>> {
		try {
			const record = await this.repository.findOneOrFail(
				options
			);
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
	public async findOneOrFailByWhereOptions(
		options: FindOptionsWhere<T>
	): Promise<ITryRequest<T>> {
		try {
			const record = await this.repository.findOneByOrFail(
				options
			);
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
	public async findOneByIdString(
		id: string,
		options?: FindOneOptions<T>
	): Promise<T> {
		const record = await this.repository.findOne({
			select: options.select,
			where: {
				id,
				...options.where
			},
			relations: options.relations,
			order: options.order
		} as FindOneOptions<T>);
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
	public async findOneByOptions(
		options: FindOneOptions<T>
	): Promise<T | null> {
		const record = await this.repository.findOne(
			options
		);
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
	public async findOneByWhereOptions(
		options: FindOptionsWhere<T>
	): Promise<T | null> {
		const record = await this.repository.findOneBy(
			options
		);
		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		return record;
	}

	public async create(entity: DeepPartial<T>): Promise<T> {
		const obj = this.repository.create(entity);
		try {
			// https://github.com/Microsoft/TypeScript/issues/21592
			return await this.repository.save(obj as any);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
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
	public async update(
		id: string | number | FindOptionsWhere<T>,
		partialEntity: QueryDeepPartialEntity<T>
	): Promise<UpdateResult | T> {
		try {
			// try if can import somehow the service and use its method
			return await this.repository.update(id, partialEntity);
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
	public async delete(
		criteria: string | number | FindOptionsWhere<T>,
		...options: any[]
	): Promise<DeleteResult> {
		try {
			return await this.repository.delete(criteria);
		} catch (error) {
			console.log(error)
			throw new NotFoundException(`The record was not found`, error);
		}
	}

	/**
	 * e.g., findOneById(id).pipe(map(entity => entity.id), entityNotFound())
	 */
	private entityNotFound() {
		return (stream$) =>
			stream$.pipe(
				mergeMap((signal) => {
					if (!signal) {
						return throwError(() =>
							new NotFoundException(
								`The requested record was not found`
							)
						);
					}
					return observableOf(signal);
				})
			);
	}
}
