import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IRole } from '@gauzy/contracts';
import { RolePermissionService } from '../../../role-permission/role-permission.service';
import { RoleService } from '../../role.service';
import { TenantRoleBulkCreateCommand } from '../tenant-role-bulk-create.command';

@CommandHandler(TenantRoleBulkCreateCommand)
export class TenantRoleBulkCreateHandler implements ICommandHandler<TenantRoleBulkCreateCommand> {

	constructor(
		private readonly roleService: RoleService,
		private readonly rolePermissionService: RolePermissionService
	) { }

	/**
	 * Executes a bulk role creation and permission update operation for tenants.
	 * It first creates roles in bulk for the provided tenants and then updates their permissions accordingly.
	 *
	 * @param command An instance of TenantRoleBulkCreateCommand containing tenant data.
	 * @returns A Promise that resolves to an array of IRole, representing the newly created roles.
	 */
	public async execute(command: TenantRoleBulkCreateCommand): Promise<IRole[]> {
		const { input: tenants } = command;

		//1. Create Roles of tenant.
		const roles = await this.roleService.createBulk(tenants);

		//2. Update RolePermission of tenant.
		await this.rolePermissionService.updateRolesAndPermissions(tenants);
		return roles;
	}
}
