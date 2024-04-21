import { NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, FindManyOptions, FindOneOptions, Repository, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPagination, IUser, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { RequestContext } from '../context';
import { TenantBaseEntity } from '../entities/internal';
import { CrudService } from './crud.service';
import { ICrudService, IPartialEntity } from './icrud.service';
import { ITryRequest } from './try-request';

/**
 * This abstract class adds tenantId to all query filters if a user is available in the current RequestContext
 * If a user is not available in RequestContext, then it behaves exactly the same as CrudService
 */
export abstract class TenantAwareCrudService<T extends TenantBaseEntity>
	extends CrudService<T>
	implements ICrudService<T> {
	constructor(typeOrmRepository: Repository<T>, mikroOrmRepository: MikroOrmBaseEntityRepository<T>) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	/**
	 * Define find conditions when retrieving data with employee by user.
	 *
	 * @returns The find conditions based on the current user's relationship with employees.
	 */
	private findConditionsWithEmployeeByUser(): FindOptionsWhere<T> {
		const employeeId = RequestContext.currentEmployeeId();
		return (
			/**
			 * If the employee has logged in, retrieve their own data unless
			 * they have the permission to change the selected employee.
			 */
			(
				isNotEmpty(employeeId)
					? !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
						this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('employeeId')
						? {
							employee: {
								id: employeeId
							},
							employeeId: employeeId
						}
						: {}
					: {}
			) as FindOptionsWhere<T>
		);
	}

	/**
	 * Define find conditions when retrieving data with tenant by user.
	 *
	 * @param user - The user for whom the conditions are defined.
	 * @returns The find conditions based on the user's relationship with the tenant and employees.
	 */
	private findConditionsWithTenantByUser(user: IUser): FindOptionsWhere<T> {
		return {
			...(this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId')
				? {
					tenant: {
						id: user.tenantId
					},
					tenantId: user.tenantId
				}
				: {}),
			...this.findConditionsWithEmployeeByUser()
		} as FindOptionsWhere<T>;
	}

	/**
	 * Define find conditions when retrieving data with tenant.
	 *
	 * @param user - The user for whom the conditions are defined.
	 * @param where - Additional find options.
	 * @returns The find conditions based on the user's relationship with the tenant and additional options.
	 */
	private findConditionsWithTenant(
		user: IUser,
		where?: FindOptionsWhere<T>[] | FindOptionsWhere<T>
	): FindOptionsWhere<T>[] | FindOptionsWhere<T> {
		if (where && Array.isArray(where)) {
			const wheres: FindOptionsWhere<T>[] = [];
			where.forEach((options: FindOptionsWhere<T>) => {
				wheres.push({
					...options,
					...this.findConditionsWithTenantByUser(user)
				});
			});
			return wheres;
		}
		return (
			where
				? {
					...where,
					...this.findConditionsWithTenantByUser(user)
				}
				: {
					...this.findConditionsWithTenantByUser(user)
				}
		) as FindOptionsWhere<T>;
	}

	/**
	 * Define find one options when retrieving data with tenant.
	 *
	 * @param filter - Additional find options.
	 * @returns The find one options based on the current user's relationship with the tenant and additional options.
	 */
	private findOneWithTenant(filter?: FindOneOptions<T>): FindOneOptions<T> {
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
	 * Define find many options when retrieving data with tenant.
	 *
	 * @param filter - Additional find options.
	 * @returns The find many options based on the current user's relationship with the tenant and additional options.
	 */
	private findManyWithTenant(filter?: FindManyOptions<T>): FindManyOptions<T> {
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

	public async countFast(): Promise<number> {
		return await super.count();
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

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * but ignores pagination settings (from and take options).
	 *
	 * @param filter
	 * @returns
	 */
	public async findAll(filter?: FindManyOptions<T>): Promise<IPagination<T>> {
		return await super.findAll(this.findManyWithTenant(filter));
	}

	/**
	 * Finds entities that match given find options.
	 *
	 * @param filter
	 * @returns
	 */
	public async find(filter?: FindManyOptions<T>): Promise<T[]> {
		return await super.find(this.findManyWithTenant(filter));
	}

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * But includes pagination settings
	 *
	 * @param filter
	 * @returns
	 */
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
	public async findOneOrFailByIdString(id: T['id'], options?: FindOneOptions<T>): Promise<ITryRequest<T>> {
		return await super.findOneOrFailByIdString(id, this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given options with current tenant.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByOptions(options?: FindOneOptions<T>): Promise<ITryRequest<T>> {
		return await super.findOneOrFailByOptions(this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given where condition with current tenant.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByWhereOptions(options: FindOptionsWhere<T>): Promise<ITryRequest<T>> {
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
	public async findOneByIdString(id: T['id'], options?: FindOneOptions<T>): Promise<T> {
		return await super.findOneByIdString(id, this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given options with current tenant.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByOptions(options: FindOneOptions<T>): Promise<T> {
		return await super.findOneByOptions(this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given where condition with current tenant.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByWhereOptions(options: FindOptionsWhere<T>): Promise<T> {
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
	 * @returns
	 */
	public async create(entity: IPartialEntity<T>): Promise<T> {
		const tenantId = RequestContext.currentTenantId();
		const employeeId = RequestContext.currentEmployeeId();

		return await super.create({
			...entity,
			...(this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId')
				? {
					tenant: {
						id: tenantId
					},
					tenantId
				}
				: {}),
			/**
			 * If employee has login & create data for self
			 */
			...(isNotEmpty(employeeId)
				? !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
					this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('employeeId')
					? {
						employee: {
							id: employeeId
						},
						employeeId: employeeId
					}
					: {}
				: {})
		});
	}

	/**
	 * Saves a given entity in the database.
	 * If entity does not exist in the database then inserts, otherwise updates.
	 *
	 * @param entity
	 * @returns
	 */
	public async save(entity: IPartialEntity<T>): Promise<T> {
		const tenantId = RequestContext.currentTenantId();
		return await super.save({
			...entity,
			...(this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId')
				? {
					tenant: {
						id: tenantId
					},
					tenantId
				}
				: {})
		});
	}

	/**
	 * Updates entity partially. Entity can be found by a given conditions.
	 *
	 * @param id
	 * @param partialEntity
	 * @returns
	 */
	public async update(
		id: string | FindOptionsWhere<T>,
		partialEntity: QueryDeepPartialEntity<T>
	): Promise<T | UpdateResult> {
		if (typeof id === 'string') {
			await this.findOneByIdString(id);
		} else if (typeof id === 'object') {
			await this.findOneByWhereOptions(id as FindOptionsWhere<T>);
		}
		return await super.update(id, partialEntity);
	}

	/**
	 * DELETE source related to tenant
	 *
	 * @param criteria
	 * @param options
	 * @returns
	 */
	public async delete(criteria: string | FindOptionsWhere<T>, options?: FindOneOptions<T>): Promise<DeleteResult> {
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

	/**
	 * Softly deletes entities by a given criteria.
	 * This method sets a flag or timestamp indicating the entity is considered deleted.
	 * It does not actually remove the entity from the database, allowing for recovery or audit purposes.
	 *
	 * @param criteria - Entity ID or complex query to identify which entity to soft-delete.
	 * @param options - Additional options for the operation.
	 * @returns {Promise<DeleteResult>} - Result indicating success or failure.
	 */
	public async softDelete(
		criteria: string | number | FindOptionsWhere<T>,
		options?: FindOneOptions<T>
	): Promise<UpdateResult | void> {
		try {
			let record: T | null;

			// If the criteria is a string, assume it's an ID and find the record by ID.
			if (typeof criteria === 'string') {
				record = await this.findOneByIdString(criteria, options);
			} else {
				// Otherwise, consider it a more complex query and find the record by those options.
				record = await this.findOneByWhereOptions(criteria as FindOptionsWhere<T>);
			}

			// If no record is found, throw a NotFoundException.
			if (!record) {
				throw new NotFoundException(`The requested record was not found`);
			}

			// Proceed with the soft-delete operation from the superclass.
			return await super.softDelete(criteria);
		} catch (err) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`The record was not found or could not be soft-deleted`, err);
		}
	}
}
