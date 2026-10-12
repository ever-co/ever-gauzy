import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardService } from './employee-award.service';

/** The members `CreateEmployeeAwardInput` declares in the schema. */
export interface ICreateEmployeeAwardInput {
	organizationId: Id;
	employeeId: Id;
	name: string;
	year: string;
}

/** The members `UpdateEmployeeAwardInput` declares in the schema. */
export interface IUpdateEmployeeAwardInput {
	id: Id;
	organizationId: Id;
	name: string;
	year: string;
}

/**
 * The fields an award list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeAwardFilter` and
 * `EmployeeAwardSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the award row, which is why the set is what it is: the delivered list
 * read joins nothing — it hands the store a `where` and takes the rows as they come back — so each
 * member here narrows the rows the connection was handed rather than a collection a reader would have
 * had to load. `employeeId` is among them because it is a column the row carries in its own right, and
 * narrowing an award list to one person is the read the employee profile asks for.
 */
const EMPLOYEE_AWARD_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	year: 'STRING',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_AWARD_SORTABLE = [
	'id',
	'name',
	'year',
	'employeeId',
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
 * The delivered list method states no order of its own — it hands the store a `where` and leaves the
 * rows in the store's order — so this is the platform's own: newest first, with the identifier as the
 * last key so that two awards filed in the same millisecond still have one order between them, which
 * is what makes a cursor walk over them total.
 */
const EMPLOYEE_AWARD_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The employee award over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `EmployeeAwardService` method the `/api/employee-award`
 * routes call.
 *
 * **The guard chain and the permission are the controller's.** The delivered controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class, with `PUBLIC_PAGE_EDIT` and
 * `ALL_ORG_EDIT` beside them, and states neither per route — not on the four routes it declares and
 * not on the five it inherits from the CRUD base. Every field below therefore states the same pair its
 * own route resolves to, which is the controller's class-level one, and the class states it too so the
 * parity is readable from either direction: a field is never narrower or wider than the route it
 * mirrors.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmployeeAward')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
export class EmployeeAwardResolver {
	constructor(private readonly employeeAwardService: EmployeeAwardService) {}

	/**
	 * The awards of the caller's tenant, newest first.
	 */
	@Query('employeeAwards')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async employeeAwards(
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
	): Promise<GraphqlConnection<EmployeeAward>> {
		// The delivered list route binds its query string to the shared query DTO and hands the service
		// `{ where: params.where }` — the route's own narrowing and nothing else. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`. The tenant is applied to the criterion by the service, from the
		// credential rather than from the caller.
		const { items }: IPagination<EmployeeAward> = await this.employeeAwardService.findAll({
			...(withDeleted ? { withDeleted: true } : {}),
			where: undefined
		});

		return buildConnection<EmployeeAward>({
			rows: items ?? [],
			filterable: EMPLOYEE_AWARD_FILTERABLE,
			sortable: EMPLOYEE_AWARD_SORTABLE,
			defaultSort: EMPLOYEE_AWARD_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One award of the caller's tenant.
	 *
	 * An award that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('employeeAward')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async employeeAward(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAward | null> {
		try {
			return await this.employeeAwardService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many awards the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('employeeAwardCount')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async employeeAwardCount(): Promise<number> {
		return await this.employeeAwardService.countBy();
	}

	/**
	 * Files an award.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states which organization and which employee the
	 * award is filed under, and never which tenant it is written into.
	 */
	@Mutation('createEmployeeAward')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async createEmployeeAward(@Args('input') input: ICreateEmployeeAwardInput): Promise<EmployeeAward> {
		return await this.employeeAwardService.create(input as unknown as EmployeeAward);
	}

	/**
	 * Changes the stated facts of an award.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries only what changes. The service is the one the
	 * REST route calls, and it reads the row before it writes, so an award of another tenant, or one
	 * that is not there, is answered with the miss rather than with a write under an identifier the
	 * caller does not own.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateEmployeeAward` may return.
	 *
	 * The employee is not a member of the payload, and that is the delivered body's own shape rather
	 * than an omission here: the update DTO carries no employee member, and the route's validation pipe
	 * strips what the DTO does not declare, so an award's employee is fixed when it is filed.
	 */
	@Mutation('updateEmployeeAward')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async updateEmployeeAward(@Args('input') input: IUpdateEmployeeAwardInput): Promise<EmployeeAward> {
		const { id, ...values } = input;

		await this.employeeAwardService.update(id, values as unknown as QueryDeepPartialEntity<EmployeeAward>);

		return await this.employeeAwardService.findOneByIdString(id);
	}

	/**
	 * Removes an award outright.
	 *
	 * The service is the one the REST route calls, and it refuses a caller naming a row of another
	 * tenant rather than reporting a deletion that did not happen; the field answers whether the removal
	 * happened rather than the removed row, because the delivered route answers the store's delete
	 * result.
	 */
	@Mutation('deleteEmployeeAward')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async deleteEmployeeAward(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeAwardService.delete(id);

		return true;
	}

	/**
	 * Withdraws an award: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteEmployeeAward')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async softDeleteEmployeeAward(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAward> {
		return await this.employeeAwardService.softRemove(id);
	}

	/**
	 * Puts a withdrawn award back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverEmployeeAward')
	@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	async recoverEmployeeAward(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAward> {
		return await this.employeeAwardService.softRecover(id);
	}
}
