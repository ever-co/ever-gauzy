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
import { assertGraphNotForeign } from './nested-graph-ownership.helper';
import {
	IMikroOrmScopeColumn,
	readMikroOrmScopeColumn,
	resolveMikroOrmScopeColumn
} from './mikro-orm-scope-column.helper';
import { ICrudService, IPartialEntity } from './icrud.service';
import { ITryRequest } from './try-request';

/** The columns this service scopes a statement by. */
type ScopeColumn = 'tenantId' | 'employeeId';

/** The relation each scope column is the foreign key of, which the scoping names beside the column. */
const SCOPE_RELATION: Record<ScopeColumn, string> = { tenantId: 'tenant', employeeId: 'employee' };

/**
 * This abstract class adds tenantId to all query filters if a user is available in the current RequestContext
 * If a user is not available in RequestContext, then it behaves exactly the same as CrudService
 */
export abstract class TenantAwareCrudService<T extends TenantBaseEntity>
	extends CrudService<T>
	implements ICrudService<T>
{
	private static skipEmployeeFilterSequence = 0;

	/** The sequence keeps the key unique even when two services share a runtime class name. */
	private readonly skipEmployeeFilterKey = `skipEmployeeFilter:${this.constructor.name}:${++TenantAwareCrudService.skipEmployeeFilterSequence}`;

	/** How MikroORM maps each scope column of this entity, read once: metadata does not change after discovery. */
	private readonly mikroOrmScopeColumns = new Map<ScopeColumn, IMikroOrmScopeColumn | null>();

	constructor(typeOrmRepository: Repository<T>, mikroOrmRepository: MikroOrmBaseEntityRepository<T>) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	/**
	 * Whether the entity has the given scope column, read from the metadata of the ORM that runs the statement.
	 *
	 * **Every tenant condition this service adds hangs on this answer**, and it used to be asked of TypeORM
	 * whichever ORM was running. Under `DB_ORM=mikro-orm` TypeORM then held only a skeleton of each entity —
	 * `MultiORMColumn` and the relation decorators registered with the active ORM alone — so it answered "no
	 * tenant column" for every entity, and no read, update, delete or soft-delete on that ORM was scoped to
	 * the caller's tenant, nor to the caller's employee, and nothing written was stamped with either. TypeORM's
	 * mapping has been complete under either ORM since d739d81b25, but the statement is MikroORM's, so on
	 * MikroORM the answer comes from MikroORM's own metadata ({@link resolveMikroOrmScopeColumn}).
	 *
	 * The TypeORM answer is the expression this service has always evaluated, unchanged.
	 *
	 * @param column The scope column.
	 * @returns Whether statements against this entity can be scoped by it.
	 */
	protected hasScopeColumn(column: ScopeColumn): boolean {
		if (this.readsMikroOrmMapping()) {
			return !!this.mikroOrmScopeColumn(column);
		}
		return this.typeOrmRepository.metadata?.hasColumnWithPropertyPath(column);
	}

	/**
	 * Whether this service's statements are scoped by the MikroORM mapping: MikroORM runs them, and the
	 * repository the service was given is one MikroORM can describe.
	 *
	 * Every MikroORM repository the platform injects is one, so under `DB_ORM=mikro-orm` this holds for every
	 * service there is. What it leaves out is a stand-in that is not a MikroORM repository at all — the
	 * scripted doubles unit tests hand the MikroORM branch, which state the entity's columns through the
	 * TypeORM double instead — and those keep the answer this service has always given them.
	 *
	 * @returns True when the MikroORM mapping decides the scoping.
	 */
	private readsMikroOrmMapping(): boolean {
		return (
			this.ormType === MultiORMEnum.MikroORM &&
			typeof (this.mikroOrmRepository as { getEntityManager?: unknown })?.getEntityManager === 'function'
		);
	}

	/**
	 * The members that scope a statement, or stamp a write, with one value of a scope column.
	 *
	 * TypeORM is handed the shape it has always been handed: the relation by its id, and the column. MikroORM
	 * is handed the column — which it filters on even where the platform maps it as the `persist: false`
	 * mirror of the relation — and the relation only when the mapping has one, since a `where` naming a
	 * relation the entity does not have is refused.
	 *
	 * @param column The scope column.
	 * @param value The caller's tenant or employee.
	 * @returns The members to merge into a `where`, or into a payload.
	 */
	private scopedBy(column: ScopeColumn, value: ID): Record<string, unknown> {
		if (this.readsMikroOrmMapping()) {
			const relation = this.mikroOrmScopeColumn(column)?.relation;
			return { ...(relation ? { [relation]: { id: value } } : {}), [column]: value };
		}
		return { [SCOPE_RELATION[column]]: { id: value }, [column]: value };
	}

	/**
	 * A payload for `save()` / `saveMany()`, stamped with the caller's value of a scope column.
	 *
	 * TypeORM's save is handed the members {@link scopedBy} gives, as it always was. MikroORM's is an
	 * `upsert`, which maps a relation onto its join column only when the relation is given by its primary
	 * key — a `{ id }` object is written as a column named after the relation, which does not exist — and
	 * which writes a relation and its `persist: false` mirror as two assignments of the same column. The
	 * payload therefore carries exactly one of them: the relation, by primary key, where the mapping has one,
	 * with any value the caller sent for the mirror removed so it can neither collide with the stamp nor
	 * contradict it; and the column itself where the mapping has no relation.
	 *
	 * @param entity The caller's payload.
	 * @param column The scope column.
	 * @param value The caller's tenant.
	 * @returns A new payload carrying the stamp.
	 */
	private stampedForSave(entity: IPartialEntity<T>, column: ScopeColumn, value: ID): IPartialEntity<T> {
		if (!this.readsMikroOrmMapping()) {
			return { ...entity, ...this.scopedBy(column, value) } as IPartialEntity<T>;
		}

		const relation = this.mikroOrmScopeColumn(column)?.relation;
		if (!relation) {
			return { ...entity, [column]: value } as IPartialEntity<T>;
		}

		const payload = { ...entity } as Record<string, unknown>;
		delete payload[column];
		return { ...payload, [relation]: value } as IPartialEntity<T>;
	}

	/**
	 * The tenant column as the MikroORM branch of the foreign-row guards loads and reads it: through the
	 * mapping where it can be read ({@link readsMikroOrmMapping}), and by name, as it always was, where not.
	 */
	private mikroOrmTenantColumnToLoad(): IMikroOrmScopeColumn {
		return this.readsMikroOrmMapping()
			? this.mikroOrmScopeColumn('tenantId')
			: { property: 'tenantId', hydratedBy: 'tenantId' };
	}

	/**
	 * How MikroORM maps a scope column of this entity.
	 *
	 * @param column The scope column.
	 * @returns The mapping, or `null` when the entity has no such column.
	 */
	private mikroOrmScopeColumn(column: ScopeColumn): IMikroOrmScopeColumn | null {
		if (!this.mikroOrmScopeColumns.has(column)) {
			const repository = this.mikroOrmRepository;
			const meta = repository.getEntityManager().getMetadata(repository.getEntityName());
			this.mikroOrmScopeColumns.set(column, resolveMikroOrmScopeColumn(meta, column));
		}
		return this.mikroOrmScopeColumns.get(column);
	}

	/**
	 * Reads how many bypass blocks are currently open for this service.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions.
	 */
	private getSkipEmployeeFilterDepth(): number {
		try {
			const context = RequestContext['clsService'];
			return context?.get(this.skipEmployeeFilterKey) ?? 0;
		} catch {
			return 0;
		}
	}

	/**
	 * Stores how many bypass blocks are currently open for this service.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions.
	 */
	private setSkipEmployeeFilterDepth(depth: number): void {
		try {
			const context = RequestContext['clsService'];
			context?.set(this.skipEmployeeFilterKey, depth);
		} catch {
			// Silently fail if context is not available
		}
	}

	private getSkipEmployeeFilter(): boolean {
		return this.getSkipEmployeeFilterDepth() > 0;
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

		const hasEmployeeColumn = this.hasScopeColumn('employeeId');
		const canChangeEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Restrict to current employee only
		if (isNotEmpty(employeeId) && hasEmployeeColumn && !canChangeEmployee) {
			return this.scopedBy('employeeId', employeeId) as unknown as FindOptionsWhere<T>;
		}

		// A caller who may not act for other employees, but has no employee record of their own.
		if (!isNotEmpty(employeeId) && hasEmployeeColumn && !canChangeEmployee) {
			return this.findConditionsWithoutOwnEmployee();
		}

		return {} as FindOptionsWhere<T>;
	}

	/**
	 * Conditions for a caller who lacks CHANGE_SELECTED_EMPLOYEE and has no employee record, on an
	 * entity with an `employeeId` column.
	 *
	 * The default keeps the historical tenant-wide scope. A service whose rows are strictly personal
	 * overrides this with {@link neverMatchingEmployeeCondition}.
	 */
	protected findConditionsWithoutOwnEmployee(): FindOptionsWhere<T> {
		return {} as FindOptionsWhere<T>;
	}

	/**
	 * A condition that matches no row (`employeeId IN ()` renders as `0=1`).
	 */
	protected neverMatchingEmployeeCondition(): FindOptionsWhere<T> {
		return { employeeId: In([]) } as unknown as FindOptionsWhere<T>;
	}

	/**
	 * Executes a callback without automatic employeeId filtering.
	 * This is useful when you need to implement custom access control logic.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions between concurrent requests.
	 *
	 * The bypass applies to this service only, and is reference counted.
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
		this.setSkipEmployeeFilterDepth(this.getSkipEmployeeFilterDepth() + 1);
		try {
			return await callback();
		} finally {
			this.setSkipEmployeeFilterDepth(Math.max(0, this.getSkipEmployeeFilterDepth() - 1));
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
			...(this.hasScopeColumn('tenantId') ? this.scopedBy('tenantId', user.tenantId) : {}),
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
	 * On MikroORM the stored tenant is loaded through whatever hydrates it
	 * ({@link IMikroOrmScopeColumn.hydratedBy}): the platform maps `tenantId` as the `persist: false` mirror of
	 * the `tenant` relation, and a load that names the mirror in `fields` leaves it unset — which read every
	 * row, the caller's own included, as another tenant's.
	 *
	 * @param entity - The payload about to be persisted.
	 * @param tenantId - The caller's tenant.
	 */
	protected async assertNotForeignRow(entity: IPartialEntity<T>, tenantId: ID | null): Promise<void> {
		const id = (entity as any)?.id;
		if (!id || !tenantId || !this.hasScopeColumn('tenantId')) {
			return;
		}
		let existing: unknown;
		let existingTenantId: ID | null | undefined;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const tenantColumn = this.mikroOrmTenantColumnToLoad();
				// `filters: false` matters: MikroORM applies the soft-delete filter by default, so a
				// foreign row that was soft-deleted would be invisible here — the guard would pass and
				// the upsert would claim it. The TypeORM branch uses `withDeleted: true` for the same
				// reason.
				existing = await this.mikroOrmRepository.findOne({ id } as any, {
					fields: ['id', tenantColumn.hydratedBy] as any,
					filters: false
				});
				existingTenantId = readMikroOrmScopeColumn(existing, tenantColumn) as ID | null | undefined;
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
		if (!ids.length || !tenantId || !this.hasScopeColumn('tenantId')) {
			return;
		}
		let existing: any[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// Loaded through what hydrates the stored tenant, for the reason assertNotForeignRow gives, and
				// read into the shape the comparison below reads.
				const tenantColumn = this.mikroOrmTenantColumnToLoad();
				const rows = await this.mikroOrmRepository.find({ id: { $in: ids } } as any, {
					fields: ['id', tenantColumn.hydratedBy] as any,
					filters: false
				});
				existing = rows.map((row) => ({ tenantId: readMikroOrmScopeColumn(row, tenantColumn) }));
				break;
			}
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
	 * Extends the root-id check to the nested objects and ids of the payload (cascaded relations,
	 * re-parented one-to-many children, owner / many-to-many links). See {@link assertGraphNotForeign}.
	 *
	 * The lookups go through TypeORM for both ORMs: both are initialised on the same database, and the
	 * check only reads. For MikroORM the same payload shape reaches `assign()` / `em.create()`, which
	 * resolve nested objects by primary key as well.
	 *
	 * @param entities - The payloads about to be persisted.
	 * @param tenantId - The caller's tenant.
	 */
	protected async assertNestedGraphNotForeign(entities: IPartialEntity<T>[], tenantId: ID | null): Promise<void> {
		await assertGraphNotForeign(
			this.typeOrmRepository.manager,
			this.typeOrmRepository.metadata,
			entities as unknown[],
			tenantId
		);
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
		await this.assertNestedGraphNotForeign([entity], tenantId);

		const hasTenantColumn = this.hasScopeColumn('tenantId');
		const hasEmployeeColumn = this.hasScopeColumn('employeeId');

		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		return await super.create({
			...entity,
			...(hasTenantColumn ? this.scopedBy('tenantId', tenantId) : {}),
			/**
			 * If employee has login & create data for self
			 */
			...(isNotEmpty(employeeId) && !hasPermission && hasEmployeeColumn
				? this.scopedBy('employeeId', employeeId)
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
		await this.assertNestedGraphNotForeign(entities, tenantId);
		const employeeId = RequestContext.currentEmployeeId();

		const hasTenantColumn = this.hasScopeColumn('tenantId');
		const hasEmployeeColumn = this.hasScopeColumn('employeeId');
		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		const shouldSetEmployee = isNotEmpty(employeeId) && !hasPermission && hasEmployeeColumn;

		const enriched = entities.map((entity) => ({
			...entity,
			...(hasTenantColumn ? this.scopedBy('tenantId', tenantId) : {}),
			...(shouldSetEmployee ? this.scopedBy('employeeId', employeeId) : {})
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
		const hasTenantColumn = this.hasScopeColumn('tenantId');
		await this.assertNotForeignRow(entity, tenantId);
		await this.assertNestedGraphNotForeign([entity], tenantId);

		return await super.save(hasTenantColumn ? this.stampedForSave(entity, 'tenantId', tenantId) : { ...entity });
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
		await this.assertNestedGraphNotForeign(entities, tenantId);
		const hasTenantColumn = this.hasScopeColumn('tenantId');

		const enriched = entities.map((entity) =>
			hasTenantColumn ? this.stampedForSave(entity, 'tenantId', tenantId) : { ...entity }
		);

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
	 * **Two things this does beyond the base update, and both are about which rows the statement may
	 * touch.**
	 *
	 * The tenant and organization conditions are merged into the criteria the `UPDATE` runs with, so the
	 * scoping is the statement's own rather than a pre-read's. The read below is still made — it is what
	 * answers a caller with the platform's refusal instead of a silent no-op — but a row another tenant
	 * owns is now excluded by the write itself, which is the stronger of the two guarantees and the one
	 * that survives a caller assembling its criteria by hand. Only the scoping a statement can express
	 * travels: see {@link scalarConditions}.
	 *
	 * **A criterion that names a `version` is a precondition rather than a locator**, so the pre-read is
	 * skipped for it. That column is evaluated by the `UPDATE` — which is what makes a conditional write
	 * one statement instead of two — and a row that does not match it has to be reported as the conflict
	 * it is. Reading first would answer "not found" for a record that exists and has merely moved on,
	 * which sends the caller down the deleted-record path instead of the re-read-and-reapply path, and
	 * it would do so before the affected-row count the concurrency kernel's error contract is built on
	 * could be seen at all. The tenant conditions are still merged in, because the merge above is what
	 * scopes the write.
	 *
	 * @param id A record id, or the conditions the record must satisfy.
	 * @param partialEntity The columns to write.
	 * @returns The update result, or the updated record, whichever the ORM answers.
	 */
	public async update(
		id: string | FindOptionsWhere<T>,
		partialEntity: QueryDeepPartialEntity<T>
	): Promise<T | UpdateResult> {
		const user = RequestContext.currentUser();
		// A write with no caller in context — a seeder, a job, the sign-in path stamping a last-login
		// time — has no tenant to be scoped by, and the criteria it states are the criteria the statement
		// runs with. Reading the tenant off a user that is not there would fail the write instead.
		const scoped = user ? this.scalarConditions(this.findConditionsWithTenantByUser(user)) : {};

		if (typeof id === 'string') {
			await this.findOneByIdString(id);

			return await super.update({ ...scoped, id } as FindOptionsWhere<T>, partialEntity);
		}

		if (typeof id === 'object' && id !== null) {
			const criteria = id as FindOptionsWhere<T>;

			if (!('version' in criteria)) {
				await this.findOneByWhereOptions(criteria);
			}

			return await super.update({ ...criteria, ...scoped }, partialEntity);
		}

		return await super.update(id, partialEntity);
	}

	/**
	 * The scoping conditions a statement can carry.
	 *
	 * A `where` for a read may name a relation — the tenant, the employee — and the read joins to
	 * resolve it. An `UPDATE` addresses columns, so a relation condition is not something it can express;
	 * handing one to it produces invalid SQL rather than a narrower write. Only the scalar members are
	 * kept, and nothing is lost by that here: the two relations this platform scopes by are reached
	 * through foreign-key columns (`tenantId`, `employeeId`) that travel beside them in the same object,
	 * and those columns are exactly what the statement can be scoped by.
	 *
	 * @param conditions The conditions the read would use.
	 * @returns The subset a write can be predicated on.
	 */
	private scalarConditions(conditions: FindOptionsWhere<T>): FindOptionsWhere<T> {
		const scalars: Record<string, unknown> = {};

		for (const [column, value] of Object.entries(conditions ?? {})) {
			if (value !== null && typeof value === 'object') {
				continue;
			}

			scalars[column] = value;
		}

		return scalars as FindOptionsWhere<T>;
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
	 * On MikroORM the row retired is the one the tenant-scoped read found, named by its id. That branch of
	 * the base class retires a single row, which it looks up again by the criteria alone — so for criteria
	 * that are not an id, the second lookup was free to settle on another tenant's row with the same values.
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

			if (this.ormType === MultiORMEnum.MikroORM) {
				return await super.softDelete(typeof criteria === 'object' ? record.id : criteria);
			}

			// **The statement carries the caller's scope, not only the read before it.** The pre-read above
			// is tenant-scoped, but `criteria` used to reach TypeORM's `softDelete` raw, so an object
			// criteria retired every matching row of every tenant (`UPDATE … SET deletedAt … WHERE name = ?`)
			// once one row of the caller's own had been found. The same scalar scope `update` merges is
			// merged here: a criteria still retires every row it names, but only the caller's, and a
			// by-id call is predicated on the tenant as well. A call with no caller in context — a seeder, a
			// job — has no tenant to add, as in `update`.
			const user = RequestContext.currentUser();
			const scoped = user ? this.scalarConditions(this.findConditionsWithTenantByUser(user)) : {};

			if (typeof criteria === 'object' && criteria !== null) {
				return await super.softDelete({ ...(criteria as FindOptionsWhere<T>), ...scoped });
			}

			return await super.softDelete(
				Object.keys(scoped).length ? ({ ...scoped, id: criteria } as FindOptionsWhere<T>) : criteria
			);
		} catch (err) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`The record was not found or could not be soft-deleted`, err);
		}
	}
}
