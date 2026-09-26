import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeLevel } from './employee-level.entity';
import { EmployeeLevelService } from './employee-level.service';

/** The members `CreateEmployeeLevelInput` declares in the schema. */
export interface ICreateEmployeeLevelInput {
	level: string;
	organizationId?: Id;
}

/** The members `UpdateEmployeeLevelInput` declares in the schema. */
export interface IUpdateEmployeeLevelInput {
	id: Id;
	level?: string;
	organizationId?: Id;
}

/**
 * The fields a level list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeLevelFilter` and
 * `EmployeeLevelSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the level row, which is why the set is what it is: the delivered list
 * read answers the row itself and joins only the relations a REST caller names in its query string —
 * which this surface never names — so each member here narrows the rows the connection was handed
 * rather than a collection a reader would have had to load. The pivot the row owns is deliberately
 * absent from both lists, for the reason the object type states.
 */
const EMPLOYEE_LEVEL_FILTERABLE = {
	id: 'ID',
	level: 'STRING',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_LEVEL_SORTABLE = [
	'id',
	'level',
	'tenantId',
	'organizationId',
	'isActive',
	'isArchived',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is the platform's own: newest first, with the identifier as the last
 * key so that two levels filed in the same millisecond still have one order between them, which is what
 * makes a cursor walk over them total.
 */
const EMPLOYEE_LEVEL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The employee level over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `EmployeeLevelService` method the `/api/employee-level`
 * routes call.
 *
 * **The guard is the controller's guard, and no permission is stated anywhere — not even on a field.**
 * The delivered controller carries `TenantPermissionGuard` on the class and no `@Permissions` at all:
 * not on the two routes it declares and not on the seven it inherits from the CRUD base. Every one of
 * its routes is therefore tenant-guarded and otherwise unpermissioned, and a field that demanded a
 * permission would refuse a caller the REST route serves — the asymmetry the two-protocol rule
 * forbids. Tightening the resource is a change to make in both places at once, and it is not this
 * delivery's to make.
 *
 * **The write routes are not the same shape, and each field keeps its own.** `POST /` files a level,
 * while `PUT /:id` hands the service `create({ ...entity, id })` — an upsert, because the service's
 * create saves the row it is given and loads the existing one first when the identifier is one that
 * already exists. The two fields therefore reach the same method with the two payloads their own routes
 * build, and the edit answers the row the call answers rather than a statement about the write.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmployeeLevel')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EmployeeLevelResolver {
	constructor(private readonly employeeLevelService: EmployeeLevelService) {}

	/**
	 * The levels of the caller's tenant, newest first.
	 */
	@Query('employeeLevels')
	async employeeLevels(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<EmployeeLevel>> {
		// The delivered list route binds `data` out of its query string and hands the service
		// `{ where: { ...findInput }, relations }` — the route's own narrowing and the relations its
		// caller names. This surface has no query string to bind and names no relation: the connection
		// protocol states the narrowing in `filter`, which is applied to the rows the service returns, so
		// the read runs with the route's own defaults — no criterion and no joined collection. The tenant
		// is applied to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<EmployeeLevel> = await this.employeeLevelService.findAll({ where: {}, ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<EmployeeLevel>({
			rows: items ?? [],
			filterable: EMPLOYEE_LEVEL_FILTERABLE,
			sortable: EMPLOYEE_LEVEL_SORTABLE,
			defaultSort: EMPLOYEE_LEVEL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One level of the caller's tenant.
	 *
	 * A level that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('employeeLevel')
	async employeeLevel(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeLevel | null> {
		try {
			return await this.employeeLevelService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many levels the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('employeeLevelCount')
	async employeeLevelCount(): Promise<number> {
		return await this.employeeLevelService.countBy();
	}

	/**
	 * Files a level.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states the label and the organization it belongs to
	 * and never which tenant it is written into.
	 */
	@Mutation('createEmployeeLevel')
	async createEmployeeLevel(@Args('input') input: ICreateEmployeeLevelInput): Promise<EmployeeLevel> {
		return await this.employeeLevelService.create(input as unknown as EmployeeLevel);
	}

	/**
	 * Changes the label of a level, or files it under another organization.
	 *
	 * The delivered route is an upsert rather than a column update: it hands the service
	 * `create({ ...entity, id })`, and the service's create loads the row the identifier names and
	 * assigns the members the body states to it. The field therefore dispatches the same call with the
	 * same payload — the identifier travels inside it, exactly as the route's path identifier does — and
	 * answers the row that call answers. A member the caller leaves out is left as it is, which is what
	 * makes this an upsert rather than a replacement of the row.
	 */
	@Mutation('updateEmployeeLevel')
	async updateEmployeeLevel(@Args('input') input: IUpdateEmployeeLevelInput): Promise<EmployeeLevel> {
		return await this.employeeLevelService.create({ ...input } as unknown as EmployeeLevel);
	}

	/**
	 * Removes a level outright.
	 *
	 * The service is the one the REST route calls, and it refuses a caller naming a row of another
	 * tenant rather than reporting a deletion that did not happen; the field answers whether the removal
	 * happened rather than the removed row, because the delivered route answers the store's delete
	 * result.
	 */
	@Mutation('deleteEmployeeLevel')
	async deleteEmployeeLevel(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeLevelService.delete(id);

		return true;
	}

	/**
	 * Withdraws a level: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteEmployeeLevel')
	async softDeleteEmployeeLevel(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeLevel> {
		return await this.employeeLevelService.softRemove(id);
	}

	/**
	 * Puts a withdrawn level back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverEmployeeLevel')
	async recoverEmployeeLevel(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeLevel> {
		return await this.employeeLevelService.softRecover(id);
	}
}
