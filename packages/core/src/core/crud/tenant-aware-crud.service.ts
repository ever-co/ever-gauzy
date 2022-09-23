import { NotFoundException } from '@nestjs/common';
import {
	DeepPartial,
	DeleteResult,
	FindOptionsWhere,
	FindManyOptions,
	FindOneOptions,
	Repository
} from 'typeorm';
import { IPagination, IUser, PermissionsEnum } from '@gauzy/contracts';
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

	private findConditionsWithEmployeeByUser(): FindOptionsWhere<T>{
		const employeeId = RequestContext.currentEmployeeId();
		return (
			/**
			 * If employee has login & retrieve self data
			 */
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				) &&
				this.repository.metadata.hasColumnWithPropertyPath('employeeId')
			) ? {
				employee: {
					id: employeeId
				},
				employeeId
			} : {}
		) as FindOptionsWhere<T>
	}

	private findConditionsWithTenantByUser(
		user: IUser
	): FindOptionsWhere<T>{
		return {
			...(
				this.repository.metadata.hasColumnWithPropertyPath('tenantId')
			) ? {
				tenant: {
					id: user.tenantId
				},
				tenantId: user.tenantId
			} : {},
			...this.findConditionsWithEmployeeByUser()
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
					...this.findConditionsWithTenantByUser(user)
				})
			});
			return wheres;
		}
		return (
			where ? {
				...where,
				...this.findConditionsWithTenantByUser(user)
			} : {
				...this.findConditionsWithTenantByUser(user)
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
			...options,
			...this.findConditionsWithTenantByUser(user)
		});
	}

	public async findAll(filter?: FindManyOptions<T>): Promise<IPagination<T>> {
		return await super.findAll(this.findManyWithTenant(filter));
	}

	public async paginate(filter?: FindManyOptions<T>): Promise<IPagination<T>> {
		return await super.paginate(this.findManyWithTenant(filter));
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
		id: T['id'],
		options?: FindOneOptions<T>
	): Promise<ITryRequest<T>> {
		return await super.findOneOrFailByIdString(
			id,
			this.findOneWithTenant(options)
		);
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
		return await super.findOneOrFailByOptions(
			this.findOneWithTenant(options)
		);
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
			...options,
			...this.findConditionsWithTenantByUser(user)
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
		id: T['id'],
		options?: FindOneOptions<T>
	): Promise<T> {
		return await super.findOneByIdString(
			id,
			this.findOneWithTenant(options)
		);
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
	 * Finds first entity that matches given where condition with current tenant.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByWhereOptions(
		options: FindOptionsWhere<T>
	): Promise<T> {
		const user = RequestContext.currentUser();
		return await super.findOneByWhereOptions({
			...options,
			...this.findConditionsWithTenantByUser(user)
		});
	}

	/**
	 * Creates a new entity instance and copies all entity properties from this object into a new entity.
	 * Note that it copies only properties that are present in entity schema.
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
	public async create(entity: DeepPartial<T>): Promise<T> {
		const tenantId = RequestContext.currentTenantId();
		const employeeId = RequestContext.currentEmployeeId();

		return super.create({
			...entity,
			...(
				this.repository.metadata.hasColumnWithPropertyPath('tenantId')
			) ? {
				tenant: {
					id: tenantId
				},
				tenantId,
			} : {},
			/**
			 * If employee has login & create data for self
			 */
			...(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				) &&
				this.repository.metadata.hasColumnWithPropertyPath('employeeId')
			) ? {
				employee: {
					id: employeeId
				},
				employeeId: employeeId
			} : {}
		});
	}

	/**
	 * DELETE source related to tenant
	 *
	 * @param criteria
	 * @param options
	 * @returns
	 */
	public async delete(
		criteria: string | FindOptionsWhere<T>,
		options?: FindOneOptions<T>
	): Promise<DeleteResult> {
		try {
			let record: T;
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
