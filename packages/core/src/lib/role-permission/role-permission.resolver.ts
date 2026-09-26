import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, IRolePermission, IRolePermissions, PermissionsEnum } from '@gauzy/contracts';
import { FindManyOptions } from 'typeorm';
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
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';

/** The members `CreateRolePermissionInput` declares in the schema. */
export interface ICreateRolePermissionInput {
	permission: string;
	enabled: boolean;
	roleId: Id;
}

/** The members `UpdateRolePermissionInput` declares in the schema. */
export interface IUpdateRolePermissionInput extends ICreateRolePermissionInput {
	id: Id;
}

/**
 * The fields a role permission list may be filtered and sorted by, and the order it is returned in
 * when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `RolePermissionFilter` and
 * `RolePermissionSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * `roleId` is the member a caller reaches for, because the permissions of one role *are* the rows of
 * that role: the delivered list route expresses the same narrowing through the `roleId` its own query
 * string binds to the store, and stating it here is what keeps that narrowing a filter of the one
 * connection rather than a second root field over the same rows. `tenantId` is in neither: the tenant
 * a read runs under comes from the credential, and the reader this connection is built over is
 * already scoped by it.
 */
const ROLE_PERMISSION_FILTERABLE = {
	id: 'ID',
	permission: 'STRING',
	enabled: 'BOOLEAN',
	roleId: 'ID',
	description: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ROLE_PERMISSION_SORTABLE = ['createdAt', 'updatedAt', 'permission', 'enabled'] as const;

/**
 * The order the connection means when the caller states none: by permission, which is the
 * catalogue's own order.
 *
 * The delivered list reader applies no order of its own — it hands the store a `where` fragment and
 * takes the rows as they come back — so this is a decision the connection has to make rather than one
 * it reproduces. The catalogue's alphabetical order is the one a client selecting permissions reads,
 * and it is the order the rows are written in when a tenant's permissions are reloaded, so the field
 * answers the same sequence a caller that reloaded a role would recognise. The identifier is the last
 * key, which is what makes the order total: without it two rows written in one reload would have no
 * order between them, and a cursor names a row by its place in one.
 */
const ROLE_PERMISSION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'permission', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The permissions a role carries, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `RolePermissionService` method the `/api/role-permissions`
 * routes call. What it does own is the transport-shaped work — reading arguments and answering in the
 * shape the schema declares.
 *
 * **The guard chain and the permissions are the controller's, read from its metadata rather than
 * restated.** `RolePermissionController` carries `TenantPermissionGuard` and `PermissionGuard` on the
 * class with the class-level `CHANGE_ROLES_PERMISSIONS`, and states a permission of its own on exactly
 * one route — the reading of the caller's own permissions, which states an empty set and is therefore
 * served to any authenticated caller. Every other route it serves, its own and the ones it inherits
 * from the CRUD base, runs under the class-level permission, and so does the field that mirrors it.
 *
 * **The scope of a read is the service's, not this resolver's.** The delivered list reader narrows by
 * the role the caller is acting in — every row for a super administrator, every row but the super
 * administrator's own for a holder of `CHANGE_ROLES_PERMISSIONS`, and the acting role's own rows for
 * anybody else — and the delivered write paths refuse a caller that would grant itself a permission
 * or touch the super administrator's rows. None of that is restated here: the fields call the same
 * methods, so the two protocols refuse the same requests for the same reasons.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('RolePermission')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
export class RolePermissionResolver {
	constructor(private readonly rolePermissionService: RolePermissionService) {}

	/**
	 * The role permissions the caller may read, in the catalogue's own order.
	 *
	 * The read is the one the REST list route performs, and it takes the query object the route binds
	 * its query string to. This surface has no query string to bind, so the read runs with no criterion
	 * of its own — an empty query object, which is what makes the reader build its own tenant and role
	 * fragment rather than reading `where` off nothing — and the connection protocol's `filter` is
	 * applied to the rows that read answers, which is the same set the route answers.
	 */
	@Query('rolePermissions')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async rolePermissions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IRolePermission>> {
		// The reader mutates the query object it is handed — it writes the `where` fragment its own
		// scope produces onto it — so an object is passed rather than nothing.
		const query = {} as FindManyOptions<RolePermission>;
		const { items }: IPagination<IRolePermission> =
			await this.rolePermissionService.findAllRolePermissions(query);

		return buildConnection<IRolePermission>({
			rows: items ?? [],
			filterable: ROLE_PERMISSION_FILTERABLE,
			sortable: ROLE_PERMISSION_SORTABLE,
			defaultSort: ROLE_PERMISSION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One role permission of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('rolePermission')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async rolePermission(@Args('id', { type: () => ID }) id: Id): Promise<IRolePermission | null> {
		try {
			return await this.rolePermissionService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The permissions of the role the caller is acting in.
	 *
	 * The field states the empty permission set its route states, which is what makes it the one read
	 * of this resource every authenticated caller is served: the rows are the caller's own role's, and
	 * the reader narrows them to the enabled ones, so what it answers is what this credential may do
	 * rather than what the catalogue contains.
	 */
	@Query('myRolePermissions')
	@Permissions()
	async myRolePermissions(): Promise<IRolePermissions> {
		return await this.rolePermissionService.findMePermissions();
	}

	/**
	 * How many role permissions the caller's tenant has.
	 *
	 * The same call the count route makes — `countBy` with no criterion — scoped to the caller's tenant
	 * by the service from the credential. It is deliberately not the list's own total: the count route
	 * counts every row of the tenant, while the list is narrowed by the role the caller acts in, and
	 * the two numbers answer two different questions. The route's own narrowing is a `where` fragment
	 * carried in its query string, which is a shape the connection protocol cannot express, so the
	 * field states none rather than an argument it could not honour.
	 */
	@Query('rolePermissionCount')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async rolePermissionCount(): Promise<number> {
		return await this.rolePermissionService.countBy();
	}

	/**
	 * Adds a permission row for a role.
	 *
	 * The same service method the create route calls, with the body as stated: the tenant is stamped
	 * from the credential, and the role is named by its identifier — the one member the delivered
	 * service resolves the target role from, and the one it refuses the write without.
	 */
	@Mutation('createRolePermission')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async createRolePermission(@Args('input') input: ICreateRolePermissionInput): Promise<IRolePermission> {
		return await this.rolePermissionService.createPermission(input);
	}

	/**
	 * Changes the permission a row names and whether the role carries it.
	 *
	 * The delivered route names the row in its path and carries the members in its body, and its
	 * service validates the target role against the caller's own before it writes. The record is then
	 * read back through the same service, because the delivered result is the store's own statement
	 * about the write — `{ affected }` — which is not a row and not what a non-nullable field may
	 * answer.
	 */
	@Mutation('updateRolePermission')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async updateRolePermission(@Args('input') input: IUpdateRolePermissionInput): Promise<IRolePermission> {
		const { id, ...values } = input;

		await this.rolePermissionService.updatePermission(id, values);

		return await this.rolePermissionService.findOneByIdString(id);
	}

	/**
	 * Removes a role permission of the caller's tenant outright.
	 *
	 * The service is the one the route calls, and it applies the same rules the two writes above do:
	 * nobody may remove their own super administrator's permissions, and an administrator may not touch
	 * them either. Those refusals are the service's and are raised here exactly as they are over REST.
	 */
	@Mutation('deleteRolePermission')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async deleteRolePermission(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.rolePermissionService.deletePermission(id);

		return true;
	}

	/**
	 * Withdraws a role permission without removing it: the row keeps its identifier, and the delivered
	 * reads that filter on the marker stop answering it.
	 *
	 * The service is the one the inherited route calls. That route declares no query parameter of its
	 * own and passes the option list it bound from the query string, so the field states none either.
	 */
	@Mutation('softDeleteRolePermission')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async softDeleteRolePermission(@Args('id', { type: () => ID }) id: Id): Promise<IRolePermission> {
		return await this.rolePermissionService.softRemove(id);
	}

	/**
	 * Puts a withdrawn role permission back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverRolePermission')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async recoverRolePermission(@Args('id', { type: () => ID }) id: Id): Promise<IRolePermission> {
		return await this.rolePermissionService.softRecover(id);
	}
}
