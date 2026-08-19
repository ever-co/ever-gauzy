import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In, Repository, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IPagination, IUser, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { LegacyFindManyOptions, LegacyFindOneOptions, MultiORMEnum } from '../utils';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { RequestContext } from '../context';
import { TenantBaseEntity } from '../entities/internal';
import { CrudService } from './crud.service';
import { assertCriteriaHasPredicate } from './criteria.helper';
import { ICrudService, IPartialEntity } from './icrud.service';
import { ITryRequest } from './try-request';

/**
 * This abstract class adds tenantId to all query filters if a user is available in the current RequestContext
 * If a user is not available in RequestContext, then it behaves exactly the same as CrudService
 */
export abstract class TenantAwareCrudService<T extends TenantBaseEntity>
	extends CrudService<T>
	implements ICrudService<T>
{
	private static readonly SKIP_EMPLOYEE_FILTER_KEY = 'skipEmployeeFilter';

	constructor(typeOrmRepository: Repository<T>, mikroOrmRepository: MikroOrmBaseEntityRepository<T>) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	/**
	 * Gets the current skipEmployeeFilter flag from request context.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions.
	 */
	private getSkipEmployeeFilter(): boolean {
		try {
			const context = RequestContext['clsService'];
			return context?.get(TenantAwareCrudService.SKIP_EMPLOYEE_FILTER_KEY) ?? false;
		} catch {
			return false;
		}
	}

	/**
	 * Sets the skipEmployeeFilter flag in request context.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions.
	 */
	private setSkipEmployeeFilter(value: boolean): void {
		try {
			const context = RequestContext['clsService'];
			context?.set(TenantAwareCrudService.SKIP_EMPLOYEE_FILTER_KEY, value);
		} catch {
			// Silently fail if context is not available
		}
	}

	/**
	 * Builds TypeORM find conditions to restrict data
	 * to the currently logged-in employee.
	 *
	 * If the user has permission to change the selected employee
	 * or filtering is skipped, no automatic restriction is applied.
	 */
	private findConditionsWithEmployeeByUser(): FindOptionsWhere<T> {
		// Skip automatic filtering if explicitly disabled
		if (this.getSkipEmployeeFilter()) {
			return {} as FindOptionsWhere<T>;
		}

		const employeeId = RequestContext.currentEmployeeId();

		const hasEmployeeColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('employeeId');
		const canChangeEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Restrict to current employee only
		if (isNotEmpty(employeeId) && hasEmployeeColumn && !canChangeEmployee) {
			return {
				employee: { id: employeeId },
				employeeId
			} as unknown as FindOptionsWhere<T>;
		}

		return {} as FindOptionsWhere<T>;
	}

	/**
	 * Executes a callback without automatic employeeId filtering.
	 * This is useful when you need to implement custom access control logic.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions between concurrent requests.
	 *
	 * @param callback - The async function to execute without employee filtering
	 * @returns The result of the callback
	 *
	 * @example
	 * ```typescript
	 * const dailyPlan = await this.withoutEmployeeFilter(async () => {
	 *     return await this.findOneByIdString(planId);
	 * });
	 * ```
	 */
	protected async withoutEmployeeFilter<R>(callback: () => Promise<R>): Promise<R> {
		const originalValue = this.getSkipEmployeeFilter();
		this.setSkipEmployeeFilter(true);
		try {
			return await callback();
		} finally {
			this.setSkipEmployeeFilter(originalValue);
		}
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
	private findOneWithTenant(filter?: LegacyFindOneOptions<T>): LegacyFindOneOptions<T> {
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
	private findManyWithTenant(filter?: LegacyFindManyOptions<T>): LegacyFindManyOptions<T> {
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
	public async count(options?: LegacyFindManyOptions<T>): Promise<number> {
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

	/**
	 * Finds entities that match given find options.
	 * Also counts all entities that match given conditions,
	 * but ignores pagination settings (from and take options).
	 *
	 * @param filter
	 * @returns
	 */
	public async findAll(filter?: LegacyFindManyOptions<T>): Promise<IPagination<T>> {
		return await super.findAll(this.findManyWithTenant(filter));
	}

	/**
	 * Finds entities that match given find options.
	 *
	 * @param filter
	 * @returns
	 */
	public async find(filter?: LegacyFindManyOptions<T>): Promise<T[]> {
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
	public async paginate(filter?: LegacyFindManyOptions<T>): Promise<IPagination<T>> {
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
	public async findOneOrFailByIdString(id: ID, options?: LegacyFindOneOptions<T>): Promise<ITryRequest<T>> {
		return await super.findOneOrFailByIdString(id, this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given options with current tenant.
	 * If entity was not found in the database - rejects with error.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneOrFailByOptions(options?: LegacyFindOneOptions<T>): Promise<ITryRequest<T>> {
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
	public async findOneByIdString(id: ID, options?: LegacyFindOneOptions<T>): Promise<T> {
		return await super.findOneByIdString(id, this.findOneWithTenant(options));
	}

	/**
	 * Finds first entity that matches given options with current tenant.
	 * If entity was not found in the database - returns null.
	 *
	 * @param options
	 * @returns
	 */
	public async findOneByOptions(options: LegacyFindOneOptions<T>): Promise<T> {
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
	 * Refuses to persist an entity whose id already names a row of ANOTHER tenant.
	 *
	 * create()/save() with an id are upserts: TypeORM's save() looks the row up by primary key only and
	 * then UPDATEs it, while this service merely stamps the caller's tenantId onto the payload. A body
	 * that smuggled a foreign id in (`{ id, ...body }` spreads, un-whitelisted update DTOs) therefore
	 * overwrote — and re-tenanted — another tenant's row (GHSA-gwpq-mmw7-vx85 / GHSA-x4mv-fhwj-g3rp
	 * class). Rows the caller's tenant owns, and ids that do not exist yet, are untouched.
	 *
	 * @param entity - The payload about to be persisted.
	 * @param tenantId - The caller's tenant.
	 */
	protected async assertNotForeignRow(entity: IPartialEntity<T>, tenantId: ID | null): Promise<void> {
		const id = (entity as any)?.id;
		if (!id || !tenantId || !this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId')) {
			return;
		}
		let existing: unknown;
		let existingTenantId: ID | null | undefined;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				existing = await this.mikroOrmRepository.findOne({ id } as any, { fields: ['id', 'tenantId'] as any });
				existingTenantId = (existing as any)?.tenantId;
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				existing = await this.typeOrmRepository.findOne({
					where: { id } as FindOptionsWhere<T>,
					select: { id: true, tenantId: true } as any,
					withDeleted: true
				});
				existingTenantId = (existing as any)?.tenantId;
				break;
			}
		}
		// Fail CLOSED on a tenant-less row too: on the update-through-create endpoints this guard is the
		// only ownership check, so a row with a NULL tenantId (legacy / global / written without a
		// request context) must not be overwritten — and claimed — by a tenant user.
		if (existing && String(existingTenantId ?? '') !== String(tenantId)) {
			throw new ForbiddenException('The record belongs to another tenant');
		}
	}

	/**
	 * Batch form of {@link assertNotForeignRow} for createMany()/saveMany() (one lookup for all ids).
	 */
	protected async assertNotForeignRows(entities: IPartialEntity<T>[], tenantId: ID | null): Promise<void> {
		const ids = (entities ?? []).map((entity) => (entity as any)?.id).filter((id) => !!id);
		if (!ids.length || !tenantId || !this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId')) {
			return;
		}
		let existing: any[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				existing = await this.mikroOrmRepository.find({ id: { $in: ids } } as any, { fields: ['id', 'tenantId'] as any });
				break;
			case MultiORMEnum.TypeORM:
			default:
				existing = await this.typeOrmRepository.find({
					where: { id: In(ids) } as FindOptionsWhere<T>,
					select: { id: true, tenantId: true } as any,
					withDeleted: true
				});
				break;
		}
		if (existing.some((row) => String(row?.tenantId ?? '') !== String(tenantId))) {
			throw new ForbiddenException('One of the records belongs to another tenant');
		}
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
		await this.assertNotForeignRow(entity, tenantId);

		const hasTenantColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId');
		const hasEmployeeColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('employeeId');

		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		return await super.create({
			...entity,
			...(hasTenantColumn ? { tenant: { id: tenantId }, tenantId } : {}),
			/**
			 * If employee has login & create data for self
			 */
			...(isNotEmpty(employeeId) && !hasPermission && hasEmployeeColumn
				? {
						employee: { id: employeeId },
						employeeId: employeeId
					}
				: {})
		});
	}

	/**
	 * Creates multiple new entities in a single bulk operation with tenant scoping.
	 * Enriches all entities with tenantId and employeeId (same logic as create()).
	 * More efficient than calling create() in a loop.
	 *
	 * @param entities The array of partial entity data for creation.
	 * @returns The array of created entities.
	 */
	public async createMany(entities: IPartialEntity<T>[]): Promise<T[]> {
		const tenantId = RequestContext.currentTenantId();
		await this.assertNotForeignRows(entities, tenantId);
		const employeeId = RequestContext.currentEmployeeId();

		const hasTenantColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId');
		const hasEmployeeColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('employeeId');
		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		const shouldSetEmployee = isNotEmpty(employeeId) && !hasPermission && hasEmployeeColumn;

		const enriched = entities.map((entity) => ({
			...entity,
			...(hasTenantColumn ? { tenant: { id: tenantId }, tenantId } : {}),
			...(shouldSetEmployee ? { employee: { id: employeeId }, employeeId } : {})
		}));

		return await super.createMany(enriched);
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
		const hasTenantColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId');
		await this.assertNotForeignRow(entity, tenantId);

		return await super.save({
			...entity,
			...(hasTenantColumn ? { tenant: { id: tenantId }, tenantId } : {})
		});
	}

	/**
	 * Saves a given entity without automatic tenantId enrichment.
	 * This is the same as CrudService.save() and is useful for operations
	 * where the entity might belong to a different tenant.
	 *
	 * @param entity The partial entity data.
	 * @returns The saved entity.
	 */
	protected async saveWithoutEnrichment(entity: IPartialEntity<T>): Promise<T> {
		return await super.save(entity);
	}

	/**
	 * Saves multiple entities in a single bulk operation with tenant scoping.
	 * Enriches all entities with tenantId (same logic as save()).
	 * More efficient than calling save() in a loop.
	 *
	 * NOTE: Any tenant or tenantId properties on provided entities will be OVERWRITTEN with
	 * RequestContext.currentTenantId() (consistent with save() behavior). Callers passing
	 * per-entity tenant values should be aware they will be replaced to prevent silent
	 * data loss and ensure correct scoping. (Reference: related usage in
	 * bulkCreateTenantsStatus/status.service where this caused issues).
	 *
	 * @param entities The array of partial entity data.
	 * @returns The array of saved entities.
	 */
	public async saveMany(entities: IPartialEntity<T>[]): Promise<T[]> {
		const tenantId = RequestContext.currentTenantId();
		await this.assertNotForeignRows(entities, tenantId);
		const hasTenantColumn = this.typeOrmRepository.metadata?.hasColumnWithPropertyPath('tenantId');

		const enriched = entities.map((entity) => ({
			...entity,
			...(hasTenantColumn ? { tenant: { id: tenantId }, tenantId } : {})
		}));

		return await super.saveMany(enriched);
	}

	/**
	 * Saves multiple entities without automatic tenantId enrichment.
	 * This is the same as CrudService.saveMany() and is useful for bulk operations
	 * where entities might belong to different tenants.
	 *
	 * @param entities The array of partial entity data.
	 * @returns The array of saved entities.
	 */
	protected async saveManyWithoutEnrichment(entities: IPartialEntity<T>[]): Promise<T[]> {
		return await super.saveMany(entities);
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
	 * @param criteria - A string ID or a set of conditions to identify which record to delete.
	 * @param options - Additional options for querying, such as extra conditions or query parameters.
	 * @returns {Promise<DeleteResult>} - The result of the delete operation.
	 */
	public async delete(criteria: string | FindOptionsWhere<T>, options?: LegacyFindOneOptions<T>): Promise<DeleteResult> {
		try {
			// Merge additional where conditions from options into criteria if needed
			let where: FindOptionsWhere<T> =
				typeof criteria === 'string' ? ({ id: criteria } as FindOptionsWhere<T>) : { ...criteria };

			if (options?.where) {
				where = { ...where, ...options.where };
			}

			// The caller's criteria must select rows on its own BEFORE tenant scoping is merged in:
			// `delete({ employeeId: undefined })` would otherwise pass CrudService's guard on the strength
			// of the injected tenantId alone and delete every row of the tenant.
			assertCriteriaHasPredicate(where, 'delete');

			const user = RequestContext.currentUser();

			// Proceed with the delete operation using the merged criteria
			return await super.delete({
				...where,
				...this.findConditionsWithTenantByUser(user)
			});
		} catch (err) {
			// A malformed criteria (no predicate) is the caller's error, not a missing record.
			if (err instanceof BadRequestException) {
				throw err;
			}
			console.error('Error during delete operation:', err);
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/**
	 * Deletes multiple records by their IDs with tenant scoping.
	 * Verifies records exist within the current tenant before deletion.
	 *
	 * @param ids - An array of entity IDs to delete.
	 * @returns {Promise<DeleteResult>} - Result indicating the number of affected records.
	 */
	public async deleteMany(ids: ID[]): Promise<DeleteResult> {
		if (!ids.length) {
			return { affected: 0, raw: [] } as DeleteResult;
		}

		try {
			const tenantId = RequestContext.currentTenantId();

			// Retrieve matching entities scoped to the current tenant
			const entities = await this.find({
				where: {
					id: In(ids),
					...(tenantId ? { tenantId } : {})
				} as FindOptionsWhere<T>
			});

			// Extract IDs of entities that actually belong to this tenant
			const tenantScopedIds = entities.map((entity) => entity.id);

			if (!tenantScopedIds.length) {
				return { affected: 0, raw: [] } as DeleteResult;
			}

			return await super.deleteMany(tenantScopedIds);
		} catch (err) {
			console.error('Error during deleteMany operation:', err);
			throw err;
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
		options?: LegacyFindOneOptions<T>
	): Promise<UpdateResult | T> {
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
