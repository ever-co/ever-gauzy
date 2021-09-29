import { NotFoundException } from '@nestjs/common';
import {
	DeepPartial,
	DeleteResult,
	FindConditions,
	FindManyOptions,
	FindOneOptions,
	ObjectLiteral,
	Repository
} from 'typeorm';
import { IPagination } from '@gauzy/contracts';
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
export abstract class TenantAwareCrudService<T extends TenantBaseEntity>
	extends CrudService<T>
	implements ICrudService<T> {
	protected constructor(protected readonly repository: Repository<T>) {
		super(repository);
	}

	private findConditionsWithTenantByUser(
		user: User		
	): FindConditions<T>[] | FindConditions<T> | ObjectLiteral | string {		
		return {
					tenant: {
						id: user.tenantId
					}
			  };
	}

	private findConditionsWithTenant(
		user: User,
		where?: FindConditions<T>[] | FindConditions<T> | ObjectLiteral
	): FindConditions<T>[] | FindConditions<T> | ObjectLiteral {
				
		if (where && Array.isArray(where)) {
			const w = where as FindConditions<T>[];
			return w.map((options: FindConditions<T>) => ({
				...options,
				tenant: {
					id: user.tenantId
				}
			}));
		}		

		return where
			? {
					...where,
					tenant: {
						id: user.tenantId
					}
			  }
			: {
					tenant: {
						id: user.tenantId
					}
			  };
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

	public async count(filter?: FindManyOptions<T>): Promise<number> {
		return await super.count(this.findManyWithTenant(filter));
	}

	public async findAll(filter?: FindManyOptions<T>): Promise<IPagination<T>> {
		return await super.findAll(this.findManyWithTenant(filter));
	}

	public async findOneOrFailByIdString(
		id: string,
		options?: FindOneOptions<T>
	): Promise<ITryRequest> {
		return await super.findOneOrFailByIdString(id, this.findOneWithTenant(options));
	}

	public async findOneOrFailByIdNumber(
		id: number,
		options?: FindOneOptions<T>
	): Promise<ITryRequest> {
		return await super.findOneOrFailByIdNumber(id, this.findOneWithTenant(options));
	}

	public async findOneOrFailByOptions(		
		options?: FindOneOptions<T>
	): Promise<ITryRequest> {
		return await super.findOneOrFailByOptions(this.findOneWithTenant(options));
	}

	public async findOneOrFailByConditions(
		id: FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<ITryRequest> {
		return await super.findOneOrFailByConditions(id, this.findOneWithTenant(options));
	}

	/*
    |--------------------------------------------------------------------------
    | @FindOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Finds first entity that matches given id and options with current tenant.
	 *
	 * @param id {string}
	 * @param options
	 * @returns
	 */
	public async findOneByIdString(
		id: string,
		options?: FindOneOptions<T>
	): Promise<T> {
		return await super.findOneByIdString(
			id,
			this.findOneWithTenant(options)
		);
	}

	/**
	 * Finds first entity that matches given id and options with current tenant.
	 *
	 * @param id {number}
	 * @param options
	 * @returns
	 */
	public async findOneByIdNumber(
		id: number,
		options?: FindOneOptions<T>
	): Promise<T> {
		return await super.findOneByIdNumber(
			id,
			this.findOneWithTenant(options)
		);
	}

	/**
	 * Finds first entity that matches given conditions and options with current tenant.
	 *
	 * @param id
	 * @param options
	 * @returns
	 */
	public async findOneByConditions(
		id: FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<T> {
		return await super.findOneByConditions(
			id,
			this.findOneWithTenant(options)
		);
	}

	/**
	 * Finds first entity that matches given options with current tenant.
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

	public async create(entity: DeepPartial<T>, ...options: any[]): Promise<T> {
		const tenantId = RequestContext.currentTenantId();
		if (tenantId) {
			const entityWithTenant = {
				...entity,
				tenant: { id: tenantId }
			};
			return super.create(entityWithTenant, ...options);
		}
		return super.create(entity, ...options);
	}

	/**
	 * DELETE source related to tenant
	 * 
	 * @param criteria 
	 * @param options 
	 * @returns 
	 */
	public async delete(
		criteria: string | number | FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<DeleteResult> {
		try {
			let record;
			if (typeof criteria === 'string') {
				record = await this.findOneByIdString(criteria, options);
			} else if (typeof criteria === 'number') {
				record = await this.findOneByIdNumber(criteria, options);
			} else {
				record = await this.findOneByConditions(criteria, options);
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
