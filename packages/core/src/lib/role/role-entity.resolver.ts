import { NotFoundException, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, IRole, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from './../core/context';
import { ApiErrorCode } from './../core/errors/api-error-codes';
import { ApiException } from './../core/errors/api-exception';
import { Permissions } from './../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { RoleService } from './role.service';

/** The members `CreateRoleInput` declares in the schema. */
export interface ICreateRoleInput {
	name: string;
	tenantId: string;
}

/** The members `UpdateRoleInput` declares in the schema. */
export interface IUpdateRoleInput {
	id: string;
	name?: string;
	tenantId: string;
}

/**
 * The fields a role list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `RoleFilter` and `RoleSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `name` is the member that matters — a role is its name — and `isSystem` is here because that
 * distinction is what the delivered removal is defined in terms of. `tenantId` is in neither: the
 * tenant a read runs under comes from the credential, never from a filter, and the read this
 * connection is built over is already scoped by it.
 */
const ROLE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	isSystem: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ROLE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'isSystem'] as const;

/**
 * The order the connection means when the caller states none: by name, which is what a role is.
 *
 * The delivered list read applies no order of its own — it hands the store no criterion at all and
 * takes the rows as they come back — so this is a decision the connection has to make rather than one
 * it reproduces. The identifier is the last key, which is what makes the order total: without it two
 * roles written in the same millisecond would have no order between them, and a cursor names a row by
 * its place in one.
 */
const ROLE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The role domain's read and write operations, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `RoleService` method the `/api/roles` routes call, under
 * the same guard chain and the same permissions. What it does own is the transport-shaped work —
 * reading arguments, validating them, and answering in the shape the schema declares.
 *
 * **The guard stack and the permissions are the controller's, read from its metadata rather than
 * restated.** `RoleController` carries `TenantPermissionGuard` and `PermissionGuard` on the class
 * with the class-level `CHANGE_ROLES_PERMISSIONS`, and states a permission of its own on exactly one
 * route: the options look-up, which is served to a caller holding `CHANGE_ROLES_PERMISSIONS` *or*
 * `ORG_TEAM_ADD`. Every route it inherits from the CRUD base — the node, the count and the two
 * lifecycle moves — therefore runs under the class-level permission, and so does the field that
 * mirrors it: a field that demanded less would serve more than REST does, and one that demanded more
 * would refuse a caller REST serves.
 *
 * **The list is a connection and its two routes are one field.** The controller serves the list at
 * `GET /` and again at `GET /pagination`, and the second is the first with `take`/`skip` applied —
 * one capability, one root field, with the page the paginated spelling performs stated by the
 * connection's own `limit` and `offset`. The plural name that field would carry is already taken by
 * the kernel-shaped `roles` field below, which answers the one role the credential is acting in and
 * is declared non-nullable: retyping it is a breaking schema change, so the tenant's list states
 * whose roles it is.
 *
 * `tenantId` arrives on both write inputs because the schema declares it. It is never trusted: the
 * service stamps the caller's tenant from the request context on write, and every read is scoped to
 * that tenant by `TenantAwareCrudService`, so an input naming another tenant cannot reach a row of
 * one — the guard refuses the mismatch before this resolver runs, and the service would overwrite
 * the value in any case.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Role')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
export class RoleEntityResolver {
	constructor(private readonly roleService: RoleService) {}

	/**
	 * The role this credential is acting in.
	 *
	 * The field is declared as a single non-nullable `Role`, and it stays that way: retyping it to a
	 * list or to a connection is a breaking schema change and belongs to a reviewed decision of its
	 * own. The singular answer the declaration admits is the role the request is acting as, which is
	 * also the one role every caller of this field has in hand.
	 *
	 * @returns The caller's role.
	 * @throws ApiException when the credential is not acting in one.
	 */
	@Query('roles')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async roles(): Promise<IRole> {
		const roleId = RequestContext.currentRoleId();

		if (!roleId) {
			throw new ApiException(
				404,
				ApiErrorCode.RESOURCE_NOT_FOUND,
				'This credential is not acting in a role.'
			);
		}

		return this.roleService.findOneByIdString(roleId);
	}

	/**
	 * The roles of the caller's tenant, by name.
	 *
	 * The read is the one the REST list route performs: `RoleService.findAll()` with no `where` and no
	 * relations, scoped to the caller's tenant by `TenantAwareCrudService` from the credential rather
	 * than from an argument. This surface has no query string to bind, so the narrowing a caller
	 * states arrives in `filter` and is applied to the rows that read returns — the same set the route
	 * answers, narrowed by the same protocol.
	 */
	@Query('tenantRoles')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async tenantRoles(
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
	): Promise<GraphqlConnection<IRole>> {
		const { items }: IPagination<IRole> = await this.roleService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<IRole>({
			rows: items ?? [],
			filterable: ROLE_FILTERABLE,
			sortable: ROLE_SORTABLE,
			defaultSort: ROLE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One role of the caller's tenant.
	 *
	 * The field is nullable in the schema, so a role that does not exist — or that belongs to
	 * another tenant, which reads identically from here — answers `null`. A caller that may not read
	 * roles at all is refused by the guard above, which is a different answer and stays an error.
	 *
	 * @param id The role id.
	 * @returns The role, or null when this tenant has none with that id.
	 */
	@Query('role')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async role(@Args('id', ParseUUIDPipe) id: string): Promise<IRole | null> {
		try {
			return await this.roleService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The role the delivered options look-up answers.
	 *
	 * The body is the route's own, in the route's own order: the role the caller is acting in is
	 * answered first, under a criterion fixed to the employee name, and the role the options select is
	 * answered when that first read misses. The criterion's default is the employee role, which is the
	 * default the route's own query DTO carries and therefore what the route answers a caller that
	 * states nothing. The tenant and the organization the route's DTO binds are not stated here: the
	 * tenant comes from the credential, and a role carries no organization.
	 *
	 * This is a field of its own rather than a narrowing of the connection, and that is a statement
	 * about the delivered route rather than a second spelling of the same read. The route answers
	 * **one** role, selected by a rule the connection protocol cannot state, and it is served under
	 * the wider pair `CHANGE_ROLES_PERMISSIONS` *or* `ORG_TEAM_ADD` — folding it into the connection,
	 * whose own route carries the class-level permission alone, would refuse a team manager the row
	 * REST serves.
	 *
	 * A caller naming a role this tenant does not have is answered `null`: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the refusal the route raises for that case is
	 * the same fact stated in the other protocol's vocabulary. A caller that may not read roles at all
	 * is refused by the guard, which is a different answer and stays an error.
	 */
	@Query('roleByOptions')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS, PermissionsEnum.ORG_TEAM_ADD)
	async roleByOptions(@Args('name', { type: () => String, nullable: true }) name?: string): Promise<IRole | null> {
		try {
			return await this.roleService.findOneByIdString(RequestContext.currentRoleId(), {
				where: { name: RolesEnum.EMPLOYEE }
			});
		} catch {
			// The route falls through to its second read on any failure of the first, and so does this
			// field: a caller that is not acting in the employee role is not an error, it is the case the
			// second read exists for.
		}

		try {
			return await this.roleService.findOneByWhereOptions({ name: name ?? RolesEnum.EMPLOYEE });
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many roles the caller's tenant has.
	 *
	 * The same call the count route makes — `countBy` with no criterion — scoped to the caller's
	 * tenant by the service from the credential rather than from an argument. It states no narrowing
	 * because the route's own narrowing is a `where` fragment carried in its query string, which is a
	 * shape the connection protocol cannot express: an argument here would either be handed to a call
	 * that cannot accept it or evaluated over a second code path that could disagree with the
	 * connection's `totalCount`.
	 */
	@Query('roleCount')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async roleCount(): Promise<number> {
		return await this.roleService.countBy();
	}

	/**
	 * Creates a role for the caller's tenant.
	 *
	 * The name is validated here rather than in the service because it is argument validation: the
	 * REST route reaches the same service through a DTO whose `@IsRoleAlreadyExist()` constraint
	 * states the same rule, and a client that switched surfaces must not be able to create a second
	 * role with a name the first surface refuses.
	 *
	 * @param input The declared input members.
	 * @returns The created role.
	 */
	@Mutation('createRole')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async createRole(@Args('input') input: ICreateRoleInput): Promise<IRole> {
		const name = String(input?.name ?? '').trim();

		if (!name) {
			throw new ApiException(400, ApiErrorCode.VALIDATION_REQUIRED_FIELD, 'A role name is required.', {
				field: 'name'
			});
		}

		const existing = await this.roleService.countBy({ name } as any);

		if (existing > 0) {
			throw new ApiException(
				400,
				ApiErrorCode.VALIDATION_FAILED,
				'A role with this name already exists in this tenant.',
				{ field: 'name' }
			);
		}

		// The tenant is taken from the request context by the service; the input's own `tenantId` is
		// deliberately not passed on.
		return this.roleService.create({ name } as any);
	}

	/**
	 * Renames a role of the caller's tenant.
	 *
	 * The field is declared non-nullable, so the record is read back after the write rather than the
	 * update result being returned: `PUT /api/roles/:id` answers with what the ORM reported, and
	 * that is a transport detail this schema does not expose.
	 *
	 * @param input The declared input members.
	 * @returns The role as it now stands.
	 */
	@Mutation('updateRole')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async updateRole(@Args('input') input: IUpdateRoleInput): Promise<IRole> {
		const id = String(input?.id ?? '');

		// Tenant-scoped, and it throws when the role is not this tenant's — which is what keeps the
		// update below from reaching another tenant's row.
		await this.roleService.findOneByIdString(id);

		const name = typeof input?.name === 'string' ? input.name.trim() : undefined;

		if (name !== undefined && !name) {
			throw new ApiException(400, ApiErrorCode.VALIDATION_REQUIRED_FIELD, 'A role name cannot be empty.', {
				field: 'name'
			});
		}

		await this.roleService.update(id, { ...(name === undefined ? {} : { name }) } as any);

		return this.roleService.findOneByIdString(id);
	}

	/**
	 * Removes a role of the caller's tenant outright.
	 *
	 * The delivered removal narrows its own criteria before it runs — `isSystem: false` and a name
	 * outside the platform's own set — so a system role is not refused by the service, it is simply
	 * not selected, and the store reports no affected row. This field does not pre-empt that rule: it
	 * reports that the removal ran, which is the fact the REST route states with its own result, and a
	 * caller that must know whether a row went reads it back through `tenantRoles`.
	 */
	@Mutation('deleteRole')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async deleteRole(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.roleService.delete(id);

		return true;
	}

	/**
	 * Withdraws a role of the caller's tenant without removing it: the row keeps its identifier, so
	 * the permission rows that point at it keep resolving, and the delivered list stops answering it.
	 *
	 * The service is the one the inherited route calls. That route declares no query parameter of its
	 * own and passes the option list it bound from the query string, so the field states none either.
	 */
	@Mutation('softDeleteRole')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async softDeleteRole(@Args('id', { type: () => ID }) id: Id): Promise<IRole> {
		return await this.roleService.softRemove(id);
	}

	/**
	 * Puts a withdrawn role back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverRole')
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	async recoverRole(@Args('id', { type: () => ID }) id: Id): Promise<IRole> {
		return await this.roleService.softRecover(id);
	}
}
