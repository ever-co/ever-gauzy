import { IRole } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RolePermissionsService } from '../../../role-permissions/role-permissions.service';
import { RoleService } from '../../role.service';
import { TenantRoleBulkCreateCommand } from '../tenant-role-bulk-create.command';

@CommandHandler(TenantRoleBulkCreateCommand)
export class TenantRoleBulkCreateHandler
	implements ICommandHandler<TenantRoleBulkCreateCommand> {
	constructor(
		private readonly roleService: RoleService,
		private readonly rolePermissionsService: RolePermissionsService
	) {}

	public async execute(
		command: TenantRoleBulkCreateCommand
	): Promise<IRole[]> {
		const { input: tenants } = command;

		//create roles/permissions after create tenant
		const roles = await this.roleService.createBulk(tenants);
		await this.rolePermissionsService.updateRolesAndPermissions(
			tenants,
			roles
		);
		return roles;
	}
}
