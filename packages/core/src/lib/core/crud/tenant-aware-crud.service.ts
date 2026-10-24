import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
	And,
	DeleteResult,
	Equal,
	FindOperator,
	FindOptionsWhere,
	In,
	IsNull,
	Or,
	Raw,
	Repository,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IPagination, IUser, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty, parseToBoolean } from '@gauzy/utils';
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
import {
	currentOrganizationBoundary,
	IOrganizationBoundary,
	isWithinOrganizationBoundary
} from './organization-boundary';
import { ITryRequest } from './try-request';

/** The columns this service scopes a statement by. */
type ScopeColumn = 'tenantId' | 'employeeId' | 'organizationId';

/** The relation each scope column is the foreign key of, which the scoping names beside the column. */
const SCOPE_RELATION: Record<ScopeColumn, string> = {
	tenantId: 'tenant',
	employeeId: 'employee',
	organizationId: 'organization'
};

/** The read a scope condition is built for, as far as the condition depends on it. */
interface IScopedRead {
	/** Whether the read returns soft-deleted rows too: the `withDeleted` it runs with. */
	withDeleted: boolean;
}

/** A read of live rows only — every read that cannot state `withDeleted`. */
const LIVE_READ: Readonly<IScopedRead> = Object.freeze({ withDeleted: false });

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

	/** The key of {@link withoutOrganizationBoundary}'s bypass, unique per service for the reason above. */
	private readonly skipOrganizationBoundaryKey = `skipOrganizationBoundary:${this.constructor.name}:${TenantAwareCrudService.skipEmployeeFilterSequence}`;

	/** How MikroORM maps each scope column of this entity, read once: metadata does not change after discovery. */
	private readonly mikroOrmScopeColumns = new Map<ScopeColumn, IMikroOrmScopeColumn | null>();

	/** The predicate {@link readScopedBy} puts on each scope relation, per `withDeleted`, built once from TypeORM's metadata. */
	private readonly readScopePredicates = new Map<string, FindOperator<unknown> | null>();

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
	 * These are the members every write is stamped and scoped with. A TypeORM read is scoped with
	 * {@link readScopedBy}'s instead, which name the relation without making TypeORM join it.
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
	 * The members that scope a READ with one value of a scope column: the rows {@link scopedBy}'s members select,
	 * without the join they cost.
	 *
	 * **Why not the relation by its id.** TypeORM resolves `{ tenant: { id } }` in a `where` by LEFT JOINing the
	 * relation — `"tenant"."deletedAt" IS NULL` in the ON clause, the tenant and the employee being soft-deletable —
	 * only to compare the id that is already compared on the foreign-key column beside it. One join is all it takes
	 * for TypeORM to page in two statements: with a `take` or a `skip` (and every `findOne` / `findOneBy` is a
	 * `take: 1`), it first selects `DISTINCT` ids over the joined query under the limit, and then the rows `IN`
	 * those ids. Every scoped lookup by id cost two round trips instead of one, and every scoped page three
	 * statements instead of two, its count a `COUNT(DISTINCT …)` over the join (measured statement by statement in
	 * `tenant-aware-crud.service.read-scope.spec.ts`).
	 *
	 * **What it keeps.** The join did more than repeat the column: it hid the rows whose tenant (or employee) is
	 * soft-deleted, and that must hold. TypeORM renders a find operator on a many-to-one relation as a predicate on
	 * its foreign key, so the relation is handed a {@link Raw} `EXISTS` on the referenced row instead — a live one,
	 * unless the read states `withDeleted`, exactly as the join's ON clause was — and the statement keeps a single
	 * table in its FROM clause. The table, its key and its delete-date column come from TypeORM's metadata and are
	 * quoted by the driver, so the predicate is the same standard SQL on PostgreSQL, MySQL and SQLite.
	 *
	 * **Where the joined shape stays.** The predicate is TypeORM's alone: MikroORM, and the doubles that stand in
	 * for it, are handed {@link scopedBy}'s members unchanged. TypeORM is handed them too for a value that is not
	 * an id — a caller without a tenant, whose `undefined` the connection ignores and whose `null` it reads as
	 * `IS NULL`, both of which the predicate would answer differently — and for a relation the metadata does not
	 * describe as a to-one on a single foreign key, a stand-in repository without metadata included. Writes never
	 * use it: rows created and saved are stamped, and updates and deletes scoped, with {@link scopedBy}'s members.
	 *
	 * @param column The scope column.
	 * @param value The caller's tenant or employee.
	 * @param read The read the members scope.
	 * @returns The members to merge into the read's `where`.
	 */
	private readScopedBy(column: ScopeColumn, value: ID, read: IScopedRead): Record<string, unknown> {
		const predicate =
			this.ormType === MultiORMEnum.TypeORM && isNotEmpty(value)
				? this.relationExistsPredicate(column, read.withDeleted)
				: null;

		if (!predicate) {
			return this.scopedBy(column, value);
		}
		return { [SCOPE_RELATION[column]]: predicate, [column]: value };
	}

	/**
	 * The predicate {@link readScopedBy} puts on a scope relation: the row its foreign key names exists and, unless
	 * the read returns soft-deleted rows too, is not soft-deleted. TypeORM substitutes the foreign-key column for
	 * the alias the operator is handed, so the statement reads, on PostgreSQL:
	 *
	 * `EXISTS (SELECT 1 FROM "tenant" "tenant_scope" WHERE "tenant_scope"."id" = "Row"."tenantId" AND "tenant_scope"."deletedAt" IS NULL)`
	 *
	 * Built once per column and `withDeleted`: the metadata does not change once the data source is initialised.
	 *
	 * @param column The scope column.
	 * @param withDeleted Whether the read returns soft-deleted rows too.
	 * @returns The predicate, or `null` where the metadata cannot state one.
	 */
	private relationExistsPredicate(column: ScopeColumn, withDeleted: boolean): FindOperator<unknown> | null {
		const key = `${column}:${withDeleted ? 'all' : 'live'}`;
		if (!this.readScopePredicates.has(key)) {
			this.readScopePredicates.set(key, this.buildRelationExistsPredicate(column, withDeleted));
		}
		return this.readScopePredicates.get(key);
	}

	/**
	 * Builds the predicate {@link relationExistsPredicate} answers with, from the TypeORM metadata of the relation.
	 *
	 * @param column The scope column.
	 * @param withDeleted Whether the read returns soft-deleted rows too.
	 * @returns The predicate, or `null` where the metadata cannot state one.
	 */
	private buildRelationExistsPredicate(column: ScopeColumn, withDeleted: boolean): FindOperator<unknown> | null {
		const metadata = this.typeOrmRepository?.metadata;
		const driver = metadata?.dataSource?.driver;
		if (typeof metadata?.findRelationWithPropertyPath !== 'function' || typeof driver?.escape !== 'function') {
			return null;
		}

		// Only a to-one relation that owns its one foreign-key column is rendered by TypeORM as a predicate on it.
		const relation = metadata.findRelationWithPropertyPath(SCOPE_RELATION[column]);
		const isOwnedToOne = !!relation && (relation.isManyToOne || relation.isOneToOneOwner);
		if (!isOwnedToOne || relation.joinColumns.length !== 1) {
			return null;
		}

		const target = relation.inverseEntityMetadata;
		const referenced = relation.joinColumns[0].referencedColumn;
		if (!target?.tablePath || !referenced) {
			return null;
		}

		const quote = (identifier: string) => driver.escape(identifier);
		// As TypeORM quotes a table path: each part, and the empty part SQL Server's `database..table` leaves alone.
		const table = target.tablePath
			.split('.')
			.map((part) => (part === '' ? part : quote(part)))
			.join('.');
		const alias = quote(`${SCOPE_RELATION[column]}_scope`);
		const live =
			!withDeleted && target.deleteDateColumn
				? ` AND ${alias}.${quote(target.deleteDateColumn.databaseName)} IS NULL`
				: '';

		return Raw(
			(foreignKey: string) =>
				`EXISTS (SELECT 1 FROM ${table} ${alias} WHERE ${alias}.${quote(referenced.databaseName)} = ${foreignKey}${live})`
		);
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
	 *
	 * @param key The bypass: {@link skipEmployeeFilterKey} or {@link skipOrganizationBoundaryKey}.
	 */
	private getSkipEmployeeFilterDepth(key: string = this.skipEmployeeFilterKey): number {
		try {
			const context = RequestContext['clsService'];
			return context?.get(key) ?? 0;
		} catch {
			return 0;
		}
	}

	/**
	 * Stores how many bypass blocks are currently open for this service.
	 * Uses AsyncLocalStorage via RequestContext to avoid race conditions.
	 *
	 * @param depth The number of open blocks.
	 * @param key The bypass, as {@link getSkipEmployeeFilterDepth} reads it.
	 */
	private setSkipEmployeeFilterDepth(depth: number, key: string = this.skipEmployeeFilterKey): void {
		try {
			const context = RequestContext['clsService'];
			context?.set(key, depth);
		} catch {
			// Silently fail if context is not available
		}
	}

	private getSkipEmployeeFilter(): boolean {
		return this.getSkipEmployeeFilterDepth() > 0;
	}

	/**
	 * Whether this service keeps every caller inside their organization boundary ({@link currentOrganizationBoundary}):
	 * a tenant admin reaches every organization of the tenant, anyone else only the organization of their token.
	 *
	 * **What the boundary covers, once a service applies it.** Every read this base answers — lists, counts, pages
	 * and every single-row read, by id, by options or by conditions — and so the reads that precede an update, a
	 * withdrawal and a restore; the statements of `update`, `softDelete` and `delete` themselves; and what `create`,
	 * `createMany`, `save` and `saveMany` may write: neither a payload that names an organization outside the boundary,
	 * nor an upsert onto a stored row outside it, nor an update that moves a row out of it. A row outside the boundary
	 * is answered exactly as a row that does not exist. A row stored without an organization belongs to the tenant, so
	 * it stays inside every boundary of the tenant.
	 *
	 * On for every service whose entity has an `organizationId` column — one rule, everywhere. A service whose rows
	 * must be read across organizations by design returns `false`, and says why (`UserOrganizationService`: the
	 * memberships the organization switcher lists and the switch itself checks). A caller with no user in context (a
	 * job, a public route) and a tenant admin are never confined, nor is a call inside `runOutsideOrganizationBoundary`.
	 *
	 * @returns True when this service applies the boundary.
	 */
	protected appliesOrganizationBoundary(): boolean {
		return true;
	}

	/**
	 * The boundary this service's statements are kept inside right now.
	 *
	 * @returns The boundary, or `null` when none applies: the service does not apply one, the call runs inside
	 * {@link withoutOrganizationBoundary}, the caller is not confined, or the entity has no organization.
	 */
	protected organizationBoundary(): IOrganizationBoundary | null {
		if (
			!this.appliesOrganizationBoundary() ||
			this.getSkipEmployeeFilterDepth(this.skipOrganizationBoundaryKey) > 0
		) {
			return null;
		}
		const boundary = currentOrganizationBoundary();
		return boundary && this.hasScopeColumn('organizationId') ? boundary : null;
	}

	/**
	 * Executes a callback without the organization boundary, for a service that has checked by other means that the
	 * caller may reach the rows the callback reads or writes. Reference counted, and per service, as
	 * {@link withoutEmployeeFilter} is.
	 *
	 * @param callback The async function to execute outside the boundary.
	 * @returns The result of the callback.
	 */
	protected async withoutOrganizationBoundary<R>(callback: () => Promise<R>): Promise<R> {
		const key = this.skipOrganizationBoundaryKey;
		this.setSkipEmployeeFilterDepth(this.getSkipEmployeeFilterDepth(key) + 1, key);
		try {
			return await callback();
		} finally {
			this.setSkipEmployeeFilterDepth(Math.max(0, this.getSkipEmployeeFilterDepth(key) - 1), key);
		}
	}

	/**
	 * A `where` — or each `where` of a list — kept inside an organization boundary.
	 *
	 * The boundary is stated beside the caller's own condition on the organization, never over it: a statement that
	 * names an organization is narrowed by the boundary rather than widened to it, and one that names none is
	 * narrowed to the caller's organization and the rows stored without one.
	 *
	 * TypeORM is handed `And(<the caller's condition>, Or(Equal(<organization>), IsNull()))` on the column, which its
	 * reads, updates, deletes and soft-deletes alike render as one predicate. MikroORM is handed the same question as
	 * an `$or` in the entity-level `$and`, which the translation of the caller's criteria keeps as it is (TypeORM's
	 * `Or` has no MikroORM translation), and which it applies to the `persist: false` mirror of the relation as it does
	 * to the tenant's.
	 *
	 * @param where The conditions of the statement.
	 * @param boundary The boundary.
	 * @returns The conditions, kept inside the boundary.
	 */
	private withinOrganizationBoundary<W>(where: W, boundary: IOrganizationBoundary): W {
		if (Array.isArray(where)) {
			return where.map((condition) => this.withinOrganizationBoundary(condition, boundary)) as W;
		}

		const conditions = { ...((where ?? {}) as Record<string, unknown>) };
		const organizationId = boundary.organizationId;

		if (this.ormType === MultiORMEnum.MikroORM) {
			const allowed = isNotEmpty(organizationId)
				? [{ organizationId }, { organizationId: null }]
				: [{ organizationId: null }];
			const conjunction = conditions['$and'];
			conditions['$and'] = [
				...(conjunction === undefined ? [] : Array.isArray(conjunction) ? conjunction : [conjunction]),
				{ $or: allowed }
			];
			return conditions as W;
		}

		const allowed = isNotEmpty(organizationId) ? Or(Equal(organizationId), IsNull()) : IsNull();
		const stated = conditions['organizationId'];
		conditions['organizationId'] =
			stated === undefined
				? allowed
				: And(stated instanceof FindOperator ? stated : stated === null ? IsNull() : Equal(stated), allowed);
		return conditions as W;
	}

	/**
	 * A statement's conditions kept inside the caller's organization boundary, when this service applies one.
	 *
	 * @param where The conditions of the statement.
	 * @returns The conditions, unchanged when no boundary applies.
	 */
	private whereInsideOrganizationBoundary<W>(where: W): W {
		const boundary = this.organizationBoundary();
		return boundary ? this.withinOrganizationBoundary(where, boundary) : where;
	}

	/**
	 * Find options whose `where` is kept inside the caller's organization boundary, when this service applies one.
	 *
	 * @param options The find options a read runs with.
	 * @returns The options, unchanged when no boundary applies.
	 */
	private optionsInsideOrganizationBoundary<O extends { where?: unknown }>(options: O): O {
		const boundary = this.organizationBoundary();
		if (!boundary) {
			return options;
		}
		return { ...options, where: this.withinOrganizationBoundary(options.where ?? {}, boundary) };
	}

	/**
	 * Refuses a write that would put a row outside the caller's organization boundary: a payload that names an
	 * organization outside it, or one that carries the id of a stored row outside it (create and save are upserts by
	 * id, as {@link assertNotForeignRow} explains). Runs after the tenant guard, so a stored row it looks up is the
	 * caller's tenant's.
	 *
	 * @param entities The payloads about to be persisted.
	 * @throws ForbiddenException when one of them lies outside the boundary.
	 */
	protected async assertInsideOrganizationBoundary(entities: IPartialEntity<T>[]): Promise<void> {
		const boundary = this.organizationBoundary();
		if (!boundary) {
			return;
		}

		for (const entity of entities ?? []) {
			if (!isWithinOrganizationBoundary(this.statedOrganizationId(entity), boundary)) {
				throw new ForbiddenException('The organization is outside the caller’s reach');
			}
		}

		const ids = (entities ?? []).map((entity) => (entity as any)?.id).filter((id) => !!id);
		if (!ids.length) {
			return;
		}

		let stored: Array<ID | null | undefined>;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// Loaded through what hydrates the organization, for the reason assertNotForeignRow gives for the tenant.
				const column: IMikroOrmScopeColumn = this.readsMikroOrmMapping()
					? this.mikroOrmScopeColumn('organizationId')
					: { property: 'organizationId', hydratedBy: 'organizationId' };
				const rows = await this.mikroOrmRepository.find({ id: { $in: ids } } as any, {
					fields: ['id', column.hydratedBy] as any,
					filters: false
				});
				stored = rows.map((row) => readMikroOrmScopeColumn(row, column) as ID | null | undefined);
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const rows = await this.typeOrmRepository.find({
					where: { id: In(ids) } as FindOptionsWhere<T>,
					select: { id: true, organizationId: true } as any,
					withDeleted: true
				});
				stored = rows.map((row) => (row as any)?.organizationId);
				break;
			}
		}

		if (stored.some((organizationId) => !isWithinOrganizationBoundary(organizationId, boundary))) {
			throw new ForbiddenException('The record belongs to another organization');
		}
	}

	/**
	 * The organization a payload names: its `organizationId`, or else the id of its `organization`.
	 *
	 * @param entity The payload.
	 * @returns The organization, or `undefined` when the payload names none.
	 */
	private statedOrganizationId(entity: unknown): ID | null | undefined {
		const payload = (entity ?? {}) as Record<string, unknown>;
		if (payload['organizationId'] !== undefined) {
			return payload['organizationId'] as ID | null;
		}
		const organization = payload['organization'];
		if (organization !== null && typeof organization === 'object') {
			return (organization as { id?: ID }).id;
		}
		return organization as ID | null | undefined;
	}

	/**
	 * Builds TypeORM find conditions to restrict data
	 * to the currently logged-in employee.
	 *
	 * If the user has permission to change the selected employee
	 * or filtering is skipped, no automatic restriction is applied.
	 *
	 * @param read The read the conditions scope ({@link readScopedBy}); omitted for a write's criteria.
	 */
	private findConditionsWithEmployeeByUser(read?: IScopedRead): FindOptionsWhere<T> {
		// Skip automatic filtering if explicitly disabled
		if (this.getSkipEmployeeFilter()) {
			return {} as FindOptionsWhere<T>;
		}

		const employeeId = RequestContext.currentEmployeeId();

		const hasEmployeeColumn = this.hasScopeColumn('employeeId');
		const canChangeEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Restrict to current employee only
		if (isNotEmpty(employeeId) && hasEmployeeColumn && !canChangeEmployee) {
			const employeeScope = read
				? this.readScopedBy('employeeId', employeeId, read)
				: this.scopedBy('employeeId', employeeId);
			return employeeScope as unknown as FindOptionsWhere<T>;
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
	 * @param read - The read the conditions scope ({@link readScopedBy}); omitted for a write's criteria, which
	 * keep {@link scopedBy}'s members.
	 * @returns The find conditions based on the user's relationship with the tenant and employees.
	 */
	private findConditionsWithTenantByUser(user: IUser, read?: IScopedRead): FindOptionsWhere<T> {
		const tenantScope = () =>
			read ? this.readScopedBy('tenantId', user.tenantId, read) : this.scopedBy('tenantId', user.tenantId);

		return {
			...(this.hasScopeColumn('tenantId') ? tenantScope() : {}),
			...this.findConditionsWithEmployeeByUser(read)
		} as FindOptionsWhere<T>;
	}

	/**
	 * Define find conditions when retrieving data with tenant.
	 *
	 * @param user - The user for whom the conditions are defined.
	 * @param where - Additional find options.
	 * @param read - The read the conditions scope.
	 * @returns The find conditions based on the user's relationship with the tenant and additional options.
	 */
	private findConditionsWithTenant(
		user: IUser,
		where: FindOptionsWhere<T>[] | FindOptionsWhere<T> | undefined,
		read: IScopedRead
	): FindOptionsWhere<T>[] | FindOptionsWhere<T> {
		// An empty list of alternatives is no condition at all: TypeORM drops the WHERE clause, so `[]` returned as it
		// came read every tenant's rows (e.g. `GET /expense?data={"findInput":[]}`). It is read as no filter instead.
		if (Array.isArray(where) && where.length === 0) {
			where = undefined;
		}
		if (where && Array.isArray(where)) {
			const wheres: FindOptionsWhere<T>[] = [];
			where.forEach((options: FindOptionsWhere<T>) => {
				wheres.push({
					...options,
					...this.findConditionsWithTenantByUser(user, read)
				});
			});
			return wheres;
		}
		return (
			where
				? {
						...where,
						...this.findConditionsWithTenantByUser(user, read)
					}
				: {
						...this.findConditionsWithTenantByUser(user, read)
					}
		) as FindOptionsWhere<T>;
	}

	/**
	 * The read a find-options object describes, as far as its scope conditions depend on it: whether it states
	 * `withDeleted`, read as the boolean every read entry point of the base class reads it as.
	 *
	 * @param filter - The caller's find options.
	 * @returns The read.
	 */
	private scopedReadOf(filter?: { withDeleted?: unknown }): IScopedRead {
		return parseToBoolean(filter?.withDeleted) ? { withDeleted: true } : LIVE_READ;
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
		const read = this.scopedReadOf(filter);
		if (!filter) {
			return this.optionsInsideOrganizationBoundary({
				where: this.findConditionsWithTenantByUser(user, read)
			});
		}
		if (!filter.where) {
			return this.optionsInsideOrganizationBoundary({
				...filter,
				where: this.findConditionsWithTenantByUser(user, read)
			});
		}
		if (filter.where instanceof Object) {
			return this.optionsInsideOrganizationBoundary({
				...filter,
				where: this.findConditionsWithTenant(user, filter.where, read)
			});
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
		const read = this.scopedReadOf(filter);
		if (!filter) {
			return this.optionsInsideOrganizationBoundary({
				where: this.findConditionsWithTenantByUser(user, read)
			});
		}
		if (!filter.where) {
			return this.optionsInsideOrganizationBoundary({
				...filter,
				where: this.findConditionsWithTenantByUser(user, read)
			});
		}
		if (filter.where instanceof Object) {
			return this.optionsInsideOrganizationBoundary({
				...filter,
				where: this.findConditionsWithTenant(user, filter.where, read)
			});
		}
		return filter;
	}

	/**
	 * Define the where condition of a read given as conditions only, scoped to the current user's tenant
	 * and employee.
	 *
	 * A public route or a background job has no user in context, hence no tenant to read off it, so the
	 * stated condition is used unchanged, as {@link findOneWithTenant} does.
	 *
	 * @param options - The caller's where condition.
	 * @returns The where condition the read runs with.
	 */
	private findWhereWithTenant(options?: FindOptionsWhere<T>): FindOptionsWhere<T> {
		const user = RequestContext.currentUser();
		if (!user) {
			return options;
		}
		return this.whereInsideOrganizationBoundary({
			...options,
			...this.findConditionsWithTenantByUser(user, LIVE_READ)
		});
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
		return await super.countBy(this.findWhereWithTenant(options));
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
		return await super.findAll(this.findManyWithTenant(this.withStableOrder(filter, !!(filter?.take || filter?.skip))));
	}

	/**
	 * Finds entities that match given find options.
	 *
	 * @param filter
	 * @returns
	 */
	public async find(filter?: LegacyFindManyOptions<T>): Promise<T[]> {
		return await super.find(this.findManyWithTenant(this.withStableOrder(filter, !!(filter?.take || filter?.skip))));
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
		// paginate() always limits (10 rows when no `take` is given).
		return await super.paginate(this.findManyWithTenant(this.withStableOrder(filter, true)));
	}

	/**
	 * The order a limited TypeORM read without one of its own has always had: by primary key.
	 *
	 * Until scoped reads stopped joining the tenant (see {@link readScopedBy}), every limited scoped read had a join,
	 * so TypeORM paged it with its two-query algorithm, whose id query is `ORDER BY <primary key> ASC` when the
	 * caller states no order. Pages were therefore ordered by id, and successive pages never overlapped. Without the
	 * join TypeORM sends one plain `LIMIT` query, which PostgreSQL may answer in any order — so the primary-key order
	 * is now stated explicitly, keeping every page exactly what it was. A caller's own order is left alone, as is
	 * MikroORM (it never joined) and any read without `take`/`skip` (it was never ordered).
	 *
	 * @param filter The caller's options.
	 * @param limited Whether the read is limited (`take`/`skip`, or paginate's default page).
	 */
	private withStableOrder(filter: LegacyFindManyOptions<T> | undefined, limited: boolean): LegacyFindManyOptions<T> {
		if (!limited || this.ormType !== MultiORMEnum.TypeORM || this.readsMikroOrmMapping()) {
			return filter;
		}
		const order = (filter as { order?: unknown })?.order;
		if (order && (typeof order !== 'object' || Object.keys(order).length > 0)) {
			return filter;
		}
		const primaryColumns = this.typeOrmRepository?.metadata?.primaryColumns ?? [];
		if (primaryColumns.length === 0) {
			return filter;
		}
		return {
			...(filter ?? {}),
			order: Object.fromEntries(primaryColumns.map((column) => [column.propertyName, 'ASC']))
		} as LegacyFindManyOptions<T>;
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
		return await super.findOneOrFailByWhereOptions(this.findWhereWithTenant(options));
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
		return await super.findOneByWhereOptions(this.findWhereWithTenant(options));
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
	 * Keeps an upsert through `create()` / `createMany()` to rows the caller could update.
	 *
	 * A payload carrying the id of an existing row updates that row (TypeORM's `save()`, MikroORM's `assign()`).
	 * {@link assertNotForeignRow} keeps it in the caller's tenant; this keeps it in the caller's employee scope, which
	 * `update()` applies by reading the row through that scope first. Without it, an employee who may not act for other
	 * employees could post a colleague's row id to any CRUD `POST` route and rewrite the row — which `create()` then
	 * stamped with the caller's own employee, moving it onto their records.
	 *
	 * Ids that name no row create new rows, as before. Writes with no caller in context (seeders, jobs), and inside
	 * {@link withoutEmployeeFilter}, are not restricted.
	 *
	 * @param entities - The payloads about to be persisted.
	 * @throws ForbiddenException when a payload names an existing row outside the caller's employee scope.
	 */
	private async assertUpsertsWithinEmployeeScope(entities: IPartialEntity<T>[]): Promise<void> {
		const ids = [...new Set((entities ?? []).map((entity) => (entity as any)?.id).filter((id) => !!id))];
		if (!ids.length || !RequestContext.currentUser()) {
			return;
		}

		// The employee scope as a statement on the row's own column: `employeeId = <caller>`, or the never-matching
		// `employeeId IN ()` of a service whose rows are strictly personal. The relation members are left out.
		const employeeScope = Object.fromEntries(
			Object.entries(this.findConditionsWithEmployeeByUser() ?? {}).filter(
				([, value]) => value === null || typeof value !== 'object' || value instanceof FindOperator
			)
		);
		if (Object.keys(employeeScope).length === 0) {
			return;
		}

		// Read through TypeORM whichever ORM serves the write, as the foreign-graph check does: both are initialised
		// on the same database, and this only reads.
		const named = { id: In(ids) } as FindOptionsWhere<T>;
		const [existing, reachable] = await Promise.all([
			this.typeOrmRepository.count({ where: named, withDeleted: true }),
			this.typeOrmRepository.count({
				where: { ...employeeScope, ...named } as FindOptionsWhere<T>,
				withDeleted: true
			})
		]);
		if (reachable < existing) {
			throw new ForbiddenException('The record belongs to another employee');
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
		await this.assertUpsertsWithinEmployeeScope([entity]);
		await this.assertInsideOrganizationBoundary([entity]);

		const hasTenantColumn = this.hasScopeColumn('tenantId');
		const hasEmployeeColumn = this.hasScopeColumn('employeeId');

		const hasPermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		return await super.create({
			...entity,
			...(hasTenantColumn ? this.scopedBy('tenantId', tenantId) : {}),
			/**
			 * If employee has login & create data for self — unless the subclass deliberately creates the row
			 * for another employee inside withoutEmployeeFilter(), after checking it may do so.
			 */
			...(isNotEmpty(employeeId) && !hasPermission && hasEmployeeColumn && !this.getSkipEmployeeFilter()
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
		await this.assertUpsertsWithinEmployeeScope(entities);
		await this.assertInsideOrganizationBoundary(entities);
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
		await this.assertInsideOrganizationBoundary([entity]);

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
		await this.assertInsideOrganizationBoundary(entities);
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
		// The criteria above keep the statement on the caller's rows; the payload must not move them out:
		// a `PUT` carrying `{"tenantId": "<B>"}` re-tenanted the caller's own row (SEC-A-03).
		const patch = user ? this.withoutScopeChanges(partialEntity) : partialEntity;

		if (typeof id === 'string') {
			await this.findOneByIdString(id);

			if (this.isEmptyPatch(patch)) return this.nothingUpdated();
			// What the patch points at must be the caller's too — a foreign-key column or a relation naming another
			// tenant's row is refused, as create() and save() refuse it (SEC-D-03).
			if (user) await this.assertNestedGraphNotForeign([patch as IPartialEntity<T>], RequestContext.currentTenantId());

			return await super.update(
				this.whereInsideOrganizationBoundary({ ...scoped, id } as FindOptionsWhere<T>),
				patch
			);
		}

		if (typeof id === 'object' && id !== null) {
			const criteria = id as FindOptionsWhere<T>;

			if (!('version' in criteria)) {
				await this.findOneByWhereOptions(criteria);
			}

			if (this.isEmptyPatch(patch)) return this.nothingUpdated();
			if (user) await this.assertNestedGraphNotForeign([patch as IPartialEntity<T>], RequestContext.currentTenantId());

			return await super.update(this.whereInsideOrganizationBoundary({ ...criteria, ...scoped }), patch);
		}

		return await super.update(id, partialEntity);
	}

	/**
	 * The payload of an update without the scope columns the caller may not move.
	 *
	 * `create()` stamps the caller's tenant — and, for a caller who may not act for other employees, their
	 * employee — over whatever the payload says. An update scoped its criteria the same way but wrote the payload
	 * as given, so the tenant (and the employee) of the caller's own row was the caller's to change: a tenant
	 * setting moved into another tenant took that tenant's uploads to the caller's bucket, a bin moved into another
	 * tenant's pick paths (SEC-A-03, SEC-D-12). The tenant is never written from a payload; the employee is not for a
	 * caller the employee scope applies to. Any other member is written as before.
	 *
	 * @param partialEntity The columns the caller asked to write.
	 * @returns The same columns without the ones that would move the row out of the caller's scope.
	 */
	private withoutScopeChanges(partialEntity: QueryDeepPartialEntity<T>): QueryDeepPartialEntity<T> {
		if (!partialEntity || typeof partialEntity !== 'object' || Array.isArray(partialEntity)) {
			return partialEntity;
		}

		const { tenantId, tenant, ...rest } = partialEntity as Record<string, unknown>;
		void tenantId;
		void tenant;

		const employeeId = RequestContext.currentEmployeeId();
		const employeeScoped =
			isNotEmpty(employeeId) &&
			this.hasScopeColumn('employeeId') &&
			!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
			!this.getSkipEmployeeFilter();

		if (employeeScoped) {
			delete rest['employeeId'];
			delete rest['employee'];
		}

		// Nor is the organization, for a caller confined to theirs, unless the patch names that very organization: the
		// statement only reaches rows inside the boundary, and the payload must not move one out of it — into another
		// organization, or out of every organization, which would put it in reach of all of them.
		const boundary = this.organizationBoundary();
		if (boundary && ('organizationId' in rest || 'organization' in rest)) {
			const moved = this.statedOrganizationId(rest);
			if (!isNotEmpty(boundary.organizationId) || String(moved) !== String(boundary.organizationId)) {
				delete rest['organizationId'];
				delete rest['organization'];
			}
		}

		return rest as QueryDeepPartialEntity<T>;
	}

	/** Whether nothing is left to write once the scope columns are taken out. */
	private isEmptyPatch(patch: QueryDeepPartialEntity<T>): boolean {
		return !!patch && typeof patch === 'object' && !Array.isArray(patch) && Object.keys(patch).length === 0;
	}

	/**
	 * The answer to an update that had nothing left to write: the row is the caller's (the read above found it),
	 * and no column changed. An empty `SET` is not a statement either ORM accepts.
	 */
	private nothingUpdated(): UpdateResult {
		return { generatedMaps: [], raw: [], affected: 0 } as UpdateResult;
	}

	/**
	 * The scoping conditions a statement can carry.
	 *
	 * A `where` for a read may name a relation — the tenant, the employee — and the read resolves it, by
	 * a join or by the `EXISTS` {@link readScopedBy} puts on it. An `UPDATE` addresses columns, so a
	 * relation condition is not something it can express; handing one to it produces invalid SQL rather
	 * than a narrower write. Only the scalar members are kept — an object, a find operator included, is
	 * dropped — and nothing is lost by that here: the two relations this platform scopes by are reached
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

			// Proceed with the delete operation using the merged criteria — a write's, without a read passed:
			// the DELETE is scoped by scopedBy()'s members, never by readScopedBy()'s EXISTS. A row outside the caller's
			// organization boundary is not deleted, and is answered as a row that does not exist.
			return await super.delete(
				this.whereInsideOrganizationBoundary({
					...where,
					...this.findConditionsWithTenantByUser(user)
				})
			);
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
				return await super.softDelete(
					this.whereInsideOrganizationBoundary({ ...(criteria as FindOptionsWhere<T>), ...scoped })
				);
			}

			return await super.softDelete(
				Object.keys(scoped).length
					? this.whereInsideOrganizationBoundary({ ...scoped, id: criteria } as FindOptionsWhere<T>)
					: criteria
			);
		} catch (err) {
			// If any error occurs, rethrow it as a NotFoundException with additional context.
			throw new NotFoundException(`The record was not found or could not be soft-deleted`, err);
		}
	}
}
