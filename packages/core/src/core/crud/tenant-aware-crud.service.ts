import { NotFoundException } from '@nestjs/common';
import {
	DeepPartial,
	DeleteResult,
	FindOptionsWhere,
	FindManyOptions,
	FindOneOptions,
	Repository
} from 'typeorm';
import { IPagination, IUser } from '@gauzy/contracts';
import { User } from '../../user/user.entity';
import { RequestContext } from '../context';
import { TenantBaseEntity } from '../entities/internal';
import { CrudService } from './crud.service';
import { ICrudService } from './icrud.service';
import { ITryRequest } from './try-request';

/**
 * This abstract class adds tenantId to all query filters if a user is available in the current RequestContext
 * If a user is not available in RequestContext, then it behaves exactly the same as CrudService
 */
export abstract class TenantAwareCrudService<T extends TenantBaseEntity> extends CrudService<T>
	implements ICrudService<T> {

	protected constructor(
		protected readonly repository: Repository<T>
	) {
		super(repository);
	}

	private findConditionsWithTenantByUser(
		user: IUser
	): FindOptionsWhere<T>{
		return {
			tenant: {
				id: user.tenantId
			}
		} as FindOptionsWhere<T>;
	}

	private findConditionsWithTenant(
		user: User,
		where?: FindOptionsWhere<T>[] | FindOptionsWhere<T>
	): FindOptionsWhere<T>[] | FindOptionsWhere<T> {
		if (where && Array.isArray(where)) {
			const wheres: FindOptionsWhere<T>[] = [];
			where.forEach((options: FindOptionsWhere<T>) => {
				wheres.push({
					...options,
					tenant: {
						id: user.tenantId
					}
				})
			});
			return wheres;
		}
		return (
			where ? {
				...where,
				tenant: {
					id: user.tenantId
				}
			} : {
				tenant: {
					id: user.tenantId
				}
			}
		) as FindOptionsWhere<T>;
	}

	private findOneWithTenant(
		filter?: FindOneOptions<T>
	): FindOneOptions<T> {
		const user = RequestContext.currentUser();
		if (!user || !user.tenantId) {
			return filter;
		}
		if (!filter) {
			return {
				where: this.findConditionsWithTenantByUser(user)
			};
		}
		if (!filter.where) {
			return {
				...filter,
				where: this.findConditionsWithTenantByUser(user)
			};
		}
		if (filter.where instanceof Object) {
			return {
				...filter,
				where: this.findConditionsWithTenant(user, filter.where)
			};
		}
		return filter;
	}

	private findManyWithTenant(
		filter?: FindManyOptions<T>
	): FindManyOptions<T> {

		const user = RequestContext.currentUser();
		if (!user || !user.tenantId) {
			return filter;
		}
		if (!filter) {
			return {
				where: this.findConditionsWithTenantByUser(user)
			};
		}
		if (!filter.where) {
			return {
				...filter,
				where: this.findConditionsWithTenantByUser(user)
			};
		}
		if (filter.where instanceof Object) {
			return {
				...filter,
				where: this.findConditionsWithTenant(user, filter.where)
			};
		}
		return filter;
	}

	/**
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async count(options?: FindManyOptions<T>): Promise<number> {
		return await super.count(this.findManyWithTenant(options));
	}

	/**
	 * Counts entities that match given options.
	 * Useful for pagination.
	 *
	 * @param options
	 * @returns
	 */
	public async countBy(options?: FindOptionsWhere<T>): Promise<number> {
		const user = RequestContext.currentUser();
		return await super.countBy({
			...this.findConditionsWithTenantByUser(user),
			...options
		});
	}

	public async findAll(filter?: FindManyOptions<T>): Promise<IPagination<T>> {
		return await super.findAll(this.findManyWithTenant(filter));
	}

	/*
    |--------------------------------------------------------------------------
    | @FindOneOrFail
    |--------------------------------------------------------------------------
    */

	/**
	 * Finds first entity by a given find options with current tenant.
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
		return await super.findOneOrFailByIdString(id, this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given options with current tenant.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByOptions(
		options?: FindOneOptions<T>
	): Promise<ITryRequest<T>> {
		return await super.findOneOrFailByOptions(this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given where condition with current tenant.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	 public async findOneOrFailByWhereOptions(
		options: FindOptionsWhere<T>
	): Promise<ITryRequest<T>> {
		const user = RequestContext.currentUser();
		return await super.findOneOrFailByWhereOptions({
			...this.findConditionsWithTenantByUser(user),
			...options
		});
	}

	/*
    |--------------------------------------------------------------------------
    | @FindOne
    |--------------------------------------------------------------------------
    */
	/**
	 * Finds first entity by a given find options with current tenant.
	 * If entity was not found in the database - returns null.
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
	public async findOneByIdString(
		id: string,
		options?: FindOneOptions<T>
	): Promise<T> {
		return await super.findOneByIdString(id, this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given options with current tenant.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByOptions(
		options: FindOneOptions<T>
	): Promise<T> {
		return await super.findOneByOptions(
			this.findOneWithTenant(options)
		);
	}

	/**
	 * Creates a new entity instance and copies all entity properties from this object into a new entity.
	 * Note that it copies only properties that are present in entity schema.
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
	public async create(entity: DeepPartial<T>, ...options: any[]): Promise<T> {
		const tenantId = RequestContext.currentTenantId();
		if (tenantId) {
			return super.create({
				...entity,
				tenant: { id: tenantId }
			});
		}
		return super.create(entity);
	}

	/**
	 * DELETE source related to tenant
	 *
	 * @param criteria
	 * @param options
	 * @returns
	 */
	public async delete(
		criteria: string | number | FindOptionsWhere<T>,
		options?: FindOneOptions<T>
	): Promise<DeleteResult> {
		try {
			let record;
			if (typeof criteria === 'string') {
				record = await this.findOneByIdString(criteria, options);
			} else {
				record = await this.findOneByWhereOptions(criteria as FindOptionsWhere<T>);
			}
			if (!record) {
				throw new NotFoundException(`The requested record was not found`);
			}
			return await super.delete(criteria);
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}
}
