import { IRole } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RolePermissionService } from '../../../role-permission/role-permission.service';
import { RoleService } from '../../role.service';
import { TenantRoleBulkCreateCommand } from '../tenant-role-bulk-create.command';

@CommandHandler(TenantRoleBulkCreateCommand)
export class TenantRoleBulkCreateHandler
	implements ICommandHandler<TenantRoleBulkCreateCommand> {
	constructor(
		private readonly roleService: RoleService,
		private readonly rolePermissionService: RolePermissionService
	) {}

	public async execute(
		command: TenantRoleBulkCreateCommand
	): Promise<IRole[]> {
		const { input: tenants } = command;

		//1. Create Roles of tenant.
		const roles = await this.roleService.createBulk(tenants);

		//2. Update RolePermission of tenant.
		await this.rolePermissionService.updateRolesAndPermissions(
			tenants
		);
		return roles;
	}
}
