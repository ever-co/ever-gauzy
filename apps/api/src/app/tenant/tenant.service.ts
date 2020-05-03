import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Tenant } from './tenant.entity';
import { ITenantCreateInput, RolesEnum, ITenant, User } from '@gauzy/models';
import { RoleService } from '../role/role.service';
import { UserService } from '../user/user.service';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		@InjectRepository(Tenant)
		private readonly tenantRepository: Repository<Tenant>,
		private readonly roleService: RoleService,
		private readonly userService: UserService,
		private readonly rolePermissionsService: RolePermissionsService
	) {
		super(tenantRepository);
	}

	public async onboardTenant(
		entity: ITenantCreateInput,
		user: User
	): Promise<ITenant> {
		const tenant = await this.create(entity);
		const role = await this.roleService.create({
			name: RolesEnum.SUPER_ADMIN,
			tenant
		});

		this.userService.update(user.id, {
			tenant: {
				id: tenant.id
			},
			role: {
				id: role.id
			}
		});

		this.rolePermissionsService.updateRoles(tenant, role);

		return tenant;
	}
}
