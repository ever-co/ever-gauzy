import {
	FindConditions,
	FindManyOptions,
	FindOneOptions,
	ObjectLiteral,
	Repository
} from 'typeorm';
import { User } from '../../user/user.entity';
import { RequestContext } from '../context';
import { TenantBase } from '../entities/tenant-base';
import { CrudService } from './crud.service';
import { ICrudService } from './icrud.service';
import { IPagination } from './pagination';
import { ITryRequest } from './try-request';

/**
 * This abstract class adds tenantId to all query filters if a user is available in the current RequestContext
 * If a user is not available in RequestContext, then it behaves exactly the same as CrudService
 */
export abstract class TenantAwareCrudService<T extends TenantBase>
	extends CrudService<T>
	implements ICrudService<T> {
	protected constructor(protected readonly repository: Repository<T>) {
		super(repository);
	}

	private findConditionsWithTenant(
		user: User,
		where?: FindConditions<T> | ObjectLiteral | FindConditions<T>[]
	): FindConditions<T> | ObjectLiteral | FindConditions<T>[] {
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

	private findManyWithTenant(
		filter?: FindManyOptions<T>
	): FindManyOptions<T> {
		const user = RequestContext.currentUser();
		if (!user || !user.tenantId) {
			return filter;
		}
		if (!filter) {
			return {
				where: this.findConditionsWithTenant(user)
			};
		}
		if (!filter.where) {
			return {
				...filter,
				where: this.findConditionsWithTenant(user)
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

	public async findOneOrFail(
		id: string | number | FindOneOptions<T> | FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<ITryRequest> {
		return await super.findOneOrFail(id, this.findManyWithTenant(options));
	}

	public async findOne(
		id: string | number | FindOneOptions<T> | FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<T> {
		return await super.findOne(id, this.findManyWithTenant(options));
	}
}
