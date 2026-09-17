import { NotFoundException, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IRole, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { ApiErrorCode } from './../core/errors/api-error-codes';
import { ApiException } from './../core/errors/api-exception';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
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
 * The role domain's read and write operations, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `RoleService` the `POST /api/roles` and `PUT
 * /api/roles/:id` routes call, under the same guard chain and the same permissions. What it does own
 * is the transport-shaped work — reading arguments, validating them, and answering in the shape the
 * schema declares.
 *
 * `tenantId` arrives on both inputs because the schema declares it. It is never trusted: the
 * service stamps the caller's tenant from the request context on write, and every read is scoped to
 * that tenant by `TenantAwareCrudService`, so an input naming another tenant cannot reach a row of
 * one — the guard refuses the mismatch before this resolver runs, and the service would overwrite
 * the value in any case.
 */
@Resolver('Role')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
}
