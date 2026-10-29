import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IRole, ITenant, RolesEnum } from '@gauzy/contracts';
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
		const { input: tenants, options } = command;
		const onlyMissing = !!options?.onlyMissing;

		//1. Create Roles of tenant.
		const roles = onlyMissing ? await this.createMissingRoles(tenants) : await this.roleService.createBulk(tenants);

		//2. Update RolePermission of tenant.
		await this.rolePermissionService.updateRolesAndPermissions(tenants, { onlyMissing });
		return roles;
	}

	/**
	 * Creates, for each tenant, the default roles it does not hold. A role the tenant holds, a withdrawn
	 * (soft-deleted) one included, is not created again.
	 *
	 * @param tenants - The tenants to complete.
	 * @returns The roles created.
	 */
	private async createMissingRoles(tenants: ITenant[]): Promise<IRole[]> {
		const created: IRole[] = [];
		for (const tenant of tenants) {
			const held = await this.roleService.find({ where: { tenantId: tenant.id }, withDeleted: true } as never);
			const names = new Set((held ?? []).map((role) => role.name));
			const missing = Object.values(RolesEnum).filter((name) => !names.has(name));
			if (missing.length > 0) {
				created.push(...(await this.roleService.createBulk([tenant], missing)));
			}
		}
		return created;
	}
}
