import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Tenant } from './tenant.entity';
import {
	ITenantCreateInput,
	RolesEnum,
	ITenant,
	IUser
} from '@gauzy/contracts';
import { UserService } from '../user/user.service';
import { RoleService } from 'role/role.service';
import { TenantRoleBulkCreateCommand } from '../role/commands/tenant-role-bulk-create.command';
import { TenantFeatureOrganizationCreateCommand } from './commands/tenant-feature-organization.create.command';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		@InjectRepository(Tenant)
		private readonly tenantRepository: Repository<Tenant>,
		private readonly userService: UserService,
		private readonly roleService: RoleService,
		private readonly commandBus: CommandBus
	) {
		super(tenantRepository);
	}

	public async onboardTenant(
		entity: ITenantCreateInput,
		user: IUser
	): Promise<ITenant> {
		//1. Create Tenant of user.
		const tenant = await this.create(entity);

		//2. Create Enabled/Disabled features for relative tenants.
		await this.commandBus.execute(
			new TenantFeatureOrganizationCreateCommand([tenant])
		);

		//3. Create Role/Permissions to relative tenants.
		await this.commandBus.execute(
			new TenantRoleBulkCreateCommand([tenant])
		);

		//4. Find SUPER_ADMIN role to relative tenant.
		const role = await this.roleService.findOne({
			tenant,
			name: RolesEnum.SUPER_ADMIN
		});

		//5. Assign tenant and role to user.
		await this.userService.update(user.id, {
			tenant: {
				id: tenant.id
			},
			role: {
				id: role.id
			}
		});
		return tenant;
	}
}
